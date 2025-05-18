/**
 * Middleware de autenticación y autorización
 * Verifica tokens JWT y roles de usuario para proteger rutas
 */

const jwt = require('jsonwebtoken');
const Matrizador = require('../models/Matrizador');

/**
 * Middleware para verificar token JWT
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @param {Function} next - Función para continuar al siguiente middleware
 */
const verificarToken = async (req, res, next) => {
  try {
    // Obtener token de cabecera, cookie o query param
    const token = 
      req.headers.authorization?.split(' ')[1] || 
      req.cookies?.token || 
      req.query?.token;
    
    if (!token) {
      // Si es una solicitud de API, devolver error JSON
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({
          exito: false,
          mensaje: 'No autorizado - Token no proporcionado'
        });
      }
      
      // Si es una solicitud de vista, redirigir al login
      return res.redirect('/login?error=no_autorizado&redirect=' + encodeURIComponent(req.originalUrl));
    }
    
    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'clave_secreta_notaria_2024');
    
    // Buscar matrizador en la base de datos
    const matrizador = await Matrizador.findByPk(decoded.id);
    
    if (!matrizador || matrizador.estado !== 'activo') {
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({
          exito: false,
          mensaje: 'No autorizado - Usuario inactivo o no encontrado'
        });
      }
      
      return res.redirect('/login?error=usuario_inactivo&redirect=' + encodeURIComponent(req.originalUrl));
    }
    
    // Agregar información del matrizador a la solicitud
    req.matrizador = {
      id: matrizador.id,
      usuario: matrizador.usuario,
      nombre: matrizador.nombre,
      rol: matrizador.rol
    };
    
    next();
  } catch (error) {
    console.error('Error de autenticación:', error);
    
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({
        exito: false,
        mensaje: 'No autorizado - Token inválido',
        error: error.message
      });
    }
    
    return res.redirect('/login?error=sesion_expirada&redirect=' + encodeURIComponent(req.originalUrl));
  }
};

/**
 * Middleware para verificar que el usuario es administrador
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @param {Function} next - Función para continuar al siguiente middleware
 */
const esAdmin = (req, res, next) => {
  // Verificar que req.matrizador existe (debería haber sido establecido por verificarToken)
  if (!req.matrizador) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({
        exito: false,
        mensaje: 'No autorizado - Token no verificado'
      });
    }
    
    return res.redirect('/login?error=no_autorizado&redirect=' + encodeURIComponent(req.originalUrl));
  }
  
  // Verificar que el rol sea 'admin'
  if (req.matrizador.rol !== 'admin') {
    if (req.path.startsWith('/api/')) {
      return res.status(403).json({
        exito: false,
        mensaje: 'Prohibido - No tiene permisos de administrador'
      });
    }
    
    return res.render('error', {
      title: 'Acceso denegado',
      message: 'No tiene permisos para acceder a esta página. Se requieren privilegios de administrador.'
    });
  }
  
  next();
};

/**
 * Middleware para verificar que el usuario es supervisor o administrador
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @param {Function} next - Función para continuar al siguiente middleware
 */
const esSupervisor = (req, res, next) => {
  // Verificar que req.matrizador existe
  if (!req.matrizador) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({
        exito: false,
        mensaje: 'No autorizado - Token no verificado'
      });
    }
    
    return res.redirect('/login?error=no_autorizado&redirect=' + encodeURIComponent(req.originalUrl));
  }
  
  // Verificar que el rol sea 'admin' o 'supervisor'
  if (req.matrizador.rol !== 'admin' && req.matrizador.rol !== 'supervisor') {
    if (req.path.startsWith('/api/')) {
      return res.status(403).json({
        exito: false,
        mensaje: 'Prohibido - No tiene permisos de supervisor'
      });
    }
    
    return res.render('error', {
      title: 'Acceso denegado',
      message: 'No tiene permisos para acceder a esta página. Se requieren privilegios de supervisor o administrador.'
    });
  }
  
  next();
};

module.exports = {
  verificarToken,
  esAdmin,
  esSupervisor
}; 