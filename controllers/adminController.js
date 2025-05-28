/**
 * Controlador para la interfaz administrativa del sistema
 * SIMPLIFICADO - Solo consultas que funcionan con campos reales
 */

const Documento = require('../models/Documento');
const Matrizador = require('../models/Matrizador');
const EventoDocumento = require('../models/EventoDocumento');
const RegistroAuditoria = require('../models/RegistroAuditoria');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');
const moment = require('moment');
const { 
  obtenerTimestampEcuador,
  convertirRangoParaSQL,
  formatearTimestamp,
  formatearFechaSinHora,
  formatearValorMonetario
} = require('../utils/documentoUtils');

// NUEVO: Importar sistema de logging
const { logger, logDashboard, logQuery } = require('../utils/logger');

/**
 * Dashboard Administrativo REALMENTE ÚTIL
 * Diseñado para identificar problemas urgentes y tomar decisiones informadas
 */
exports.dashboard = async (req, res) => {
  try {
    // 🔍 INICIO DE DEBUGGING - Dashboard Útil
    logger.separator('DASHBOARD', 'DASHBOARD ADMIN REALMENTE ÚTIL');
    logger.start('DASHBOARD', 'cargarDashboardUtil', {
      usuario: req.matrizador?.nombre || 'admin'
    });
    
    // ============== PROCESAR FILTROS DE PERÍODO ==============
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
    
    const ahora = obtenerTimestampEcuador();
    const hoyStr = ahora.toISOString().split('T')[0];
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const hace7Dias = new Date(ahora);
    hace7Dias.setDate(hace7Dias.getDate() - 7);
    
    // Formatear fechas para consultas SQL
    const fechaInicioSQL = fechaInicio.format('YYYY-MM-DD HH:mm:ss');
    const fechaFinSQL = fechaFin.format('YYYY-MM-DD HH:mm:ss');
    
    // ============== INFORMACIÓN CRÍTICA Y URGENTE ==============
    
    // 🚨 ALERTAS CRÍTICAS
    const alertasCriticas = [];
    
    // Documentos atrasados más de 30 días sin pagar
    const documentosAtrasados = await Documento.count({
      where: {
        estado_pago: 'pendiente',
        numero_factura: { [Op.not]: null },
        estado: { [Op.notIn]: ['eliminado', 'nota_credito'] },
        created_at: { [Op.lt]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }
    });
    
    if (documentosAtrasados > 0) {
      alertasCriticas.push({
        tipo: 'danger',
        icono: 'fas fa-exclamation-triangle',
        titulo: `${documentosAtrasados} documentos atrasados +30 días`,
        descripcion: 'Requieren gestión de cobranza urgente',
        accion: '/admin/reportes/pendientes?antiguedad=30%2B',
        urgencia: 'alta'
      });
    }
    
    // Documentos listos para entrega hace más de 3 días
    const documentosListosViejos = await Documento.count({
      where: {
        estado: 'listo_para_entrega',
        updated_at: { [Op.lt]: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) }
      }
    });
    
    if (documentosListosViejos > 0) {
      alertasCriticas.push({
        tipo: 'warning',
        icono: 'fas fa-clock',
        titulo: `${documentosListosViejos} documentos listos sin entregar`,
        descripcion: 'Más de 3 días esperando entrega',
        accion: '/admin/documentos/listado?estado=listo_para_entrega',
        urgencia: 'media'
      });
    }
    
    // Documentos sin matrizador asignado
    const documentosSinMatrizador = await Documento.count({
      where: {
        id_matrizador: null,
        estado: { [Op.in]: ['en_proceso', 'listo_para_entrega'] }
      }
    });
    
    if (documentosSinMatrizador > 0) {
      alertasCriticas.push({
        tipo: 'info',
        icono: 'fas fa-user-slash',
        titulo: `${documentosSinMatrizador} documentos sin asignar`,
        descripcion: 'Necesitan matrizador responsable',
        accion: '/admin/documentos/listado?idMatrizador=',
        urgencia: 'baja'
      });
    }
    
    // ============== MÉTRICAS FINANCIERAS DEL PERÍODO ==============
    
    // Ingresos del período (pagos registrados en el período)
    const [ingresosPeriodoResult] = await sequelize.query(`
      SELECT COALESCE(SUM(valor_factura), 0) as total
      FROM documentos
      WHERE fecha_pago BETWEEN :fechaInicio AND :fechaFin
      AND estado_pago = 'pagado'
      AND estado NOT IN ('eliminado', 'nota_credito')
    `, {
      replacements: { fechaInicio: fechaInicioSQL, fechaFin: fechaFinSQL },
      type: sequelize.QueryTypes.SELECT
    });
    const ingresosPeriodo = parseFloat(ingresosPeriodoResult.total);
    
    // Ingresos de hoy específicamente
    const [ingresosHoyResult] = await sequelize.query(`
      SELECT COALESCE(SUM(valor_factura), 0) as total
      FROM documentos
      WHERE DATE(fecha_pago) = :hoy
      AND estado_pago = 'pagado'
      AND estado NOT IN ('eliminado', 'nota_credito')
    `, {
      replacements: { hoy: hoyStr },
      type: sequelize.QueryTypes.SELECT
    });
    const ingresosHoy = parseFloat(ingresosHoyResult.total);
    
    // Documentos cobrados en el período
    const documentosCobradosPeriodo = await Documento.count({
      where: {
        estado_pago: 'pagado',
        fecha_pago: {
          [Op.between]: [fechaInicio.toDate(), fechaFin.toDate()]
        }
      }
    });

    // Documentos cobrados hoy
    const documentosCobradosHoy = await Documento.count({
      where: {
        estado_pago: 'pagado',
        fecha_pago: {
          [Op.gte]: new Date(hoyStr + 'T00:00:00'),
          [Op.lt]: new Date(hoyStr + 'T23:59:59')
        }
      }
    });
    
    // Facturación del período
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
    
    // ============== RENDIMIENTO DEL EQUIPO ==============
    
    // Productividad por matrizador (últimos 7 días)
    const productividadMatrizadores = await sequelize.query(`
      SELECT 
        m.nombre,
        COUNT(d.id) as documentos_procesados,
        SUM(CASE WHEN d.estado_pago = 'pagado' THEN d.valor_factura ELSE 0 END) as dinero_cobrado,
        SUM(CASE WHEN d.estado = 'entregado' THEN 1 ELSE 0 END) as documentos_entregados
      FROM matrizadores m
      LEFT JOIN documentos d ON m.id = d.id_matrizador
        AND d.updated_at >= :hace7Dias
        AND d.estado NOT IN ('eliminado', 'nota_credito')
      WHERE m.rol IN ('matrizador', 'caja_archivo') AND m.activo = true
      GROUP BY m.id, m.nombre
      ORDER BY documentos_procesados DESC
      LIMIT 5
    `, {
      replacements: { hace7Dias },
      type: sequelize.QueryTypes.SELECT
    });
    
    // ============== DOCUMENTOS QUE NECESITAN ATENCIÓN ==============
    
    // Documentos pendientes urgentes (más de 15 días)
    const documentosUrgentes = await Documento.findAll({
      where: {
        estado_pago: 'pendiente',
        numero_factura: { [Op.not]: null },
        estado: { [Op.notIn]: ['eliminado', 'nota_credito'] },
        created_at: { [Op.lt]: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) }
      },
      include: [{
        model: Matrizador,
        as: 'matrizador',
        attributes: ['nombre']
      }],
      order: [['created_at', 'ASC']],
      limit: 5
    });
    
    // Documentos listos para entrega
    const documentosListos = await Documento.findAll({
      where: {
        estado: 'listo_para_entrega'
      },
      include: [{
        model: Matrizador,
        as: 'matrizador',
        attributes: ['nombre']
      }],
      order: [['updated_at', 'ASC']],
      limit: 5
    });
    
    // ============== ACTIVIDAD RECIENTE RELEVANTE ==============
    
    // Últimos pagos registrados
    const ultimosPagos = await Documento.findAll({
      where: {
        estado_pago: 'pagado',
        fecha_pago: { [Op.not]: null }
      },
      attributes: ['codigo_barras', 'nombre_cliente', 'valor_factura', 'fecha_pago', 'metodo_pago'],
      order: [['fecha_pago', 'DESC']],
      limit: 5
    });
    
    // Últimas entregas
    const ultimasEntregas = await Documento.findAll({
      where: {
        estado: 'entregado',
        fecha_entrega: { [Op.not]: null }
      },
      attributes: ['codigo_barras', 'nombre_cliente', 'tipo_documento', 'fecha_entrega'],
      include: [{
        model: Matrizador,
        as: 'matrizador',
        attributes: ['nombre']
      }],
      order: [['fecha_entrega', 'DESC']],
      limit: 5
    });
    
    // ============== ESTADO GENERAL DEL SISTEMA ==============
    
    // Conteos rápidos para métricas
    const totalDocumentos = await Documento.count({
      where: { estado: { [Op.notIn]: ['eliminado', 'nota_credito'] } }
    });
    
    const enProceso = await Documento.count({
      where: { estado: 'en_proceso' }
    });
    
    const listoParaEntrega = await Documento.count({
      where: { estado: 'listo_para_entrega' }
    });
    
    const entregados = await Documento.count({
      where: { estado: 'entregado' }
    });
    
    // ============== DETERMINAR ESTADO GENERAL ==============
    
    let estadoGeneral = 'success'; // Verde por defecto
    let mensajeEstado = 'Todo funcionando correctamente';
    
    if (documentosAtrasados > 10 || documentosListosViejos > 5) {
      estadoGeneral = 'danger';
      mensajeEstado = 'Atención requerida urgente';
    } else if (documentosAtrasados > 0 || documentosListosViejos > 0) {
      estadoGeneral = 'warning';
      mensajeEstado = 'Algunos problemas requieren atención';
    }
    
    // ============== PREPARAR DATOS PARA LA VISTA ==============
    
    const dashboardData = {
      // Alertas críticas
      alertasCriticas,
      estadoGeneral,
      mensajeEstado,
      
      // Métricas principales
      metricas: {
        totalDocumentos,
        enProceso,
        listoParaEntrega,
        entregados,
        documentosAtrasados,
        documentosUrgentes: documentosUrgentes.length
      },
      
      // Métricas financieras
      finanzas: {
        ingresosPeriodo: ingresosPeriodo.toFixed(2),
        ingresosHoy: ingresosHoy.toFixed(2),
        documentosCobradosPeriodo,
        documentosCobradosHoy,
        facturacionPeriodo: facturacionPeriodo.toFixed(2)
      },
      
      // Rendimiento del equipo
      equipoRendimiento: productividadMatrizadores,
      
      // Documentos que requieren atención
      documentosUrgentes,
      documentosListos,
      
      // Actividad reciente
      ultimosPagos,
      ultimasEntregas
    };
    
    logDashboard('DASHBOARD_UTIL_CARGADO', 'completo', {
      alertas: alertasCriticas.length,
      estadoGeneral,
      documentosUrgentes: documentosUrgentes.length,
      ingresosPeriodo,
      equipoActivo: productividadMatrizadores.filter(m => m.documentos_procesados > 0).length
    });
    
    logger.end('DASHBOARD', 'cargarDashboardUtil', {
      exitoso: true,
      alertasCriticas: alertasCriticas.length,
      estadoGeneral
    });
    
    // Total pendiente de cobro (global, no del período)
    const [totalPendienteResult] = await sequelize.query(`
      SELECT COALESCE(SUM(valor_factura), 0) as total
      FROM documentos
      WHERE estado_pago = 'pendiente'
      AND numero_factura IS NOT NULL
      AND estado NOT IN ('eliminado', 'nota_credito')
    `, {
      type: sequelize.QueryTypes.SELECT
    });
    const totalPendiente = parseFloat(totalPendienteResult.total);
    
    res.render('admin/dashboard-util', {
      layout: 'admin',
      title: 'Panel de Control - Administrativo',
      activeDashboard: true,
      
      // Datos del período seleccionado
      periodo: {
        rango: req.params.periodo || req.query.rango || 'mes',
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
      
      ...dashboardData,
      
      // Actualizar métricas financieras
      finanzas: {
        ...dashboardData.finanzas,
        totalPendiente: totalPendiente.toFixed(2)
      }
    });
  } catch (error) {
    logger.error('DASHBOARD', 'Error al cargar dashboard útil', error);
    res.status(500).render('error', {
      layout: 'admin',
      title: 'Error',
      message: 'Ha ocurrido un error al cargar el dashboard',
      error
    });
  }
};

