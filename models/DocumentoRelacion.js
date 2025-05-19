/**
 * Modelo para la tabla de relaciones entre documentos
 * Permite vincular documentos relacionados entre sí
 */

const { Model } = require('sequelize');
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const Matrizador = require('./Matrizador');

class DocumentoRelacion extends Model {
  static associate(models) {
    // Relación con Documento (principal)
    this.belongsTo(models.Documento, {
      foreignKey: 'idDocumentoPrincipal',
      as: 'documentoPrincipal'
    });

    // Relación con Documento (relacionado)
    this.belongsTo(models.Documento, {
      foreignKey: 'idDocumentoRelacionado',
      as: 'documentoRelacionado'
    });

    // Relación con Matrizador (creador)
    this.belongsTo(models.Matrizador, {
      foreignKey: 'creadoPor',
      as: 'matrizadorCreador'
    });
  }
}

DocumentoRelacion.init({
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
    type: DataTypes.ENUM('componente', 'relacionado', 'anexo'),
    field: 'tipo_relacion',
    allowNull: false,
    defaultValue: 'relacionado',
    validate: {
      isIn: [['relacionado', 'deriva_de', 'complementa', 'reemplaza', 'componente_de', 'otro']]
    }
  },
  
  // Indica si el documento es principal en la relación
  esPrincipal: {
    type: DataTypes.BOOLEAN,
    field: 'es_principal',
    allowNull: false,
    defaultValue: false
  },
  
  // UUID para agrupar documentos que deben entregarse juntos
  grupoEntrega: {
    type: DataTypes.STRING,
    field: 'grupo_entrega',
    allowNull: true,
    defaultValue: DataTypes.UUIDV4
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
  sequelize,
  modelName: 'DocumentoRelacion',
  tableName: 'documento_relaciones',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      name: 'idx_doc_rel_principal',
      fields: ['id_documento_principal']
    },
    {
      name: 'idx_doc_rel_relacionado',
      fields: ['id_documento_relacionado']
    },
    {
      name: 'idx_doc_rel_grupo',
      fields: ['grupo_entrega']
    },
    {
      name: 'idx_doc_rel_principal_relacionado',
      unique: true,
      fields: ['id_documento_principal', 'id_documento_relacionado']
    }
  ]
});

module.exports = DocumentoRelacion; 