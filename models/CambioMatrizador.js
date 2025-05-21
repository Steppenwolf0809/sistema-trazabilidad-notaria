/**
 * Modelo para registrar cambios de matrizador asignado
 * Almacena información sobre quién realizó el cambio y por qué
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CambioMatrizador = sequelize.define('CambioMatrizador', {
  // ID único del cambio
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  
  // ID del documento modificado
  documentoId: {
    type: DataTypes.INTEGER,
    field: 'documento_id',
    allowNull: false,
    references: {
      model: 'documentos',
      key: 'id'
    }
  },
  
  // ID del matrizador anterior
  matrizadorAnteriorId: {
    type: DataTypes.INTEGER,
    field: 'matrizador_anterior_id',
    allowNull: true,
    references: {
      model: 'matrizadores',
      key: 'id'
    }
  },
  
  // ID del nuevo matrizador asignado
  matrizadorNuevoId: {
    type: DataTypes.INTEGER,
    field: 'matrizador_nuevo_id',
    allowNull: false,
    references: {
      model: 'matrizadores',
      key: 'id'
    }
  },
  
  // ID del usuario que realizó el cambio
  usuarioId: {
    type: DataTypes.INTEGER,
    field: 'usuario_id',
    allowNull: false,
    references: {
      model: 'matrizadores',
      key: 'id'
    }
  },
  
  // Fecha y hora del cambio
  fechaCambio: {
    type: DataTypes.DATE,
    field: 'fecha_cambio',
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  
  // Justificación del cambio
  justificacion: {
    type: DataTypes.TEXT,
    allowNull: false
  }
}, {
  tableName: 'cambios_matrizador',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = CambioMatrizador; 