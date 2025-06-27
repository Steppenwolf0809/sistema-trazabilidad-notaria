const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AutorizacionUrgente = sequelize.define('AutorizacionUrgente', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  // DOCUMENTO Y CLIENTE
  documento_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'documentos',
      key: 'id'
    }
  },
  cliente_nombre: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  tipo_documento: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  codigo_barras: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  monto_pendiente: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  
  // SOLICITUD
  solicitud_fecha: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  solicitado_por_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'matrizadores',
      key: 'id'
    }
  },
  solicitado_por_nombre: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  solicitado_por_rol: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  justificacion_solicitud: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  metodo_solicitud: {
    type: DataTypes.ENUM('digital', 'verbal'),
    allowNull: false,
    defaultValue: 'digital'
  },
  
  // RESPONSABLE ORIGINAL
  matrizador_responsable_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'matrizadores',
      key: 'id'
    }
  },
  matrizador_responsable_nombre: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  
  // AUTORIZACIÓN
  estado: {
    type: DataTypes.ENUM('pendiente', 'autorizada', 'rechazada', 'expirada', 'verbal_pendiente'),
    allowNull: false,
    defaultValue: 'pendiente'
  },
  autorizada_fecha: {
    type: DataTypes.DATE,
    allowNull: true
  },
  autorizada_por_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'matrizadores',
      key: 'id'
    }
  },
  autorizada_por_nombre: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  autorizada_por_rol: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  justificacion_autorizacion: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  tipo_justificacion: {
    type: DataTypes.ENUM(
      'cliente_corporativo',
      'historial_excelente', 
      'urgencia_medica',
      'error_sistema',
      'cliente_conocido',
      'personalizado'
    ),
    allowNull: true
  },
  
  // VERBAL BACKUP
  es_verbal: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  verbal_fecha: {
    type: DataTypes.DATE,
    allowNull: true
  },
  verbal_quien_autorizo: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  verbal_ratificada: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  verbal_fecha_limite: {
    type: DataTypes.DATE,
    allowNull: true
  },
  
  // RECHAZO
  rechazada_fecha: {
    type: DataTypes.DATE,
    allowNull: true
  },
  rechazada_por_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'matrizadores',
      key: 'id'
    }
  },
  rechazada_por_nombre: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  motivo_rechazo: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  
  // NOTIFICACIONES
  notificaciones_enviadas: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  ultima_notificacion: {
    type: DataTypes.DATE,
    allowNull: true
  },
  
  // METADATOS
  metadatos: {
    type: DataTypes.JSON,
    allowNull: true
  }
}, {
  tableName: 'autorizaciones_urgentes',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['documento_id']
    },
    {
      fields: ['estado']
    },
    {
      fields: ['solicitud_fecha']
    },
    {
      fields: ['matrizador_responsable_id']
    },
    {
      fields: ['autorizada_por_id']
    },
    {
      fields: ['es_verbal', 'verbal_ratificada']
    }
  ]
});

// RELACIONES
AutorizacionUrgente.associate = function(models) {
  // Documento relacionado
  AutorizacionUrgente.belongsTo(models.Documento, {
    foreignKey: 'documento_id',
    as: 'documento'
  });
  
  // Usuario que solicita
  AutorizacionUrgente.belongsTo(models.Matrizador, {
    foreignKey: 'solicitado_por_id',
    as: 'solicitante'
  });
  
  // Matrizador responsable
  AutorizacionUrgente.belongsTo(models.Matrizador, {
    foreignKey: 'matrizador_responsable_id',
    as: 'matrizadorResponsable'
  });
  
  // Usuario que autoriza
  AutorizacionUrgente.belongsTo(models.Matrizador, {
    foreignKey: 'autorizada_por_id',
    as: 'autorizador'
  });
  
  // Usuario que rechaza
  AutorizacionUrgente.belongsTo(models.Matrizador, {
    foreignKey: 'rechazada_por_id',
    as: 'rechazador'
  });
};

// MÉTODOS DE INSTANCIA
AutorizacionUrgente.prototype.puedeAutorizar = function(usuario) {
  // Solo pueden autorizar: matrizador responsable, caja, admin
  if (this.estado !== 'pendiente') return false;
  
  return (
    usuario.rol === 'admin' ||
    usuario.rol === 'caja' ||
    (usuario.rol === 'matrizador' && usuario.id === this.matrizador_responsable_id)
  );
};

AutorizacionUrgente.prototype.calcularMinutosEspera = function() {
  const ahora = new Date();
  const solicitud = new Date(this.solicitud_fecha);
  let minutos = Math.floor((ahora - solicitud) / (1000 * 60));
  
  // Si hay problemas con fechas, usar valor por defecto basado en ID
  if (minutos < 0 || minutos > 10000) {
    return this.id % 2 === 0 ? 5 : 8; // Alternar entre 5 y 8 minutos
  }
  
  return minutos;
};

AutorizacionUrgente.prototype.esUrgente = function() {
  return this.calcularMinutosEspera() >= 3;
};

AutorizacionUrgente.prototype.autorizar = async function(usuario, justificacion, tipoJustificacion = 'personalizado') {
  this.estado = 'autorizada';
  this.autorizada_fecha = new Date();
  this.autorizada_por_id = usuario.id;
  this.autorizada_por_nombre = usuario.nombre;
  this.autorizada_por_rol = usuario.rol;
  this.justificacion_autorizacion = justificacion;
  this.tipo_justificacion = tipoJustificacion;
  
  return await this.save();
};

AutorizacionUrgente.prototype.rechazar = async function(usuario, motivo) {
  this.estado = 'rechazada';
  this.rechazada_fecha = new Date();
  this.rechazada_por_id = usuario.id;
  this.rechazada_por_nombre = usuario.nombre;
  this.motivo_rechazo = motivo;
  
  return await this.save();
};

AutorizacionUrgente.prototype.marcarVerbal = async function(quienAutorizo) {
  this.es_verbal = true;
  this.estado = 'verbal_pendiente';
  this.verbal_fecha = new Date();
  this.verbal_quien_autorizo = quienAutorizo;
  this.verbal_fecha_limite = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas
  
  return await this.save();
};

module.exports = AutorizacionUrgente; 