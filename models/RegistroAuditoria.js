/**
 * Modelo para el registro de auditoría
 * Almacena información detallada sobre acciones sensibles como la verificación de códigos
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RegistroAuditoria = sequelize.define('RegistroAuditoria', {
  // ID único del registro
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  
  // Documento relacionado con la acción
  idDocumento: {
    type: DataTypes.INTEGER,
    field: 'id_documento',
    allowNull: false,
    references: {
      model: 'documentos',
      key: 'id'
    }
  },
  
  // Usuario que realizó la acción
  idMatrizador: {
    type: DataTypes.INTEGER,
    field: 'id_matrizador',
    allowNull: false,
    references: {
      model: 'matrizadores',
      key: 'id'
    }
  },
  
  // Tipo de acción (consulta_codigo, verificacion_codigo, verificacion_llamada)
  accion: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isIn: [['consulta_codigo', 'verificacion_codigo', 'verificacion_llamada', 'edicion_codigo', 'ACTUALIZACION_DOCUMENTO']]
    }
  },
  
  // Resultado de la acción (exitoso, fallido)
  resultado: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isIn: [['exitoso', 'fallido']]
    }
  },
  
  // IP desde donde se realizó la acción
  ip: {
    type: DataTypes.STRING,
    allowNull: true
  },
  
  // User-Agent del navegador
  userAgent: {
    type: DataTypes.TEXT,
    field: 'user_agent',
    allowNull: true
  },
  
  // Detalles adicionales sobre la acción
  detalles: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'registros_auditoria',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = RegistroAuditoria; 