/**
 * Función auxiliar para obtener datos de volumen de documentos para gráfico
 * SIMPLIFICADA - Solo usar created_at
 */
async function obtenerDatosVolumen(fechaInicio, fechaFin) {
  // Determinar unidad de tiempo según rango de fechas
  const diffDays = Math.ceil((fechaFin - fechaInicio) / (1000 * 60 * 60 * 24));
  let unidadTiempo, formatoAgrupacion, formatoFecha;
  
  if (diffDays <= 1) {
    unidadTiempo = 'hour';
    formatoAgrupacion = "date_trunc('hour', created_at)";
    formatoFecha = "YYYY-MM-DD HH24:00";
  } else if (diffDays <= 31) {
    unidadTiempo = 'day';
    formatoAgrupacion = "date_trunc('day', created_at)";
    formatoFecha = "YYYY-MM-DD";
  } else if (diffDays <= 90) {
    unidadTiempo = 'week';
    formatoAgrupacion = "date_trunc('week', created_at)";
    formatoFecha = "YYYY-WW";
  } else {
    unidadTiempo = 'month';
    formatoAgrupacion = "date_trunc('month', created_at)";
    formatoFecha = "YYYY-MM";
  }
  
  // Consulta SQL para nuevos documentos por período (usar created_at = cuando se registraron)
  const datosNuevos = await sequelize.query(`
    SELECT 
      to_char(${formatoAgrupacion}, '${formatoFecha}') as fecha,
      COUNT(*) as total
    FROM documentos
    WHERE created_at BETWEEN :fechaInicio AND :fechaFin
    AND estado IN ('en_proceso', 'listo_para_entrega', 'entregado')
    GROUP BY ${formatoAgrupacion}
    ORDER BY ${formatoAgrupacion}
  `, {
    replacements: { fechaInicio, fechaFin },
    type: sequelize.QueryTypes.SELECT
  });
  
  // Consulta SQL para documentos entregados por período (usar fecha_entrega)
  const datosEntregados = await sequelize.query(`
    SELECT 
      to_char(${formatoAgrupacion.replace('created_at', 'fecha_entrega')}, '${formatoFecha}') as fecha,
      COUNT(*) as total
    FROM documentos
    WHERE estado = 'entregado'
      AND fecha_entrega BETWEEN :fechaInicio AND :fechaFin
    GROUP BY ${formatoAgrupacion.replace('created_at', 'fecha_entrega')}
    ORDER BY ${formatoAgrupacion.replace('created_at', 'fecha_entrega')}
  `, {
    replacements: { fechaInicio, fechaFin },
    type: sequelize.QueryTypes.SELECT
  });
  
  // Generar lista completa de fechas en el rango
  const fechas = [];
  const nuevos = [];
  const entregados = [];
  
  // Generar series de fechas según la unidad de tiempo
  let fechaActual = new Date(fechaInicio);
  while (fechaActual <= fechaFin) {
    let fecha;
    if (unidadTiempo === 'hour') {
      fecha = fechaActual.toISOString().substring(0, 13) + ":00";
      fechaActual.setHours(fechaActual.getHours() + 1);
    } else if (unidadTiempo === 'day') {
      fecha = fechaActual.toISOString().substring(0, 10);
      fechaActual.setDate(fechaActual.getDate() + 1);
    } else if (unidadTiempo === 'week') {
      const year = fechaActual.getFullYear();
      const onejan = new Date(year, 0, 1);
      const weekNum = Math.ceil(((fechaActual - onejan) / 86400000 + onejan.getDay() + 1) / 7);
      fecha = `${year}-W${weekNum.toString().padStart(2, '0')}`;
      fechaActual.setDate(fechaActual.getDate() + 7);
    } else {
      fecha = fechaActual.toISOString().substring(0, 7);
      fechaActual.setMonth(fechaActual.getMonth() + 1);
    }
    
    fechas.push(fecha);
    
    const nuevoItem = datosNuevos.find(item => item.fecha === fecha);
    nuevos.push(nuevoItem ? parseInt(nuevoItem.total) : 0);
    
    const entregadoItem = datosEntregados.find(item => item.fecha === fecha);
    entregados.push(entregadoItem ? parseInt(entregadoItem.total) : 0);
  }
  
  return {
    fechas,
    nuevos,
    entregados,
    unidadTiempo
  };
}

