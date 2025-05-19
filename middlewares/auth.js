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
    
    console.log("Verificando token:", token ? "Token presente" : "Sin token");
    console.log("Ruta actual:", req.originalUrl);
    console.log("Método:", req.method);
    
    if (!token) {
      // Si es una solicitud de API, devolver error JSON
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({
          exito: false,
          mensaje: 'No autorizado - Token no proporcionado'
        });
      }
      
      // Si es una solicitud de vista, redirigir al login
      console.log("Redirigiendo a login por falta de token");
      return res.redirect('/login?error=no_autorizado&redirect=' + encodeURIComponent(req.originalUrl));
    }
    
    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'clave_secreta_notaria_2024');
    console.log("Token decodificado:", { id: decoded.id, rol: decoded.rol });
    
    // Verificar que el ID del matrizador existe en el token
    if (!decoded.id) {
      console.error('Token válido pero sin ID de matrizador');
      return res.redirect('/login?error=token_invalido&redirect=' + encodeURIComponent(req.originalUrl));
    }
    
    // Buscar matrizador en la base de datos
    const matrizador = await Matrizador.findByPk(decoded.id);
    
    if (!matrizador || !matrizador.activo) {
      console.error(`Matrizador no encontrado o inactivo. ID: ${decoded.id}`);
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({
          exito: false,
          mensaje: 'No autorizado - Usuario inactivo o no encontrado'
        });
      }
      
      return res.redirect('/login?error=usuario_inactivo&redirect=' + encodeURIComponent(req.originalUrl));
    }
    
    console.log(`Autenticación exitosa: ${matrizador.nombre} (${matrizador.rol})`);
    console.log("Ruta solicitada:", req.originalUrl);
    
    // Agregar información del matrizador a la solicitud
    req.matrizador = {
      id: matrizador.id,
      nombre: matrizador.nombre,
      email: matrizador.email,
      cargo: matrizador.cargo,
      rol: matrizador.rol
    };
    
    // Renovar el token si está a punto de expirar (menos de 2 días)
    const ahora = Math.floor(Date.now() / 1000);
    const dosDisEnSegundos = 2 * 24 * 60 * 60;
    
    if (decoded.exp && (decoded.exp - ahora < dosDisEnSegundos)) {
      console.log('Renovando token próximo a expirar');
      
      // Crear nuevo token
      const nuevoToken = jwt.sign(
        { id: matrizador.id, rol: matrizador.rol },
        process.env.JWT_SECRET || 'clave_secreta_notaria_2024',
        { expiresIn: '7d' }
      );
      
      // Establecer el nuevo token en la cookie
      res.cookie('token', nuevoToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
        path: '/',
        sameSite: 'lax'
      });
    }
    
    // Agregar rol a locals para acceso en las vistas
    res.locals.userRole = matrizador.rol;
    res.locals.userName = matrizador.nombre;
    
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
    
    // Limpiar cookie de sesión ante error de JWT
    res.clearCookie('token');
    
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
      layout: 'admin',
      title: 'Acceso denegado',
      message: 'No tiene permisos para acceder a esta página. Se requieren privilegios de administrador.'
    });
  }
  
  next();
};

/**
 * Middleware para verificar que el usuario es matrizador o admin
 */
const esMatrizador = (req, res, next) => {
  if (!req.matrizador) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({
        exito: false,
        mensaje: 'No autorizado - Token no verificado'
      });
    }
    
    return res.redirect('/login?error=no_autorizado&redirect=' + encodeURIComponent(req.originalUrl));
  }
  
  // Verificar que el rol sea 'admin' o 'matrizador'
  if (req.matrizador.rol !== 'admin' && req.matrizador.rol !== 'matrizador') {
    if (req.path.startsWith('/api/')) {
      return res.status(403).json({
        exito: false,
        mensaje: 'Prohibido - No tiene permisos de matrizador'
      });
    }
    
    return res.render('error', {
      layout: 'admin',
      title: 'Acceso denegado',
      message: 'No tiene permisos para acceder a esta página. Se requieren privilegios de matrizador o administrador.'
    });
  }
  
  next();
};

/**
 * Middleware para verificar que el usuario es de recepción, matrizador o admin
 */
const esRecepcion = (req, res, next) => {
  if (!req.matrizador) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({
        exito: false,
        mensaje: 'No autorizado - Token no verificado'
      });
    }
    
    return res.redirect('/login?error=no_autorizado&redirect=' + encodeURIComponent(req.originalUrl));
  }
  
  // Verificar que el rol sea válido para esta función
  const rolesPermitidos = ['admin', 'matrizador', 'recepcion'];
  if (!rolesPermitidos.includes(req.matrizador.rol)) {
    if (req.path.startsWith('/api/')) {
      return res.status(403).json({
        exito: false,
        mensaje: 'Prohibido - No tiene permisos de recepción'
      });
    }
    
    return res.render('error', {
      layout: 'admin',
      title: 'Acceso denegado',
      message: 'No tiene permisos para acceder a esta página. Se requieren privilegios de recepción, matrizador o administrador.'
    });
  }
  
  next();
};

/**
 * Middleware para verificar que el usuario tiene al menos permisos de consulta
 */
const esConsulta = (req, res, next) => {
  // Todos los roles tienen al menos permisos de consulta
  next();
};

// Modificación: función para redirigir según rol después del login
function redirigirSegunRol(req, res) {
  if (!req.matrizador) {
    return res.redirect('/login');
  }
  switch (req.matrizador.rol) {
    case 'admin':
      return res.redirect('/admin');
    case 'matrizador':
      return res.redirect('/matrizador');
    case 'recepcion':
      return res.redirect('/recepcion');
    default:
      return res.redirect('/login');
  }
}

module.exports = {
  verificarToken,
  esAdmin,
  esMatrizador,
  esRecepcion,
  esConsulta,
  redirigirSegunRol
}; 