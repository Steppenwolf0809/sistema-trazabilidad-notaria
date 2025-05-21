/**
 * Modelo para registrar relaciones entre documentos principales y secundarios
 * Define qué documentos forman parte de un mismo expediente
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DocumentosRelacionados = sequelize.define('DocumentosRelacionados', {
  // ID único de la relación
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  
  // ID del documento principal
  documentoPrincipalId: {
    type: DataTypes.INTEGER,
    field: 'documento_principal_id',
    allowNull: false,
    references: {
      model: 'documentos',
      key: 'id'
    }
  },
  
  // ID del documento secundario
  documentoSecundarioId: {
    type: DataTypes.INTEGER,
    field: 'documento_secundario_id',
    allowNull: false,
    references: {
      model: 'documentos',
      key: 'id'
    }
  },
  
  // Fecha y hora de la vinculación
  fechaVinculacion: {
    type: DataTypes.DATE,
    field: 'fecha_vinculacion',
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  
  // Usuario que realizó la vinculación
  usuarioId: {
    type: DataTypes.INTEGER,
    field: 'usuario_id',
    allowNull: false,
    references: {
      model: 'matrizadores',
      key: 'id'
    }
  },
  
  // Indica si el documento secundario debe heredar los estados del principal
  heredarEstados: {
    type: DataTypes.BOOLEAN,
    field: 'heredar_estados',
    defaultValue: false
  },
  
  // Observaciones sobre la relación entre documentos
  notas: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'documentos_relacionados',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = DocumentosRelacionados; 