/**
 * Función auxiliar para obtener datos de documentos por matrizador
 * SIMPLIFICADA - Solo usar created_at
 */
async function obtenerDatosMatrizador(fechaInicio, fechaFin) {
  // Consulta SQL para documentos por matrizador (usar created_at para consistencia)
  const datos = await sequelize.query(`
    SELECT 
      m.id as id_matrizador,
      m.nombre as nombre_matrizador,
      COUNT(d.id) as total_documentos
    FROM documentos d
    LEFT JOIN matrizadores m ON d.id_matrizador = m.id
    WHERE d.created_at BETWEEN :fechaInicio AND :fechaFin
    AND d.estado IN ('en_proceso', 'listo_para_entrega', 'entregado')
    GROUP BY m.id, m.nombre
    ORDER BY total_documentos DESC
    LIMIT 10
  `, {
    replacements: { fechaInicio, fechaFin },
    type: sequelize.QueryTypes.SELECT
  });
  
  // Extraer nombres y totales para el gráfico
  const nombres = datos.map(item => item.nombre_matrizador || 'Sin asignar');
  const documentos = datos.map(item => parseInt(item.total_documentos));
  
  return {
    nombres,
    documentos
  };
}

/**
 * Función auxiliar para obtener datos de documentos por tipo
 * SIMPLIFICADA - Solo usar created_at
 */
async function obtenerDatosTipoDocumento(fechaInicio, fechaFin) {
  // Consulta SQL para documentos por tipo (usar created_at para consistencia)
  const datos = await sequelize.query(`
    SELECT 
      tipo_documento,
      COUNT(*) as total
    FROM documentos
    WHERE created_at BETWEEN :fechaInicio AND :fechaFin
    AND estado IN ('en_proceso', 'listo_para_entrega', 'entregado')
    GROUP BY tipo_documento
    ORDER BY total DESC
  `, {
    replacements: { fechaInicio, fechaFin },
    type: sequelize.QueryTypes.SELECT
  });
  
  // Extraer tipos y totales para el gráfico
  const nombres = datos.map(item => item.tipo_documento || 'Sin tipo');
  const documentos = datos.map(item => parseInt(item.total));
  
  return {
    nombres,
    documentos
  };
}

/**
 * Muestra la página de reportes y estadísticas
 * CORREGIDO: Manejar diferentes tipos de reporte con el parámetro :tipo
 */
