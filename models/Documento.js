/**
 * Modelo para la tabla de Documentos Notariales
 * Define la estructura y validaciones de los documentos en el sistema
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const DocumentoRelacion = require('./DocumentoRelacion');

const Documento = sequelize.define('Documento', {
  // ID único del documento
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  
  // Código de barras único para identificar el documento
  codigoBarras: {
    type: DataTypes.STRING,
    field: 'codigo_barras',
    unique: true,
    allowNull: false,
    validate: {
      notEmpty: true,
      // Asegurar que el código comienza con el prefijo requerido
      isValidBarcode(value) {
        if (!value.startsWith('20251701018')) {
          throw new Error('El código de barras debe comenzar con el prefijo 20251701018');
        }
      }
    }
  },
  
  // Tipo de documento (escritura, poder, testamento, etc.)
  tipoDocumento: {
    type: DataTypes.STRING,
    field: 'tipo_documento',
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  
  // Fecha de creación del documento
  fechaCreacion: {
    type: DataTypes.DATE,
    field: 'fecha_creacion',
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  
  // Nombre del cliente o solicitante
  nombreCliente: {
    type: DataTypes.STRING,
    field: 'nombre_cliente',
    allowNull: false
  },
  
  // Número de identificación del cliente (DNI, NIE, etc.)
  identificacionCliente: {
    type: DataTypes.STRING,
    field: 'identificacion_cliente',
    allowNull: false
  },
  
  // Correo electrónico del cliente
  emailCliente: {
    type: DataTypes.STRING,
    field: 'email_cliente',
    validate: {
      isEmail: true
    }
  },
  
  // Teléfono del cliente (para notificaciones WhatsApp)
  telefonoCliente: {
    type: DataTypes.STRING,
    field: 'telefono_cliente'
  },
  
  // Estado actual del documento (en_proceso, listo, entregado, etc.)
  estado: {
    type: DataTypes.ENUM('en_proceso', 'listo_para_entrega', 'entregado', 'cancelado'),
    defaultValue: 'en_proceso'
  },
  
  // Código de verificación para la entrega (4 dígitos enviado por WhatsApp/email)
  codigoVerificacion: {
    type: DataTypes.STRING(4),
    field: 'codigo_verificacion',
    validate: {
      isNumeric: true,
      len: [4, 4]
    }
  },
  
  // Fecha de entrega del documento (si ya fue entregado)
  fechaEntrega: {
    type: DataTypes.DATE,
    field: 'fecha_entrega'
  },
  
  // Notas o comentarios adicionales
  notas: {
    type: DataTypes.TEXT
  },
  
  // Lista de comparecientes (personas que intervienen)
  comparecientes: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  
  // Nombre de quien recibe el documento
  nombreReceptor: {
    type: DataTypes.STRING,
    field: 'nombre_receptor',
    allowNull: true
  },
  
  // Número de identificación del receptor
  identificacionReceptor: {
    type: DataTypes.STRING,
    field: 'identificacion_receptor',
    allowNull: true
  },
  
  // Relación del receptor con el compareciente
  relacionReceptor: {
    type: DataTypes.ENUM('titular', 'familiar', 'mandatario', 'otro'),
    field: 'relacion_receptor',
    allowNull: true
  },
  
  // ID del matrizador que creó el documento
  idMatrizador: {
    type: DataTypes.INTEGER,
    field: 'id_matrizador',
    allowNull: true,
    references: {
      // Esto crea una referencia (futura) a un modelo Matrizador
      model: 'matrizadores',
      key: 'id'
    }
  }
}, {
  // Opciones del modelo
  tableName: 'documentos',
  timestamps: true, // Crea automáticamente createdAt y updatedAt
  underscored: true, // Usa snake_case para los nombres de columnas
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Definir relaciones con alias más descriptivos
Documento.hasMany(DocumentoRelacion, {
  foreignKey: 'idDocumentoPrincipal',
  as: 'relacionesComoPrincipal'
});

Documento.hasMany(DocumentoRelacion, {
  foreignKey: 'idDocumentoRelacionado',
  as: 'relacionesComoComponente'
});

// Relación para documentos que son componentes del actual
Documento.belongsToMany(Documento, {
  through: DocumentoRelacion,
  foreignKey: 'idDocumentoPrincipal',
  otherKey: 'idDocumentoRelacionado',
  as: 'componentes'
});

// Relación para documentos principales de los que el actual es componente
Documento.belongsToMany(Documento, {
  through: DocumentoRelacion,
  foreignKey: 'idDocumentoRelacionado',
  otherKey: 'idDocumentoPrincipal',
  as: 'documentosPrincipales'
});

module.exports = Documento; 