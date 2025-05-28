/**
 * Modelo para la tabla de Documentos Notariales
 * SIMPLIFICADO - Solo campos esenciales con propósitos claros
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
    type: DataTypes.ENUM('Protocolo', 'Diligencias', 'Certificaciones', 'Arrendamientos', 'Otros'),
    field: 'tipo_documento',
    allowNull: false,
    validate: {
      notEmpty: true
    },
    comment: 'Tipo de documento notarial: P=Protocolo, D=Diligencias, C=Certificaciones, A=Arrendamientos, O=Otros'
  },
  
  // ============== FECHAS SIMPLIFICADAS (SOLO 4 CAMPOS) ==============
  
  // 1. FECHA DEL DOCUMENTO ORIGINAL (del XML) - Solo fecha, sin hora
  fechaFactura: {
    type: DataTypes.DATEONLY, // Solo fecha, sin hora
    field: 'fecha_factura',
    allowNull: true,
    comment: 'Fecha del documento original extraída del XML (DD/MM/YYYY)'
  },
  
  // 2. FECHA DE PAGO - Timestamp completo cuando se registra el pago
  fechaPago: {
    type: DataTypes.DATE, // Timestamp completo con timezone
    field: 'fecha_pago',
    allowNull: true,
    comment: 'Timestamp de cuando se registró el pago en el sistema'
  },
  
  // 3. FECHA DE ENTREGA - Timestamp cuando se entrega al cliente
  fechaEntrega: {
    type: DataTypes.DATE,
    field: 'fecha_entrega',
    allowNull: true,
    comment: 'Timestamp de cuando se entregó el documento al cliente'
  },
  
  // NOTA: created_at y updated_at se generan automáticamente por Sequelize
  
  // ============== INFORMACIÓN DEL CLIENTE ==============
  
  nombreCliente: {
    type: DataTypes.STRING,
    field: 'nombre_cliente',
    allowNull: false
  },
  
  identificacionCliente: {
    type: DataTypes.STRING,
    field: 'identificacion_cliente',
    allowNull: false
  },
  
  emailCliente: {
    type: DataTypes.STRING,
    field: 'email_cliente',
    validate: {
      isEmail: true
    }
  },
  
  telefonoCliente: {
    type: DataTypes.STRING,
    field: 'telefono_cliente'
  },
  
  // ============== ESTADO Y FLUJO DEL DOCUMENTO ==============
  
  estado: {
    type: DataTypes.ENUM('en_proceso', 'listo_para_entrega', 'entregado', 'cancelado', 'eliminado', 'nota_credito'),
    defaultValue: 'en_proceso'
  },
  
  codigoVerificacion: {
    type: DataTypes.STRING(4),
    field: 'codigo_verificacion',
    validate: {
      isNumeric: true,
      len: [4, 4]
    }
  },
  
  notas: {
    type: DataTypes.TEXT
  },
  
  comparecientes: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  
  // ============== INFORMACIÓN DE ENTREGA ==============
  
  nombreReceptor: {
    type: DataTypes.STRING,
    field: 'nombre_receptor',
    allowNull: true
  },
  
  identificacionReceptor: {
    type: DataTypes.STRING,
    field: 'identificacion_receptor',
    allowNull: true
  },
  
  relacionReceptor: {
    type: DataTypes.ENUM('titular', 'familiar', 'mandatario', 'otro'),
    field: 'relacion_receptor',
    allowNull: true
  },
  
  // ============== ASIGNACIÓN Y RESPONSABILIDAD ==============
  
  idMatrizador: {
    type: DataTypes.INTEGER,
    field: 'id_matrizador',
    allowNull: true,
    references: {
      model: 'matrizadores',
      key: 'id'
    }
  },
  
  idUsuarioCreador: {
    type: DataTypes.INTEGER,
    field: 'id_usuario_creador',
    allowNull: true
  },
  
  rolUsuarioCreador: {
    type: DataTypes.ENUM('admin', 'matrizador', 'recepcion', 'caja'),
    field: 'rol_usuario_creador',
    allowNull: true
  },
  
  // ============== INFORMACIÓN FINANCIERA SIMPLIFICADA ==============
  
  numeroFactura: {
    type: DataTypes.STRING,
    field: 'numero_factura',
    allowNull: true
  },
  
  valorFactura: {
    type: DataTypes.DECIMAL(10, 2),
    field: 'valor_factura',
    allowNull: true
  },
  
  estadoPago: {
    type: DataTypes.ENUM('pagado', 'pendiente'),
    field: 'estado_pago',
    defaultValue: 'pendiente'
  },
  
  metodoPago: {
    type: DataTypes.ENUM('pendiente', 'efectivo', 'tarjeta_credito', 'tarjeta_debito', 'transferencia', 'otro'),
    field: 'metodo_pago',
    defaultValue: 'pendiente',
    allowNull: true
  },
  
  // Usuario que registró el pago (para auditoría)
  registradoPor: {
    type: DataTypes.INTEGER,
    field: 'registrado_por',
    allowNull: true,
    references: {
      model: 'matrizadores',
      key: 'id'
    }
  },
  
  // ============== CONFIGURACIÓN DE NOTIFICACIONES ==============
  
  omitirNotificacion: {
    type: DataTypes.BOOLEAN,
    field: 'omitir_notificacion',
    defaultValue: false
  },
  
  visto_por_matrizador: {
    type: DataTypes.BOOLEAN,
    field: 'visto_por_matrizador',
    defaultValue: false
  },
  
  motivoOmision: {
    type: DataTypes.ENUM('entrega_directa', 'parte_expediente', 'cliente_rechaza', 'otro'),
    field: 'motivo_omision',
    allowNull: true
  },
  
  detalleOmision: {
    type: DataTypes.TEXT,
    field: 'detalle_omision',
    allowNull: true
  },
  
  esDocumentoSecundario: {
    type: DataTypes.BOOLEAN,
    field: 'es_documento_secundario',
    defaultValue: false
  },
  
  // ============== SISTEMA DE NOTIFICACIONES AUTOMÁTICAS ==============
  
  // Control de notificación automática
  notificarAutomatico: {
    type: DataTypes.BOOLEAN,
    field: 'notificar_automatico',
    defaultValue: true,
    allowNull: false,
    comment: 'Indica si el documento debe ser notificado automáticamente cuando esté listo'
  },
  
  // Método de notificación preferido
  metodoNotificacion: {
    type: DataTypes.ENUM('whatsapp', 'email', 'ambos', 'ninguno'),
    field: 'metodo_notificacion',
    defaultValue: 'ambos',
    allowNull: false,
    comment: 'Método preferido para notificar al cliente'
  },
  
  // Referencia al documento principal (self-referencing)
  documentoPrincipalId: {
    type: DataTypes.INTEGER,
    field: 'documento_principal_id',
    allowNull: true,
    references: {
      model: 'documentos',
      key: 'id'
    },
    comment: 'ID del documento principal si este es un documento habilitante'
  },
  
  // Indica si es documento principal o habilitante
  esDocumentoPrincipal: {
    type: DataTypes.BOOLEAN,
    field: 'es_documento_principal',
    defaultValue: true,
    allowNull: false,
    comment: 'Indica si este documento es principal (true) o habilitante (false)',
    validate: {
      // Validación: si tiene documento_principal_id, no puede ser principal
      validarConsistencia() {
        if (this.documentoPrincipalId && this.esDocumentoPrincipal) {
          throw new Error('Un documento con documento_principal_id no puede ser documento principal');
        }
      }
    }
  },
  
  // Indica si fue entregado inmediatamente
  entregadoInmediatamente: {
    type: DataTypes.BOOLEAN,
    field: 'entregado_inmediatamente',
    defaultValue: false,
    allowNull: false,
    comment: 'Indica si el documento fue entregado inmediatamente sin necesidad de notificación',
    validate: {
      // Validación: si fue entregado inmediatamente, no debe notificar automáticamente
      validarEntregaInmediata() {
        if (this.entregadoInmediatamente && this.notificarAutomatico) {
          throw new Error('Si el documento fue entregado inmediatamente, no debe notificar automáticamente');
        }
      }
    }
  },
  
  // Razón específica para no notificar
  razonSinNotificar: {
    type: DataTypes.TEXT,
    field: 'razon_sin_notificar',
    allowNull: true,
    comment: 'Razón específica por la cual no se debe notificar este documento'
  },
  
  // ============== CAMPOS DE ELIMINACIÓN ==============
  
  motivoEliminacion: {
    type: DataTypes.ENUM('documento_duplicado', 'error_critico', 'nota_credito', 'cancelacion_cliente', 'otro'),
    field: 'motivo_eliminacion',
    allowNull: true
  },
  
  eliminadoPor: {
    type: DataTypes.INTEGER,
    field: 'eliminado_por',
    allowNull: true,
    references: {
      model: 'matrizadores',
      key: 'id'
    }
  },
  
  justificacionEliminacion: {
    type: DataTypes.TEXT,
    field: 'justificacion_eliminacion',
    allowNull: true
  }
}, {
  // Opciones del modelo SIMPLIFICADAS
  tableName: 'documentos',
  timestamps: true, // Automáticamente crea created_at y updated_at
  underscored: true, // Usa snake_case para los nombres de columnas
  createdAt: 'created_at', // Timestamp de cuándo se registró en el sistema
  updatedAt: 'updated_at'  // Timestamp de última modificación
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

// ============== NUEVAS RELACIONES PARA SISTEMA DE NOTIFICACIONES ==============

// Relación self-referencing para documento principal
Documento.belongsTo(Documento, {
  foreignKey: 'documentoPrincipalId',
  as: 'documentoPrincipal',
  constraints: false // Evita problemas de dependencias circulares
});

// Relación para documentos habilitantes
Documento.hasMany(Documento, {
  foreignKey: 'documentoPrincipalId',
  as: 'documentosHabilitantes',
  constraints: false
});

module.exports = Documento; 