exports.reportes = async (req, res) => {
  try {
    // Obtener parámetros de filtro
    const tipo = req.params.tipo || req.query.tipo; // CORREGIDO: No asignar valor por defecto
    const fechaInicio = req.query.fechaInicio ? moment(req.query.fechaInicio).startOf('day') : moment().subtract(30, 'days').startOf('day');
    const fechaFin = req.query.fechaFin ? moment(req.query.fechaFin).endOf('day') : moment().endOf('day');
    const idMatrizador = req.query.idMatrizador || '';
    const estado = req.query.estado || '';
    const formato = req.query.formato || 'web'; // web o excel
    
    // Obtener matrizadores para filtros
    const matrizadores = await Matrizador.findAll({
      order: [['nombre', 'ASC']]
    });
    
    // NUEVO: Si no hay tipo específico, mostrar página de índice de reportes
    if (!tipo) {
      return res.render('admin/reportes', {
        layout: 'admin',
        title: 'Reportes y Estadísticas',
        activeReportes: true,
        matrizadores,
        filtros: {
          rango: req.query.rango || 'mes',
          fechaInicio: fechaInicio.format('YYYY-MM-DD'),
          fechaFin: fechaFin.format('YYYY-MM-DD'),
          idMatrizador,
          estado
        },
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre
        // NO pasar vistaPartial para mostrar las tarjetas de reportes
      });
    }
    
    // Condiciones base para consultas (solo si hay tipo específico)
    const condiciones = {
      created_at: {
        [Op.between]: [fechaInicio.toDate(), fechaFin.toDate()]
      }
    };
    
    // Añadir filtros opcionales si están presentes en la URL
    if (idMatrizador) {
      condiciones.idMatrizador = idMatrizador;
    }
    
    if (estado) {
      condiciones.estado = estado;
    }
    
    let datosReporte = {}; // Objeto para almacenar los datos específicos del reporte
    let reporteTitulo = '';
    let vistaPartial = ''; // Partial a renderizar dentro de la página principal

    // Generar reportes según el tipo seleccionado
    switch (tipo) {
      case 'estado':
        reporteTitulo = 'Reporte de Documentos por Estado';
        vistaPartial = 'admin/reportes/partials/estado';
        
        // Lógica existente para reporte por estado
        const estadisticasEstado = await Documento.findAll({
          where: condiciones,
          attributes: [
            'estado',
            [sequelize.fn('COUNT', sequelize.col('Documento.id')), 'count']
          ],
          group: ['estado'],
          raw: true
        });
        
        const totalDocumentosEstado = estadisticasEstado.reduce((sum, item) => sum + parseInt(item.count), 0);
        
        datosReporte.resultados = estadisticasEstado.map(item => ({
          _id: item.estado,
          count: parseInt(item.count),
          porcentaje: Math.round((parseInt(item.count) / totalDocumentosEstado) * 100)
        }));
        
        datosReporte.totales = { count: totalDocumentosEstado };
        break;
        
      case 'matrizador':
        reporteTitulo = 'Reporte de Documentos por Matrizador';
        vistaPartial = 'admin/reportes/partials/matrizador';
        
        // Lógica existente para reporte por matrizador
        const estadisticasMatrizador = await Documento.findAll({
          where: condiciones,
          attributes: [
            'idMatrizador',
            [sequelize.fn('COUNT', sequelize.col('Documento.id')), 'count']
          ],
          include: [{
            model: Matrizador,
            as: 'matrizador',
            attributes: ['nombre']
          }],
          group: ['idMatrizador', 'matrizador.id'],
          raw: true
        });
        
        const totalDocumentosMatrizador = estadisticasMatrizador.reduce((sum, item) => sum + parseInt(item.count), 0);
        
        datosReporte.resultados = estadisticasMatrizador.map(item => ({
          _id: item.idMatrizador,
          nombre: item['matrizador.nombre'] || 'Sin asignar',
          count: parseInt(item.count),
          porcentaje: totalDocumentosMatrizador > 0 ? Math.round((parseInt(item.count) / totalDocumentosMatrizador) * 100) : 0
        }));
        
        datosReporte.totales = { count: totalDocumentosMatrizador };
        break;
        
      case 'fecha':
        reporteTitulo = 'Reporte de Documentos por Fecha';
        vistaPartial = 'admin/reportes/partials/fecha';

        // Lógica existente para reporte por fecha
        const documentosPorFecha = await Documento.findAll({
          where: condiciones,
          attributes: [
            [sequelize.fn('date', sequelize.col('created_at')), 'fecha'],
            [sequelize.fn('COUNT', sequelize.literal('CASE WHEN estado = \'en_proceso\' THEN 1 ELSE NULL END')), 'en_proceso'],
            [sequelize.fn('COUNT', sequelize.literal('CASE WHEN estado = \'listo_para_entrega\' THEN 1 ELSE NULL END')), 'listo_para_entrega'],
            [sequelize.fn('COUNT', sequelize.literal('CASE WHEN estado = \'entregado\' THEN 1 ELSE NULL END')), 'entregado'],
            [sequelize.fn('COUNT', sequelize.col('Documento.id')), 'total']
          ],
          group: [sequelize.fn('date', sequelize.col('created_at'))],
          order: [[sequelize.fn('date', sequelize.col('created_at')), 'ASC']],
          raw: true
        });
        
        datosReporte.resultados = documentosPorFecha.map(item => ({
          _id: item.fecha,
          registrados: parseInt(item.total),
          listos: parseInt(item.listo_para_entrega),
          entregados: parseInt(item.entregado)
        }));
        
        datosReporte.totales = {
          registrados: datosReporte.resultados.reduce((sum, item) => sum + item.registrados, 0),
          listos: datosReporte.resultados.reduce((sum, item) => sum + item.listos, 0),
          entregados: datosReporte.resultados.reduce((sum, item) => sum + item.entregados, 0)
        };
        break;
        
      case 'tipoDocumento':
        reporteTitulo = 'Reporte de Documentos por Tipo';
        vistaPartial = 'admin/reportes/partials/tipoDocumento';
        
        // Lógica existente para reporte por tipo de documento
        const estadisticasTipo = await Documento.findAll({
          where: condiciones,
          attributes: [
            'tipo_documento',
            [sequelize.fn('COUNT', sequelize.col('Documento.id')), 'count']
          ],
          group: ['tipo_documento'],
          raw: true
        });
        
        const totalDocumentosTipo = estadisticasTipo.reduce((sum, item) => sum + parseInt(item.count), 0);
        
        datosReporte.resultados = estadisticasTipo.map(item => ({
          _id: item.tipo_documento,
          count: parseInt(item.count),
          porcentaje: Math.round((parseInt(item.count) / totalDocumentosTipo) * 100)
        }));
        
        datosReporte.totales = { count: totalDocumentosTipo };
        break;
        
      case 'sin_procesar': // Nuevo reporte: Documentos Sin Procesar (Supervisión)
        reporteTitulo = 'Reporte: Documentos Sin Procesar';
        vistaPartial = 'admin/reportes/partials/sin_procesar';

        // Obtener documentos pendientes de procesamiento
        datosReporte.documentos = await Documento.findAll({
          where: {
            // Filtro: estado NO sea listo_para_entrega ni entregado
            estado: { [Op.notIn]: ['listo_para_entrega', 'entregado'] },
            // Aplicar filtros de fecha si están presentes
            created_at: condiciones.created_at,
            // Aplicar filtro de matrizador si está presente
            ...(idMatrizador && idMatrizador !== 'todos' && idMatrizador !== '' && { id_matrizador: parseInt(idMatrizador, 10) })
          },
          include: [{
            model: Matrizador,
            as: 'matrizador',
            attributes: ['nombre']
          }],
          attributes: ['id', 'codigo_barras', 'tipo_documento', 'nombre_cliente', 'created_at', 'estado'],
          order: [['created_at', 'ASC']], // Ordenar por más antiguos primero
        });
        
        // Calcular días desde registro para cada documento
        datosReporte.documentos = datosReporte.documentos.map(doc => ({
          ...doc.toJSON(),
          diasDesdeRegistro: moment().diff(moment(doc.created_at), 'days'),
          matrizadorNombre: doc.matrizador?.nombre || 'Sin asignar'
        }));
        
        // Estadísticas rápidas por matrizador (sin procesar)
        const statsSinProcesar = await Documento.findAll({
          where: {
            estado: { [Op.notIn]: ['listo_para_entrega', 'entregado'] },
            created_at: condiciones.created_at,
             ...(idMatrizador && idMatrizador !== 'todos' && idMatrizador !== '' && { id_matrizador: parseInt(idMatrizador, 10) })
          },
           attributes: [
            'id_matrizador',
            [sequelize.fn('COUNT', sequelize.col('Documento.id')), 'count'],
            [sequelize.fn('AVG', sequelize.literal('EXTRACT(DAY FROM NOW() - "Documento"."created_at")')), 'promedio_dias']
          ],
          include: [{
            model: Matrizador,
            as: 'matrizador',
            attributes: ['nombre']
          }],
          group: ['Documento.id_matrizador', 'matrizador.id'],
          order: [[sequelize.literal('count'), 'DESC']],
          raw: true
        });
        
        datosReporte.statsMatrizador = statsSinProcesar.map(item => ({
          nombre: item['matrizador.nombre'] || 'Sin asignar',
          cantidad: parseInt(item.count),
          promedio_dias: parseFloat(item.promedio_dias || 0).toFixed(1)
        }));
        
        datosReporte.totales = { totalDocumentos: datosReporte.documentos.length };

        break;

      case 'sin_pago': // Nuevo reporte: Documentos Sin Pago (Cobranza)
        reporteTitulo = 'Reporte: Documentos Sin Pago';
        vistaPartial = 'admin/reportes/partials/sin_pago';

        // Obtener documentos pendientes de pago
        datosReporte.documentos = await Documento.findAll({
          where: {
            // Filtro: estado_pago NO sea pagado
            estadoPago: { [Op.ne]: 'pagado' },
            // CORREGIDO: Usar created_at para el filtro de fechas, no fecha_factura
            created_at: condiciones.created_at,
            // Solo incluir documentos que tengan factura
            numeroFactura: { [Op.not]: null },
            valorFactura: { [Op.not]: null },
            // Aplicar filtro de matrizador si está presente
             ...(idMatrizador && idMatrizador !== 'todos' && idMatrizador !== '' && { id_matrizador: parseInt(idMatrizador, 10) })
          },
          attributes: ['id', 'codigoBarras', 'tipoDocumento', 'nombreCliente', 'valorFactura', 'fechaFactura', 'estadoPago', 'created_at'],
          order: [['created_at', 'ASC']], // Ordenar por fecha de registro más antigua
        });

        // Calcular días desde fecha de factura para cada documento
        datosReporte.documentos = datosReporte.documentos.map(doc => {
          const docJson = doc.toJSON();
          const diasDesdeFactura = docJson.fechaFactura ? moment().diff(moment(docJson.fechaFactura), 'days') : 'N/A';
          return {
            ...docJson,
            // CORREGIDO: Usar nombres camelCase que realmente vienen del toJSON()
            valor_factura_formato: docJson.valorFactura ? parseFloat(docJson.valorFactura).toFixed(2) : '0.00',
            fecha_factura_formato: docJson.fechaFactura ? moment(docJson.fechaFactura).format('DD/MM/YYYY') : 'Sin fecha',
            diasDesdeFactura,
            atrasado: diasDesdeFactura !== 'N/A' && diasDesdeFactura > 30,
            // Agregar campos en snake_case para compatibilidad con la vista
            codigo_barras: docJson.codigoBarras,
            tipo_documento: docJson.tipoDocumento,
            nombre_cliente: docJson.nombreCliente,
            valor_factura: docJson.valorFactura,
            fecha_factura: docJson.fechaFactura,
            estado_pago: docJson.estadoPago
          };
        });
        
        // Estadísticas rápidas de montos pendientes
         const statsSinPago = await Documento.findAll({
          where: {
            estadoPago: { [Op.ne]: 'pagado' },
            created_at: condiciones.created_at,
            // Solo incluir documentos que tengan factura
            numeroFactura: { [Op.not]: null },
            valorFactura: { [Op.not]: null },
             ...(idMatrizador && idMatrizador !== 'todos' && idMatrizador !== '' && { id_matrizador: parseInt(idMatrizador, 10) })
          },
           attributes: [
            [sequelize.fn('COUNT', sequelize.col('Documento.id')), 'count'],
            [sequelize.fn('SUM', sequelize.col('valor_factura')), 'total_valor']
          ],
          raw: true
        });

        datosReporte.statsGeneral = {
          totalDocumentos: parseInt(statsSinPago[0]?.count || 0),
          totalValor: parseFloat(statsSinPago[0]?.total_valor || 0).toFixed(2)
        };

        break;
        
      case 'financiero': // Reporte Financiero - redirigir a función específica
        return exports.reporteFinanciero(req, res);

      // Agregar otros casos para reportes futuros (ej. 'equipo')

      default:
        // Si el tipo no es reconocido, redirigir a la página de índice
        return res.redirect('/admin/reportes');
    }
    
    // Renderizar la vista principal de reportes, pasando los datos específicos
    res.render('admin/reportes', { // CORREGIDO: Usar vista principal unificada
      layout: 'admin',
      title: reporteTitulo, // Usar el título del reporte actual
      activeReportes: true,
      matrizadores, // Pasar lista completa de matrizadores para filtros
      filtros: {
        tipo,
        rango: req.query.rango || 'mes', // Mantener el rango seleccionado en los filtros
        fechaInicio: fechaInicio.format('YYYY-MM-DD'),
        fechaFin: fechaFin.format('YYYY-MM-DD'),
        idMatrizador,
        estado // Mantener estado si aplica
      },
      tipoReporteActual: tipo, // Pasar el tipo de reporte activo
      vistaPartial, // Pasar el nombre del partial a incluir
      userRole: req.matrizador?.rol,
      userName: req.matrizador?.nombre,
      ...datosReporte // Pasar todos los datos específicos del reporte
    });

  } catch (error) {
    console.error('Error al generar reportes:', error);
    res.status(500).render('error', {
      layout: 'admin',
      title: 'Error',
      message: 'Ha ocurrido un error al generar los reportes',
      error
    });
  }
};

