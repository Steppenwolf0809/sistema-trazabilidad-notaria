/**
 * Controlador para la interfaz administrativa del sistema
 * Gestiona el dashboard y funciones centrales
 */

const Documento = require('../models/Documento');
const Matrizador = require('../models/Matrizador');
const EventoDocumento = require('../models/EventoDocumento');
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
      order: [['updatedAt', 'DESC']],
      limit: 5,
      include: [{
        model: Matrizador,
        as: 'matrizador'
      }]
    });
    
    // Obtener últimos documentos registrados
    const documentosRecientes = await Documento.findAll({
      order: [['createdAt', 'DESC']],
      limit: 5,
      include: [{
        model: Matrizador,
        as: 'matrizador'
      }]
    });
    
    // Obtener actividades recientes
    const actividades = await EventoDocumento.findAll({
      order: [['createdAt', 'DESC']],
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
        fecha: actividad.createdAt,
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
      createdAt: {
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
            [sequelize.fn('date', sequelize.col('createdAt')), 'fecha'],
            [sequelize.fn('COUNT', sequelize.literal('CASE WHEN estado = \'en_proceso\' THEN 1 ELSE NULL END')), 'en_proceso'],
            [sequelize.fn('COUNT', sequelize.literal('CASE WHEN estado = \'listo_para_entrega\' THEN 1 ELSE NULL END')), 'listo_para_entrega'],
            [sequelize.fn('COUNT', sequelize.literal('CASE WHEN estado = \'entregado\' THEN 1 ELSE NULL END')), 'entregado'],
            [sequelize.fn('COUNT', sequelize.col('id')), 'total']
          ],
          group: [sequelize.fn('date', sequelize.col('createdAt'))],
          order: [[sequelize.fn('date', sequelize.col('createdAt')), 'ASC']],
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
            'tipoDocumento',
            [sequelize.fn('COUNT', sequelize.col('id')), 'count']
          ],
          group: ['tipoDocumento'],
          raw: true
        });
        
        // Calcular porcentaje
        const totalDocumentosTipo = estadisticasTipo.reduce((sum, item) => sum + parseInt(item.count), 0);
        
        resultados = estadisticasTipo.map(item => ({
          _id: item.tipoDocumento,
          count: parseInt(item.count),
          porcentaje: Math.round((parseInt(item.count) / totalDocumentosTipo) * 100)
        }));
        
        totales = { count: totalDocumentosTipo };
        break;
    }
    
    // Obtener documentos para el listado detallado
    documentos = await Documento.findAll({
      where: condiciones,
      order: [['createdAt', 'DESC']],
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