/**
 * Modelo para registrar autorizaciones especiales para entrega de documentos no pagados
 * Almacena información sobre quién autorizó la entrega y por qué
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AutorizacionEntrega = sequelize.define('AutorizacionEntrega', {
  // ID único de la autorización
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  
  // ID del documento entregado
  documentoId: {
    type: DataTypes.INTEGER,
    field: 'documento_id',
    allowNull: false,
    references: {
      model: 'documentos',
      key: 'id'
    }
  },
  
  // ID del usuario que realiza la entrega
  usuarioId: {
    type: DataTypes.INTEGER,
    field: 'usuario_id',
    allowNull: false,
    references: {
      model: 'matrizadores',
      key: 'id'
    }
  },
  
  // ID del usuario que autoriza la entrega sin pago
  autorizadorId: {
    type: DataTypes.INTEGER,
    field: 'autorizador_id',
    allowNull: false,
    references: {
      model: 'matrizadores',
      key: 'id'
    }
  },
  
  // Tipo de autorización
  tipoAutorizacion: {
    type: DataTypes.ENUM('pago_confirmado', 'cliente_credito', 'autorizacion_admin'),
    field: 'tipo_autorizacion',
    allowNull: false
  },
  
  // Justificación de la autorización
  motivo: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  
  // Fecha y hora de la autorización
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'autorizaciones_entrega',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = AutorizacionEntrega; 