/**
 * Muestra los registros de auditoría de seguridad
 */
exports.verRegistrosAuditoria = async (req, res) => {
  try {
    // Parámetros de filtrado con fechas correctas
    const fechaInicio = req.query.fechaInicio ? new Date(req.query.fechaInicio) : new Date(new Date().setDate(new Date().getDate() - 7));
    const fechaFin = req.query.fechaFin ? new Date(req.query.fechaFin + 'T23:59:59') : new Date();
    const accion = req.query.accion || '';
    const resultado = req.query.resultado || '';
    const idMatrizador = req.query.idMatrizador || '';
    
    // Condiciones de filtrado
    const where = {
      created_at: {
        [Op.between]: [fechaInicio, fechaFin]
      }
    };
    
    if (accion) {
      where.accion = accion;
    }
    
    if (resultado) {
      where.resultado = resultado;
    }
    
    if (idMatrizador) {
      where.idMatrizador = idMatrizador;
    }
    
    // Obtener registros con paginación
    const page = parseInt(req.query.page) || 1;
    const limit = 50;
    const offset = (page - 1) * limit;
    
    const { count, rows: registros } = await RegistroAuditoria.findAndCountAll({
      where,
      include: [
        {
          model: Documento,
          as: 'documento',
          attributes: ['id', 'tipo_documento', 'codigo_barras', 'nombre_cliente']
        },
        {
          model: Matrizador,
          as: 'matrizador',
          attributes: ['id', 'nombre', 'rol']
        }
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset
    });
    
    // Preparar datos para la paginación
    const totalPages = Math.ceil(count / limit);
    const pagination = {
      pages: []
    };
    
    // Generar enlaces de paginación
    for (let i = 1; i <= totalPages; i++) {
      pagination.pages.push({
        num: i,
        active: i === page
      });
    }
    
    // Obtener matrizadores para filtros
    const matrizadores = await Matrizador.findAll({
      order: [['nombre', 'ASC']]
    });
    
    // Tipos de acciones para filtros
    const tiposAccion = [
      { id: 'consulta_codigo', nombre: 'Consulta de código' },
      { id: 'verificacion_codigo', nombre: 'Verificación con código' },
      { id: 'verificacion_llamada', nombre: 'Verificación por llamada' },
      { id: 'edicion_codigo', nombre: 'Edición de código' }
    ];
    
    res.render('admin/auditoria', {
      layout: 'admin',
      title: 'Registros de Auditoría',
      activeAuditoria: true,
      registros,
      pagination,
      matrizadores,
      tiposAccion,
      filtros: {
        fechaInicio: fechaInicio.toISOString().slice(0, 10),
        fechaFin: fechaFin.toISOString().slice(0, 10),
        accion,
        resultado,
        idMatrizador
      }
    });
  } catch (error) {
    console.error('Error al mostrar registros de auditoría:', error);
    res.status(500).render('error', {
      layout: 'admin',
      title: 'Error',
      message: 'Ha ocurrido un error al cargar los registros de auditoría',
      error
    });
  }
};

/**
 * Descarga un reporte exportado en formato PDF o Excel
 */
exports.descargarReporte = async (req, res) => {
  try {
    // Obtener parámetros
    const formato = req.query.formato || 'pdf';
    const contenidos = Array.isArray(req.query.contenido) ? req.query.contenido : [req.query.contenido];
    const tipoPeriodo = req.query.tipoPeriodo || 'hoy';
    
    // Procesar fechas usando utilidades centralizadas
    const ahora = obtenerTimestampEcuador();
    let fechaInicio, fechaFin;
    
    switch (tipoPeriodo) {
      case 'hoy':
        const rango = convertirRangoParaSQL(
          ahora.toISOString().split('T')[0], 
          ahora.toISOString().split('T')[0]
        );
        fechaInicio = rango.fechaInicioObj;
        fechaFin = rango.fechaFinObj;
        break;
      case 'semana':
        const inicioSemana = new Date(ahora);
        inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay());
        const rangoSemana = convertirRangoParaSQL(
          inicioSemana.toISOString().split('T')[0],
          ahora.toISOString().split('T')[0]
        );
        fechaInicio = rangoSemana.fechaInicioObj;
        fechaFin = rangoSemana.fechaFinObj;
        break;
      case 'mes':
        const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
        const rangoMes = convertirRangoParaSQL(
          inicioMes.toISOString().split('T')[0],
          ahora.toISOString().split('T')[0]
        );
        fechaInicio = rangoMes.fechaInicioObj;
        fechaFin = rangoMes.fechaFinObj;
        break;
      case 'ultimo_mes':
        const hace30Dias = new Date(ahora);
        hace30Dias.setDate(hace30Dias.getDate() - 30);
        const rangoUltimoMes = convertirRangoParaSQL(
          hace30Dias.toISOString().split('T')[0],
          ahora.toISOString().split('T')[0]
        );
        fechaInicio = rangoUltimoMes.fechaInicioObj;
        fechaFin = rangoUltimoMes.fechaFinObj;
        break;
      case 'personalizado':
        const fechaInicioCustom = req.query.fechaInicio || hace30Dias.toISOString().split('T')[0];
        const fechaFinCustom = req.query.fechaFin || ahora.toISOString().split('T')[0];
        const rangoPersonalizado = convertirRangoParaSQL(fechaInicioCustom, fechaFinCustom);
        fechaInicio = rangoPersonalizado.fechaInicioObj;
        fechaFin = rangoPersonalizado.fechaFinObj;
        break;
      default:
        const rangoDefault = convertirRangoParaSQL(
          ahora.toISOString().split('T')[0], 
          ahora.toISOString().split('T')[0]
        );
        fechaInicio = rangoDefault.fechaInicioObj;
        fechaFin = rangoDefault.fechaFinObj;
    }
    
    // Formatear fechas para el nombre del archivo
    const fechaInicioStr = fechaInicio.toISOString().split('T')[0];
    const fechaFinStr = fechaFin.toISOString().split('T')[0];
    
    // Generar nombre del archivo
    const nombreArchivo = `reporte_documentos_${fechaInicioStr}_a_${fechaFinStr}`;
    
    // Preparar datos para el reporte
    const datos = {
      fechaInicio,
      fechaFin,
      fechaInicioStr,
      fechaFinStr,
      tipoPeriodo,
      resumen: contenidos.includes('resumen'),
      listado: contenidos.includes('listado'),
      matrizador: contenidos.includes('matrizador'),
      tipo: contenidos.includes('tipo')
    };
    
    // Obtener datos según el contenido solicitado
    if (datos.resumen) {
      // Estadísticas generales
      const total = await Documento.count();
      const enProceso = await Documento.count({ where: { estado: 'en_proceso' } });
      const listoParaEntrega = await Documento.count({ where: { estado: 'listo_para_entrega' } });
      const entregados = await Documento.count({ where: { estado: 'entregado' } });
      
      // Estadísticas del período (usar created_at)
      const nuevos = await Documento.count({
        where: {
          created_at: {
            [Op.between]: [fechaInicio, fechaFin]
          }
        }
      });
      
      const procesados = await EventoDocumento.count({
        where: {
          tipo: 'cambio_estado',
          detalles: {
            [Op.like]: '%listo_para_entrega%'
          },
          created_at: {
            [Op.between]: [fechaInicio, fechaFin]
          }
        }
      });
      
      const entregadosPeriodo = await Documento.count({
        where: {
          estado: 'entregado',
          fechaEntrega: {
            [Op.between]: [fechaInicio, fechaFin]
          }
        }
      });
      
      datos.estadisticas = {
        total,
        enProceso,
        listoParaEntrega,
        entregados,
        nuevos,
        procesados,
        entregadosPeriodo
      };
      
      // Tiempos promedio (usar campos correctos)
      const tiempoProcesamientoQuery = await sequelize.query(`
        SELECT AVG(EXTRACT(EPOCH FROM (e.created_at - d.created_at)) / 86400) as promedio_dias
        FROM "eventos_documentos" e
        JOIN "documentos" d ON e.id_documento = d.id
        WHERE e.tipo = 'cambio_estado'
        AND e.detalles LIKE '%listo_para_entrega%'
        AND e.created_at BETWEEN :fechaInicio AND :fechaFin
        AND d.estado IN ('en_proceso', 'listo_para_entrega', 'entregado')
      `, {
        replacements: { fechaInicio, fechaFin },
        type: sequelize.QueryTypes.SELECT
      });
      
      const tiempoEntregaQuery = await sequelize.query(`
        SELECT AVG(EXTRACT(EPOCH FROM (d.fecha_entrega - e.created_at)) / 86400) as promedio_dias
        FROM "documentos" d
        JOIN "eventos_documentos" e ON d.id = e.id_documento
        WHERE d.estado = 'entregado'
        AND e.tipo = 'cambio_estado'
        AND e.detalles LIKE '%listo_para_entrega%'
        AND d.fecha_entrega BETWEEN :fechaInicio AND :fechaFin
      `, {
        replacements: { fechaInicio, fechaFin },
        type: sequelize.QueryTypes.SELECT
      });
      
      datos.estadisticas.tiempoPromedioProcesamiento = tiempoProcesamientoQuery[0]?.promedio_dias 
        ? parseFloat(tiempoProcesamientoQuery[0].promedio_dias).toFixed(1) 
        : 'N/A';
      
      datos.estadisticas.tiempoPromedioEntrega = tiempoEntregaQuery[0]?.promedio_dias 
        ? parseFloat(tiempoEntregaQuery[0].promedio_dias).toFixed(1) 
        : 'N/A';
    }
    
    if (datos.listado) {
      // Listado detallado de documentos (usar created_at)
      datos.documentos = await Documento.findAll({
        where: {
          created_at: {
            [Op.between]: [fechaInicio, fechaFin]
          }
        },
        include: [{
          model: Matrizador,
          as: 'matrizador',
          attributes: ['id', 'nombre']
        }],
        order: [['created_at', 'DESC']]
      });
    }
    
    if (datos.matrizador) {
      // Estadísticas por matrizador
      datos.estadisticasMatrizador = await obtenerDatosMatrizador(fechaInicio, fechaFin);
    }
    
    if (datos.tipo) {
      // Estadísticas por tipo de documento
      datos.estadisticasTipo = await obtenerDatosTipoDocumento(fechaInicio, fechaFin);
    }
    
    // Generar reporte según formato solicitado
    if (formato === 'excel') {
      // TODO: Implementar exportación Excel usando exceljs
      // Por ahora, enviamos un JSON como respuesta temporal
      res.attachment(`${nombreArchivo}.json`);
      return res.json(datos);
    } else {
      // TODO: Implementar exportación PDF usando pdfkit o similar
      // Por ahora, enviamos un JSON como respuesta temporal
      res.attachment(`${nombreArchivo}.json`);
      return res.json(datos);
    }
  } catch (error) {
    console.error('Error al generar reporte:', error);
    res.status(500).send('Error al generar el reporte: ' + error.message);
  }
};

