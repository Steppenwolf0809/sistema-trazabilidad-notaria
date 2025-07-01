/**
 * Controlador para gestionar el historial de notificaciones
 * Maneja la visualización, filtrado y detalles de notificaciones enviadas
 */

const { NotificacionEnviada, Documento, Matrizador } = require('../models');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');
const moment = require('moment');

// =============================================
// HELPERS
// =============================================

function getRoleFromPath(path) {
    const parts = path.split('/');
    if (parts.length > 1) {
        return parts[1]; // e.g., 'admin' from '/admin/notificaciones/historial'
    }
    return 'unknown';
}

// =============================================
// UNIVERSAL CONTROLLER LOGIC
// =============================================

const notificacionController = {
  /**
   * Muestra el historial de notificaciones con filtros
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  mostrarHistorial: async (req, res) => {
    try {
      // Configurar usuario desde req.matrizador (principal) o req.user (fallback)
      const user = req.matrizador || req.user;
      
      // También configurar req.user para compatibilidad si no existe
      if (!req.user && req.matrizador) {
        req.user = req.matrizador;
      }
      
      const userRole = user?.rol || getRoleFromPath(req.path); // 'admin', 'recepcion', 'archivo', 'matrizador'

      console.log('🔍 DEBUG notificacionController.mostrarHistorial:', {
        path: req.path,
        userRole,
        userExists: !!user,
        userName: user?.nombre,
        userId: user?.id,
        method: req.method,
        headers: req.headers['user-agent'] ? 'browser' : 'other'
      });
      
      console.log('=== ANÁLISIS DETALLADO ===');
      console.log('URL Original:', req.originalUrl);
      console.log('Parámetros URL:', req.params);
      console.log('Query params:', req.query);
      console.log('req.matrizador:', !!req.matrizador);
      console.log('req.user:', !!req.user);

      if (!user) {
        console.log('❌ Usuario no autenticado en notificacionController.mostrarHistorial');
        req.flash('error', 'Usuario no autenticado');
        return res.redirect('/login');
      }

      // Parámetros de filtrado
      const {
        fechaDesde,
        fechaHasta,
        tipo,
        canal,
        estado,
        matrizadorId,
        busqueda
      } = req.query;

      // Construir condiciones de filtrado
      const whereClause = {};
      const documentoWhereClause = {};

      // === Filtros de Permisos por Rol ===
      if (userRole === 'matrizador' || userRole === 'archivo' || userRole === 'caja_archivo') {
        // Matrizador, archivo y caja_archivo solo ven notificaciones de sus propios documentos
        documentoWhereClause.id_matrizador = user.id; 
      }
      
      if ((userRole === 'admin' || userRole === 'recepcion') && matrizadorId) {
        documentoWhereClause.id_matrizador = parseInt(matrizadorId, 10);
      }

      // === Filtros de la Interfaz de Usuario ===
      if (tipo && tipo !== 'todos') whereClause.tipoEvento = tipo;
      if (canal && canal !== 'todos') whereClause.canal = canal;
      if (estado && estado !== 'todos') whereClause.estado = estado;

      // CORREGIDO: Manejo más robusto de filtros de fecha
      if (fechaDesde && fechaHasta) {
        whereClause.created_at = {
          [Op.between]: [
            moment(fechaDesde).startOf('day').toDate(),
            moment(fechaHasta).endOf('day').toDate()
          ]
        };
      } else if (fechaDesde) {
        whereClause.created_at = { [Op.gte]: moment(fechaDesde).startOf('day').toDate() };
      } else if (fechaHasta) {
        whereClause.created_at = { [Op.lte]: moment(fechaHasta).endOf('day').toDate() };
      }

      if (busqueda && busqueda.trim().length > 0) {
        // CORREGIDO: Usar nombres de campos correctos y validar entrada
        const busquedaLimpia = busqueda.trim();
        documentoWhereClause[Op.or] = [
          { codigo_barras: { [Op.iLike]: `%${busquedaLimpia}%` } },
          { nombre_cliente: { [Op.iLike]: `%${busquedaLimpia}%` } },
          { numero_factura: { [Op.iLike]: `%${busquedaLimpia}%` } },
          { identificacion_cliente: { [Op.iLike]: `%${busquedaLimpia}%` } }
        ];
      }
      
      // CORREGIDO: Construcción más robusta de la consulta
      const findOptions = {
        where: Object.keys(whereClause).length > 0 ? whereClause : {},
        include: [{
            model: Documento,
            as: 'documento',
            where: Object.keys(documentoWhereClause).length > 0 ? documentoWhereClause : undefined,
            required: Object.keys(documentoWhereClause).length > 0, // INNER JOIN solo si hay filtros de documento
            include: [{ 
              model: Matrizador, 
              as: 'matrizador',
              required: false,
              attributes: ['id', 'nombre', 'email']
            }]
        }],
        order: [['created_at', 'DESC']],
        limit: 100,
        distinct: true // Evitar duplicados
      };

      console.log('📊 Filtros aplicados:', {
        whereClause: Object.keys(whereClause),
        documentoWhereClause: Object.keys(documentoWhereClause),
        userRole,
        busqueda: !!busqueda
      });
      
      console.log('📊 Ejecutando query con opciones:', JSON.stringify(findOptions, null, 2));
      
      const notificaciones = await NotificacionEnviada.findAll(findOptions);
      
      console.log('📋 Notificaciones encontradas:', notificaciones.length);
      
      // Obtener estadísticas basadas en los mismos filtros
      const stats = await notificacionController.obtenerEstadisticas(whereClause, documentoWhereClause);
      
      console.log('📈 Estadísticas calculadas:', stats);
      
      // Matrizadores para el filtro (solo para admin/recepcion)
      let matrizadores = [];
      if (userRole === 'admin' || userRole === 'recepcion') {
          matrizadores = await Matrizador.findAll({ order: [['nombre', 'ASC']] });
      }

      // Helpers para la vista con clases Bootstrap estándar
      const badgeClasses = {
          estado: { enviado: 'bg-success', error: 'bg-danger', pendiente: 'bg-warning', simulado: 'bg-info' },
          tipo: { documento_listo: 'bg-primary', entrega_confirmada: 'bg-success', entrega_grupal: 'bg-info' },
          canal: { whatsapp: 'bg-success', email: 'bg-primary', ambos: 'bg-secondary' }
      };
      const iconClasses = {
          canal: { whatsapp: 'fab fa-whatsapp', email: 'fas fa-envelope' }
      };

      // Mapear roles para vistas y layouts
      const vistaRole = userRole === 'caja_archivo' ? 'archivo' : 
                       userRole === 'matrizador' ? 'matrizadores' : userRole;
      const layoutRole = userRole === 'caja_archivo' ? 'caja' : 
                        userRole === 'matrizador' ? 'matrizador' : userRole;
      
      console.log('✅ Renderizando vista:', `${vistaRole}/notificaciones/historial`, 'con layout:', layoutRole);
      
      res.render(`${vistaRole}/notificaciones/historial`, {
        layout: layoutRole,
        title: 'Historial de Notificaciones',
        notificaciones,
        stats,
        filtros: req.query,
        matrizadores,
        userRole: userRole, // Usar el rol real del usuario para los enlaces
        userName: user.nombre,
        badgeClasses,
        iconClasses,
        // No más paginación por ahora para simplificar
      });

    } catch (error) {
      const user = req.matrizador || req.user;
      const userRole = user?.rol || getRoleFromPath(req.path);
      
      console.error(`❌ Error en historial de notificaciones para rol ${userRole}:`, error.message);
      console.error('📊 Parámetros que causaron el error:', req.query);
      console.error('🔍 Stack trace:', error.stack);
      
      // Mensaje de error más específico
      let errorMessage = 'Error al cargar el historial de notificaciones.';
      if (error.message.includes('column') || error.message.includes('relation')) {
        errorMessage = 'Error en los filtros de búsqueda. Por favor, revise los criterios seleccionados.';
      }
      
      req.flash('error', errorMessage);
      
      // Mapear roles para redirección
      const redirectRole = userRole === 'caja_archivo' ? 'caja' : userRole;
      
      // Si no podemos determinar el rol, redirigir al login
      if (!redirectRole || redirectRole === 'unknown') {
        return res.redirect('/login');
      }
      
      // Redirigir al dashboard principal (/) de cada rol
      res.redirect(`/${redirectRole}`);
    }
  },
  
  /**
   * Obtiene los detalles de una notificación específica (API)
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  obtenerDetalleNotificacion: async (req, res) => {
    try {
      console.log('🚀 === INICIO DETALLE NOTIFICACIÓN ===');
      console.log('📋 Parámetros recibidos:', req.params);
      console.log('🌐 Headers:', req.headers.accept);
      console.log('🔗 URL completa:', req.originalUrl);
      
      const { id } = req.params;
      const usuario = req.matrizador || req.user;
      
      console.log('👤 Usuario encontrado:', {
        existe: !!usuario,
        id: usuario?.id,
        rol: usuario?.rol,
        nombre: usuario?.nombre
      });
      
      if (!usuario) {
        console.log('❌ Usuario no autenticado');
        return res.status(401).json({
          exito: false,
          mensaje: 'Usuario no autenticado'
        });
      }
      
      console.log('🔍 DEBUG: Buscando notificación ID:', id);
      console.log('🔍 DEBUG: Usuario rol:', usuario.rol);
      
      // Buscar la notificación primero
      const notificacion = await NotificacionEnviada.findByPk(id);
      
      if (!notificacion) {
        console.log('❌ DEBUG: Notificación no encontrada');
        return res.status(404).json({
          exito: false,
          mensaje: 'Notificación no encontrada'
        });
      }
      
      console.log('✅ DEBUG: Notificación encontrada:', {
        id: notificacion.id,
        documentoId: notificacion.documentoId,
        tipoEvento: notificacion.tipoEvento
      });
      
      // Buscar el documento relacionado si existe
      let documento = null;
      if (notificacion.documentoId) {
        console.log('📄 DEBUG: Buscando documento ID:', notificacion.documentoId);
        documento = await Documento.findByPk(notificacion.documentoId, {
          include: [
            {
              model: Matrizador,
              as: 'matrizador',
              attributes: ['id', 'nombre', 'email'],
              required: false
            }
          ]
        });
        
        console.log('📄 DEBUG: Documento encontrado:', !!documento);
        if (documento) {
          console.log('📄 DEBUG: documento.idMatrizador:', documento.idMatrizador);
          console.log('📄 DEBUG: usuario.id:', usuario.id);
          console.log('📄 DEBUG: usuario.rol:', usuario.rol);
        }
        
        // CORREGIDO: Los roles archivo y admin pueden ver todas las notificaciones para supervisión
        // Solo restricción para caja_archivo (deben ser el matrizador asignado)
        if (documento && usuario.rol === 'caja_archivo') {
          if (documento.idMatrizador !== usuario.id) {
            console.log('🚫 DEBUG: Sin permisos para ver este documento (caja_archivo)');
            console.log('🚫 DEBUG: documento.idMatrizador:', documento.idMatrizador, 'usuario.id:', usuario.id);
            return res.status(403).json({
              exito: false,
              mensaje: 'Sin permisos para ver esta notificación'
            });
          }
        }
      }
      
      console.log('📋 DEBUG: Formateando datos para el modal');
      
      // Formatear datos para el modal con manejo defensivo
      const datosFormateados = {
        id: notificacion.id,
        fechaEnvio: notificacion.created_at,
        estado: notificacion.estado || 'desconocido',
        tipoEvento: notificacion.tipoEvento,
        destinatario: notificacion.destinatario || 'No especificado',
        mensajeEnviado: notificacion.mensajeEnviado || 'Mensaje no disponible',
        metadatos: notificacion.metadatos || {},
        respuestaApi: notificacion.respuestaApi || null,
        ultimoError: notificacion.ultimoError || null,
        intentos: notificacion.intentos || 1,
        documento: documento ? {
          id: documento.id,
          codigo: documento.codigoBarras || 'Sin código',
          tipo: documento.tipoDocumento || 'Sin tipo',
          cliente: {
            nombre: documento.nombreCliente || 'Sin nombre',
            identificacion: documento.identificacionCliente || 'Sin identificación'
          },
          numeroFactura: documento.numeroFactura || null,
          estado: documento.estado || 'Sin estado',
          fechaListo: documento.fechaListo || null,
          matrizador: documento.matrizador ? {
            nombre: documento.matrizador.nombre || 'Sin nombre',
            email: documento.matrizador.email || 'Sin email'
          } : {
            nombre: 'Sin asignar',
            email: 'Sin email'
          }
        } : {
          id: null,
          codigo: 'Entrega grupal',
          tipo: 'Múltiples documentos',
          cliente: {
            nombre: notificacion.metadatos?.nombreCliente || 'Cliente grupal',
            identificacion: 'Múltiples'
          },
          numeroFactura: null,
          estado: 'Entrega grupal',
          fechaListo: null,
          matrizador: {
            nombre: 'Múltiples',
            email: 'N/A'
          }
        },
        puedeReenviar: (notificacion.estado === 'fallido' || notificacion.estado === 'error') && 
                      (notificacion.tipoEvento === 'documento_listo' || notificacion.tipoEvento === 'entrega_confirmada')
      };
      
      console.log('✅ DEBUG: Datos formateados correctamente');
      
      // Si es una petición AJAX, devolver HTML del modal
      if (req.headers.accept && req.headers.accept.includes('text/html')) {
        return res.render('partials/modal-detalle-notificacion', {
          layout: false,
          notificacion: datosFormateados
        });
      }
      
      // Si es API, devolver JSON
      return res.status(200).json({
        exito: true,
        datos: datosFormateados,
        mensaje: 'Detalles de notificación obtenidos correctamente'
      });
    } catch (error) {
      console.error('Error al obtener detalles de notificación:', error);
      
      if (req.headers.accept && req.headers.accept.includes('text/html')) {
        return res.status(500).send(`
          <div class="alert alert-danger">
            <i class="fas fa-exclamation-triangle me-2"></i>
            Error al cargar los detalles de la notificación.
          </div>
        `);
      }
      
      return res.status(500).json({
        exito: false,
        mensaje: 'Error al obtener los detalles de la notificación',
        error: error.message
      });
    }
  },
  
  /**
   * Obtiene estadísticas de notificaciones para un usuario
   * @param {Object} whereClause - Filtros para NotificacionEnviada
   * @param {Object} documentoWhereClause - Filtros para Documento
   * @returns {Promise<Object>} Estadísticas de notificaciones
   */
  obtenerEstadisticas: async (whereClause, documentoWhereClause) => {
    try {
      const include = [{
        model: Documento,
        as: 'documento',
        attributes: [],
        where: Object.keys(documentoWhereClause).length > 0 ? documentoWhereClause : undefined
      }];

      const estadisticas = await NotificacionEnviada.findAll({
        attributes: [
          'estado',
          [sequelize.fn('COUNT', sequelize.col('NotificacionEnviada.id')), 'total']
        ],
        where: whereClause,
        include: include,
        group: ['NotificacionEnviada.estado'],
        raw: true
      });
      
      // Procesar estadísticas
      const stats = {
        enviadas: 0,
        fallidas: 0,
        pendientes: 0,
        simuladas: 0,
        total: 0
      };
      
      estadisticas.forEach(stat => {
        const total = parseInt(stat.total, 10);
        stats.total += total;
        
        switch (stat.estado) {
          case 'enviado':
            stats.enviadas = total;
            break;
          case 'error': // 'fallido' en el original, unificar a 'error'
            stats.fallidas = total;
            break;
          case 'pendiente':
            stats.pendientes = total;
            break;
          case 'simulado':
            stats.simuladas = total;
            break;
        }
      });
      
      return stats;
    } catch (error) {
      console.error('Error al obtener estadísticas de notificaciones:', error);
      return {
        enviadas: 0,
        fallidas: 0,
        pendientes: 0,
        simuladas: 0,
        total: 0
      };
    }
  },
  
  /**
   * Reintenta el envío de una notificación fallida (API)
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  reintentarNotificacion: async (req, res) => {
    try {
      const { id } = req.params;
      const usuario = req.matrizador || req.usuario;
      
      if (!usuario) {
        return res.status(401).json({
          exito: false,
          mensaje: 'Usuario no autenticado'
        });
      }
      
      // Solo administradores pueden reintentar notificaciones
      if (usuario.rol !== 'admin') {
        return res.status(403).json({
          exito: false,
          mensaje: 'No tiene permisos para reintentar notificaciones'
        });
      }
      
      const notificacion = await NotificacionEnviada.findByPk(id);
      
      if (!notificacion) {
        return res.status(404).json({
          exito: false,
          mensaje: 'Notificación no encontrada'
        });
      }
      
      if (notificacion.estado !== 'fallido') {
        return res.status(400).json({
          exito: false,
          mensaje: 'Solo se pueden reintentar notificaciones fallidas'
        });
      }
      
      // Aquí se implementaría la lógica de reintento
      // Por ahora solo actualizamos el estado
      await notificacion.update({
        estado: 'pendiente',
        intentos: notificacion.intentos + 1,
        ultimoError: null
      });
      
      return res.status(200).json({
        exito: true,
        mensaje: 'Notificación marcada para reintento'
      });
    } catch (error) {
      console.error('Error al reintentar notificación:', error);
      return res.status(500).json({
        exito: false,
        mensaje: 'Error al reintentar la notificación',
        error: error.message
      });
    }
  }
};

module.exports = notificacionController; 