/**
 * Modelo para gestionar notificaciones grupales por cliente
 * Una notificación grupal agrupa documentos del mismo cliente con un código único
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const NotificacionGrupal = sequelize.define('NotificacionGrupal', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  
  // Código de verificación único de 4 dígitos para todo el grupo
  codigoVerificacion: {
    type: DataTypes.STRING(4),
    field: 'codigo_verificacion',
    unique: true,
    allowNull: false,
    validate: {
      isNumeric: true,
      len: [4, 4]
    },
    comment: 'Código único de 4 dígitos válido para todos los documentos del grupo'
  },
  
  // Información del cliente
  clienteNombre: {
    type: DataTypes.STRING,
    field: 'cliente_nombre',
    allowNull: false,
    comment: 'Nombre del cliente propietario de todos los documentos del grupo'
  },
  
  clienteIdentificacion: {
    type: DataTypes.STRING,
    field: 'cliente_identificacion',
    allowNull: false,
    comment: 'Identificación del cliente (cédula/RUC/pasaporte)'
  },
  
  clienteTelefono: {
    type: DataTypes.STRING,
    field: 'cliente_telefono',
    allowNull: true,
    comment: 'Número de teléfono del cliente para WhatsApp'
  },
  
  clienteEmail: {
    type: DataTypes.STRING,
    field: 'cliente_email',
    allowNull: true,
    validate: {
      isEmail: true
    },
    comment: 'Email del cliente para notificaciones'
  },
  
  // Estado del grupo de notificación
  estado: {
    type: DataTypes.ENUM('pendiente', 'enviada', 'entregada', 'cancelada'),
    defaultValue: 'pendiente',
    allowNull: false,
    comment: 'Estado: pendiente=creada pero no enviada, enviada=notificación enviada, entregada=documentos entregados, cancelada=grupo disuelto'
  },
  
  // Información de la notificación enviada
  mensajeEnviado: {
    type: DataTypes.TEXT,
    field: 'mensaje_enviado',
    allowNull: true,
    comment: 'Contenido del mensaje WhatsApp enviado al cliente'
  },
  
  fechaEnvio: {
    type: DataTypes.DATE,
    field: 'fecha_envio',
    allowNull: true,
    comment: 'Timestamp de cuando se envió la notificación'
  },
  
  // Metadatos del grupo
  totalDocumentos: {
    type: DataTypes.INTEGER,
    field: 'total_documentos',
    defaultValue: 0,
    allowNull: false,
    comment: 'Número total de documentos en el grupo'
  },
  
  // Información del matrizador responsable
  matrizadorId: {
    type: DataTypes.INTEGER,
    field: 'matrizador_id',
    allowNull: false,
    references: {
      model: 'matrizadores',
      key: 'id'
    },
    comment: 'ID del matrizador que creó/maneja el grupo'
  },
  
  // Metadatos adicionales
  metadatos: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {},
    comment: 'Información adicional: tipos de documentos, fechas, etc.'
  }
}, {
  tableName: 'notificaciones_grupales',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['codigo_verificacion']
    },
    {
      fields: ['cliente_identificacion', 'matrizador_id']
    },
    {
      fields: ['estado']
    }
  ]
});

// ============== MÉTODOS DE INSTANCIA ==============

/**
 * Genera un nuevo código de verificación único
 * @returns {string} Código de 4 dígitos
 */
NotificacionGrupal.prototype.generarCodigoVerificacion = async function() {
  let codigo;
  let existe = true;
  
  // Generar código único
  while (existe) {
    codigo = Math.floor(1000 + Math.random() * 9000).toString();
    const codigoExistente = await NotificacionGrupal.findOne({
      where: { codigoVerificacion: codigo }
    });
    existe = !!codigoExistente;
  }
  
  this.codigoVerificacion = codigo;
  return codigo;
};

/**
 * Verifica si el grupo puede ser modificado
 * @returns {boolean} True si puede modificarse
 */
NotificacionGrupal.prototype.puedeModificarse = function() {
  // Permitir modificar grupos pendientes y cancelados
  // Solo los grupos "enviada" y "entregada" no pueden modificarse
  return ['pendiente', 'cancelada'].includes(this.estado);
};

/**
 * Marca el grupo como enviado
 * @param {string} mensaje - Mensaje que se envió
 */
NotificacionGrupal.prototype.marcarComoEnviada = async function(mensaje) {
  this.estado = 'enviada';
  this.mensajeEnviado = mensaje;
  this.fechaEnvio = new Date();
  await this.save();
};

/**
 * Marca el grupo como entregado
 */
NotificacionGrupal.prototype.marcarComoEntregada = async function() {
  this.estado = 'entregada';
  await this.save();
};

/**
 * Cancela el grupo de notificación
 */
NotificacionGrupal.prototype.cancelar = async function() {
  this.estado = 'cancelada';
  await this.save();
};

// ============== MÉTODOS ESTÁTICOS ==============

/**
 * Busca un grupo por código de verificación
 * @param {string} codigo - Código de verificación
 * @returns {Promise<NotificacionGrupal>} Grupo encontrado o null
 */
NotificacionGrupal.buscarPorCodigo = async function(codigo) {
  return await this.findOne({
    where: { 
      codigoVerificacion: codigo,
      estado: ['pendiente', 'enviada'] // Solo grupos activos
    },
    include: [{
      model: sequelize.models.Documento,
      as: 'documentos',
      where: { estado: ['listo_para_entrega', 'entregado'] }
    }]
  });
};

/**
 * Crea un nuevo grupo de notificación
 * @param {Object} datos - Datos del grupo
 * @returns {Promise<NotificacionGrupal>} Grupo creado
 */
NotificacionGrupal.crearGrupo = async function(datos) {
  console.log('🎯 [CREAR GRUPO] Datos recibidos:', datos);
  
  // Generar código de verificación primero
  let codigoVerificacion;
  let existe = true;
  
  // Generar código único
  while (existe) {
    codigoVerificacion = Math.floor(1000 + Math.random() * 9000).toString();
    const codigoExistente = await this.findOne({
      where: { codigoVerificacion: codigoVerificacion }
    });
    existe = !!codigoExistente;
  }
  
  console.log('🔢 [CREAR GRUPO] Código generado:', codigoVerificacion);
  
  // Crear el grupo con el código ya generado
  const grupo = await this.create({
    clienteNombre: datos.clienteNombre,
    clienteIdentificacion: datos.clienteIdentificacion,
    clienteTelefono: datos.clienteTelefono,
    clienteEmail: datos.clienteEmail,
    codigoVerificacion: codigoVerificacion, // ✅ Incluir el código en la creación
    matrizadorId: datos.matrizadorId,
    totalDocumentos: datos.totalDocumentos || 0,
    metadatos: datos.metadatos || {}
  });
  
  console.log('✅ [CREAR GRUPO] Grupo creado exitosamente:', {
    id: grupo.id,
    codigo: grupo.codigoVerificacion,
    cliente: grupo.clienteNombre
  });
  
  return grupo;
};

// ============== RELACIONES ==============

// Configurar relaciones después de la definición del modelo
NotificacionGrupal.associate = function(models) {
  // Un grupo de notificación pertenece a un matrizador
  NotificacionGrupal.belongsTo(models.Matrizador, {
    foreignKey: 'matrizadorId',
    as: 'matrizador'
  });
  
  // Un grupo de notificación tiene muchos documentos
  NotificacionGrupal.hasMany(models.Documento, {
    foreignKey: 'notificacionGrupalId',
    as: 'documentos'
  });
};

module.exports = NotificacionGrupal; 