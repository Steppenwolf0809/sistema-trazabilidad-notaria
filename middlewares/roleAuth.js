/**
 * Middleware de control de acceso basado en roles
 * Verifica si el usuario tiene el rol adecuado para acceder a una ruta
 */

module.exports = function roleAuth(rolesPermitidos) {
  return function(req, res, next) {
    // Si no hay usuario autenticado, redirigir al login
    if (!req.matrizador || !req.matrizador.rol) {
      return res.redirect('/login?error=no_autorizado');
    }
    
    // Si el rol está permitido, continuar
    if (rolesPermitidos.includes(req.matrizador.rol)) {
      return next();
    }
    
    // ============== PERMISOS HÍBRIDOS PARA CAJA_ARCHIVO ==============
    
    // Regla especial: Si la ruta comienza con '/matrizador' y el usuario es matrizador O caja_archivo, permitir acceso
    if (req.path.startsWith('/matrizador') && (req.matrizador.rol === 'matrizador' || req.matrizador.rol === 'caja_archivo')) {
      return next();
    }
    
    // Regla especial: Si la ruta comienza con '/recepcion' y el usuario es recepción, permitir acceso
    if (req.path.startsWith('/recepcion') && req.matrizador.rol === 'recepcion') {
      return next();
    }
    
    // Regla especial: Si la ruta comienza con '/caja' y el usuario es caja O caja_archivo, permitir acceso
    if (req.path.startsWith('/caja') && (req.matrizador.rol === 'caja' || req.matrizador.rol === 'caja_archivo')) {
      return next();
    }
    
    // ============== PERMISOS ESPECÍFICOS PARA ROL ARCHIVO ==============
    
    // Regla especial: Si la ruta comienza con '/archivo' y el usuario es archivo, permitir acceso
    if (req.path.startsWith('/archivo') && req.matrizador.rol === 'archivo') {
      return next();
    }
    
    console.log(`Acceso denegado: El usuario ${req.matrizador.nombre} con rol '${req.matrizador.rol}' intentó acceder a la ruta ${req.originalUrl} que requiere alguno de estos roles: ${rolesPermitidos.join(', ')}`);
    
    // Si no tiene permiso, renderizar página de acceso denegado con el layout correspondiente
    const layout = req.matrizador.rol === 'matrizador' ? 'matrizador' : 
                   req.matrizador.rol === 'recepcion' ? 'recepcion' : 
                   req.matrizador.rol === 'caja' ? 'caja' :
                   req.matrizador.rol === 'caja_archivo' ? 'caja' : 
                   req.matrizador.rol === 'archivo' ? 'archivo' : 'admin';
                   
    return res.status(403).render('acceso_denegado', {
      layout,
      title: 'Acceso denegado',
      userName: req.matrizador.nombre,
      userRole: req.matrizador.rol
    });
  };
};

// ============== MIDDLEWARES ESPECÍFICOS ==============

/**
 * Middleware específico para usuarios caja_archivo
 */
const esCajaArchivo = (req, res, next) => {
  if (!req.matrizador || !req.matrizador.rol) {
    return res.redirect('/login?error=no_autorizado');
  }
  
  const rol = req.matrizador.rol;
  if (rol === 'caja_archivo' || rol === 'admin') {
    return next();
  }
  
  const layout = req.matrizador.rol === 'caja' ? 'caja' : 'admin';
  return res.status(403).render('acceso_denegado', {
    layout,
    title: 'Acceso denegado',
    message: 'Esta función solo está disponible para usuarios con rol caja_archivo',
    userName: req.matrizador.nombre,
    userRole: req.matrizador.rol
  });
};

/**
 * Middleware específico para usuarios archivo
 */
const esArchivo = (req, res, next) => {
  if (!req.matrizador || !req.matrizador.rol) {
    return res.redirect('/login?error=no_autorizado');
  }
  
  const rol = req.matrizador.rol;
  if (rol === 'archivo' || rol === 'admin') {
    return next();
  }
  
  const layout = req.matrizador.rol === 'archivo' ? 'archivo' : 'admin';
  return res.status(403).render('acceso_denegado', {
    layout,
    title: 'Acceso denegado',
    message: 'Esta función solo está disponible para usuarios con rol archivo',
    userName: req.matrizador.nombre,
    userRole: req.matrizador.rol
  });
};

// Exportar tanto la función principal como los middlewares específicos
module.exports.esCajaArchivo = esCajaArchivo;
module.exports.esArchivo = esArchivo; 