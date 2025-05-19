/**
 * Modelo para la tabla de relaciones entre documentos
 * Permite vincular documentos relacionados entre sí
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DocumentoRelacion = sequelize.define('DocumentoRelacion', {
  // ID único de la relación
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  
  // ID del documento principal
  idDocumentoPrincipal: {
    type: DataTypes.INTEGER,
    field: 'id_documento_principal',
    allowNull: false,
    references: {
      model: 'documentos',
      key: 'id'
    }
  },
  
  // ID del documento relacionado
  idDocumentoRelacionado: {
    type: DataTypes.INTEGER,
    field: 'id_documento_relacionado',
    allowNull: false,
    references: {
      model: 'documentos',
      key: 'id'
    }
  },
  
  // Tipo de relación entre los documentos
  tipoRelacion: {
    type: DataTypes.STRING,
    field: 'tipo_relacion',
    allowNull: false,
    defaultValue: 'relacionado',
    validate: {
      isIn: [['relacionado', 'deriva_de', 'complementa', 'reemplaza', 'otro']]
    }
  },
  
  // Notas o descripción de la relación
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  
  // Usuario que creó la relación
  creadoPor: {
    type: DataTypes.INTEGER,
    field: 'creado_por',
    allowNull: true,
    references: {
      model: 'matrizadores',
      key: 'id'
    }
  }
}, {
  tableName: 'documento_relaciones',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['id_documento_principal', 'id_documento_relacionado']
    }
  ]
});

module.exports = DocumentoRelacion; 