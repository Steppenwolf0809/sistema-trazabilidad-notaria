/**
 * Middleware de autenticación y autorización
 * Verifica tokens JWT y roles de usuario para proteger rutas
 * 🔧 OPTIMIZADO: Reducir consultas DB y mejorar rendimiento
 */

const jwt = require('jsonwebtoken');
const Matrizador = require('../models/Matrizador');

// 🔧 SIMPLIFICADO: Sin cache de usuarios para evitar problemas
// El cache puede causar condiciones de carrera y cuelgues
// Se usará consulta directa a DB para mayor estabilidad

/**
 * Middleware para verificar token JWT
 * 🔧 SIMPLIFICADO: Evitar cuelgues y optimizar rendimiento
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
    
    // 🔧 SIMPLIFICADO: Buscar matrizador directamente sin cache para evitar problemas
    let matrizador;
    try {
      matrizador = await Matrizador.findByPk(decoded.id);
    } catch (dbError) {
      console.error('Error de base de datos al buscar matrizador:', dbError);
      return res.redirect('/login?error=error_sistema&redirect=' + encodeURIComponent(req.originalUrl));
    }
    
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
    
    // Si el rol es admin, hacer copia de req.matrizador en req.usuario para mayor compatibilidad
    if (matrizador.rol === 'admin') {
      req.usuario = { ...req.matrizador };
    }
    
    // 🔧 SIMPLIFICADO: No renovar tokens automáticamente para evitar problemas
    // La renovación automática puede causar condiciones de carrera
    
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
    res.clearCookie('token_renovado');
    
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
    
    // Determinar layout correcto según el rol del usuario actual
    const layout = req.matrizador.rol === 'matrizador' ? 'matrizador' : 
                   req.matrizador.rol === 'recepcion' ? 'recepcion' : 
                   (req.matrizador.rol === 'caja' || req.matrizador.rol === 'caja_archivo') ? 'caja' : 'admin';
    
    return res.render('error', {
      layout,
      title: 'Acceso denegado',
      message: 'No tiene permisos para acceder a esta página. Se requieren privilegios de administrador.',
      userRole: req.matrizador.rol,
      userName: req.matrizador.nombre
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
    
    // Determinar layout correcto según el rol del usuario actual
    const layout = req.matrizador.rol === 'recepcion' ? 'recepcion' : 
                   (req.matrizador.rol === 'caja' || req.matrizador.rol === 'caja_archivo') ? 'caja' : 'admin';
    
    return res.render('error', {
      layout,
      title: 'Acceso denegado',
      message: 'No tiene permisos para acceder a esta página. Se requieren privilegios de matrizador o administrador.',
      userRole: req.matrizador.rol,
      userName: req.matrizador.nombre
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
    
    // Determinar layout correcto según el rol del usuario actual
    const layout = req.matrizador.rol === 'caja' ? 'caja' : 'admin';
    
    return res.render('error', {
      layout,
      title: 'Acceso denegado',
      message: 'No tiene permisos para acceder a esta página. Se requieren privilegios de recepción, matrizador o administrador.',
      userRole: req.matrizador.rol,
      userName: req.matrizador.nombre
    });
  }
  
  next();
};

/**
 * Middleware para verificar que el usuario es de caja, matrizador o admin
 */
