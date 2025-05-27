/**
 * Modelo para auditoría de notificaciones enviadas
 * Registra todos los intentos de notificación del sistema
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const NotificacionEnviada = sequelize.define('NotificacionEnviada', {
  // ID único de la notificación
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  
  // ID del documento asociado
  documentoId: {
    type: DataTypes.INTEGER,
    field: 'documento_id',
    allowNull: false,
    references: {
      model: 'documentos',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  
  // Tipo de evento que generó la notificación
  tipoEvento: {
    type: DataTypes.ENUM('documento_listo', 'entrega_confirmada', 'recordatorio', 'alerta_sin_recoger'),
    field: 'tipo_evento',
    allowNull: false,
    comment: 'Tipo de evento que generó la notificación'
  },
  
  // Canal de comunicación utilizado
  canal: {
    type: DataTypes.ENUM('whatsapp', 'email', 'sms'),
    allowNull: false,
    comment: 'Canal utilizado para enviar la notificación'
  },
  
  // Destinatario de la notificación
  destinatario: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Email, teléfono o identificador del destinatario'
  },
  
  // Estado del envío
  estado: {
    type: DataTypes.ENUM('enviado', 'fallido', 'pendiente', 'simulado'),
    defaultValue: 'pendiente',
    allowNull: false,
    comment: 'Estado actual de la notificación'
  },
  
  // Mensaje que se envió
  mensajeEnviado: {
    type: DataTypes.TEXT,
    field: 'mensaje_enviado',
    allowNull: true,
    comment: 'Contenido del mensaje enviado'
  },
  
  // Respuesta de la API externa
  respuestaApi: {
    type: DataTypes.JSON,
    field: 'respuesta_api',
    allowNull: true,
    comment: 'Respuesta completa de la API externa (WhatsApp, Email, etc.)'
  },
  
  // Número de intentos realizados
  intentos: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    allowNull: false,
    comment: 'Número de intentos de envío realizados'
  },
  
  // Último error registrado
  ultimoError: {
    type: DataTypes.TEXT,
    field: 'ultimo_error',
    allowNull: true,
    comment: 'Último error registrado en caso de fallo'
  },
  
  // Fecha programada para el próximo intento
  proximoIntento: {
    type: DataTypes.DATE,
    field: 'proximo_intento',
    allowNull: true,
    comment: 'Fecha programada para el próximo intento de envío'
  },
  
  // Metadatos adicionales
  metadatos: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {},
    comment: 'Información adicional sobre la notificación'
  }
}, {
  // Opciones del modelo
  tableName: 'notificaciones_enviadas',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  
  // Índices
  indexes: [
    {
      fields: ['documento_id']
    },
    {
      fields: ['tipo_evento']
    },
    {
      fields: ['canal']
    },
    {
      fields: ['estado']
    },
    {
      fields: ['created_at']
    },
    {
      fields: ['proximo_intento']
    }
  ]
});

module.exports = NotificacionEnviada; 