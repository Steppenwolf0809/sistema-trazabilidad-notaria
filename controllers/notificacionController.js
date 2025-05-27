/**
 * Controlador para gestionar el historial de notificaciones
 * Maneja la visualización, filtrado y detalles de notificaciones enviadas
 */

const { NotificacionEnviada, Documento } = require('../models');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');
const moment = require('moment');

const notificacionController = {
  /**
   * Muestra el historial de notificaciones con filtros
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  mostrarHistorial: async (req, res) => {
    try {
      const usuario = req.matrizador || req.usuario;
      
      if (!usuario) {
        req.flash('error', 'Usuario no autenticado');
        return res.redirect('/login');
      }
      
      // Parámetros de paginación
      const page = parseInt(req.query.page) || 1;
      const limit = 20;
      const offset = (page - 1) * limit;
      
      // Parámetros de filtrado
      const {
        codigoBarras,
        cliente,
        canal,
        estado,
        tipoEvento,
        fechaDesde,
        fechaHasta
      } = req.query;
      
      // Construir condiciones de filtrado
      const whereClause = {};
      const documentoWhere = {};
      
      // Filtro por matrizador (solo sus documentos)
      if (usuario.rol === 'matrizador') {
        documentoWhere.idMatrizador = usuario.id;
      }
      
      // Filtros de notificación
      if (canal) {
        whereClause.canal = canal;
      }
      
      if (estado) {
        whereClause.estado = estado;
      }
      
      if (tipoEvento) {
        whereClause.tipoEvento = tipoEvento;
      }
      
      // Filtros de fecha
      if (fechaDesde || fechaHasta) {
        whereClause.created_at = {};
        
        if (fechaDesde) {
          whereClause.created_at[Op.gte] = moment(fechaDesde).startOf('day').toDate();
        }
        
        if (fechaHasta) {
          whereClause.created_at[Op.lte] = moment(fechaHasta).endOf('day').toDate();
        }
      }
      
      // Filtros de documento
      if (codigoBarras) {
        documentoWhere.codigoBarras = { [Op.iLike]: `%${codigoBarras}%` };
      }
      
      if (cliente) {
        documentoWhere[Op.or] = [
          { nombreCliente: { [Op.iLike]: `%${cliente}%` } },
          { identificacionCliente: { [Op.iLike]: `%${cliente}%` } }
        ];
      }
      
      // Obtener notificaciones con paginación
      const { count, rows: notificaciones } = await NotificacionEnviada.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Documento,
            as: 'documento',
            where: documentoWhere,
            attributes: ['id', 'tipoDocumento', 'codigoBarras', 'nombreCliente', 'identificacionCliente']
          }
        ],
        order: [['created_at', 'DESC']],
        limit,
        offset
      });
      
      // Obtener estadísticas
      const stats = await notificacionController.obtenerEstadisticas(usuario);
      
      // Preparar datos para la paginación
      const totalPages = Math.ceil(count / limit);
      const pagination = {
        pages: []
      };
      
      // Generar URLs para la paginación
      const baseUrl = '/matrizador/notificaciones/historial?';
      const queryParams = new URLSearchParams();
      
      if (codigoBarras) queryParams.append('codigoBarras', codigoBarras);
      if (cliente) queryParams.append('cliente', cliente);
      if (canal) queryParams.append('canal', canal);
      if (estado) queryParams.append('estado', estado);
      if (tipoEvento) queryParams.append('tipoEvento', tipoEvento);
      if (fechaDesde) queryParams.append('fechaDesde', fechaDesde);
      if (fechaHasta) queryParams.append('fechaHasta', fechaHasta);
      
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
      
      res.render('matrizadores/notificaciones/historial', {
        layout: 'matrizador',
        title: 'Historial de Notificaciones',
        notificaciones,
        stats,
        pagination,
        filtros: {
          codigoBarras,
          cliente,
          canal,
          estado,
          tipoEvento,
          fechaDesde,
          fechaHasta
        },
        userRole: usuario.rol,
        userName: usuario.nombre
      });
    } catch (error) {
      console.error('Error al mostrar historial de notificaciones:', error);
      req.flash('error', 'Error al cargar el historial de notificaciones');
      res.redirect('/matrizador');
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
      const usuario = req.matrizador || req.usuario;
      
      if (!usuario) {
        return res.status(401).json({
          exito: false,
          mensaje: 'Usuario no autenticado'
        });
      }
      
      // Construir condiciones según el rol
      const whereClause = { id };
      const includeClause = [
        {
          model: Documento,
          as: 'documento',
          attributes: ['id', 'tipoDocumento', 'codigoBarras', 'nombreCliente', 'identificacionCliente']
        }
      ];
      
      // Si es matrizador, solo puede ver notificaciones de sus documentos
      if (usuario.rol === 'matrizador') {
        includeClause[0].where = { idMatrizador: usuario.id };
      }
      
      const notificacion = await NotificacionEnviada.findOne({
        where: whereClause,
        include: includeClause
      });
      
      if (!notificacion) {
        return res.status(404).json({
          exito: false,
          mensaje: 'Notificación no encontrada o sin permisos para verla'
        });
      }
      
      return res.status(200).json({
        exito: true,
        datos: notificacion,
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
  
  /**
   * Obtiene estadísticas de notificaciones para un usuario
   * @param {Object} usuario - Usuario autenticado
   * @returns {Promise<Object>} Estadísticas de notificaciones
   */
  obtenerEstadisticas: async (usuario) => {
    try {
      // Construir condiciones según el rol
      const includeClause = [
        {
          model: Documento,
          as: 'documento',
          attributes: []
        }
      ];
      
      // Si es matrizador, solo sus documentos
      if (usuario.rol === 'matrizador') {
        includeClause[0].where = { idMatrizador: usuario.id };
      }
      
      // Obtener estadísticas por estado
      const estadisticas = await NotificacionEnviada.findAll({
        attributes: [
          'estado',
          [sequelize.fn('COUNT', sequelize.col('NotificacionEnviada.id')), 'total']
        ],
        include: includeClause,
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
        const total = parseInt(stat.total);
        stats.total += total;
        
        switch (stat.estado) {
          case 'enviado':
            stats.enviadas = total;
            break;
          case 'fallido':
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