/**
 * Modelo para la tabla de Contactos Locales
 * Sistema inteligente de contactos por cliente
 * Almacena histórico de números telefónicos por cliente
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ContactoLocal = sequelize.define('ContactoLocal', {
  // ID único del contacto
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  
  // Tipo de identificación del cliente
  tipoIdentificacion: {
    type: DataTypes.ENUM('cedula', 'pasaporte', 'ruc'),
    field: 'tipo_identificacion',
    allowNull: false,
    comment: 'Tipo de identificación: cedula (10 dígitos), RUC (13 dígitos), pasaporte (resto)'
  },
  
  // Número de identificación único
  numeroIdentificacion: {
    type: DataTypes.STRING(20),
    field: 'numero_identificacion',
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true
    },
    comment: 'Número de identificación único del cliente'
  },
  
  // Nombre completo del cliente
  nombreCompleto: {
    type: DataTypes.STRING(200),
    field: 'nombre_completo',
    allowNull: false,
    validate: {
      notEmpty: true
    },
    comment: 'Nombre completo del cliente para identificación'
  },
  
  // Número de contacto más utilizado
  contactoPrincipal: {
    type: DataTypes.STRING(15),
    field: 'contacto_principal',
    allowNull: false,
    validate: {
      notEmpty: true,
      // Validar formato de teléfono ecuatoriano
      isValidPhone(value) {
        const phoneRegex = /^[0-9]{10}$/;
        if (!phoneRegex.test(value)) {
          throw new Error('El contacto principal debe tener 10 dígitos numéricos');
        }
      }
    },
    comment: 'Número de teléfono más utilizado para este cliente'
  },
  
  // Cantidad de veces que se ha usado el contacto principal
  vecesUsadoPrincipal: {
    type: DataTypes.INTEGER,
    field: 'veces_usado_principal',
    allowNull: false,
    defaultValue: 1,
    validate: {
      min: 1
    },
    comment: 'Número de veces que se ha usado el contacto principal'
  },
  
  // Histórico de contactos utilizados (JSON)
  contactosHistoricos: {
    type: DataTypes.JSON,
    field: 'contactos_historicos',
    allowNull: false,
    defaultValue: [],
    comment: 'Array de objetos con histórico de contactos: [{numero, veces_usado, fecha_primer_uso, fecha_ultimo_uso}]'
  },
  
  // Último contacto utilizado
  ultimoContactoUsado: {
    type: DataTypes.STRING(15),
    field: 'ultimo_contacto_usado',
    allowNull: false,
    comment: 'Último número de contacto utilizado para este cliente'
  },
  
  // Fecha del último uso
  fechaUltimoUso: {
    type: DataTypes.DATE,
    field: 'fecha_ultimo_uso',
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: 'Fecha y hora del último uso de contacto'
  },
  
  // Matrizador que más frecuentemente atiende a este cliente
  matrizadorFrecuente: {
    type: DataTypes.STRING(100),
    field: 'matrizador_frecuente',
    allowNull: true,
    comment: 'Nombre del matrizador que más frecuentemente atiende a este cliente'
  },
  
  // Notas adicionales sobre el contacto
  notas: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Notas adicionales sobre el cliente o sus contactos'
  },
  
  // Indica si el contacto está activo
  activo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: 'Indica si el contacto está activo en el sistema'
  }
}, {
  // Opciones del modelo
  tableName: 'contactos_locales',
  timestamps: true, // Crea automáticamente createdAt y updatedAt
  underscored: true, // Usa snake_case para los nombres de columnas
  
  // Índices para optimizar consultas
  indexes: [
    {
      unique: true,
      fields: ['numero_identificacion']
    },
    {
      fields: ['tipo_identificacion']
    },
    {
      fields: ['contacto_principal']
    },
    {
      fields: ['fecha_ultimo_uso']
    },
    {
      fields: ['activo']
    }
  ],
  
  // Hooks del modelo
  hooks: {
    // Antes de crear, determinar tipo de identificación automáticamente
    beforeCreate: (contacto, options) => {
      if (!contacto.tipoIdentificacion) {
        contacto.tipoIdentificacion = determinarTipoIdentificacion(contacto.numeroIdentificacion);
      }
      if (!contacto.ultimoContactoUsado) {
        contacto.ultimoContactoUsado = contacto.contactoPrincipal;
      }
    },
    
    // Antes de actualizar, validar consistencia
    beforeUpdate: (contacto, options) => {
      if (contacto.changed('numeroIdentificacion')) {
        contacto.tipoIdentificacion = determinarTipoIdentificacion(contacto.numeroIdentificacion);
      }
    }
  }
});

/**
 * Determina el tipo de identificación basado en el número
 * @param {string} numeroIdentificacion - Número de identificación
 * @returns {string} - Tipo de identificación
 */
