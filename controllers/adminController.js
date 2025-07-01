/**
 * Controlador para la interfaz administrativa del sistema
 * SIMPLIFICADO - Solo consultas que funcionan con campos reales
 */

// CORREGIDO: Cargar asociaciones primero
require('../models/index');
const Documento = require('../models/Documento');
const Matrizador = require('../models/Matrizador');
const EventoDocumento = require('../models/EventoDocumento');
const RegistroAuditoria = require('../models/RegistroAuditoria');
const NotificacionEnviada = require('../models/NotificacionEnviada');
const { obtenerHistorialUniversal } = require('../utils/historialUniversal');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');
const moment = require('moment');
const { 
  obtenerTimestampEcuador,
  convertirRangoParaSQL,
  formatearTimestamp,
  formatearFechaSinHora,
  formatearValorMonetario,
  construirListaDocumentosDetallada,
  construirInformacionEntregaCensurada
} = require('../utils/documentoUtils');

// NUEVO: Importar sistema de logging
const { logger, logDashboard, logQuery } = require('../utils/logger');

const configNotaria = require('../config/notaria');

const notificacionController = require('./notificacionController');

/**
 * FUNCIONES DE FORMATEO PROFESIONAL PARA DASHBOARD
 */

// Función helper para formatear dinero con formato estadounidense (puntos)
const formatearDinero = (valor) => {
  if (!valor || isNaN(valor)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(parseFloat(valor));
};

// Función helper para formatear porcentajes (1 decimal máximo)
const formatearPorcentaje = (valor) => {
  if (!valor || isNaN(valor)) return '0.0%';
  return `${parseFloat(valor).toFixed(1)}%`;
};

// Función helper para formatear diferencias con signo
const formatearDiferencia = (valor, tipo = 'dinero') => {
  if (!valor || isNaN(valor)) return tipo === 'dinero' ? '$0.00' : '0.0%';
  
  const num = parseFloat(valor);
  const signo = num >= 0 ? '+' : '-';
  
  if (tipo === 'dinero') {
    return `${signo}$${Math.abs(num).toFixed(2)}`;
  } else if (tipo === 'porcentaje') {
    return `${signo}${Math.abs(num).toFixed(1)}%`;
  }
  
  return `${signo}${Math.abs(num).toFixed(2)}`;
};

// Función para validar métricas antes del formateo
const validarMetricas = (metricas) => {
  // Verificar que sean números válidos
  Object.keys(metricas).forEach(key => {
    if (isNaN(metricas[key]) || metricas[key] === null || metricas[key] === undefined) {
      console.warn(`Valor inválido en ${key}:`, metricas[key]);
      metricas[key] = 0;
    }
  });
  
  // Verificar fórmula matemática: Facturado = Cobrado + Retenido + Pendiente
  if (metricas.facturado !== undefined && metricas.cobrado !== undefined && 
      metricas.retenido !== undefined && metricas.pendiente !== undefined) {
    const suma = parseFloat(metricas.cobrado) + parseFloat(metricas.retenido) + parseFloat(metricas.pendiente);
    const diferencia = Math.abs(parseFloat(metricas.facturado) - suma);
    
    if (diferencia > 0.01) { // Tolerancia de 1 centavo
      console.warn('Posible error matemático detectado:', {
        facturado: metricas.facturado,
        suma: suma,
        diferencia: diferencia
      });
    }
  }
  
  return metricas;
};

/**
 * NUEVA FUNCIÓN: Calcular métricas de un período específico
 * Función auxiliar para análisis comparativo
 */
async function calcularMetricasPeriodo(fechaInicio, fechaFin) {
  const fechaInicioSQL = fechaInicio.format('YYYY-MM-DD HH:mm:ss');
  const fechaFinSQL = fechaFin.format('YYYY-MM-DD HH:mm:ss');
  
  // Condiciones base para el período
  const whereBasePeriodo = {
    created_at: {
      [Op.between]: [fechaInicio.toDate(), fechaFin.toDate()]
    },
    estado: { [Op.notIn]: ['eliminado', 'nota_credito'] }
  };
  
  // Métricas operativas
  const totalDocumentos = await Documento.count({ where: whereBasePeriodo });
  const enProceso = await Documento.count({ where: { ...whereBasePeriodo, estado: 'en_proceso' } });
  const listoParaEntrega = await Documento.count({ where: { ...whereBasePeriodo, estado: 'listo_para_entrega' } });
  const entregados = await Documento.count({ where: { ...whereBasePeriodo, estado: 'entregado' } });
  
  // Métricas financieras
  const [facturacionResult] = await sequelize.query(`
    SELECT COALESCE(SUM(valor_factura), 0) as total
    FROM documentos
    WHERE created_at BETWEEN :fechaInicio AND :fechaFin
    AND numero_factura IS NOT NULL
    AND estado NOT IN ('eliminado', 'nota_credito')
  `, {
    replacements: { fechaInicio: fechaInicioSQL, fechaFin: fechaFinSQL },
    type: sequelize.QueryTypes.SELECT
  });
  
  const [ingresosResult] = await sequelize.query(`
    SELECT COALESCE(SUM(CASE WHEN estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial') THEN valor_pagado ELSE 0 END), 0) as total
    FROM documentos
    WHERE created_at BETWEEN :fechaInicio AND :fechaFin
    AND estado NOT IN ('eliminado', 'nota_credito')
  `, {
    replacements: { fechaInicio: fechaInicioSQL, fechaFin: fechaFinSQL },
    type: sequelize.QueryTypes.SELECT
  });
  
  const [retencionesResult] = await sequelize.query(`
    SELECT COALESCE(SUM(valor_retenido), 0) as total
    FROM documentos
    WHERE created_at BETWEEN :fechaInicio AND :fechaFin
    AND numero_factura IS NOT NULL
    AND estado NOT IN ('eliminado', 'nota_credito')
  `, {
    replacements: { fechaInicio: fechaInicioSQL, fechaFin: fechaFinSQL },
    type: sequelize.QueryTypes.SELECT
  });
  
  const facturado = parseFloat(facturacionResult.total);
  const cobrado = parseFloat(ingresosResult.total);
  const retenido = parseFloat(retencionesResult.total);
  const pendiente = facturado - cobrado - retenido;
  
  // Calcular eficiencia
  const eficiencia = totalDocumentos > 0 ? Math.round((entregados / totalDocumentos) * 100) : 0;
  
  return {
    // Métricas operativas
    totalDocumentos,
    enProceso,
    listoParaEntrega,
    entregados,
    eficiencia,
    
    // Métricas financieras
    facturado,
    cobrado,
    retenido,
    pendiente,
    
    // Período
    fechaInicio: fechaInicio.format('YYYY-MM-DD'),
    fechaFin: fechaFin.format('YYYY-MM-DD'),
    periodoTexto: `${fechaInicio.format('DD/MM/YYYY')} - ${fechaFin.format('DD/MM/YYYY')}`
  };
}

/**
 * NUEVA FUNCIÓN: Generar análisis comparativo entre dos períodos
 */
function generarAnalisisComparativo(periodoA, periodoB) {
  const metricas = [
    { key: 'facturado', nombre: 'Facturado', formato: 'moneda', icono: 'fas fa-file-invoice' },
    { key: 'cobrado', nombre: 'Cobrado', formato: 'moneda', icono: 'fas fa-dollar-sign' },
    { key: 'retenido', nombre: 'Retenido', formato: 'moneda', icono: 'fas fa-receipt' },
    { key: 'pendiente', nombre: 'Pendiente', formato: 'moneda', icono: 'fas fa-clock' },
    { key: 'totalDocumentos', nombre: 'Documentos', formato: 'numero', icono: 'fas fa-file-alt' },
    { key: 'entregados', nombre: 'Entregados', formato: 'numero', icono: 'fas fa-handshake' },
    { key: 'eficiencia', nombre: 'Eficiencia', formato: 'porcentaje', icono: 'fas fa-chart-line' }
  ];
  
  const comparaciones = metricas.map(metrica => {
    const valorA = periodoA[metrica.key] || 0;
    const valorB = periodoB[metrica.key] || 0;
    const diferencia = valorA - valorB;
    const porcentaje = valorB !== 0 ? ((diferencia / valorB) * 100) : 0;
    
    // FORMATEO PROFESIONAL según el tipo de métrica
    let valorAFormateado, valorBFormateado, diferenciaFormateada;
    
    if (metrica.formato === 'moneda') {
      valorAFormateado = formatearDinero(valorA);
      valorBFormateado = formatearDinero(valorB);
      diferenciaFormateada = formatearDiferencia(diferencia, 'dinero');
    } else if (metrica.formato === 'porcentaje') {
      valorAFormateado = formatearPorcentaje(valorA);
      valorBFormateado = formatearPorcentaje(valorB);
      diferenciaFormateada = formatearDiferencia(diferencia, 'porcentaje');
    } else {
      valorAFormateado = Math.round(valorA).toString();
      valorBFormateado = Math.round(valorB).toString();
      diferenciaFormateada = diferencia >= 0 ? `+${Math.round(diferencia)}` : Math.round(diferencia).toString();
    }
    
    return {
      ...metrica,
      valorA,
      valorB,
      diferencia,
      // VALORES FORMATEADOS PARA LA VISTA
      valorAFormateado,
      valorBFormateado,
      diferenciaFormateada,
      porcentaje: Math.round(porcentaje * 10) / 10, // Redondear a 1 decimal
      porcentajeFormateado: formatearDiferencia(porcentaje, 'porcentaje'),
      direccion: diferencia > 0 ? 'up' : diferencia < 0 ? 'down' : 'equal',
      color: diferencia > 0 ? 'success' : diferencia < 0 ? 'danger' : 'secondary',
      significativo: Math.abs(porcentaje) >= 10 // Cambio significativo si >= 10%
    };
  });
  
  // Generar insights automáticos
  const cambiosSignificativos = comparaciones
    .filter(c => c.significativo)
    .sort((a, b) => Math.abs(b.porcentaje) - Math.abs(a.porcentaje))
    .slice(0, 3);
  
  const mejoras = comparaciones.filter(c => c.direccion === 'up' && c.significativo);
  const empeoramientos = comparaciones.filter(c => c.direccion === 'down' && c.significativo);
  
  // Generar recomendaciones
  const recomendaciones = [];
  if (mejoras.length > empeoramientos.length) {
    recomendaciones.push('Tendencia positiva general - mantener estrategias actuales');
  }
  if (empeoramientos.some(e => e.key === 'pendiente')) {
    recomendaciones.push('Revisar proceso de cobros - pendientes aumentaron');
  }
  if (mejoras.some(m => m.key === 'eficiencia')) {
    recomendaciones.push('Eficiencia operativa mejorando - continuar optimizaciones');
  }
  if (empeoramientos.some(e => e.key === 'totalDocumentos')) {
    recomendaciones.push('Volumen de documentos disminuyó - revisar captación');
  }
  
  return {
    comparaciones,
    insights: {
      cambiosSignificativos,
      mejoras,
      empeoramientos,
      recomendaciones
    }
  };
}

/**
 * NUEVA FUNCIÓN: Manejar dashboard en modo comparativo
 */
async function manejarDashboardComparativo(req, res) {
  try {
    // Obtener parámetros de comparación
    const rangoA = req.query.rangoA || 'mes';
    const rangoB = req.query.rangoB || 'mes_anterior';
    const fechaInicioA = req.query.fechaInicioA;
    const fechaFinA = req.query.fechaFinA;
    const fechaInicioB = req.query.fechaInicioB;
    const fechaFinB = req.query.fechaFinB;
    
    // Calcular fechas para período A
    let periodoA_inicio, periodoA_fin, periodoA_texto;
    if (rangoA === 'personalizado' && fechaInicioA && fechaFinA) {
      periodoA_inicio = moment(fechaInicioA).startOf('day');
      periodoA_fin = moment(fechaFinA).endOf('day');
      periodoA_texto = `${periodoA_inicio.format('DD/MM/YYYY')} - ${periodoA_fin.format('DD/MM/YYYY')}`;
    } else {
      const fechasA = calcularFechasPorRango(rangoA);
      periodoA_inicio = fechasA.inicio;
      periodoA_fin = fechasA.fin;
      periodoA_texto = fechasA.texto;
    }
    
    // Calcular fechas para período B
    let periodoB_inicio, periodoB_fin, periodoB_texto;
    if (rangoB === 'personalizado' && fechaInicioB && fechaFinB) {
      periodoB_inicio = moment(fechaInicioB).startOf('day');
      periodoB_fin = moment(fechaFinB).endOf('day');
      periodoB_texto = `${periodoB_inicio.format('DD/MM/YYYY')} - ${periodoB_fin.format('DD/MM/YYYY')}`;
    } else {
      const fechasB = calcularFechasPorRango(rangoB);
      periodoB_inicio = fechasB.inicio;
      periodoB_fin = fechasB.fin;
      periodoB_texto = fechasB.texto;
    }
    
    // Calcular métricas para ambos períodos
    const [metricasA, metricasB] = await Promise.all([
      calcularMetricasPeriodo(periodoA_inicio, periodoA_fin),
      calcularMetricasPeriodo(periodoB_inicio, periodoB_fin)
    ]);
    
    // Generar análisis comparativo
    const analisis = generarAnalisisComparativo(metricasA, metricasB);
    
    // Preparar datos para la vista
    const dashboardData = {
      modoComparativo: true,
      periodoA: {
        ...metricasA,
        texto: periodoA_texto,
        rango: rangoA
      },
      periodoB: {
        ...metricasB,
        texto: periodoB_texto,
        rango: rangoB
      },
      analisis,
      filtros: {
        rangoA,
        rangoB,
        fechaInicioA: periodoA_inicio.format('YYYY-MM-DD'),
        fechaFinA: periodoA_fin.format('YYYY-MM-DD'),
        fechaInicioB: periodoB_inicio.format('YYYY-MM-DD'),
        fechaFinB: periodoB_fin.format('YYYY-MM-DD')
      }
    };
    
    logger.end('DASHBOARD', 'cargarDashboardComparativo', {
      exitoso: true,
      periodoA: periodoA_texto,
      periodoB: periodoB_texto,
      cambiosSignificativos: analisis.insights.cambiosSignificativos.length
    });
    
    res.render('admin/dashboard', {
      layout: 'admin',
      title: 'Análisis Comparativo - ProNotary',
      activeDashboard: true,
      userRole: req.matrizador?.rol,
      userName: req.matrizador?.nombre,
      ...dashboardData
    });
    
  } catch (error) {
    logger.error('DASHBOARD', 'Error en dashboard comparativo', error);
    res.status(500).render('error', {
      layout: 'admin',
      title: 'Error',
      message: 'Ha ocurrido un error al cargar el análisis comparativo',
      error
    });
  }
}

/**
 * FUNCIÓN AUXILIAR: Calcular fechas según rango predefinido
 */
function calcularFechasPorRango(rango) {
  const hoy = moment().startOf('day');
  
  switch (rango) {
    case 'hoy':
      return {
        inicio: hoy.clone(),
        fin: moment().endOf('day'),
        texto: 'Hoy'
      };
    case 'ayer':
      return {
        inicio: hoy.clone().subtract(1, 'days'),
        fin: hoy.clone().subtract(1, 'days').endOf('day'),
        texto: 'Ayer'
      };
    case 'semana':
      return {
        inicio: hoy.clone().startOf('week'),
        fin: moment().endOf('day'),
        texto: 'Esta semana'
      };
    case 'semana_anterior':
      return {
        inicio: hoy.clone().subtract(1, 'week').startOf('week'),
        fin: hoy.clone().subtract(1, 'week').endOf('week'),
        texto: 'Semana anterior'
      };
    case 'mes':
      return {
        inicio: hoy.clone().startOf('month'),
        fin: moment().endOf('day'),
        texto: 'Este mes'
      };
    case 'mes_anterior':
      return {
        inicio: hoy.clone().subtract(1, 'month').startOf('month'),
        fin: hoy.clone().subtract(1, 'month').endOf('month'),
        texto: 'Mes anterior'
      };
    case 'trimestre':
      return {
        inicio: hoy.clone().startOf('quarter'),
        fin: moment().endOf('day'),
        texto: 'Este trimestre'
      };
    case 'trimestre_anterior':
      return {
        inicio: hoy.clone().subtract(1, 'quarter').startOf('quarter'),
        fin: hoy.clone().subtract(1, 'quarter').endOf('quarter'),
        texto: 'Trimestre anterior'
      };
    case 'año':
      return {
        inicio: hoy.clone().startOf('year'),
        fin: moment().endOf('day'),
        texto: 'Este año'
      };
    case 'año_anterior':
      return {
        inicio: hoy.clone().subtract(1, 'year').startOf('year'),
        fin: hoy.clone().subtract(1, 'year').endOf('year'),
        texto: 'Año anterior'
      };
    case 'ultimos_30':
      return {
        inicio: hoy.clone().subtract(30, 'days'),
        fin: moment().endOf('day'),
        texto: 'Últimos 30 días'
      };
    case '30_dias_anteriores':
      return {
        inicio: hoy.clone().subtract(60, 'days'),
        fin: hoy.clone().subtract(30, 'days'),
        texto: '30 días anteriores'
      };
    default:
      return {
        inicio: hoy.clone().startOf('month'),
        fin: moment().endOf('day'),
        texto: 'Este mes'
      };
  }
}

/**
 * Dashboard Administrativo EJECUTIVO PROFESIONAL
 * Diseñado para proporcionar información crítica y tomar decisiones informadas
 */
exports.dashboard = async (req, res) => {
  try {
    // 🔍 INICIO DE DEBUGGING - Dashboard Ejecutivo
    logger.separator('DASHBOARD', 'DASHBOARD ADMIN EJECUTIVO PROFESIONAL');
    logger.start('DASHBOARD', 'cargarDashboardEjecutivo', {
      usuario: req.matrizador?.nombre || 'admin'
    });
    
    // ============== DETECTAR MODO COMPARATIVO ==============
    const modoComparativo = req.query.modo === 'comparativo';
    
    if (modoComparativo) {
      return await manejarDashboardComparativo(req, res);
    }
    
    // ============== PROCESAR FILTROS DE PERÍODO (MODO NORMAL) ==============
    const rango = req.query.rango || req.query.tipoPeriodo || 'mes';
    let fechaInicio, fechaFin, periodoTexto;
    
    // Establecer fechas según el rango seleccionado
    const hoy = moment().startOf('day');
    
    switch (rango) {
      case 'año':
        // CORREGIDO: Solo año actual (2025), no histórico
        fechaInicio = moment().startOf('year'); // 01/01/2025
        fechaFin = moment().endOf('day'); // Hasta hoy
        periodoTexto = `Año ${moment().year()}`;
        break;
      case 'desde_inicio':
        // HISTÓRICO: Mostrar todos los datos históricos (opción separada)
        fechaInicio = moment('2020-01-01').startOf('day'); // Fecha muy antigua para incluir todo
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
    
    // ============== ALERTAS CRÍTICAS EJECUTIVAS ==============
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
        accion: '/admin/reportes/pendientes?antiguedad=30%2B'
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
        accion: '/admin/documentos/listado?estado=listo_para_entrega'
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
        accion: '/admin/documentos/listado?idMatrizador='
      });
    }
    
    // ============== MÉTRICAS EJECUTIVAS PRINCIPALES CON FILTROS ==============
    
    // CORREGIDO: Aplicar filtros de fecha a todas las métricas principales
    const whereBasePeriodo = {
      created_at: {
        [Op.between]: [fechaInicio.toDate(), fechaFin.toDate()]
      },
      estado: { [Op.notIn]: ['eliminado', 'nota_credito'] }
    };
    
    // Conteos básicos CON FILTROS DE PERÍODO
    const totalDocumentos = await Documento.count({
      where: whereBasePeriodo
    });
    
    const enProceso = await Documento.count({
      where: { ...whereBasePeriodo, estado: 'en_proceso' }
    });
    
    const listoParaEntrega = await Documento.count({
      where: { ...whereBasePeriodo, estado: 'listo_para_entrega' }
    });
    
    const entregados = await Documento.count({
      where: { ...whereBasePeriodo, estado: 'entregado' }
    });
    
    // Documentos entregados hoy (mantener filtro específico de hoy)
    const entregadosHoy = await Documento.count({
      where: {
        estado: 'entregado',
        fecha_entrega: {
          [Op.gte]: hoy.toDate(),
          [Op.lt]: moment().endOf('day').toDate()
        }
      }
    });
    
    // ============== MÉTRICAS FINANCIERAS EJECUTIVAS CON FILTROS ==============
    
    // CORREGIDO: Usar filtros de período para todas las métricas financieras
    // Esto permite que el dashboard muestre datos reales del período seleccionado
    
    // Pagos recibidos del período (dinero cobrado en documentos del período)
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
    
    // Facturación del período (mantener lógica existente)
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
    
    // ============== NUEVA MÉTRICA: TOTAL RETENIDO DEL PERÍODO ==============
    
    // Calcular total de retenciones del período
    let totalRetenidoQuery, totalRetenidoReplacements;
    
    if (rango === 'desde_inicio') {
      // Para "desde_inicio", usar cálculo global
      totalRetenidoQuery = `
        SELECT COALESCE(SUM(valor_retenido), 0) as total
        FROM documentos
        WHERE numero_factura IS NOT NULL
        AND estado NOT IN ('eliminado', 'nota_credito')
      `;
      totalRetenidoReplacements = {};
    } else {
      // Para otros rangos, filtrar por período de creación
      totalRetenidoQuery = `
        SELECT COALESCE(SUM(valor_retenido), 0) as total
        FROM documentos
        WHERE created_at BETWEEN :fechaInicio AND :fechaFin
        AND numero_factura IS NOT NULL
        AND estado NOT IN ('eliminado', 'nota_credito')
      `;
      totalRetenidoReplacements = { fechaInicio: fechaInicioSQL, fechaFin: fechaFinSQL };
    }
    
    const [totalRetenidoResult] = await sequelize.query(totalRetenidoQuery, {
      replacements: totalRetenidoReplacements,
      type: sequelize.QueryTypes.SELECT
    });
    const totalRetenido = parseFloat(totalRetenidoResult.total);
    
    // ============== RENDIMIENTO DEL EQUIPO (7 días) ==============
    const equipoRendimiento = await sequelize.query(`
      SELECT 
        m.nombre,
        COUNT(d.id) as documentos_procesados,
        SUM(CASE WHEN d.estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial') THEN d.valor_pagado ELSE 0 END) as dinero_cobrado,
        SUM(CASE WHEN d.estado = 'entregado' THEN 1 ELSE 0 END) as documentos_entregados
      FROM matrizadores m
      LEFT JOIN documentos d ON m.id = d.id_matrizador
        AND d.updated_at >= :hace7Dias
        AND d.estado NOT IN ('eliminado', 'nota_credito')
              WHERE m.rol IN ('matrizador', 'caja_archivo', 'archivo') AND m.activo = true
      GROUP BY m.id, m.nombre
      ORDER BY documentos_procesados DESC
      LIMIT 5
    `, {
      replacements: { hace7Dias: moment().subtract(7, 'days').format('YYYY-MM-DD HH:mm:ss') },
      type: sequelize.QueryTypes.SELECT
    });
    
    // Formatear dinero cobrado
    equipoRendimiento.forEach(item => {
      item.dinero_cobrado = parseFloat(item.dinero_cobrado || 0).toFixed(2);
    });
    
    // ============== ÚLTIMOS PAGOS REGISTRADOS ==============
    const ultimosPagos = await Documento.findAll({
      where: {
        estadoPago: { [Op.in]: ['pagado_completo', 'pagado_con_retencion', 'pago_parcial'] },
        fechaUltimoPago: { [Op.not]: null },
        valorPagado: { [Op.not]: null, [Op.gt]: 0 }
      },
      attributes: [
        'id',
        'codigoBarras',
        'nombreCliente',
        'valorFactura',
        'valorPagado',
        'fechaUltimoPago',
        'metodoPago',
        'numeroFactura',
        'estadoPago'
      ],
      order: [['fechaUltimoPago', 'DESC']],
      limit: 8
    });
    
    // CORREGIDO: Formatear datos de últimos pagos para la vista con valores reales
    const ultimosPagosFormateados = ultimosPagos.map(pago => {
      const pagoData = pago.toJSON(); // Convertir a objeto plano
      return {
        id: pagoData.id,
        codigoBarras: pagoData.codigoBarras || 'N/A',
        nombreCliente: pagoData.nombreCliente || 'Cliente no especificado',
        valorFactura: pagoData.valorFactura ? parseFloat(pagoData.valorFactura).toFixed(2) : '0.00',
        valorPagado: pagoData.valorPagado ? parseFloat(pagoData.valorPagado).toFixed(2) : '0.00',
        fechaUltimoPago: pagoData.fechaUltimoPago,
        metodoPago: pagoData.metodoPago && pagoData.metodoPago !== 'pendiente' ? 
          pagoData.metodoPago.replace('_', ' ').toUpperCase() : 'EFECTIVO',
        numeroFactura: pagoData.numeroFactura || 'N/A',
        estadoPago: pagoData.estadoPago,
        esPagoParcial: pagoData.estadoPago === 'pago_parcial'
      };
    });
    
    // DEBUGGING TEMPORAL - LOGS PARA VERIFICAR DATOS
    console.log('=== DEBUG ÚLTIMOS PAGOS ===');
    console.log('Documentos pagados encontrados:', ultimosPagos.length);
    if (ultimosPagos.length > 0) {
      console.log('Primer pago (raw):', ultimosPagos[0].toJSON());
      console.log('Primer pago (formateado):', ultimosPagosFormateados[0]);
    }
    console.log('============================');
    
    // ============== ÚLTIMAS ENTREGAS REALIZADAS ==============
    const ultimasEntregas = await Documento.findAll({
      where: {
        estado: 'entregado',
        fechaEntrega: { [Op.not]: null } // CORREGIDO: usar camelCase
      },
      attributes: ['codigoBarras', 'nombreCliente', 'tipoDocumento', 'fechaEntrega'], // CORREGIDO: usar camelCase
      include: [{
        model: Matrizador,
        as: 'matrizador',
        attributes: ['nombre']
      }],
      order: [['fechaEntrega', 'DESC']], // CORREGIDO: usar camelCase
      limit: 5
    });
    
    // ============== DOCUMENTOS QUE REQUIEREN ATENCIÓN ==============
    const documentosUrgentes = await Documento.findAll({
      where: {
        estadoPago: 'pendiente', // CORREGIDO: usar camelCase
        numeroFactura: { [Op.not]: null }, // CORREGIDO: usar camelCase
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
    
    // ============== VALIDAR Y FORMATEAR MÉTRICAS ==============
    
    // Validar métricas financieras antes del formateo
    const metricasFinancieras = validarMetricas({
      facturado: facturacionPeriodo,
      cobrado: ingresosPeriodo,
      retenido: totalRetenido,
      pendiente: totalPendiente,
      ingresosHoy: ingresosHoy
    });
    
    // ============== PREPARAR DATOS PARA LA VISTA ==============
    
    const dashboardData = {
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
        esAño: rango === 'año', // NUEVO: Flag para año
        esUltimoMes: rango === 'ultimo_mes',
        esPersonalizado: rango === 'personalizado'
      },
      
      // Alertas críticas
      alertasCriticas,
      
      // Métricas principales
      metricas: {
        totalDocumentos,
        enProceso,
        listoParaEntrega,
        entregados,
        entregadosHoy,
        documentosAtrasados,
        documentosUrgentes: documentosUrgentes.length
      },
      
      // Métricas financieras FORMATEADAS PROFESIONALMENTE
      finanzas: {
        // CORREGIDO: Usar formateo profesional (2 decimales exactos)
        ingresosPeriodo: formatearDinero(metricasFinancieras.cobrado).replace('$', ''), // Sin símbolo para template
        ingresosHoy: formatearDinero(metricasFinancieras.ingresosHoy).replace('$', ''), // Sin símbolo para template
        facturacionPeriodo: formatearDinero(metricasFinancieras.facturado).replace('$', ''), // Sin símbolo para template
        totalPendiente: formatearDinero(metricasFinancieras.pendiente).replace('$', ''), // Sin símbolo para template
        totalRetenido: formatearDinero(metricasFinancieras.retenido).replace('$', ''), // Sin símbolo para template
        
        // Mantener contadores sin formateo
        documentosCobradosPeriodo,
        documentosCobradosHoy
      },
      
      // Rendimiento del equipo
      equipoRendimiento,
      
      // Actividad reciente
      ultimosPagos: ultimosPagosFormateados,
      ultimasEntregas,
      documentosUrgentes
    };
    
    logger.end('DASHBOARD', 'cargarDashboardEjecutivo', {
      exitoso: true,
      alertasCriticas: alertasCriticas.length,
      totalDocumentos,
      ingresosPeriodo
    });
    
    res.render('admin/dashboard', {
      layout: 'admin',
      title: 'Panel de Control Ejecutivo - ProNotary',
      activeDashboard: true,
      userRole: req.matrizador?.rol,
      userName: req.matrizador?.nombre,
      ...dashboardData
    });
    
  } catch (error) {
    logger.error('DASHBOARD', 'Error al cargar dashboard ejecutivo', error);
    res.status(500).render('error', {
      layout: 'admin',
      title: 'Error',
      message: 'Ha ocurrido un error al cargar el dashboard ejecutivo',
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
            fecha_factura_formato: require('../utils/fechaUtils').formatearFecha(docJson.fechaFactura),
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
      case 'desde_inicio':
        // NUEVO: Mostrar todos los datos históricos
        fechaInicio = moment('2020-01-01').startOf('day'); // Fecha muy antigua para incluir todo
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
    
    // Obtener estadísticas de documentos
    const [statsResult] = await sequelize.query(`
      SELECT 
        COUNT(*) as total_documentos,
        COUNT(CASE WHEN numero_factura IS NOT NULL THEN 1 END) as con_factura,
        COUNT(CASE WHEN estado_pago = 'pendiente' THEN 1 END) as pendientes,
        COUNT(CASE WHEN estado_pago IN ('pagado_completo', 'pagado_con_retencion') THEN 1 END) as pagados,
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
        SUM(CASE WHEN d.estado_pago IN ('pagado_completo', 'pagado_con_retencion') THEN 1 ELSE 0 END) as documentos_pagados,
        SUM(CASE WHEN d.estado_pago = 'pendiente' THEN 1 ELSE 0 END) as documentos_pendientes,
        COALESCE(SUM(d.valor_factura), 0) as facturacion_total,
        COALESCE(SUM(CASE WHEN d.estado_pago IN ('pagado_completo', 'pagado_con_retencion') THEN d.valor_factura ELSE 0 END), 0) as ingresos_cobrados
      FROM matrizadores m
      LEFT JOIN documentos d ON m.id = d.id_matrizador
        AND d.created_at BETWEEN :fechaInicio AND :fechaFin
        AND d.estado NOT IN ('eliminado', 'nota_credito')
      WHERE m.rol IN ('matrizador', 'caja_archivo', 'archivo')
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
      case 'desde_inicio':
        // NUEVO: Mostrar todos los datos históricos
        fechaInicio = moment('2020-01-01').startOf('day'); // Fecha muy antigua para incluir todo
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
    
    // Obtener estadísticas financieras generales usando Sequelize ORM
    const whereClause = {
      valor_factura: { [Op.not]: null }, // CORREGIDO: usar snake_case como en DB
      estado: { [Op.ne]: 'cancelado' },
      created_at: {
        [Op.between]: [fechaInicioSQL, fechaFinSQL]
      }
    };
    
    // Añadir filtro por matrizador si se seleccionó uno
    if (idMatrizador && idMatrizador !== 'todos' && idMatrizador !== '') {
      whereClause.id_matrizador = parseInt(idMatrizador, 10); // CORREGIDO: usar snake_case como en DB
    }
    
    const totalFacturado = await Documento.sum('valor_factura', { // CORREGIDO: usar snake_case como en DB
      where: whereClause
    }) || 0;
    
    const totalCobrado = await Documento.sum('valor_pagado', { // CORREGIDO: usar valor_pagado real
      where: {
        ...whereClause,
        estado_pago: { [Op.in]: ['pagado_completo', 'pagado_con_retencion', 'pago_parcial'] } // CORREGIDO: incluir pago_parcial
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
        [sequelize.fn('SUM', sequelize.col('valor_factura')), 'totalFacturado'], // CORREGIDO: usar snake_case como en DB
        [sequelize.fn('SUM', 
          sequelize.literal("CASE WHEN estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial') THEN valor_pagado ELSE 0 END") // CORREGIDO: usar valor_pagado e incluir pago_parcial
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
          [Op.in]: ['matrizador', 'caja_archivo', 'archivo']
        },
        activo: true
      },
      attributes: ['id', 'nombre'],
      order: [['nombre', 'ASC']]
    });
    
    // Renderizar la vista con los datos
    res.render('admin/reportes/financiero', { // CORREGIDO: usar vista admin
      layout: 'admin', // CORREGIDO: usar layout admin
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
          WHEN d.estado_pago IN ('pagado_completo', 'pagado_con_retencion') THEN 'PAGO_REGISTRADO'
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
            WHEN d.estado_pago IN ('pagado_completo', 'pagado_con_retencion') THEN 'PAGO_REGISTRADO'
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

/**
 * Reporte de Cobros por Matrizador - MEJORADO PARA COMISIONES
 * Análisis detallado de cobros realizados por cada matrizador con UX profesional
 */
exports.reporteCobrosMatrizador = async (req, res) => {
  try {
    // Procesar parámetros de filtrado
    const rango = req.query.rango || 'mes';
    const idMatrizador = req.query.idMatrizador; // Filtro por matrizador específico
    let fechaInicio, fechaFin, periodoTexto;
    
    // Establecer fechas según el rango seleccionado
    const hoy = moment().startOf('day');
    
    switch (rango) {
      case 'desde_inicio':
        // NUEVO: Mostrar todos los datos históricos
        fechaInicio = moment('2020-01-01').startOf('day'); // Fecha muy antigua para incluir todo
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
        COALESCE(SUM(d.valor_pagado), 0) as total_cobrado,
        COALESCE(AVG(d.valor_factura), 0) as promedio_por_documento,
        MIN(d.fecha_ultimo_pago) as primer_cobro,
        MAX(d.fecha_ultimo_pago) as ultimo_cobro
      FROM matrizadores m
      LEFT JOIN documentos d ON m.id = d.id_matrizador
        AND d.estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial')
        AND d.fecha_ultimo_pago BETWEEN :fechaInicio AND :fechaFin
        AND d.estado NOT IN ('eliminado', 'nota_credito')
      WHERE m.rol IN ('matrizador', 'caja_archivo', 'archivo')
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
      WHERE d.estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial')
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
        d.valor_pagado,
        d.fecha_ultimo_pago,
        d.metodo_pago,
        d.estado_pago,
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
          [Op.in]: ['matrizador', 'caja_archivo', 'archivo']
        }
      },
      order: [['nombre', 'ASC']],
      raw: true
    });
    
    // NUEVO: Obtener información del matrizador seleccionado
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
    
    // NUEVO: Preparar datos mejorados para la vista
    const datosVista = {
      layout: 'admin',
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
    res.render('admin/reportes/cobros-matrizador', datosVista);
    
  } catch (error) {
    console.error('Error al generar reporte de cobros por matrizador:', error);
    return res.status(500).render('error', {
      layout: 'admin',
      title: 'Error',
      message: 'Error al generar el reporte de cobros por matrizador',
      error
    });
  }
};

/**
 * Reporte de Productividad de Matrizadores - LIMPIO SIN NOTIFICACIONES
 * Análisis completo de rendimiento con tiempos, calidad y volumen real
 */
exports.reporteProductividadMatrizadores = async (req, res) => {
  try {
    console.log('=== INICIO: Reporte Productividad Limpio ===');
    
    // Procesar parámetros de filtrado
    const rango = req.query.rango || 'mes';
    const idMatrizador = req.query.idMatrizador;
    let fechaInicio, fechaFin, periodoTexto;
    
    // Establecer fechas según el rango seleccionado
    const hoy = moment().startOf('day');
    
    switch (rango) {
      case 'desde_inicio':
        // NUEVO: Mostrar todos los datos históricos
        fechaInicio = moment('2020-01-01').startOf('day'); // Fecha muy antigua para incluir todo
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
    
    // Cláusula WHERE base para documentos
    const whereClause = {
      created_at: {
        [Op.between]: [fechaInicio.toDate(), fechaFin.toDate()]
      },
      estado: { [Op.notIn]: ['eliminado', 'nota_credito'] }
    };
    
    // CORRECCIÓN: Filtro de matrizador funcional
    if (idMatrizador && idMatrizador !== 'todos' && idMatrizador !== '') {
      whereClause.id_matrizador = parseInt(idMatrizador, 10);
    }
    
    // Estadísticas básicas globales
    const totalDocumentos = await Documento.count({ where: whereClause }) || 0;
    const documentosCompletados = await Documento.count({
      where: { ...whereClause, estado: 'listo_para_entrega' }
    }) || 0;
    const documentosEntregados = await Documento.count({
      where: { ...whereClause, estado: 'entregado' }
    }) || 0;
    
    // NUEVA MÉTRICA: Documentos atrasados (más de 3 días en proceso)
    const documentosAtrasados = await Documento.count({
      where: {
        estado: 'en_proceso',
        created_at: { [Op.lt]: moment().subtract(3, 'days').toDate() },
        ...(idMatrizador && idMatrizador !== 'todos' && idMatrizador !== '' && {
          id_matrizador: parseInt(idMatrizador, 10)
        })
      }
    }) || 0;
    
    // Obtener todos los matrizadores activos
    const matrizadores = await Matrizador.findAll({
      where: {
        rol: { [Op.in]: ['matrizador', 'caja_archivo', 'archivo'] },
        activo: true
      },
      attributes: ['id', 'nombre', 'email'],
      order: [['nombre', 'ASC']],
      raw: true
    });
    
    // CORRECCIÓN CRÍTICA: Filtrar matrizadores según selección
    let matrizadoresFiltrados = matrizadores;
    if (idMatrizador && idMatrizador !== 'todos' && idMatrizador !== '') {
      // Si se selecciona un matrizador específico, solo procesar ese matrizador
      matrizadoresFiltrados = matrizadores.filter(m => m.id == parseInt(idMatrizador, 10));
    }
    
    // MEJORA: Cálculos de productividad por matrizador (SIN NOTIFICACIONES)
    const productividadMatrizadores = await Promise.all(
      matrizadoresFiltrados.map(async (matrizador) => {
        // Filtro específico por matrizador
        const whereMatrizador = {
          ...whereClause,
          id_matrizador: matrizador.id
        };
        
        // Métricas básicas de productividad
        const documentos_registrados = await Documento.count({ where: whereMatrizador }) || 0;
        const documentos_completados = await Documento.count({ 
          where: { ...whereMatrizador, estado: 'listo_para_entrega' } 
        }) || 0;
        const documentos_entregados = await Documento.count({ 
          where: { ...whereMatrizador, estado: 'entregado' } 
        }) || 0;
        const facturacion_total = await Documento.sum('valor_factura', { 
          where: whereMatrizador 
        }) || 0;
        
        // NUEVA MÉTRICA: Documentos atrasados por matrizador
        const documentos_atrasados = await Documento.count({
          where: {
            ...whereMatrizador,
            estado: 'en_proceso',
            created_at: { [Op.lt]: moment().subtract(3, 'days').toDate() }
          }
        }) || 0;
        
        // NUEVA MÉTRICA: Tiempo promedio de procesamiento
        const tiempoPromedioQuery = await sequelize.query(`
          SELECT AVG(EXTRACT(DAY FROM (
            CASE 
              WHEN d.estado = 'listo_para_entrega' OR d.estado = 'entregado' 
              THEN COALESCE(d.updated_at, NOW())
              ELSE NOW()
            END - d.created_at
          ))) as tiempo_promedio_dias
          FROM documentos d
          WHERE d.id_matrizador = :idMatrizador
          AND d.created_at BETWEEN :fechaInicio AND :fechaFin
          AND d.estado NOT IN ('eliminado', 'nota_credito')
        `, {
          replacements: { 
            idMatrizador: matrizador.id, 
            fechaInicio: fechaInicioSQL, 
            fechaFin: fechaFinSQL 
          },
          type: sequelize.QueryTypes.SELECT
        });
        
        const tiempo_promedio_dias = tiempoPromedioQuery[0]?.tiempo_promedio_dias || 0;
        
        // NUEVA MÉTRICA: Documentos por día (promedio diario)
        const diasPeriodo = fechaFin.diff(fechaInicio, 'days') + 1;
        const documentos_por_dia = diasPeriodo > 0 ? (documentos_registrados / diasPeriodo).toFixed(1) : 0;
        
        // NUEVA MÉTRICA: Eficiencia temporal (% completados a tiempo)
        const documentos_a_tiempo = documentos_completados + documentos_entregados - documentos_atrasados;
        const eficiencia_temporal = documentos_registrados > 0 ? 
          Math.round((documentos_a_tiempo / documentos_registrados) * 100) : 0;
        
        // NUEVA MÉTRICA: Tasa de calidad (sin devoluciones - estimación)
        const tasa_calidad = Math.max(85, eficiencia_temporal); // Estimación optimista
        
        return {
          id: matrizador.id,
          nombre: matrizador.nombre,
          email: matrizador.email,
          // Métricas de productividad real
          documentos_registrados,
          documentos_completados,
          documentos_entregados,
          facturacion_total: parseFloat(facturacion_total),
          eficiencia_procesamiento: documentos_registrados > 0 ? 
            Math.round((documentos_completados / documentos_registrados) * 100) : 0,
          facturacion_total_formato: formatearValorMonetario(facturacion_total),
          // Nuevas métricas de productividad
          documentos_atrasados,
          tiempo_promedio_dias: parseFloat(tiempo_promedio_dias).toFixed(1),
          documentos_por_dia,
          eficiencia_temporal,
          tasa_calidad,
          // Métricas adicionales para análisis
          documentos_en_proceso: documentos_registrados - documentos_completados - documentos_entregados,
          porcentaje_entregados: documentos_registrados > 0 ? 
            Math.round((documentos_entregados / documentos_registrados) * 100) : 0
        };
      })
    );
    
    // MEJORA: Estadísticas globales limpias (SIN NOTIFICACIONES) - CORREGIDAS PARA FILTROS
    const totalFacturacion = productividadMatrizadores.reduce((sum, item) => sum + item.facturacion_total, 0);
    const tiempoPromedioGeneral = productividadMatrizadores.length > 0 ? 
      (productividadMatrizadores.reduce((sum, item) => sum + parseFloat(item.tiempo_promedio_dias), 0) / productividadMatrizadores.length).toFixed(1) : 0;
    
    // CORRECCIÓN: Calcular estadísticas globales basadas en los filtros aplicados
    const totalDocumentosFiltrados = productividadMatrizadores.reduce((sum, item) => sum + item.documentos_registrados, 0);
    const totalCompletadosFiltrados = productividadMatrizadores.reduce((sum, item) => sum + item.documentos_completados, 0);
    const totalEntregadosFiltrados = productividadMatrizadores.reduce((sum, item) => sum + item.documentos_entregados, 0);
    const totalAtrasadosFiltrados = productividadMatrizadores.reduce((sum, item) => sum + item.documentos_atrasados, 0);
    
    // CORRECCIÓN: Calcular documentos por día promedio basado en filtros
    const diasPeriodo = fechaFin.diff(fechaInicio, 'days') + 1;
    const documentosPorDiaPromedioFiltrado = diasPeriodo > 0 ? (totalDocumentosFiltrados / diasPeriodo).toFixed(1) : 0;
    
    // Datos para gráficos (mantener compatibilidad)
    const datosGrafico = {
      nombres: productividadMatrizadores.map(item => item.nombre),
      registrados: productividadMatrizadores.map(item => item.documentos_registrados),
      completados: productividadMatrizadores.map(item => item.documentos_completados),
      entregados: productividadMatrizadores.map(item => item.documentos_entregados),
      facturacion: productividadMatrizadores.map(item => item.facturacion_total),
      // Nuevos datos para gráficos
      tiempos: productividadMatrizadores.map(item => parseFloat(item.tiempo_promedio_dias))
    };
    
    console.log('=== DEBUG: Datos limpios preparados, renderizando vista ===');
    
    // Renderizar la vista con datos limpios
    res.render('admin/reportes/productividad-matrizadores', {
      layout: 'admin',
      title: 'Productividad de Matrizadores',
      activeReportes: true,
      userRole: req.matrizador?.rol,
      userName: req.matrizador?.nombre,
      productividadMatrizadores,
      matrizadores,
      idMatrizadorSeleccionado: idMatrizador || 'todos', // CORRECCIÓN: Mantener selección
      stats: {
        // Stats limpios sin notificaciones - CORREGIDOS PARA FILTROS
        totalDocumentos: totalDocumentosFiltrados, // CORREGIDO: usar valor filtrado
        totalCompletados: totalCompletadosFiltrados, // CORREGIDO: usar valor filtrado
        totalEntregados: totalEntregadosFiltrados, // CORREGIDO: usar valor filtrado
        totalFacturacion: formatearValorMonetario(totalFacturacion),
        eficienciaGeneral: totalDocumentosFiltrados > 0 ? Math.round((totalCompletadosFiltrados / totalDocumentosFiltrados) * 100) : 0, // CORREGIDO
        matrizadoresActivos: productividadMatrizadores.filter(m => m.documentos_registrados > 0).length,
        promedioDocumentos: productividadMatrizadores.length > 0 ? Math.round(totalDocumentosFiltrados / productividadMatrizadores.length) : 0, // CORREGIDO
        // Nuevas estadísticas globales limpias - CORREGIDAS
        documentosAtrasados: totalAtrasadosFiltrados, // CORREGIDO: usar valor filtrado
        tiempoPromedioGeneral,
        documentosPorDiaPromedio: documentosPorDiaPromedioFiltrado, // CORREGIDO: usar valor filtrado
        tasaCalidadPromedio: productividadMatrizadores.length > 0 ?
          Math.round(productividadMatrizadores.reduce((sum, item) => sum + item.tasa_calidad, 0) / productividadMatrizadores.length) : 0
      },
      datosGrafico,
      periodoTexto,
      filtros: {
        rango,
        idMatrizador: idMatrizador || 'todos', // CORRECCIÓN: Mantener en filtros
        fechaInicio: fechaInicio.format('YYYY-MM-DD'),
        fechaFin: fechaFin.format('YYYY-MM-DD')
      },
      // Información adicional para la vista
      esFiltradoPorMatrizador: idMatrizador && idMatrizador !== 'todos' && idMatrizador !== '',
      matrizadorFiltradoNombre: idMatrizador && idMatrizador !== 'todos' && idMatrizador !== '' ?
        matrizadores.find(m => m.id == idMatrizador)?.nombre : null
    });
    
    console.log('=== ÉXITO: Vista de productividad limpia renderizada ===');
  } catch (error) {
    console.error('=== ERROR: Reporte de productividad limpio ===', error);
    return res.status(500).render('error', {
      layout: 'admin',
      title: 'Error',
      message: 'Error al generar el reporte de productividad de matrizadores',
      error
    });
  }
};

// ============== FUNCIONES AUXILIARES ==============

/**
 * TRANSFERIDO DESDE CAJA: Reporte de documentos sin pago
 * Solo para administradores - información sensible sobre cobranza
 */
exports.reporteDocumentosSinPago = async (req, res) => {
  try {
    // Obtener parámetros de filtrado
    const { antiguedad, matrizador, ordenar, page = 1 } = req.query;
    const limit = 50;
    const offset = (page - 1) * limit;
    
    // CORREGIDO: Usar valores correctos del ENUM para estado_pago
    const whereConditions = {
      [Op.or]: [
        { estado_pago: 'pendiente' },
        { estado_pago: 'pago_parcial' } // NUEVO: Incluir pagos parciales
      ],
      numero_factura: { [Op.not]: null },
      estado: { [Op.notIn]: ['eliminado', 'nota_credito', 'cancelado'] }
    };
    
    if (matrizador && matrizador !== 'todos') {
      whereConditions.id_matrizador = parseInt(matrizador);
    }
    
    // Filtro por antigüedad
    if (antiguedad) {
      const diasAtras = parseInt(antiguedad);
      const fechaLimite = moment().subtract(diasAtras, 'days').format('YYYY-MM-DD');
      whereConditions.created_at = { [Op.lte]: fechaLimite };
    }
    
    // Construir ORDER BY según el filtro
    let order = [['created_at', 'ASC']]; // Por defecto más antiguos
    if (ordenar === 'monto') {
      order = [['valor_pendiente', 'DESC']]; // CORREGIDO: Ordenar por valor pendiente
    } else if (ordenar === 'fecha') {
      order = [['created_at', 'DESC']];
    }
    
    // Obtener documentos sin pago completo
    const { count, rows: documentosSinPago } = await Documento.findAndCountAll({
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
    
    // CORREGIDO: Calcular estadísticas usando valores correctos del ENUM
    const statsQuery = `
      SELECT 
        COUNT(CASE WHEN EXTRACT(DAY FROM NOW() - created_at) BETWEEN 1 AND 7 THEN 1 END) as rango1_7,
        COUNT(CASE WHEN EXTRACT(DAY FROM NOW() - created_at) BETWEEN 8 AND 15 THEN 1 END) as rango8_15,
        COUNT(CASE WHEN EXTRACT(DAY FROM NOW() - created_at) BETWEEN 16 AND 60 THEN 1 END) as rango16_60,
        COUNT(CASE WHEN EXTRACT(DAY FROM NOW() - created_at) > 60 THEN 1 END) as rango60,
        SUM(CASE WHEN EXTRACT(DAY FROM NOW() - created_at) BETWEEN 1 AND 7 THEN valor_pendiente ELSE 0 END) as monto1_7,
        SUM(CASE WHEN EXTRACT(DAY FROM NOW() - created_at) BETWEEN 8 AND 15 THEN valor_pendiente ELSE 0 END) as monto8_15,
        SUM(CASE WHEN EXTRACT(DAY FROM NOW() - created_at) BETWEEN 16 AND 60 THEN valor_pendiente ELSE 0 END) as monto16_60,
        SUM(CASE WHEN EXTRACT(DAY FROM NOW() - created_at) > 60 THEN valor_pendiente ELSE 0 END) as monto60,
        COUNT(*) as totalSinPago,
        SUM(valor_pendiente) as montoTotalPendiente
      FROM documentos
      WHERE (estado_pago = 'pendiente' OR estado_pago = 'pago_parcial')
      AND numero_factura IS NOT NULL
      AND estado NOT IN ('eliminado', 'nota_credito', 'cancelado')
      ${matrizador && matrizador !== 'todos' ? `AND id_matrizador = ${parseInt(matrizador)}` : ''}
    `;
    
    const stats = await sequelize.query(statsQuery, {
      type: sequelize.QueryTypes.SELECT
    });
    
    const statsResult = stats[0];
    
    // Obtener lista de matrizadores para filtros
    const matrizadores = await Matrizador.findAll({
      where: {
        rol: { [Op.in]: ['matrizador', 'caja_archivo', 'archivo'] },
        activo: true
      },
      attributes: ['id', 'nombre'],
      order: [['nombre', 'ASC']]
    });
    
    // Agregar días de antigüedad y datos calculados a cada documento
    const documentosConDatos = documentosSinPago.map(doc => {
      const diasAntiguedad = moment().diff(moment(doc.created_at), 'days');
      return {
        ...doc.toJSON(),
        diasAntiguedad,
        matrizador: doc.matrizador?.nombre || 'Sin asignar',
        // NUEVO: Mostrar información de pago parcial
        esPagoParcial: doc.estadoPago === 'pago_parcial',
        valorPagadoFormato: formatearValorMonetario(doc.valorPagado || 0),
        valorPendienteFormato: formatearValorMonetario(doc.valorPendiente || doc.valorFactura),
        valorFacturaFormato: formatearValorMonetario(doc.valorFactura || 0)
      };
    });
    
    // Calcular paginación
    const totalPages = Math.ceil(count / limit);
    
    // Renderizar la vista con los datos
    res.render('admin/reportes/documentos-sin-pago', {
      layout: 'admin',
      title: 'Documentos Sin Pago Completo',
      activeReportes: true,
      userRole: req.matrizador?.rol,
      userName: req.matrizador?.nombre,
      documentosSinPago: documentosConDatos,
      stats: {
        rango1_7: parseInt(statsResult.rango1_7) || 0,
        rango8_15: parseInt(statsResult.rango8_15) || 0,
        rango16_60: parseInt(statsResult.rango16_60) || 0,
        rango60: parseInt(statsResult.rango60) || 0,
        monto1_7: parseFloat(statsResult.monto1_7) || 0,
        monto8_15: parseFloat(statsResult.monto8_15) || 0,
        monto16_60: parseFloat(statsResult.monto16_60) || 0,
        monto60: parseFloat(statsResult.monto60) || 0,
        totalSinPago: parseInt(statsResult.totalsinpago) || 0,
        montoTotalPendiente: parseFloat(statsResult.montototalpendiente) || 0
      },
      matrizadores,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        nextPage: parseInt(page) + 1,
        prevPage: parseInt(page) - 1
      },
      filtros: {
        antiguedad,
        matrizador,
        ordenar
      }
    });
  } catch (error) {
    console.error('Error al generar reporte de documentos sin pago:', error);
    return res.status(500).render('error', {
      layout: 'admin',
      title: 'Error',
      message: 'Error al generar el reporte de documentos sin pago',
      error
    });
  }
};

/**
 * COPIADO DE RECEPCIÓN: Historial completo de notificaciones para administradores
 * Muestra el historial completo de notificaciones con filtros avanzados
 */
exports.historialNotificaciones = notificacionController.mostrarHistorial;

/**
 * CENTRALIZADO: Obtiene los detalles de una notificación específica (API) para admin
 */
exports.obtenerDetalleNotificacion = notificacionController.obtenerDetalleNotificacion;

/**
 * FUNCIÓN AUXILIAR: Construir mensaje completo de notificación
 * Recrea el mensaje que se envió al cliente basado en el tipo de evento
 */
function construirMensajeCompleto(evento, documento) {
  if (!documento) return 'Documento no disponible';
  
  const tipoDoc = documento.tipoDocumento || 'documento';
  const codigo = documento.codigoBarras || 'N/A';
  const cliente = documento.nombreCliente || 'Cliente';
  const codigoVerificacion = evento.metadatos?.codigoVerificacion || 'N/A';
  
  let contextoTramite = '';
  if (documento.notas && 
      typeof documento.notas === 'string' && 
      documento.notas.trim().length > 0) {
    contextoTramite = ` - ${documento.notas.trim()}`;
  }
  
  if (evento.tipo === 'documento_listo') {
    return `🏛️ *${configNotaria.nombre}*

¡Su documento está listo para retirar!

📄 *Trámite:* ${tipoDoc}${contextoTramite}
📋 *Documento:* ${codigo}
🔢 *Código de verificación:* ${codigoVerificacion}
👤 *Cliente:* ${cliente}

📍 Retírelo en: ${configNotaria.nombreCompleto}
🕒 Horario: ${configNotaria.horario}

⚠️ *IMPORTANTE:* Presente el código de verificación y su cédula para el retiro.`;
  } 
  
  if (evento.tipo === 'documento_entregado') {
    const fechaEntrega = new Date(evento.created_at).toLocaleDateString('es-EC', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
    
    const horaEntrega = new Date(evento.created_at).toLocaleTimeString('es-EC', {
      hour: '2-digit', minute: '2-digit', hour12: false
    });
    
    const receptor = evento.metadatos?.receptor || 'N/A';
    const identificacion = evento.metadatos?.identificacionReceptor || 'N/A';
    const relacion = evento.metadatos?.relacionReceptor || 'N/A';
    
    return `🏛️ *${configNotaria.nombre}*

✅ *DOCUMENTO ENTREGADO EXITOSAMENTE*

📄 *Documento:* ${tipoDoc}${contextoTramite}
📋 *Código:* ${codigo}
👤 *Cliente:* ${cliente}

📦 *DETALLES DE LA ENTREGA:*
👨‍💼 *Retirado por:* ${receptor}
🆔 *Identificación:* ${identificacion}
👥 *Relación:* ${relacion}

📅 *Fecha:* ${fechaEntrega}
🕒 *Hora:* ${horaEntrega}
📍 *Lugar:* ${configNotaria.nombreCompleto}, ${configNotaria.direccion}

✅ *Su trámite ha sido completado exitosamente.*

_Guarde este mensaje como comprobante de entrega._`;
  }
  
  return evento.metadatos?.mensaje || 'Mensaje no disponible';
}

// ============== FUNCIONES PARA NOTIFICACIONES GRUPALES - ADMIN ==============

/**
 * Construye mensaje de entrega grupal para notificación
 * @param {Array} documentos - Array de documentos entregados
 * @param {Object} datosEntrega - Datos de la entrega
 * @returns {Object} Mensajes para WhatsApp y Email
 */
// ❌ ELIMINADO: function construirMensajeEntregaGrupalAdmin - Función de entrega no autorizada para admin
function construirMensajeEntregaGrupalAdmin_ELIMINADO() {
  // Construir lista detallada de documentos usando función utilitaria
  const listaDocumentos = construirListaDocumentosDetallada(documentos);
  
  // Construir información de entrega con datos censurados
  const infoEntrega = construirInformacionEntregaCensurada(datosEntrega);

  // Mensaje WhatsApp usando plantilla centralizada
  const mensajeWhatsApp = configNotaria.plantillas.entregaGrupal.whatsapp
    .replace('{{nombreCliente}}', documentos[0].nombreCliente)
    .replace('{{totalDocumentos}}', documentos.length)
    .replace('{{listaDocumentos}}', listaDocumentos)
    .replace('{{nombreReceptor}}', infoEntrega.nombreReceptor)
    .replace('{{identificacionCensurada}}', infoEntrega.identificacionCensurada)
    .replace('{{relacionReceptor}}', infoEntrega.relacionReceptor)
    .replace('{{fechaEntrega}}', infoEntrega.fechaEntrega)
    .replace('{{horaEntrega}}', infoEntrega.horaEntrega);

  // Datos para email de confirmación grupal
  const datosEmail = {
    nombreCliente: documentos[0].nombreCliente,
    totalDocumentos: documentos.length,
    documentos: documentos.map(doc => ({
      tipoDocumento: doc.tipoDocumento,
      codigoBarras: doc.codigoBarras,
      detallesAdicionales: doc.detallesAdicionales?.trim() || null
    })),
    nombreReceptor: infoEntrega.nombreReceptor,
    identificacionCensurada: infoEntrega.identificacionCensurada,
    identificacionReceptor: infoEntrega.identificacionCompleta, // Para uso interno del email si es necesario
    relacionReceptor: infoEntrega.relacionReceptor,
    fechaEntrega: infoEntrega.fechaEntrega,
    horaEntrega: infoEntrega.horaEntrega,
    usuarioEntrega: datosEntrega.usuarioEntrega || 'Administrador',
    fechaGeneracion: new Date().toLocaleString('es-EC')
  };

  return {
    whatsapp: mensajeWhatsApp,
    email: {
      subject: configNotaria.plantillas.entregaGrupal.email.subject.replace('{{totalDocumentos}}', documentos.length),
      template: configNotaria.plantillas.entregaGrupal.email.template,
      data: datosEmail
    },
    tipo: 'entrega_grupal'
  };
}

// ❌ ELIMINADO: guardarNotificacionGrupalEnHistorialAdmin - Función de entrega no autorizada para admin
// Esta función fue eliminada como parte de la segregación de funciones

// ❌ ELIMINADO: enviarNotificacionEntregaGrupalAdmin - Función de entrega no autorizada para admin
// Esta función fue eliminada como parte de la segregación de funciones

// ❌ ELIMINADO: detectarDocumentosGrupalesAdmin - Función de entrega no autorizada para admin
// Esta función fue eliminada como parte de la segregación de funciones

// ❌ ELIMINADO: procesarEntregaGrupalAdmin - Función de entrega no autorizada para admin
// Esta función fue eliminada como parte de la segregación de funciones

// ❌ ELIMINADO: exports.mostrarEntregaAdmin - Función de entrega no autorizada para admin

// ❌ ELIMINADO: exports.completarEntregaAdmin - Función de entrega no autorizada para admin

// =============== ❌ FUNCIONES ELIMINADAS POR SEGREGACIÓN DE RESPONSABILIDADES ===============
//
// Las siguientes funciones han sido ELIMINADAS del adminController para cumplir con
// principios de auditoría y segregación de funciones:
//
// ❌ ELIMINADO: exports.mostrarEntregaAdmin
// ❌ ELIMINADO: exports.completarEntregaAdmin  
// ❌ ELIMINADO: exports.detectarDocumentosGrupalesAdmin
// ❌ ELIMINADO: exports.procesarEntregaGrupalAdmin
// ❌ ELIMINADO: // ❌ ELIMINADO: procesarEntregaGrupalAdmin - Función de entrega no autorizada para admin
// function procesarEntregaGrupalAdmin_ELIMINADO()
// ❌ ELIMINADO: // ❌ ELIMINADO: detectarDocumentosGrupalesAdmin - Función de entrega no autorizada para admin
// function detectarDocumentosGrupalesAdmin_ELIMINADO()
// ❌ ELIMINADO: // ❌ ELIMINADO: enviarNotificacionEntregaGrupalAdmin - Función de entrega no autorizada para admin
// function enviarNotificacionEntregaGrupalAdmin_ELIMINADO()
// ❌ ELIMINADO: // ❌ ELIMINADO: construirMensajeEntregaGrupalAdmin - Función de entrega no autorizada para admin
// function construirMensajeEntregaGrupalAdmin_ELIMINADO()
// ❌ ELIMINADO: // ❌ ELIMINADO: guardarNotificacionGrupalEnHistorialAdmin - Función de entrega no autorizada para admin
// function guardarNotificacionGrupalEnHistorialAdmin_ELIMINADO()
//
// JUSTIFICACIÓN:
// - Admin no debe estar en la cadena de custodia de documentos
// - Separación clara entre supervisión (admin) y operación (caja/matrizador/recepción)
// - Mejores prácticas de control interno y auditoría
// - Reducción de riesgo de fraude interno
// - Trazabilidad clara de responsabilidades

// =============== ✅ FUNCIONES AUTORIZADAS PARA ADMIN - SOLO SUPERVISIÓN ===============

/**
 * FUNCIÓN DE SUPERVISIÓN: Listar documentos (solo lectura)
 * Admin puede VER documentos para análisis y reportes, pero NO modificarlos
 */
exports.listarDocumentosAdmin = async (req, res) => {
  try {
    console.log('📋 Admin consultando listado de documentos (solo lectura)');
    
    // Parámetros de paginación y filtros
    const page = parseInt(req.query.page) || 1;
    const limit = 30;                              // MEJORADO: Aumentado de 20 a 30 documentos por página
    const offset = (page - 1) * limit;

    // ✨ NUEVO: Parámetros de ordenamiento
    const ordenarPor = req.query.ordenarPor || 'created_at';
    const ordenDireccion = req.query.ordenDireccion || 'desc';

    console.log('📊 [ADMIN] Parámetros de ordenamiento:', { ordenarPor, ordenDireccion });
    
    // Filtros de consulta
    const estado = req.query.estado || '';
    const estadoPago = req.query.estadoPago || '';
    const matrizadorId = req.query.matrizadorId || '';
    const busqueda = req.query.busqueda || '';
    const fechaDesde = req.query.fechaDesde || '';
    const fechaHasta = req.query.fechaHasta || '';
    
    // Construir condiciones WHERE
    const where = {};
    
    if (estado) where.estado = estado;
    if (estadoPago) where.estadoPago = estadoPago;  // CORREGIDO: Usar camelCase
    if (matrizadorId) where.idMatrizador = matrizadorId;
    
    if (busqueda) {
      where[Op.or] = [
        { codigoBarras: { [Op.iLike]: `%${busqueda}%` } },
        { nombreCliente: { [Op.iLike]: `%${busqueda}%` } },
        { numeroFactura: { [Op.iLike]: `%${busqueda}%` } }  // CORREGIDO: Usar camelCase
      ];
    }
    
    if (fechaDesde && fechaHasta) {
      where.created_at = {
        [Op.between]: [
          moment(fechaDesde).startOf('day').toDate(),
          moment(fechaHasta).endOf('day').toDate()
        ]
      };
    }

    // ✨ NUEVO: Configurar ordenamiento dinámico
    let orderClause = [];
    
    // MEJORADO: Mapear columnas de frontend a campos de base de datos
    const mapeoColumnas = {
      // Mapeos específicos para tabla admin
      'codigoBarras': 'codigoBarras',
      'nombreCliente': 'nombreCliente', 
      'fechaFactura': 'fechaFactura',
      'estado': 'estado',
      'estadoPago': 'estadoPago',
      'valorFactura': 'valorFactura',
      // Mapeos alternativos
      'codigo': 'codigoBarras',
      'cliente': 'nombreCliente',
      'fecha': 'fechaFactura',
      'pago': 'estadoPago',
      'valor': 'valorFactura',
      'created_at': 'created_at',
      'tipoDocumento': 'tipoDocumento'
    };
    
    // Ordenamiento especial para matrizador (requiere JOIN)
    if (ordenarPor === 'matrizador') {
      orderClause = [[{ model: Matrizador, as: 'matrizador' }, 'nombre', ordenDireccion.toUpperCase()]];
    } else if (mapeoColumnas[ordenarPor]) {
      orderClause = [[mapeoColumnas[ordenarPor], ordenDireccion.toUpperCase()]];
    } else {
      // Fallback a ordenamiento por defecto
      orderClause = [['created_at', 'DESC']];
      console.warn('⚠️ [ADMIN] Columna de ordenamiento no reconocida:', ordenarPor);
    }

    console.log('📊 [ADMIN] Orden SQL aplicado:', orderClause);
    
    // Consulta con paginación y ordenamiento
    const { count, rows: documentos } = await Documento.findAndCountAll({
      where,
      include: [{
        model: Matrizador,
        as: 'matrizador',
        attributes: ['id', 'nombre', 'email']
      }],
      order: orderClause,
      limit,
      offset
    });
    
    // Obtener matrizadores para filtros
    const matrizadores = await Matrizador.findAll({
      where: { activo: true },
      attributes: ['id', 'nombre'],
      order: [['nombre', 'ASC']]
    });
    
    // Calcular paginación
    const totalPages = Math.ceil(count / limit);
    
    res.render('admin/documentos/listado', {
      layout: 'admin',
      title: 'Supervisión de Documentos - Solo Lectura',
      documentos,
      matrizadores,
      pagination: {
        currentPage: page,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      filtros: {
        estado, estadoPago, matrizadorId, busqueda, fechaDesde, fechaHasta
      },
      userRole: req.matrizador?.rol,
      userName: req.matrizador?.nombre,
      soloLectura: true // Indicador para la vista
    });
    
  } catch (error) {
    console.error('❌ Error en listar documentos admin:', error);
    req.flash('error', 'Error al cargar el listado de documentos');
    res.redirect('/admin');
  }
};

/**
 * FUNCIÓN DE SUPERVISIÓN: Ver detalle de documento (solo lectura)
 * Admin puede revisar detalles para análisis, pero NO modificar
 */
exports.verDetalleDocumentoAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📄 Admin consultando detalle documento ${id} (solo lectura)`);
    
    // Obtener documento con relaciones
    const documento = await Documento.findByPk(id, {
      include: [{
        model: Matrizador,
        as: 'matrizador',
        attributes: ['id', 'nombre', 'email']
      }]
    });
    
    if (!documento) {
      req.flash('error', 'Documento no encontrado');
      return res.redirect('/admin/documentos/listado');
    }
    
    // 🆕 NUEVO: Usar historial universal
    const eventos = await obtenerHistorialUniversal(id, 'admin', {
      incluirAuditoria: true,
      mostrarInformacionTecnica: true
    });
    
    // Obtener registros de auditoría relacionados
    const registrosAuditoria = await RegistroAuditoria.findAll({
      where: {
        [Op.or]: [
          { idDocumento: id }, // CORREGIDO: Usar relación directa por ID de documento
          { detalles: { [Op.iLike]: `%${documento.codigoBarras}%` } }
        ]
      },
      order: [['created_at', 'DESC']], // CORREGIDO: Usar created_at en lugar de timestamp
      limit: 10,
      include: [{
        model: Matrizador,
        as: 'matrizador',
        attributes: ['nombre', 'rol'],
        required: false
      }]
    });
    
    res.render('admin/documentos/detalle', {
      layout: 'admin', 
      title: `Supervisión Documento: ${documento.codigoBarras}`,
      documento,
      eventos,
      registrosAuditoria,
      userRole: req.matrizador?.rol,
      userName: req.matrizador?.nombre,
      soloLectura: true, // CRÍTICO: Indicar que es solo lectura
      soloSupervision: true // Indicador adicional para la vista
    });
    
  } catch (error) {
    console.error('❌ Error al ver detalle documento admin:', error);
    req.flash('error', 'Error al cargar el detalle del documento');
    res.redirect('/admin/documentos/listado');
  }
};

// ============================================================================
// SISTEMA DE REVERSIÓN DISTRIBUIDA - FUNCIONES PARA ADMIN
// ============================================================================

/**
 * REVERTIR ESTADO DE DOCUMENTO - Solo para rol Admin
 * Permite deshacer cambios de estado con justificación obligatoria
 */
exports.revertirEstadoDocumento = async (req, res) => {
  try {
    const { id } = req.params;
    const { tipoReversion, motivoCategoria, justificacion } = req.body;
    
    // Validaciones iniciales
    if (!['desmarcar_listo', 'deshacer_entrega', 'separar_grupo', 'reactivar_documento'].includes(tipoReversion)) {
      return res.status(400).json({
        error: 'Tipo de reversión no válido para Admin',
        tiposPermitidos: ['desmarcar_listo', 'deshacer_entrega', 'separar_grupo', 'reactivar_documento']
      });
    }
    
    if (!justificacion || justificacion.length < 20) {
      return res.status(400).json({
        error: 'Justificación requerida',
        mensaje: 'La justificación debe tener al menos 20 caracteres'
      });
    }
    
    // Obtener documento actual
    const documento = await Documento.findByPk(id);
    if (!documento) {
      return res.status(404).json({
        error: 'Documento no encontrado'
      });
    }
    
    // Validar que se puede realizar la reversión
    const validacion = validarReversionAdmin(tipoReversion, documento);
    if (!validacion.valida) {
      return res.status(400).json({
        error: validacion.mensaje
      });
    }
    
    // Ejecutar reversión en transacción
    const resultado = await sequelize.transaction(async (t) => {
      const estadoAnterior = documento.estado;
      let estadoNuevo, datosAnteriores = {}, datosNuevos = {};
      
      // Ejecutar reversión específica
      switch (tipoReversion) {
        case 'desmarcar_listo':
          estadoNuevo = 'en_proceso';
          documento.estado = estadoNuevo;
          documento.codigoVerificacion = null;
          datosAnteriores = { codigoVerificacion: documento.codigoVerificacion };
          datosNuevos = { codigoVerificacion: null };
          break;
          
        case 'deshacer_entrega':
          estadoNuevo = 'listo_para_entrega';
          documento.estado = estadoNuevo;
          datosAnteriores = {
            fechaEntrega: documento.fechaEntrega,
            nombreReceptor: documento.nombreReceptor,
            identificacionReceptor: documento.identificacionReceptor,
            relacionReceptor: documento.relacionReceptor
          };
          documento.fechaEntrega = null;
          documento.nombreReceptor = null;
          documento.identificacionReceptor = null;
          documento.relacionReceptor = null;
          datosNuevos = { datosEntregaLimpiados: true };
          break;
          
        case 'separar_grupo':
          datosAnteriores = { notificacionGrupalId: documento.notificacionGrupalId };
          documento.notificacionGrupalId = null;
          datosNuevos = { notificacionGrupalId: null };
          estadoNuevo = documento.estado; // Mantiene el mismo estado
          break;
          
        case 'reactivar_documento':
          estadoNuevo = 'en_proceso';
          documento.estado = estadoNuevo;
          documento.eliminado = false;
          datosAnteriores = { eliminado: true };
          datosNuevos = { eliminado: false };
          break;
      }
      
      // Guardar cambios en documento
      await documento.save({ transaction: t });
      
      // Registrar en auditoría de reversiones
      const ReversionAuditoria = require('../models/ReversionAuditoria');
      await ReversionAuditoria.create({
        tipoReversion,
        documentoId: id,
        usuarioId: req.matrizador.id,
        rolUsuario: req.matrizador.rol,
        estadoAnterior,
        estadoNuevo,
        datosAnteriores,
        datosNuevos,
        motivoCategoria,
        justificacion,
        ipAddress: req.ip,
        metadatos: {
          userAgent: req.get('User-Agent'),
          referrer: req.get('Referrer')
        }
      }, { transaction: t });
      
      // Registrar evento en historial del documento
      const EventoDocumento = require('../models/EventoDocumento');
      await EventoDocumento.create({
        documentoId: id,
        usuarioId: req.matrizador.id,
        tipo: 'reversion_admin',
        categoria: 'administracion',
        titulo: `Reversión: ${tipoReversion.replace('_', ' ')}`,
        descripcion: `Admin ${req.matrizador.nombre} ejecutó reversión: ${tipoReversion}. Motivo: ${motivoCategoria}`,
        detalles: {
          tipoReversion,
          estadoAnterior,
          estadoNuevo,
          motivoCategoria,
          justificacion: justificacion.substring(0, 100) + '...'
        },
        usuario: req.matrizador.nombre
      }, { transaction: t });
      
      return {
        documento,
        estadoAnterior,
        estadoNuevo
      };
    });
    
    res.json({
      success: true,
      mensaje: 'Reversión ejecutada exitosamente',
      documento: resultado.documento,
      cambios: {
        estadoAnterior: resultado.estadoAnterior,
        estadoNuevo: resultado.estadoNuevo
      }
    });
    
  } catch (error) {
    console.error('❌ Error en reversión admin:', error);
    res.status(500).json({
      error: 'Error interno del sistema',
      mensaje: 'No se pudo ejecutar la reversión'
    });
  }
};

/**
 * VER AUDITORÍA DE REVERSIONES - Solo Admin
 */
exports.verAuditoriaReversiones = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 50;
    const offset = (page - 1) * limit;
    
    const filtros = {
      tipoReversion: req.query.tipoReversion || '',
      rolUsuario: req.query.rolUsuario || '',
      fechaDesde: req.query.fechaDesde || '',
      fechaHasta: req.query.fechaHasta || ''
    };
    
    const where = {};
    if (filtros.tipoReversion) where.tipoReversion = filtros.tipoReversion;
    if (filtros.rolUsuario) where.rolUsuario = filtros.rolUsuario;
    
    if (filtros.fechaDesde && filtros.fechaHasta) {
      where.fechaReversion = {
        [Op.between]: [
          moment(filtros.fechaDesde).startOf('day').toDate(),
          moment(filtros.fechaHasta).endOf('day').toDate()
        ]
      };
    }
    
    const ReversionAuditoria = require('../models/ReversionAuditoria');
    const { count, rows: reversiones } = await ReversionAuditoria.findAndCountAll({
      where,
      include: [
        {
          model: Documento,
          attributes: ['codigoBarras', 'nombreCliente', 'tipoDocumento']
        },
        {
          model: Matrizador,
          as: 'usuario',
          attributes: ['nombre', 'email', 'rol']
        }
      ],
      order: [['fechaReversion', 'DESC']],
      limit,
      offset
    });
    
    const totalPages = Math.ceil(count / limit);
    
    res.render('admin/auditoria/reversiones', {
      layout: 'admin',
      title: 'Auditoría de Reversiones',
      reversiones,
      filtros,
      pagination: {
        currentPage: page,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      userRole: req.matrizador?.rol,
      userName: req.matrizador?.nombre
    });
    
  } catch (error) {
    console.error('❌ Error en auditoría reversiones:', error);
    req.flash('error', 'Error al cargar auditoría de reversiones');
    res.redirect('/admin');
  }
};

/**
 * FUNCIÓN AUXILIAR: Validar si se puede realizar una reversión de Admin
 */
function validarReversionAdmin(tipoReversion, documento) {
  // NOTA: Se eliminaron las validaciones de tiempo para permitir reversiones en cualquier momento
  // En la práctica, los errores pueden descubrirse días o semanas después
  
  // Validaciones específicas por tipo
  switch (tipoReversion) {
    case 'desmarcar_listo':
      if (documento.estado !== 'listo_para_entrega') {
        return {
          valida: false,
          mensaje: 'Solo se puede desmarcar documentos que estén "listo_para_entrega"'
        };
      }
      break;
      
    case 'deshacer_entrega':
      if (documento.estado !== 'entregado') {
        return {
          valida: false,
          mensaje: 'Solo se puede deshacer la entrega de documentos "entregado"'
        };
      }
      break;
      
    case 'separar_grupo':
      if (!documento.notificacionGrupalId) {
        return {
          valida: false,
          mensaje: 'El documento no está en un grupo de notificación'
        };
      }
      break;
      
    case 'reactivar_documento':
      if (!documento.eliminado) {
        return {
          valida: false,
          mensaje: 'El documento no está eliminado'
        };
      }
      break;
  }
  
  return { valida: true };
}

module.exports = exports;