/**
 * TRANSFERIDO DESDE CAJA: Reporte detallado de documentos
 * Solo para administradores - información sensible
 */
exports.reporteDocumentos = async (req, res) => {
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
      WHERE created_at BETWEEN :fechaInicio AND :fechaFin
        AND estado NOT IN ('eliminado', 'nota_credito')
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
      WHERE created_at BETWEEN :fechaInicio AND :fechaFin
        AND estado NOT IN ('eliminado', 'nota_credito')
      GROUP BY tipo_documento
      ORDER BY cantidad DESC
    `, {
      replacements: { fechaInicio: fechaInicioSQL, fechaFin: fechaFinSQL },
      type: sequelize.QueryTypes.SELECT
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
    res.render('admin/reportes/documentos', {
      layout: 'admin',
      title: 'Reporte de Documentos',
      activeReportes: true,
      stats: {
        totalDocumentos,
        conFactura,
        pendientes,
        pagados,
        totalFacturado: parseFloat(statsResult.total_facturado).toFixed(2),
        promedioFacturado: parseFloat(statsResult.promedio_facturado).toFixed(2),
        porcentajeFacturados,
        porcentajePendientes,
        porcentajePagados
      },
      estadisticasPorTipo,
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
      layout: 'admin',
      title: 'Error',
      message: 'Error al generar el reporte de documentos',
      error
    });
  }
};

/**
 * TRANSFERIDO DESDE CAJA: Reporte de documentos pendientes
 * Solo para administradores - información sensible sobre cobranza
 */
exports.reportePendientesAdmin = async (req, res) => {
  try {
    // Obtener parámetros de filtrado
    const { antiguedad, matrizador, ordenar, page = 1 } = req.query;
    const limit = 50;
    const offset = (page - 1) * limit;
    
    // Construir condiciones de filtrado
    const whereConditions = {
      estado_pago: 'pendiente',
      numero_factura: { [Op.not]: null },
      estado: { [Op.notIn]: ['eliminado', 'nota_credito'] }
    };
    
    if (matrizador) {
      whereConditions.id_matrizador = matrizador;
    }
    
    // Construir ORDER BY según el filtro
    let order = [['created_at', 'ASC']]; // Por defecto más antiguos
    if (ordenar === 'monto') {
      order = [['valor_factura', 'DESC']];
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
        rol: 'matrizador',
        activo: true
      },
      attributes: ['id', 'nombre'],
      order: [['nombre', 'ASC']]
    });
    
    // Agregar días de antigüedad a cada documento
    const documentosConDatos = documentosPendientes.map(doc => {
      // CORREGIDO: Usar fecha_factura para calcular días de atraso (no created_at)
      // Si no hay fecha_factura, usar created_at como fallback
      const fechaBase = doc.fechaFactura || doc.created_at;
      const diasAntiguedad = moment().diff(moment(fechaBase), 'days');
      return {
        ...doc.toJSON(),
        diasAntiguedad,
        matrizador: doc.matrizador?.nombre || 'Sin asignar'
      };
    });
    
    // Renderizar la vista con los datos
    res.render('admin/reportes/pendientes', {
      layout: 'admin',
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
      layout: 'admin',
      title: 'Error',
      message: 'Error al generar el reporte de documentos pendientes',
      error
    });
  }
};

/**
 * TRANSFERIDO DESDE CAJA: Reporte de productividad por matrizador
 * Solo para administradores - información sensible sobre rendimiento
 */
exports.reporteMatrizadores = async (req, res) => {
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
        AND d.created_at BETWEEN :fechaInicio AND :fechaFin
        AND d.estado NOT IN ('eliminado', 'nota_credito')
      WHERE m.rol IN ('matrizador', 'caja_archivo')
      GROUP BY m.id, m.nombre
      ORDER BY facturacion_total DESC
    `, {
      replacements: { fechaInicio: fechaInicioSQL, fechaFin: fechaFinSQL },
      type: sequelize.QueryTypes.SELECT
    });
    
    // Calcular porcentajes y promedios
    datosMatrizadores.forEach(item => {
      item.porcentaje_pagados = item.documentos_totales > 0 ? 
        (item.documentos_pagados / item.documentos_totales * 100).toFixed(2) : 0;
      
      item.factura_promedio = item.documentos_totales > 0 ? 
        (item.facturacion_total / item.documentos_totales).toFixed(2) : 0;
        
      item.pendiente_cobro = (item.facturacion_total - item.ingresos_cobrados).toFixed(2);
    });
    
    // Renderizar el reporte
    res.render('admin/reportes/matrizadores', {
      layout: 'admin',
      title: 'Productividad por Matrizador',
      activeReportes: true,
      userRole: req.matrizador?.rol,
      userName: req.matrizador?.nombre,
      fechaInicio: fechaInicio.format('YYYY-MM-DD'),
      fechaFin: fechaFin.format('YYYY-MM-DD'),
      datosMatrizadores
    });
  } catch (error) {
    console.error('Error al generar reporte de matrizadores:', error);
    return res.status(500).render('error', {
      layout: 'admin',
      title: 'Error',
      message: 'Error al generar el reporte de matrizadores',
      error
    });
  }
};

