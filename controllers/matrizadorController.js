/**
 * Controlador para gestionar los matrizadores
 * Contiene las funciones para crear, listar, actualizar y eliminar matrizadores,
 * así como para generar y verificar códigos QR
 */

const Matrizador = require('../models/Matrizador');
const { sequelize, Sequelize } = require('../config/database');
const QRCode = require('qrcode');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { redirigirSegunRol } = require('../middlewares/auth');
const Documento = require('../models/Documento');
const EventoDocumento = require('../models/EventoDocumento');
const RegistroAuditoria = require('../models/RegistroAuditoria');
const { Op } = require('sequelize');
const moment = require('moment');
const { 
  inferirTipoDocumentoPorCodigo, 
  procesarFechaDocumento,
  formatearValorMonetario,
  obtenerTimestampEcuador,
  formatearTimestamp,
  formatearFechaSinHora
} = require('../utils/documentoUtils');
const NotificationService = require('../services/notificationService');

// ============== FUNCIONES PARA CONSTRUCCIÓN DE MENSAJES PROFESIONALES ==============

/**
 * Construye mensajes profesionales para notificación de documento listo
 * @param {Object} documento - Datos del documento
 * @param {string} codigoVerificacion - Código de verificación generado
 * @returns {Object} Mensajes para WhatsApp y Email
 */
function construirMensajeDocumentoListo(documento, codigoVerificacion) {
  let contextoTramite = '';
  if (documento.notas && 
      typeof documento.notas === 'string' && 
      documento.notas.trim().length > 0) {
    contextoTramite = ` - ${documento.notas.trim()}`;
  }

  // Mensaje WhatsApp optimizado
  const mensajeWhatsApp = `🏛️ *NOTARÍA 18*

¡Su documento está listo para retirar!

📄 *Trámite:* ${documento.tipoDocumento}${contextoTramite}
📋 *Documento:* ${documento.codigoBarras}
🔢 *Código de verificación:* ${codigoVerificacion}
👤 *Cliente:* ${documento.nombreCliente}

📍 Retírelo en: Notaría Décima Octava
🕒 Horario: Lunes a Viernes 8:00-17:00

⚠️ *IMPORTANTE:* Presente el código de verificación y su cédula para el retiro.`;

  // Datos para email profesional
  const datosEmail = {
    nombreCliente: documento.nombreCliente,
    tipoDocumento: documento.tipoDocumento,
    codigoDocumento: documento.codigoBarras,
    detallesAdicionales: documento.notas?.trim() || null,
    codigoVerificacion: codigoVerificacion,
    fechaFormateada: new Date().toLocaleDateString('es-EC')
  };

  return {
    whatsapp: mensajeWhatsApp,
    email: {
      subject: `Documento listo para retiro - Notaría 18`,
      template: 'documento-listo',
      data: datosEmail
    },
    tipo: 'documento_listo'
  };
}

/**
 * Construye mensajes profesionales para notificación de documento entregado
 * @param {Object} documento - Datos del documento
 * @param {Object} datosEntrega - Datos de la entrega
 * @returns {Object} Mensajes para WhatsApp y Email
 */
