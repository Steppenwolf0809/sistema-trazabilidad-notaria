/**
 * Modelo para la tabla de Auditoría de Reversiones
 * Registra todas las reversiones realizadas por cualquier rol del sistema
 * INMUTABLE - No se puede editar ni eliminar una vez creado
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ReversionAuditoria = sequelize.define('ReversionAuditoria', {
  // ID único de la reversión
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  
  // Tipo de reversión realizada
  tipoReversion: {
    type: DataTypes.ENUM(
      // Reversiones de Admin (Estados)
      'desmarcar_listo', 
      'deshacer_entrega', 
      'separar_grupo', 
      'reactivar_documento',
      // Reversiones de Caja (Financieras)
      'deshacer_pago', 
      'corregir_metodo_pago', 
      'ajustar_monto_pago', 
      'deshacer_retencion'
    ),
    field: 'tipo_reversion',
    allowNull: false,
    comment: 'Tipo específico de reversión realizada'
  },
  
  // ID del documento afectado
  documentoId: {
    type: DataTypes.INTEGER,
    field: 'documento_id',
    allowNull: false,
    references: {
      model: 'documentos',
      key: 'id'
    }
  },
  
  // ID del pago afectado (solo para reversiones financieras)
  pagoId: {
    type: DataTypes.INTEGER,
    field: 'pago_id',
    allowNull: true,
    comment: 'Solo para reversiones de pagos específicos'
  },
  
  // ID del usuario que realizó la reversión
  usuarioId: {
    type: DataTypes.INTEGER,
    field: 'usuario_id',
    allowNull: false,
    references: {
      model: 'matrizadores',
      key: 'id'
    }
  },
  
  // Rol del usuario que realizó la reversión
  rolUsuario: {
    type: DataTypes.ENUM('admin', 'caja', 'caja_archivo'),
    field: 'rol_usuario',
    allowNull: false,
    comment: 'Rol del usuario al momento de la reversión'
  },
  
  // Estado anterior del documento
  estadoAnterior: {
    type: DataTypes.STRING,
    field: 'estado_anterior',
    allowNull: true,
    comment: 'Estado del documento antes de la reversión'
  },
  
  // Estado nuevo del documento
  estadoNuevo: {
    type: DataTypes.STRING,
    field: 'estado_nuevo',
    allowNull: true,
    comment: 'Estado del documento después de la reversión'
  },
  
  // Datos anteriores en formato JSON
  datosAnteriores: {
    type: DataTypes.JSON,
    field: 'datos_anteriores',
    allowNull: true,
    comment: 'Valores anteriores (monto, método, datos de entrega, etc.)'
  },
  
  // Datos nuevos en formato JSON
  datosNuevos: {
    type: DataTypes.JSON,
    field: 'datos_nuevos',
    allowNull: true,
    comment: 'Valores nuevos después de la reversión'
  },
  
  // Categoría del motivo
  motivoCategoria: {
    type: DataTypes.STRING,
    field: 'motivo_categoria',
    allowNull: false,
    comment: 'Categoría del error: error_humano, error_sistema, cambio_cliente, etc.'
  },
  
  // Justificación detallada obligatoria
  justificacion: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      len: [20, 1000]
    },
    comment: 'Justificación detallada de por qué se necesita la reversión'
  },
  
  // Dirección IP del usuario
  ipAddress: {
    type: DataTypes.STRING,
    field: 'ip_address',
    allowNull: true,
    comment: 'IP desde donde se realizó la reversión'
  },
  
  // Fecha y hora de la reversión
  fechaReversion: {
    type: DataTypes.DATE,
    field: 'fecha_reversion',
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: 'Timestamp exacto de cuándo se realizó la reversión'
  },
  
  // Metadatos adicionales
  metadatos: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {},
    comment: 'Información adicional de contexto'
  }
}, {
  // Opciones del modelo
  tableName: 'reversiones_auditoria',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false, // No permitir actualizaciones
  underscored: true,
  
  // Hooks para inmutabilidad
  hooks: {
    beforeUpdate: () => {
      throw new Error('Los registros de auditoría de reversiones son inmutables');
    },
    beforeDestroy: () => {
      throw new Error('Los registros de auditoría de reversiones no se pueden eliminar');
    }
  }
});

module.exports = ReversionAuditoria; 