const esCaja = (req, res, next) => {
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
  const rolesPermitidos = ['admin', 'matrizador', 'caja', 'caja_archivo', 'archivo'];
  if (!rolesPermitidos.includes(req.matrizador.rol)) {
    if (req.path.startsWith('/api/')) {
      return res.status(403).json({
        exito: false,
        mensaje: 'Prohibido - No tiene permisos de caja'
      });
    }
    
    // Determinar layout correcto según el rol del usuario actual
    const layout = req.matrizador.rol === 'recepcion' ? 'recepcion' : 
                   (req.matrizador.rol === 'caja' || req.matrizador.rol === 'caja_archivo') ? 'caja' : 
                   req.matrizador.rol === 'archivo' ? 'archivo' : 'admin';
    
    return res.render('error', {
      layout,
      title: 'Acceso denegado',
      message: 'No tiene permisos para acceder a esta página. Se requieren privilegios de caja, matrizador o administrador.',
      userRole: req.matrizador.rol,
      userName: req.matrizador.nombre
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
    case 'caja':
    case 'caja_archivo':
      return res.redirect('/caja');
    case 'archivo':
      return res.redirect('/archivo');
    default:
      return res.redirect('/login');
  }
}

/**
 * Middleware para logging de auditoría cuando admin accede a funcionalidades de otros roles
 */
const logAuditoria = (rolRequerido) => {
  return (req, res, next) => {
    try {
      // Solo registrar si el usuario es admin pero está accediendo a funcionalidades de otro rol
      if (req.matrizador && req.matrizador.rol === 'admin' && rolRequerido !== 'admin') {
        console.log(`🔍 AUDITORÍA: Admin ${req.matrizador.nombre} (ID: ${req.matrizador.id}) accedió a funcionalidad de ROL ${rolRequerido.toUpperCase()} en la ruta: ${req.originalUrl} - Método: ${req.method} - IP: ${req.ip || req.connection.remoteAddress} - Timestamp: ${new Date().toISOString()}`);
        
        // Opcional: Aquí se podría guardar en base de datos si existe un modelo de AuditoriaAccesos
        // await AuditoriaAccesos.create({...});
      }
      next();
    } catch (error) {
      console.error('Error en middleware de auditoría:', error);
      next(); // Continuar aún si hay error en el logging
    }
  };
};

/**
 * Middleware combinado que valida acceso por roles Y registra auditoría
 */
const validarAccesoConAuditoria = (rolesPermitidos) => {
  return async (req, res, next) => {
    try {
      // Primero verificar autenticación
      if (!req.matrizador || !req.matrizador.rol) {
        if (req.path.startsWith('/api/')) {
          return res.status(401).json({
            exito: false,
            mensaje: 'No autorizado - Token no verificado'
          });
        }
        return res.redirect('/login?error=no_autorizado&redirect=' + encodeURIComponent(req.originalUrl));
      }

      // ✅ CORRECCIÓN: Verificar si el rol está permitido
      if (!rolesPermitidos.includes(req.matrizador.rol)) {
        // Log del intento de acceso no autorizado
        console.log(`⚠️ ACCESO DENEGADO: Usuario ${req.matrizador.nombre} (ROL: ${req.matrizador.rol}) intentó acceder a ruta que requiere roles: [${rolesPermitidos.join(', ')}] - Ruta: ${req.originalUrl}`);
        
        if (req.path.startsWith('/api/')) {
          return res.status(403).json({
            exito: false,
            mensaje: `Acceso denegado. Se requiere uno de estos roles: ${rolesPermitidos.join(', ')}`
          });
        }

        // 🔧 SIMPLIFICADO: Redirigir según el rol sin usar flash messages complicados
        let dashboardUrl = '/login';
        switch (req.matrizador.rol) {
          case 'admin':
            dashboardUrl = '/admin';
            break;
          case 'matrizador':
            dashboardUrl = '/matrizador';
            break;
          case 'recepcion':
            dashboardUrl = '/recepcion';
            break;
          case 'caja':
          case 'caja_archivo':
            dashboardUrl = '/caja';
            break;
          case 'archivo':
            dashboardUrl = '/archivo';
            break;
        }
        
        console.log(`🔐 REDIRECCIÓN: Usuario ${req.matrizador.nombre} (${req.matrizador.rol}) redirigido a ${dashboardUrl}`);
        return res.redirect(dashboardUrl);
      }

      // ✅ ACCESO PERMITIDO
      console.log(`✅ ACCESO AUTORIZADO: Usuario ${req.matrizador.nombre} (ROL: ${req.matrizador.rol}) accedió a ruta: ${req.originalUrl}`);

      next();
    } catch (error) {
      console.error('Error en middleware de validación de acceso:', error);
      if (req.path.startsWith('/api/')) {
        return res.status(500).json({
          exito: false,
          mensaje: 'Error interno del servidor'
        });
      }
      res.redirect('/login');
    }
  };
};

/**
 * Función helper para obtener dashboard según rol
 */
function obtenerDashboardPorRol(rol) {
  switch (rol) {
    case 'admin':
      return '/admin';
    case 'matrizador':
      return '/matrizador';
    case 'recepcion':
      return '/recepcion';
    case 'caja':
    case 'caja_archivo':
      return '/caja';
    case 'archivo':
      return '/archivo';
    default:
      return '/login';
  }
}

/**
 * Middleware requerido por las rutas de eliminación
 * Alias para esAdmin pero con compatibilidad para req.user
 */
const requireAdmin = (req, res, next) => {
  // Si existe req.matrizador, copiarlo a req.user para compatibilidad
  if (req.matrizador) {
    req.user = { ...req.matrizador };
  }
  
  // Verificar que req.user existe (debería haber sido establecido por verificarToken)
  if (!req.user) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({
        success: false,
        message: 'No autorizado - Token no verificado'
      });
    }
    
    return res.redirect('/login?error=no_autorizado&redirect=' + encodeURIComponent(req.originalUrl));
  }
  
  // Verificar que el rol sea 'admin'
  if (req.user.rol !== 'admin') {
    if (req.path.startsWith('/api/')) {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado. Solo administradores.'
      });
    }
    
    // Determinar layout correcto según el rol del usuario actual
    const layout = req.user.rol === 'matrizador' ? 'matrizador' : 
                   req.user.rol === 'recepcion' ? 'recepcion' : 
                   req.user.rol === 'caja' ? 'caja' : 'admin';
    
    return res.render('error', {
      layout,
      title: 'Acceso denegado',
      message: 'No tiene permisos para acceder a esta página. Se requieren privilegios de administrador.',
      userRole: req.user.rol,
      userName: req.user.nombre
    });
  }
  
  next();
};

/**
 * Función placeholder para compatibilidad
 * 🔧 SIMPLIFICADO: Sin cache, no hay nada que limpiar
 */
const limpiarCacheUsuario = (userId) => {
  // No hacer nada - el cache fue eliminado por estabilidad
  console.log(`🧹 Cache simplificado - no hay nada que limpiar para usuario ID: ${userId}`);
};

module.exports = {
  verificarToken,
  esAdmin,
  esMatrizador,
  esRecepcion,
  esCaja,
  esConsulta,
  redirigirSegunRol,
  logAuditoria,
  validarAccesoConAuditoria,
  obtenerDashboardPorRol,
  requireAdmin,
  limpiarCacheUsuario // 🔧 NUEVO: Función para limpiar cache
}; 