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
  
  // ID del documento asociado (CORREGIDO: usar documentoId para consistencia)
  documentoId: {
    type: DataTypes.INTEGER,
    field: 'documento_id', // Mapear al nombre real de la columna en la DB
    allowNull: false,
    references: {
      model: 'documentos',
      key: 'id'
    }
  },
  
  // ID del usuario que realizó la acción (para asociación)
  usuarioId: {
    type: DataTypes.INTEGER,
    field: 'usuario_id',
    allowNull: true,
    references: {
      model: 'matrizadores',
      key: 'id'
    }
  },
  
  // Tipo de evento
  tipo: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isIn: [['creacion', 'cambio_estado', 'entrega', 'cancelacion', 'edicion', 'otro', 'verificacion_codigo', 'verificacion_llamada', 'modificacion', 'pago', 'confirmacion_pago', 'tipoEvento', 'documento_listo', 'documento_entregado', 'notificacion_enviada', 'registro', 'vista', 'asignacion']]
    }
  },
  
  // Categoría del evento para agrupación
  categoria: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'general'
  },
  
  // Título del evento
  titulo: {
    type: DataTypes.STRING,
    allowNull: true
  },
  
  // Descripción del evento
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  
  // Detalles adicionales del evento (como JSON)
  detalles: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {}
  },
  
  // Usuario que realizó la acción (texto plano para compatibilidad)
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
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  underscored: true
});

// Definir asociaciones
EventoDocumento.associate = function(models) {
  // Asociación con Documento
  EventoDocumento.belongsTo(models.Documento, {
    foreignKey: 'documentoId',
    as: 'documento'
  });
  
  // Asociación con Matrizador (usuario que realizó la acción)
  EventoDocumento.belongsTo(models.Matrizador, {
    foreignKey: 'usuarioId',
    as: 'usuario'
  });
};

module.exports = EventoDocumento; 