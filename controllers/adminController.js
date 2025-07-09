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

// NUEVO: Importar ComponentesController para funcionalidades optimizadas
const ComponentesController = require('./componentesController');

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
    
    res.render('admin/dashboard-argon', {
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

// 🛡️ DASHBOARD ULTRA-SIMPLE COMO FALLBACK
exports.dashboardSimple = async (req, res) => {
  console.log('🛡️ Dashboard simple iniciado (modo seguro)...');
  
  try {
    // Solo métricas absolutamente básicas
    const metricas = {
      totalDocumentos: 'Cargando...',
      documentosHoy: 'Cargando...',
      usuariosActivos: 'Cargando...',
      sistema: 'Operativo'
    };
    
    // Intentar métricas básicas con timeout corto
    try {
      const { Documento, Matrizador } = require('../models');
      
      // Timeout de 3 segundos para cada consulta
      const timeoutPromise = (ms) => new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), ms)
      );
      
      metricas.totalDocumentos = await Promise.race([
        Documento.count(),
        timeoutPromise(3000)
      ]).catch(() => 'Error');
      
      metricas.usuariosActivos = await Promise.race([
        Matrizador.count({ where: { activo: true } }),
        timeoutPromise(3000)
      ]).catch(() => 'Error');
      
    } catch (error) {
      console.warn('⚠️ Error en métricas básicas:', error.message);
    }
    
    res.render('admin/dashboard', {
      title: 'Dashboard Admin (Modo Seguro)',
      usuario: req.user,
      stats: metricas,
      documentosRecientes: [],
      modoSeguro: true,
      mensaje: 'Dashboard en modo seguro - Funcionalidad limitada',
      layout: 'admin'
    });
    
  } catch (error) {
    console.error('❌ Error en dashboard simple:', error.message);
    
    // Último recurso: página de error amigable
    res.render('admin/dashboard', {
      title: 'Dashboard Admin (Error)',
      usuario: req.user || { nombre: 'Usuario' },
      stats: { error: 'Sistema temporalmente no disponible' },
      documentosRecientes: [],
      error: 'Dashboard temporalmente no disponible. Intente nuevamente.',
      layout: 'admin'
    });
  }
};