function determinarTipoIdentificacion(numeroIdentificacion) {
  if (!numeroIdentificacion) return 'pasaporte';
  
  const numero = numeroIdentificacion.toString().trim();
  
  if (numero.length === 10 && /^\d{10}$/.test(numero)) {
    return 'cedula';
  } else if (numero.length === 13 && /^\d{13}$/.test(numero)) {
    return 'ruc';
  } else {
    return 'pasaporte';
  }
}

/**
 * Métodos de instancia del modelo
 */
ContactoLocal.prototype.agregarContactoHistorico = function(numeroContacto, fechaUso = new Date()) {
  // Obtener histórico actual
  let historicos = this.contactosHistoricos || [];
  
  // Buscar si el contacto ya existe en el histórico
  const existente = historicos.find(h => h.numero === numeroContacto);
  
  if (existente) {
    // Actualizar contacto existente
    existente.veces_usado++;
    existente.fecha_ultimo_uso = fechaUso;
  } else {
    // Agregar nuevo contacto al histórico
    historicos.push({
      numero: numeroContacto,
      veces_usado: 1,
      fecha_primer_uso: fechaUso,
      fecha_ultimo_uso: fechaUso
    });
  }
  
  // Actualizar el modelo
  this.contactosHistoricos = historicos;
  this.ultimoContactoUsado = numeroContacto;
  this.fechaUltimoUso = fechaUso;
  
  // Determinar si este contacto debe ser el principal
  const contactoMasFrecuente = historicos.reduce((max, current) => 
    current.veces_usado > max.veces_usado ? current : max
  );
  
  if (contactoMasFrecuente.numero !== this.contactoPrincipal) {
    this.contactoPrincipal = contactoMasFrecuente.numero;
    this.vecesUsadoPrincipal = contactoMasFrecuente.veces_usado;
  } else if (contactoMasFrecuente.numero === this.contactoPrincipal) {
    this.vecesUsadoPrincipal = contactoMasFrecuente.veces_usado;
  }
};

/**
 * Obtiene estadísticas del contacto
 */
ContactoLocal.prototype.obtenerEstadisticas = function() {
  const historicos = this.contactosHistoricos || [];
  const totalContactos = historicos.length;
  const totalUsos = historicos.reduce((sum, h) => sum + h.veces_usado, 0);
  
  return {
    totalContactos,
    totalUsos,
    contactoPrincipal: this.contactoPrincipal,
    vecesUsadoPrincipal: this.vecesUsadoPrincipal,
    porcentajeUsoContactoPrincipal: totalUsos > 0 ? ((this.vecesUsadoPrincipal / totalUsos) * 100).toFixed(1) : 0,
    ultimoContacto: this.ultimoContactoUsado,
    fechaUltimoUso: this.fechaUltimoUso
  };
};

/**
 * Métodos estáticos del modelo
 */

/**
 * Busca un contacto por número de identificación
 * @param {string} numeroIdentificacion - Número de identificación
 * @returns {Promise<ContactoLocal|null>} - Contacto encontrado o null
 */
ContactoLocal.buscarPorIdentificacion = async function(numeroIdentificacion) {
  return await this.findOne({
    where: {
      numeroIdentificacion: numeroIdentificacion.toString().trim(),
      activo: true
    }
  });
};

/**
 * Crea o actualiza un contacto
 * @param {Object} datosContacto - Datos del contacto
 * @returns {Promise<ContactoLocal>} - Contacto creado o actualizado
 */
ContactoLocal.crearOActualizar = async function(datosContacto) {
  const { numeroIdentificacion, nombreCompleto, numeroContacto, matrizador } = datosContacto;
  
  // Buscar contacto existente
  let contacto = await this.buscarPorIdentificacion(numeroIdentificacion);
  
  if (contacto) {
    // Actualizar contacto existente
    contacto.agregarContactoHistorico(numeroContacto);
    if (matrizador) {
      contacto.matrizadorFrecuente = matrizador;
    }
    await contacto.save();
    await contacto.reload(); // Recargar para obtener datos actualizados
  } else {
    // Crear nuevo contacto
    const numeroIdLimpio = numeroIdentificacion.toString().trim();
    contacto = await this.create({
      numeroIdentificacion: numeroIdLimpio,
      tipoIdentificacion: determinarTipoIdentificacion(numeroIdLimpio),
      nombreCompleto: nombreCompleto.trim(),
      contactoPrincipal: numeroContacto,
      ultimoContactoUsado: numeroContacto,
      matrizadorFrecuente: matrizador || null,
      contactosHistoricos: [{
        numero: numeroContacto,
        veces_usado: 1,
        fecha_primer_uso: new Date(),
        fecha_ultimo_uso: new Date()
      }]
    });
  }
  
  return contacto;
};

module.exports = ContactoLocal; 