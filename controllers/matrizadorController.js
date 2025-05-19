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
        return res.redirect('/admin/matrizadores');
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
        return res.redirect('/admin/matrizadores');
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
      const rolesValidos = ['admin', 'matrizador', 'recepcion', 'consulta'];
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
        return res.redirect('/admin/matrizadores');
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
      return res.redirect('/admin/matrizadores');
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
        return res.redirect('/admin/matrizadores');
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
        return res.redirect('/admin/matrizadores');
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
        return res.redirect('/admin/matrizadores');
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
      return res.redirect('/admin/matrizadores');
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
        return res.redirect('/admin/matrizadores');
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
        return res.redirect('/admin/matrizadores');
      }

      console.log(`Eliminando matrizador: ${matrizador.nombre} (ID: ${matrizador.id})`);
      await matrizador.destroy();
      
      // Si es una solicitud de vista, redirigir con mensaje de éxito
      if (!req.path.startsWith('/api/')) {
        req.flash('success', 'Matrizador eliminado correctamente');
        return res.redirect('/admin/matrizadores');
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
      return res.redirect('/admin/matrizadores');
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
        
        return res.redirect('/admin');
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
  }
};

module.exports = matrizadorController; 