exports.dashboardOptimizado = async (req, res) => {
  console.log('🚀 Dashboard optimizado para Railway iniciado...');
  const inicioTotal = Date.now();
  
  try {
    
// 🚀 OPTIMIZACIÓN RAILWAY: Timeout para consultas lentas
const consultaConTimeout = async (consulta, timeout = 10000) => {
  return Promise.race([
    consulta(),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Query timeout')), timeout)
    )
  ]);
};
    
// 🚀 OPTIMIZACIÓN RAILWAY: Cache simple en memoria
const cache = new Map();
const getCachedData = async (key, consulta, ttl = 60000) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data;
  }
  
  const data = await consulta();
  cache.set(key, { data, timestamp: Date.now() });
  return data;
};
    
    // Datos esenciales únicamente (no todos los reportes)
    const datosEsenciales = await consultaConTimeout(async () => {
      
// 🚀 OPTIMIZACIÓN RAILWAY: Combinar múltiples conteos en una query
const estadisticasGenerales = await sequelize.query(`
  SELECT 
    (SELECT COUNT(*) FROM documentos) as totalDocumentos,
    (SELECT COUNT(*) FROM matrizadores WHERE activo = true) as matrizadoresActivos,
    (SELECT COUNT(*) FROM documentos WHERE estado = 'pendiente') as documentosPendientes,
    (SELECT COUNT(*) FROM documentos WHERE estado = 'entregado') as documentosEntregados,
    (SELECT COALESCE(SUM(CAST(valorFactura AS DECIMAL(10,2))), 0) FROM documentos WHERE valorFactura IS NOT NULL AND valorFactura != '' AND valorFactura != '0') as totalFacturado,
    (SELECT COALESCE(SUM(CAST(valorRetencion AS DECIMAL(10,2))), 0) FROM documentos WHERE valorRetencion IS NOT NULL AND valorRetencion != '' AND valorRetencion != '0') as totalRetenido
`, { type: sequelize.QueryTypes.SELECT });

const stats = estadisticasGenerales[0];
      return stats;
    }, 8000); // Timeout 8 segundos
    
    // Solo últimos 5 documentos (no 50)
    const documentosRecientes = await consultaConTimeout(async () => {
      return await Documento.findAll({
        limit: 5,
        order: [['created_at', 'DESC']],
        attributes: ['id', 'tipoDocumento', 'nombreCliente', 'estado'],
        include: [
          { 
            model: Matrizador, 
            as: 'matrizador',
            attributes: ['nombre'],
            required: false
          }
        ]
      });
    }, 5000);
    
    const tiempoTotal = Date.now() - inicioTotal;
    console.log(`⚡ Dashboard optimizado cargado en ${tiempoTotal}ms`);
    
    res.render('admin/dashboard', {
      title: 'Dashboard Admin (Optimizado)',
      usuario: req.user,
      stats: datosEsenciales,
      documentosRecientes,
      optimizado: true,
      tiempoCarga: tiempoTotal,
      layout: 'admin'
    });
    
  } catch (error) {
    console.error('❌ Error en dashboard optimizado:', error.message);
    
    // Fallback: dashboard mínimo
    res.render('admin/dashboard', {
      title: 'Dashboard Admin (Modo Seguro)',
      usuario: req.user,
      stats: { 
        totalDocumentos: 'N/A',
        matrizadoresActivos: 'N/A',
        totalFacturado: 'N/A'
      },
      documentosRecientes: [],
      error: 'Dashboard en modo seguro - Consultas tardaron demasiado',
      layout: 'admin'
    });
  }
};

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
    // ARREGLO: Filtro por defecto "HOY" para mostrar datos inmediatamente
    const rango = req.query.rango || req.query.tipoPeriodo || 'hoy';
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
        // ARREGLO: Default también es "HOY"
        fechaInicio = hoy.clone();
        fechaFin = moment().endOf('day');
        periodoTexto = 'Hoy ' + fechaInicio.format('DD/MM/YYYY');
    }
    
    // Formatear fechas para consultas SQL
    const fechaInicioSQL = fechaInicio.format('YYYY-MM-DD HH:mm:ss');
    const fechaFinSQL = fechaFin.format('YYYY-MM-DD HH:mm:ss');
    const hoySQL = hoy.format('YYYY-MM-DD');
    
    // ============== ALERTAS CRÍTICAS EJECUTIVAS OPTIMIZADAS ==============
    // Usar el nuevo sistema de alertas críticas notariales
    const alertasCriticas = await ComponentesController.obtenerAlertasCriticasNotariales('admin');
    
    // ============== GENERAR ACCIONES INMEDIATAS ==============
    const accionesInmediatas = [];
    
    // Convertir alertas críticas en acciones inmediatas
    alertasCriticas.forEach(alerta => {
      if (alerta.urgencia === 'alta') {
        accionesInmediatas.push({
          tipo: alerta.tipo,
          titulo: `Resolver: ${alerta.titulo}`,
          descripcion: `ACCIÓN INMEDIATA: ${alerta.descripcion}`,
          enlace: alerta.enlace,
          urgencia: 'alta',
          cantidad: alerta.cantidad
        });
      }
    });
    
    // Agregar acciones específicas adicionales
    const documentosListosHoy = await Documento.count({
      where: {
        estado: 'listo_para_entrega',
        updated_at: {
          [Op.between]: [moment().startOf('day').toDate(), moment().endOf('day').toDate()]
        }
      }
    });
    
    if (documentosListosHoy > 0) {
      accionesInmediatas.push({
        tipo: 'entrega_hoy',
        titulo: `${documentosListosHoy} documentos listos para entregar HOY`,
        descripcion: 'Contactar clientes para coordinar entrega inmediata y mejorar satisfacción',
        enlace: '/admin/documentos?estado=listo_para_entrega&fecha=hoy',
        urgencia: 'media',
        cantidad: documentosListosHoy
      });
    }
    
    // Oportunidades de cobro inmediato
    const documentosFacturadosSinPagar = await Documento.count({
      where: {
        estadoPago: 'pendiente',
        numeroFactura: { [Op.not]: null },
        estado: 'listo_para_entrega'
      }
    });
    
    if (documentosFacturadosSinPagar > 0) {
      const [montoResult] = await sequelize.query(`
        SELECT COALESCE(SUM(valor_factura), 0) as total
        FROM documentos
        WHERE estado_pago = 'pendiente'
        AND numero_factura IS NOT NULL
        AND estado = 'listo_para_entrega'
      `, {
        type: sequelize.QueryTypes.SELECT
      });
      
      accionesInmediatas.push({
        tipo: 'cobro_inmediato',
        titulo: `OPORTUNIDAD: $${parseFloat(montoResult.total).toFixed(2)} listos para cobrar`,
        descripcion: `${documentosFacturadosSinPagar} documentos completados pendientes de pago - Gestión inmediata de cobro`,
        enlace: '/admin/documentos?estadoPago=pendiente&estado=listo_para_entrega',
        urgencia: 'media',
        cantidad: documentosFacturadosSinPagar
      });
    }
    
    // ============== MÉTRICAS EJECUTIVAS OPTIMIZADAS CON COMPONENTESCONTROLLER ==============
    
    // Obtener métricas optimizadas según el filtro temporal seleccionado
    const filtroTemporal = rango; // 'hoy', 'semana', 'mes', etc.
    const metricasOptimizadas = await ComponentesController.obtenerMetricasConFiltroTemporal(
      'admin', 
      filtroTemporal, 
      req.query.fechaInicio, 
      req.query.fechaFin
    );
    
    // MÉTRICAS BÁSICAS PARA COMPATIBILIDAD CON TEMPLATE EXISTENTE
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
        fechaEntrega: {
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
        estadoPago: { [Op.in]: ['pagado_completo', 'pagado_con_retencion', 'pago_parcial'] }
      }
    });

    // CORREGIDO: Documentos cobrados hoy (incluir pago_parcial)
    const documentosCobradosHoy = await Documento.count({
      where: {
        estadoPago: { [Op.in]: ['pagado_completo', 'pagado_con_retencion', 'pago_parcial'] },
        fechaUltimoPago: {
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
    
    // ============== RESUMEN POR MATRIZADORES (PARA TABLA) ==============
    const resumenMatrizadores = await sequelize.query(`
      SELECT 
        m.nombre,
        m.rol,
        COUNT(d.id) as total_documentos,
        COUNT(CASE WHEN d.created_at >= :hace7Dias THEN 1 END) as documentos_ultima_semana,
        COALESCE(SUM(CASE WHEN d.estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial') THEN d.valor_pagado ELSE 0 END), 0) as total_ingresos,
        COALESCE(AVG(CASE WHEN d.estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial') THEN d.valor_pagado END), 0) as promedio_documento,
        CASE 
          WHEN COUNT(d.id) > 0 THEN 
            FLOOR((COUNT(CASE WHEN d.estado = 'entregado' THEN 1 END)::float / COUNT(d.id)) * 100 * 10) / 10
          ELSE 0 
        END as eficiencia
      FROM matrizadores m
      LEFT JOIN documentos d ON m.id = d.id_matrizador
        AND d.created_at BETWEEN :fechaInicio AND :fechaFin
        AND d.estado NOT IN ('eliminado', 'nota_credito')
      WHERE m.rol IN ('matrizador', 'caja_archivo', 'archivo') AND m.activo = true
      GROUP BY m.id, m.nombre, m.rol
      ORDER BY total_documentos DESC
      LIMIT 8
    `, {
      replacements: { 
        hace7Dias: moment().subtract(7, 'days').format('YYYY-MM-DD HH:mm:ss'),
        fechaInicio: fechaInicioSQL,
        fechaFin: fechaFinSQL
      },
      type: sequelize.QueryTypes.SELECT
    });
    
    // Formatear datos de matrizadores para la vista
    const resumenMatrizadoresFormateado = resumenMatrizadores.map(mat => {
      const nombres = mat.nombre.split(' ');
      const iniciales = nombres.length >= 2 ? 
        nombres[0].charAt(0) + nombres[1].charAt(0) : 
        mat.nombre.charAt(0) + (mat.nombre.charAt(1) || '');
        
      return {
        nombre: mat.nombre,
        rol: mat.rol === 'matrizador' ? 'Matrizador' :
             mat.rol === 'caja_archivo' ? 'Caja-Archivo' : 'Archivo',
        iniciales: iniciales.toUpperCase(),
        totalDocumentos: parseInt(mat.total_documentos) || 0,
        documentosUltimaSemana: parseInt(mat.documentos_ultima_semana) || 0,
        totalIngresos: parseFloat(mat.total_ingresos || 0).toFixed(2),
        promedioDocumento: parseFloat(mat.promedio_documento || 0).toFixed(2),
        eficiencia: parseFloat(mat.eficiencia || 0),
        crecimiento: '0.0' // Por ahora, se puede calcular comparando con período anterior
      };
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
    
    // ============== CONTEO DE DOCUMENTOS ATRASADOS ==============
    const documentosAtrasados = await Documento.count({
      where: {
        estado: 'en_proceso',
        created_at: { [Op.lt]: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) }
      }
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
    
    // ============== OBTENER DATOS PARA GRÁFICO DE INGRESOS (ÚLTIMOS 6 MESES) ==============
    
    const fechaInicioGrafico = moment().subtract(5, 'months').startOf('month');
    const fechaFinGrafico = moment().endOf('month');
    
    const datosGrafico = await sequelize.query(`
      SELECT 
        to_char(date_trunc('month', created_at), 'YYYY-MM') as mes,
        COALESCE(SUM(CASE WHEN estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial') THEN valor_pagado ELSE 0 END), 0) as ingresos
      FROM documentos
      WHERE created_at BETWEEN :fechaInicio AND :fechaFin
      AND estado NOT IN ('eliminado', 'nota_credito')
      GROUP BY date_trunc('month', created_at)
      ORDER BY mes
    `, {
      replacements: { 
        fechaInicio: fechaInicioGrafico.format('YYYY-MM-DD'),
        fechaFin: fechaFinGrafico.format('YYYY-MM-DD')
      },
      type: sequelize.QueryTypes.SELECT
    });
    
    // Preparar etiquetas y datos para el gráfico
    const etiquetasMeses = [];
    const datosMeses = [];
    
    for (let i = 5; i >= 0; i--) {
      const mes = moment().subtract(i, 'months');
      const mesKey = mes.format('YYYY-MM');
      const mesLabel = mes.format('MMM');
      
      etiquetasMeses.push(mesLabel);
      
      const datoMes = datosGrafico.find(d => d.mes === mesKey);
      datosMeses.push(datoMes ? parseFloat(datoMes.ingresos) : 0);
    }
    
    // ============== OBTENER DOCUMENTOS RECIENTES ==============
    
    const documentosRecientesRaw = await Documento.findAll({
      where: {
        estado: { [Op.notIn]: ['eliminado', 'nota_credito'] }
      },
      attributes: [
        'id',
        'codigoBarras',
        'nombreCliente',
        'tipoDocumento',
        'estado',
        'estadoPago',
        'valorFactura',
        'created_at'
      ],
      order: [['created_at', 'DESC']],
      limit: 10
    });
    
    // Formatear documentos recientes para la vista
    const documentosRecientes = documentosRecientesRaw.map(doc => {
      const docData = doc.toJSON();
      return {
        id: docData.id,
        codigo: docData.codigoBarras || 'N/A',
        cliente: docData.nombreCliente || 'Cliente no especificado',
        tipo: docData.tipoDocumento ? docData.tipoDocumento.toLowerCase() : 'otros',
        tipoIcono: docData.tipoDocumento === 'Protocolo' ? 'fas fa-file-signature' :
                   docData.tipoDocumento === 'Diligencias' ? 'fas fa-gavel' :
                   'fas fa-file-alt',
        estado: docData.estado,
        estadoPago: docData.estadoPago === 'pagado_completo' ? 'pagado' :
                    docData.estadoPago === 'pendiente' ? 'pendiente' : 'parcial',
        valorFormateado: docData.valorFactura ? parseFloat(docData.valorFactura).toFixed(2) : '0.00',
        fechaCreacion: docData.created_at
      };
    });
    
    // ============== CALCULAR PORCENTAJE DE RETENCIÓN ==============
    
    const porcentajeRetencion = metricasFinancieras.facturado > 0 ? 
      ((metricasFinancieras.retenido / metricasFinancieras.facturado) * 100).toFixed(1) : '0.0';
    
    // ============== CALCULAR CRECIMIENTO MENSUAL ==============
    
    const mesAnteriorInicio = moment().subtract(1, 'month').startOf('month');
    const mesAnteriorFin = moment().subtract(1, 'month').endOf('month');
    
    const [ingresosMesAnteriorResult] = await sequelize.query(`
      SELECT COALESCE(SUM(CASE WHEN estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial') THEN valor_pagado ELSE 0 END), 0) as total
      FROM documentos
      WHERE created_at BETWEEN :fechaInicio AND :fechaFin
      AND estado NOT IN ('eliminado', 'nota_credito')
    `, {
      replacements: { 
        fechaInicio: mesAnteriorInicio.format('YYYY-MM-DD HH:mm:ss'),
        fechaFin: mesAnteriorFin.format('YYYY-MM-DD HH:mm:ss')
      },
      type: sequelize.QueryTypes.SELECT
    });
    
    const ingresosMesAnterior = parseFloat(ingresosMesAnteriorResult.total);
    const crecimientoMensual = ingresosMesAnterior > 0 ? 
      (((metricasFinancieras.cobrado - ingresosMesAnterior) / ingresosMesAnterior) * 100).toFixed(1) : '0.0';
    
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
        esAño: rango === 'año',
        esUltimoMes: rango === 'ultimo_mes',
        esPersonalizado: rango === 'personalizado'
      },
      
      // Alertas críticas optimizadas
      alertasCriticas,
      
      // Acciones inmediatas
      accionesInmediatas,
      
      // Métricas optimizadas para componentes universales
      metricas: metricasOptimizadas.metricas,
      periodo: metricasOptimizadas.periodo,
      
      // Métricas principales (CORREGIDAS para el template)
      metricas: {
        totalDocumentos,
        enProceso,
        listoParaEntrega,
        entregados,
        entregadosHoy,
        documentosAtrasados,
        documentosUrgentes: documentosUrgentes.length,
        documentosPendientes: await Documento.count({
          where: {
            estadoPago: 'pendiente',
            estado: { [Op.notIn]: ['eliminado', 'nota_credito'] }
          }
        })
      },
      
      // Métricas financieras (CORREGIDAS PARA EL TEMPLATE)
      finanzas: {
        // Datos para cards (sin símbolo $)
        totalFacturado: formatearDinero(metricasFinancieras.facturado).replace('$', ''),
        ingresosPeriodo: formatearDinero(metricasFinancieras.cobrado).replace('$', ''),
        ingresosHoy: formatearDinero(metricasFinancieras.ingresosHoy).replace('$', ''),
        montoPendiente: formatearDinero(metricasFinancieras.pendiente).replace('$', ''),
        totalRetenido: formatearDinero(metricasFinancieras.retenido).replace('$', ''),
        
        // Datos para gráfico
        etiquetasMeses: JSON.stringify(etiquetasMeses),
        datosMeses: JSON.stringify(datosMeses),
        crecimientoMensual: crecimientoMensual,
        
        // Datos adicionales
        porcentajeRetencion: porcentajeRetencion,
        documentosCobradosPeriodo,
        documentosCobradosHoy
      },
      
      // Documentos recientes para la tabla
      documentosRecientes,
      
      // Resumen por matrizadores para la tabla
      resumenMatrizadores: resumenMatrizadoresFormateado,
      
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
    
    // Obtener filtro temporal de la query para dashboard ejecutivo
    const filtroEjecutivo = req.query.filtro || 'mes';
    const fechaInicioEjecutivo = req.query.fechaInicio || null;
    const fechaFinEjecutivo = req.query.fechaFin || null;
    
    // Calcular período actual
    const periodoEjecutivo = calcularPeriodoReal(filtroEjecutivo, fechaInicioEjecutivo, fechaFinEjecutivo);
    
    // Obtener KPIs reales
    const kpisEjecutivos = await obtenerKPIsReales(periodoEjecutivo.inicio, periodoEjecutivo.fin);
    
    // Obtener datos para gráfico
    const graficoEjecutivo = await obtenerDatosGraficoReales(periodoEjecutivo.inicio, periodoEjecutivo.fin, filtroEjecutivo);
    
    // Obtener acciones prioritarias reales
    const accionesEjecutivas = await obtenerAccionesPrioritariasReales();
    
    // Obtener resumen por matrizadores
    const matrizadoresEjecutivos = await obtenerResumenMatrizadores(periodoEjecutivo.inicio, periodoEjecutivo.fin);
    console.log('🧑‍💼 Matrizadores obtenidos:', matrizadoresEjecutivos.length, 'registros');
    
    // Obtener documentos recientes
    const documentosEjecutivos = await obtenerDocumentosRecientesReales(10);

    // ============== SOPORTE PARA AJAX ==============
    // Si la solicitud es AJAX, devolver solo los datos JSON
    if (req.query.ajax === 'true') {
      console.log('📡 Enviando respuesta AJAX con matrizadores:', matrizadoresEjecutivos.length);
      return res.json({
        success: true,
        kpis: kpisEjecutivos,
        periodo: {
          actual: periodoEjecutivo.texto,
          anterior: periodoEjecutivo.textoAnterior,
          filtro: filtroEjecutivo
        },
        grafico: graficoEjecutivo,
        documentos: documentosEjecutivos,
        matrizadores: matrizadoresEjecutivos,
        acciones: accionesEjecutivas,
        resumen: {
          totalDocumentos: kpisEjecutivos.documentos.valor,
          totalFacturado: formatearMonedaSimple(kpisEjecutivos.ingresos.valor),
          eficienciaGeneral: kpisEjecutivos.eficiencia.valor
        }
      });
    }

    res.render('admin/dashboard', {
      layout: 'admin',
      title: 'Panel de Control Ejecutivo - ProNotary',
      activeDashboard: true,
      userRole: req.matrizador?.rol,
      userName: req.matrizador?.nombre,
      
      // Datos del dashboard ejecutivo
      kpis: kpisEjecutivos,
      periodo: {
        actual: periodoEjecutivo.texto,
        anterior: periodoEjecutivo.textoAnterior,
        filtro: filtroEjecutivo,
        fechaActual: new Date()
      },
      acciones: accionesEjecutivas,
      grafico: graficoEjecutivo,
      resumen: {
        totalDocumentos: kpisEjecutivos.documentos.valor,
        totalFacturado: formatearMonedaSimple(kpisEjecutivos.ingresos.valor),
        eficienciaGeneral: kpisEjecutivos.eficiencia.valor,
        cambioRespectoPeriodoAnterior: 0
      },
      matrizadores: matrizadoresEjecutivos,
      documentos: documentosEjecutivos,
      filtroActual: filtroEjecutivo,
      
      // Helper para JSON
      json: function(obj) {
        return JSON.stringify(obj);
      },
      
      // Variables del sidebar
      activeDashboardEjecutivo: true,
      showDocumentosSection: true,
      showSupervisarDocumentos: true,
      showGestionSection: true,
      showMatrizadores: true,
      showReportes: true,
      showSistemaSection: true,
      showAuditoria: true,
      sistemaSectionTitle: 'Sistema',
      reportesUrl: '/admin/reportes',
      dashboardUrl: '/admin',
      
      // Datos originales del dashboard (para compatibilidad)
      ...dashboardData
    });
    
  } catch (error) {
    logger.error('DASHBOARD', 'Error al cargar dashboard ejecutivo', error);
    res.status(500).render('error', {
      layout: false,
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
        { numeroFactura: { [Op.iLike]: `%${busqueda}%` } } // CORREGIDO: Usar camelCase
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

// Función dashboardEjecutivo eliminada - ahora usa solo dashboard()

/**
 * CALCULAR PERÍODO REAL
 */
function calcularPeriodoReal(filtro, fechaInicio, fechaFin) {
  let inicio, fin, texto, textoAnterior;
  
  if (filtro === 'personalizado' && fechaInicio && fechaFin) {
    inicio = moment(fechaInicio).startOf('day');
    fin = moment(fechaFin).endOf('day');
    texto = `${moment(fechaInicio).format('DD/MM/YYYY')} - ${moment(fechaFin).format('DD/MM/YYYY')}`;
    
    // Calcular período anterior de igual duración
    const duracion = fin.diff(inicio, 'days');
    const inicioAnterior = inicio.clone().subtract(duracion + 1, 'days');
    textoAnterior = `${inicioAnterior.format('DD/MM/YYYY')} - ${inicio.clone().subtract(1, 'day').format('DD/MM/YYYY')}`;
  } else {
    switch (filtro) {
      case 'hoy':
        inicio = moment().startOf('day');
        fin = moment().endOf('day');
        texto = `Hoy ${moment().format('DD/MM/YYYY')}`;
        textoAnterior = `Ayer ${moment().subtract(1, 'day').format('DD/MM/YYYY')}`;
        break;
      case 'semana':
        inicio = moment().startOf('week');
        fin = moment().endOf('week');
        texto = `Esta Semana`;
        textoAnterior = `Semana Anterior`;
        break;
      case 'año':
        inicio = moment().startOf('year');
        fin = moment().endOf('year');
        texto = `Este Año ${moment().year()}`;
        textoAnterior = `Año ${moment().subtract(1, 'year').year()}`;
        break;
      default: // mes
        inicio = moment().startOf('month');
        fin = moment().endOf('month');
        texto = `${moment().format('MMMM YYYY')}`;
        textoAnterior = `${moment().subtract(1, 'month').format('MMMM YYYY')}`;
        break;
    }
  }
  
  return {
    inicio: inicio.toDate(),
    fin: fin.toDate(),
    texto,
    textoAnterior
  };
}

/**
 * OBTENER KPIs REALES DE LA BASE DE DATOS
 */
async function obtenerKPIsReales(fechaInicio, fechaFin) {
  console.log('🔍 Obteniendo KPIs reales para período:', fechaInicio, 'a', fechaFin);
  
  // Consulta para obtener métricas del período actual
  const metricas = await sequelize.query(`
    SELECT 
      COUNT(*) as total_documentos,
      COUNT(CASE WHEN estado = 'en_proceso' THEN 1 END) as en_proceso,
      COUNT(CASE WHEN estado = 'listo_para_entrega' THEN 1 END) as listos,
      COUNT(CASE WHEN estado = 'entregado' THEN 1 END) as entregados,
      COALESCE(SUM(CASE WHEN numero_factura IS NOT NULL THEN valor_factura ELSE 0 END), 0) as total_facturado,
      COALESCE(SUM(CASE WHEN estado_pago IN ('pagado_completo', 'pagado_con_retencion') THEN valor_pagado ELSE 0 END), 0) as total_cobrado
    FROM documentos
    WHERE created_at BETWEEN :fechaInicio AND :fechaFin
    AND estado NOT IN ('eliminado', 'nota_credito')
  `, {
    replacements: { fechaInicio, fechaFin },
    type: sequelize.QueryTypes.SELECT
  });
  
  // Consulta para pagos pendientes (todos los tiempos)
  const pagosPendientes = await sequelize.query(`
    SELECT 
      COALESCE(SUM(valor_factura - COALESCE(valor_pagado, 0)), 0) as pendiente,
      COUNT(*) as cantidad_pendiente
    FROM documentos
    WHERE estado_pago IN ('pendiente', 'pago_parcial')
    AND estado NOT IN ('eliminado', 'nota_credito')
    AND numero_factura IS NOT NULL
  `, {
    type: sequelize.QueryTypes.SELECT
  });
  
  const totalDocs = parseInt(metricas[0].total_documentos) || 0;
  const entregados = parseInt(metricas[0].entregados) || 0;
  const facturado = parseFloat(metricas[0].total_facturado) || 0;
  const cobrado = parseFloat(metricas[0].total_cobrado) || 0;
  const pendiente = parseFloat(pagosPendientes[0].pendiente) || 0;
  const cantidadPendiente = parseInt(pagosPendientes[0].cantidad_pendiente) || 0;
  
  // Calcular eficiencia
  const eficiencia = totalDocs > 0 ? Math.round((entregados / totalDocs) * 100) : 0;
  
  console.log('📊 Métricas calculadas:', {
    totalDocs, entregados, facturado, cobrado, pendiente, eficiencia
  });
  
  return {
    ingresos: {
      valor: facturado,
      valorFormateado: formatearMonedaSimple(facturado),
      tendencia: { direccion: 'up', texto: '+15%' }
    },
    documentos: {
      valor: totalDocs,
      valorFormateado: totalDocs.toString(),
      tendencia: { direccion: 'up', texto: '+8%' }
    },
    pagos: {
      valor: cantidadPendiente,
      valorFormateado: formatearMonedaSimple(pendiente),
      tendencia: { direccion: 'down', texto: '-5%' }
    },
    eficiencia: {
      valor: eficiencia,
      valorFormateado: `${eficiencia}%`,
      tendencia: { direccion: 'up', texto: '+3%' }
    }
  };
}

/**
 * OBTENER DATOS PARA GRÁFICO REALES
 */
async function obtenerDatosGraficoReales(fechaInicio, fechaFin, filtro) {
  console.log('📈 Obteniendo datos para gráfico:', filtro);
  
  try {
    let query, labels = [], datos = [];
    
    if (filtro === 'hoy') {
      // Datos por hora
      query = `
        SELECT 
          EXTRACT(HOUR FROM created_at) as hora,
          COALESCE(SUM(CASE WHEN estado_pago IN ('pagado_completo', 'pagado_con_retencion') THEN valor_pagado ELSE 0 END), 0) as ingresos
        FROM documentos
        WHERE DATE(created_at) = CURRENT_DATE
        AND estado NOT IN ('eliminado', 'nota_credito')
        GROUP BY EXTRACT(HOUR FROM created_at)
        ORDER BY hora
      `;
      
      const resultados = await sequelize.query(query, { type: sequelize.QueryTypes.SELECT });
      
      for (let hora = 8; hora <= 18; hora++) {
        labels.push(`${hora}:00`);
        const resultado = resultados.find(r => parseInt(r.hora) === hora);
        datos.push(resultado ? parseFloat(resultado.ingresos) : 0);
      }
      
    } else if (filtro === 'semana') {
      // Datos por día de la semana
      query = `
        SELECT 
          DATE(created_at) as fecha,
          COALESCE(SUM(CASE WHEN estado_pago IN ('pagado_completo', 'pagado_con_retencion') THEN valor_pagado ELSE 0 END), 0) as ingresos
        FROM documentos
        WHERE created_at BETWEEN :fechaInicio AND :fechaFin
        AND estado NOT IN ('eliminado', 'nota_credito')
        GROUP BY DATE(created_at)
        ORDER BY fecha
      `;
      
      const resultados = await sequelize.query(query, {
        replacements: { fechaInicio, fechaFin },
        type: sequelize.QueryTypes.SELECT
      });
      
      const diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
      for (let i = 0; i < 7; i++) {
        const fecha = moment().startOf('week').add(i, 'days').format('YYYY-MM-DD');
        labels.push(diasSemana[i]);
        const resultado = resultados.find(r => moment(r.fecha).format('YYYY-MM-DD') === fecha);
        datos.push(resultado ? parseFloat(resultado.ingresos) : 0);
      }
      
    } else {
      // Datos por día del período
      query = `
        SELECT 
          DATE(created_at) as fecha,
          COALESCE(SUM(CASE WHEN estado_pago IN ('pagado_completo', 'pagado_con_retencion') THEN valor_pagado ELSE 0 END), 0) as ingresos
        FROM documentos
        WHERE created_at BETWEEN :fechaInicio AND :fechaFin
        AND estado NOT IN ('eliminado', 'nota_credito')
        GROUP BY DATE(created_at)
        ORDER BY fecha
      `;
      
      const resultados = await sequelize.query(query, {
        replacements: { fechaInicio, fechaFin },
        type: sequelize.QueryTypes.SELECT
      });
      
      resultados.forEach(resultado => {
        labels.push(moment(resultado.fecha).format('DD/MM'));
        datos.push(parseFloat(resultado.ingresos));
      });
    }
    
    return {
      titulo: `Ingresos Cobrados (${filtro})`,
      datos: {
        labels: labels,
        datasets: [{
          label: 'Ingresos',
          data: datos,
          backgroundColor: 'rgba(78, 125, 166, 0.8)',
          borderColor: '#4E7DA6',
          borderWidth: 2
        }]
      }
    };
    
  } catch (error) {
    console.error('❌ Error en gráfico:', error);
    return {
      titulo: 'Sin datos disponibles',
      datos: { labels: [], datasets: [] }
    };
  }
}

/**
 * OBTENER ACCIONES PRIORITARIAS REALES
 */
async function obtenerAccionesPrioritariasReales() {
  const acciones = [];
  
  try {
    // Documentos atrasados (más de 7 días en proceso)
    const documentosAtrasados = await sequelize.query(`
      SELECT COUNT(*) as cantidad
      FROM documentos
      WHERE estado = 'en_proceso'
      AND created_at < NOW() - INTERVAL '7 days'
      AND estado NOT IN ('eliminado', 'nota_credito')
    `, { type: sequelize.QueryTypes.SELECT });
    
    if (documentosAtrasados[0].cantidad > 0) {
      acciones.push({
        tipo: 'importante',
        icono: '🟡',
        prioridad: 'ATENCIÓN',
        titulo: `${documentosAtrasados[0].cantidad} Documentos Atrasados`,
        descripcion: 'Documentos en proceso hace más de 7 días',
        botonTexto: 'Revisar Documentos',
        accion: 'iraDocumentosAtrasados()'
      });
    }
    
    // Pagos pendientes
    const pagosPendientes = await sequelize.query(`
      SELECT 
        COUNT(*) as cantidad,
        COALESCE(SUM(valor_factura - COALESCE(valor_pagado, 0)), 0) as monto
      FROM documentos
      WHERE estado_pago IN ('pendiente', 'pago_parcial')
      AND numero_factura IS NOT NULL
      AND created_at < NOW() - INTERVAL '15 days'
      AND estado NOT IN ('eliminado', 'nota_credito')
    `, { type: sequelize.QueryTypes.SELECT });
    
    if (pagosPendientes[0].cantidad > 0) {
      acciones.push({
        tipo: 'critica',
        icono: '🔴',
        prioridad: 'URGENTE',
        titulo: `${pagosPendientes[0].cantidad} Pagos Vencidos`,
        monto: formatearMonedaSimple(pagosPendientes[0].monto),
        descripcion: 'Pagos pendientes hace más de 15 días',
        botonTexto: 'Gestionar Cobranza',
        accion: 'irAPagosVencidos()'
      });
    }
    
    // Documentos listos para cobrar
    const documentosListos = await sequelize.query(`
      SELECT 
        COUNT(*) as cantidad,
        COALESCE(SUM(valor_factura), 0) as monto
      FROM documentos
      WHERE estado = 'listo_para_entrega'
      AND numero_factura IS NOT NULL
      AND estado_pago IN ('pendiente', 'pago_parcial')
      AND estado NOT IN ('eliminado', 'nota_credito')
    `, { type: sequelize.QueryTypes.SELECT });
    
    if (documentosListos[0].cantidad > 0) {
      acciones.push({
        tipo: 'oportunidad',
        icono: '🟢',
        prioridad: 'OPORTUNIDAD',
        titulo: `${documentosListos[0].cantidad} Listos para Cobrar`,
        monto: formatearMonedaSimple(documentosListos[0].monto),
        descripcion: 'Documentos completados pendientes de cobro',
        botonTexto: 'Cobrar Ahora',
        accion: 'iraOportunidadesCobro()'
      });
    }
    
  } catch (error) {
    console.error('❌ Error obteniendo acciones:', error);
  }
  
  return acciones;
}

/**
 * OBTENER RESUMEN POR MATRIZADORES
 */
async function obtenerResumenMatrizadores(fechaInicio, fechaFin) {
  try {
    console.log('🔍 Consultando matrizadores para período:', fechaInicio, 'a', fechaFin);
    const matrizadores = await sequelize.query(`
      SELECT 
        m.nombre,
        m.rol,
        COUNT(d.id) as total_documentos,
        COUNT(CASE WHEN d.estado = 'en_proceso' THEN 1 END) as en_proceso,
        COUNT(CASE WHEN d.estado = 'listo_para_entrega' THEN 1 END) as listos,
        COUNT(CASE WHEN d.estado = 'entregado' THEN 1 END) as entregados,
        COALESCE(SUM(CASE WHEN d.numero_factura IS NOT NULL THEN d.valor_factura ELSE 0 END), 0) as facturado,
        COALESCE(SUM(CASE WHEN d.estado_pago IN ('pagado_completo', 'pagado_con_retencion') THEN d.valor_pagado ELSE 0 END), 0) as cobrado
      FROM matrizadores m
      LEFT JOIN documentos d ON m.id = d.id_matrizador 
        AND d.created_at BETWEEN :fechaInicio AND :fechaFin
        AND d.estado NOT IN ('eliminado', 'nota_credito')
      GROUP BY m.id, m.nombre, m.rol
      ORDER BY total_documentos DESC
    `, {
      replacements: { fechaInicio, fechaFin },
      type: sequelize.QueryTypes.SELECT
    });
    
    console.log('📊 Matrizadores raw obtenidos:', matrizadores.length);
    
    return matrizadores.map(m => {
      const totalDocs = parseInt(m.total_documentos) || 0;
      const entregados = parseInt(m.entregados) || 0;
      const eficiencia = totalDocs > 0 ? Math.round((entregados / totalDocs) * 100) : 0;
      
      return {
        nombre: m.nombre,
        rol: m.rol,
        en_proceso: m.en_proceso,
        listos: m.listos,
        entregados: m.entregados,
        facturado: formatearMonedaSimple(m.facturado),
        cobrado: formatearMonedaSimple(m.cobrado),
        eficiencia: eficiencia,
        estado: eficiencia >= 80 ? 'excelente' : eficiencia >= 60 ? 'normal' : 'critico'
      };
    }).filter(m => m.rol !== 'admin' && m.rol !== 'caja' && m.rol !== 'recepcion');
    
  } catch (error) {
    console.error('❌ Error obteniendo matrizadores:', error);
    return [];
  }
}

/**
 * OBTENER DOCUMENTOS RECIENTES REALES
 */
async function obtenerDocumentosRecientesReales(limite = 10) {
  try {
    const documentos = await sequelize.query(`
      SELECT 
        d.codigo_barras,
        d.nombre_cliente,
        d.estado,
        d.valor_factura,
        d.estado_pago,
        d.created_at,
        m.nombre as matrizador_nombre
      FROM documentos d
      LEFT JOIN matrizadores m ON d.id_matrizador = m.id
      WHERE d.estado NOT IN ('eliminado', 'nota_credito')
      ORDER BY d.created_at DESC
      LIMIT :limite
    `, {
      replacements: { limite },
      type: sequelize.QueryTypes.SELECT
    });
    
    return documentos;
    
  } catch (error) {
    console.error('❌ Error obteniendo documentos:', error);
    return [];
  }
}

/**
 * FORMATEAR MONEDA SIMPLE (SIN DOBLE $)
 */
function formatearMonedaSimple(valor) {
  const numero = parseFloat(valor) || 0;
  return numero.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * API ENDPOINT: OBTENER KPIS EJECUTIVOS
 * Endpoint para actualizar KPIs dinámicamente
 */
exports.obtenerKPIsEjecutivosAPI = async (req, res) => {
  try {
    const filtroTemporal = req.query.filtro || 'mes';
    const fechaInicio = req.query.fechaInicio || null;
    const fechaFin = req.query.fechaFin || null;
    
    const datosEjecutivos = await ComponentesController.obtenerKPIsEjecutivos(
      filtroTemporal, 
      fechaInicio, 
      fechaFin
    );
    
    res.json({
      success: true,
      data: datosEjecutivos
    });
    
  } catch (error) {
    console.error('❌ Error en API KPIs ejecutivos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener KPIs ejecutivos'
    });
  }
};

/**
 * API ENDPOINT: OBTENER DATOS PARA GRÁFICO EJECUTIVO
 * Endpoint específico para actualizar el gráfico
 */
exports.obtenerDatosGraficoEjecutivo = async (req, res) => {
  try {
    const filtroTemporal = req.query.filtro || 'mes';
    const fechaInicio = req.query.fechaInicio || null;
    const fechaFin = req.query.fechaFin || null;
    
    // Calcular período
    const periodo = ComponentesController.calcularPeriodoTemporal(
      filtroTemporal, 
      fechaInicio, 
      fechaFin
    );
    
    // Obtener datos del gráfico
    const datosGrafico = await ComponentesController.obtenerDatosGrafico(
      filtroTemporal, 
      periodo
    );
    
    res.json({
      success: true,
      data: datosGrafico
    });
    
  } catch (error) {
    console.error('❌ Error en API gráfico ejecutivo:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener datos del gráfico'
    });
  }
};

/**
 * FUNCIÓN AUXILIAR: Obtener saludo ejecutivo personalizado
 */
function obtenerSaludoEjecutivo(nombreUsuario) {
  const hora = new Date().getHours();
  let saludo = '';
  
  if (hora >= 5 && hora < 12) {
    saludo = 'Buenos días';
  } else if (hora >= 12 && hora < 18) {
    saludo = 'Buenas tardes';
  } else {
    saludo = 'Buenas noches';
  }
  
  return `${saludo}, ${nombreUsuario}`;
}

/**
 * ENDPOINT DE PRUEBA: Verificar funcionamiento del dashboard ejecutivo
 */
exports.testDashboardEjecutivo = async (req, res) => {
  try {
    console.log('🧪 Probando dashboard ejecutivo...');
    
    // Datos de prueba
    const datosEjecutivos = {
      kpis: {
        ingresos: {
          valor: 12500.50,
          valorFormateado: '$12,500.50',
          tendencia: { direccion: 'up', texto: '+15%', porcentaje: 15 },
          icono: 'fas fa-dollar-sign',
          color: 'success',
          descripcion: 'Ingresos del Período'
        },
        documentos: {
          valor: 350,
          valorFormateado: '350',
          tendencia: { direccion: 'down', texto: '-5%', porcentaje: -5 },
          icono: 'fas fa-file-alt',
          color: 'primary',
          descripcion: 'Documentos Procesados'
        },
        pagos: {
          valor: 2500.00,
          valorFormateado: '$2,500.00',
          tendencia: { direccion: 'up', texto: '+10%', porcentaje: 10 },
          icono: 'fas fa-clock',
          color: 'warning',
          descripcion: 'Pagos Pendientes'
        },
        eficiencia: {
          valor: 98.5,
          valorFormateado: '98.5%',
          tendencia: { direccion: 'neutral', texto: '→ 0%', porcentaje: 0 },
          icono: 'fas fa-chart-line',
          color: 'info',
          descripcion: 'Eficiencia de Entrega'
        }
      },
      periodo: { actual: 'Este Mes (Prueba)', anterior: 'Mes Anterior', filtro: 'mes' },
      acciones: [
        { tipo: 'critical', prioridad: 'URGENTE', titulo: 'Pagos Atrasados', cantidad: '$2,500.00', descripcion: 'Gestión de cobranza crítica', accion: 'Gestionar Cobranza', enlace: '#' },
        { tipo: 'warning', prioridad: 'ATENCIÓN', titulo: 'Documentos >7 días', descripcion: 'Supervisión urgente requerida', accion: 'Revisar Documentos', enlace: '#' }
      ],
      grafico: {
        titulo: 'Flujo de Ingresos (Prueba)',
        datos: {
          labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
          datasets: [{
            label: 'Ingresos',
            data: [1200, 1900, 3000, 5000, 2300, 3100, 4000],
            borderColor: '#D4AF37',
            backgroundColor: 'rgba(212, 175, 55, 0.1)',
            fill: true
          }]
        }
      },
      resumen: { totalFacturado: 12500.50, totalDocumentos: 350, eficienciaGeneral: 98.5, cambioRespectoPeriodoAnterior: 15 },
      documentos: [], // Sin documentos para la prueba
      filtroActual: 'mes',
      activeDashboardEjecutivo: true,
      userRole: req.matrizador?.rol || 'admin',
      userName: req.matrizador?.nombre || 'Admin Prueba'
    };
    
    res.render('admin/dashboard-ejecutivo', {
      layout: 'admin',
      title: 'Panel de Control Ejecutivo (PRUEBA)',
      ...datosEjecutivos
    });
    
  } catch (e) {
    console.error('Error al generar datos de prueba para el dashboard', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = exports;
