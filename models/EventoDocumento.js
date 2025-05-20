/**
 * Modelo para la tabla de Eventos de Documentos
 * Registra todas las acciones realizadas sobre los documentos
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const EventoDocumento = sequelize.define('EventoDocumento', {
  // ID único del evento
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  
  // ID del documento asociado
  idDocumento: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'documentos',
      key: 'id'
    }
  },
  
  // Tipo de evento (creacion, cambio_estado, entrega, cancelacion, etc.)
  tipo: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isIn: [['creacion', 'cambio_estado', 'entrega', 'cancelacion', 'edicion', 'otro', 'verificacion_codigo', 'verificacion_llamada', 'modificacion']]
    }
  },
  
  // Detalles o descripción del evento
  detalles: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  
  // Usuario que realizó la acción
  usuario: {
    type: DataTypes.STRING,
    allowNull: true
  },
  
  // Datos adicionales del evento (como JSON)
  metadatos: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {}
  }
}, {
  // Opciones del modelo
  tableName: 'eventos_documentos',
  timestamps: true, // Crea automáticamente createdAt y updatedAt
  updatedAt: false, // Solo necesitamos createdAt para eventos
  underscored: true // Usa snake_case para los nombres de columnas
});

module.exports = EventoDocumento; 