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
      notEmpty: true
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
  },
  
  // Número de factura asociada al documento
  numeroFactura: {
    type: DataTypes.STRING,
    field: 'numero_factura',
    allowNull: true
  },
  
  // Valor total de la factura
  valorFactura: {
    type: DataTypes.DECIMAL(10, 2),
    field: 'valor_factura',
    allowNull: true
  },
  
  // Fecha de emisión de la factura
  fechaFactura: {
    type: DataTypes.DATE,
    field: 'fecha_factura',
    allowNull: true
  },
  
  // Estado del pago (Pagado/Pendiente)
  estadoPago: {
    type: DataTypes.ENUM('pagado', 'pendiente'),
    field: 'estado_pago',
    defaultValue: 'pendiente'
  },
  
  // Método de pago utilizado
  metodoPago: {
    type: DataTypes.ENUM('pendiente', 'efectivo', 'tarjeta_credito', 'tarjeta_debito', 'transferencia', 'otro'),
    field: 'metodo_pago',
    defaultValue: 'pendiente',
    allowNull: true
  },
  
  // Indica si se debe omitir el envío de notificaciones
  omitirNotificacion: {
    type: DataTypes.BOOLEAN,
    field: 'omitir_notificacion',
    defaultValue: false
  },
  
  // Razón por la que se omite la notificación
  motivoOmision: {
    type: DataTypes.ENUM('entrega_directa', 'parte_expediente', 'cliente_rechaza', 'otro'),
    field: 'motivo_omision',
    allowNull: true
  },
  
  // Detalles adicionales cuando el motivo de omisión es "otro"
  detalleOmision: {
    type: DataTypes.TEXT,
    field: 'detalle_omision',
    allowNull: true
  },
  
  // Indica si el documento es secundario y forma parte de otro expediente
  esDocumentoSecundario: {
    type: DataTypes.BOOLEAN,
    field: 'es_documento_secundario',
    defaultValue: false
  },
  
  // ID del usuario que creó el documento (puede ser diferente del matrizador)
  idUsuarioCreador: {
    type: DataTypes.INTEGER,
    field: 'id_usuario_creador',
    allowNull: true
  },
  
  // Rol del usuario que creó el documento
  rolUsuarioCreador: {
    type: DataTypes.ENUM('admin', 'matrizador', 'recepcion', 'caja'),
    field: 'rol_usuario_creador',
    allowNull: true
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