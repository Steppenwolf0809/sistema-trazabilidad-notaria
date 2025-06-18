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
    comment: 'Timestamp de cuando se registró el pago en el sistema (LEGACY - usar fechaUltimoPago)'
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
    type: DataTypes.ENUM('titular', 'representante_legal', 'apoderado', 'familiar', 'empleado', 'tercero_autorizado'),
    field: 'relacion_receptor',
    allowNull: true,
    comment: 'Relación del receptor con el cliente: titular, representante_legal, apoderado, familiar, empleado, tercero_autorizado'
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
    type: DataTypes.ENUM('admin', 'matrizador', 'recepcion', 'caja', 'caja_archivo', 'archivo'),
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
  
  // ============== NUEVOS CAMPOS PARA SISTEMA DE PAGOS CON RETENCIONES ==============
  
  // Información de pagos
  valorPagado: {
    type: DataTypes.DECIMAL(10, 2),
    field: 'valor_pagado',
    defaultValue: 0.00,
    allowNull: false,
    comment: 'Monto total pagado por el cliente'
  },
  
  valorPendiente: {
    type: DataTypes.DECIMAL(10, 2),
    field: 'valor_pendiente',
    defaultValue: 0.00,
    allowNull: false,
    comment: 'Monto pendiente de pago - Se calcula automáticamente como valorFactura - valorPagado - valorRetenido'
  },
  
  estadoPago: {
    type: DataTypes.ENUM('pendiente', 'pago_parcial', 'pagado_completo', 'pagado_con_retencion'),
    field: 'estado_pago',
    defaultValue: 'pendiente',
    comment: 'Estado detallado del pago del documento'
  },
  
  fechaUltimoPago: {
    type: DataTypes.DATE,
    field: 'fecha_ultimo_pago',
    allowNull: true,
    comment: 'Timestamp del último pago registrado'
  },
  
  // Información de retenciones
  tieneRetencion: {
    type: DataTypes.BOOLEAN,
    field: 'tiene_retencion',
    defaultValue: false,
    allowNull: false,
    comment: 'Indica si el documento tiene retención asociada'
  },
  
  numeroComprobanteRetencion: {
    type: DataTypes.STRING(50),
    field: 'numero_comprobante_retencion',
    allowNull: true,
    comment: 'Número del comprobante de retención'
  },
  
  valorRetenido: {
    type: DataTypes.DECIMAL(10, 2),
    field: 'valor_retenido',
    defaultValue: 0.00,
    allowNull: false,
    comment: 'Monto total retenido'
  },
  
  retencionIva: {
    type: DataTypes.DECIMAL(10, 2),
    field: 'retencion_iva',
    defaultValue: 0.00,
    allowNull: false,
    comment: 'Monto de retención de IVA'
  },
  
  retencionRenta: {
    type: DataTypes.DECIMAL(10, 2),
    field: 'retencion_renta',
    defaultValue: 0.00,
    allowNull: false,
    comment: 'Monto de retención de renta'
  },
  
  rucEmpresaRetenedora: {
    type: DataTypes.STRING(13),
    field: 'ruc_empresa_retenedora',
    allowNull: true,
    comment: 'RUC de la empresa que realiza la retención'
  },
  
  razonSocialRetenedora: {
    type: DataTypes.STRING(200),
    field: 'razon_social_retenedora',
    allowNull: true,
    comment: 'Razón social de la empresa que retiene'
  },
  
  fechaRetencion: {
    type: DataTypes.DATE,
    field: 'fecha_retencion',
    allowNull: true,
    comment: 'Fecha de la retención'
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
  
  // Método de notificación preferido - SIMPLIFICADO A SOLO WHATSAPP
  metodoNotificacion: {
    type: DataTypes.ENUM('whatsapp', 'ninguno'),
    field: 'metodo_notificacion',
    defaultValue: 'whatsapp',
    allowNull: false,
    comment: 'Método preferido para notificar al cliente - Solo WhatsApp o ninguno'
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
  },
  
  // ============== CAMPOS LEGACY MANTENIDOS PARA COMPATIBILIDAD ==============
  
  metodoPago: {
    type: DataTypes.ENUM('pendiente', 'efectivo', 'tarjeta_credito', 'tarjeta_debito', 'transferencia', 'cheque', 'otro'),
    field: 'metodo_pago',
    defaultValue: 'pendiente',
    allowNull: true,
    comment: 'Método de pago principal (LEGACY - ver tabla pagos para detalle completo)'
  },
  
  // Usuario que registró el pago (para auditoría)
  registradoPor: {
    type: DataTypes.INTEGER,
    field: 'registrado_por',
    allowNull: true,
    references: {
      model: 'matrizadores',
      key: 'id'
    },
    comment: 'Usuario que registró el último pago (LEGACY)'
  },
}, {
  // Opciones del modelo SIMPLIFICADAS
  tableName: 'documentos',
  timestamps: true, // Automáticamente crea created_at y updated_at
  underscored: true, // Usa snake_case para los nombres de columnas
  createdAt: 'created_at', // Timestamp de cuándo se registró en el sistema
  updatedAt: 'updated_at',  // Timestamp de última modificación
  
  // HOOKS PARA CÁLCULO AUTOMÁTICO DE VALOR PENDIENTE
  hooks: {
    beforeCreate: (documento, options) => {
      calcularValorPendiente(documento);
    },
    beforeUpdate: (documento, options) => {
      calcularValorPendiente(documento);
    },
    beforeSave: (documento, options) => {
      calcularValorPendiente(documento);
    }
  }
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

// ============== FUNCIÓN AUXILIAR PARA CÁLCULO AUTOMÁTICO ==============

/**
 * Calcula automáticamente el valor pendiente de un documento
 * valorPendiente = valorFactura - valorPagado - valorRetenido
 */
function calcularValorPendiente(documento) {
  const valorFactura = parseFloat(documento.valorFactura) || 0;
  const valorPagado = parseFloat(documento.valorPagado) || 0;
  const valorRetenido = parseFloat(documento.valorRetenido) || 0;
  
  // Calcular valor pendiente
  const valorPendienteCalculado = Math.max(0, valorFactura - valorPagado - valorRetenido);
  
  // Asignar el valor calculado
  documento.valorPendiente = valorPendienteCalculado;
  
  console.log(`🧮 Cálculo automático valorPendiente para documento ${documento.id || 'NUEVO'}:`, {
    valorFactura,
    valorPagado,
    valorRetenido,
    valorPendienteCalculado
  });
}

module.exports = Documento; 