/**
 * TRANSFERIDO DESDE CAJA: Reporte financiero con gráficos y análisis de períodos
 * Solo para administradores - información financiera completa
 */
exports.reporteFinanciero = async (req, res) => {
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
    
    // CORREGIDO: Obtener datos diarios usando la misma lógica que funciona en caja
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
      where: {
        rol: {
          [Op.in]: ['matrizador', 'caja_archivo']
        },
        activo: true
      },
      attributes: ['id', 'nombre'],
      order: [['nombre', 'ASC']]
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
      layout: 'admin',
      title: 'Error',
      message: 'Error al generar el reporte financiero',
      error
    });
  }
};

/**
 * Reporte de Registros de Auditoría
 * Muestra el historial de acciones importantes del sistema
 */
exports.reporteRegistrosAuditoria = async (req, res) => {
  try {
    // Procesar parámetros de filtrado
    const fechaInicio = req.query.fechaInicio ? moment(req.query.fechaInicio).startOf('day') : moment().subtract(7, 'days').startOf('day');
    const fechaFin = req.query.fechaFin ? moment(req.query.fechaFin).endOf('day') : moment().endOf('day');
    const tipoAccion = req.query.tipoAccion;
    const usuario = req.query.usuario;
    const page = parseInt(req.query.page) || 1;
    const limit = 50;
    const offset = (page - 1) * limit;
    
    // Formatear fechas para SQL
    const fechaInicioSQL = fechaInicio.format('YYYY-MM-DD HH:mm:ss');
    const fechaFinSQL = fechaFin.format('YYYY-MM-DD HH:mm:ss');
    
    // Construir filtros adicionales
    let whereFilters = '';
    const replacements = { fechaInicio: fechaInicioSQL, fechaFin: fechaFinSQL };
    
    if (tipoAccion && tipoAccion !== 'todos') {
      whereFilters += ' AND accion LIKE :tipoAccion';
      replacements.tipoAccion = `%${tipoAccion}%`;
    }
    
    if (usuario && usuario !== 'todos') {
      whereFilters += ' AND usuario_nombre LIKE :usuario';
      replacements.usuario = `%${usuario}%`;
    }
    
    // Consulta principal de auditoría (simulada con datos de documentos)
    const auditoriaQuery = `
      SELECT 
        d.id,
        d.codigo_barras,
        d.tipo_documento,
        d.nombre_cliente,
        d.estado,
        d.estado_pago,
        d.created_at as fecha_accion,
        d.updated_at as fecha_modificacion,
        m.nombre as usuario_nombre,
        m.rol as usuario_rol,
        CASE 
          WHEN d.created_at = d.updated_at THEN 'CREACIÓN'
          WHEN d.estado = 'listo_para_entrega' THEN 'PROCESAMIENTO_COMPLETADO'
          WHEN d.estado = 'entregado' THEN 'ENTREGA'
          WHEN d.estado_pago = 'pagado' THEN 'PAGO_REGISTRADO'
          WHEN d.estado = 'cancelado' THEN 'CANCELACIÓN'
          ELSE 'MODIFICACIÓN'
        END as accion,
        d.valor_factura,
        d.numero_factura
      FROM documentos d
      JOIN matrizadores m ON d.id_matrizador = m.id
      WHERE d.updated_at BETWEEN :fechaInicio AND :fechaFin
      AND d.estado NOT IN ('eliminado')
      ${whereFilters}
      
      UNION ALL
      
      SELECT 
        NULL as id,
        NULL as codigo_barras,
        'SISTEMA' as tipo_documento,
        'Acceso al sistema' as nombre_cliente,
        'activo' as estado,
        NULL as estado_pago,
        m.last_login as fecha_accion,
        m.last_login as fecha_modificacion,
        m.nombre as usuario_nombre,
        m.rol as usuario_rol,
        'LOGIN' as accion,
        NULL as valor_factura,
        NULL as numero_factura
      FROM matrizadores m
      WHERE m.last_login BETWEEN :fechaInicio AND :fechaFin
      AND m.last_login IS NOT NULL
      ${whereFilters.replace('d.', 'm.')}
      
      ORDER BY fecha_accion DESC
      LIMIT :limit OFFSET :offset
    `;
    
    // Agregar limit y offset a replacements
    replacements.limit = limit;
    replacements.offset = offset;
    
    const registrosAuditoria = await sequelize.query(auditoriaQuery, {
      replacements,
      type: sequelize.QueryTypes.SELECT
    });
    
    // Consulta para contar total de registros
    const countQuery = `
      SELECT COUNT(*) as total FROM (
        SELECT d.id
        FROM documentos d
        JOIN matrizadores m ON d.id_matrizador = m.id
        WHERE d.updated_at BETWEEN :fechaInicio AND :fechaFin
        AND d.estado NOT IN ('eliminado')
        ${whereFilters}
        
        UNION ALL
        
        SELECT NULL as id
        FROM matrizadores m
        WHERE m.last_login BETWEEN :fechaInicio AND :fechaFin
        AND m.last_login IS NOT NULL
        ${whereFilters.replace('d.', 'm.')}
      ) as total_registros
    `;
    
    const countResult = await sequelize.query(countQuery, {
      replacements: { fechaInicio: fechaInicioSQL, fechaFin: fechaFinSQL, tipoAccion: replacements.tipoAccion, usuario: replacements.usuario },
      type: sequelize.QueryTypes.SELECT
    });
    
    const totalRegistros = parseInt(countResult[0]?.total || 0);
    const totalPages = Math.ceil(totalRegistros / limit);
    
    // Estadísticas por tipo de acción
    const statsQuery = `
      SELECT 
        accion,
        COUNT(*) as cantidad
      FROM (
        SELECT 
          CASE 
            WHEN d.created_at = d.updated_at THEN 'CREACIÓN'
            WHEN d.estado = 'listo_para_entrega' THEN 'PROCESAMIENTO_COMPLETADO'
            WHEN d.estado = 'entregado' THEN 'ENTREGA'
            WHEN d.estado_pago = 'pagado' THEN 'PAGO_REGISTRADO'
            WHEN d.estado = 'cancelado' THEN 'CANCELACIÓN'
            ELSE 'MODIFICACIÓN'
          END as accion
        FROM documentos d
        JOIN matrizadores m ON d.id_matrizador = m.id
        WHERE d.updated_at BETWEEN :fechaInicio AND :fechaFin
        AND d.estado NOT IN ('eliminado')
        
        UNION ALL
        
        SELECT 'LOGIN' as accion
        FROM matrizadores m
        WHERE m.last_login BETWEEN :fechaInicio AND :fechaFin
        AND m.last_login IS NOT NULL
      ) as acciones
      GROUP BY accion
      ORDER BY cantidad DESC
    `;
    
    const statsAcciones = await sequelize.query(statsQuery, {
      replacements: { fechaInicio: fechaInicioSQL, fechaFin: fechaFinSQL },
      type: sequelize.QueryTypes.SELECT
    });
    
    // Obtener usuarios únicos para filtro
    const usuariosQuery = `
      SELECT DISTINCT m.nombre, m.rol
      FROM matrizadores m
      WHERE m.activo = true
      ORDER BY m.nombre ASC
    `;
    
    const usuarios = await sequelize.query(usuariosQuery, {
      type: sequelize.QueryTypes.SELECT
    });
    
    // Preparar paginación
    const pagination = {
      currentPage: page,
      totalPages,
      totalItems: totalRegistros,
      hasNext: page < totalPages,
      hasPrev: page > 1,
      nextPage: page + 1,
      prevPage: page - 1
    };
    
    // Preparar datos para gráfico
    const datosGrafico = {
      acciones: statsAcciones.map(item => item.accion),
      cantidades: statsAcciones.map(item => parseInt(item.cantidad))
    };
    
    res.render('admin/reportes/registros-auditoria', {
      layout: 'admin',
      title: 'Registros de Auditoría',
      activeReportes: true,
      userRole: req.matrizador?.rol,
      userName: req.matrizador?.nombre,
      registrosAuditoria,
      usuarios,
      statsAcciones,
      datosGrafico,
      stats: {
        totalRegistros,
        totalAcciones: statsAcciones.length,
        usuariosActivos: usuarios.length,
        periodoTexto: `Del ${fechaInicio.format('DD/MM/YYYY')} al ${fechaFin.format('DD/MM/YYYY')}`
      },
      filtros: {
        fechaInicio: fechaInicio.format('YYYY-MM-DD'),
        fechaFin: fechaFin.format('DD/MM/YYYY'),
        tipoAccion: tipoAccion || 'todos',
        usuario: usuario || 'todos'
      },
      pagination: totalPages > 1 ? pagination : null
    });
  } catch (error) {
    console.error('Error al generar reporte de auditoría:', error);
    return res.status(500).render('error', {
      layout: 'admin',
      title: 'Error',
      message: 'Error al generar el reporte de auditoría',
      error
    });
  }
};

