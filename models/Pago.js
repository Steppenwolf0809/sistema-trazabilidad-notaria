/**
 * Modelo para la tabla de Pagos
 * Registra todos los pagos individuales realizados a documentos
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Pago = sequelize.define('Pago', {
  // ID único del pago
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  
  // ID del documento al que pertenece el pago
  documentoId: {
    type: DataTypes.INTEGER,
    field: 'documento_id',
    allowNull: false,
    references: {
      model: 'documentos',
      key: 'id'
    }
  },
  
  // ID del usuario que registró el pago
  usuarioId: {
    type: DataTypes.INTEGER,
    field: 'usuario_id',
    allowNull: false,
    references: {
      model: 'matrizadores',
      key: 'id'
    }
  },
  
  // Monto del pago
  monto: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 0.01
    }
  },
  
  // Forma de pago utilizada
  formaPago: {
    type: DataTypes.ENUM('efectivo', 'transferencia', 'cheque', 'tarjeta_credito', 'tarjeta_debito', 'otros'),
    field: 'forma_pago',
    allowNull: false
  },
  
  // Número de comprobante (opcional)
  numeroComprobante: {
    type: DataTypes.STRING(100),
    field: 'numero_comprobante',
    allowNull: true
  },
  
  // Indica si este pago es una retención
  esRetencion: {
    type: DataTypes.BOOLEAN,
    field: 'es_retencion',
    defaultValue: false,
    allowNull: false
  },
  
  // Observaciones del pago
  observaciones: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  
  // Fecha del pago
  fechaPago: {
    type: DataTypes.DATE,
    field: 'fecha_pago',
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  
  // Metadatos adicionales (JSON)
  metadatos: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {},
    comment: 'Información adicional del pago en formato JSON'
  }
}, {
  // Opciones del modelo
  tableName: 'pagos',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = Pago; 