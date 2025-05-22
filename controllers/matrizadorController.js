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
  procesarFechaFactura, 
  formatearValorMonetario 
} = require('../utils/documentoUtils');

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
      
      // Verificar campos obligatorios
      if (!nombre || !email || !identificacion || !cargo) {
        if (req.path.startsWith('/api/')) {
          return res.status(400).json({
            exito: false,
            mensaje: 'Faltan campos obligatorios'
          });
        }
        
        req.flash('error', 'Todos los campos son obligatorios');
        return res.redirect('/matrizador');
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
        return res.redirect('/matrizador');
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
      const rolesValidos = ['admin', 'matrizador', 'recepcion', 'consulta', 'caja'];
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
        return res.redirect('/matrizador');
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
      return res.redirect('/matrizador');
    }
  },

  /**
   * Actualiza un matrizador existente
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  actualizar: async (req, res) => {
    try {
      // Obtener ID de la ruta o del cuerpo de la solicitud
      const id = req.params.id || req.body.id;
      
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
        return res.redirect('/matrizador');
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
        return res.redirect('/matrizador');
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
        req.flash('success', 'Matrizador actualizado correctamente');
        return res.redirect('/matrizador');
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
      return res.redirect('/matrizador');
    }
  },

  /**
   * Elimina un matrizador
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
        return res.redirect('/matrizador');
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
        return res.redirect('/matrizador');
      }

      console.log(`Eliminando matrizador: ${matrizador.nombre} (ID: ${matrizador.id})`);
      await matrizador.destroy();
      
      // Si es una solicitud de vista, redirigir con mensaje de éxito
      if (!req.path.startsWith('/api/')) {
        req.flash('success', 'Matrizador eliminado correctamente');
        return res.redirect('/matrizador');
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
      return res.redirect('/matrizador');
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
          COUNT(CASE WHEN EXTRACT(EPOCH FROM (updated_at - created_at))/86400 <= 7 THEN 1 END) * 100.0 / COUNT(*) as porcentaje
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
        order: [
          [sequelize.literal(`EXTRACT(EPOCH FROM (NOW() - created_at))/86400`), 'DESC']
        ],
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
        order: [['updated_at', 'DESC']],
        limit: 10
      });
      
      // Añadir días sin retirar a cada documento
      const documentosListos = docsListos.map(doc => {
        const fechaListo = doc.updated_at; // La fecha en que se actualizó al estado 'listo_para_entrega'
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
          TO_CHAR(updated_at, 'YYYY-MM-DD') as fecha,
          COUNT(*) as total
        FROM documentos
        WHERE id_matrizador = :idMatrizador
        AND updated_at BETWEEN :fechaInicio AND :fechaFin
        AND (
          (estado = 'listo_para_entrega') OR
          (estado = 'entregado' AND updated_at BETWEEN :fechaInicio AND :fechaFin)
        )
        GROUP BY TO_CHAR(updated_at, 'YYYY-MM-DD')
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
          datos: datosTiempos.map(d => parseFloat(d.promedio).toFixed(1))
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
        order: [['updated_at', 'DESC']],
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
      
      // Generar un código de verificación de 4 dígitos
      const codigoVerificacion = Math.floor(1000 + Math.random() * 9000).toString();
      
      // Crear el nuevo documento
      const nuevoDocumento = await Documento.create({
        codigoBarras,
        tipoDocumento,
        nombreCliente,
        identificacionCliente,
        emailCliente: emailCliente || null,
        telefonoCliente: telefonoCliente || null,
        estado: 'en_proceso',
        codigoVerificacion,
        idMatrizador: req.matrizador.id,
        notas: notas || null,
        // Agregar nuevos campos
        numeroFactura: numeroFactura || null,
        valorFactura: valorFactura ? parseFloat(valorFactura) : null,
        fechaFactura: procesarFechaFactura(fechaFactura),
        estadoPago: estadoPago || 'pendiente',
        metodoPago: metodoPago || null,
        omitirNotificacion: omitirNotificacion === 'true',
        motivoOmision: omitirNotificacion === 'true' ? motivoOmision : null,
        detalleOmision: (omitirNotificacion === 'true' && motivoOmision === 'otro') ? detalleOmision : null,
        idUsuarioCreador: req.matrizador.id,
        rolUsuarioCreador: req.matrizador.rol,
        comparecientes: comparecientesJson
      }, { transaction });
      
      // Registrar el evento de creación
      try {
        await EventoDocumento.create({
          idDocumento: nuevoDocumento.id,
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
        order: [['updated_at', 'DESC']],
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
      
      req.flash('success', `El documento ha sido entregado exitosamente a ${nombreReceptor}.`);
      res.redirect('/matrizador/documentos');
    } catch (error) {
      await transaction.rollback();
      console.error('Error al completar la entrega del documento:', error);
      req.flash('error', `Error al completar la entrega: ${error.message}`);
      res.redirect('/matrizador/documentos/entrega');
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
      
      // Generar código de verificación de 4 dígitos
      const codigoVerificacion = Math.floor(1000 + Math.random() * 9000).toString();
      
      // Actualizar estado y código de verificación
      documento.estado = 'listo_para_entrega';
      documento.codigoVerificacion = codigoVerificacion;
      await documento.save({ transaction });
      
      // Registrar el evento de cambio de estado
      try {
        await EventoDocumento.create({
          idDocumento: documento.id,
          tipo: 'cambio_estado',
          detalles: 'Documento marcado como listo para entrega por matrizador',
          usuario: req.matrizador.nombre
        }, { transaction });
      } catch (eventError) {
        console.error('Error al registrar evento de documento:', eventError);
        // Continuar con la transacción aunque el registro de eventos falle
      }
      
      await transaction.commit();
      
      // Simular envío de notificación (en producción enviaría SMS o Email)
      console.log(`NOTIFICACIÓN: Se ha enviado el código ${codigoVerificacion} al cliente ${documento.nombreCliente} (${documento.emailCliente || documento.telefonoCliente})`);
      
      req.flash('success', `El documento ha sido marcado como listo para entrega y se ha enviado el código de verificación al cliente.`);
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
};

module.exports = matrizadorController; 