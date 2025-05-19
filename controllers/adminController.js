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
    // Obtener estadísticas de documentos
    const total = await Documento.count();
    const enProceso = await Documento.count({ where: { estado: 'en_proceso' } });
    const listoParaEntrega = await Documento.count({ where: { estado: 'listo_para_entrega' } });
    const entregados = await Documento.count({ where: { estado: 'entregado' } });
    const cancelados = await Documento.count({ where: { estado: 'cancelado' } });
    
    // Calcular documentos entregados hoy
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);
    
    const entregadosHoy = await Documento.count({
      where: {
        estado: 'entregado',
        fechaEntrega: {
          [Op.gte]: hoy,
          [Op.lt]: manana
        }
      }
    });
    
    // Obtener documentos pendientes de entrega
    const documentosPendientes = await Documento.findAll({
      where: { 
        estado: 'listo_para_entrega' 
      },
      order: [['updated_at', 'DESC']],
      limit: 5,
      include: [{
        model: Matrizador,
        as: 'matrizador'
      }]
    });
    
    // Obtener últimos documentos registrados
    const documentosRecientes = await Documento.findAll({
      order: [['created_at', 'DESC']],
      limit: 5,
      include: [{
        model: Matrizador,
        as: 'matrizador'
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
    
    res.render('admin/dashboard', {
      layout: 'admin',
      title: 'Panel de Control',
      activeDashboard: true,
      stats: {
        total,
        enProceso,
        listoParaEntrega,
        entregados,
        cancelados,
        entregadosHoy
      },
      documentosPendientes,
      documentosRecientes,
      actividades: actividadesFormateadas
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