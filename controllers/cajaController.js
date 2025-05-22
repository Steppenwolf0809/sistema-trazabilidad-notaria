/**
 * Controlador para gestionar operaciones de caja
 * Contiene funciones para registrar pagos, facturación, y reportes
 */

const { sequelize } = require('../config/database');
const Documento = require('../models/Documento');
const Matrizador = require('../models/Matrizador');
const EventoDocumento = require('../models/EventoDocumento');
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');
const util = require('util');
const xml2js = require('xml2js');
const moment = require('moment');
const { 
  inferirTipoDocumentoPorCodigo, 
  procesarFechaFactura, 
  formatearValorMonetario,
  mapearMetodoPago,
  mapearMetodoPagoInverso 
} = require('../utils/documentoUtils');

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
      
      // Dinero Facturado: Suma de todos los documentos con monto definido, excluyendo anulados/cancelados
      const [totalFacturadoResult] = await sequelize.query(`
        SELECT COALESCE(SUM(valor_factura), 0) as total
        FROM documentos
        WHERE valor_factura IS NOT NULL
          AND estado != 'cancelado'  -- Excluir cancelados
          AND fecha_factura BETWEEN :fechaInicio AND :fechaFin
      `, {
        replacements: { 
          fechaInicio: fechaInicioSQL,
          fechaFin: fechaFinSQL
        },
        type: sequelize.QueryTypes.SELECT
      });
      const totalFacturado = parseFloat(totalFacturadoResult.total);

      // Dinero Cobrado/Recaudado: Solo documentos marcados como "pagado", excluyendo anulados/cancelados
      const [totalCobradoResult] = await sequelize.query(`
        SELECT COALESCE(SUM(valor_factura), 0) as total
        FROM documentos
        WHERE estado_pago = 'pagado'
          AND estado != 'cancelado'  -- Excluir cancelados
          AND fecha_factura BETWEEN :fechaInicio AND :fechaFin -- Opcional: considerar si el cobro puede ser fuera del periodo de facturación
      `, {
        replacements: { 
          fechaInicio: fechaInicioSQL,
          fechaFin: fechaFinSQL
        },
        type: sequelize.QueryTypes.SELECT
      });
      const totalCobrado = parseFloat(totalCobradoResult.total);

      // Dinero Pendiente: Documentos no pagados que no estén anulados/cancelados
      // Se puede calcular como Total Facturado - Total Cobrado, o con una consulta directa:
      const [totalPendienteResult] = await sequelize.query(`
        SELECT COALESCE(SUM(valor_factura), 0) as total
        FROM documentos
        WHERE estado_pago = 'pendiente'
          AND estado != 'cancelado' -- Excluir cancelados
          AND valor_factura IS NOT NULL
          AND fecha_factura BETWEEN :fechaInicio AND :fechaFin
      `, {
        replacements: {
          fechaInicio: fechaInicioSQL,
          fechaFin: fechaFinSQL
        },
        type: sequelize.QueryTypes.SELECT
      });
      const totalPendiente = parseFloat(totalPendienteResult.total);
      
      // Obtener cantidad de documentos facturados (que no estén cancelados)
      const [documentosFacturadosResult] = await sequelize.query(`
        SELECT COUNT(*) as total
        FROM documentos
        WHERE numero_factura IS NOT NULL
          AND estado != 'cancelado' -- Excluir cancelados
          AND fecha_factura BETWEEN :fechaInicio AND :fechaFin
      `, {
        replacements: { 
          fechaInicio: fechaInicioSQL,
          fechaFin: fechaFinSQL
        },
        type: sequelize.QueryTypes.SELECT
      });
      const documentosFacturados = parseInt(documentosFacturadosResult.total);
      
      // Obtener cantidad de documentos pendientes de pago (que no estén cancelados)
      const [documentosPendientesPagoResult] = await sequelize.query(`
        SELECT COUNT(*) as total
        FROM documentos
        WHERE estado_pago = 'pendiente'
          AND numero_factura IS NOT NULL
          AND estado != 'cancelado' -- Excluir cancelados
          AND fecha_factura BETWEEN :fechaInicio AND :fechaFin 
      `, {
        replacements: {
            fechaInicio: fechaInicioSQL,
            fechaFin: fechaFinSQL
        },
        type: sequelize.QueryTypes.SELECT
      });
      const documentosPendientesPago = parseInt(documentosPendientesPagoResult.total);

      // Documentos pendientes de pago para la lista (que no estén cancelados)
      const documentosPendientesLista = await Documento.findAll({
        where: {
          estadoPago: 'pendiente',
          numeroFactura: { [Op.not]: null },
          estado: { [Op.ne]: 'cancelado' } // Excluir cancelados
        },
        order: [['fechaFactura', 'ASC']],
        limit: 10
      });
      
      // Documentos pagados recientemente (que no estén cancelados)
      const documentosPagadosRecientesLista = await Documento.findAll({
        where: {
          estadoPago: 'pagado',
          numeroFactura: { [Op.not]: null },
          estado: { [Op.ne]: 'cancelado' } // Excluir cancelados
          // Considerar si se filtra por fecha de pago si existiera ese campo, o fecha_factura/updated_at
        },
        order: [['updated_at', 'DESC']], // O por fecha de pago si existe
        limit: 10
      });
      
      // Obtener estadísticas por tipo de documento (excluyendo cancelados)
      const estadisticasPorTipo = await sequelize.query(`
        SELECT 
          tipo_documento, 
          COUNT(*) as cantidad, 
          COALESCE(SUM(CASE WHEN estado_pago = 'pagado' THEN valor_factura ELSE 0 END), 0) as total_cobrado,
          COALESCE(SUM(valor_factura), 0) as total_facturado,
          CASE 
            WHEN COUNT(*) > 0 THEN COALESCE(AVG(valor_factura), 0)
            ELSE 0
          END as promedio_facturado
        FROM documentos
        WHERE estado != 'cancelado' -- Excluir cancelados
          AND fecha_factura BETWEEN :fechaInicio AND :fechaFin
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
          totalFacturado: formatearValorMonetario(totalFacturado),
          totalCobrado: formatearValorMonetario(totalCobrado),
          totalPendiente: formatearValorMonetario(totalPendiente),
          documentosFacturados: documentosFacturados,
          documentosPendientesPago: documentosPendientesPago // Cantidad de docs pendientes
        },
        documentosPendientes: documentosPendientesLista, // Lista para la tabla
        documentosPagadosRecientes: documentosPagadosRecientesLista, // Lista para la tabla
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
      const fechaDesde = req.query.fechaDesde || ''; // Nuevo
      const fechaHasta = req.query.fechaHasta || ''; // Nuevo
      
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
      
      // Filtro de rango de fechas
      if (fechaDesde && fechaHasta) {
        where.fechaFactura = {
          [Op.between]: [moment(fechaDesde).startOf('day').toDate(), moment(fechaHasta).endOf('day').toDate()]
        };
      } else if (fechaDesde) {
        where.fechaFactura = {
          [Op.gte]: moment(fechaDesde).startOf('day').toDate()
        };
      } else if (fechaHasta) {
        where.fechaFactura = {
          [Op.lte]: moment(fechaHasta).endOf('day').toDate()
        };
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
      if (fechaDesde) queryParams.append('fechaDesde', fechaDesde); // Nuevo
      if (fechaHasta) queryParams.append('fechaHasta', fechaHasta); // Nuevo
      
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
      if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('html') === -1 && req.headers['x-requested-with'] == 'XMLHttpRequest')) {
        // Si es una solicitud AJAX, renderizar solo el partial de la tabla
        res.render('partials/caja/tablaDocumentosPaginada', {
          layout: false, 
          documentos,
          matrizadores, 
          tiposDocumento,
          pagination,
          filtros: {
            estado: estado || '',
            estadoPago: estadoPago || '',
            tipoDocumento: tipoDocumento || '',
            matrizadorId: matrizadorId || '',
            busqueda: busqueda || '',
            fechaDesde: fechaDesde || '',
            fechaHasta: fechaHasta || ''
          },
          userRole: req.matrizador?.rol, 
          userName: req.matrizador?.nombre
        });
      } else {
        // Si es una solicitud normal, renderizar la página completa
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
            busqueda: busqueda || '',
            fechaDesde: fechaDesde || '',
            fechaHasta: fechaHasta || ''
          },
          userRole: req.matrizador?.rol,
          userName: req.matrizador?.nombre
        });
      }
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
        
        // Intentar extraer tipo de documento del número de libro
        const numeroLibro = camposAdicionales['NÚMERO DE LIBRO'] || '';
        if (numeroLibro) {
          tipoDocumentoInferido = inferirTipoDocumentoPorCodigo(numeroLibro);
        }
        
        if (result.factura.detalles && result.factura.detalles.detalle) {
          const detalles = Array.isArray(result.factura.detalles.detalle) ? 
            result.factura.detalles.detalle : [result.factura.detalles.detalle];
          
          // Si no se pudo inferir por código, intentar por descripción
          if (tipoDocumentoInferido === 'Otro') {
            for (const detalle of detalles) {
              const desc = detalle.descripcion.toLowerCase();
              if (desc.includes('escritura')) tipoDocumentoInferido = 'Escritura';
              else if (desc.includes('donación')) tipoDocumentoInferido = 'Donación';
              else if (desc.includes('poder')) tipoDocumentoInferido = 'Poder';
              else if (desc.includes('testamento')) tipoDocumentoInferido = 'Testamento';
              else if (desc.includes('certificación')) tipoDocumentoInferido = 'Certificación';
              else if (desc.includes('protocolo')) tipoDocumentoInferido = 'Protocolo';
              else if (desc.includes('diligencia')) tipoDocumentoInferido = 'Diligencia';
              else if (desc.includes('arrendamiento')) tipoDocumentoInferido = 'Arrendamiento';
              
              if (tipoDocumentoInferido !== 'Otro') break;
            }
          }
          
          // Construir descripción completa
          for (const detalle of detalles) {
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
        
        // Convertir fecha de emisión del XML para usar como fecha de factura
        let fechaFactura = null;
        if (fechaEmision) {
          // Convertir formato DD/MM/YYYY a Date con hora 00:00:00
          const partesFecha = fechaEmision.split('/');
          if (partesFecha.length === 3) {
            fechaFactura = new Date(
              parseInt(partesFecha[2]), // año
              parseInt(partesFecha[1]) - 1, // mes (0-11)
              parseInt(partesFecha[0]), // día
              0, 0, 0, 0 // hora 00:00:00
            );
          }
        }
        
        // Si no se pudo convertir la fecha del XML, usar la fecha actual como fallback
        if (!fechaFactura || isNaN(fechaFactura.getTime())) {
          console.log('Fecha del XML no válida, usando fecha actual como fallback para fecha de factura');
          fechaFactura = new Date();
          fechaFactura.setHours(0, 0, 0, 0); // Asegurar que esté a medianoche
        } else {
          console.log(`Usando fecha del XML: ${fechaEmision} convertida a: ${fechaFactura}`);
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
      // Obtener matrizadores para los filtros
      const matrizadores = await Matrizador.findAll({
        where: {
          rol: 'matrizador',
          activo: true
        },
        attributes: ['id', 'nombre'],
        order: [['nombre', 'ASC']]
      });
      
      // Determinar el reporte activo (si lo hay)
      const reporteActivo = '';
      
      // Renderizar la vista principal de reportes
      res.render('caja/reportes/index', {
        layout: 'caja',
        title: 'Reportes y Estadísticas',
        activeReportes: true,
        matrizadores,
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre,
        reporteActivo,
        formAction: '/caja/reportes'
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
   * Genera y muestra el reporte financiero
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  reporteFinanciero: async (req, res) => {
    try {
      // Procesar parámetros de filtrado
      const rango = req.query.rango || 'mes';
      const idMatrizador = req.query.idMatrizador; // Leer el idMatrizador del query
      let fechaInicio, fechaFin, periodoTexto;
      
      // Establecer fechas según el rango seleccionado
      const hoy = moment().startOf('day');
      
      switch (rango) {
        case 'hoy':
          fechaInicio = hoy.clone();
          fechaFin = moment().endOf('day');
          periodoTexto = 'Hoy ' + fechaInicio.format('DD/MM/YYYY');
          break;
        case 'ayer':
          fechaInicio = hoy.clone().subtract(1, 'days');
          fechaFin = hoy.clone().subtract(1, 'days').endOf('day');
          periodoTexto = 'Ayer ' + fechaInicio.format('DD/MM/YYYY');
          break;
        case 'semana':
          fechaInicio = hoy.clone().startOf('week');
          fechaFin = moment().endOf('day');
          periodoTexto = 'Esta semana (desde ' + fechaInicio.format('DD/MM/YYYY') + ')';
          break;
        case 'mes':
          fechaInicio = hoy.clone().startOf('month');
          fechaFin = moment().endOf('day');
          periodoTexto = 'Este mes (desde ' + fechaInicio.format('DD/MM/YYYY') + ')';
          break;
        case 'ultimo_mes':
          fechaInicio = hoy.clone().subtract(30, 'days');
          fechaFin = moment().endOf('day');
          periodoTexto = 'Últimos 30 días';
          break;
        case 'personalizado':
          fechaInicio = req.query.fechaInicio ? moment(req.query.fechaInicio).startOf('day') : hoy.clone().startOf('month');
          fechaFin = req.query.fechaFin ? moment(req.query.fechaFin).endOf('day') : moment().endOf('day');
          periodoTexto = 'Del ' + fechaInicio.format('DD/MM/YYYY') + ' al ' + fechaFin.format('DD/MM/YYYY');
          break;
        default:
          fechaInicio = hoy.clone().startOf('month');
          fechaFin = moment().endOf('day');
          periodoTexto = 'Este mes (desde ' + fechaInicio.format('DD/MM/YYYY') + ')';
      }
      
      // Formatear fechas para consultas SQL
      const fechaInicioSQL = fechaInicio.format('YYYY-MM-DD HH:mm:ss');
      const fechaFinSQL = fechaFin.format('YYYY-MM-DD HH:mm:ss');
      
      // Obtener estadísticas financieras generales usando Sequelize ORM
      const whereClause = {
        valor_factura: { [Op.not]: null },
        estado: { [Op.ne]: 'cancelado' },
        created_at: {
          [Op.between]: [fechaInicioSQL, fechaFinSQL]
        }
      };
      
      // Añadir filtro por matrizador si se seleccionó uno
      if (idMatrizador && idMatrizador !== 'todos' && idMatrizador !== '') {
        whereClause.id_matrizador = parseInt(idMatrizador, 10);
      }
      
      const totalFacturado = await Documento.sum('valor_factura', {
        where: whereClause
      }) || 0;
      
      const totalCobrado = await Documento.sum('valor_factura', {
        where: {
          ...whereClause,
          estado_pago: 'pagado'
        }
      }) || 0;
      
      const totalPendiente = totalFacturado - totalCobrado;
      
      // Calcular porcentaje de recuperación
      const porcentajeRecuperacion = totalFacturado > 0 ? 
        Math.round((totalCobrado / totalFacturado) * 100) : 0;
      
      // Obtener datos diarios para el gráfico y tabla
      const documentosPorDia = await Documento.findAll({
        where: whereClause,
        attributes: [
          [sequelize.fn('DATE', sequelize.col('created_at')), 'fecha'],
          [sequelize.fn('SUM', sequelize.col('valor_factura')), 'totalFacturado'],
          [sequelize.fn('SUM', 
            sequelize.literal("CASE WHEN estado_pago = 'pagado' THEN valor_factura ELSE 0 END")
          ), 'totalCobrado']
        ],
        group: [sequelize.fn('DATE', sequelize.col('created_at'))],
        order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'ASC']],
        raw: true
      });
      
      // Preparar datos para la tabla
      const datosTabla = documentosPorDia.map(item => {
        const facturado = parseFloat(item.totalFacturado) || 0;
        const cobrado = parseFloat(item.totalCobrado) || 0;
        const pendiente = facturado - cobrado;
        const porcentaje = facturado > 0 ? Math.round((cobrado / facturado) * 100) : 0;
        
        return {
          fecha: moment(item.fecha).format('DD/MM/YYYY'),
          facturado: facturado.toFixed(2),
          cobrado: cobrado.toFixed(2),
          pendiente: pendiente.toFixed(2),
          porcentaje: porcentaje
        };
      });
      
      // Preparar datos para el gráfico de tendencia
      const graficoTendencia = {
        fechas: documentosPorDia.map(item => moment(item.fecha).format('DD/MM/YYYY')),
        facturado: documentosPorDia.map(item => parseFloat(item.totalFacturado) || 0),
        cobrado: documentosPorDia.map(item => parseFloat(item.totalCobrado) || 0),
        pendiente: documentosPorDia.map(item => 
          (parseFloat(item.totalFacturado) || 0) - (parseFloat(item.totalCobrado) || 0)
        )
      };
      
      // Obtener todos los matrizadores para el dropdown
      const matrizadores = await Matrizador.findAll({
        attributes: ['id', 'nombre'],
        where: { activo: true, rol: 'matrizador' }, // Opcional: filtrar por rol si es necesario
        order: [['nombre', 'ASC']],
        raw: true
      });
      
      // Renderizar la vista con los datos
      res.render('caja/reportes/financiero', {
        layout: 'caja',
        title: 'Reporte Financiero',
        activeReportes: true,
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre,
        matrizadores, // Pasar lista de matrizadores
        idMatrizadorSeleccionado: idMatrizador || 'todos', // Pasar ID seleccionado
        stats: {
          totalFacturado: formatearValorMonetario(totalFacturado), // Corregido
          totalCobrado: formatearValorMonetario(totalCobrado),   // Corregido
          totalPendiente: formatearValorMonetario(totalPendiente), // Corregido
          porcentajeRecuperacion: porcentajeRecuperacion
        },
        datosTabla,
        graficoTendencia,
        periodoTexto,
        filtros: {
          rango,
          fechaInicio: fechaInicio.format('YYYY-MM-DD'),
          fechaFin: fechaFin.format('YYYY-MM-DD')
        }
      });
    } catch (error) {
      console.error('Error al generar reporte financiero:', error);
      return res.status(500).render('error', {
        layout: 'caja',
        title: 'Error',
        message: 'Error al generar el reporte financiero',
        error
      });
    }
  },
  
  /**
   * Genera y muestra el reporte de documentos
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  reporteDocumentos: async (req, res) => {
    try {
      // Procesar parámetros de filtrado
      const rango = req.query.rango || 'mes';
      let fechaInicio, fechaFin, periodoTexto;
      
      // Establecer fechas según el rango seleccionado
      const hoy = moment().startOf('day');
      
      switch (rango) {
        case 'hoy':
          fechaInicio = hoy.clone();
          fechaFin = moment().endOf('day');
          periodoTexto = 'Hoy ' + fechaInicio.format('DD/MM/YYYY');
          break;
        case 'ayer':
          fechaInicio = hoy.clone().subtract(1, 'days');
          fechaFin = hoy.clone().subtract(1, 'days').endOf('day');
          periodoTexto = 'Ayer ' + fechaInicio.format('DD/MM/YYYY');
          break;
        case 'semana':
          fechaInicio = hoy.clone().startOf('week');
          fechaFin = moment().endOf('day');
          periodoTexto = 'Esta semana (desde ' + fechaInicio.format('DD/MM/YYYY') + ')';
          break;
        case 'mes':
          fechaInicio = hoy.clone().startOf('month');
          fechaFin = moment().endOf('day');
          periodoTexto = 'Este mes (desde ' + fechaInicio.format('DD/MM/YYYY') + ')';
          break;
        case 'ultimo_mes':
          fechaInicio = hoy.clone().subtract(30, 'days');
          fechaFin = moment().endOf('day');
          periodoTexto = 'Últimos 30 días';
          break;
        case 'personalizado':
          fechaInicio = req.query.fechaInicio ? moment(req.query.fechaInicio).startOf('day') : hoy.clone().startOf('month');
          fechaFin = req.query.fechaFin ? moment(req.query.fechaFin).endOf('day') : moment().endOf('day');
          periodoTexto = 'Del ' + fechaInicio.format('DD/MM/YYYY') + ' al ' + fechaFin.format('DD/MM/YYYY');
          break;
        default:
          fechaInicio = hoy.clone().startOf('month');
          fechaFin = moment().endOf('day');
          periodoTexto = 'Este mes (desde ' + fechaInicio.format('DD/MM/YYYY') + ')';
      }
      
      // Formatear fechas para consultas SQL
      const fechaInicioSQL = fechaInicio.format('YYYY-MM-DD HH:mm:ss');
      const fechaFinSQL = fechaFin.format('YYYY-MM-DD HH:mm:ss');
      
      // Obtener estadísticas de documentos
      const [statsResult] = await sequelize.query(`
        SELECT 
          COUNT(*) as total_documentos,
          COUNT(CASE WHEN numero_factura IS NOT NULL THEN 1 END) as con_factura,
          COUNT(CASE WHEN estado_pago = 'pendiente' THEN 1 END) as pendientes,
          COUNT(CASE WHEN estado_pago = 'pagado' THEN 1 END) as pagados,
          COALESCE(SUM(valor_factura), 0) as total_facturado,
          CASE 
            WHEN COUNT(*) > 0 THEN COALESCE(AVG(valor_factura), 0)
            ELSE 0
          END as promedio_facturado
        FROM documentos
        WHERE fecha_factura BETWEEN :fechaInicio AND :fechaFin
          AND estado != 'cancelado'
      `, {
        replacements: { fechaInicio: fechaInicioSQL, fechaFin: fechaFinSQL },
        type: sequelize.QueryTypes.SELECT
      });
      
      // Obtener estadísticas por tipo de documento
      const estadisticasPorTipo = await sequelize.query(`
        SELECT 
          tipo_documento as "tipoDocumento", 
          COUNT(*) as cantidad, 
          COALESCE(SUM(valor_factura), 0) as "totalFacturado",
          CASE 
            WHEN COUNT(*) > 0 THEN COALESCE(AVG(valor_factura), 0)
            ELSE 0
          END as promedio
        FROM documentos
        WHERE fecha_factura BETWEEN :fechaInicio AND :fechaFin
          AND estado != 'cancelado'
        GROUP BY tipo_documento
        ORDER BY cantidad DESC
      `, {
        replacements: { fechaInicio: fechaInicioSQL, fechaFin: fechaFinSQL },
        type: sequelize.QueryTypes.SELECT
      });
      
      // Formatear valores numéricos para estadísticas por tipo
      estadisticasPorTipo.forEach(item => {
        item.totalFacturado = formatearValorMonetario(item.totalFacturado);
        item.promedio = formatearValorMonetario(item.promedio);
      });
      
      // Preparar datos para gráficos
      const graficoTipoDocumento = {
        tipos: estadisticasPorTipo.map(item => item.tipoDocumento),
        cantidades: estadisticasPorTipo.map(item => parseInt(item.cantidad))
      };
      
      // Tendencia de documentos por día
      const tendenciaDiaria = await sequelize.query(`
        SELECT 
          TO_CHAR(fecha_factura, 'YYYY-MM-DD') as fecha,
          COUNT(*) as cantidad
        FROM documentos
        WHERE fecha_factura BETWEEN :fechaInicio AND :fechaFin
          AND estado != 'cancelado'
        GROUP BY TO_CHAR(fecha_factura, 'YYYY-MM-DD')
        ORDER BY fecha
      `, {
        replacements: { fechaInicio: fechaInicioSQL, fechaFin: fechaFinSQL },
        type: sequelize.QueryTypes.SELECT
      });
      
      const graficoTendencia = {
        fechas: tendenciaDiaria.map(item => moment(item.fecha).format('DD/MM/YYYY')),
        cantidades: tendenciaDiaria.map(item => parseInt(item.cantidad))
      };
      
      // Obtener lista de documentos
      const documentos = await Documento.findAll({
        where: {
          fechaFactura: {
            [Op.between]: [fechaInicio.toDate(), fechaFin.toDate()]
          },
          estado: {
            [Op.ne]: 'cancelado'
          }
        },
        order: [['fechaFactura', 'DESC']],
        limit: 100 // Limitar a 100 documentos para no sobrecargar la vista
      });
      
      // Calcular porcentajes para las estadísticas
      const totalDocumentos = parseInt(statsResult.total_documentos);
      const conFactura = parseInt(statsResult.con_factura);
      const pendientes = parseInt(statsResult.pendientes);
      const pagados = parseInt(statsResult.pagados);
      
      const porcentajeFacturados = totalDocumentos > 0 ? Math.round((conFactura / totalDocumentos) * 100) : 0;
      const porcentajePendientes = totalDocumentos > 0 ? Math.round((pendientes / totalDocumentos) * 100) : 0;
      const porcentajePagados = totalDocumentos > 0 ? Math.round((pagados / totalDocumentos) * 100) : 0;
      
      // Renderizar la vista con los datos
      res.render('caja/reportes/documentos', {
        layout: 'caja',
        title: 'Reporte de Documentos',
        activeReportes: true,
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre,
        stats: {
          totalDocumentos,
          conFactura,
          pendientes,
          pagados,
          totalFacturado: formatearValorMonetario(statsResult.total_facturado),
          promedioFacturado: formatearValorMonetario(statsResult.promedio_facturado),
          porcentajeFacturados,
          porcentajePendientes,
          porcentajePagados
        },
        estadisticasPorTipo,
        graficoTipoDocumento,
        graficoTendencia,
        documentos,
        periodoTexto,
        filtros: {
          rango,
          fechaInicio: fechaInicio.format('YYYY-MM-DD'),
          fechaFin: fechaFin.format('YYYY-MM-DD')
        }
      });
    } catch (error) {
      console.error('Error al generar reporte de documentos:', error);
      return res.status(500).render('error', {
        layout: 'caja',
        title: 'Error',
        message: 'Error al generar el reporte de documentos',
        error
      });
    }
  },
  
  /**
   * Genera y muestra el reporte de documentos pendientes
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  reportePendientes: async (req, res) => {
    try {
      // Obtener parámetros de filtrado
      const { antiguedad, matrizador, ordenar, page = 1 } = req.query;
      const limit = 50;
      const offset = (page - 1) * limit;
      
      // Construir condiciones de filtrado
      const whereConditions = {
        estadoPago: 'pendiente'
      };
      
      if (matrizador) {
        whereConditions.matrizadorId = matrizador;
      }
      
      // Construir ORDER BY según el filtro
      let order = [['fechaFactura', 'ASC']]; // Por defecto más antiguos
      if (ordenar === 'monto') {
        order = [['valorFactura', 'DESC']];
      } else if (ordenar === 'fecha') {
        order = [['fechaFactura', 'DESC']];
      }
      
      // Obtener documentos pendientes
      const { count, rows: documentosPendientes } = await Documento.findAndCountAll({
        where: whereConditions,
        include: [{
          model: Matrizador,
          as: 'matrizador',
          attributes: ['id', 'nombre']
        }],
        order,
        limit,
        offset
      });
      
      // Calcular estadísticas por rangos de antigüedad usando SQL para mayor eficiencia (PostgreSQL syntax)
      const statsQuery = `
        SELECT 
          COUNT(CASE WHEN EXTRACT(DAY FROM NOW() - fecha_factura) BETWEEN 1 AND 7 THEN 1 END) as rango1_7,
          COUNT(CASE WHEN EXTRACT(DAY FROM NOW() - fecha_factura) BETWEEN 8 AND 15 THEN 1 END) as rango8_15,
          COUNT(CASE WHEN EXTRACT(DAY FROM NOW() - fecha_factura) BETWEEN 16 AND 60 THEN 1 END) as rango16_60,
          COUNT(CASE WHEN EXTRACT(DAY FROM NOW() - fecha_factura) > 60 THEN 1 END) as rango60,
          SUM(CASE WHEN EXTRACT(DAY FROM NOW() - fecha_factura) BETWEEN 1 AND 7 THEN valor_factura ELSE 0 END) as monto1_7,
          SUM(CASE WHEN EXTRACT(DAY FROM NOW() - fecha_factura) BETWEEN 8 AND 15 THEN valor_factura ELSE 0 END) as monto8_15,
          SUM(CASE WHEN EXTRACT(DAY FROM NOW() - fecha_factura) BETWEEN 16 AND 60 THEN valor_factura ELSE 0 END) as monto16_60,
          SUM(CASE WHEN EXTRACT(DAY FROM NOW() - fecha_factura) > 60 THEN valor_factura ELSE 0 END) as monto60,
          COUNT(*) as totalPendientes
        FROM documentos
        WHERE estado_pago = 'pendiente'
        ${matrizador ? `AND id_matrizador = ${matrizador}` : ''}
      `;
      
      const stats = await sequelize.query(statsQuery, {
        type: sequelize.QueryTypes.SELECT
      });
      
      const statsResult = stats[0];
      
      // Obtener lista de matrizadores para filtros
      const matrizadores = await Matrizador.findAll({
        where: {
          rol: 'matrizador',
          activo: true
        },
        attributes: ['id', 'nombre'],
        order: [['nombre', 'ASC']]
      });
      
      // Agregar días de antigüedad y nombre del matrizador a cada documento
      const documentosConDatos = documentosPendientes.map(doc => {
        const diasAntiguedad = moment().diff(moment(doc.fechaFactura), 'days');
        return {
          ...doc.toJSON(),
          diasAntiguedad,
          matrizador: doc.matrizador?.nombre || 'Sin asignar'
        };
      });
      
      // Filtrar por antigüedad si se especifica
      let documentosFiltrados = documentosConDatos;
      if (antiguedad) {
        documentosFiltrados = documentosConDatos.filter(doc => {
          const dias = doc.diasAntiguedad;
          switch (antiguedad) {
            case '1-7': return dias >= 1 && dias <= 7;
            case '8-15': return dias >= 8 && dias <= 15;
            case '16-60': return dias >= 16 && dias <= 60;
            case '60+': return dias > 60;
            default: return true;
          }
        });
      }
      
      // Preparar paginación
      const totalPages = Math.ceil(count / limit);
      const pagination = {
        currentPage: parseInt(page),
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        next: page < totalPages ? parseInt(page) + 1 : null,
        prev: page > 1 ? parseInt(page) - 1 : null,
        pages: []
      };
      
      // Generar números de página para mostrar
      for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, parseInt(page) + 2); i++) {
        pagination.pages.push({
          page: i,
          active: i === parseInt(page)
        });
      }
      
      // Renderizar la vista con los datos
      res.render('caja/reportes/pendientes', {
        layout: 'caja',
        title: 'Reporte de Documentos Pendientes',
        activeReportes: true,
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre,
        documentosPendientes: documentosFiltrados,
        stats: {
          rango1_7: parseInt(statsResult.rango1_7) || 0,
          rango8_15: parseInt(statsResult.rango8_15) || 0,
          rango16_60: parseInt(statsResult.rango16_60) || 0,
          rango60: parseInt(statsResult.rango60) || 0,
          monto1_7: parseFloat(statsResult.monto1_7) || 0,
          monto8_15: parseFloat(statsResult.monto8_15) || 0,
          monto16_60: parseFloat(statsResult.monto16_60) || 0,
          monto60: parseFloat(statsResult.monto60) || 0,
          totalPendientes: parseInt(statsResult.totalPendientes) || 0
        },
        matrizadores,
        filtros: {
          antiguedad,
          matrizador,
          ordenar
        },
        pagination: totalPages > 1 ? pagination : null
      });
    } catch (error) {
      console.error('Error al generar reporte de documentos pendientes:', error);
      return res.status(500).render('error', {
        layout: 'caja',
        title: 'Error',
        message: 'Error al generar el reporte de documentos pendientes',
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
  },
  
  /**
   * Filtrar métricas del dashboard por rango de fechas (AJAX)
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  filtrarDashboard: async (req, res) => {
    try {
      const { fechaDesde, fechaHasta } = req.body;
      
      // Validar fechas
      if (!fechaDesde || !fechaHasta) {
        return res.json({
          success: false,
          message: 'Las fechas son requeridas'
        });
      }
      
      const fechaDesdeObj = new Date(fechaDesde + 'T00:00:00.000Z');
      const fechaHastaObj = new Date(fechaHasta + 'T23:59:59.999Z');
      
      if (fechaDesdeObj > fechaHastaObj) {
        return res.json({
          success: false,
          message: 'La fecha desde no puede ser mayor a la fecha hasta'
        });
      }
      
      // Configurar filtros de fecha
      const whereClause = {
        created_at: {
          [Op.between]: [fechaDesdeObj, fechaHastaObj]
        }
      };
      
      // Obtener métricas filtradas
      const [
        totalFacturado,
        totalCobrado,
        totalPendiente,
        documentosFacturados,
        documentosPendientesPago
      ] = await Promise.all([
        // Total facturado
        Documento.sum('valorFactura', {
          where: {
            ...whereClause,
            valorFactura: { [Op.not]: null },
            estado: { [Op.ne]: 'cancelado' }
          }
        }),
        
        // Total cobrado
        Documento.sum('valorFactura', {
          where: {
            ...whereClause,
            estadoPago: 'pagado',
            estado: { [Op.ne]: 'cancelado' }
          }
        }),
        
        // Total pendiente
        Documento.sum('valorFactura', {
          where: {
            ...whereClause,
            estadoPago: 'pendiente',
            estado: { [Op.ne]: 'cancelado' }
          }
        }),
        
        // Cantidad documentos facturados
        Documento.count({
          where: {
            ...whereClause,
            valorFactura: { [Op.not]: null },
            estado: { [Op.ne]: 'cancelado' }
          }
        }),
        
        // Cantidad documentos pendientes de pago
        Documento.count({
          where: {
            ...whereClause,
            estadoPago: 'pendiente',
            estado: { [Op.ne]: 'cancelado' }
          }
        })
      ]);
      
      // Obtener documentos pendientes para la tabla
      const documentosPendientes = await Documento.findAll({
        where: {
          ...whereClause,
          estadoPago: 'pendiente',
          estado: { [Op.ne]: 'cancelado' }
        },
        attributes: ['id', 'codigoBarras', 'nombreCliente', 'numeroFactura', 'valorFactura'],
        limit: 10,
        order: [['created_at', 'DESC']]
      });
      
      // Obtener pagos recientes para la tabla (documentos marcados como pagados en el período)
      const documentosPagadosRecientes = await Documento.findAll({
        where: {
          estadoPago: 'pagado',
          estado: { [Op.ne]: 'cancelado' },
          updated_at: {
            [Op.between]: [fechaDesdeObj, fechaHastaObj]
          }
        },
        attributes: ['id', 'codigoBarras', 'nombreCliente', 'valorFactura', 'metodoPago', 'updated_at'],
        limit: 10,
        order: [['updated_at', 'DESC']]
      });
      
      // Formatear los valores
      const stats = {
        totalFacturado: formatearValorMonetario(totalFacturado || 0),
        totalCobrado: formatearValorMonetario(totalCobrado || 0),
        totalPendiente: formatearValorMonetario(totalPendiente || 0),
        documentosFacturados: documentosFacturados || 0,
        documentosPendientesPago: documentosPendientesPago || 0
      };
      
      return res.json({
        success: true,
        datos: {
          stats,
          documentosPendientes: documentosPendientes.map(doc => ({
            id: doc.id,
            codigoBarras: doc.codigoBarras,
            nombreCliente: doc.nombreCliente,
            numeroFactura: doc.numeroFactura,
            valorFactura: doc.valorFactura ? parseFloat(doc.valorFactura).toFixed(2) : '0.00'
          })),
          documentosPagadosRecientes: documentosPagadosRecientes.map(doc => ({
            id: doc.id,
            codigoBarras: doc.codigoBarras,
            nombreCliente: doc.nombreCliente,
            valorFactura: doc.valorFactura ? parseFloat(doc.valorFactura).toFixed(2) : '0.00',
            metodoPago: mapearMetodoPagoInverso(doc.metodoPago),
            updated_at: doc.updated_at
          }))
        }
      });
      
    } catch (error) {
      console.error('Error al filtrar dashboard:', error);
      return res.json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  },

  /**
   * Envía recordatorio de pago individual
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  recordarPagoIndividual: async (req, res) => {
    try {
      const documentoId = req.params.id;
      
      // Obtener el documento con información del cliente
      const documento = await Documento.findByPk(documentoId, {
        include: [{
          model: Matrizador,
          as: 'matrizador',
          attributes: ['nombre', 'email']
        }]
      });
      
      if (!documento) {
        return res.status(404).json({
          success: false,
          message: 'Documento no encontrado'
        });
      }
      
      // Aquí puedes implementar la lógica real de envío de email
      // Por ahora, simularemos el envío
      console.log(`Enviando recordatorio para documento ${documento.codigoBarras} a ${documento.emailCliente}`);
      
      res.json({
        success: true,
        message: 'Recordatorio enviado exitosamente'
      });
    } catch (error) {
      console.error('Error al enviar recordatorio individual:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  },

  /**
   * Envía recordatorios de pago masivos
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  recordarPagoMasivo: async (req, res) => {
    try {
      const { documentosIds, tipo } = req.body;
      
      if (!documentosIds || documentosIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No se especificaron documentos'
        });
      }
      
      // Obtener documentos
      const documentos = await Documento.findAll({
        where: {
          id: documentosIds,
          estadoPago: 'pendiente'
        },
        include: [{
          model: Matrizador,
          as: 'matrizador',
          attributes: ['nombre', 'email']
        }]
      });
      
      let enviados = 0;
      
      // Simular envío de recordatorios
      for (const documento of documentos) {
        if (documento.emailCliente) {
          console.log(`Enviando recordatorio masivo para documento ${documento.codigoBarras} a ${documento.emailCliente}`);
          enviados++;
        }
      }
      
      res.json({
        success: true,
        message: `Recordatorios enviados exitosamente`,
        enviados
      });
    } catch (error) {
      console.error('Error al enviar recordatorios masivos:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  },

  /**
   * Exporta documentos pendientes a Excel
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  exportarPendientes: async (req, res) => {
    try {
      const { ids } = req.query;
      
      // Construir condiciones de consulta
      const whereConditions = {
        estadoPago: 'pendiente'
      };
      
      if (ids) {
        whereConditions.id = ids.split(',');
      }
      
      // Obtener documentos pendientes
      const documentos = await Documento.findAll({
        where: whereConditions,
        include: [{
          model: Matrizador,
          as: 'matrizador',
          attributes: ['nombre']
        }],
        order: [['fechaFactura', 'ASC']]
      });
      
      // Crear contenido CSV
      let csvContent = 'Código,Cliente,Tipo,Fecha Factura,Valor,Días Pendiente,Matrizador\n';
      
      documentos.forEach(doc => {
        const diasPendiente = moment().diff(moment(doc.fechaFactura), 'days');
        csvContent += `"${doc.codigoBarras}","${doc.nombreCliente}","${doc.tipoDocumento}","${moment(doc.fechaFactura).format('DD/MM/YYYY')}","${doc.valorFactura}","${diasPendiente}","${doc.matrizador?.nombre || 'Sin asignar'}"\n`;
      });
      
      // Configurar headers para descarga
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="documentos_pendientes_${moment().format('YYYY-MM-DD')}.csv"`);
      
      res.send('\ufeff' + csvContent); // BOM para UTF-8
    } catch (error) {
      console.error('Error al exportar pendientes:', error);
      res.status(500).json({
        success: false,
        message: 'Error al exportar datos'
      });
    }
  },

  /**
   * Genera reporte PDF de documentos pendientes
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  generarPdfPendientes: async (req, res) => {
    try {
      // Por ahora, redirigir a una página de "en desarrollo"
      res.status(501).json({
        success: false,
        message: 'Generación de PDF en desarrollo'
      });
    } catch (error) {
      console.error('Error al generar PDF:', error);
      res.status(500).json({
        success: false,
        message: 'Error al generar PDF'
      });
    }
  },

  /**
   * Marca un documento como pagado
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  marcarComoPagado: async (req, res) => {
    try {
      const documentoId = req.params.id;
      
      // Buscar el documento
      const documento = await Documento.findByPk(documentoId);
      
      if (!documento) {
        return res.status(404).json({
          success: false,
          message: 'Documento no encontrado'
        });
      }
      
      if (documento.estadoPago === 'pagado') {
        return res.status(400).json({
          success: false,
          message: 'El documento ya está marcado como pagado'
        });
      }
      
      // Actualizar el estado del documento
      await documento.update({
        estadoPago: 'pagado',
        fechaPago: new Date(),
        observacionesPago: 'Marcado como pagado manualmente desde reportes'
      });
      
      res.json({
        success: true,
        message: 'Documento marcado como pagado exitosamente'
      });
    } catch (error) {
      console.error('Error al marcar como pagado:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  },

  /**
   * Muestra la página para buscar un documento por código de barras para registrar un pago.
   */
  mostrarPaginaBuscarDocumentoParaPago: async (req, res) => {
    try {
      // Asegurarse que los mensajes flash se pasan a la vista
      const errorBusqueda = req.flash('errorBusqueda') || null;
      const successMessage = req.flash('success') || null;
      
      res.render('caja/pagos/buscarDocumento', {
        layout: 'caja',
        title: 'Buscar Documento para Registrar Pago',
        activePagos: true,
        codigoBusqueda: req.query.codigoBusqueda || '',
        errorBusqueda: req.query.errorBusqueda || null,
        userRole: req.matrizador?.rol || req.user?.rol, // Asegurar que el rol se obtiene correctamente
        userName: req.matrizador?.nombre || req.user?.nombre // Asegurar que el nombre se obtiene correctamente
      });
    } catch (error) {
      console.error('Error al mostrar página de búsqueda de documento para pago:', error);
      req.flash('error', 'Error al cargar la página de búsqueda.');
      res.redirect('/caja');
    }
  },

  procesarBusquedaDocumentoParaPago: async (req, res) => {
    const { codigoBarras } = req.body;
    try {
      if (!codigoBarras || codigoBarras.trim() === '') {
        // Usar req.flash para mensajes de error y redirigir para que se muestren con el layout correcto
        req.flash('errorBusqueda', 'Ingrese un código de barras.');
        return res.redirect('/caja/pagos/buscar-documento');
      }

      const documento = await Documento.findOne({ where: { codigoBarras: codigoBarras.trim() } });

      if (documento) {
        if (documento.estado === 'cancelado') {
          req.flash('errorBusqueda', `El documento con código ${codigoBarras} se encuentra cancelado.`);
          return res.redirect(`/caja/pagos/buscar-documento?codigoBusqueda=${encodeURIComponent(codigoBarras)}`);
        }
        // Redirigir a la página de detalle del documento, anclando a la sección de pago
        // Asegúrate que la vista de detalle tenga un elemento con id="seccion-pago"
        res.redirect(`/caja/documentos/detalle/${documento.id}#seccion-pago`);
      } else {
        req.flash('errorBusqueda', `Documento con código ${codigoBarras} no encontrado.`);
        return res.redirect(`/caja/pagos/buscar-documento?codigoBusqueda=${encodeURIComponent(codigoBarras)}`);
      }
    } catch (error) {
      console.error('Error al procesar búsqueda de documento para pago:', error);
      req.flash('error', 'Error interno al buscar el documento.');
      res.redirect(`/caja/pagos/buscar-documento?codigoBusqueda=${encodeURIComponent(codigoBarras)}`);
    }
  }
};

module.exports = cajaController;