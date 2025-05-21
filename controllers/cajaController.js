/**
 * Controlador para el módulo de Caja
 * Proporciona funciones para la gestión de pagos y facturación
 */

const { sequelize, Sequelize } = require('../config/database');
const { Op } = require('sequelize');
const Documento = require('../models/Documento');
const Matrizador = require('../models/Matrizador');
const EventoDocumento = require('../models/EventoDocumento');
const CambioMatrizador = require('../models/CambioMatrizador');
const xml2js = require('xml2js');
const fs = require('fs');
const path = require('path');
const moment = require('moment');

// Objeto que contendrá todas las funciones del controlador
const cajaController = {
  
  /**
   * Muestra el dashboard de caja con estadísticas y resúmenes
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  dashboard: async (req, res) => {
    try {
      console.log('Accediendo al dashboard de caja');
      console.log('Usuario:', req.matrizador?.nombre, 'Rol:', req.matrizador?.rol);
      
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
      
      // Formatear fechas para consultas SQL
      const fechaInicioSQL = fechaInicio.format('YYYY-MM-DD HH:mm:ss');
      const fechaFinSQL = fechaFin.format('YYYY-MM-DD HH:mm:ss');
      
      // Obtener estadísticas de facturación
      const [totalFacturado] = await sequelize.query(`
        SELECT COALESCE(SUM(valor_factura), 0) as total
        FROM documentos
        WHERE fecha_factura BETWEEN :fechaInicio AND :fechaFin
      `, {
        replacements: { 
          fechaInicio: fechaInicioSQL,
          fechaFin: fechaFinSQL
        },
        type: sequelize.QueryTypes.SELECT
      });
      
      // Obtener cantidad de documentos facturados
      const [documentosFacturados] = await sequelize.query(`
        SELECT COUNT(*) as total
        FROM documentos
        WHERE numero_factura IS NOT NULL
        AND fecha_factura BETWEEN :fechaInicio AND :fechaFin
      `, {
        replacements: { 
          fechaInicio: fechaInicioSQL,
          fechaFin: fechaFinSQL
        },
        type: sequelize.QueryTypes.SELECT
      });
      
      // Obtener documentos pendientes de pago
      const documentosPendientes = await Documento.findAll({
        where: {
          estadoPago: 'pendiente',
          numeroFactura: { [Op.not]: null }
        },
        order: [['fechaFactura', 'ASC']],
        limit: 10
      });
      
      // Obtener documentos pagados recientemente
      const documentosPagadosRecientes = await Documento.findAll({
        where: {
          estadoPago: 'pagado',
          numeroFactura: { [Op.not]: null }
        },
        order: [['updated_at', 'DESC']],
        limit: 10
      });
      
      // Obtener estadísticas por tipo de documento
      const estadisticasPorTipo = await sequelize.query(`
        SELECT 
          tipo_documento, 
          COUNT(*) as cantidad, 
          COALESCE(SUM(valor_factura), 0) as total_facturado,
          CASE 
            WHEN COUNT(*) > 0 THEN COALESCE(AVG(valor_factura), 0)
            ELSE 0
          END as promedio
        FROM documentos
        WHERE fecha_factura BETWEEN :fechaInicio AND :fechaFin
        GROUP BY tipo_documento
        ORDER BY total_facturado DESC
      `, {
        replacements: { 
          fechaInicio: fechaInicioSQL,
          fechaFin: fechaFinSQL
        },
        type: sequelize.QueryTypes.SELECT
      });
      
      // Obtener estadísticas por matrizador
      const estadisticasPorMatrizador = await sequelize.query(`
        SELECT 
          m.id, 
          m.nombre, 
          COUNT(d.id) as cantidad, 
          COALESCE(SUM(d.valor_factura), 0) as total_facturado
        FROM matrizadores m
        LEFT JOIN documentos d ON m.id = d.id_matrizador
          AND d.fecha_factura BETWEEN :fechaInicio AND :fechaFin
        WHERE m.rol = 'matrizador'
        GROUP BY m.id, m.nombre
        ORDER BY total_facturado DESC
      `, {
        replacements: { 
          fechaInicio: fechaInicioSQL,
          fechaFin: fechaFinSQL
        },
        type: sequelize.QueryTypes.SELECT
      });
      
      // Gráfico de facturación diaria
      const facturacionDiaria = await sequelize.query(`
        SELECT 
          TO_CHAR(fecha_factura, 'YYYY-MM-DD') as fecha, 
          COUNT(*) as cantidad, 
          COALESCE(SUM(valor_factura), 0) as total
        FROM documentos
        WHERE fecha_factura BETWEEN :fechaInicio AND :fechaFin
        GROUP BY TO_CHAR(fecha_factura, 'YYYY-MM-DD')
        ORDER BY fecha
      `, {
        replacements: { 
          fechaInicio: fechaInicioSQL,
          fechaFin: fechaFinSQL
        },
        type: sequelize.QueryTypes.SELECT
      });
      
      // Preparar datos para gráficos
      const datosGraficos = {
        facturacionDiaria: {
          fechas: facturacionDiaria.map(d => d.fecha),
          cantidades: facturacionDiaria.map(d => d.cantidad),
          totales: facturacionDiaria.map(d => d.total)
        },
        porTipoDocumento: {
          tipos: estadisticasPorTipo.map(e => e.tipo_documento),
          cantidades: estadisticasPorTipo.map(e => e.cantidad),
          totales: estadisticasPorTipo.map(e => e.total_facturado)
        },
        porMatrizador: {
          nombres: estadisticasPorMatrizador.map(e => e.nombre),
          cantidades: estadisticasPorMatrizador.map(e => e.cantidad),
          totales: estadisticasPorMatrizador.map(e => e.total_facturado)
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
      
      // Renderizar el dashboard
      res.render('caja/dashboard', {
        layout: 'caja',
        title: 'Dashboard de Caja',
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre,
        stats: {
          totalFacturado: parseFloat(totalFacturado.total).toFixed(2),
          documentosFacturados: documentosFacturados.total,
          pendientesDePago: documentosPendientes.length,
          recaudadoReciente: documentosPagadosRecientes.length
        },
        documentosPendientes,
        documentosPagadosRecientes,
        estadisticasPorTipo,
        estadisticasPorMatrizador,
        periodo: periodoData,
        datosGraficos
      });
    } catch (error) {
      console.error('Error al cargar dashboard de caja:', error);
      return res.status(500).render('error', {
        layout: 'caja',
        title: 'Error',
        message: 'Error al cargar el dashboard de caja',
        error
      });
    }
  },
  
  /**
   * Lista los documentos gestionados por caja
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  listarDocumentos: async (req, res) => {
    try {
      console.log('Listando documentos para caja');
      
      // Parámetros de paginación
      const page = parseInt(req.query.page) || 1;
      const limit = 10;
      const offset = (page - 1) * limit;
      
      // Parámetros de filtrado
      const estado = req.query.estado || '';
      const estadoPago = req.query.estadoPago || '';
      const tipoDocumento = req.query.tipoDocumento || '';
      const matrizadorId = req.query.matrizadorId || '';
      const busqueda = req.query.busqueda || '';
      
      // Construir condiciones de filtrado
      const where = {};
      
      if (estado) {
        where.estado = estado;
      }
      
      if (estadoPago) {
        where.estadoPago = estadoPago;
      }
      
      if (tipoDocumento) {
        where.tipoDocumento = tipoDocumento;
      }
      
      if (matrizadorId) {
        where.idMatrizador = matrizadorId;
      }
      
      if (busqueda) {
        where[Op.or] = [
          { codigoBarras: { [Op.iLike]: `%${busqueda}%` } },
          { nombreCliente: { [Op.iLike]: `%${busqueda}%` } },
          { numeroFactura: { [Op.iLike]: `%${busqueda}%` } }
        ];
      }
      
      // Obtener documentos con paginación
      const { count, rows: documentos } = await Documento.findAndCountAll({
        where,
        include: [
          {
            model: Matrizador,
            as: 'matrizador',
            attributes: ['id', 'nombre', 'email']
          }
        ],
        order: [['updated_at', 'DESC']],
        limit,
        offset
      });
      
      // Transformar métodos de pago para la vista
      documentos.forEach(doc => {
        if (doc.metodoPago === null) {
          doc.metodoPago = 'pendiente';
        }
        if (doc.metodoPago === 'tarjeta') {
          doc.metodoPago = 'tarjeta_credito';
        }
      });
      
      // Obtener todos los matrizadores para el filtro
      const matrizadores = await Matrizador.findAll({
        where: {
          rol: 'matrizador',
          activo: true
        },
        attributes: ['id', 'nombre']
      });
      
      // Obtener tipos de documento para filtros
      const tiposDocumentoQuery = await Documento.findAll({
        attributes: [[sequelize.fn('DISTINCT', sequelize.col('tipo_documento')), 'tipo']],
        raw: true
      });
      
      const tiposDocumento = tiposDocumentoQuery.map(t => t.tipo).filter(Boolean);
      
      // Preparar datos para la paginación
      const totalPages = Math.ceil(count / limit);
      const pagination = {
        pages: []
      };
      
      // Generar URLs para la paginación
      const baseUrl = '/caja/documentos?';
      const queryParams = new URLSearchParams();
      
      if (estado) queryParams.append('estado', estado);
      if (estadoPago) queryParams.append('estadoPago', estadoPago);
      if (tipoDocumento) queryParams.append('tipoDocumento', tipoDocumento);
      if (matrizadorId) queryParams.append('matrizadorId', matrizadorId);
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
      
      // Renderizar la vista
      res.render('caja/documentos/listado', {
        layout: 'caja',
        title: 'Documentos',
        documentos,
        matrizadores,
        tiposDocumento,
        pagination,
        filtros: {
          estado: estado || '',
          estadoPago: estadoPago || '',
          tipoDocumento: tipoDocumento || '',
          matrizadorId: matrizadorId || '',
          busqueda: busqueda || ''
        },
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre
      });
    } catch (error) {
      console.error('Error al listar documentos:', error);
      return res.status(500).render('error', {
        layout: 'caja',
        title: 'Error',
        message: 'Error al cargar el listado de documentos',
        error
      });
    }
  },
  
  /**
   * Muestra los detalles de un documento específico
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  verDocumento: async (req, res) => {
    try {
      const { id } = req.params;
      
      // Buscar el documento
      const documento = await Documento.findByPk(id, {
        include: [
          {
            model: Matrizador,
            as: 'matrizador',
            attributes: ['id', 'nombre', 'email']
          },
          {
            model: EventoDocumento,
            as: 'eventos',
            order: [['createdAt', 'DESC']]
          }
        ]
      });
      
      if (!documento) {
        req.flash('error', 'Documento no encontrado');
        return res.redirect('/caja/documentos');
      }
      
      // Transformar el método de pago para la vista
      if (documento.metodoPago === null) {
        documento.metodoPago = 'pendiente';
      }
      
      // Si el metodoPago es tarjeta, determinar si es crédito o débito basado en otra información
      // Por simplicidad, asumiremos que es tarjeta_credito por defecto
      if (documento.metodoPago === 'tarjeta') {
        documento.metodoPago = 'tarjeta_credito';
      }
      
      // Obtener matrizadores para el formulario de cambio
      const matrizadores = await Matrizador.findAll({
        where: {
          rol: 'matrizador',
          activo: true
        },
        attributes: ['id', 'nombre']
      });
      
      // Renderizar la vista de detalle
      res.render('caja/documentos/detalle', {
        layout: 'caja',
        title: 'Detalle de Documento',
        documento,
        matrizadores,
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre
      });
    } catch (error) {
      console.error('Error al ver documento:', error);
      return res.status(500).render('error', {
        layout: 'caja',
        title: 'Error',
        message: 'Error al cargar los detalles del documento',
        error
      });
    }
  },

  /**
   * Muestra el listado de pagos registrados
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  listarPagos: async (req, res) => {
    try {
      console.log('Listando pagos');
      
      // Parámetros de paginación
      const page = parseInt(req.query.page) || 1;
      const limit = 10;
      const offset = (page - 1) * limit;
      
      // Parámetros de filtrado
      const fechaInicio = req.query.fechaInicio ? moment(req.query.fechaInicio).startOf('day') : moment().subtract(30, 'days').startOf('day');
      const fechaFin = req.query.fechaFin ? moment(req.query.fechaFin).endOf('day') : moment().endOf('day');
      const metodoPago = req.query.metodoPago || '';
      const busqueda = req.query.busqueda || '';
      
      // Construir condiciones de filtrado
      const where = {
        estadoPago: 'pagado',
        updated_at: {
          [Op.between]: [fechaInicio.toDate(), fechaFin.toDate()]
        }
      };
      
      if (metodoPago) {
        where.metodoPago = metodoPago;
      }
      
      if (busqueda) {
        where[Op.or] = [
          { codigoBarras: { [Op.iLike]: `%${busqueda}%` } },
          { nombreCliente: { [Op.iLike]: `%${busqueda}%` } },
          { numeroFactura: { [Op.iLike]: `%${busqueda}%` } }
        ];
      }
      
      // Obtener documentos pagados con paginación
      const { count, rows: pagos } = await Documento.findAndCountAll({
        where,
        include: [
          {
            model: Matrizador,
            as: 'matrizador',
            attributes: ['id', 'nombre', 'email']
          }
        ],
        order: [['updated_at', 'DESC']],
        limit,
        offset
      });
      
      // Calcular total recaudado
      const [totalRecaudado] = await sequelize.query(`
        SELECT COALESCE(SUM(valor_factura), 0) as total
        FROM documentos
        WHERE estado_pago = 'pagado'
        AND updated_at BETWEEN :fechaInicio AND :fechaFin
        ${metodoPago ? "AND metodo_pago = :metodoPago" : ""}
      `, {
        replacements: { 
          fechaInicio: fechaInicio.format('YYYY-MM-DD HH:mm:ss'),
          fechaFin: fechaFin.format('YYYY-MM-DD HH:mm:ss'),
          metodoPago
        },
        type: sequelize.QueryTypes.SELECT
      });
      
      // Preparar datos para la paginación
      const totalPages = Math.ceil(count / limit);
      const pagination = {
        pages: []
      };
      
      // Generar URLs para la paginación
      const baseUrl = '/caja/pagos?';
      const queryParams = new URLSearchParams();
      
      queryParams.append('fechaInicio', fechaInicio.format('YYYY-MM-DD'));
      queryParams.append('fechaFin', fechaFin.format('YYYY-MM-DD'));
      if (metodoPago) queryParams.append('metodoPago', metodoPago);
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
      
      // Renderizar la vista
      res.render('caja/pagos/listado', {
        layout: 'caja',
        title: 'Listado de Pagos',
        pagos,
        pagination,
        filtros: {
          fechaInicio: fechaInicio.format('YYYY-MM-DD'),
          fechaFin: fechaFin.format('YYYY-MM-DD'),
          metodoPago: metodoPago || '',
          busqueda: busqueda || ''
        },
        totalRecaudado: parseFloat(totalRecaudado.total).toFixed(2),
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre
      });
    } catch (error) {
      console.error('Error al listar pagos:', error);
      return res.status(500).render('error', {
        layout: 'caja',
        title: 'Error',
        message: 'Error al cargar el listado de pagos',
        error
      });
    }
  },
  
  /**
   * Registra un nuevo pago para un documento
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  registrarPago: async (req, res) => {
    try {
      // Iniciar transacción
      const transaction = await sequelize.transaction();
      
      try {
        const { 
          documentoId, 
          numeroFactura, 
          valorFactura, 
          metodoPago, 
          observaciones 
        } = req.body;
        
        // Validar que el documento existe
        const documento = await Documento.findByPk(documentoId, { transaction });
        
        if (!documento) {
          await transaction.rollback();
          req.flash('error', 'El documento no existe');
          return res.redirect('/caja/documentos');
        }
        
        // Actualizar información del documento
        await documento.update({
          numeroFactura,
          valorFactura,
          fechaFactura: new Date(),
          estadoPago: 'pagado',
          metodoPago: mapearMetodoPago(metodoPago)
        }, { transaction });
        
        // Registrar evento de pago
        await EventoDocumento.create({
          idDocumento: documentoId,
          tipo: 'pago',
          detalles: `Pago registrado por ${req.matrizador.nombre}. Método: ${metodoPago}. Factura: ${numeroFactura}. Valor: ${valorFactura}`,
          usuario: req.matrizador.nombre,
          metadatos: JSON.stringify({
            numeroFactura,
            valorFactura,
            metodoPago,
            observaciones,
            registradoPor: req.matrizador.id
          })
        }, { transaction });
        
        // Confirmar la transacción
        await transaction.commit();
        
        req.flash('success', 'Pago registrado correctamente');
        return res.redirect(`/caja/documentos/detalle/${documentoId}`);
      } catch (error) {
        // Revertir la transacción en caso de error
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      console.error('Error al registrar pago:', error);
      req.flash('error', 'Error al registrar el pago: ' + error.message);
      return res.redirect('/caja/documentos');
    }
  },
  
  /**
   * Confirma un pago previamente registrado
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  confirmarPago: async (req, res) => {
    try {
      const { id } = req.params;
      const { observaciones } = req.body;
      
      // Iniciar transacción
      const transaction = await sequelize.transaction();
      
      try {
        // Buscar el documento
        const documento = await Documento.findByPk(id, { transaction });
        
        if (!documento) {
          await transaction.rollback();
          req.flash('error', 'Documento no encontrado');
          return res.redirect('/caja/documentos');
        }
        
        // Verificar que el documento tenga factura
        if (!documento.numeroFactura) {
          await transaction.rollback();
          req.flash('error', 'El documento no tiene número de factura');
          return res.redirect(`/caja/documentos/detalle/${id}`);
        }
        
        // Actualizar el estado de pago
        await documento.update({
          estadoPago: 'pagado'
        }, { transaction });
        
        // Registrar evento de confirmación de pago
        await EventoDocumento.create({
          idDocumento: id,
          tipo: 'confirmacion_pago',
          detalles: `Pago confirmado por ${req.matrizador.nombre}`,
          usuario: req.matrizador.nombre,
          metadatos: JSON.stringify({
            observaciones,
            confirmadoPor: req.matrizador.id
          })
        }, { transaction });
        
        // Confirmar la transacción
        await transaction.commit();
        
        req.flash('success', 'Pago confirmado correctamente');
        return res.redirect(`/caja/documentos/detalle/${id}`);
      } catch (error) {
        // Revertir la transacción en caso de error
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      console.error('Error al confirmar pago:', error);
      req.flash('error', 'Error al confirmar el pago: ' + error.message);
      return res.redirect('/caja/documentos');
    }
  },
  
  /**
   * Muestra el formulario para cambiar el matrizador asignado a un documento
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  mostrarFormularioCambioMatrizador: async (req, res) => {
    try {
      const { id } = req.params;
      
      // Buscar el documento
      const documento = await Documento.findByPk(id, {
        include: [
          {
            model: Matrizador,
            as: 'matrizador',
            attributes: ['id', 'nombre', 'email']
          }
        ]
      });
      
      if (!documento) {
        req.flash('error', 'Documento no encontrado');
        return res.redirect('/caja/documentos');
      }
      
      // Obtener matrizadores activos
      const matrizadores = await Matrizador.findAll({
        where: {
          rol: 'matrizador',
          activo: true
        },
        attributes: ['id', 'nombre', 'email']
      });
      
      // Renderizar el formulario
      res.render('caja/documentos/cambiar-matrizador', {
        layout: 'caja',
        title: 'Cambiar Matrizador',
        documento,
        matrizadores,
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre
      });
    } catch (error) {
      console.error('Error al mostrar formulario de cambio de matrizador:', error);
      req.flash('error', 'Error al mostrar el formulario');
      return res.redirect('/caja/documentos');
    }
  },
  
  /**
   * Procesa el cambio de matrizador para un documento
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  cambiarMatrizador: async (req, res) => {
    try {
      // Iniciar transacción
      const transaction = await sequelize.transaction();
      
      try {
        const { documentoId, matrizadorId, justificacion } = req.body;
        
        // Validar campos requeridos
        if (!documentoId || !matrizadorId || !justificacion) {
          await transaction.rollback();
          req.flash('error', 'Todos los campos son obligatorios');
          return res.redirect('/caja/documentos');
        }
        
        // Validar que el documento existe
        const documento = await Documento.findByPk(documentoId, { transaction });
        
        if (!documento) {
          await transaction.rollback();
          req.flash('error', 'El documento no existe');
          return res.redirect('/caja/documentos');
        }
        
        // Validar que el matrizador existe
        const matrizador = await Matrizador.findByPk(matrizadorId, { transaction });
        
        if (!matrizador) {
          await transaction.rollback();
          req.flash('error', 'El matrizador seleccionado no existe');
          return res.redirect('/caja/documentos');
        }
        
        // Validar que no es el mismo matrizador
        if (documento.idMatrizador === parseInt(matrizadorId)) {
          await transaction.rollback();
          req.flash('error', 'El documento ya está asignado a este matrizador');
          return res.redirect('/caja/documentos');
        }
        
        // Guardar el matrizador anterior
        const matrizadorAnteriorId = documento.idMatrizador;
        
        // Actualizar el documento
        await documento.update({
          idMatrizador: matrizadorId
        }, { transaction });
        
        // Registrar el cambio en la tabla de cambios
        await CambioMatrizador.create({
          documentoId,
          matrizadorAnteriorId,
          matrizadorNuevoId: matrizadorId,
          usuarioId: req.matrizador.id,
          fechaCambio: new Date(),
          justificacion
        }, { transaction });
        
        // Registrar el evento en la tabla de eventos con los campos correctos
        await EventoDocumento.create({
          idDocumento: documentoId,
          tipo: 'cambio_estado',
          detalles: `Cambio de matrizador realizado por ${req.matrizador.nombre}. Motivo: ${justificacion}`,
          usuario: req.matrizador.nombre,
          metadatos: JSON.stringify({
            matrizadorAnteriorId,
            matrizadorNuevoId: matrizadorId,
            justificacion,
            cambiadoPor: req.matrizador.id
          })
        }, { transaction });
        
        // Confirmar la transacción
        await transaction.commit();
        
        req.flash('success', 'Matrizador cambiado correctamente');
        return res.redirect(`/caja/documentos/detalle/${documentoId}`);
      } catch (error) {
        // Revertir la transacción en caso de error
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      console.error('Error al cambiar matrizador:', error);
      req.flash('error', 'Error al cambiar el matrizador: ' + error.message);
      return res.redirect('/caja/documentos');
    }
  },
  
  /**
   * Muestra el formulario para cargar un archivo XML
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  mostrarFormularioXML: async (req, res) => {
    try {
      // Obtener matrizadores para la asignación
      const matrizadores = await Matrizador.findAll({
        where: {
          rol: 'matrizador',
          activo: true
        },
        attributes: ['id', 'nombre']
      });
      
      // Renderizar la vista con el formulario
      res.render('caja/documentos/formulario-xml', {
        layout: 'caja',
        title: 'Cargar XML',
        matrizadores,
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre
      });
    } catch (error) {
      console.error('Error al mostrar formulario XML:', error);
      req.flash('error', 'Error al cargar el formulario');
      return res.redirect('/caja/documentos');
    }
  },
  
  /**
   * Procesa el archivo XML cargado
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  procesarXML: async (req, res) => {
    try {
      // Verificar si se ha cargado un archivo usando multer
      if (!req.file) {
        req.flash('error', 'No se ha cargado ningún archivo');
        return res.redirect('/caja/documentos/nuevo-xml');
      }
      
      const tempPath = req.file.path;
      const xmlFileName = req.file.originalname;
      
      // Leer el contenido del archivo
      const xmlData = fs.readFileSync(tempPath, 'utf8');
      
      // Parsear el XML
      const parser = new xml2js.Parser({ explicitArray: false });
      const result = await parser.parseStringPromise(xmlData);
      
      // Extraer datos de documento
      let documentoData = {};
      let matrizadorEncontrado = null;
      let mensajeMatrizador = '';
      
      if (result.factura) {
        const infoFactura = result.factura.infoFactura;
        const infoTributaria = result.factura.infoTributaria;
        
        // Procesamiento de campos adicionales
        const camposAdicionales = {};
        if (result.factura.infoAdicional && result.factura.infoAdicional.campoAdicional) {
          const campos = Array.isArray(result.factura.infoAdicional.campoAdicional) ? 
            result.factura.infoAdicional.campoAdicional : [result.factura.infoAdicional.campoAdicional];
          
          campos.forEach(campo => {
            if (campo.$ && campo.$.nombre) {
              camposAdicionales[campo.$.nombre] = campo._;
            }
          });
        }
        
        // Extraer descripción de servicios
        let descripcionServicios = '';
        let tipoDocumentoInferido = 'Otro';
        
        if (result.factura.detalles && result.factura.detalles.detalle) {
          const detalles = Array.isArray(result.factura.detalles.detalle) ? 
            result.factura.detalles.detalle : [result.factura.detalles.detalle];
          
          // Intentar inferir el tipo de documento
          for (const detalle of detalles) {
            const desc = detalle.descripcion.toLowerCase();
            if (desc.includes('escritura')) tipoDocumentoInferido = 'Escritura';
            else if (desc.includes('donación')) tipoDocumentoInferido = 'Donación';
            else if (desc.includes('poder')) tipoDocumentoInferido = 'Poder';
            else if (desc.includes('testamento')) tipoDocumentoInferido = 'Testamento';
            else if (desc.includes('certificación')) tipoDocumentoInferido = 'Certificación';
            
            // Construir descripción completa
            descripcionServicios += `- ${detalle.descripcion}: ${detalle.cantidad} x $${detalle.precioUnitario}\n`;
          }
        }
        
        // Obtener nombre del matrizador
        const nombreMatrizador = camposAdicionales['Matrizador'] || '';
        
        // Buscar el matrizador en la base de datos por nombre
        if (nombreMatrizador) {
          matrizadorEncontrado = await Matrizador.findOne({
            where: {
              nombre: {
                [Op.iLike]: `%${nombreMatrizador}%`
              },
              rol: 'matrizador',
              activo: true
            }
          });
          
          if (matrizadorEncontrado) {
            mensajeMatrizador = `Se ha encontrado automáticamente al matrizador: ${matrizadorEncontrado.nombre}`;
          } else {
            mensajeMatrizador = `No se encontró al matrizador "${nombreMatrizador}" en el sistema. Por favor, seleccione uno manualmente.`;
          }
        }
        
        documentoData = {
          tipoDocumento: tipoDocumentoInferido,
          nombreCliente: infoFactura.razonSocialComprador || '',
          identificacionCliente: infoFactura.identificacionComprador || '',
          emailCliente: camposAdicionales['Email Cliente'] || '',
          telefonoCliente: camposAdicionales['CELULAR'] || camposAdicionales['TELÉFONO'] || '',
          valorFactura: infoFactura.importeTotal || 0,
          numeroFactura: `${infoTributaria.estab}-${infoTributaria.ptoEmi}-${infoTributaria.secuencial}`,
          fechaEmision: infoFactura.fechaEmision || '',
          numeroLibro: camposAdicionales['NÚMERO DE LIBRO'] || '',
          descripcionServicios: descripcionServicios,
          nombreMatrizador: nombreMatrizador,
          idMatrizador: matrizadorEncontrado ? matrizadorEncontrado.id : null
        };
      }
      
      // Eliminar el archivo temporal
      fs.unlinkSync(tempPath);
      
      // Obtener todos los matrizadores para la asignación
      const matrizadores = await Matrizador.findAll({
        where: {
          rol: 'matrizador',
          activo: true
        },
        attributes: ['id', 'nombre']
      });
      
      // Renderizar vista de confirmación
      res.render('caja/documentos/confirmar-xml', {
        layout: 'caja',
        title: 'Confirmar Datos XML',
        documento: documentoData,
        xmlFileName: xmlFileName,
        matrizadores,
        matrizadorEncontrado,
        mensajeMatrizador,
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre
      });
    } catch (error) {
      console.error('Error al procesar XML:', error);
      req.flash('error', 'Error al procesar el archivo XML: ' + error.message);
      return res.redirect('/caja/documentos/nuevo-xml');
    }
  },
  
  /**
   * Registra un nuevo documento a partir de datos XML
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  registrarDocumentoXML: async (req, res) => {
    try {
      // Iniciar transacción
      const transaction = await sequelize.transaction();
      
      try {
        const {
          tipoDocumento,
          nombreCliente,
          identificacionCliente,
          emailCliente,
          telefonoCliente,
          valorFactura,
          numeroFactura,
          idMatrizador,
          metodoPago,
          estadoPago,
          comparecientes,
          numeroLibro,
          fechaEmision
        } = req.body;
        
        // Validar campos obligatorios
        if (!tipoDocumento || !nombreCliente || !identificacionCliente) {
          await transaction.rollback();
          req.flash('error', 'Faltan campos obligatorios');
          return res.redirect('/caja/documentos/nuevo-xml');
        }
        
        // Validar que el matrizador existe si se proporcionó un ID
        if (idMatrizador) {
          const matrizador = await Matrizador.findByPk(idMatrizador);
          if (!matrizador) {
            await transaction.rollback();
            req.flash('error', 'El matrizador seleccionado no existe');
            return res.redirect('/caja/documentos/nuevo-xml');
          }
        }
        
        // Usar el número de libro como código de barras si está disponible
        let codigoBarras = numeroLibro || '';
        
        // Si no hay número de libro, generar un código de barras único
        if (!codigoBarras) {
          let codigoExiste = true;
          
          while (codigoExiste) {
            const timestamp = Date.now().toString().slice(-8);
            const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
            codigoBarras = `DOC${timestamp}${random}`;
            
            // Verificar que no exista ya
            const documentoExistente = await Documento.findOne({
              where: { codigoBarras },
              transaction
            });
            
            codigoExiste = !!documentoExistente;
          }
        }
        
        // Generar código de verificación para entrega
        const codigoVerificacion = Math.floor(1000 + Math.random() * 9000).toString();
        
        // Convertir fecha de emisión si está disponible
        let fechaFactura = null;
        if (fechaEmision) {
          // Convertir formato DD/MM/YYYY a Date
          const partesFecha = fechaEmision.split('/');
          if (partesFecha.length === 3) {
            fechaFactura = new Date(
              parseInt(partesFecha[2]), // año
              parseInt(partesFecha[1]) - 1, // mes (0-11)
              parseInt(partesFecha[0]) // día
            );
          }
        }
        
        // Si no se pudo convertir la fecha, usar la fecha actual
        if (!fechaFactura) {
          fechaFactura = new Date();
        }
        
        // Crear el documento
        const nuevoDocumento = await Documento.create({
          codigoBarras,
          tipoDocumento,
          nombreCliente,
          identificacionCliente,
          emailCliente,
          telefonoCliente,
          estado: 'en_proceso',
          codigoVerificacion,
          idMatrizador: idMatrizador || null,
          valorFactura: parseFloat(valorFactura) || null,
          numeroFactura: numeroFactura || null,
          fechaFactura: fechaFactura,
          estadoPago: estadoPago || 'pendiente',
          metodoPago: metodoPago || null,
          comparecientes: JSON.parse(comparecientes || '[]'),
          idUsuarioCreador: req.matrizador.id,
          rolUsuarioCreador: req.matrizador.rol
        }, { transaction });
        
        // Registrar evento de creación
        await EventoDocumento.create({
          idDocumento: nuevoDocumento.id,
          tipo: 'creacion',
          detalles: `Documento creado desde XML por ${req.matrizador.nombre}`,
          usuario: req.matrizador.nombre,
          metadatos: JSON.stringify({
            creadoPor: req.matrizador.id,
            metodoPago,
            estadoPago,
            valorFactura,
            numeroFactura,
            numeroLibro
          })
        }, { transaction });
        
        // Confirmar la transacción
        await transaction.commit();
        
        req.flash('success', 'Documento registrado correctamente');
        return res.redirect(`/caja/documentos/detalle/${nuevoDocumento.id}`);
      } catch (error) {
        // Revertir la transacción en caso de error
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      console.error('Error al registrar documento desde XML:', error);
      req.flash('error', 'Error al registrar documento: ' + error.message);
      return res.redirect('/caja/documentos/nuevo-xml');
    }
  },
  
  /**
   * Muestra la página principal de reportes con opciones de selección
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  reportes: async (req, res) => {
    try {
      // Renderizar la vista de selección de reportes
      res.render('caja/reportes/index', {
        layout: 'caja',
        title: 'Reportes de Caja',
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre
      });
    } catch (error) {
      console.error('Error al mostrar página de reportes:', error);
      return res.status(500).render('error', {
        layout: 'caja',
        title: 'Error',
        message: 'Error al cargar la página de reportes',
        error
      });
    }
  },
  
  /**
   * Genera y muestra el reporte de facturación
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  reporteFacturacion: async (req, res) => {
    try {
      // Procesar parámetros
      const fechaInicio = req.query.fechaInicio ? moment(req.query.fechaInicio).startOf('day') : moment().subtract(30, 'days').startOf('day');
      const fechaFin = req.query.fechaFin ? moment(req.query.fechaFin).endOf('day') : moment().endOf('day');
      const tipoAgrupacion = req.query.tipoAgrupacion || 'dia';
      
      // Formatear fechas para SQL
      const fechaInicioSQL = fechaInicio.format('YYYY-MM-DD HH:mm:ss');
      const fechaFinSQL = fechaFin.format('YYYY-MM-DD HH:mm:ss');
      
      // Preparar consulta SQL basada en el tipo de agrupación
      let groupByClause, dateFormat;
      
      switch (tipoAgrupacion) {
        case 'dia':
          groupByClause = "TO_CHAR(fecha_factura, 'YYYY-MM-DD')";
          dateFormat = 'YYYY-MM-DD';
          break;
        case 'semana':
          groupByClause = "TO_CHAR(fecha_factura, 'IYYY-IW')";
          dateFormat = "'Semana 'IW' de 'IYYY";
          break;
        case 'mes':
          groupByClause = "TO_CHAR(fecha_factura, 'YYYY-MM')";
          dateFormat = 'YYYY-MM';
          break;
        case 'anio':
          groupByClause = "TO_CHAR(fecha_factura, 'YYYY')";
          dateFormat = 'YYYY';
          break;
        case 'tipo_documento':
          groupByClause = "tipo_documento";
          dateFormat = null;
          break;
        default:
          groupByClause = "TO_CHAR(fecha_factura, 'YYYY-MM-DD')";
          dateFormat = 'YYYY-MM-DD';
      }
      
      // Ejecutar consulta para datos de facturación
      let datosFacturacion;
      
      if (tipoAgrupacion === 'tipo_documento') {
        datosFacturacion = await sequelize.query(`
          SELECT 
            tipo_documento as grupo,
            COUNT(*) as cantidad,
            COALESCE(SUM(valor_factura), 0) as total,
            COALESCE(AVG(valor_factura), 0) as promedio
          FROM documentos
          WHERE fecha_factura BETWEEN :fechaInicio AND :fechaFin
          GROUP BY tipo_documento
          ORDER BY total DESC
        `, {
          replacements: { fechaInicio: fechaInicioSQL, fechaFin: fechaFinSQL },
          type: sequelize.QueryTypes.SELECT
        });
      } else {
        datosFacturacion = await sequelize.query(`
          SELECT 
            ${groupByClause} as grupo,
            TO_CHAR(MIN(fecha_factura), '${dateFormat}') as fecha_formateada,
            COUNT(*) as cantidad,
            COALESCE(SUM(valor_factura), 0) as total,
            COALESCE(AVG(valor_factura), 0) as promedio
          FROM documentos
          WHERE fecha_factura BETWEEN :fechaInicio AND :fechaFin
          GROUP BY ${groupByClause}
          ORDER BY grupo
        `, {
          replacements: { fechaInicio: fechaInicioSQL, fechaFin: fechaFinSQL },
          type: sequelize.QueryTypes.SELECT
        });
      }
      
      // Calcular resumen general
      const resumen = datosFacturacion.reduce((acc, item) => {
        acc.cantidadTotal += parseInt(item.cantidad);
        acc.valorTotal += parseFloat(item.total);
        acc.promedioTotal += parseFloat(item.promedio) * parseInt(item.cantidad);
        return acc;
      }, { cantidadTotal: 0, valorTotal: 0, promedioTotal: 0 });
      
      if (resumen.cantidadTotal > 0) {
        resumen.promedioTotal = resumen.promedioTotal / resumen.cantidadTotal;
      } else {
        resumen.promedioTotal = 0;
      }
      
      // Obtener datos para gráfico
      const datosGrafico = {
        grupos: tipoAgrupacion === 'tipo_documento' ? 
          datosFacturacion.map(d => d.grupo) : 
          datosFacturacion.map(d => d.fecha_formateada || d.grupo),
        cantidades: datosFacturacion.map(d => parseInt(d.cantidad)),
        totales: datosFacturacion.map(d => parseFloat(d.total))
      };
      
      // Renderizar el reporte
      res.render('caja/reportes/facturacion', {
        layout: 'caja',
        title: 'Reporte de Facturación',
        fechaInicio: fechaInicio.format('YYYY-MM-DD'),
        fechaFin: fechaFin.format('YYYY-MM-DD'),
        tipoAgrupacion,
        datosFacturacion,
        resumen,
        datosGrafico,
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre
      });
    } catch (error) {
      console.error('Error al generar reporte de facturación:', error);
      return res.status(500).render('error', {
        layout: 'caja',
        title: 'Error',
        message: 'Error al generar el reporte de facturación',
        error
      });
    }
  },
  
  /**
   * Genera y muestra el reporte de pagos
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  reportePagos: async (req, res) => {
    try {
      // Procesar parámetros
      const fechaInicio = req.query.fechaInicio ? moment(req.query.fechaInicio).startOf('day') : moment().subtract(30, 'days').startOf('day');
      const fechaFin = req.query.fechaFin ? moment(req.query.fechaFin).endOf('day') : moment().endOf('day');
      const agruparPor = req.query.agruparPor || 'metodo_pago';
      
      // Formatear fechas para SQL
      const fechaInicioSQL = fechaInicio.format('YYYY-MM-DD HH:mm:ss');
      const fechaFinSQL = fechaFin.format('YYYY-MM-DD HH:mm:ss');
      
      // Obtener datos de pagos agrupados
      let datosPagos;
      
      if (agruparPor === 'metodo_pago') {
        datosPagos = await sequelize.query(`
          SELECT 
            metodo_pago as grupo,
            COUNT(*) as cantidad,
            COALESCE(SUM(valor_factura), 0) as total
          FROM documentos
          WHERE estado_pago = 'pagado'
          AND updated_at BETWEEN :fechaInicio AND :fechaFin
          GROUP BY metodo_pago
          ORDER BY total DESC
        `, {
          replacements: { fechaInicio: fechaInicioSQL, fechaFin: fechaFinSQL },
          type: sequelize.QueryTypes.SELECT
        });
      } else if (agruparPor === 'dia') {
        datosPagos = await sequelize.query(`
          SELECT 
            TO_CHAR(updated_at, 'YYYY-MM-DD') as grupo,
            COUNT(*) as cantidad,
            COALESCE(SUM(valor_factura), 0) as total
          FROM documentos
          WHERE estado_pago = 'pagado'
          AND updated_at BETWEEN :fechaInicio AND :fechaFin
          GROUP BY TO_CHAR(updated_at, 'YYYY-MM-DD')
          ORDER BY grupo
        `, {
          replacements: { fechaInicio: fechaInicioSQL, fechaFin: fechaFinSQL },
          type: sequelize.QueryTypes.SELECT
        });
      } else {
        datosPagos = await sequelize.query(`
          SELECT 
            TO_CHAR(updated_at, 'YYYY-MM') as grupo,
            COUNT(*) as cantidad,
            COALESCE(SUM(valor_factura), 0) as total
          FROM documentos
          WHERE estado_pago = 'pagado'
          AND updated_at BETWEEN :fechaInicio AND :fechaFin
          GROUP BY TO_CHAR(updated_at, 'YYYY-MM')
          ORDER BY grupo
        `, {
          replacements: { fechaInicio: fechaInicioSQL, fechaFin: fechaFinSQL },
          type: sequelize.QueryTypes.SELECT
        });
      }
      
      // Obtener totales generales
      const totalPagos = datosPagos.reduce((sum, item) => sum + parseFloat(item.total), 0);
      const totalDocumentos = datosPagos.reduce((sum, item) => sum + parseInt(item.cantidad), 0);
      
      // Calcular porcentajes para gráfico
      datosPagos.forEach(item => {
        item.porcentaje = totalPagos > 0 ? (parseFloat(item.total) / totalPagos * 100).toFixed(2) : "0.00";
      });
      
      // Datos para gráfico
      const datosGrafico = {
        grupos: datosPagos.map(d => d.grupo),
        cantidades: datosPagos.map(d => parseInt(d.cantidad)),
        totales: datosPagos.map(d => parseFloat(d.total)),
        porcentajes: datosPagos.map(d => parseFloat(d.porcentaje))
      };
      
      // Renderizar el reporte
      res.render('caja/reportes/pagos', {
        layout: 'caja',
        title: 'Reporte de Pagos',
        fechaInicio: fechaInicio.format('YYYY-MM-DD'),
        fechaFin: fechaFin.format('YYYY-MM-DD'),
        agruparPor,
        datosPagos,
        totalPagos,
        totalDocumentos,
        datosGrafico,
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre
      });
    } catch (error) {
      console.error('Error al generar reporte de pagos:', error);
      return res.status(500).render('error', {
        layout: 'caja',
        title: 'Error',
        message: 'Error al generar el reporte de pagos',
        error
      });
    }
  },
  
  /**
   * Genera y muestra el reporte de productividad por matrizador
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  reporteMatrizadores: async (req, res) => {
    try {
      // Procesar parámetros
      const fechaInicio = req.query.fechaInicio ? moment(req.query.fechaInicio).startOf('day') : moment().subtract(30, 'days').startOf('day');
      const fechaFin = req.query.fechaFin ? moment(req.query.fechaFin).endOf('day') : moment().endOf('day');
      
      // Formatear fechas para SQL
      const fechaInicioSQL = fechaInicio.format('YYYY-MM-DD HH:mm:ss');
      const fechaFinSQL = fechaFin.format('YYYY-MM-DD HH:mm:ss');
      
      // Obtener datos por matrizador
      const datosMatrizadores = await sequelize.query(`
        SELECT 
          m.id,
          m.nombre,
          COUNT(d.id) as documentos_totales,
          SUM(CASE WHEN d.estado_pago = 'pagado' THEN 1 ELSE 0 END) as documentos_pagados,
          SUM(CASE WHEN d.estado_pago = 'pendiente' THEN 1 ELSE 0 END) as documentos_pendientes,
          COALESCE(SUM(d.valor_factura), 0) as facturacion_total,
          COALESCE(SUM(CASE WHEN d.estado_pago = 'pagado' THEN d.valor_factura ELSE 0 END), 0) as ingresos_cobrados
        FROM matrizadores m
        LEFT JOIN documentos d ON m.id = d.id_matrizador
          AND d.fecha_factura BETWEEN :fechaInicio AND :fechaFin
        WHERE m.rol = 'matrizador'
        GROUP BY m.id, m.nombre
        ORDER BY facturacion_total DESC
      `, {
        replacements: { fechaInicio: fechaInicioSQL, fechaFin: fechaFinSQL },
        type: sequelize.QueryTypes.SELECT
      });
      
      // Calcular porcentajes y tamaño promedio de factura
      datosMatrizadores.forEach(item => {
        item.porcentaje_pagados = item.documentos_totales > 0 ? 
          (item.documentos_pagados / item.documentos_totales * 100).toFixed(2) : 0;
        
        item.factura_promedio = item.documentos_totales > 0 ? 
          (item.facturacion_total / item.documentos_totales).toFixed(2) : 0;
          
        item.pendiente_cobro = (item.facturacion_total - item.ingresos_cobrados).toFixed(2);
      });
      
      // Calcular totales generales
      const totales = {
        documentos_totales: datosMatrizadores.reduce((sum, item) => sum + parseInt(item.documentos_totales || 0), 0),
        documentos_pagados: datosMatrizadores.reduce((sum, item) => sum + parseInt(item.documentos_pagados || 0), 0),
        documentos_pendientes: datosMatrizadores.reduce((sum, item) => sum + parseInt(item.documentos_pendientes || 0), 0),
        facturacion_total: datosMatrizadores.reduce((sum, item) => sum + parseFloat(item.facturacion_total || 0), 0),
        ingresos_cobrados: datosMatrizadores.reduce((sum, item) => sum + parseFloat(item.ingresos_cobrados || 0), 0),
        pendiente_cobro: datosMatrizadores.reduce((sum, item) => sum + parseFloat(item.pendiente_cobro || 0), 0)
      };
      
      // Calcular porcentaje global de pagados
      totales.porcentaje_pagados = totales.documentos_totales > 0 ? 
        (totales.documentos_pagados / totales.documentos_totales * 100).toFixed(2) : "0.00";
      
      // Datos para gráfico
      const datosGrafico = {
        nombres: datosMatrizadores.map(d => d.nombre),
        documentos: datosMatrizadores.map(d => parseInt(d.documentos_totales)),
        facturacion: datosMatrizadores.map(d => parseFloat(d.facturacion_total)),
        pagados: datosMatrizadores.map(d => parseInt(d.documentos_pagados)),
        pendientes: datosMatrizadores.map(d => parseInt(d.documentos_pendientes))
      };
      
      // Renderizar el reporte
      res.render('caja/reportes/matrizadores', {
        layout: 'caja',
        title: 'Reporte de Matrizadores',
        fechaInicio: fechaInicio.format('YYYY-MM-DD'),
        fechaFin: fechaFin.format('YYYY-MM-DD'),
        datosMatrizadores,
        totales,
        datosGrafico,
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre
      });
    } catch (error) {
      console.error('Error al generar reporte de matrizadores:', error);
      return res.status(500).render('error', {
        layout: 'caja',
        title: 'Error',
        message: 'Error al generar el reporte de matrizadores',
        error
      });
    }
  },
  
  /**
   * Muestra el formulario para registrar un nuevo documento en caja
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  mostrarFormularioRegistro: async (req, res) => {
    try {
      // Obtener lista de matrizadores para el formulario
      const matrizadores = await Matrizador.findAll({
        where: {
          rol: 'matrizador',
          activo: true
        },
        order: [['nombre', 'ASC']]
      });
      
      // Obtener posibles clientes para mostrar documentos existentes
      const clientes = await Documento.findAll({
        attributes: ['nombreCliente', 'identificacionCliente'],
        group: ['nombreCliente', 'identificacionCliente'],
        raw: true
      });
      
      // Renderizar la vista
      res.render('caja/documentos/registro', {
        layout: 'caja',
        title: 'Registro de Documento',
        activeRegistro: true,
        matrizadores,
        clientes,
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre
      });
    } catch (error) {
      console.error('Error al mostrar formulario de registro:', error);
      return res.status(500).render('error', {
        layout: 'caja',
        title: 'Error',
        message: 'Error al cargar el formulario de registro',
        error
      });
    }
  },
  
  /**
   * Procesa el registro de un nuevo documento desde caja
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  registrarDocumento: async (req, res) => {
    // Iniciar transacción
    const transaction = await sequelize.transaction();
    
    try {
      const {
        codigoBarras,
        tipoDocumento,
        nombreCliente,
        identificacionCliente,
        emailCliente,
        telefonoCliente,
        notas,
        idMatrizador,
        comparecientes,
        // Campos específicos de facturación
        numeroFactura,
        valorFactura,
        fechaFactura,
        estadoPago,
        metodoPago,
        omitirNotificacion
      } = req.body;
      
      // Validaciones básicas
      if (!tipoDocumento || !nombreCliente || !identificacionCliente) {
        await transaction.rollback();
        req.flash('error', 'Los campos Tipo de Documento, Nombre del Cliente e Identificación son obligatorios');
        return res.redirect('/caja/documentos/registro');
      }
      
      // Generar código de verificación para entrega
      const codigoVerificacion = Math.floor(1000 + Math.random() * 9000).toString();
      
      // Crear el documento con el mapeo de metodoPago
      const nuevoDocumento = await Documento.create({
        codigoBarras,
        tipoDocumento,
        nombreCliente,
        identificacionCliente,
        emailCliente,
        telefonoCliente,
        notas,
        estado: 'en_proceso',
        codigoVerificacion,
        idMatrizador: idMatrizador || null,
        comparecientes: JSON.parse(comparecientes || '[]'),
        // Campos de facturación
        numeroFactura: numeroFactura || null,
        valorFactura: valorFactura ? parseFloat(valorFactura) : null,
        fechaFactura: fechaFactura ? new Date(fechaFactura) : null,
        estadoPago: estadoPago || 'pendiente',
        metodoPago: mapearMetodoPago(metodoPago),
        omitirNotificacion: omitirNotificacion === 'on',
        idUsuarioCreador: req.matrizador.id,
        rolUsuarioCreador: req.matrizador.rol
      }, { transaction });
      
      // Registrar evento de creación
      await EventoDocumento.create({
        idDocumento: nuevoDocumento.id,
        tipo: 'creacion',
        detalles: `Documento creado por ${req.matrizador.nombre} (Caja)`,
        usuario: req.matrizador.nombre,
        metadatos: JSON.stringify({
          creadoPor: req.matrizador.id,
          metodoPago,
          estadoPago,
          valorFactura,
          numeroFactura
        })
      }, { transaction });
      
      // Confirmar la transacción
      await transaction.commit();
      
      req.flash('success', `Documento ${tipoDocumento} registrado exitosamente con código ${codigoBarras}`);
      return res.redirect('/caja/documentos');
    } catch (error) {
      // Revertir la transacción en caso de error
      await transaction.rollback();
      console.error('Error al registrar documento:', error);
      
      let errorMessage = error.message;
      if (error.name === 'SequelizeUniqueConstraintError') {
        errorMessage = 'Ya existe un documento con ese código de barras';
      }
      
      req.flash('error', 'Error al registrar el documento: ' + errorMessage);
      return res.redirect('/caja/documentos/registro');
    }
  },
  
  /**
   * Muestra el formulario para entrega de documentos desde caja
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  mostrarFormularioEntrega: async (req, res) => {
    try {
      res.render('caja/documentos/entrega', {
        layout: 'caja',
        title: 'Entrega de Documentos',
        activeEntrega: true,
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre
      });
    } catch (error) {
      console.error('Error al mostrar formulario de entrega:', error);
      return res.status(500).render('error', {
        layout: 'caja',
        title: 'Error',
        message: 'Error al cargar el formulario de entrega',
        error
      });
    }
  },
  
  /**
   * Procesa la entrega de un documento
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  entregarDocumento: async (req, res) => {
    // Iniciar transacción
    const transaction = await sequelize.transaction();
    
    try {
      const { codigoBarras, codigoVerificacion, nombreRecibe, identificacionRecibe } = req.body;
      
      // Validaciones básicas
      if (!codigoBarras || !codigoVerificacion) {
        await transaction.rollback();
        req.flash('error', 'Debe ingresar el código de barras y el código de verificación');
        return res.redirect('/caja/documentos/entrega');
      }
      
      // Buscar el documento
      const documento = await Documento.findOne({
        where: {
          codigoBarras,
          codigoVerificacion
        },
        transaction
      });
      
      if (!documento) {
        await transaction.rollback();
        req.flash('error', 'No se encontró un documento con los códigos ingresados');
        return res.redirect('/caja/documentos/entrega');
      }
      
      // Verificar que el documento esté listo para entrega
      if (documento.estado !== 'listo_para_entrega') {
        await transaction.rollback();
        req.flash('error', 'El documento no está listo para ser entregado');
        return res.redirect('/caja/documentos/entrega');
      }
      
      // Actualizar el estado del documento
      await documento.update({
        estado: 'entregado',
        fechaEntrega: new Date(),
        nombreRecibe: nombreRecibe || null,
        identificacionRecibe: identificacionRecibe || null
      }, { transaction });
      
      // Registrar evento de entrega
      await EventoDocumento.create({
        idDocumento: documento.id,
        tipo: 'entrega',
        detalles: `Documento entregado por ${req.matrizador.nombre} (Caja)`,
        usuario: req.matrizador.nombre,
        metadatos: JSON.stringify({
          entregadoPor: req.matrizador.id,
          nombreRecibe,
          identificacionRecibe
        })
      }, { transaction });
      
      // Confirmar la transacción
      await transaction.commit();
      
      req.flash('success', `Documento ${codigoBarras} entregado exitosamente`);
      return res.redirect('/caja/documentos/entrega');
    } catch (error) {
      // Revertir la transacción en caso de error
      await transaction.rollback();
      console.error('Error al entregar documento:', error);
      
      req.flash('error', 'Error al entregar el documento: ' + error.message);
      return res.redirect('/caja/documentos/entrega');
    }
  }
};

// Agregar una función de mapeo para método de pago en la parte superior del controlador después de las importaciones
/**
 * Mapea los valores del formulario a los valores del enum de la base de datos
 * @param {string} metodoFormulario - Valor del método de pago desde el formulario
 * @returns {string} - Valor compatible con la base de datos
 */
const mapearMetodoPago = (metodoFormulario) => {
  const mapeo = {
    'pendiente': null,
    'tarjeta_credito': 'tarjeta',
    'tarjeta_debito': 'tarjeta'
  };
  
  return mapeo[metodoFormulario] !== undefined ? mapeo[metodoFormulario] : metodoFormulario;
};

/**
 * Mapea los valores de la base de datos a los valores para el formulario
 * @param {string} metodoDB - Valor del método de pago desde la base de datos
 * @returns {string} - Valor para mostrar en el formulario
 */
const mapearMetodoPagoInverso = (metodoDB) => {
  if (metodoDB === null) return 'pendiente';
  return metodoDB;
};

module.exports = cajaController; 