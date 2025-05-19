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
    
    // Regla especial: Si la ruta comienza con '/matrizador' y el usuario es matrizador, permitir acceso
    if (req.path.startsWith('/matrizador') && req.matrizador.rol === 'matrizador') {
      return next();
    }
    
    // Regla especial: Si la ruta comienza con '/recepcion' y el usuario es recepción, permitir acceso
    if (req.path.startsWith('/recepcion') && req.matrizador.rol === 'recepcion') {
      return next();
    }
    
    console.log(`Acceso denegado: El usuario ${req.matrizador.nombre} con rol '${req.matrizador.rol}' intentó acceder a la ruta ${req.originalUrl} que requiere alguno de estos roles: ${rolesPermitidos.join(', ')}`);
    
    // Si no tiene permiso, renderizar página de acceso denegado con el layout correspondiente
    const layout = req.matrizador.rol === 'matrizador' ? 'matrizador' : 
                   req.matrizador.rol === 'recepcion' ? 'recepcion' : 'admin';
                   
    return res.status(403).render('acceso_denegado', {
      layout,
      title: 'Acceso denegado',
      userName: req.matrizador.nombre,
      userRole: req.matrizador.rol
    });
  };
}; 