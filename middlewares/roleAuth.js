/**
 * Middleware de control de acceso basado en roles
 * ACTUALIZADO: Validaciones reforzadas para segregación de funciones
 * Verifica si el usuario tiene el rol adecuado para acceder a una ruta
 */

module.exports = function roleAuth(rolesPermitidos) {
  return function(req, res, next) {
    // Si no hay usuario autenticado, redirigir al login
    if (!req.matrizador || !req.matrizador.rol) {
      return res.redirect('/login?error=no_autorizado');
    }
    
    // ============== VALIDACIONES CRÍTICAS DE SEGREGACIÓN ===============
    
    // VALIDACIÓN CRÍTICA 1: Admin NO puede crear, registrar o entregar documentos
    if (req.matrizador.rol === 'admin') {
      const rutasProhibidasAdmin = [
        '/admin/documentos/registrar',
        '/admin/documentos/registro', 
        '/admin/documentos/entrega',
        '/admin/documentos/completar-entrega',
        '/admin/documentos/entrega-grupal',
        '/admin/documentos/crear'
      ];
      
      const rutaActual = req.path.toLowerCase();
      const operacionProhibida = rutasProhibidasAdmin.some(ruta => 
        rutaActual.includes(ruta.toLowerCase())
      );
      
      if (operacionProhibida || 
          (req.method === 'POST' && rutaActual.includes('/documentos/') && 
           (rutaActual.includes('registrar') || rutaActual.includes('entrega')))) {
        console.log(`🚫 [SEGREGACIÓN] Admin ${req.matrizador.nombre} intentó operación prohibida: ${req.path}`);
        return res.status(403).json({
          error: 'Operación no autorizada por segregación de funciones',
          mensaje: 'Admin no puede crear, registrar o entregar documentos',
          principio: 'Separación entre supervisión y operación',
          contacto: 'Solicite a Caja, Matrizador o Recepción realizar esta operación'
        });
      }
    }
    
    // VALIDACIÓN CRÍTICA 2: Matrizador NO puede crear documentos desde cero
    if (req.matrizador.rol === 'matrizador') {
      const rutasProhibidasMatrizador = [
        '/matrizador/documentos/registro',
        '/matrizador/documentos/crear',
        '/matrizador/documentos/nuevo'
      ];
      
      const rutaActual = req.path.toLowerCase();
      const creacionProhibida = rutasProhibidasMatrizador.some(ruta => 
        rutaActual.includes(ruta.toLowerCase())
      );
      
      if (creacionProhibida || 
          (req.method === 'POST' && rutaActual === '/matrizador/documentos/registro')) {
        console.log(`🚫 [SEGREGACIÓN] Matrizador ${req.matrizador.nombre} intentó crear documento: ${req.path}`);
        return res.status(403).json({
          error: 'Operación no autorizada por segregación de funciones',
          mensaje: 'Matrizador no puede crear documentos desde cero',
          principio: 'Solo puede procesar documentos asignados por Caja',
          contacto: 'Solicite a Caja registrar el documento primero'
        });
      }
    }
    
    // ============== VALIDACIONES TRADICIONALES ===============
    
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

/**
 * NUEVO: Middleware para validar operaciones de segregación específicas
 */
const validarSegregacion = (operacion) => {
  return (req, res, next) => {
    const rol = req.matrizador?.rol;
    
    switch (operacion) {
      case 'crear_documento':
        if (rol === 'admin' || rol === 'matrizador') {
          return res.status(403).json({
            error: 'Segregación de funciones violada',
            mensaje: `${rol} no puede crear documentos`,
            operacionPermitida: 'Solo Caja puede crear documentos'
          });
        }
        break;
        
      case 'entregar_documento':
        if (rol === 'admin') {
          return res.status(403).json({
            error: 'Segregación de funciones violada', 
            mensaje: 'Admin no puede entregar documentos',
            operacionPermitida: 'Solo Recepción o Matrizador (casos excepcionales)'
          });
        }
        break;
        
      case 'registrar_pago':
        if (rol === 'admin' || rol === 'matrizador' || rol === 'recepcion') {
          return res.status(403).json({
            error: 'Segregación de funciones violada',
            mensaje: `${rol} no puede registrar pagos`,
            operacionPermitida: 'Solo Caja puede registrar pagos'
          });
        }
        break;
    }
    
    next();
  };
};

// Exportar tanto la función principal como los middlewares específicos
module.exports.esCajaArchivo = esCajaArchivo;
module.exports.esArchivo = esArchivo;
module.exports.validarSegregacion = validarSegregacion; 