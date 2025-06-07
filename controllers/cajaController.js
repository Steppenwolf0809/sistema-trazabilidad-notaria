/**
 * Controlador para gestionar operaciones de caja
 * SIMPLIFICADO - Solo funciones esenciales
 */

const { sequelize } = require('../config/database');
const Documento = require('../models/Documento');
const Matrizador = require('../models/Matrizador');
const { Op } = require('sequelize');
const moment = require('moment');
const { 
  formatearValorMonetario,
  mapearMetodoPagoInverso
} = require('../utils/documentoUtils');

// Objeto que contendrá todas las funciones del controlador
const cajaController = {
  
  /**
   * Dashboard principal para rol de caja - CORREGIDO CON MATEMÁTICA EXACTA
   * Aplicando las mismas correcciones exitosas del dashboard admin
   */
  dashboard: async (req, res) => {
    try {
      console.log('🚀 DASHBOARD CAJA - INICIO CON MATEMÁTICA CORREGIDA');
      console.log('Usuario:', req.matrizador?.nombre, 'Rol:', req.matrizador?.rol);
      
      // ============== PROCESAR FILTROS DE PERÍODO (IGUAL QUE ADMIN) ==============
      const rango = req.query.rango || req.query.tipoPeriodo || 'mes';
      let fechaInicio, fechaFin, periodoTexto;
      
      // Establecer fechas según el rango seleccionado (COPIADO DE ADMIN)
      const hoy = moment().startOf('day');
      
      switch (rango) {
        case 'desde_inicio':
          fechaInicio = moment('2020-01-01').startOf('day');
          fechaFin = moment().endOf('day');
          periodoTexto = 'Desde el Inicio (Todos los datos históricos)';
          break;
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
          periodoTexto = 'Esta semana';
          break;
        case 'mes':
          fechaInicio = hoy.clone().startOf('month');
          fechaFin = moment().endOf('day');
          periodoTexto = 'Este mes';
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
          periodoTexto = 'Este mes';
      }
      
      // Formatear fechas para consultas SQL
      const fechaInicioSQL = fechaInicio.format('YYYY-MM-DD HH:mm:ss');
      const fechaFinSQL = fechaFin.format('YYYY-MM-DD HH:mm:ss');
      const hoySQL = hoy.format('YYYY-MM-DD');
      
      console.log('📅 PERÍODO SELECCIONADO:', {
        rango,
        fechaInicio: fechaInicioSQL,
        fechaFin: fechaFinSQL,
        periodoTexto
      });
      
      // ============== MÉTRICAS FINANCIERAS CON FILTROS (IGUAL QUE ADMIN) ==============
      
      // Condiciones base para el período
      const whereBasePeriodo = {
        created_at: {
          [Op.between]: [fechaInicio.toDate(), fechaFin.toDate()]
        },
        estado: { [Op.notIn]: ['eliminado', 'nota_credito'] }
      };
      
      // CORREGIDO: Facturación del período
      const [facturacionPeriodoResult] = await sequelize.query(`
        SELECT COALESCE(SUM(valor_factura), 0) as total
        FROM documentos
        WHERE created_at BETWEEN :fechaInicio AND :fechaFin
        AND numero_factura IS NOT NULL
        AND estado NOT IN ('eliminado', 'nota_credito')
      `, {
        replacements: { fechaInicio: fechaInicioSQL, fechaFin: fechaFinSQL },
        type: sequelize.QueryTypes.SELECT
      });
      const facturacionPeriodo = parseFloat(facturacionPeriodoResult.total);
      
      // CORREGIDO: Pagos recibidos del período (dinero cobrado en documentos del período)
      const [ingresosPeriodoResult] = await sequelize.query(`
        SELECT COALESCE(SUM(CASE WHEN estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial') THEN valor_pagado ELSE 0 END), 0) as total
        FROM documentos
        WHERE created_at BETWEEN :fechaInicio AND :fechaFin
        AND estado NOT IN ('eliminado', 'nota_credito')
      `, {
        replacements: { fechaInicio: fechaInicioSQL, fechaFin: fechaFinSQL },
        type: sequelize.QueryTypes.SELECT
      });
      const ingresosPeriodo = parseFloat(ingresosPeriodoResult.total);
      
      // CORREGIDO: Total pendiente de cobro POR PERÍODO - fórmula matemáticamente exacta
      // Pendiente real = Facturado - Pagado - Retenido
      let totalPendienteQuery, totalPendienteReplacements;
      
      if (rango === 'desde_inicio') {
        // Para "desde_inicio", usar cálculo global
        totalPendienteQuery = `
          SELECT COALESCE(SUM(valor_factura - valor_pagado - COALESCE(valor_retenido, 0)), 0) as total
          FROM documentos
          WHERE numero_factura IS NOT NULL
          AND estado NOT IN ('eliminado', 'nota_credito')
          AND (valor_factura - valor_pagado - COALESCE(valor_retenido, 0)) > 0
        `;
        totalPendienteReplacements = {};
      } else {
        // Para otros rangos, filtrar por período de creación
        totalPendienteQuery = `
          SELECT COALESCE(SUM(valor_factura - valor_pagado - COALESCE(valor_retenido, 0)), 0) as total
          FROM documentos
          WHERE created_at BETWEEN :fechaInicio AND :fechaFin
          AND numero_factura IS NOT NULL
          AND estado NOT IN ('eliminado', 'nota_credito')
          AND (valor_factura - valor_pagado - COALESCE(valor_retenido, 0)) > 0
        `;
        totalPendienteReplacements = { fechaInicio: fechaInicioSQL, fechaFin: fechaFinSQL };
      }
      
      const [totalPendienteResult] = await sequelize.query(totalPendienteQuery, {
        replacements: totalPendienteReplacements,
        type: sequelize.QueryTypes.SELECT
      });
      const totalPendiente = parseFloat(totalPendienteResult.total);
      
      // CORREGIDO: Pagos recibidos hoy específicamente (dinero realmente cobrado HOY)
      const [ingresosHoyResult] = await sequelize.query(`
        SELECT COALESCE(SUM(valor_pagado), 0) as total
        FROM documentos
        WHERE DATE(fecha_ultimo_pago) = :hoy
        AND estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial')
        AND estado NOT IN ('eliminado', 'nota_credito')
      `, {
        replacements: { hoy: hoySQL },
        type: sequelize.QueryTypes.SELECT
      });
      const ingresosHoy = parseFloat(ingresosHoyResult.total);
      
      // Conteos básicos CON FILTROS DE PERÍODO
      const totalDocumentos = await Documento.count({
        where: whereBasePeriodo
      });
      
      const documentosFacturados = await Documento.count({
        where: { ...whereBasePeriodo, numero_factura: { [Op.not]: null } }
      });
      
      const documentosPendientesPago = await Documento.count({
        where: { ...whereBasePeriodo, estado_pago: 'pendiente', numero_factura: { [Op.not]: null } }
      });
      
      // CORREGIDO: Documentos cobrados del período
      const documentosCobradosPeriodo = await Documento.count({
        where: {
          ...whereBasePeriodo,
          estado_pago: { [Op.in]: ['pagado_completo', 'pagado_con_retencion', 'pago_parcial'] }
        }
      });
      
      // CORREGIDO: Documentos cobrados hoy (incluir pago_parcial)
      const documentosCobradosHoy = await Documento.count({
        where: {
          estado_pago: { [Op.in]: ['pagado_completo', 'pagado_con_retencion', 'pago_parcial'] },
          fecha_ultimo_pago: {
            [Op.gte]: hoy.toDate(),
            [Op.lt]: moment().endOf('day').toDate()
          }
        }
      });
      
      console.log('💰 MÉTRICAS FINANCIERAS CORREGIDAS:', {
        facturacionPeriodo: facturacionPeriodo.toFixed(2),
        ingresosPeriodo: ingresosPeriodo.toFixed(2),
        totalPendiente: totalPendiente.toFixed(2),
        ingresosHoy: ingresosHoy.toFixed(2),
        documentosFacturados,
        documentosPendientesPago,
        documentosCobradosPeriodo,
        documentosCobradosHoy
      });
      
      // ============== OBTENER DATOS PARA TABLAS ==============
      
      // Documentos pendientes de pago (limitados al período)
      const documentosPendientes = await Documento.findAll({
        where: {
          ...whereBasePeriodo,
          estado_pago: 'pendiente',
          numero_factura: { [Op.not]: null }
        },
        attributes: ['id', 'codigoBarras', 'nombreCliente', 'numeroFactura', 'valorFactura', 'created_at'],
        include: [{
          model: Matrizador,
          as: 'matrizador',
          attributes: ['nombre'],
          required: false
        }],
        order: [['created_at', 'DESC']],
        limit: 10
      });
      
      // Pagos recientes (últimos pagos registrados)
      const documentosPagadosRecientes = await Documento.findAll({
        where: {
          estado_pago: { [Op.in]: ['pagado_completo', 'pagado_con_retencion', 'pago_parcial'] },
          fecha_ultimo_pago: { [Op.not]: null },
          estado: { [Op.notIn]: ['eliminado', 'nota_credito'] }
        },
        attributes: ['id', 'codigoBarras', 'nombreCliente', 'valorFactura', 'valorPagado', 'fechaUltimoPago', 'metodoPago', 'numeroFactura'],
        order: [['fechaUltimoPago', 'DESC']],
        limit: 10
      });
      
      // ============== PREPARAR DATOS PARA LA VISTA ==============
      
      const datosRender = {
        layout: 'caja',
        title: 'Dashboard de Caja - Operaciones Financieras',
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre,
        
        // Información del período
        periodo: {
          rango: rango,
          fechaInicio: fechaInicio.format('YYYY-MM-DD'),
          fechaFin: fechaFin.format('YYYY-MM-DD'),
          periodoTexto,
          esHoy: rango === 'hoy',
          esAyer: rango === 'ayer',
          esSemana: rango === 'semana',
          esMes: rango === 'mes',
          esUltimoMes: rango === 'ultimo_mes',
          esPersonalizado: rango === 'personalizado'
        },
        
        // Métricas financieras corregidas
        stats: {
          totalFacturado: facturacionPeriodo.toFixed(2),
          totalCobrado: ingresosPeriodo.toFixed(2),
          totalPendiente: totalPendiente.toFixed(2),
          ingresosHoy: ingresosHoy.toFixed(2),
          documentosFacturados,
          documentosPendientesPago,
          documentosCobradosPeriodo,
          documentosCobradosHoy,
          totalDocumentos
        },
        
        // Datos para tablas
        documentosPendientes: documentosPendientes.map(doc => ({
          ...doc.toJSON(),
          matrizadorNombre: doc.matrizador?.nombre || 'Sin asignar',
          valorFacturaFormato: formatearValorMonetario(doc.valorFactura),
          fechaFormateada: moment(doc.created_at).format('DD/MM/YYYY')
        })),
        
        documentosPagadosRecientes: documentosPagadosRecientes.map(doc => ({
          ...doc.toJSON(),
          valorFacturaFormato: formatearValorMonetario(doc.valorFactura),
          valorPagadoFormato: formatearValorMonetario(doc.valorPagado),
          fechaPagoFormateada: moment(doc.fechaUltimoPago).format('DD/MM/YYYY HH:mm'),
          metodoPagoFormateado: mapearMetodoPagoInverso(doc.metodoPago)
        }))
      };
      
      console.log('✅ DASHBOARD CAJA CORREGIDO - DATOS PREPARADOS');
      console.log('📊 Resumen:', {
        periodo: datosRender.periodo.periodoTexto,
        facturado: datosRender.stats.totalFacturado,
        cobrado: datosRender.stats.totalCobrado,
        pendiente: datosRender.stats.totalPendiente,
        documentosPendientes: datosRender.documentosPendientes.length,
        pagosRecientes: datosRender.documentosPagadosRecientes.length
      });
      
      // Renderizar el dashboard corregido
      res.render('caja/dashboard', datosRender);
      
    } catch (error) {
      console.error('❌ ERROR EN DASHBOARD CAJA CORREGIDO:', error);
      console.error('Stack trace completo:', error.stack);
      
      // Respuesta de emergencia
      return res.status(500).send(`
        <h1>Error en Dashboard de Caja</h1>
        <p>Error: ${error.message}</p>
        <p>Usuario: ${req.matrizador?.nombre} (${req.matrizador?.rol})</p>
        <pre>${error.stack}</pre>
        <a href="/login">Volver al Login</a>
      `);
    }
  },

  /**
   * RESTAURADO: Filtrar dashboard con AJAX
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
      
      // Crear fechas con timezone correcto
      const fechaDesdeObj = new Date(fechaDesde + 'T00:00:00');
      const fechaHastaObj = new Date(fechaHasta + 'T23:59:59');
      
      if (fechaDesdeObj > fechaHastaObj) {
        return res.json({
          success: false,
          message: 'La fecha desde no puede ser mayor a la fecha hasta'
        });
      }
      
      console.log('=== DEBUG FILTROS AJAX ===');
      console.log('Fecha desde recibida:', fechaDesde);
      console.log('Fecha hasta recibida:', fechaHasta);
      console.log('Fecha desde procesada:', fechaDesdeObj);
      console.log('Fecha hasta procesada:', fechaHastaObj);
      console.log('========================');
      
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
        Documento.sum('valor_factura', {
          where: {
            ...whereClause,
            valor_factura: { [Op.not]: null },
            estado: { [Op.notIn]: ['eliminado', 'nota_credito', 'cancelado'] }
          }
        }),
        
        // Total cobrado
        Documento.sum('valor_pagado', {
          where: {
            ...whereClause,
            estado_pago: { [Op.in]: ['pagado_completo', 'pagado_con_retencion', 'pago_parcial'] }
          }
        }),
        
        // Total pendiente
        Documento.sum('valor_pendiente', {
          where: whereClause
        }),
        
        // Cantidad documentos facturados
        Documento.count({
          where: {
            ...whereClause,
            numero_factura: { [Op.not]: null },
            estado: { [Op.notIn]: ['eliminado', 'nota_credito', 'cancelado'] }
          }
        }),
        
        // Cantidad documentos pendientes de pago
        Documento.count({
          where: {
            ...whereClause,
            estado_pago: 'pendiente',
            numero_factura: { [Op.not]: null },
            estado: { [Op.notIn]: ['eliminado', 'nota_credito', 'cancelado'] }
          }
        })
      ]);
      
      console.log('=== VALIDACIÓN AJAX ===');
      console.log('Total Facturado AJAX:', totalFacturado || 0);
      console.log('Total Cobrado AJAX:', totalCobrado || 0);
      console.log('Total Pendiente AJAX:', totalPendiente || 0);
      console.log('Documentos Facturados AJAX:', documentosFacturados || 0);
      console.log('Documentos Pendientes AJAX:', documentosPendientesPago || 0);
      console.log('====================');
      
      // Obtener documentos pendientes para la tabla
      const documentosPendientes = await Documento.findAll({
        where: {
          ...whereClause,
          estado_pago: 'pendiente',
          numero_factura: { [Op.not]: null },
          estado: { [Op.notIn]: ['eliminado', 'nota_credito', 'cancelado'] }
        },
        attributes: ['id', 'codigoBarras', 'nombreCliente', 'numero_factura', 'valor_factura'],
        limit: 10,
        order: [['created_at', 'DESC']]
      });
      
      // Obtener pagos recientes
      const documentosPagadosRecientes = await Documento.findAll({
        where: {
          estado_pago: { [Op.in]: ['pagado_completo', 'pagado_con_retencion'] },
          estado: { [Op.notIn]: ['eliminado', 'nota_credito', 'cancelado'] },
          fecha_ultimo_pago: {
            [Op.between]: [fechaDesdeObj, fechaHastaObj]
          }
        },
        attributes: ['id', 'codigoBarras', 'nombreCliente', 'valor_factura', 'metodo_pago', 'fecha_ultimo_pago'],
        limit: 10,
        order: [['fecha_ultimo_pago', 'DESC']]
      });
      
      // Función auxiliar simple para formatear dinero
      function formatearValor(valor) {
        if (!valor) return '0.00';
        return parseFloat(valor).toFixed(2);
      }
      
      // Formatear los valores
      const stats = {
        totalFacturado: formatearValor(totalFacturado || 0),
        totalCobrado: formatearValor(totalCobrado || 0),
        totalPendiente: formatearValor(totalPendiente || 0),
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
            numero_factura: doc.numero_factura,
            valor_factura: doc.valor_factura ? parseFloat(doc.valor_factura).toFixed(2) : '0.00'
          })),
          documentosPagadosRecientes: documentosPagadosRecientes.map(doc => ({
            id: doc.id,
            codigoBarras: doc.codigoBarras,
            nombreCliente: doc.nombreCliente,
            valor_factura: doc.valor_factura ? parseFloat(doc.valor_factura).toFixed(2) : '0.00',
            metodo_pago: doc.metodo_pago || 'N/A',
            fecha_ultimo_pago: doc.fecha_ultimo_pago
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
   * RESTAURADO: Listar documentos con filtros y paginación
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
      const fechaDesde = req.query.fechaDesde || '';
      const fechaHasta = req.query.fechaHasta || '';
      
      // Construir condiciones de filtrado
      const where = {};
      
      if (estado) {
        where.estado = estado;
      }
      
      // CORREGIDO: Usar el nombre de campo correcto para el filtro
      if (estadoPago) {
        // El modelo tiene underscored: true, por lo que en consultas WHERE 
        // debe usar el nombre de campo de la base de datos (snake_case)
        where.estado_pago = estadoPago;
      }
      
      if (tipoDocumento) {
        where.tipo_documento = tipoDocumento;
      }
      
      if (matrizadorId) {
        where.id_matrizador = matrizadorId;
      }
      
      if (busqueda) {
        where[Op.or] = [
          { codigoBarras: { [Op.iLike]: `%${busqueda}%` } },
          { nombreCliente: { [Op.iLike]: `%${busqueda}%` } },
          { numero_factura: { [Op.iLike]: `%${busqueda}%` } }
        ];
      }
      
      // Filtro de rango de fechas
      if (fechaDesde && fechaHasta) {
        where.fecha_factura = {
          [Op.between]: [moment(fechaDesde).startOf('day').toDate(), moment(fechaHasta).endOf('day').toDate()]
        };
      } else if (fechaDesde) {
        where.fecha_factura = {
          [Op.gte]: moment(fechaDesde).startOf('day').toDate()
        };
      } else if (fechaHasta) {
        where.fecha_factura = {
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
        order: [['created_at', 'DESC']],
        limit,
        offset
      });
      
      // Transformar métodos de pago para la vista
      documentos.forEach(doc => {
        if (doc.metodo_pago === null) {
          doc.metodo_pago = 'pendiente';
        }
        if (doc.metodo_pago === 'tarjeta') {
          doc.metodo_pago = 'tarjeta_credito';
        }
      });
      
      // Obtener todos los matrizadores para el filtro
      const matrizadores = await Matrizador.findAll({
        where: {
          rol: {
            [Op.in]: ['matrizador', 'caja_archivo']
          },
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
          busqueda: busqueda || '',
          fechaDesde: fechaDesde || '',
          fechaHasta: fechaHasta || ''
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
   * MEJORADO: Ver detalle de documento con historial completo
   */
  verDocumento: async (req, res) => {
    try {
      const documentoId = req.params.id;
      
      // Obtener documento con relaciones
      const documento = await Documento.findByPk(documentoId, {
        include: [
          {
            model: Matrizador,
            as: 'matrizador',
            attributes: ['id', 'nombre', 'email']
          }
        ]
      });
      
      if (!documento) {
        return res.status(404).render('error', {
          layout: 'caja',
          title: 'Documento no encontrado',
          message: 'El documento solicitado no existe'
        });
      }

      // Obtener información del usuario que registró el pago
      let usuarioPago = null;
      if (documento.registradoPor) {
        usuarioPago = await Matrizador.findByPk(documento.registradoPor, {
          attributes: ['id', 'nombre', 'rol']
        });
      }

      // Obtener eventos del historial
      const EventoDocumento = require('../models/EventoDocumento');
      const eventos = await EventoDocumento.findAll({
        where: { documentoId: documentoId }, // CORREGIDO: usar documentoId en lugar de documento_id
        include: [
          {
            model: Matrizador,
            as: 'matrizador', // CORREGIDO: usar 'matrizador' en lugar de 'usuario'
            attributes: ['nombre', 'rol'],
            required: false
          }
        ],
        order: [['created_at', 'DESC']]
      });

      // Procesar eventos para mostrar en el historial
      const eventosFormateados = eventos.map(evento => {
        // Procesar detalles específicos por tipo de evento
        let detallesProcessed = {};
        try {
          // Si detalles es string JSON, parsearlo
          if (typeof evento.detalles === 'string' && evento.detalles.trim().length > 0) {
            // Verificar si el string parece ser JSON válido
            if (evento.detalles.trim().startsWith('{') || evento.detalles.trim().startsWith('[')) {
              detallesProcessed = JSON.parse(evento.detalles);
            } else {
              // Si no es JSON, crear un objeto con la descripción
              detallesProcessed = {
                descripcionTexto: evento.detalles,
                procesadoComoTexto: true
              };
            }
          } else if (evento.detalles && typeof evento.detalles === 'object') {
            detallesProcessed = evento.detalles;
          }
        } catch (e) {
          // Manejo silencioso del error - crear objeto con información disponible
          console.warn('⚠️ Evento con detalles no parseables:', evento.id, '- Usando fallback');
          detallesProcessed = {
            descripcionTexto: typeof evento.detalles === 'string' ? evento.detalles : 'Información de evento legacy',
            errorParsing: true,
            eventoId: evento.id
          };
        }
        
        // Construir información específica para eventos de entrega
        if (evento.tipo === 'entrega' && documento.nombreReceptor) {
          detallesProcessed = {
            ...detallesProcessed,
            receptor: documento.nombreReceptor,
            identificacionReceptor: documento.identificacionReceptor,
            relacion: documento.relacionReceptor || 'titular'
          };
        }
        
        // MEJORADO: Construir información específica para eventos de pago
        if (evento.tipo === 'pago') {
          // Primero usar los datos del evento si están disponibles
          if (!detallesProcessed.valor && evento.metadatos) {
            try {
              const metadatos = typeof evento.metadatos === 'string' ? JSON.parse(evento.metadatos) : evento.metadatos;
              if (metadatos.montoPago) {
                detallesProcessed.valor = metadatos.montoPago;
              }
            } catch (e) {
              // Fallback silencioso
            }
          }
          
          // Fallback a los datos del documento si no hay datos específicos del evento
          if (!detallesProcessed.valor && documento.valorPagado) {
            detallesProcessed.valor = documento.valorPagado;
          }
          if (!detallesProcessed.metodoPago && documento.metodoPago) {
            detallesProcessed.metodoPago = documento.metodoPago;
          }
          if (!detallesProcessed.numeroFactura && documento.numeroFactura) {
            detallesProcessed.numeroFactura = documento.numeroFactura;
          }
          if (!detallesProcessed.usuarioCaja) {
            detallesProcessed.usuarioCaja = evento.matrizador ? evento.matrizador.nombre : 'Sistema';
          }
          
          // Asegurar que el valor sea numérico y válido
          if (detallesProcessed.valor) {
            detallesProcessed.valor = parseFloat(detallesProcessed.valor) || 0;
          }
        }
        
        const eventoData = {
          id: evento.id,
          tipo: evento.tipo,
          categoria: evento.categoria || 'general',
          titulo: evento.titulo || 'Evento del Sistema',
          descripcion: evento.descripcion || 'Sin descripción disponible',
          fecha: evento.created_at,
          usuario: evento.matrizador ? evento.matrizador.nombre : 'Sistema',
          detalles: detallesProcessed,
          color: 'secondary'
        };

        // Asignar icono y color según el tipo de evento
        switch (evento.tipo) {
          case 'creacion':
            eventoData.color = 'primary';
            break;
          case 'pago':
            eventoData.color = 'success';
            break;
          case 'entrega':
            eventoData.color = 'info';
            break;
          case 'estado':
            eventoData.color = 'warning';
            break;
          case 'asignacion':
            eventoData.color = 'primary';
            break;
          default:
            eventoData.color = 'secondary';
        }

        return eventoData;
      });

      // Obtener lista de matrizadores para el modal de cambio
      const matrizadores = await Matrizador.findAll({
        where: {
          rol: { [Op.in]: ['matrizador', 'caja_archivo'] },
          activo: true
        },
        attributes: ['id', 'nombre'],
        order: [['nombre', 'ASC']]
      });
      
      res.render('caja/documentos/detalle', {
        layout: 'caja',
        title: 'Detalle del Documento',
        documento,
        eventos: eventosFormateados,
        usuarioPago,
        matrizadores,
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre
      });
    } catch (error) {
      console.error('Error al ver documento:', error);
      return res.status(500).render('error', {
        layout: 'caja',
        title: 'Error',
        message: 'Error al cargar el documento',
        error
      });
    }
  },

  /**
   * RESTAURADO: Mostrar formulario de registro de pago
   */
  mostrarFormularioRegistrarPago: async (req, res) => {
    try {
      const documentoId = req.params.id;
      
      console.log('🔍 DEBUGGING - mostrarFormularioRegistrarPago:');
      console.log('📋 documentoId recibido en params:', documentoId);
      console.log('📋 req.params completo:', req.params);
      console.log('📋 URL completa:', req.originalUrl);
      
      const documento = await Documento.findByPk(documentoId);
      
      if (!documento) {
        console.error('❌ Documento no encontrado para ID:', documentoId);
        req.flash('error', 'Documento no encontrado');
        return res.redirect('/caja/documentos');
      }
      
      console.log('✅ Documento encontrado:');
      console.log('  - ID:', documento.id);
      console.log('  - Código:', documento.codigoBarras);
      console.log('  - Cliente:', documento.nombreCliente);
      console.log('  - Estado pago:', documento.estado_pago);
      
      if (documento.estadoPago === 'pagado') {
        console.log('⚠️ Documento ya está pagado, redirigiendo...');
        req.flash('warning', 'Este documento ya está pagado');
        return res.redirect(`/caja/documentos/detalle/${documentoId}`);
      }
      
      console.log('🎭 Renderizando vista registrar.hbs con documento ID:', documento.id);
      
      res.render('caja/pagos/registrar', {
        layout: 'caja',
        title: 'Registrar Pago',
        documento,
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre
      });
    } catch (error) {
      console.error('❌ Error al mostrar formulario de pago:', error);
      req.flash('error', 'Error al cargar el formulario de pago');
      return res.redirect('/caja/documentos');
    }
  },
  
  /**
   * IMPLEMENTACIÓN COMPLETA: Registrar pago con soporte para retenciones XML y manuales
   */
  registrarPago: async (req, res) => {
    try {
      console.log('💰 Registrando pago completo...');
      console.log('🔍 DEBUGGING SERVIDOR - Análisis completo de la petición:');
      console.log('📋 req.body:', req.body);
      console.log('📋 req.params:', req.params);
      console.log('📋 req.query:', req.query);
      console.log('📋 Content-Type:', req.headers['content-type']);
      console.log('📋 Method:', req.method);
      
      // Listar todos los campos recibidos
      console.log('📦 Campos en req.body:');
      Object.keys(req.body || {}).forEach(key => {
        console.log(`  - ${key}: ${req.body[key]} (tipo: ${typeof req.body[key]})`);
      });

      const {
        documentoId,
        monto,
        formaPago,
        numeroComprobante,
        observaciones,
        xmlRetencionData
      } = req.body;
      
      console.log('🔍 Variables extraídas:');
      console.log(`  - documentoId: "${documentoId}" (tipo: ${typeof documentoId})`);
      console.log(`  - monto: "${monto}" (tipo: ${typeof monto})`);
      console.log(`  - formaPago: "${formaPago}" (tipo: ${typeof formaPago})`);

      // Validaciones básicas
      if (!documentoId) {
        console.error('❌ documentoId está vacío, null o undefined');
        return res.status(400).json({
          success: false,
          message: 'ID del documento es requerido'
        });
      }

      // Buscar el documento
      const documento = await Documento.findByPk(documentoId);
      if (!documento) {
        return res.status(404).json({
          success: false,
          message: 'Documento no encontrado'
        });
      }

      console.log('🔍 DEBUG - ANÁLISIS COMPLETO DEL DOCUMENTO:');
      console.log('📋 Documento encontrado:', {
        id: documento.id,
        codigoBarras: documento.codigoBarras,
        valorFactura: documento.valorFactura,
        valorPagado: documento.valorPagado,
        valorPendiente: documento.valorPendiente,
        estadoPago: documento.estadoPago,
        numeroFactura: documento.numeroFactura
      });

      if (documento.estadoPago === 'pagado_completo') {
        return res.status(400).json({
          success: false,
          message: 'Este documento ya está pagado completamente'
        });
      }

      // Procesar datos de retención si existen
      let datosRetencion = null;
      if (xmlRetencionData) {
        try {
          datosRetencion = JSON.parse(xmlRetencionData);
          console.log('📋 Datos de retención procesados:', datosRetencion);
        } catch (error) {
          console.error('Error parseando datos de retención:', error);
          return res.status(400).json({
            success: false,
            message: 'Datos de retención inválidos'
          });
        }
      }

      // Validar montos
      const montoPago = parseFloat(monto) || 0;
      const montoRetencion = datosRetencion ? (parseFloat(datosRetencion.totalRetenido) || 0) : 0;
      const totalMovimiento = montoPago + montoRetencion;

      console.log('💵 Análisis de montos:', {
        montoPago,
        montoRetencion,
        totalMovimiento,
        valorFacturaActual: documento.valorFactura,
        valorPagadoActual: documento.valorPagado || 0
      });

      // Validar que hay al menos un monto
      if (totalMovimiento <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Debe ingresar un monto de pago o procesar una retención'
        });
      }

      // Obtener valor de factura válido
      const valorFacturaDocumento = parseFloat(documento.valorFactura) || 0;
      const valorPagadoAnterior = parseFloat(documento.valorPagado) || 0;
      const valorPendienteReal = valorFacturaDocumento - valorPagadoAnterior;

      console.log('🔍 CÁLCULOS DE PAGO:', {
        valorFacturaDocumento,
        valorPagadoAnterior,
        valorPendienteReal,
        montoPago,
        montoRetencion,
        totalMovimiento
      });

      if (valorFacturaDocumento <= 0) {
        return res.status(400).json({
          success: false,
          message: `El documento no tiene un valor de factura válido. Valor actual: $${valorFacturaDocumento}`
        });
      }

      // Validar que no exceda el valor pendiente
      if (totalMovimiento > valorPendienteReal) {
        return res.status(400).json({
          success: false,
          message: `El total del pago ($${totalMovimiento.toFixed(2)}) no puede exceder el valor pendiente ($${valorPendienteReal.toFixed(2)})`
        });
      }

      // Validar forma de pago si hay monto de pago
      if (montoPago > 0 && !formaPago) {
        return res.status(400).json({
          success: false,
          message: 'Forma de pago es requerida cuando hay monto de pago'
        });
      }

      // Calcular nuevos valores
      const nuevoValorPagado = valorPagadoAnterior + montoPago;
      const nuevoValorPendiente = Math.max(0, valorFacturaDocumento - nuevoValorPagado - montoRetencion);
      
      // CORREGIDO: Usar valores correctos del ENUM del modelo
      let nuevoEstadoPago;
      if (nuevoValorPendiente <= 0.01) {
        // Pago completo
        if (montoRetencion > 0) {
          nuevoEstadoPago = 'pagado_con_retencion';
        } else {
          nuevoEstadoPago = 'pagado_completo';
        }
      } else {
        // Pago parcial
        nuevoEstadoPago = 'pago_parcial';
      }

      console.log('🧮 Cálculos finales:', {
        valorFacturaDocumento,
        valorPagadoAnterior,
        montoPago,
        montoRetencion,
        nuevoValorPagado,
        nuevoValorPendiente,
        nuevoEstadoPago
      });

      // ACTUALIZACIÓN MEJORADA: Usar Sequelize con transacción
      const transaction = await sequelize.transaction();
      
      try {
        console.log('🔄 Iniciando actualización del documento con transacción...');
        
        // Preparar datos de actualización
        const datosActualizacion = {
          estadoPago: nuevoEstadoPago,
          metodoPago: formaPago || 'retencion',
          fechaPago: new Date(),
          fechaUltimoPago: new Date(),
          valorPagado: nuevoValorPagado,
          valorPendiente: nuevoValorPendiente,
          numeroComprobante: numeroComprobante || null,
          observaciones: observaciones || null
        };
        
        // Si hay datos de retención, incluirlos
        if (datosRetencion) {
          // Procesar fecha de retención correctamente
          let fechaRetencion = null;
          if (datosRetencion.fechaRetencion) {
            // Intentar diferentes formatos de fecha
            const fechaString = datosRetencion.fechaRetencion.toString();
            
            // Si viene en formato DD/MM/YYYY (del XML)
            if (fechaString.includes('/')) {
              const partes = fechaString.split('/');
              if (partes.length === 3) {
                // Convertir DD/MM/YYYY a YYYY-MM-DD
                fechaRetencion = new Date(`${partes[2]}-${partes[1]}-${partes[0]}`);
              }
            } 
            // Si viene en formato YYYY-MM-DD (del formulario manual)
            else if (fechaString.includes('-')) {
              fechaRetencion = new Date(fechaString);
            }
            
            // Validar que la fecha sea válida
            if (fechaRetencion && isNaN(fechaRetencion.getTime())) {
              console.log('⚠️ Fecha de retención inválida, usando fecha actual');
              fechaRetencion = new Date();
            }
          } else {
            // Si no hay fecha, usar la fecha actual
            fechaRetencion = new Date();
          }
          
          datosActualizacion.tieneRetencion = true;
          datosActualizacion.numeroComprobanteRetencion = datosRetencion.numeroComprobanteRetencion;
          datosActualizacion.razonSocialRetenedora = datosRetencion.razonSocialRetenedora;
          datosActualizacion.rucEmpresaRetenedora = datosRetencion.rucRetenedor;
          datosActualizacion.retencionIva = parseFloat(datosRetencion.retencionIva) || 0;
          datosActualizacion.retencionRenta = parseFloat(datosRetencion.retencionRenta) || 0;
          datosActualizacion.valorRetenido = parseFloat(datosRetencion.totalRetenido) || 0;
          datosActualizacion.fechaRetencion = fechaRetencion;
        }
        
        console.log('📦 Datos para actualización:', JSON.stringify(datosActualizacion, null, 2));
        
        // Actualizar el documento usando Sequelize
        const [numRowsUpdated] = await Documento.update(datosActualizacion, {
          where: { id: documento.id },
          transaction
        });
        
        if (numRowsUpdated === 0) {
          throw new Error('No se pudo actualizar el documento');
        }
        
        console.log(`✅ Documento actualizado: ${numRowsUpdated} filas afectadas`);
        
        // Confirmar transacción
        await transaction.commit();
        
        // Refrescar la instancia del documento
        await documento.reload();
        
        console.log('📋 Estado final del documento:', {
          id: documento.id,
          estadoPago: documento.estadoPago,
          metodoPago: documento.metodoPago,
          valorPagado: documento.valorPagado,
          valorPendiente: documento.valorPendiente,
          fechaPago: documento.fechaPago
        });

        // NUEVO: Crear evento mejorado del pago
        const EventoDocumento = require('../models/EventoDocumento');
        
        // Preparar información detallada del evento
        let tituloEvento = '💰 Pago Registrado';
        let descripcionEvento = '';
        let detallesEvento = {
          monto: montoPago,
          metodoPago: formaPago,
          numeroFactura: documento.numeroFactura,
          estadoPagoAnterior: documento.estadoPago === nuevoEstadoPago ? 'pendiente' : documento.estadoPago,
          estadoPagoNuevo: nuevoEstadoPago,
          usuarioCaja: req.user?.nombre || req.matrizador?.nombre || 'Sistema',
          rolUsuario: req.user?.rol || req.matrizador?.rol || 'sistema',
          numeroComprobante: numeroComprobante,
          observaciones: observaciones
        };
        
        // Construir descripción según el tipo de pago
        if (montoPago > 0 && montoRetencion > 0) {
          descripcionEvento = `Pago de $${montoPago.toFixed(2)} más retención de $${montoRetencion.toFixed(2)} (Total: $${totalMovimiento.toFixed(2)}) registrado por ${detallesEvento.usuarioCaja}`;
          tituloEvento = '💰 Pago con Retención';
          detallesEvento.tipoOperacion = 'pago_con_retencion';
          detallesEvento.retencion = datosRetencion;
        } else if (montoPago > 0) {
          descripcionEvento = `Pago de $${montoPago.toFixed(2)} registrado por ${detallesEvento.usuarioCaja} mediante ${formaPago}`;
          detallesEvento.tipoOperacion = 'pago_simple';
        } else if (montoRetencion > 0) {
          descripcionEvento = `Retención de $${montoRetencion.toFixed(2)} procesada por ${detallesEvento.usuarioCaja}`;
          tituloEvento = '🧾 Retención Procesada';
          detallesEvento.tipoOperacion = 'solo_retencion';
          detallesEvento.retencion = datosRetencion;
        }
        
        // Agregar información de estado
        if (nuevoEstadoPago === 'pagado_completo') {
          descripcionEvento += ' - ✅ DOCUMENTO PAGADO COMPLETAMENTE';
        } else if (nuevoEstadoPago === 'pagado_con_retencion') {
          descripcionEvento += ' - ✅ DOCUMENTO PAGADO CON RETENCIÓN';
        } else if (nuevoEstadoPago === 'pago_parcial') {
          descripcionEvento += ` - ⚠️ Pago parcial (Pendiente: $${nuevoValorPendiente.toFixed(2)})`;
        }
        
        // Crear el evento con información detallada
        await EventoDocumento.create({
          documentoId: documento.id,
          usuarioId: req.user?.id || req.matrizador?.id || null,
          tipo: 'pago',
          categoria: 'financiero',
          titulo: tituloEvento,
          descripcion: descripcionEvento,
          detalles: JSON.stringify(detallesEvento),
          usuario: detallesEvento.usuarioCaja,
          metadatos: JSON.stringify({
            montoPago,
            montoRetencion,
            totalMovimiento,
            metodoPago: formaPago,
            estadoPagoAnterior: detallesEvento.estadoPagoAnterior,
            estadoPagoNuevo: nuevoEstadoPago,
            procesadoPor: detallesEvento.usuarioCaja,
            fechaProcesamiento: new Date().toISOString()
          })
        });
        
        console.log('✅ Evento de pago creado con información detallada');

        // Preparar respuesta con datos completos
        const tipoOperacion = montoPago > 0 && montoRetencion > 0 ? 'pago_con_retencion' :
                             montoPago > 0 ? 'pago_simple' : 'solo_retencion';

        const respuesta = {
          success: true,
          message: 'Pago registrado exitosamente',
          data: {
            documentoId: documento.id,
            codigoBarras: documento.codigoBarras,
            tipoOperacion,
            montoPago,
            montoRetencion,
            totalMovimiento,
            valorFactura: valorFacturaDocumento,
            valorPagado: documento.valorPagado,
            valorPendiente: documento.valorPendiente,
            estadoPago: documento.estadoPago,
            fechaPago: documento.fechaPago,
            pagoCompleto: nuevoValorPendiente <= 0.01
          }
        };

        console.log('📊 Respuesta preparada:', respuesta);

        // MEJORADO: Redirigir con mensaje de éxito
        if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
          // Si es una petición AJAX, devolver JSON
          res.json(respuesta);
        } else {
          // Si es una petición de formulario normal, redirigir con mensaje flash
          req.flash('success', `Pago registrado exitosamente. Documento ${documento.codigoBarras} - Estado: ${documento.estadoPago.toUpperCase()}`);
          res.redirect(`/caja/documentos/detalle/${documento.id}`);
        }

      } catch (updateError) {
        // Rollback en caso de error
        await transaction.rollback();
        throw updateError;
      }

    } catch (error) {
      console.error('❌ Error registrando pago:', error);
      
      // MEJORADO: Manejar errores según el tipo de petición
      if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
        res.status(500).json({
          success: false,
          message: 'Error interno del servidor: ' + error.message
        });
      } else {
        req.flash('error', 'Error al registrar el pago: ' + error.message);
        res.redirect('back');
      }
    }
  },
  
  /**
   * NUEVO: Procesar XML de retención y extraer datos específicos
   */
  procesarXMLRetencion: async (req, res) => {
    const fs = require('fs');
    const xml2js = require('xml2js');
    
    try {
      console.log('🔍 Procesando XML de retención...');
      
      if (!req.file) {
        return res.status(400).json({
          success: false, 
          message: 'No se recibió ningún archivo XML de retención'
        });
      }

      console.log('📁 Archivo XML recibido:', req.file.originalname);
      console.log('📍 Ruta temporal:', req.file.path);

      // Leer el archivo XML
      const xmlContent = fs.readFileSync(req.file.path, 'utf8');
      console.log('📄 Contenido XML leído, tamaño:', xmlContent.length, 'caracteres');

      // Parsear XML
      const parser = new xml2js.Parser({ explicitArray: false });
      const result = await parser.parseStringPromise(xmlContent);
      
      console.log('✅ XML parseado exitosamente');
      console.log('🔍 Estructura raíz:', Object.keys(result));

      // Extraer datos del XML de retención
      let datosRetencionXML = {};
      
      // Buscar estructura de retención
      if (result.autorizacion && result.autorizacion.comprobante) {
        // XML viene dentro de autorización con CDATA
        console.log('🔍 Estructura: autorizacion > comprobante (CDATA)');
        
        // Parsear el contenido CDATA
        const comprobanteContent = result.autorizacion.comprobante;
        const comprobanteResult = await parser.parseStringPromise(comprobanteContent);
        
        if (comprobanteResult.comprobanteRetencion) {
          datosRetencionXML = extraerDatosRetencionXML(comprobanteResult.comprobanteRetencion);
        }
      } else if (result.comprobanteRetencion) {
        // XML directo de comprobante de retención
        console.log('🔍 Estructura: comprobanteRetencion directo');
        datosRetencionXML = extraerDatosRetencionXML(result.comprobanteRetencion);
      } else {
        throw new Error('Estructura de XML de retención no reconocida');
      }

      console.log('📊 Datos de retención extraídos:', datosRetencionXML);

      // Limpiar archivo temporal
      fs.unlinkSync(req.file.path);
      console.log('🗑️ Archivo temporal eliminado');

      // Respuesta exitosa con datos extraídos
      res.json({
        success: true,
        message: 'XML de retención procesado exitosamente',
        data: datosRetencionXML
      });

    } catch (error) {
      console.error('❌ Error procesando XML de retención:', error);
      
      // Limpiar archivo temporal en caso de error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.status(500).json({
        success: false, 
        message: 'Error al procesar el archivo XML de retención: ' + error.message
      });
    }
  },

  /**
   * IMPORTADO DESDE ADMIN: Reporte financiero funcional
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
      
      const totalCobrado = await Documento.sum('valor_pagado', {
        where: {
          ...whereClause,
          estado_pago: { [Op.in]: ['pagado_completo', 'pagado_con_retencion', 'pago_parcial'] }
        }
      }) || 0;
      
      const totalPendiente = await Documento.sum('valor_pendiente', {
        where: whereClause
      }) || 0;
      
      // Calcular porcentaje de recuperación
      const porcentajeRecuperacion = totalFacturado > 0 ? 
        Math.round((totalCobrado / totalFacturado) * 100) : 0;
      
      // CORREGIDO: Obtener datos diarios usando nombres de columna correctos
      const documentosPorDia = await Documento.findAll({
        where: whereClause,
        attributes: [
          [sequelize.fn('DATE', sequelize.col('created_at')), 'fecha'],
          [sequelize.fn('SUM', sequelize.col('valor_factura')), 'totalFacturado'],
          [sequelize.fn('SUM', sequelize.col('valor_pagado')), 'totalCobrado']
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
        where: {
          rol: {
            [Op.in]: ['matrizador', 'caja_archivo']
          },
          activo: true
        },
        attributes: ['id', 'nombre'],
        order: [['nombre', 'ASC']]
      });
      
      // Renderizar la vista con los datos - ADAPTADO PARA CAJA
      res.render('caja/reportes/financiero', {
        layout: 'caja', // CAMBIO: usar layout de caja
        title: 'Reporte Financiero',
        activeReportes: true,
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre,
        matrizadores,
        idMatrizadorSeleccionado: idMatrizador || 'todos',
        stats: {
          totalFacturado: formatearValorMonetario(totalFacturado),
          totalCobrado: formatearValorMonetario(totalCobrado),
          totalPendiente: formatearValorMonetario(totalPendiente),
          porcentajeRecuperacion
        },
        datosTabla,
        graficoTendencia,
        filtros: {
          rango,
          fechaInicio: fechaInicio.format('YYYY-MM-DD'),
          fechaFin: fechaFin.format('YYYY-MM-DD'),
          idMatrizador: idMatrizador || 'todos'
        },
        periodoTexto
      });
    } catch (error) {
      console.error('Error al generar reporte financiero:', error);
      return res.status(500).render('error', {
        layout: 'caja', // CAMBIO: usar layout de caja
        title: 'Error',
        message: 'Error al generar el reporte financiero',
        error
      });
    }
  },

  /**
   * IMPORTADO DESDE ADMIN: Reporte de documentos pendientes funcional
   */
  reportePendientes: async (req, res) => {
    try {
      // Obtener parámetros de filtrado
      const { antiguedad, matrizador, ordenar, page = 1 } = req.query;
      const limit = 50;
      const offset = (page - 1) * limit;
      
      // Construir condiciones de filtrado
      const whereConditions = {
        estado_pago: 'pendiente', // CAMBIO: usar camelCase
        numero_factura: { [Op.not]: null }, // CAMBIO: usar camelCase
        estado: { [Op.notIn]: ['eliminado', 'nota_credito'] }
      };
      
      if (matrizador) {
        whereConditions.id_matrizador = matrizador; // CAMBIO: usar camelCase
      }
      
      // Construir ORDER BY según el filtro
      let order = [['created_at', 'ASC']]; // Por defecto más antiguos
      if (ordenar === 'monto') {
        order = [['valor_factura', 'DESC']]; // CAMBIO: usar camelCase
      } else if (ordenar === 'fecha') {
        order = [['created_at', 'DESC']];
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
      
      // Calcular estadísticas por rangos de antigüedad
      const statsQuery = `
        SELECT 
          COUNT(CASE WHEN EXTRACT(DAY FROM NOW() - COALESCE(fecha_factura::timestamp, created_at)) BETWEEN 1 AND 7 THEN 1 END) as rango1_7,
          COUNT(CASE WHEN EXTRACT(DAY FROM NOW() - COALESCE(fecha_factura::timestamp, created_at)) BETWEEN 8 AND 15 THEN 1 END) as rango8_15,
          COUNT(CASE WHEN EXTRACT(DAY FROM NOW() - COALESCE(fecha_factura::timestamp, created_at)) BETWEEN 16 AND 60 THEN 1 END) as rango16_60,
          COUNT(CASE WHEN EXTRACT(DAY FROM NOW() - COALESCE(fecha_factura::timestamp, created_at)) > 60 THEN 1 END) as rango60,
          SUM(CASE WHEN EXTRACT(DAY FROM NOW() - COALESCE(fecha_factura::timestamp, created_at)) BETWEEN 1 AND 7 THEN valor_factura ELSE 0 END) as monto1_7,
          SUM(CASE WHEN EXTRACT(DAY FROM NOW() - COALESCE(fecha_factura::timestamp, created_at)) BETWEEN 8 AND 15 THEN valor_factura ELSE 0 END) as monto8_15,
          SUM(CASE WHEN EXTRACT(DAY FROM NOW() - COALESCE(fecha_factura::timestamp, created_at)) BETWEEN 16 AND 60 THEN valor_factura ELSE 0 END) as monto16_60,
          SUM(CASE WHEN EXTRACT(DAY FROM NOW() - COALESCE(fecha_factura::timestamp, created_at)) > 60 THEN valor_factura ELSE 0 END) as monto60,
          COUNT(*) as totalPendientes
        FROM documentos
        WHERE estado_pago = 'pendiente'
        AND numero_factura IS NOT NULL
        AND estado NOT IN ('eliminado', 'nota_credito')
        ${matrizador ? `AND id_matrizador = ${matrizador}` : ''}
      `;
      
      const stats = await sequelize.query(statsQuery, {
        type: sequelize.QueryTypes.SELECT
      });
      
      const statsResult = stats[0];
      
      // Obtener lista de matrizadores para filtros
      const matrizadores = await Matrizador.findAll({
        where: {
          rol: {
            [Op.in]: ['matrizador', 'caja_archivo'] // CAMBIO: incluir caja_archivo
          },
          activo: true
        },
        attributes: ['id', 'nombre'],
        order: [['nombre', 'ASC']]
      });
      
      // Agregar días de antigüedad a cada documento
      const documentosConDatos = documentosPendientes.map(doc => {
        // Usar fechaFactura para calcular días de atraso (no created_at)
        const fechaBase = doc.fecha_factura || doc.created_at;
        const diasAntiguedad = moment().diff(moment(fechaBase), 'days');
        return {
          ...doc.toJSON(),
          diasAntiguedad,
          matrizador: doc.matrizador?.nombre || 'Sin asignar'
        };
      });
      
      // Renderizar la vista con los datos - ADAPTADO PARA CAJA
      res.render('caja/reportes/pendientes', {
        layout: 'caja', // CAMBIO: usar layout de caja
        title: 'Reporte de Pagos Atrasados',
        activeReportes: true,
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre,
        documentosPendientes: documentosConDatos,
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
        }
      });
    } catch (error) {
      console.error('Error al generar reporte de documentos pendientes:', error);
      return res.status(500).render('error', {
        layout: 'caja', // CAMBIO: usar layout de caja
        title: 'Error',
        message: 'Error al generar el reporte de documentos pendientes',
        error
      });
    }
  },

  /**
   * IMPORTADO DESDE ADMIN: Reporte de cobros por matrizador funcional
   */
  reporteCobrosMatrizador: async (req, res) => {
    try {
      // Procesar parámetros de filtrado
      const rango = req.query.rango || 'mes';
      const idMatrizador = req.query.idMatrizador; // Filtro por matrizador específico
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
      
      // Consulta principal: cobros por matrizador usando fecha_pago
      let whereMatrizador = '';
      if (idMatrizador && idMatrizador !== 'todos' && idMatrizador !== '') {
        whereMatrizador = `AND m.id = ${parseInt(idMatrizador)}`;
      }
      
      const cobrosMatrizadorQuery = `
        SELECT 
          m.id,
          m.nombre,
          m.email,
          COUNT(d.id) as documentos_cobrados,
          COALESCE(SUM(d.valor_factura), 0) as total_cobrado,
          COALESCE(AVG(d.valor_factura), 0) as promedio_por_documento,
          MIN(d.fecha_ultimo_pago) as primer_cobro,
          MAX(d.fecha_ultimo_pago) as ultimo_cobro
        FROM matrizadores m
        LEFT JOIN documentos d ON m.id = d.id_matrizador
          AND d.estado_pago IN ('pagado_completo', 'pagado_con_retencion')
          AND d.fecha_ultimo_pago BETWEEN :fechaInicio AND :fechaFin
          AND d.estado NOT IN ('eliminado', 'nota_credito')
        WHERE m.rol IN ('matrizador', 'caja_archivo')
        AND m.activo = true
        ${whereMatrizador}
        GROUP BY m.id, m.nombre, m.email
        ORDER BY total_cobrado DESC
      `;
      
      const cobrosMatrizador = await sequelize.query(cobrosMatrizadorQuery, {
        replacements: { fechaInicio: fechaInicioSQL, fechaFin: fechaFinSQL },
        type: sequelize.QueryTypes.SELECT
      });
      
      // Estadísticas generales del período
      const totalCobradoPeriodo = cobrosMatrizador.reduce((sum, item) => sum + parseFloat(item.total_cobrado || 0), 0);
      const totalDocumentosCobrados = cobrosMatrizador.reduce((sum, item) => sum + parseInt(item.documentos_cobrados || 0), 0);
      const promedioGeneral = totalDocumentosCobrados > 0 ? totalCobradoPeriodo / totalDocumentosCobrados : 0;
      
      // Obtener detalles de cobros recientes (últimos 20)
      let whereDetalles = `
        WHERE d.estado_pago IN ('pagado_completo', 'pagado_con_retencion')
        AND d.fecha_ultimo_pago BETWEEN :fechaInicio AND :fechaFin
        AND d.estado NOT IN ('eliminado', 'nota_credito')
      `;
      if (idMatrizador && idMatrizador !== 'todos' && idMatrizador !== '') {
        whereDetalles += ` AND d.id_matrizador = ${parseInt(idMatrizador)}`;
      }
      
      const cobrosRecientesQuery = `
        SELECT 
          d.id,
          d.codigo_barras,
          d.tipo_documento,
          d.nombre_cliente,
          d.valor_factura,
          d.fecha_ultimo_pago,
          d.metodo_pago,
          m.nombre as matrizador_nombre
        FROM documentos d
        JOIN matrizadores m ON d.id_matrizador = m.id
        ${whereDetalles}
        ORDER BY d.fecha_ultimo_pago DESC
        LIMIT 20
      `;
      
      const cobrosRecientes = await sequelize.query(cobrosRecientesQuery, {
        replacements: { fechaInicio: fechaInicioSQL, fechaFin: fechaFinSQL },
        type: sequelize.QueryTypes.SELECT
      });
      
      // Obtener todos los matrizadores para el filtro
      const matrizadores = await Matrizador.findAll({
        attributes: ['id', 'nombre'],
        where: { 
          activo: true, 
          rol: {
            [Op.in]: ['matrizador', 'caja_archivo']
          }
        },
        order: [['nombre', 'ASC']],
        raw: true
      });
      
      // Obtener información del matrizador seleccionado
      let matrizadorSeleccionado = null;
      if (idMatrizador && idMatrizador !== 'todos' && idMatrizador !== '') {
        matrizadorSeleccionado = await Matrizador.findByPk(parseInt(idMatrizador), {
          attributes: ['id', 'nombre', 'email']
        });
      }
      
      // Preparar datos para gráfico
      const datosGrafico = {
        nombres: cobrosMatrizador.map(item => item.nombre),
        montos: cobrosMatrizador.map(item => parseFloat(item.total_cobrado || 0)),
        documentos: cobrosMatrizador.map(item => parseInt(item.documentos_cobrados || 0))
      };
      
      // Preparar datos para la vista - ADAPTADO PARA CAJA
      const datosVista = {
        layout: 'caja', // CAMBIO: usar layout de caja
        title: 'Reporte de Comisiones por Matrizador',
        activeReportes: true,
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre,
        
        // Datos principales
        cobrosMatrizador,
        cobrosRecientes,
        matrizadores,
        datosGrafico,
        
        // Información del contexto
        periodoTexto,
        matrizadorSeleccionado,
        idMatrizadorSeleccionado: idMatrizador || 'todos',
        
        // Estadísticas mejoradas
        stats: {
          totalCobradoPeriodo: formatearValorMonetario(totalCobradoPeriodo),
          totalDocumentosCobrados,
          promedioGeneral: formatearValorMonetario(promedioGeneral),
          matrizadoresActivos: cobrosMatrizador.filter(m => parseInt(m.documentos_cobrados) > 0).length
        },
        
        // Filtros con información adicional
        filtros: {
          rango,
          idMatrizador,
          fechaInicio: fechaInicio.format('YYYY-MM-DD'),
          fechaFin: fechaFin.format('YYYY-MM-DD'),
          // Flags para la vista
          esHoy: rango === 'hoy',
          esAyer: rango === 'ayer',
          esSemana: rango === 'semana',
          esMes: rango === 'mes',
          esUltimoMes: rango === 'ultimo_mes',
          esPersonalizado: rango === 'personalizado'
        }
      };
      
      // Renderizar la vista con datos mejorados
      res.render('caja/reportes/cobros-matrizador', datosVista);
      
    } catch (error) {
      console.error('Error al generar reporte de cobros por matrizador:', error);
      return res.status(500).render('error', {
        layout: 'caja', // CAMBIO: usar layout de caja
        title: 'Error',
        message: 'Error al generar el reporte de cobros por matrizador',
        error
      });
    }
  },

  /**
   * CRÍTICO: Procesar XML de documento para extraer datos Y MOSTRAR VISTA PREVIA (NO registro automático)
   */
  procesarXMLDocumento: async (req, res) => {
    const fs = require('fs');
    const xml2js = require('xml2js');
    
    try {
      console.log('🔍 Procesando XML de documento para vista previa...');
      
      if (!req.file) {
        return res.status(400).json({
          success: false, 
          message: 'No se recibió ningún archivo XML'
        });
      }

      console.log('📁 Archivo recibido:', req.file.originalname);
      console.log('📍 Ruta temporal:', req.file.path);

      // Leer el archivo XML
      const xmlContent = fs.readFileSync(req.file.path, 'utf8');
      console.log('📄 Contenido XML leído, tamaño:', xmlContent.length, 'caracteres');

      // Parsear XML
      const parser = new xml2js.Parser({ explicitArray: false });
      const result = await parser.parseStringPromise(xmlContent);
      
      console.log('✅ XML parseado exitosamente');
      console.log('🔍 Estructura raíz:', Object.keys(result));

      // Extraer datos del XML de factura electrónica
      let datosExtraidos = {};
      
      // Buscar en diferentes estructuras posibles
      if (result.factura) {
        datosExtraidos = extraerDatosFactura(result.factura);
      } else if (result.comprobanteRetencion) {
        datosExtraidos = extraerDatosRetencion(result.comprobanteRetencion);
      } else if (result.autorizacion) {
        datosExtraidos = extraerDatosAutorizacion(result.autorizacion);
      } else {
        // Buscar en el primer nivel
        const primerNivel = Object.keys(result)[0];
        datosExtraidos = extraerDatosGenericos(result[primerNivel]);
      }

      console.log('📊 Datos extraídos:', datosExtraidos);

      // Usar el código de libro si está disponible, sino generar uno temporal
      let codigoDocumento;
      if (datosExtraidos.codigoLibro) {
        codigoDocumento = datosExtraidos.codigoLibro;
        console.log('✅ Usando código de libro del XML:', codigoDocumento);
      } else {
        // Generar código temporal para vista previa
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 5).toUpperCase();
        codigoDocumento = `TEMP-${timestamp}-${random}`;
        console.log('⚠️ Generando código temporal para vista previa:', codigoDocumento);
      }

      // Determinar tipo de documento según letra del código de libro
      let tipoDocumento = 'Otros'; // Valor por defecto
      if (datosExtraidos.codigoLibro) {
        const letraMatch = datosExtraidos.codigoLibro.match(/[A-Z]/);
        if (letraMatch) {
          const letra = letraMatch[0];
          console.log('🔍 Letra encontrada en código de libro:', letra);
          
          switch (letra) {
            case 'P':
              tipoDocumento = 'Protocolo';
              break;
            case 'D':
              tipoDocumento = 'Diligencias';
              break;
            case 'C':
              tipoDocumento = 'Certificaciones';
              break;
            case 'A':
              tipoDocumento = 'Arrendamientos';
              break;
            default:
              tipoDocumento = 'Otros';
          }
          console.log('✅ Tipo de documento determinado:', tipoDocumento);
        }
      }

      // Buscar matrizador por nombre si está en el XML
      let matrizadorSugerido = null;
      if (datosExtraidos.nombreMatrizador) {
        console.log('🔍 Buscando matrizador por nombre:', datosExtraidos.nombreMatrizador);
        matrizadorSugerido = await Matrizador.findOne({
          where: {
            nombre: {
              [Op.iLike]: `%${datosExtraidos.nombreMatrizador}%`
            },
            activo: true,
            rol: {
              [Op.in]: ['matrizador', 'caja_archivo']
            }
          }
        });
        
        if (matrizadorSugerido) {
          console.log('✅ Matrizador encontrado:', matrizadorSugerido.nombre);
        } else {
          console.log('⚠️ Matrizador no encontrado en sistema');
        }
      }

      // Obtener todos los matrizadores para la vista de selección
      const matrizadores = await Matrizador.findAll({
        where: { 
          activo: true,
          rol: {
            [Op.in]: ['matrizador', 'caja_archivo']
          }
        },
        order: [['nombre', 'ASC']]
      });

      // Limpiar archivo temporal
      fs.unlinkSync(req.file.path);
      console.log('🗑️ Archivo temporal eliminado');

      // RESPUESTA CON DATOS PARA VISTA PREVIA (NO registro automático)
      res.json({
        success: true,
        message: 'XML procesado exitosamente - Confirme los datos antes del registro',
        vistaPrevia: true,
        datosExtraidos: {
          // Datos principales del documento
          codigoBarras: codigoDocumento,
          tipoDocumento: tipoDocumento,
          
          // Información del cliente
          nombreCliente: datosExtraidos.nombreCliente || '',
          identificacionCliente: datosExtraidos.identificacionCliente || '',
          emailCliente: datosExtraidos.emailCliente || '',
          telefonoCliente: datosExtraidos.telefonoCliente || '',
          
          // Información financiera
          numeroFactura: datosExtraidos.numeroFactura || '',
          valorFactura: parseFloat(datosExtraidos.valorTotal || 0),
          fechaFactura: datosExtraidos.fechaEmision || '',
          
          // Información del XML
          razonSocialEmisor: datosExtraidos.razonSocial || '',
          rucEmisor: datosExtraidos.ruc || '',
          
          // Matrizador sugerido
          matrizadorSugerido: matrizadorSugerido ? {
            id: matrizadorSugerido.id,
            nombre: matrizadorSugerido.nombre
          } : null,
          nombreMatrizadorXML: datosExtraidos.nombreMatrizador || ''
        },
        matrizadores: matrizadores.map(m => ({
          id: m.id,
          nombre: m.nombre
        })),
        archivoOriginal: req.file.originalname
      });

    } catch (error) {
      console.error('❌ Error procesando XML:', error);
      
      // Limpiar archivo temporal en caso de error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.status(500).json({
        success: false, 
        message: 'Error al procesar el archivo XML: ' + error.message
      });
    }
  },

  /**
   * NUEVO: Registrar documento después de confirmación en vista previa
   */
  registrarDocumentoDesdeXML: async (req, res) => {
    try {
      console.log('🔄 Registrando documento confirmado desde XML...');
      console.log('Datos recibidos:', req.body);

      const {
        codigoBarras,
        tipoDocumento,
        nombreCliente,
        identificacionCliente,
        emailCliente,
        telefonoCliente,
        numeroFactura,
        valorFactura,
        fechaFactura,
        idMatrizador,
        observaciones
      } = req.body;

      // Validaciones básicas
      if (!codigoBarras || !tipoDocumento || !nombreCliente || !identificacionCliente) {
        return res.status(400).json({
          success: false,
          message: 'Faltan campos requeridos: código de barras, tipo de documento, nombre del cliente e identificación'
        });
      }

      // Verificar que el matrizador existe
      const matrizador = await Matrizador.findByPk(idMatrizador);
      if (!matrizador) {
        return res.status(400).json({
          success: false,
          message: 'El matrizador seleccionado no existe'
        });
      }

      // Verificar que el código de barras no exista
      const documentoExistente = await Documento.findOne({
        where: { codigoBarras: codigoBarras }
      });

      if (documentoExistente) {
        return res.status(400).json({
          success: false,
          message: `Ya existe un documento con el código de barras: ${codigoBarras}`
        });
      }

      // Registrar documento
      const nuevoDocumento = await Documento.create({
        codigoBarras: codigoBarras,
        tipoDocumento: tipoDocumento,
        nombreCliente: nombreCliente,
        identificacionCliente: identificacionCliente,
        emailCliente: emailCliente || null,
        telefonoCliente: telefonoCliente || null,
        numeroFactura: numeroFactura || null,
        valorFactura: parseFloat(valorFactura || 0),
        fechaFactura: fechaFactura ? new Date(fechaFactura) : new Date(),
        estado: 'en_proceso',
        estadoPago: 'pendiente',
        idMatrizador: idMatrizador,
        observaciones: observaciones || 'Documento registrado desde XML mediante vista previa'
      });

      console.log('✅ Documento registrado exitosamente:', nuevoDocumento.id);

      res.json({
        success: true,
        message: 'Documento registrado exitosamente',
        documento: {
          id: nuevoDocumento.id,
          codigoBarras: nuevoDocumento.codigoBarras,
          tipoDocumento: nuevoDocumento.tipoDocumento,
          nombreCliente: nuevoDocumento.nombreCliente,
          matrizador: matrizador.nombre
        }
      });

    } catch (error) {
      console.error('❌ Error registrando documento desde XML:', error);
      res.status(500).json({
        success: false,
        message: 'Error al registrar el documento: ' + error.message
      });
    }
  },

  /**
   * RESTAURADO: Reporte de documentos (placeholder funcional)
   */
  reporteDocumentos: async (req, res) => {
    try {
      res.render('caja/reportes/documentos', {
        layout: 'caja',
        title: 'Reporte de Documentos',
        activeReportes: true,
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre,
        message: 'Funcionalidad en desarrollo - Próximamente disponible'
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
   * RESTAURADO: Listado de pagos
   */
  listarPagos: async (req, res) => {
    try {
      // Obtener pagos recientes
      const pagos = await Documento.findAll({
        where: {
          estado_pago: 'pagado', // CORREGIDO: usar camelCase
          numero_factura: { [Op.not]: null }, // CORREGIDO: usar camelCase
          estado: { [Op.notIn]: ['eliminado', 'nota_credito', 'cancelado'] }
        },
        include: [
          {
            model: Matrizador,
            as: 'matrizador',
            attributes: ['id', 'nombre', 'email']
          }
        ],
        order: [['fecha_pago', 'DESC']], // CORREGIDO: usar camelCase
        limit: 50
      });

      res.render('caja/pagos/listado', {
        layout: 'caja',
        title: 'Gestión de Pagos',
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre,
        pagos
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
};

// Funciones auxiliares para extraer datos del XML
function extraerDatosFactura(factura) {
  console.log('🔍 Extrayendo datos de factura...');
  console.log('Estructura completa de factura:', JSON.stringify(factura, null, 2));
  
  const datos = {
    tipoDocumento: 'factura',
    numeroFactura: factura.infoTributaria?.estab + '-' + factura.infoTributaria?.ptoEmi + '-' + factura.infoTributaria?.secuencial,
    nombreCliente: factura.infoFactura?.razonSocialComprador || 'Cliente no especificado',
    identificacionCliente: factura.infoFactura?.identificacionComprador,
    fechaEmision: factura.infoFactura?.fechaEmision,
    valorTotal: parseFloat(factura.infoFactura?.importeTotal || 0),
    razonSocial: factura.infoTributaria?.razonSocial,
    ruc: factura.infoTributaria?.ruc
  };
  
  // NUEVO: Extraer información adicional específica del sistema notarial
  if (factura.infoAdicional) {
    console.log('✅ Encontrada sección infoAdicional:', factura.infoAdicional);
    
    // La infoAdicional puede ser un array de objetos o un objeto
    let camposAdicionales = [];
    if (Array.isArray(factura.infoAdicional)) {
      camposAdicionales = factura.infoAdicional;
    } else if (factura.infoAdicional.campoAdicional) {
      // Si hay un solo campo, convertir a array
      camposAdicionales = Array.isArray(factura.infoAdicional.campoAdicional) ? 
        factura.infoAdicional.campoAdicional : [factura.infoAdicional.campoAdicional];
    }
    
    console.log('📋 Campos adicionales encontrados:', camposAdicionales);
    
    // Procesar cada campo adicional
    camposAdicionales.forEach(campo => {
      if (campo && campo.$ && campo.$.nombre) {
        const nombre = campo.$.nombre.toUpperCase();
        const valor = campo._ || campo;
        
        console.log(`🔍 Campo: ${nombre} = ${valor}`);
        
        switch (nombre) {
          case 'NÚMERO DE LIBRO':
          case 'NUMERO DE LIBRO':
            datos.codigoLibro = valor; // Este es el verdadero código de barras
            console.log('✅ Código de libro encontrado:', valor);
            break;
          case 'MATRIZADOR':
            datos.nombreMatrizador = valor;
            console.log('✅ Matrizador encontrado:', valor);
            break;
          case 'EMAIL CLIENTE':
            datos.emailCliente = valor;
            console.log('✅ Email cliente encontrado:', valor);
            break;
          case 'TELÉFONO':
          case 'TELEFONO':
            datos.telefonoCliente = valor;
            console.log('✅ Teléfono cliente encontrado:', valor);
            break;
        }
      }
    });
  } else {
    console.log('⚠️ No se encontró sección infoAdicional en el XML');
  }
  
  console.log('📊 Datos finales extraídos:', datos);
  return datos;
}

function extraerDatosRetencion(retencion) {
  return {
    tipoDocumento: 'retencion',
    numeroComprobante: retencion.infoTributaria?.estab + '-' + retencion.infoTributaria?.ptoEmi + '-' + retencion.infoTributaria?.secuencial,
    nombreCliente: retencion.infoCompRetencion?.razonSocialSujetoRetenido || 'Cliente no especificado',
    identificacionCliente: retencion.infoCompRetencion?.identificacionSujetoRetenido,
    fechaEmision: retencion.infoCompRetencion?.fechaEmision,
    valorTotal: parseFloat(retencion.infoCompRetencion?.valorRetIva || 0) + parseFloat(retencion.infoCompRetencion?.valorRetRenta || 0),
    razonSocial: retencion.infoTributaria?.razonSocial,
    ruc: retencion.infoTributaria?.ruc
  };
}

function extraerDatosAutorizacion(autorizacion) {
  // Si viene dentro de una autorización, buscar el comprobante interno
  const comprobante = autorizacion.comprobante || autorizacion;
  
  if (typeof comprobante === 'string') {
    // Si el comprobante es un string XML, parsearlo
    const xml2js = require('xml2js');
    const parser = new xml2js.Parser({ explicitArray: false });
    
    return parser.parseStringPromise(comprobante).then(result => {
      if (result.factura) {
        return extraerDatosFactura(result.factura);
      } else if (result.comprobanteRetencion) {
        return extraerDatosRetencion(result.comprobanteRetencion);
      }
      return extraerDatosGenericos(result);
    });
  }
  
  return extraerDatosGenericos(comprobante);
}

function extraerDatosGenericos(datos) {
  return {
    tipoDocumento: 'documento',
    numeroFactura: 'XML-' + Date.now(),
    nombreCliente: 'Cliente desde XML',
    identificacionCliente: '',
    fechaEmision: new Date().toISOString().split('T')[0],
    valorTotal: 0,
    razonSocial: 'Empresa desde XML',
    ruc: '',
    datosOriginales: datos
  };
}

// NUEVA FUNCIÓN: Extraer datos específicos de XMLs de retención
function extraerDatosRetencionXML(comprobanteRetencion) {
  console.log('🔍 Extrayendo datos de comprobante de retención...');
  console.log('Estructura completa:', JSON.stringify(comprobanteRetencion, null, 2));
  
  const datos = {};
  
  // Información tributaria (empresa que retiene)
  if (comprobanteRetencion.infoTributaria) {
    datos.razonSocialRetenedora = comprobanteRetencion.infoTributaria.razonSocial || '';
    datos.rucRetenedor = comprobanteRetencion.infoTributaria.ruc || '';
    
    // Construir número de comprobante de retención
    const estab = comprobanteRetencion.infoTributaria.estab || '';
    const ptoEmi = comprobanteRetencion.infoTributaria.ptoEmi || '';
    const secuencial = comprobanteRetencion.infoTributaria.secuencial || '';
    
    if (estab && ptoEmi && secuencial) {
      datos.numeroComprobanteRetencion = `${estab}-${ptoEmi}-${secuencial}`;
    }
    
    console.log('✅ Info tributaria extraída:', {
      razonSocial: datos.razonSocialRetenedora,
      ruc: datos.rucRetenedor,
      comprobante: datos.numeroComprobanteRetencion
    });
  }
  
  // Información del comprobante
  if (comprobanteRetencion.infoCompRetencion) {
    datos.fechaRetencion = comprobanteRetencion.infoCompRetencion.fechaEmision || '';
    datos.razonSocialSujetoRetenido = comprobanteRetencion.infoCompRetencion.razonSocialSujetoRetenido || '';
    datos.identificacionSujetoRetenido = comprobanteRetencion.infoCompRetencion.identificacionSujetoRetenido || '';
    
    console.log('✅ Info comprobante extraída:', {
      fecha: datos.fechaRetencion,
      sujetoRetenido: datos.razonSocialSujetoRetenido,
      identificacion: datos.identificacionSujetoRetenido
    });
  }
  
  // Documentos sustento (facturas relacionadas)
  if (comprobanteRetencion.docsSustento && comprobanteRetencion.docsSustento.docSustento) {
    const docSustento = comprobanteRetencion.docsSustento.docSustento;
    
    // Puede ser un objeto o array, normalizar a array
    const docsSustento = Array.isArray(docSustento) ? docSustento : [docSustento];
    
    // Tomar el primer documento sustento
    if (docsSustento.length > 0) {
      const primerDoc = docsSustento[0];
      datos.numeroFactura = primerDoc.numDocSustento || '';
      datos.fechaFactura = primerDoc.fechaEmisionDocSustento || '';
      datos.importeTotal = parseFloat(primerDoc.importeTotal || 0);
      
      console.log('✅ Documento sustento extraído:', {
        factura: datos.numeroFactura,
        fecha: datos.fechaFactura,
        importe: datos.importeTotal
      });
      
      // Extraer retenciones específicas
      if (primerDoc.retenciones && primerDoc.retenciones.retencion) {
        const retenciones = Array.isArray(primerDoc.retenciones.retencion) ? 
          primerDoc.retenciones.retencion : [primerDoc.retenciones.retencion];
        
        datos.retencionIva = 0;
        datos.retencionRenta = 0;
        
        retenciones.forEach(retencion => {
          const codigo = parseInt(retencion.codigo || 0);
          const valorRetenido = parseFloat(retencion.valorRetenido || 0);
          
          console.log(`🔍 Procesando retención: código=${codigo}, valor=${valorRetenido}`);
          
          if (codigo === 2) {
            // Código 2 = Retención IVA
            datos.retencionIva += valorRetenido;
            console.log(`✅ Retención IVA: +${valorRetenido} = ${datos.retencionIva}`);
          } else if (codigo === 1) {
            // Código 1 = Retención Renta
            datos.retencionRenta += valorRetenido;
            console.log(`✅ Retención Renta: +${valorRetenido} = ${datos.retencionRenta}`);
          }
        });
        
        // Calcular total retenido
        datos.totalRetenido = datos.retencionIva + datos.retencionRenta;
        
        console.log('📊 Retenciones calculadas:', {
          iva: datos.retencionIva,
          renta: datos.retencionRenta,
          total: datos.totalRetenido
        });
      }
    }
  }
  
  // Validar datos mínimos
  if (!datos.numeroComprobanteRetencion) {
    console.log('⚠️ No se pudo extraer número de comprobante');
  }
  
  if (!datos.totalRetenido || datos.totalRetenido <= 0) {
    console.log('⚠️ No se encontraron retenciones válidas');
  }
  
  console.log('📋 Datos finales de retención:', datos);
  return datos;
}

module.exports = cajaController;