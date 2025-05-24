/**
 * Modelo para la auditoría de eliminaciones de documentos
 * Registra información detallada sobre documentos eliminados definitivamente
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AuditoriaEliminacion = sequelize.define('AuditoriaEliminacion', {
  // ID único del registro de auditoría
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  
  // ID del documento eliminado (mantener referencia aunque se elimine)
  documentoId: {
    type: DataTypes.INTEGER,
    field: 'documento_id',
    allowNull: false
  },
  
  // Código de barras del documento eliminado
  codigoDocumento: {
    type: DataTypes.STRING,
    field: 'codigo_documento',
    allowNull: false
  },
  
  // Datos completos del documento antes de eliminar (JSON)
  datosDocumento: {
    type: DataTypes.JSON,
    field: 'datos_documento',
    allowNull: false
  },
  
  // Motivo de la eliminación
  motivo: {
    type: DataTypes.ENUM('documento_duplicado', 'error_critico', 'nota_credito', 'cancelacion_cliente', 'otro'),
    allowNull: false
  },
  
  // Justificación detallada de la eliminación
  justificacion: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  
  // ID del administrador que realizó la eliminación
  eliminadoPor: {
    type: DataTypes.INTEGER,
    field: 'eliminado_por',
    allowNull: false,
    references: {
      model: 'matrizadores',
      key: 'id'
    }
  },
  
  // Nombre del administrador (por seguridad, en caso de que se elimine el usuario)
  nombreAdministrador: {
    type: DataTypes.STRING,
    field: 'nombre_administrador',
    allowNull: false
  },
  
  // Fecha y hora de la eliminación
  fechaEliminacion: {
    type: DataTypes.DATE,
    field: 'fecha_eliminacion',
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  
  // Valor financiero impactado (para cálculos de auditoría)
  valorImpacto: {
    type: DataTypes.DECIMAL(10, 2),
    field: 'valor_impacto',
    allowNull: true
  },
  
  // Indica si el documento estaba pagado al momento de eliminarlo
  estabaPagado: {
    type: DataTypes.BOOLEAN,
    field: 'estaba_pagado',
    defaultValue: false
  },
  
  // IP desde donde se realizó la eliminación
  ip: {
    type: DataTypes.STRING,
    allowNull: true
  },
  
  // User-Agent del navegador
  userAgent: {
    type: DataTypes.TEXT,
    field: 'user_agent',
    allowNull: true
  }
}, {
  tableName: 'auditoria_eliminaciones',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = AuditoriaEliminacion; 