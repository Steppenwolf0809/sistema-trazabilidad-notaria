/**
 * Controlador para la eliminación definitiva de documentos
 * Maneja la eliminación controlada con auditoría completa
 */

const Documento = require('../models/Documento');
const AuditoriaEliminacion = require('../models/AuditoriaEliminacion');
const Matrizador = require('../models/Matrizador');
const RegistroAuditoria = require('../models/RegistroAuditoria');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');

/**
 * Elimina definitivamente un documento del sistema
 * Solo disponible para administradores
 */
exports.eliminarDocumento = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { motivo, justificacion, confirmarEliminacion } = req.body;
    
    // Validar que el usuario sea administrador
    if (!req.user || req.user.rol !== 'admin') {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'Solo los administradores pueden eliminar documentos definitivamente'
      });
    }
    
    // Validar datos requeridos
    if (!motivo || !justificacion || !confirmarEliminacion) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Faltan datos requeridos: motivo, justificación y confirmación'
      });
    }
    
    // Validar que la justificación tenga contenido suficiente
    if (justificacion.trim().length < 10) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'La justificación debe tener al menos 10 caracteres'
      });
    }
    
    // Obtener el documento completo antes de eliminarlo
    const documento = await Documento.findByPk(id, {
      include: [{
        model: Matrizador,
        as: 'matrizador',
        attributes: ['id', 'nombre']
      }],
      transaction
    });
    
    if (!documento) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Documento no encontrado'
      });
    }
    
    // Validar que el documento no esté ya eliminado
    if (documento.estado === 'eliminado' || documento.estado === 'nota_credito') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'El documento ya está eliminado o es una nota de crédito'
      });
    }
    
    // Obtener información del administrador
    const administrador = await Matrizador.findByPk(req.user.id, { transaction });
    if (!administrador) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'No se pudo verificar la información del administrador'
      });
    }
    
    // Crear registro en auditoría ANTES de eliminar (snapshot completo)
    const registroAuditoria = await AuditoriaEliminacion.create({
      documentoId: documento.id,
      codigoDocumento: documento.codigoBarras,
      datosDocumento: documento.toJSON(), // Snapshot completo del documento
      motivo: motivo,
      justificacion: justificacion.trim(),
      eliminadoPor: req.user.id,
      nombreAdministrador: administrador.nombre,
      fechaEliminacion: new Date(),
      valorImpacto: documento.valorFactura || 0,
      estabaPagado: documento.estadoPago === 'pagado',
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    }, { transaction });
    
    // Determinar el nuevo estado según el motivo
    let nuevoEstado = 'eliminado';
    if (motivo === 'nota_credito') {
      nuevoEstado = 'nota_credito';
    }
    
    // Actualizar el documento con información de eliminación
    await documento.update({
      estado: nuevoEstado,
      motivoEliminacion: motivo,
      eliminadoPor: req.user.id,
      fechaEliminacion: new Date(),
      justificacionEliminacion: justificacion.trim()
    }, { transaction });
    
    // Registrar en auditoría estándar
    await RegistroAuditoria.create({
      idDocumento: documento.id,
      idMatrizador: req.user.id,
      accion: 'ELIMINACION_DOCUMENTO',
      resultado: 'exitoso',
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      detalles: `Documento eliminado definitivamente. Motivo: ${motivo}. Código: ${documento.codigoBarras}`
    }, { transaction });
    
    await transaction.commit();
    
    res.json({
      success: true,
      message: `Documento eliminado definitivamente. ${nuevoEstado === 'nota_credito' ? 'Registrado como nota de crédito.' : ''}`,
      data: {
        documentoId: documento.id,
        codigoBarras: documento.codigoBarras,
        estado: nuevoEstado,
        fechaEliminacion: new Date(),
        auditoriaId: registroAuditoria.id
      }
    });
    
  } catch (error) {
    await transaction.rollback();
    console.error('Error al eliminar documento:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor al eliminar el documento',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Obtiene la lista de documentos eliminados para auditoría
 * Solo disponible para administradores
 */
exports.obtenerDocumentosEliminados = async (req, res) => {
  try {
    // Validar que el usuario sea administrador
    if (!req.user || req.user.rol !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Solo los administradores pueden ver documentos eliminados'
      });
    }
    
    // Parámetros de filtrado y paginación
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const motivo = req.query.motivo || '';
    const fechaInicio = req.query.fechaInicio ? new Date(req.query.fechaInicio) : null;
    const fechaFin = req.query.fechaFin ? new Date(req.query.fechaFin + 'T23:59:59') : null;
    
    // Construir condiciones de filtrado
    const where = {};
    
    if (motivo) {
      where.motivo = motivo;
    }
    
    if (fechaInicio && fechaFin) {
      where.fechaEliminacion = {
        [Op.between]: [fechaInicio, fechaFin]
      };
    } else if (fechaInicio) {
      where.fechaEliminacion = {
        [Op.gte]: fechaInicio
      };
    } else if (fechaFin) {
      where.fechaEliminacion = {
        [Op.lte]: fechaFin
      };
    }
    
    // Obtener registros con paginación
    const { count, rows: registros } = await AuditoriaEliminacion.findAndCountAll({
      where,
      order: [['fechaEliminacion', 'DESC']],
      limit,
      offset,
      include: [{
        model: Matrizador,
        as: 'administrador',
        attributes: ['id', 'nombre', 'rol'],
        foreignKey: 'eliminadoPor'
      }]
    });
    
    // Calcular totales para estadísticas
    const totales = await AuditoriaEliminacion.findAll({
      where,
      attributes: [
        'motivo',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('valor_impacto')), 'valorTotal']
      ],
      group: ['motivo'],
      raw: true
    });
    
    const totalPages = Math.ceil(count / limit);
    
    res.json({
      success: true,
      data: {
        registros,
        pagination: {
          page,
          limit,
          total: count,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        },
        estadisticas: {
          totalEliminados: count,
          totalesPorMotivo: totales,
          valorImpactoTotal: totales.reduce((sum, item) => sum + (parseFloat(item.valorTotal) || 0), 0)
        }
      }
    });
    
  } catch (error) {
    console.error('Error al obtener documentos eliminados:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Obtiene las estadísticas de eliminaciones para el dashboard
 */
exports.obtenerEstadisticasEliminacion = async (req, res) => {
  try {
    // Validar que el usuario sea administrador
    if (!req.user || req.user.rol !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Solo los administradores pueden ver estas estadísticas'
      });
    }
    
    const fechaInicio = req.query.fechaInicio ? new Date(req.query.fechaInicio) : new Date(new Date().setDate(new Date().getDate() - 30));
    const fechaFin = req.query.fechaFin ? new Date(req.query.fechaFin + 'T23:59:59') : new Date();
    
    // Estadísticas por motivo en el período
    const porMotivo = await AuditoriaEliminacion.findAll({
      where: {
        fechaEliminacion: {
          [Op.between]: [fechaInicio, fechaFin]
        }
      },
      attributes: [
        'motivo',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('valor_impacto')), 'valorTotal']
      ],
      group: ['motivo'],
      raw: true
    });
    
    // Estadísticas por administrador
    const porAdministrador = await AuditoriaEliminacion.findAll({
      where: {
        fechaEliminacion: {
          [Op.between]: [fechaInicio, fechaFin]
        }
      },
      attributes: [
        'nombreAdministrador',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['nombreAdministrador'],
      order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
      raw: true
    });
    
    // Evolución temporal (por día)
    const evolucionTemporal = await sequelize.query(`
      SELECT 
        DATE(fecha_eliminacion) as fecha,
        COUNT(*) as eliminaciones,
        SUM(valor_impacto) as valor_total
      FROM auditoria_eliminaciones
      WHERE fecha_eliminacion BETWEEN :fechaInicio AND :fechaFin
      GROUP BY DATE(fecha_eliminacion)
      ORDER BY DATE(fecha_eliminacion)
    `, {
      replacements: { fechaInicio, fechaFin },
      type: sequelize.QueryTypes.SELECT
    });
    
    res.json({
      success: true,
      data: {
        periodo: {
          fechaInicio: fechaInicio.toISOString().split('T')[0],
          fechaFin: fechaFin.toISOString().split('T')[0]
        },
        porMotivo,
        porAdministrador,
        evolucionTemporal,
        resumen: {
          totalEliminaciones: porMotivo.reduce((sum, item) => sum + parseInt(item.count), 0),
          valorImpactoTotal: porMotivo.reduce((sum, item) => sum + (parseFloat(item.valorTotal) || 0), 0)
        }
      }
    });
    
  } catch (error) {
    console.error('Error al obtener estadísticas de eliminación:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}; 