function construirMensajeDocumentoEntregado(documento, datosEntrega) {
  let contextoTramite = '';
  if (documento.notas && 
      typeof documento.notas === 'string' && 
      documento.notas.trim().length > 0) {
    contextoTramite = ` - ${documento.notas.trim()}`;
  }

  const fechaEntrega = new Date().toLocaleDateString('es-EC', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
  
  const horaEntrega = new Date().toLocaleTimeString('es-EC', {
    hour: '2-digit', minute: '2-digit', hour12: false
  });

  // Mensaje WhatsApp para confirmación de entrega
  const mensajeWhatsApp = `🏛️ *NOTARÍA 18*

✅ *DOCUMENTO ENTREGADO EXITOSAMENTE*

📄 *Documento:* ${documento.tipoDocumento}${contextoTramite}
📋 *Código:* ${documento.codigoBarras}
👤 *Cliente:* ${documento.nombreCliente}

📦 *DETALLES DE LA ENTREGA:*
👨‍💼 *Retirado por:* ${datosEntrega.nombreReceptor}
🆔 *Identificación:* ${datosEntrega.identificacionReceptor}
👥 *Relación:* ${datosEntrega.relacionReceptor}

📅 *Fecha:* ${fechaEntrega}
🕒 *Hora:* ${horaEntrega}
📍 *Lugar:* Notaría Décima Octava, Quito

✅ *Su trámite ha sido completado exitosamente.*

_Guarde este mensaje como comprobante de entrega._`;

  // Datos para email de confirmación
  const datosEmail = {
    nombreCliente: documento.nombreCliente,
    tipoDocumento: documento.tipoDocumento,
    codigoDocumento: documento.codigoBarras,
    detallesAdicionales: documento.notas?.trim() || null,
    nombreReceptor: datosEntrega.nombreReceptor,
    identificacionReceptor: datosEntrega.identificacionReceptor,
    relacionReceptor: datosEntrega.relacionReceptor,
    fechaEntrega: fechaEntrega,
    horaEntrega: horaEntrega,
    usuarioEntrega: datosEntrega.usuarioEntrega || 'Personal de Notaría',
    fechaGeneracion: new Date().toLocaleString('es-EC')
  };

  return {
    whatsapp: mensajeWhatsApp,
    email: {
      subject: `Documento entregado - ${documento.codigoBarras} - Notaría 18`,
      template: 'confirmacion-entrega',
      data: datosEmail
    },
    tipo: 'documento_entregado'
  };
}

// Objeto que contendrá todas las funciones del controlador
const matrizadorController = {
  
  /**
   * Obtiene todos los matrizadores
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  obtenerTodos: async (req, res) => {
    try {
      console.log('Obteniendo todos los matrizadores...');
      const matrizadores = await Matrizador.findAll({
        raw: true // Obtener resultados como objetos planos JS en lugar de instancias de Sequelize
      });
      
      console.log(`Se encontraron ${matrizadores.length} matrizadores:`, 
        matrizadores.map(m => ({ id: m.id, nombre: m.nombre, email: m.email })));
      
      // Si es una solicitud de vista, renderizar la página de matrizadores
      if (!req.path.startsWith('/api/')) {
        console.log('Renderizando vista de matrizadores con:', matrizadores);
        return res.render('admin/matrizadores', {
          layout: 'admin',
          title: 'Gestión de Matrizadores',
          activeMatrizadores: true,
          matrizadores: matrizadores || [],
          userRole: req.matrizador?.rol || 'guest'
        });
      }
      
      return res.status(200).json({
        exito: true,
        datos: matrizadores,
        mensaje: 'Matrizadores obtenidos correctamente'
      });
    } catch (error) {
      console.error('Error al obtener matrizadores:', error);
      return res.status(500).json({
        exito: false,
        mensaje: 'Error al obtener los matrizadores',
        error: error.message
      });
    }
  },

  /**
   * Obtiene un matrizador por su ID
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  obtenerPorId: async (req, res) => {
    try {
      const { id } = req.params;
      const matrizador = await Matrizador.findByPk(id);
      
      if (!matrizador) {
        return res.status(404).json({
          exito: false,
          mensaje: `No se encontró matrizador con ID ${id}`
        });
      }

      return res.status(200).json({
        exito: true,
        datos: matrizador,
        mensaje: 'Matrizador obtenido correctamente'
      });
    } catch (error) {
      console.error('Error al obtener matrizador por ID:', error);
      return res.status(500).json({
        exito: false,
        mensaje: 'Error al obtener el matrizador',
        error: error.message
      });
    }
  },

  /**
   * Crea un nuevo matrizador
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  crear: async (req, res) => {
    try {
      const { nombre, email, identificacion, cargo, password, rol } = req.body;
      
      // Determinar la ruta de redirección según el contexto
      const esAdmin = req.originalUrl.includes('/admin/') || req.baseUrl.includes('/admin/');
      const rutaRedireccion = esAdmin ? '/admin/matrizadores' : '/matrizador';
      
      // Verificar campos obligatorios
      if (!nombre || !email || !identificacion || !cargo) {
        if (req.path.startsWith('/api/')) {
          return res.status(400).json({
            exito: false,
            mensaje: 'Faltan campos obligatorios'
          });
        }
        
        req.flash('error', 'Todos los campos son obligatorios');
        return res.redirect(rutaRedireccion);
      }
      
      // Verificar si ya existe un matrizador con el mismo email o identificación
      const matrizadorExistente = await Matrizador.findOne({
        where: {
          [Sequelize.Op.or]: [
            { email },
            { identificacion }
          ]
        }
      });
      
      if (matrizadorExistente) {
        if (req.path.startsWith('/api/')) {
          return res.status(400).json({
            exito: false,
            mensaje: 'Ya existe un matrizador con ese email o identificación'
          });
        }
        
        req.flash('error', 'Ya existe un matrizador con ese email o identificación');
        return res.redirect(rutaRedireccion);
      }
      
      // Preparar datos para crear el matrizador
      const datosMatrizador = {
        nombre,
        email,
        identificacion,
        cargo,
        rol: rol || 'matrizador', // Usar el rol proporcionado o el valor predeterminado
        activo: true
      };
      
      // Validar que el rol sea válido
      const rolesValidos = ['admin', 'matrizador', 'recepcion', 'consulta', 'caja', 'caja_archivo'];
      if (rol && !rolesValidos.includes(rol)) {
        datosMatrizador.rol = 'matrizador'; // Rol por defecto si no es válido
      }
      
      // Si se proporcionó contraseña, hashearla
      if (password) {
        const salt = await bcrypt.genSalt(10);
        datosMatrizador.password = await bcrypt.hash(password, salt);
      }
      
      const nuevoMatrizador = await Matrizador.create(datosMatrizador);
      
      // Si es una solicitud de vista, redirigir con mensaje de éxito
      if (!req.path.startsWith('/api/')) {
        req.flash('success', 'Matrizador creado correctamente');
        return res.redirect(rutaRedireccion);
      }
      
      // Para API, eliminar la contraseña de la respuesta
      const matrizadorRespuesta = nuevoMatrizador.toJSON();
      delete matrizadorRespuesta.password;
      
      return res.status(201).json({
        exito: true,
        datos: matrizadorRespuesta,
        mensaje: 'Matrizador creado correctamente'
      });
    } catch (error) {
      console.error('Error al crear matrizador:', error);
      
      if (req.path.startsWith('/api/')) {
        return res.status(500).json({
          exito: false,
          mensaje: 'Error al crear el matrizador',
          error: error.message
        });
      }
      
      req.flash('error', `Error al crear el matrizador: ${error.message}`);
      return res.redirect(rutaRedireccion);
    }
  },

  /**
   * Actualiza un matrizador existente
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  actualizar: async (req, res) => {
    try {
      // 🔍 DEBUG ESPECÍFICO PARA IDENTIFICAR EL PROBLEMA
      console.log('=== DEBUG ACTUALIZAR MATRIZADOR ===');
      console.log('URL original:', req.originalUrl);
      console.log('Path:', req.path);
      console.log('Método:', req.method);
      console.log('Usuario rol:', req.matrizador?.rol);
      console.log('Usuario nombre:', req.matrizador?.nombre);
      console.log('Body ID:', req.body.id);
      console.log('Params ID:', req.params.id);
      console.log('¿Es admin?:', req.originalUrl.includes('/admin/') || req.baseUrl.includes('/admin/'));
      console.log('=====================================');
      
      // Obtener ID de la ruta o del cuerpo de la solicitud
      const id = req.params.id || req.body.id;
      
      // Determinar la ruta de redirección según el contexto
      const esAdmin = req.originalUrl.includes('/admin/') || req.baseUrl.includes('/admin/');
      const rutaRedireccion = esAdmin ? '/admin/matrizadores' : '/matrizador';
      
      console.log(`🎯 Ruta de redirección determinada: ${rutaRedireccion}`);
      console.log(`Intentando actualizar matrizador con ID: ${id}`);
      
      // Validar que el ID exista
      if (!id) {
        console.error('Error: ID de matrizador no proporcionado');
        if (req.path.startsWith('/api/')) {
          return res.status(400).json({
            exito: false,
            mensaje: 'Debe proporcionar un ID de matrizador para actualizarlo'
          });
        }
        
        req.flash('error', 'Debe proporcionar un ID de matrizador para actualizarlo');
        console.log(`🔄 Redirigiendo por falta de ID a: ${rutaRedireccion}`);
        return res.redirect(rutaRedireccion);
      }
      
      const { nombre, email, identificacion, cargo, password, rol, activo } = req.body;
      
      // Buscar el matrizador
      const matrizador = await Matrizador.findByPk(id);
      
      if (!matrizador) {
        console.error(`No se encontró matrizador con ID ${id}`);
        if (req.path.startsWith('/api/')) {
          return res.status(404).json({
            exito: false,
            mensaje: `No se encontró matrizador con ID ${id}`
          });
        }
        
        req.flash('error', `No se encontró matrizador con ID ${id}`);
        return res.redirect(rutaRedireccion);
      }

      // Preparar datos para actualizar
      const datosActualizar = {};
      
      if (nombre) datosActualizar.nombre = nombre;
      if (email) datosActualizar.email = email;
      if (identificacion) datosActualizar.identificacion = identificacion;
      if (cargo) datosActualizar.cargo = cargo;
      if (rol) datosActualizar.rol = rol;
      if (activo !== undefined) datosActualizar.activo = activo === '1' || activo === true;
      
      // Si se proporcionó contraseña, hashearla
      if (password) {
        const salt = await bcrypt.genSalt(10);
        datosActualizar.password = await bcrypt.hash(password, salt);
      }
      
      console.log(`Actualizando matrizador ${matrizador.nombre} con datos:`, datosActualizar);
      await matrizador.update(datosActualizar);
      
      // Si es una solicitud de vista, redirigir con mensaje de éxito
      if (!req.path.startsWith('/api/')) {
        console.log(`✅ ÉXITO: Matrizador actualizado correctamente. Redirigiendo a: ${rutaRedireccion}`);
        req.flash('success', 'Matrizador actualizado correctamente');
        return res.redirect(rutaRedireccion);
      }
      
      // Eliminar la contraseña de la respuesta
      const matrizadorRespuesta = matrizador.toJSON();
      delete matrizadorRespuesta.password;
      
      return res.status(200).json({
        exito: true,
        datos: matrizadorRespuesta,
        mensaje: 'Matrizador actualizado correctamente'
      });
    } catch (error) {
      console.error('Error al actualizar matrizador:', error);
      
      if (req.path.startsWith('/api/')) {
        return res.status(500).json({
          exito: false,
          mensaje: 'Error al actualizar el matrizador',
          error: error.message
        });
      }
      
      req.flash('error', `Error al actualizar el matrizador: ${error.message}`);
      return res.redirect(rutaRedireccion);
    }
  },

  /**
   * Elimina un matrizador del sistema
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  eliminar: async (req, res) => {
    try {
      // Obtener ID de la ruta o del cuerpo de la solicitud
      const id = req.params.id || req.body.id;
      
      console.log(`Intentando eliminar matrizador con ID: ${id}`);
      
      // Validar que el ID exista
      if (!id) {
        console.error('Error: ID de matrizador no proporcionado para eliminar');
        if (req.path.startsWith('/api/')) {
          return res.status(400).json({
            exito: false,
            mensaje: 'Debe proporcionar un ID de matrizador para eliminarlo'
          });
        }
        
        req.flash('error', 'Debe proporcionar un ID de matrizador para eliminarlo');
        // CORREGIDO: Redirigir según el contexto de la ruta
        const redirectUrl = req.originalUrl.startsWith('/admin/') ? '/admin/matrizadores' : '/matrizador';
        return res.redirect(redirectUrl);
      }
      
      const matrizador = await Matrizador.findByPk(id);
      
      if (!matrizador) {
        console.error(`No se encontró matrizador con ID ${id} para eliminar`);
        if (req.path.startsWith('/api/')) {
          return res.status(404).json({
            exito: false,
            mensaje: `No se encontró matrizador con ID ${id}`
          });
        }
        
        req.flash('error', `No se encontró matrizador con ID ${id}`);
        // CORREGIDO: Redirigir según el contexto de la ruta
        const redirectUrl = req.originalUrl.startsWith('/admin/') ? '/admin/matrizadores' : '/matrizador';
        return res.redirect(redirectUrl);
      }

      console.log(`Eliminando matrizador: ${matrizador.nombre} (ID: ${matrizador.id})`);
      await matrizador.destroy();
      
      // Si es una solicitud de vista, redirigir con mensaje de éxito
      if (!req.path.startsWith('/api/')) {
        req.flash('success', 'Matrizador eliminado correctamente');
        // CORREGIDO: Redirigir según el contexto de la ruta
        const redirectUrl = req.originalUrl.startsWith('/admin/') ? '/admin/matrizadores' : '/matrizador';
        return res.redirect(redirectUrl);
      }
      
      return res.status(200).json({
        exito: true,
        mensaje: 'Matrizador eliminado correctamente'
      });
    } catch (error) {
      console.error('Error al eliminar matrizador:', error);
      
      if (req.path.startsWith('/api/')) {
        return res.status(500).json({
          exito: false,
          mensaje: 'Error al eliminar el matrizador',
          error: error.message
        });
      }
      
      req.flash('error', `Error al eliminar el matrizador: ${error.message}`);
      // CORREGIDO: Redirigir según el contexto de la ruta
      const redirectUrl = req.originalUrl.startsWith('/admin/') ? '/admin/matrizadores' : '/matrizador';
      return res.redirect(redirectUrl);
    }
  },
  
  /**
   * Genera y devuelve un código QR para un matrizador
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  generarQR: async (req, res) => {
    try {
      const { id } = req.params;
      const matrizador = await Matrizador.findByPk(id);
      
      if (!matrizador) {
        return res.status(404).json({
          exito: false,
          mensaje: `No se encontró matrizador con ID ${id}`
        });
      }
      
      // Obtener la URL que debe contener el QR
      const urlQR = matrizador.obtenerUrlQR();
      
      // Generar la imagen QR
      const qrCode = await QRCode.toDataURL(urlQR);
      
      // Si es una API, devolvemos el QR como datos
      if (req.path.startsWith('/api/')) {
        return res.status(200).json({
          exito: true,
          datos: {
            matrizador: {
              id: matrizador.id,
              nombre: matrizador.nombre,
              usuario: matrizador.usuario,
              codigoQR: matrizador.codigoQR
            },
            qrCode: qrCode,
            url: urlQR
          },
          mensaje: 'Código QR generado correctamente'
        });
      }
      
      // Si es una vista, renderizamos la página con el QR
      return res.render('matrizadores/qr', {
        title: 'Código QR de Matrizador',
        matrizador: {
          id: matrizador.id,
          nombre: matrizador.nombre,
          usuario: matrizador.usuario,
          codigoQR: matrizador.codigoQR
        },
        qrCode: qrCode,
        url: urlQR
      });
    } catch (error) {
      console.error('Error al generar QR:', error);
      return res.status(500).json({
        exito: false,
        mensaje: 'Error al generar el código QR',
        error: error.message
      });
    }
  },
  
  /**
   * Verifica un código QR y devuelve el matrizador asociado
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  verificarQR: async (req, res) => {
    try {
      const { codigo } = req.params;
      
      if (!codigo) {
        return res.status(400).json({
          exito: false,
          mensaje: 'Se requiere un código QR para verificar'
        });
      }
      
      // Buscar el matrizador por el código QR
      const matrizador = await Matrizador.findOne({
        where: { codigoQR: codigo, activo: true }
      });
      
      if (!matrizador) {
        return res.status(404).json({
          exito: false,
          mensaje: 'Código QR inválido o matrizador inactivo'
        });
      }
      
      // Generar token JWT para sesión
      const token = jwt.sign(
        { 
          id: matrizador.id,
          email: matrizador.email,
          nombre: matrizador.nombre,
          rol: matrizador.rol
        },
        process.env.JWT_SECRET || 'clave_secreta_notaria_2024',
        { expiresIn: process.env.JWT_EXPIRATION || '24h' }
      );
      
      // Actualizar fecha de último acceso
      await matrizador.update({ ultimoAcceso: new Date() });
      
      return res.status(200).json({
        exito: true,
        datos: {
          token,
          matrizador: {
            id: matrizador.id,
            nombre: matrizador.nombre,
            email: matrizador.email,
            rol: matrizador.rol
          }
        },
        mensaje: 'Código QR verificado correctamente'
      });
    } catch (error) {
      console.error('Error al verificar QR:', error);
      return res.status(500).json({
        exito: false,
        mensaje: 'Error al verificar el código QR',
        error: error.message
      });
    }
  },
  
  /**
   * Inicia sesión de un matrizador con email y contraseña
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  login: async (req, res) => {
    try {
      const { email, password } = req.body;
      
      // Validar que se hayan proporcionado credenciales
      if (!email || !password) {
        if (req.path.startsWith('/api/')) {
          return res.status(400).json({
            exito: false,
            mensaje: 'Se requiere email y contraseña'
          });
        }
        
        req.flash('error', 'Se requiere email y contraseña');
        return res.redirect('/login');
      }
      
      // Buscar el matrizador por email
      const matrizador = await Matrizador.findOne({
        where: { email, activo: true }
      });
      
      if (!matrizador) {
        if (req.path.startsWith('/api/')) {
          return res.status(401).json({
            exito: false,
            mensaje: 'Credenciales inválidas o usuario inactivo'
          });
        }
        
        req.flash('error', 'Credenciales inválidas o usuario inactivo');
        return res.redirect('/login');
      }
      
      // Verificar la contraseña
      const passwordValido = await bcrypt.compare(password, matrizador.password);
      
      if (!passwordValido) {
        if (req.path.startsWith('/api/')) {
          return res.status(401).json({
            exito: false,
            mensaje: 'Credenciales inválidas'
          });
        }
        
        req.flash('error', 'Credenciales inválidas');
        return res.redirect('/login');
      }
      
      // Generar token JWT para sesión
      const token = jwt.sign(
        { 
          id: matrizador.id,
          email: matrizador.email,
          nombre: matrizador.nombre,
          rol: matrizador.rol  // Incluir el rol en el token
        },
        process.env.JWT_SECRET || 'clave_secreta_notaria_2024',
        { expiresIn: process.env.JWT_EXPIRATION || '24h' }
      );
      
      // Actualizar fecha de último acceso
      await matrizador.update({ ultimoAcceso: new Date() });
      
      // Si es una vista, establecer cookies y redirigir
      if (!req.path.startsWith('/api/')) {
        // Establecer cookie con el token
        res.cookie('token', token, { 
          httpOnly: true, 
          secure: process.env.NODE_ENV === 'production',
          maxAge: 24 * 60 * 60 * 1000 // 24 horas
        });
        // Obtener datos del matrizador para redirigir según rol
        req.matrizador = {
          id: matrizador.id,
          nombre: matrizador.nombre,
          email: matrizador.email,
          cargo: matrizador.cargo,
          rol: matrizador.rol
        };
        return redirigirSegunRol(req, res);
      }
      
      // Si es una API, devolver el token
      return res.status(200).json({
        exito: true,
        datos: {
          token,
          matrizador: {
            id: matrizador.id,
            nombre: matrizador.nombre,
            email: matrizador.email,
            rol: matrizador.rol
          }
        },
        mensaje: 'Inicio de sesión exitoso'
      });
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      
      if (req.path.startsWith('/api/')) {
        return res.status(500).json({
          exito: false,
          mensaje: 'Error al iniciar sesión',
          error: error.message
        });
      }
      
      req.flash('error', `Error al iniciar sesión: ${error.message}`);
      return res.redirect('/login');
    }
  },
  
  /**
   * Cierra la sesión del matrizador
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  logout: (req, res) => {
    // Eliminar la cookie del token
    res.clearCookie('token');
    
    // Redirigir a la página de inicio
    return res.redirect('/login');
  },
  
  /**
   * Renderiza la página de administración de matrizadores
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  adminMatrizadores: async (req, res) => {
    try {
      const matrizadores = await Matrizador.findAll();
      
      return res.render('admin/matrizadores', {
        layout: 'admin',
        title: 'Gestión de Matrizadores',
        activeMatrizadores: true,
        matrizadores
      });
    } catch (error) {
      console.error('Error al cargar la página de administración:', error);
      return res.render('error', {
        layout: 'admin',
        title: 'Error',
        message: 'Error al cargar la página de administración de matrizadores'
      });
    }
  },

  /**
   * Muestra el dashboard del matrizador con estadísticas y documentos relevantes
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  dashboard: async (req, res) => {
    console.log("Accediendo al dashboard de matrizador");
    console.log("Usuario:", req.matrizador?.nombre, "Rol:", req.matrizador?.rol);
    console.log("Ruta solicitada:", req.originalUrl);
    
    try {
      // Procesar parámetros de período
      const tipoPeriodo = req.query.tipoPeriodo || 'mes';
      let fechaInicio, fechaFin;
      const hoy = moment().startOf('day');
      
      // Establecer fechas según el período seleccionado
      switch (tipoPeriodo) {
        case 'hoy':
          fechaInicio = hoy.clone();
          fechaFin = moment().endOf('day');
          break;
        case 'semana':
          fechaInicio = hoy.clone().startOf('week');
          fechaFin = moment().endOf('day');
          break;
        case 'mes':
          fechaInicio = hoy.clone().startOf('month');
          fechaFin = moment().endOf('day');
          break;
        case 'ultimo_mes':
          fechaInicio = hoy.clone().subtract(30, 'days');
          fechaFin = moment().endOf('day');
          break;
        case 'personalizado':
          fechaInicio = req.query.fechaInicio ? moment(req.query.fechaInicio) : hoy.clone().startOf('month');
          fechaFin = req.query.fechaFin ? moment(req.query.fechaFin).endOf('day') : moment().endOf('day');
          break;
        default:
          fechaInicio = hoy.clone().startOf('month');
          fechaFin = moment().endOf('day');
      }
      
      // Formatear fechas para las consultas
      const fechaInicioSQL = fechaInicio.format('YYYY-MM-DD HH:mm:ss');
      const fechaFinSQL = fechaFin.format('YYYY-MM-DD HH:mm:ss');
      
      // Consulta de documentos activos del matrizador actual
      const [documentosActivos] = await sequelize.query(`
        SELECT COUNT(*) as total 
        FROM documentos 
        WHERE id_matrizador = :idMatrizador 
        AND estado != 'cancelado'
      `, {
        replacements: { idMatrizador: req.matrizador.id },
        type: sequelize.QueryTypes.SELECT
      });
      
      // Documentos en proceso en el período seleccionado
      const [documentosEnProceso] = await sequelize.query(`
        SELECT COUNT(*) as total 
        FROM documentos 
        WHERE id_matrizador = :idMatrizador 
        AND estado = 'en_proceso'
        AND created_at BETWEEN :fechaInicio AND :fechaFin
      `, {
        replacements: { 
          idMatrizador: req.matrizador.id,
          fechaInicio: fechaInicioSQL,
          fechaFin: fechaFinSQL
        },
        type: sequelize.QueryTypes.SELECT
      });
      
      // Documentos completados en el período seleccionado
      const [documentosCompletados] = await sequelize.query(`
        SELECT COUNT(*) as total 
        FROM documentos 
        WHERE id_matrizador = :idMatrizador 
        AND estado = 'listo_para_entrega'
      `, {
        replacements: { idMatrizador: req.matrizador.id },
        type: sequelize.QueryTypes.SELECT
      });
      
      // Documentos entregados en el período seleccionado
      const [documentosEntregados] = await sequelize.query(`
        SELECT COUNT(*) as total 
        FROM documentos 
        WHERE id_matrizador = :idMatrizador 
        AND estado = 'entregado'
        AND fecha_entrega BETWEEN :fechaInicio AND :fechaFin
      `, {
        replacements: { 
          idMatrizador: req.matrizador.id,
          fechaInicio: fechaInicioSQL,
          fechaFin: fechaFinSQL
        },
        type: sequelize.QueryTypes.SELECT
      });
      
      // Tiempo promedio de procesamiento
      const [tiempoPromedio] = await sequelize.query(`
        SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/86400) as promedio
        FROM documentos
        WHERE id_matrizador = :idMatrizador
        AND estado IN ('listo_para_entrega', 'entregado')
        AND updated_at BETWEEN :fechaInicio AND :fechaFin
      `, {
        replacements: { 
          idMatrizador: req.matrizador.id,
          fechaInicio: fechaInicioSQL,
          fechaFin: fechaFinSQL
        },
        type: sequelize.QueryTypes.SELECT
      });
      
      // Eficiencia de procesamiento (% completados en menos de 7 días)
      const [eficiencia] = await sequelize.query(`
        SELECT 
          CASE 
            WHEN COUNT(*) = 0 THEN 0
            ELSE COUNT(CASE WHEN EXTRACT(EPOCH FROM (updated_at - created_at))/86400 <= 7 THEN 1 END) * 100.0 / COUNT(*)
          END as porcentaje
        FROM documentos
        WHERE id_matrizador = :idMatrizador
        AND estado IN ('listo_para_entrega', 'entregado')
        AND updated_at BETWEEN :fechaInicio AND :fechaFin
      `, {
        replacements: { 
          idMatrizador: req.matrizador.id,
          fechaInicio: fechaInicioSQL,
          fechaFin: fechaFinSQL
        },
        type: sequelize.QueryTypes.SELECT
      });
      
      // Total Facturado por el matrizador en el período
      const [totalFacturadoMatrizador] = await sequelize.query(`
        SELECT SUM(valor_factura) as total
        FROM documentos
        WHERE id_matrizador = :idMatrizador
        AND fecha_factura BETWEEN :fechaInicio AND :fechaFin
        AND valor_factura IS NOT NULL
      `, {
        replacements: {
          idMatrizador: req.matrizador.id,
          fechaInicio: fechaInicioSQL,
          fechaFin: fechaFinSQL
        },
        type: sequelize.QueryTypes.SELECT
      });
      
      // Obtener documentos con alertas (más de 7 días en proceso)
      const documentosAlerta = await Documento.findAll({
        where: {
          idMatrizador: req.matrizador.id,
          estado: 'en_proceso',
          [Op.and]: [
            sequelize.literal(`EXTRACT(EPOCH FROM (NOW() - created_at))/86400 >= 7`)
          ]
        },
        order: [['created_at', 'DESC']],
        limit: 10
      });
      
      // Procesar documentos de alerta para añadir métricas
      const alertas = documentosAlerta.map(doc => {
        const diasEnSistema = moment().diff(moment(doc.created_at), 'days');
        return {
          ...doc.toJSON(),
          diasEnSistema,
          porcentajeDemora: Math.min(diasEnSistema * 10, 100) // Escala de 0-100 para barra de progreso
        };
      });
      
      // Obtener documentos en proceso recientes
      const docsEnProceso = await Documento.findAll({
        where: {
          idMatrizador: req.matrizador.id,
          estado: 'en_proceso'
        },
        order: [['created_at', 'DESC']],
        limit: 10
      });
      
      // Añadir días en proceso a cada documento
      const documentosEnProcesoData = docsEnProceso.map(doc => {
        const diasEnProceso = moment().diff(moment(doc.created_at), 'days');
        return {
          ...doc.toJSON(),
          diasEnProceso
        };
      });
      
      // Obtener documentos listos sin retirar
      const docsListos = await Documento.findAll({
        where: {
          idMatrizador: req.matrizador.id,
          estado: 'listo_para_entrega'
        },
        order: [['created_at', 'DESC']],
        limit: 10
      });
      
      // Añadir días sin retirar a cada documento
      const documentosListos = docsListos.map(doc => {
        const fechaListo = doc.created_at; // La fecha en que se actualizó al estado 'listo_para_entrega'
        const diasSinRetirar = moment().diff(moment(fechaListo), 'days');
        return {
          ...doc.toJSON(),
          fechaListo,
          diasSinRetirar
        };
      });
      
      // Datos para gráficos de productividad
      const datosProductividad = await sequelize.query(`
        SELECT 
          TO_CHAR(created_at, 'YYYY-MM-DD') as fecha,
          COUNT(*) as total
        FROM documentos
        WHERE id_matrizador = :idMatrizador
        AND created_at BETWEEN :fechaInicio AND :fechaFin
        AND (
          (estado = 'listo_para_entrega') OR
          (estado = 'entregado' AND created_at BETWEEN :fechaInicio AND :fechaFin)
        )
        GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
        ORDER BY fecha
      `, {
        replacements: { 
          idMatrizador: req.matrizador.id,
          fechaInicio: fechaInicioSQL,
          fechaFin: fechaFinSQL
        },
        type: sequelize.QueryTypes.SELECT
      });
      
      // Datos para gráficos de tiempo promedio por tipo de documento
      const datosTiempos = await sequelize.query(`
        SELECT 
          tipo_documento,
          AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/86400) as promedio
        FROM documentos
        WHERE id_matrizador = :idMatrizador
        AND estado IN ('listo_para_entrega', 'entregado')
        GROUP BY tipo_documento
        ORDER BY promedio DESC
      `, {
        replacements: { idMatrizador: req.matrizador.id },
        type: sequelize.QueryTypes.SELECT
      });
      
      // Datos para gráficos por tipo de documento
      const datosTipos = await sequelize.query(`
        SELECT 
          tipo_documento,
          COUNT(*) as total
        FROM documentos
        WHERE id_matrizador = :idMatrizador
        AND created_at BETWEEN :fechaInicio AND :fechaFin
        GROUP BY tipo_documento
        ORDER BY total DESC
      `, {
        replacements: { 
          idMatrizador: req.matrizador.id,
          fechaInicio: fechaInicioSQL,
          fechaFin: fechaFinSQL
        },
        type: sequelize.QueryTypes.SELECT
      });

      // Preparar datos para los gráficos
      const datosGraficos = {
        productividad: {
          labels: datosProductividad.map(d => d.fecha),
          datos: datosProductividad.map(d => d.total)
        },
        tiempos: {
          labels: datosTiempos.map(d => d.tipo_documento),
          datos: datosTiempos.map(d => {
            const promedio = d.promedio ? parseFloat(d.promedio) : 0;
            return promedio.toFixed(1);
          })
        },
        tipos: {
          labels: datosTipos.map(d => d.tipo_documento),
          datos: datosTipos.map(d => d.total)
        }
      };
      
      // Preparar datos de período para la plantilla
      const periodoData = {
        esHoy: tipoPeriodo === 'hoy',
        esSemana: tipoPeriodo === 'semana',
        esMes: tipoPeriodo === 'mes',
        esUltimoMes: tipoPeriodo === 'ultimo_mes',
        esPersonalizado: tipoPeriodo === 'personalizado',
        fechaInicio: fechaInicio.format('YYYY-MM-DD'),
        fechaFin: fechaFin.format('YYYY-MM-DD')
      };
      
      // Preparar estadísticas para la plantilla
      const stats = {
        activos: documentosActivos.total || 0,
        enProceso: documentosEnProceso.total || 0,
        completados: documentosCompletados.total || 0,
        entregados: documentosEntregados.total || 0,
        totalFacturado: totalFacturadoMatrizador.total || 0,
        tiempoPromedio: tiempoPromedio.promedio ? parseFloat(tiempoPromedio.promedio).toFixed(1) : "0.0",
        eficiencia: eficiencia.porcentaje ? parseFloat(eficiencia.porcentaje).toFixed(1) : "0.0",
        alertas
      };
      
      // Renderizar el dashboard con los datos obtenidos
      res.render('matrizadores/dashboard', {
        layout: 'matrizador',
        title: 'Panel de Matrizador',
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre,
        stats,
        periodo: periodoData,
        documentosEnProceso: documentosEnProcesoData,
        documentosListos,
        datosGraficos
      });
    } catch (error) {
      console.error("Error al cargar el dashboard del matrizador:", error);
      res.status(500).render('error', {
        layout: 'matrizador',
        title: 'Error',
        message: 'Ha ocurrido un error al cargar el dashboard',
        error
      });
    }
  },
  
  listarDocumentos: async (req, res) => {
    console.log("Accediendo al listado de documentos de matrizador");
    console.log("Usuario:", req.matrizador?.nombre, "Rol:", req.matrizador?.rol, "ID:", req.matrizador?.id);
    console.log("Ruta solicitada:", req.originalUrl);
    
    try {
      // Parámetros de paginación
      const page = parseInt(req.query.page) || 1;
      const limit = 10;
      const offset = (page - 1) * limit;
      
      // Parámetros de filtrado
      const estado = req.query.estado || '';
      const tipoDocumento = req.query.tipoDocumento || '';
      const busqueda = req.query.busqueda || '';
      
      // Construir condiciones de filtrado
      const where = {
        // Importante: Filtrar por el ID del matrizador actual
        idMatrizador: req.matrizador.id
      };
      
      if (estado) {
        where.estado = estado;
      }
      
      if (tipoDocumento) {
        where.tipo_documento = tipoDocumento;
      }
      
      if (busqueda) {
        where[Op.or] = [
          { codigo_barras: { [Op.iLike]: `%${busqueda}%` } },
          { nombre_cliente: { [Op.iLike]: `%${busqueda}%` } }
        ];
      }
      
      console.log("Buscando documentos con filtros:", where);
      
      // Obtener documentos con paginación
      const { count, rows: documentos } = await Documento.findAndCountAll({
        where,
        order: [['created_at', 'DESC']],
        limit,
        offset
      });
      
      console.log("Documentos encontrados para matrizador:", documentos ? documentos.length : 'ninguno');
      if (documentos && documentos.length > 0) {
        console.log("Primer documento:", documentos[0].dataValues);
      }
      
      // Preparar datos para la paginación
      const totalPages = Math.ceil(count / limit);
      const pagination = {
        pages: []
      };
      
      // Generar URLs para la paginación
      const baseUrl = '/matrizador/documentos?';
      const queryParams = new URLSearchParams();
      
      if (estado) queryParams.append('estado', estado);
      if (tipoDocumento) queryParams.append('tipoDocumento', tipoDocumento);
      if (busqueda) queryParams.append('busqueda', busqueda);
      
      // Generar enlaces de paginación
      for (let i = 1; i <= totalPages; i++) {
        const params = new URLSearchParams(queryParams);
        params.set('page', i);
        
        pagination.pages.push({
          num: i,
          url: baseUrl + params.toString(),
          active: i === page
        });
      }
      
      // Enlaces de anterior y siguiente
      if (page > 1) {
        const params = new URLSearchParams(queryParams);
        params.set('page', page - 1);
        pagination.prev = baseUrl + params.toString();
      }
      
      if (page < totalPages) {
        const params = new URLSearchParams(queryParams);
        params.set('page', page + 1);
        pagination.next = baseUrl + params.toString();
      }
      
      // Obtener tipos de documento para filtros
      const tiposDocumentoQuery = await Documento.findAll({
        attributes: [[sequelize.fn('DISTINCT', sequelize.col('tipo_documento')), 'tipo']],
        raw: true
      });
      
      const tiposDocumento = tiposDocumentoQuery.map(t => t.tipo).filter(Boolean);
      
      res.render('matrizadores/documentos/listado', {
        layout: 'matrizador',
        title: 'Mis Documentos',
        documentos,
        pagination,
        tiposDocumento,
        filtros: {
          estado: {
            [estado]: true
          },
          tipoDocumento,
          busqueda
        },
        usuario: req.matrizador
      });
    } catch (error) {
      console.error('Error al listar documentos del matrizador:', error);
      res.status(500).render('error', {
        layout: 'matrizador',
        title: 'Error',
        message: 'Ha ocurrido un error al cargar el listado de documentos',
        error
      });
    }
  },
  
  detalleDocumento: async (req, res) => {
    console.log("Accediendo al detalle de documento de matrizador");
    console.log("Usuario:", req.matrizador?.nombre, "Rol:", req.matrizador?.rol);
    console.log("Ruta solicitada:", req.originalUrl);
    
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).render('error', {
          layout: 'matrizador',
          title: 'Error',
          message: 'ID de documento no proporcionado'
        });
      }
      
      // Buscar el documento y verificar que pertenezca al matrizador actual
      const documento = await Documento.findOne({
        where: {
          id,
          idMatrizador: req.matrizador.id
        }
      });
      
      if (!documento) {
        return res.render('matrizadores/documentos/detalle', {
          layout: 'matrizador',
          title: 'Detalle de Documento',
          documento: null,
          error: 'El documento solicitado no existe o no tienes permisos para verlo',
          userRole: req.matrizador?.rol,
          userName: req.matrizador?.nombre
        });
      }
      
      console.log("Documento encontrado:", documento.id, documento.codigoBarras);
      
      // Si el documento tiene historial, obtenerlo
      let historial = [];
      if (documento.historial) {
        historial = documento.historial;
      }
      
      res.render('matrizadores/documentos/detalle', {
        layout: 'matrizador',
        title: 'Detalle de Documento',
        documento,
        historial,
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre
      });
    } catch (error) {
      console.error('Error al obtener detalle de documento:', error);
      res.status(500).render('error', {
        layout: 'matrizador',
        title: 'Error',
        message: 'Ha ocurrido un error al cargar el detalle del documento',
        error
      });
    }
  },
  mostrarFormularioRegistro: (req, res) => {
    console.log("Accediendo al formulario de registro de matrizador");
    console.log("Usuario:", req.matrizador?.nombre, "Rol:", req.matrizador?.rol);
    console.log("Ruta solicitada:", req.originalUrl);
    res.render('matrizadores/documentos/registro', { 
      layout: 'matrizador', 
      title: 'Registrar Documento', 
      userRole: req.matrizador?.rol, 
      userName: req.matrizador?.nombre,
      usuario: req.matrizador // Pasar el usuario completo para el campo id_matrizador
    });
  },
  registrarDocumento: async (req, res) => {
    console.log("Registrando documento como matrizador");
    console.log("Usuario:", req.matrizador?.nombre, "Rol:", req.matrizador?.rol);
    console.log("Datos recibidos:", req.body);
    
    const transaction = await sequelize.transaction();
    
    try {
      // Extraer los datos del formulario
      const {
        codigoBarras,
        tipoDocumento,
        nombreCliente,
        identificacionCliente,
        emailCliente,
        telefonoCliente,
        idMatrizador,
        notas,
        // Nuevos campos de facturación y pago
        numeroFactura,
        valorFactura,
        fechaFactura,
        estadoPago,
        metodoPago,
        // Campos de omisión de notificaciones
        omitirNotificacion,
        motivoOmision,
        detalleOmision,
        comparecientesJSON
      } = req.body;
      
      // Verificar campos obligatorios
      if (!codigoBarras || !tipoDocumento || !nombreCliente || !identificacionCliente) {
        await transaction.rollback();
        req.flash('error', 'Faltan campos obligatorios');
        return res.render('matrizadores/documentos/registro', {
          layout: 'matrizador',
          title: 'Registrar Documento',
          userRole: req.matrizador?.rol,
          userName: req.matrizador?.nombre,
          usuario: req.matrizador,
          formData: req.body // Mantener los datos ingresados
        });
      }
      
      // Verificar si ya existe un documento con ese código de barras
      const documentoExistente = await Documento.findOne({
        where: { codigoBarras },
        transaction
      });
      
      if (documentoExistente) {
        await transaction.rollback();
        req.flash('error', 'Ya existe un documento con ese código de barras');
        return res.render('matrizadores/documentos/registro', {
          layout: 'matrizador',
          title: 'Registrar Documento',
          userRole: req.matrizador?.rol,
          userName: req.matrizador?.nombre,
          usuario: req.matrizador,
          formData: req.body
        });
      }
      
      // Procesar comparecientes
      let comparecientesJson = [];
      try {
        if (comparecientesJSON) {
          comparecientesJson = JSON.parse(comparecientesJSON);
        }
      } catch (e) {
        console.error('Error al procesar comparecientes:', e);
        comparecientesJson = [];
      }
      
      // ============== CORRECCIÓN: GENERACIÓN CONDICIONAL DE CÓDIGO DE VERIFICACIÓN ==============
      
      // Verificar si debe generar código de verificación
      const debeNotificar = !documento.omitirNotificacion && 
                           documento.emailCliente && 
                           documento.telefonoCliente;
      
      const esEntregaInmediata = documento.entregadoInmediatamente || false;
      
      let codigoVerificacion = null;
      let mensajeNotificacion = '';
      
      if (debeNotificar && !esEntregaInmediata) {
        // Solo generar código si se va a notificar Y no es entrega inmediata
        codigoVerificacion = Math.floor(1000 + Math.random() * 9000).toString();
        mensajeNotificacion = 'Se enviará código de verificación al cliente';
        console.log(`✅ Generando código de verificación: ${codigoVerificacion} para documento ${documento.codigoBarras}`);
      } else {
        // No generar código en estos casos:
        // - Omitir notificación activado
        // - Sin datos de contacto del cliente
        // - Entrega inmediata
        codigoVerificacion = null;
        
        if (documento.omitirNotificacion) {
          mensajeNotificacion = 'Sin código - notificación omitida por configuración';
          console.log(`⏭️ No se generará código para documento ${documento.codigoBarras}: notificación omitida`);
        } else if (esEntregaInmediata) {
          mensajeNotificacion = 'Sin código - entrega inmediata configurada';
          console.log(`⚡ No se generará código para documento ${documento.codigoBarras}: entrega inmediata`);
        } else {
          mensajeNotificacion = 'Sin código - faltan datos de contacto del cliente';
          console.log(`⚠️ No se generará código para documento ${documento.codigoBarras}: sin datos de contacto`);
        }
      }
      
      // Actualizar estado y código de verificación del documento principal
      documento.estado = 'listo_para_entrega';
      documento.codigoVerificacion = codigoVerificacion; // Puede ser null
      await documento.save({ transaction });
      
      // Registrar el evento de creación
      try {
        await EventoDocumento.create({
          idDocumento: documento.id,
          tipo: 'registro',
          detalles: 'Documento registrado por matrizador',
          usuario: req.matrizador.nombre
        }, { transaction });
      } catch (eventError) {
        console.error('Error al registrar evento de documento:', eventError);
        // Continuar con la transacción aunque el registro de eventos falle
      }
      
      await transaction.commit();
      
      req.flash('success', 'Documento registrado exitosamente');
      res.redirect('/matrizador/documentos');
    } catch (error) {
      await transaction.rollback();
      console.error('Error al registrar documento:', error);

      let errorMessage = error.message;
      let errorCodeDuplicado = false;

      if (error.name === 'SequelizeUniqueConstraintError') {
        const esErrorCodigoBarras = error.errors && error.errors.some(e => e.path === 'codigo_barras' || e.path === 'codigoBarras');
        if (esErrorCodigoBarras) {
          errorMessage = `El código de barras '${req.body.codigoBarras}' ya existe. Por favor, ingrese uno diferente.`;
          errorCodeDuplicado = true;
        } else {
          errorMessage = 'Ya existe un registro con uno de los valores únicos ingresados.';
        }
      } else if (error.message.includes('El código de barras debe comenzar con el prefijo')) {
        // Este error ya se maneja con req.flash y render, pero podemos asegurar que no se active el modal si no es duplicado
        // No es necesario cambiar errorMessage aquí si req.flash ya lo maneja, a menos que queramos unificar
      }

      // Si no es un error de código duplicado que queramos manejar con modal, 
      // dejamos que la lógica de req.flash y render existente continúe.
      // Solo si errorCodeDuplicado es true, la vista mostrará el modal.
      if (!errorCodeDuplicado) {
        req.flash('error', errorMessage); // Usar el errorMessage genérico o el específico si no es duplicado
      }

      res.render('matrizadores/documentos/registro', {
        layout: 'matrizador',
        title: 'Registrar Documento',
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre,
        usuario: req.matrizador,
        formData: req.body,
        error: errorCodeDuplicado ? null : errorMessage, // Solo mostrar error general si no hay modal
        errorCodeDuplicado: errorCodeDuplicado,
        modalErrorMessage: errorCodeDuplicado ? errorMessage : null // Mensaje específico para el modal
      });
    }
  },
  mostrarEntrega: async (req, res) => {
    console.log("Accediendo a la entrega de documento de matrizador");
    console.log("Usuario:", req.matrizador?.nombre, "Rol:", req.matrizador?.rol);
    console.log("Ruta solicitada:", req.originalUrl);
    
    try {
      const documentoId = req.params.id;
      const codigo = req.query.codigo;
      
      // Si hay un ID, mostrar formulario de entrega para ese documento
      if (documentoId) {
        const documento = await Documento.findOne({
          where: {
            id: documentoId,
            idMatrizador: req.matrizador.id,
            estado: 'listo_para_entrega'
          }
        });
        
        if (!documento) {
          req.flash('error', 'El documento no existe, no está listo para entrega o no tienes permisos para verlo');
          return res.redirect('/matrizador/documentos/entrega');
        }
        
        return res.render('matrizadores/documentos/entrega', {
          layout: 'matrizador',
          title: 'Entrega de Documento',
          documento,
          userRole: req.matrizador?.rol,
          userName: req.matrizador?.nombre
        });
      }
      
      // Si hay un código de barras, buscar por código
      if (codigo) {
        const documento = await Documento.findOne({
          where: {
            codigo_barras: codigo,
            idMatrizador: req.matrizador.id,
            estado: 'listo_para_entrega'
          }
        });
        
        if (documento) {
          return res.redirect(`/matrizador/documentos/entrega/${documento.id}`);
        }
        
        req.flash('error', 'No se encontró un documento listo para entrega con ese código');
      }
      
      // Obtener documentos listos para entrega de este matrizador
      const documentosListos = await Documento.findAll({
        where: {
          idMatrizador: req.matrizador.id,
          estado: 'listo_para_entrega'
        },
        order: [['created_at', 'DESC']],
        limit: 10
      });
      
      console.log(`Documentos listos para entrega: ${documentosListos.length}`);
      
      return res.render('matrizadores/documentos/entrega', {
        layout: 'matrizador',
        title: 'Entrega de Documentos',
        documentosListos,
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre
      });
    } catch (error) {
      console.error('Error al mostrar la página de entrega:', error);
      res.status(500).render('error', {
        layout: 'matrizador',
        title: 'Error',
        message: 'Ha ocurrido un error al cargar la página de entrega de documentos',
        error
      });
    }
  },
  completarEntrega: async (req, res) => {
    console.log("Completando entrega de documento como matrizador");
    console.log("Usuario:", req.matrizador?.nombre, "Rol:", req.matrizador?.rol);
    console.log("Ruta solicitada:", req.originalUrl);
    console.log("Datos recibidos:", req.body);
    
    const transaction = await sequelize.transaction();
    
    try {
      const { id } = req.params;
      const { codigoVerificacion, nombreReceptor, identificacionReceptor, relacionReceptor, tipoVerificacion, observaciones } = req.body;
      
      if (!id) {
        await transaction.rollback();
        req.flash('error', 'ID de documento no proporcionado');
        return res.redirect('/matrizador/documentos/entrega');
      }
      
      // Buscar el documento y verificar que pertenezca al matrizador actual
      const documento = await Documento.findOne({
        where: {
          id,
          idMatrizador: req.matrizador.id,
          estado: 'listo_para_entrega'
        },
        transaction
      });
      
      if (!documento) {
        await transaction.rollback();
        req.flash('error', 'El documento no existe, no está listo para entrega o no tienes permisos para modificarlo');
        return res.redirect('/matrizador/documentos/entrega');
      }
      
      // Verificar código a menos que sea verificación por llamada
      if (tipoVerificacion !== 'llamada' && documento.codigoVerificacion !== codigoVerificacion) {
        await transaction.rollback();
        return res.render('matrizadores/documentos/entrega', {
          layout: 'matrizador',
          title: 'Entrega de Documento',
          documento,
          error: 'El código de verificación es incorrecto, por favor verifique e intente nuevamente',
          userRole: req.matrizador?.rol,
          userName: req.matrizador?.nombre
        });
      }
      
      // Actualizar el documento
      documento.estado = 'entregado';
      documento.fechaEntrega = new Date();
      documento.nombreReceptor = nombreReceptor;
      documento.identificacionReceptor = identificacionReceptor;
      documento.relacionReceptor = relacionReceptor;
      
      await documento.save({ transaction });
      
      // Registrar el evento de entrega
      try {
        const detalles = tipoVerificacion === 'llamada'
          ? `Entregado a ${nombreReceptor} con verificación por llamada: ${observaciones}`
          : `Entregado a ${nombreReceptor} con código de verificación`;
          
        await EventoDocumento.create({
          idDocumento: documento.id,
          tipo: 'entrega',
          detalles,
          usuario: req.matrizador.nombre
        }, { transaction });
      } catch (eventError) {
        console.error('Error al registrar evento de entrega:', eventError);
        // Continuar con la transacción aunque el registro de eventos falle
      }
      
      await transaction.commit();
      
      // Enviar confirmación de entrega después de confirmar la transacción
      try {
        // Construir mensajes profesionales para confirmación de entrega
        const mensajes = construirMensajeDocumentoEntregado(documento, {
          nombreReceptor,
          identificacionReceptor,
          relacionReceptor,
          usuarioEntrega: req.matrizador.nombre
        });
        
        // Registrar evento de notificación de entrega en el historial
        await EventoDocumento.create({
          idDocumento: documento.id,
          tipo: mensajes.tipo,
          detalles: `Confirmación de entrega enviada - Entregado a: ${nombreReceptor}`,
          usuario: req.matrizador.nombre,
          metadatos: {
            nombreReceptor: nombreReceptor,
            identificacionReceptor: identificacionReceptor,
            relacionReceptor: relacionReceptor,
            metodoNotificacion: documento.metodoNotificacion || 'ambos',
            canal: documento.metodoNotificacion || 'ambos',
            estado: 'enviado',
            tipoVerificacion: tipoVerificacion
          }
        });
        
        console.log(`📧 Confirmación de entrega enviada para documento ${documento.codigoBarras} a ${nombreReceptor}`);
      } catch (notificationError) {
        console.error('Error al enviar confirmación de entrega:', notificationError);
        // No afectar el flujo principal si falla la notificación
      }
      
      // Mensaje de éxito personalizado según la configuración del documento
      let mensajeExito = '';
      
      if (codigoVerificacion) {
        mensajeExito = `El documento ha sido marcado como listo para entrega y se ha enviado el código de verificación al cliente.`;
      } else {
        if (documento.omitirNotificacion) {
          mensajeExito = `El documento ha sido marcado como listo para entrega. No se envió notificación según la configuración del documento.`;
        } else if (esEntregaInmediata) {
          mensajeExito = `El documento ha sido marcado como listo para entrega inmediata. No se requiere código de verificación.`;
        } else {
          mensajeExito = `El documento ha sido marcado como listo para entrega. No se pudo enviar notificación por falta de datos de contacto.`;
        }
      }
      
      req.flash('success', mensajeExito);
      res.redirect('/matrizador/documentos');
    } catch (error) {
      await transaction.rollback();
      console.error('Error al marcar documento como listo:', error);
      req.flash('error', `Error al marcar el documento como listo: ${error.message}`);
      res.redirect('/matrizador/documentos');
    }
  },

  /**
   * Marcar un documento como visto por el matrizador
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  marcarDocumentoVisto: async (req, res) => {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          exito: false,
          mensaje: 'ID de documento no proporcionado'
        });
      }
      
      // Buscar el documento
      const documento = await Documento.findByPk(id);
      
      if (!documento) {
        return res.status(404).json({
          exito: false,
          mensaje: `No se encontró documento con ID ${id}`
        });
      }
      
      // Actualizar el campo visto_por_matrizador
      await documento.update({ visto_por_matrizador: true });
      
      // Registrar evento
      await EventoDocumento.create({
        documentoId: id,
        tipo: 'vista',
        detalles: 'Documento visto por matrizador',
        usuario: req.matrizador.nombre
      });
      
      return res.status(200).json({
        exito: true,
        mensaje: 'Documento marcado como visto correctamente'
      });
    } catch (error) {
      console.error('Error al marcar documento como visto:', error);
      return res.status(500).json({
        exito: false,
        mensaje: 'Error al marcar el documento como visto',
        error: error.message
      });
    }
  },

  /**
   * Mostrar página de búsqueda de documentos para matrizadores
   */
  mostrarBuscarDocumentos: async (req, res) => {
    try {
      res.render('matrizadores/documentos/buscar', {
        layout: 'matrizador',
        title: 'Buscar Documentos',
        activeBuscar: true,
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre
      });
    } catch (error) {
      console.error('Error al mostrar página de búsqueda:', error);
      req.flash('error', 'Error al cargar la página de búsqueda');
      res.redirect('/matrizador');
    }
  },

  /**
   * Buscar documentos principales para vincular como habilitantes
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  buscarDocumentosPrincipales: async (req, res) => {
    try {
      const { clienteId, excludeId } = req.query;
      
      if (!clienteId) {
        return res.status(400).json({
          exito: false,
          mensaje: 'ID de cliente no proporcionado'
        });
      }
      
      // Construir condiciones de búsqueda
      const whereClause = {
        identificacionCliente: clienteId,
        estado: ['listo_para_entrega', 'en_proceso'],
        idMatrizador: req.matrizador.id // Solo documentos del mismo matrizador
      };
      
      // Excluir el documento actual si se proporciona
      if (excludeId) {
        whereClause.id = { [Op.ne]: excludeId };
      }
      
      const documentos = await Documento.findAll({
        where: whereClause,
        attributes: ['id', 'codigoBarras', 'tipoDocumento', 'nombreCliente'],
        order: [['created_at', 'DESC']],
        limit: 20
      });
      
      return res.status(200).json({
        exito: true,
        datos: documentos,
        mensaje: `Se encontraron ${documentos.length} documentos principales disponibles`
      });
    } catch (error) {
      console.error('Error al buscar documentos principales:', error);
      return res.status(500).json({
        exito: false,
        mensaje: 'Error interno del servidor',
        error: error.message
      });
    }
  },
  
  /**
   * Muestra el historial de notificaciones con filtros mejorados
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  historialNotificaciones: async (req, res) => {
    try {
      const { fechaDesde, fechaHasta, tipo, canal, busqueda } = req.query;
      
      let whereClause = {};
      let documentoWhereClause = {
        idMatrizador: req.matrizador.id
      };
      
      // Filtros de fecha
      if (fechaDesde || fechaHasta) {
        whereClause.createdAt = {};
        if (fechaDesde) {
          whereClause.createdAt[Op.gte] = new Date(fechaDesde + 'T00:00:00');
        }
        if (fechaHasta) {
          whereClause.createdAt[Op.lte] = new Date(fechaHasta + 'T23:59:59');
        }
      }
      
      // Filtros de tipo y canal
      if (tipo) whereClause.tipo = tipo;
      if (canal && canal !== '') {
        // Buscar en metadatos.canal
        whereClause['metadatos.canal'] = canal;
      }
      
      // ============== NUEVO: BÚSQUEDA POR TEXTO ==============
      if (busqueda && busqueda.trim() !== '') {
        const textoBusqueda = busqueda.trim();
        documentoWhereClause[Op.or] = [
          // Buscar por código de barras
          { codigoBarras: { [Op.iLike]: `%${textoBusqueda}%` } },
          // Buscar por nombre del cliente
          { nombreCliente: { [Op.iLike]: `%${textoBusqueda}%` } },
          // Buscar por número de factura
          { numeroFactura: { [Op.iLike]: `%${textoBusqueda}%` } },
          // Buscar por identificación del cliente
          { identificacionCliente: { [Op.iLike]: `%${textoBusqueda}%` } }
        ];
      }
      
      // Solo mostrar notificaciones de documentos del matrizador actual
      const notificaciones = await EventoDocumento.findAll({
        where: {
          tipo: {
            [Op.in]: ['documento_listo', 'documento_entregado']
          },
          ...whereClause
        },
        include: [{
          model: Documento,
          as: 'documento',
          attributes: ['codigoBarras', 'tipoDocumento', 'nombreCliente', 'numeroFactura', 'identificacionCliente'],
          where: documentoWhereClause,
          required: true
        }],
        order: [['createdAt', 'DESC']], // Más recientes primero
        limit: 50 // Limitar para performance
      });
      
      // ============== CALCULAR ESTADÍSTICAS ==============
      const stats = {
        total: notificaciones.length,
        enviadas: notificaciones.filter(n => n.metadatos?.estado === 'enviado').length,
        fallidas: notificaciones.filter(n => n.metadatos?.estado === 'error').length,
        pendientes: notificaciones.filter(n => n.metadatos?.estado === 'pendiente').length
      };
      
      res.render('matrizadores/notificaciones/historial', {
        layout: 'matrizador',
        title: 'Historial de Notificaciones',
        notificaciones,
        stats,
        filtros: { fechaDesde, fechaHasta, tipo, canal, busqueda },
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre
      });
      
    } catch (error) {
      console.error('Error en historial notificaciones:', error);
      res.status(500).render('error', { 
        layout: 'matrizador',
        title: 'Error',
        message: 'Error al cargar historial de notificaciones' 
      });
    }
  },

  /**
   * Obtiene los detalles de una notificación específica (API)
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  obtenerDetalleNotificacion: async (req, res) => {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          exito: false,
          mensaje: 'ID de notificación no proporcionado'
        });
      }
      
      // Buscar el evento de notificación
      const evento = await EventoDocumento.findOne({
        where: {
          id: id,
          tipo: {
            [Op.in]: ['documento_listo', 'documento_entregado']
          }
        },
        include: [{
          model: Documento,
          as: 'documento',
          attributes: ['codigoBarras', 'tipoDocumento', 'nombreCliente', 'emailCliente', 'telefonoCliente', 'notas'],
          where: {
            idMatrizador: req.matrizador.id
          },
          required: true
        }]
      });
      
      if (!evento) {
        return res.status(404).json({
          exito: false,
          mensaje: 'Notificación no encontrada o no tienes permisos para verla'
        });
      }
      
      // ============== RECONSTRUIR MENSAJE ENVIADO ==============
      let mensajeEnviado = '';
      
      if (evento.tipo === 'documento_listo') {
        // Reconstruir mensaje de documento listo
        const codigoVerificacion = evento.metadatos?.codigoVerificacion || 'N/A';
        let contextoTramite = '';
        if (evento.documento.notas && 
            typeof evento.documento.notas === 'string' && 
            evento.documento.notas.trim().length > 0) {
          contextoTramite = ` - ${evento.documento.notas.trim()}`;
        }
        
        mensajeEnviado = `🏛️ *NOTARÍA 18*

¡Su documento está listo para retirar!

📄 *Trámite:* ${evento.documento.tipoDocumento}${contextoTramite}
📋 *Documento:* ${evento.documento.codigoBarras}
🔢 *Código de verificación:* ${codigoVerificacion}
👤 *Cliente:* ${evento.documento.nombreCliente}

📍 Retírelo en: Notaría Décima Octava
🕒 Horario: Lunes a Viernes 8:00-17:00

⚠️ *IMPORTANTE:* Presente el código de verificación y su cédula para el retiro.`;
        
      } else if (evento.tipo === 'documento_entregado') {
        // Reconstruir mensaje de documento entregado
        const fechaEntrega = new Date(evento.createdAt).toLocaleDateString('es-EC', {
          day: '2-digit', month: '2-digit', year: 'numeric'
        });
        
        const horaEntrega = new Date(evento.createdAt).toLocaleTimeString('es-EC', {
          hour: '2-digit', minute: '2-digit', hour12: false
        });
        
        let contextoTramite = '';
        if (evento.documento.notas && 
            typeof evento.documento.notas === 'string' && 
            evento.documento.notas.trim().length > 0) {
          contextoTramite = ` - ${evento.documento.notas.trim()}`;
        }
        
        const nombreReceptor = evento.metadatos?.nombreReceptor || 'Receptor no especificado';
        const identificacionReceptor = evento.metadatos?.identificacionReceptor || 'N/A';
        const relacionReceptor = evento.metadatos?.relacionReceptor || 'N/A';
        
        mensajeEnviado = `🏛️ *NOTARÍA 18*

✅ *DOCUMENTO ENTREGADO EXITOSAMENTE*

📄 *Documento:* ${evento.documento.tipoDocumento}${contextoTramite}
📋 *Código:* ${evento.documento.codigoBarras}
👤 *Cliente:* ${evento.documento.nombreCliente}

📦 *DETALLES DE LA ENTREGA:*
👨‍💼 *Retirado por:* ${nombreReceptor}
🆔 *Identificación:* ${identificacionReceptor}
👥 *Relación:* ${relacionReceptor}

📅 *Fecha:* ${fechaEntrega}
🕒 *Hora:* ${horaEntrega}
📍 *Lugar:* Notaría Décima Octava, Quito

✅ *Su trámite ha sido completado exitosamente.*

_Guarde este mensaje como comprobante de entrega._`;
      }
      
      // Preparar datos detallados
      const detalles = {
        id: evento.id,
        tipo: evento.tipo,
        fecha: evento.createdAt,
        detalles: evento.detalles,
        usuario: evento.usuario,
        documento: {
          codigo: evento.documento.codigoBarras,
          tipo: evento.documento.tipoDocumento,
          cliente: evento.documento.nombreCliente
        },
        metadatos: evento.metadatos || {},
        canales: {
          email: evento.documento.emailCliente,
          telefono: evento.documento.telefonoCliente
        },
        mensajeEnviado: mensajeEnviado // ← NUEVO: Mensaje completo enviado
      };
      
      return res.status(200).json({
        exito: true,
        datos: detalles,
        mensaje: 'Detalles de notificación obtenidos correctamente'
      });
    } catch (error) {
      console.error('Error al obtener detalles de notificación:', error);
      return res.status(500).json({
        exito: false,
        mensaje: 'Error al obtener los detalles de la notificación',
        error: error.message
      });
    }
  },

  // Nueva función para marcar documentos como listos para entrega
  marcarDocumentoListo: async (req, res) => {
    console.log("Marcando documento como listo para entrega");
    console.log("Usuario:", req.matrizador?.nombre, "Rol:", req.matrizador?.rol);
    console.log("Datos recibidos:", req.body);
    
    const transaction = await sequelize.transaction();
    
    try {
      const { documentoId } = req.body;
      
      if (!documentoId) {
        await transaction.rollback();
        req.flash('error', 'ID de documento no proporcionado');
        return res.redirect('/matrizador/documentos');
      }
      
      // Buscar el documento y verificar que pertenezca al matrizador actual
      const documento = await Documento.findOne({
        where: {
          id: documentoId,
          idMatrizador: req.matrizador.id
        },
        transaction
      });
      
      if (!documento) {
        await transaction.rollback();
        req.flash('error', 'El documento no existe o no tienes permisos para modificarlo');
        return res.redirect('/matrizador/documentos');
      }
      
      // Verificar que el documento esté en estado "en_proceso"
      if (documento.estado !== 'en_proceso') {
        await transaction.rollback();
        req.flash('error', 'Solo se pueden marcar como listos los documentos en proceso');
        return res.redirect('/matrizador/documentos');
      }
      
      // ============== VALIDACIÓN: PREVENIR MARCAR HABILITANTES INDIVIDUALMENTE ==============
      
      // Si es un documento habilitante, verificar si se debe marcar junto con el principal
      if (!documento.esDocumentoPrincipal && documento.documentoPrincipalId) {
        console.log(`⚠️ Intento de marcar documento habilitante ID: ${documento.id} como listo individualmente`);
        
        // Buscar el documento principal para verificar su estado
        const documentoPrincipal = await Documento.findByPk(documento.documentoPrincipalId, { transaction });
        
        if (documentoPrincipal && documentoPrincipal.estado === 'en_proceso') {
          await transaction.rollback();
          req.flash('warning', `Este documento habilitante se marcará como listo automáticamente cuando se marque el documento principal "${documentoPrincipal.codigoBarras}" como listo. Por favor, marque el documento principal en su lugar.`);
          return res.redirect('/matrizador/documentos');
        } else if (documentoPrincipal && documentoPrincipal.estado === 'listo_para_entrega') {
          // Si el principal ya está listo, permitir marcar el habilitante individualmente
          console.log(`ℹ️ Permitiendo marcar habilitante individualmente porque el principal ya está listo`);
        } else {
          await transaction.rollback();
          req.flash('error', 'No se puede determinar el estado del documento principal. Verifique la configuración del documento.');
          return res.redirect('/matrizador/documentos');
        }
      }
      
      // ============== CORRECCIÓN: GENERACIÓN CONDICIONAL DE CÓDIGO DE VERIFICACIÓN ==============
      
      // Verificar si debe generar código de verificación
      const debeNotificar = !documento.omitirNotificacion && 
                           documento.emailCliente && 
                           documento.telefonoCliente;
      
      const esEntregaInmediata = documento.entregadoInmediatamente || false;
      
      let codigoVerificacion = null;
      let mensajeNotificacion = '';
      
      if (debeNotificar && !esEntregaInmediata) {
        // Solo generar código si se va a notificar Y no es entrega inmediata
        codigoVerificacion = Math.floor(1000 + Math.random() * 9000).toString();
        mensajeNotificacion = 'Se enviará código de verificación al cliente';
        console.log(`✅ Generando código de verificación: ${codigoVerificacion} para documento ${documento.codigoBarras}`);
      } else {
        // No generar código en estos casos:
        // - Omitir notificación activado
        // - Sin datos de contacto del cliente
        // - Entrega inmediata
        codigoVerificacion = null;
        
        if (documento.omitirNotificacion) {
          mensajeNotificacion = 'Sin código - notificación omitida por configuración';
          console.log(`⏭️ No se generará código para documento ${documento.codigoBarras}: notificación omitida`);
        } else if (esEntregaInmediata) {
          mensajeNotificacion = 'Sin código - entrega inmediata configurada';
          console.log(`⚡ No se generará código para documento ${documento.codigoBarras}: entrega inmediata`);
        } else {
          mensajeNotificacion = 'Sin código - faltan datos de contacto del cliente';
          console.log(`⚠️ No se generará código para documento ${documento.codigoBarras}: sin datos de contacto`);
        }
      }
      
      // Actualizar estado y código de verificación del documento principal
      documento.estado = 'listo_para_entrega';
      documento.codigoVerificacion = codigoVerificacion; // Puede ser null
      await documento.save({ transaction });
      
      // ============== NUEVA LÓGICA: ACTUALIZAR DOCUMENTOS HABILITANTES RELACIONADOS ==============
      
      let documentosHabilitantesActualizados = 0;
      
      // Solo buscar documentos habilitantes si este es un documento principal
      if (documento.esDocumentoPrincipal) {
        console.log(`🔍 Verificando si el documento principal ${documento.id} tiene documentos habilitantes...`);
        
        // Buscar todos los documentos habilitantes relacionados
        const documentosHabilitantes = await Documento.findAll({
          where: {
            documentoPrincipalId: documento.id,
            esDocumentoPrincipal: false,
            estado: 'en_proceso' // Solo actualizar los que están en proceso
          },
          transaction
        });
        
        if (documentosHabilitantes.length > 0) {
          console.log(`📄 Encontrados ${documentosHabilitantes.length} documentos habilitantes para actualizar`);
          
          // Actualizar todos los documentos habilitantes al mismo estado
          for (const habilitante of documentosHabilitantes) {
            // ============== APLICAR MISMA LÓGICA CONDICIONAL A HABILITANTES ==============
            
            // Verificar si el habilitante debe tener código
            const debeNotificarHabilitante = !habilitante.omitirNotificacion && 
                                           habilitante.emailCliente && 
                                           habilitante.telefonoCliente;
            
            const esEntregaInmediataHabilitante = habilitante.entregadoInmediatamente || false;
            
            let codigoHabilitante = null;
            
            if (debeNotificarHabilitante && !esEntregaInmediataHabilitante) {
              // Solo generar código si se va a notificar
              codigoHabilitante = Math.floor(1000 + Math.random() * 9000).toString();
              console.log(`✅ Generando código para habilitante: ${codigoHabilitante}`);
            } else {
              // No generar código para habilitantes con notificación omitida
              codigoHabilitante = null;
              console.log(`⏭️ Sin código para habilitante ${habilitante.codigoBarras}: notificación omitida o entrega inmediata`);
            }
            
            habilitante.estado = 'listo_para_entrega';
            habilitante.codigoVerificacion = codigoHabilitante; // Puede ser null
            await habilitante.save({ transaction });
            
            // Registrar evento para cada documento habilitante
            try {
              const detalleEvento = codigoHabilitante 
                ? `Documento habilitante marcado como listo automáticamente junto con el principal ${documento.codigoBarras} (con código de verificación)`
                : `Documento habilitante marcado como listo automáticamente junto con el principal ${documento.codigoBarras} (sin código - notificación omitida)`;
                
              await EventoDocumento.create({
                idDocumento: habilitante.id,
                tipo: 'cambio_estado',
                detalles: detalleEvento,
                usuario: req.matrizador.nombre
              }, { transaction });
            } catch (eventError) {
              console.error(`Error al registrar evento para documento habilitante ${habilitante.id}:`, eventError);
            }
            
            documentosHabilitantesActualizados++;
            console.log(`✅ Documento habilitante ${habilitante.codigoBarras} marcado como listo`);
          }
          
          console.log(`📊 Total de documentos habilitantes actualizados: ${documentosHabilitantesActualizados}`);
        } else {
          console.log(`ℹ️ El documento principal ${documento.codigoBarras} no tiene documentos habilitantes en proceso`);
        }
      } else {
        console.log(`ℹ️ El documento ${documento.codigoBarras} no es un documento principal`);
      }
      
      // Registrar el evento de cambio de estado para el documento principal
      try {
        let detallesEvento = 'Documento marcado como listo para entrega por matrizador';
        if (documentosHabilitantesActualizados > 0) {
          detallesEvento += ` (incluyendo ${documentosHabilitantesActualizados} documento(s) habilitante(s))`;
        }
        
        await EventoDocumento.create({
          idDocumento: documento.id,
          tipo: 'cambio_estado',
          detalles: detallesEvento,
          usuario: req.matrizador.nombre
        }, { transaction });
      } catch (eventError) {
        console.error('Error al registrar evento de documento:', eventError);
        // Continuar con la transacción aunque el registro de eventos falle
      }
      
      await transaction.commit();
      
      // Enviar notificación después de confirmar la transacción
      try {
        // Solo enviar notificación si se generó código
        if (codigoVerificacion) {
          console.log(`🔔 Enviando notificación para documento ${documento.codigoBarras}`);
          console.log(`📋 Configuración: método=${documento.metodoNotificacion}, auto=${documento.notificarAutomatico}`);
          console.log(`📞 Teléfono: ${documento.telefonoCliente || 'no disponible'}`);
          console.log(`📧 Email: ${documento.emailCliente || 'no disponible'}`);
          
          // Construir mensajes profesionales
          const mensajes = construirMensajeDocumentoListo(documento, codigoVerificacion);
          
          // Registrar evento de notificación en el historial
          await EventoDocumento.create({
            idDocumento: documento.id,
            tipo: mensajes.tipo,
            detalles: `Notificación de documento listo enviada - Código: ${codigoVerificacion}`,
            usuario: req.matrizador.nombre,
            metadatos: {
              codigoVerificacion: codigoVerificacion,
              metodoNotificacion: documento.metodoNotificacion || 'ambos',
              canal: documento.metodoNotificacion || 'ambos',
              estado: 'enviado'
            }
          });
          
          // Enviar por NotificationService (mantener compatibilidad)
          const resultadoNotificacion = await NotificationService.enviarNotificacionDocumentoListo(documento.id);
          
          // Log detallado de resultados
          console.log('✅ Notificación procesada para documento', documento.codigoBarras);
          console.log('   Método configurado:', documento.metodoNotificacion);
          console.log('   Canales enviados:', resultadoNotificacion.canalesEnviados || 'ninguno');
          console.log('   Errores:', resultadoNotificacion.errores?.length || 0);
          
          if (resultadoNotificacion.canalesEnviados && resultadoNotificacion.canalesEnviados.length > 0) {
            console.log(`📱 NOTIFICACIÓN ENVIADA: Código ${codigoVerificacion} enviado por ${resultadoNotificacion.canalesEnviados.join(' y ')} al cliente ${documento.nombreCliente}`);
          } else {
            console.log(`❌ NOTIFICACIÓN FALLÓ: No se pudo enviar por ningún canal configurado (${documento.metodoNotificacion})`);
            if (resultadoNotificacion.errores && resultadoNotificacion.errores.length > 0) {
              resultadoNotificacion.errores.forEach(error => {
                console.log(`   - Error en ${error.canal}: ${error.error}`);
              });
            }
          }
        } else {
          console.log(`⏭️ NO SE ENVIÓ NOTIFICACIÓN: ${mensajeNotificacion} para documento ${documento.codigoBarras}`);
        }
      } catch (notificationError) {
        console.error('Error al enviar notificación de documento listo:', notificationError);
        // No afectar el flujo principal si falla la notificación
      }
      
      // Mensaje de éxito personalizado según la configuración del documento
      let mensajeExito = '';
      
      if (codigoVerificacion) {
        mensajeExito = `El documento ha sido marcado como listo para entrega y se ha enviado el código de verificación al cliente.`;
      } else {
        if (documento.omitirNotificacion) {
          mensajeExito = `El documento ha sido marcado como listo para entrega. No se envió notificación según la configuración del documento.`;
        } else if (esEntregaInmediata) {
          mensajeExito = `El documento ha sido marcado como listo para entrega inmediata. No se requiere código de verificación.`;
        } else {
          mensajeExito = `El documento ha sido marcado como listo para entrega. No se pudo enviar notificación por falta de datos de contacto.`;
        }
      }
      
      if (documentosHabilitantesActualizados > 0) {
        mensajeExito += ` También se marcaron como listos ${documentosHabilitantesActualizados} documento(s) habilitante(s) relacionado(s).`;
      }
      
      req.flash('success', mensajeExito);
      res.redirect('/matrizador/documentos');
    } catch (error) {
      await transaction.rollback();
      console.error('Error al marcar documento como listo:', error);
      req.flash('error', `Error al marcar el documento como listo: ${error.message}`);
      res.redirect('/matrizador/documentos');
    }
  },
};

module.exports = matrizadorController;