/**
 * Rutas para la gestión de eliminación de documentos
 * Maneja las operaciones de eliminación definitiva y auditoría
 */

const express = require('express');
const router = express.Router();
const eliminacionController = require('../controllers/eliminacionController');
const { requireAdmin } = require('../middlewares/auth'); // Middleware de autenticación

// Middleware para verificar que solo administradores accedan a estas rutas
router.use(requireAdmin);

// =================== RUTAS DE ELIMINACIÓN ===================

/**
 * POST /api/admin/documentos/:id/eliminar
 * Elimina definitivamente un documento
 */
router.post('/documentos/:id/eliminar', eliminacionController.eliminarDocumento);

/**
 * GET /api/admin/eliminaciones
 * Obtiene la lista de documentos eliminados con filtros y paginación
 */
router.get('/eliminaciones', eliminacionController.obtenerDocumentosEliminados);

/**
 * GET /api/admin/eliminaciones/estadisticas
 * Obtiene estadísticas de eliminaciones para el dashboard
 */
router.get('/eliminaciones/estadisticas', eliminacionController.obtenerEstadisticasEliminacion);

/**
 * GET /api/admin/eliminaciones/:id
 * Obtiene el detalle completo de una eliminación específica
 */
router.get('/eliminaciones/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const AuditoriaEliminacion = require('../models/AuditoriaEliminacion');
    const Matrizador = require('../models/Matrizador');
    
    const eliminacion = await AuditoriaEliminacion.findByPk(id, {
      include: [{
        model: Matrizador,
        as: 'administrador',
        attributes: ['id', 'nombre', 'rol'],
        foreignKey: 'eliminadoPor'
      }]
    });
    
    if (!eliminacion) {
      return res.status(404).json({
        success: false,
        message: 'Registro de eliminación no encontrado'
      });
    }
    
    res.json({
      success: true,
      data: eliminacion
    });
    
  } catch (error) {
    console.error('Error al obtener detalle de eliminación:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/admin/eliminaciones/exportar
 * Exporta los registros de eliminaciones en formato Excel
 */
router.get('/eliminaciones/exportar', async (req, res) => {
  try {
    const AuditoriaEliminacion = require('../models/AuditoriaEliminacion');
    const { Op } = require('sequelize');
    
    // Aplicar filtros de la query
    const where = {};
    if (req.query.motivo) {
      where.motivo = req.query.motivo;
    }
    if (req.query.fechaInicio && req.query.fechaFin) {
      where.fechaEliminacion = {
        [Op.between]: [new Date(req.query.fechaInicio), new Date(req.query.fechaFin + 'T23:59:59')]
      };
    }
    
    const eliminaciones = await AuditoriaEliminacion.findAll({
      where,
      order: [['fechaEliminacion', 'DESC']],
      limit: 1000 // Limitar exportación para evitar problemas de memoria
    });
    
    // Preparar datos para CSV (formato simple para exportación)
    const csvData = eliminaciones.map(item => {
      const datos = item.datosDocumento;
      return {
        'Fecha Eliminación': item.fechaEliminacion.toISOString().split('T')[0],
        'Hora': item.fechaEliminacion.toTimeString().split(' ')[0],
        'Código Documento': item.codigoDocumento,
        'Tipo Documento': datos.tipoDocumento || '',
        'Cliente': datos.nombreCliente || '',
        'Identificación': datos.identificacionCliente || '',
        'Motivo': item.motivo,
        'Valor Impacto': item.valorImpacto || 0,
        'Estaba Pagado': item.estabaPagado ? 'Sí' : 'No',
        'Administrador': item.nombreAdministrador,
        'Justificación': item.justificacion,
        'IP': item.ip || ''
      };
    });
    
    // Convertir a CSV
    if (csvData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No hay datos para exportar con los filtros aplicados'
      });
    }
    
    const headers = Object.keys(csvData[0]);
    let csvContent = headers.join(',') + '\n';
    
    csvData.forEach(row => {
      const values = headers.map(header => {
        let value = row[header] || '';
        // Escapar comillas y comas en CSV
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          value = '"' + value.replace(/"/g, '""') + '"';
        }
        return value;
      });
      csvContent += values.join(',') + '\n';
    });
    
    // Configurar headers para descarga
    const fechaActual = new Date().toISOString().split('T')[0];
    const nombreArchivo = `auditoria_eliminaciones_${fechaActual}.csv`;
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
    res.setHeader('Content-Length', Buffer.byteLength(csvContent, 'utf8'));
    
    // Agregar BOM para Excel
    res.write('\ufeff');
    res.end(csvContent);
    
  } catch (error) {
    console.error('Error al exportar eliminaciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al generar la exportación',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router; 