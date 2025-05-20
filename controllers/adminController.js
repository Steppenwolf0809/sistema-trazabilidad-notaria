/**
 * Controlador para la interfaz administrativa del sistema
 * Gestiona el dashboard y funciones centrales
 */

const Documento = require('../models/Documento');
const Matrizador = require('../models/Matrizador');
const EventoDocumento = require('../models/EventoDocumento');
const RegistroAuditoria = require('../models/RegistroAuditoria');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');

/**
 * Muestra el dashboard administrativo con estadísticas y documentos recientes
 */
exports.dashboard = async (req, res) => {
  try {
    // Procesar parámetros de período
    const tipoPeriodo = req.query.tipoPeriodo || 'hoy';
    let fechaInicio, fechaFin;
    const ahora = new Date();
    
    switch (tipoPeriodo) {
      case 'hoy':
        fechaInicio = new Date(ahora);
        fechaInicio.setHours(0, 0, 0, 0);
        fechaFin = new Date(ahora);
        fechaFin.setHours(23, 59, 59, 999);
        break;
      case 'semana':
        fechaInicio = new Date(ahora);
        fechaInicio.setDate(fechaInicio.getDate() - fechaInicio.getDay()); // Inicio de semana (domingo)
        fechaInicio.setHours(0, 0, 0, 0);
        fechaFin = new Date(ahora);
        fechaFin.setHours(23, 59, 59, 999);
        break;
      case 'mes':
        fechaInicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1); // Primer día del mes
        fechaInicio.setHours(0, 0, 0, 0);
        fechaFin = new Date(ahora);
        fechaFin.setHours(23, 59, 59, 999);
        break;
      case 'ultimo_mes':
        fechaInicio = new Date(ahora);
        fechaInicio.setMonth(fechaInicio.getMonth() - 1);
        fechaInicio.setHours(0, 0, 0, 0);
        fechaFin = new Date(ahora);
        fechaFin.setHours(23, 59, 59, 999);
        break;
      case 'personalizado':
        if (req.query.fechaInicio) {
          fechaInicio = new Date(req.query.fechaInicio);
          fechaInicio.setHours(0, 0, 0, 0);
        } else {
          fechaInicio = new Date(ahora);
          fechaInicio.setDate(fechaInicio.getDate() - 30); // Por defecto 30 días atrás
          fechaInicio.setHours(0, 0, 0, 0);
        }
        if (req.query.fechaFin) {
          fechaFin = new Date(req.query.fechaFin);
          fechaFin.setHours(23, 59, 59, 999);
        } else {
          fechaFin = new Date(ahora);
          fechaFin.setHours(23, 59, 59, 999);
        }
        break;
      default:
        fechaInicio = new Date(ahora);
        fechaInicio.setHours(0, 0, 0, 0);
        fechaFin = new Date(ahora);
        fechaFin.setHours(23, 59, 59, 999);
    }
    
    // Formatear fechas para el frontend
    const fechaInicioStr = fechaInicio.toISOString().split('T')[0];
    const fechaFinStr = fechaFin.toISOString().split('T')[0];
    
    // Preparar objeto de período para la vista
    const periodo = {
      tipoPeriodo,
      fechaInicio: fechaInicioStr,
      fechaFin: fechaFinStr,
      esHoy: tipoPeriodo === 'hoy',
      esSemana: tipoPeriodo === 'semana',
      esMes: tipoPeriodo === 'mes',
      esUltimoMes: tipoPeriodo === 'ultimo_mes',
      esPersonalizado: tipoPeriodo === 'personalizado'
    };
    
    // Obtener estadísticas de documentos totales (independiente del período)
    const total = await Documento.count();
    const enProceso = await Documento.count({ where: { estado: 'en_proceso' } });
    const listoParaEntrega = await Documento.count({ where: { estado: 'listo_para_entrega' } });
    const entregados = await Documento.count({ where: { estado: 'entregado' } });
    const cancelados = await Documento.count({ where: { estado: 'cancelado' } });
    
    // Obtener estadísticas del período seleccionado
    const condicionesPeriodo = {
      created_at: {
        [Op.between]: [fechaInicio, fechaFin]
      }
    };
    
    // Documentos nuevos (creados en el período)
    const nuevos = await Documento.count({
      where: condicionesPeriodo
    });
    
    // Documentos procesados (cambiados a "listo para entrega" en el período)
    const procesadosEventos = await EventoDocumento.count({
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
    
    // Documentos entregados en el período
    const entregadosPeriodo = await Documento.count({
      where: {
        estado: 'entregado',
        fechaEntrega: {
          [Op.between]: [fechaInicio, fechaFin]
        }
      }
    });
    
    // Calcular tiempo promedio de procesamiento (desde creación hasta listo_para_entrega)
    const tiempoProcesamientoQuery = await sequelize.query(`
      SELECT AVG(EXTRACT(EPOCH FROM (e.created_at - d.created_at)) / 86400) as promedio_dias
      FROM "eventos_documentos" e
      JOIN "documentos" d ON e.id_documento = d.id
      WHERE e.tipo = 'cambio_estado'
      AND e.detalles LIKE '%listo_para_entrega%'
      AND e.created_at BETWEEN :fechaInicio AND :fechaFin
    `, {
      replacements: { fechaInicio, fechaFin },
      type: sequelize.QueryTypes.SELECT
    });
    
    const tiempoPromedioProcesamiento = tiempoProcesamientoQuery[0]?.promedio_dias 
      ? parseFloat(tiempoProcesamientoQuery[0].promedio_dias).toFixed(1) 
      : 'N/A';
    
    // Calcular tiempo promedio de entrega (desde listo_para_entrega hasta entregado)
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
    
    const tiempoPromedioEntrega = tiempoEntregaQuery[0]?.promedio_dias 
      ? parseFloat(tiempoEntregaQuery[0].promedio_dias).toFixed(1) 
      : 'N/A';
    
    // Obtener documentos pendientes de entrega
    const documentosPendientes = await Documento.findAll({
      where: { 
        estado: 'listo_para_entrega' 
      },
      order: [['updated_at', 'DESC']],
      limit: 5,
      include: [{
        model: Matrizador,
        as: 'matrizador',
        attributes: ['id', 'nombre']
      }]
    });
    
    // Obtener últimos documentos registrados
    const documentosRecientes = await Documento.findAll({
      order: [['created_at', 'DESC']],
      limit: 5,
      include: [{
        model: Matrizador,
        as: 'matrizador',
        attributes: ['id', 'nombre']
      }]
    });
    
    // Obtener actividades recientes
    const actividades = await EventoDocumento.findAll({
      order: [['created_at', 'DESC']],
      limit: 5,
      include: [{
        model: Documento,
        as: 'documento'
      }]
    });
    
    // Formatear actividades para el dashboard
    const actividadesFormateadas = actividades.map(actividad => {
      let titulo = '';
      let descripcion = '';
      
      switch (actividad.tipo) {
        case 'creacion':
          titulo = 'Documento registrado';
          descripcion = `${actividad.documento.tipoDocumento} para ${actividad.documento.nombreCliente}`;
          break;
        case 'cambio_estado':
          titulo = 'Cambio de estado';
          descripcion = `${actividad.documento.tipoDocumento} - ${actividad.detalles}`;
          break;
        case 'entrega':
          titulo = 'Documento entregado';
          descripcion = `${actividad.documento.tipoDocumento} a ${actividad.detalles}`;
          break;
        default:
          titulo = actividad.tipo;
          descripcion = actividad.detalles;
      }
      
      return {
        titulo,
        descripcion,
        fecha: actividad.created_at,
        usuario: actividad.usuario
      };
    });
    
    // Datos para los gráficos estadísticos
    const estadisticas = {
      volumen: await obtenerDatosVolumen(fechaInicio, fechaFin),
      matrizador: await obtenerDatosMatrizador(fechaInicio, fechaFin),
      tipo: await obtenerDatosTipoDocumento(fechaInicio, fechaFin)
    };
    
    // Obtener lista de matrizadores para filtros
    const matrizadores = await Matrizador.findAll({
      attributes: ['id', 'nombre'],
      order: [['nombre', 'ASC']]
    });
    
    res.render('admin/dashboard', {
      layout: 'admin',
      title: 'Panel de Control',
      activeDashboard: true,
      stats: {
        total,
        enProceso,
        listoParaEntrega,
        entregados,
        entregadosPeriodo,
        cancelados,
        nuevos,
        procesados: procesadosEventos,
        tiempoPromedioProcesamiento,
        tiempoPromedioEntrega
      },
      documentosPendientes,
      documentosRecientes,
      actividades: actividadesFormateadas,
      periodo,
      estadisticas,
      matrizadores
    });
  } catch (error) {
    console.error('Error al cargar el dashboard:', error);
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
  
  // Consulta SQL para nuevos documentos por día/semana/mes
  const datosNuevos = await sequelize.query(`
    SELECT 
      to_char(${formatoAgrupacion}, '${formatoFecha}') as fecha,
      COUNT(*) as total
    FROM documentos
    WHERE created_at BETWEEN :fechaInicio AND :fechaFin
    GROUP BY ${formatoAgrupacion}
    ORDER BY ${formatoAgrupacion}
  `, {
    replacements: { fechaInicio, fechaFin },
    type: sequelize.QueryTypes.SELECT
  });
  
  // Consulta SQL para documentos procesados por día/semana/mes
  const datosProcesados = await sequelize.query(`
    SELECT 
      to_char(${formatoAgrupacion}, '${formatoFecha}') as fecha,
      COUNT(*) as total
    FROM eventos_documentos
    WHERE tipo = 'cambio_estado'
      AND detalles LIKE '%listo_para_entrega%'
      AND created_at BETWEEN :fechaInicio AND :fechaFin
    GROUP BY ${formatoAgrupacion}
    ORDER BY ${formatoAgrupacion}
  `, {
    replacements: { fechaInicio, fechaFin },
    type: sequelize.QueryTypes.SELECT
  });
  
  // Consulta SQL para documentos entregados por día/semana/mes
  const datosEntregados = await sequelize.query(`
    SELECT 
      to_char(${formatoAgrupacion}, '${formatoFecha}') as fecha,
      COUNT(*) as total
    FROM documentos
    WHERE estado = 'entregado'
      AND fecha_entrega BETWEEN :fechaInicio AND :fechaFin
    GROUP BY ${formatoAgrupacion}
    ORDER BY ${formatoAgrupacion}
  `, {
    replacements: { fechaInicio, fechaFin },
    type: sequelize.QueryTypes.SELECT
  });
  
  // Generar lista completa de fechas en el rango
  const fechas = [];
  const nuevos = [];
  const procesados = [];
  const entregados = [];
  
  // Obtener series completas de fechas con valores para el gráfico
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
    
    const procesadoItem = datosProcesados.find(item => item.fecha === fecha);
    procesados.push(procesadoItem ? parseInt(procesadoItem.total) : 0);
    
    const entregadoItem = datosEntregados.find(item => item.fecha === fecha);
    entregados.push(entregadoItem ? parseInt(entregadoItem.total) : 0);
  }
  
  return {
    fechas,
    nuevos,
    procesados,
    entregados,
    unidadTiempo
  };
}

/**
 * Función auxiliar para obtener datos de documentos por matrizador
 */
async function obtenerDatosMatrizador(fechaInicio, fechaFin) {
  // Consulta SQL para documentos por matrizador
  const datos = await sequelize.query(`
    SELECT 
      m.id as id_matrizador,
      m.nombre as nombre_matrizador,
      COUNT(d.id) as total_documentos
    FROM documentos d
    LEFT JOIN matrizadores m ON d.id_matrizador = m.id
    WHERE d.created_at BETWEEN :fechaInicio AND :fechaFin
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
 */
async function obtenerDatosTipoDocumento(fechaInicio, fechaFin) {
  // Consulta SQL para documentos por tipo
  const datos = await sequelize.query(`
    SELECT 
      tipo_documento,
      COUNT(*) as total
    FROM documentos
    WHERE created_at BETWEEN :fechaInicio AND :fechaFin
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
 */
exports.reportes = async (req, res) => {
  try {
    // Obtener parámetros de filtro
    const tipo = req.query.tipo || 'estado';
    const fechaInicio = req.query.fechaInicio ? new Date(req.query.fechaInicio) : new Date(new Date().setDate(new Date().getDate() - 30));
    const fechaFin = req.query.fechaFin ? new Date(req.query.fechaFin + 'T23:59:59') : new Date();
    const idMatrizador = req.query.idMatrizador || '';
    const estado = req.query.estado || '';
    const formato = req.query.formato || 'web'; // web o excel
    
    // Condiciones base para consultas
    const condiciones = {
      created_at: {
        [Op.between]: [fechaInicio, fechaFin]
      }
    };
    
    if (idMatrizador) {
      condiciones.idMatrizador = idMatrizador;
    }
    
    if (estado) {
      condiciones.estado = estado;
    }
    
    // Obtener matrizadores para filtros
    const matrizadores = await Matrizador.findAll({
      order: [['nombre', 'ASC']]
    });
    
    let resultados = [];
    let documentos = [];
    let reporteTitulo = '';
    let totales = {};
    
    // Generar reportes según el tipo seleccionado
    switch (tipo) {
      case 'estado':
        reporteTitulo = 'Reporte de Documentos por Estado';
        
        // Agrupar por estado
        const estadisticas = await Documento.findAll({
          where: condiciones,
          attributes: [
            'estado',
            [sequelize.fn('COUNT', sequelize.col('id')), 'count']
          ],
          group: ['estado'],
          raw: true
        });
        
        // Calcular porcentaje
        const totalDocumentos = estadisticas.reduce((sum, item) => sum + parseInt(item.count), 0);
        
        resultados = estadisticas.map(item => ({
          _id: item.estado,
          count: parseInt(item.count),
          porcentaje: Math.round((parseInt(item.count) / totalDocumentos) * 100)
        }));
        
        totales = { count: totalDocumentos };
        break;
        
      case 'matrizador':
        reporteTitulo = 'Reporte de Documentos por Matrizador';
        
        // Agrupar por matrizador
        const estadisticasMatrizador = await Documento.findAll({
          where: condiciones,
          attributes: [
            'idMatrizador',
            [sequelize.fn('COUNT', sequelize.col('id')), 'count']
          ],
          include: [{
            model: Matrizador,
            as: 'matrizador',
            attributes: ['nombre']
          }],
          group: ['idMatrizador', 'matrizador.id'],
          raw: true
        });
        
        // Calcular porcentaje
        const totalDocumentosMatrizador = estadisticasMatrizador.reduce((sum, item) => sum + parseInt(item.count), 0);
        
        resultados = estadisticasMatrizador.map(item => ({
          _id: item.idMatrizador,
          nombre: item['matrizador.nombre'] || 'Sin asignar',
          count: parseInt(item.count),
          porcentaje: Math.round((parseInt(item.count) / totalDocumentosMatrizador) * 100)
        }));
        
        totales = { count: totalDocumentosMatrizador };
        break;
        
      case 'fecha':
        reporteTitulo = 'Reporte de Documentos por Fecha';
        
        // Obtener datos para el reporte por fecha
        const documentosPorFecha = await Documento.findAll({
          where: condiciones,
          attributes: [
            [sequelize.fn('date', sequelize.col('created_at')), 'fecha'],
            [sequelize.fn('COUNT', sequelize.literal('CASE WHEN estado = \'en_proceso\' THEN 1 ELSE NULL END')), 'en_proceso'],
            [sequelize.fn('COUNT', sequelize.literal('CASE WHEN estado = \'listo_para_entrega\' THEN 1 ELSE NULL END')), 'listo_para_entrega'],
            [sequelize.fn('COUNT', sequelize.literal('CASE WHEN estado = \'entregado\' THEN 1 ELSE NULL END')), 'entregado'],
            [sequelize.fn('COUNT', sequelize.col('id')), 'total']
          ],
          group: [sequelize.fn('date', sequelize.col('created_at'))],
          order: [[sequelize.fn('date', sequelize.col('created_at')), 'ASC']],
          raw: true
        });
        
        resultados = documentosPorFecha.map(item => ({
          _id: item.fecha,
          registrados: parseInt(item.total),
          listos: parseInt(item.listo_para_entrega),
          entregados: parseInt(item.entregado)
        }));
        
        totales = {
          registrados: resultados.reduce((sum, item) => sum + item.registrados, 0),
          listos: resultados.reduce((sum, item) => sum + item.listos, 0),
          entregados: resultados.reduce((sum, item) => sum + item.entregados, 0)
        };
        break;
        
      case 'tipoDocumento':
        reporteTitulo = 'Reporte de Documentos por Tipo';
        
        // Agrupar por tipo de documento
        const estadisticasTipo = await Documento.findAll({
          where: condiciones,
          attributes: [
            'tipo_documento',
            [sequelize.fn('COUNT', sequelize.col('id')), 'count']
          ],
          group: ['tipo_documento'],
          raw: true
        });
        
        // Calcular porcentaje
        const totalDocumentosTipo = estadisticasTipo.reduce((sum, item) => sum + parseInt(item.count), 0);
        
        resultados = estadisticasTipo.map(item => ({
          _id: item.tipo_documento,
          count: parseInt(item.count),
          porcentaje: Math.round((parseInt(item.count) / totalDocumentosTipo) * 100)
        }));
        
        totales = { count: totalDocumentosTipo };
        break;
    }
    
    // Obtener documentos para el listado detallado
    documentos = await Documento.findAll({
      where: condiciones,
      order: [['created_at', 'DESC']],
      limit: 100,
      include: [{
        model: Matrizador,
        as: 'matrizador'
      }]
    });
    
    // Si se solicita formato Excel, enviar como descarga (simulado)
    if (formato === 'excel') {
      res.setHeader('Content-Type', 'application/vnd.ms-excel');
      res.setHeader('Content-Disposition', `attachment; filename="reporte-${tipo}-${new Date().toISOString().slice(0,10)}.xls"`);
      return res.render('admin/reportes-excel', {
        layout: false,
        tipoReporte: tipo,
        reporteTitulo,
        resultados,
        documentos,
        totales
      });
    }
    
    res.render('admin/reportes', {
      layout: 'admin',
      title: 'Reportes y Estadísticas',
      activeReportes: true,
      tipoReporte: tipo,
      reporteTitulo,
      resultados,
      documentos,
      totales,
      matrizadores,
      filtros: {
        tipo,
        fechaInicio: fechaInicio.toISOString().slice(0, 10),
        fechaFin: fechaFin.toISOString().slice(0, 10),
        idMatrizador,
        estado
      }
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
    // Parámetros de filtrado
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
    
    // Procesar fechas según el período seleccionado
    let fechaInicio, fechaFin;
    const ahora = new Date();
    
    switch (tipoPeriodo) {
      case 'hoy':
        fechaInicio = new Date(ahora);
        fechaInicio.setHours(0, 0, 0, 0);
        fechaFin = new Date(ahora);
        fechaFin.setHours(23, 59, 59, 999);
        break;
      case 'semana':
        fechaInicio = new Date(ahora);
        fechaInicio.setDate(fechaInicio.getDate() - fechaInicio.getDay());
        fechaInicio.setHours(0, 0, 0, 0);
        fechaFin = new Date(ahora);
        fechaFin.setHours(23, 59, 59, 999);
        break;
      case 'mes':
        fechaInicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
        fechaInicio.setHours(0, 0, 0, 0);
        fechaFin = new Date(ahora);
        fechaFin.setHours(23, 59, 59, 999);
        break;
      case 'ultimo_mes':
        fechaInicio = new Date(ahora);
        fechaInicio.setMonth(fechaInicio.getMonth() - 1);
        fechaInicio.setHours(0, 0, 0, 0);
        fechaFin = new Date(ahora);
        fechaFin.setHours(23, 59, 59, 999);
        break;
      case 'personalizado':
        if (req.query.fechaInicio) {
          fechaInicio = new Date(req.query.fechaInicio);
          fechaInicio.setHours(0, 0, 0, 0);
        } else {
          fechaInicio = new Date(ahora);
          fechaInicio.setDate(fechaInicio.getDate() - 30);
          fechaInicio.setHours(0, 0, 0, 0);
        }
        if (req.query.fechaFin) {
          fechaFin = new Date(req.query.fechaFin);
          fechaFin.setHours(23, 59, 59, 999);
        } else {
          fechaFin = new Date(ahora);
          fechaFin.setHours(23, 59, 59, 999);
        }
        break;
      default:
        fechaInicio = new Date(ahora);
        fechaInicio.setHours(0, 0, 0, 0);
        fechaFin = new Date(ahora);
        fechaFin.setHours(23, 59, 59, 999);
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
      const cancelados = await Documento.count({ where: { estado: 'cancelado' } });
      
      // Estadísticas del período
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
        cancelados,
        nuevos,
        procesados,
        entregadosPeriodo
      };
      
      // Tiempos promedio
      const tiempoProcesamientoQuery = await sequelize.query(`
        SELECT AVG(EXTRACT(EPOCH FROM (e.created_at - d.created_at)) / 86400) as promedio_dias
        FROM "eventos_documentos" e
        JOIN "documentos" d ON e.id_documento = d.id
        WHERE e.tipo = 'cambio_estado'
        AND e.detalles LIKE '%listo_para_entrega%'
        AND e.created_at BETWEEN :fechaInicio AND :fechaFin
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
      // Listado detallado de documentos
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