/**
 * Página de Alertas Detallada
 * Muestra todas las situaciones que requieren atención con detalles y acciones
 */
exports.mostrarAlertas = async (req, res) => {
  try {
    // Reutilizar la lógica de alertas del dashboard
    const alertasCriticas = [];
    
    // Documentos atrasados más de 30 días sin pagar
    const documentosAtrasados = await Documento.count({
      where: {
        estado_pago: 'pendiente',
        numero_factura: { [Op.not]: null },
        estado: { [Op.notIn]: ['eliminado', 'nota_credito'] },
        created_at: { [Op.lt]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }
    });
    
    if (documentosAtrasados > 0) {
      alertasCriticas.push({
        tipo: 'danger',
        icono: 'fas fa-exclamation-triangle',
        titulo: `${documentosAtrasados} documentos atrasados +30 días`,
        descripcion: 'Requieren gestión de cobranza urgente',
        accion: '/admin/reportes/pendientes?antiguedad=30%2B',
        urgencia: 'alta',
        detalles: 'Estos documentos tienen más de 30 días sin pago y requieren seguimiento inmediato de cobranza.'
      });
    }
    
    // Documentos listos para entrega hace más de 3 días
    const documentosListosViejos = await Documento.count({
      where: {
        estado: 'listo_para_entrega',
        updated_at: { [Op.lt]: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) }
      }
    });
    
    if (documentosListosViejos > 0) {
      alertasCriticas.push({
        tipo: 'warning',
        icono: 'fas fa-clock',
        titulo: `${documentosListosViejos} documentos listos sin entregar`,
        descripcion: 'Más de 3 días esperando entrega',
        accion: '/admin/documentos/listado?estado=listo_para_entrega',
        urgencia: 'media',
        detalles: 'Estos documentos están listos pero no han sido entregados. Contactar a los clientes para coordinar la entrega.'
      });
    }
    
    // Documentos sin matrizador asignado
    const documentosSinMatrizador = await Documento.count({
      where: {
        id_matrizador: null,
        estado: { [Op.in]: ['en_proceso', 'listo_para_entrega'] }
      }
    });
    
    if (documentosSinMatrizador > 0) {
      alertasCriticas.push({
        tipo: 'info',
        icono: 'fas fa-user-slash',
        titulo: `${documentosSinMatrizador} documentos sin asignar`,
        descripcion: 'Necesitan matrizador responsable',
        accion: '/admin/documentos/listado?idMatrizador=',
        urgencia: 'baja',
        detalles: 'Estos documentos no tienen un matrizador asignado. Asignar responsable para su procesamiento.'
      });
    }
    
    // Documentos con problemas de facturación (sin número de factura pero con valor)
    const documentosSinFactura = await Documento.count({
      where: {
        numero_factura: null,
        valor_factura: { [Op.not]: null },
        estado: { [Op.notIn]: ['eliminado', 'nota_credito'] }
      }
    });
    
    if (documentosSinFactura > 0) {
      alertasCriticas.push({
        tipo: 'warning',
        icono: 'fas fa-file-invoice',
        titulo: `${documentosSinFactura} documentos sin número de factura`,
        descripcion: 'Tienen valor pero falta número de factura',
        accion: '/admin/documentos/listado?busqueda=',
        urgencia: 'media',
        detalles: 'Estos documentos tienen valor asignado pero no tienen número de factura. Completar la información de facturación.'
      });
    }
    
    // Determinar estado general
    let estadoGeneral = 'success';
    let mensajeEstado = 'Todo funcionando correctamente';
    
    if (documentosAtrasados > 10 || documentosListosViejos > 5) {
      estadoGeneral = 'danger';
      mensajeEstado = 'Atención requerida urgente';
    } else if (alertasCriticas.length > 0) {
      estadoGeneral = 'warning';
      mensajeEstado = 'Algunos problemas requieren atención';
    }
    
    res.render('admin/alertas', {
      layout: 'admin',
      title: 'Centro de Alertas',
      activeAlertas: true,
      userRole: req.matrizador?.rol,
      userName: req.matrizador?.nombre,
      alertasCriticas,
      estadoGeneral,
      mensajeEstado,
      stats: {
        totalAlertas: alertasCriticas.length,
        alertasAltas: alertasCriticas.filter(a => a.urgencia === 'alta').length,
        alertasMedias: alertasCriticas.filter(a => a.urgencia === 'media').length,
        alertasBajas: alertasCriticas.filter(a => a.urgencia === 'baja').length
      }
    });
  } catch (error) {
    console.error('Error al cargar alertas:', error);
    res.status(500).render('error', {
      layout: 'admin',
      title: 'Error',
      message: 'Ha ocurrido un error al cargar las alertas',
      error
    });
  }
};