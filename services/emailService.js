/**
 * Servicio de correo electrónico
 * Gestiona el envío de correos electrónicos para notificaciones del sistema
 */

const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');
const handlebars = require('handlebars');
const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

// Configuración del transportador de correo
let transporter;

// Modelo para almacenar correos pendientes en caso de fallo
const EmailPendiente = sequelize.define('EmailPendiente', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  destinatario: {
    type: DataTypes.STRING,
    allowNull: false
  },
  asunto: {
    type: DataTypes.STRING,
    allowNull: false
  },
  contenido: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  datosAdjuntos: {
    type: DataTypes.JSON,
    allowNull: true
  },
  intentos: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  ultimoError: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  estado: {
    type: DataTypes.ENUM('pendiente', 'enviado', 'fallido'),
    defaultValue: 'pendiente'
  }
}, {
  tableName: 'emails_pendientes',
  timestamps: true,
  underscored: true
});

/**
 * Inicializa el servicio de correo
 */
const inicializar = () => {
  try {
    // Crear el transportador de nodemailer
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_PORT === '465', // true para puerto 465
      auth: {
        user: process.env.EMAIL_USER || 'correo@notaria.com',
        pass: process.env.EMAIL_PASS || 'contraseña'
      }
    });
    
    console.log('✅ Servicio de correo electrónico inicializado correctamente');
    
    // Iniciar proceso de reenvío de correos pendientes
    if (process.env.NODE_ENV === 'production') {
      console.log('✉️ Iniciando cola de reintento de correos pendientes');
      setInterval(reintentarCorreosPendientes, 5 * 60 * 1000); // Cada 5 minutos
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error al inicializar servicio de correo:', error);
    return false;
  }
};

/**
 * Lee una plantilla de correo y la compila con Handlebars
 * @param {string} nombrePlantilla - Nombre del archivo de plantilla sin extensión
 * @param {Object} datos - Datos para la plantilla
 * @returns {Promise<string>} HTML del correo compilado
 */
const compilarPlantilla = async (nombrePlantilla, datos) => {
  try {
    // Ruta a la plantilla
    const rutaPlantilla = path.join(__dirname, '../views/emails', `${nombrePlantilla}.hbs`);
    
    // Leer el archivo de plantilla
    const contenido = await fs.readFile(rutaPlantilla, 'utf-8');
    
    // Compilar la plantilla con Handlebars
    const plantilla = handlebars.compile(contenido);
    
    // Renderizar la plantilla con los datos
    return plantilla({
      ...datos,
      baseUrl: process.env.BASE_URL || 'https://servidor-local.notaria:3000',
      currentYear: new Date().getFullYear()
    });
  } catch (error) {
    console.error(`Error al compilar plantilla ${nombrePlantilla}:`, error);
    throw error;
  }
};

/**
 * Envía un correo electrónico
 * @param {string} destinatario - Dirección de correo del destinatario
 * @param {string} asunto - Asunto del correo
 * @param {string} contenidoHtml - Contenido HTML del correo
 * @param {Object} adjuntos - Archivos adjuntos (opcional)
 * @returns {Promise<boolean>} Resultado del envío
 */
const enviarCorreo = async (destinatario, asunto, contenidoHtml, adjuntos = null) => {
  try {
    // Verificar configuración de envío real
    const envioRealHabilitado = process.env.EMAIL_ENVIO_REAL === 'true' || process.env.NODE_ENV === 'production';
    
    // MODO DESARROLLO: Simular envío exitoso
    if (!envioRealHabilitado || !transporter) {
      console.log('📧 [DESARROLLO] Email simulado enviado:');
      console.log(`   Para: ${destinatario}`);
      console.log(`   Asunto: ${asunto}`);
      console.log(`   Contenido: ${contenidoHtml.substring(0, 100)}...`);
      
      return {
        messageId: `dev-email-${Date.now()}`,
        response: 'Email simulado en desarrollo',
        simulado: true
      };
    }
    
    // MODO PRODUCCIÓN: Envío real
    const opcionesCorreo = {
      from: process.env.EMAIL_FROM || 'Notaría <correo@notaria.com>',
      to: destinatario,
      subject: asunto,
      html: contenidoHtml
    };
    
    // Agregar adjuntos si existen
    if (adjuntos) {
      opcionesCorreo.attachments = adjuntos;
    }
    
    // Enviar el correo
    const info = await transporter.sendMail(opcionesCorreo);
    
    console.log(`✉️ Correo enviado: ${info.messageId}`);
    return {
      messageId: info.messageId,
      response: info.response,
      simulado: false
    };
  } catch (error) {
    console.error('❌ Error al enviar correo:', error);
    
    // En desarrollo, no guardar en pendientes, solo simular
    if (process.env.NODE_ENV !== 'production') {
      console.log('📧 [DESARROLLO] Error simulado, continuando...');
      return {
        messageId: `dev-error-${Date.now()}`,
        response: 'Error simulado en desarrollo',
        simulado: true,
        error: error.message
      };
    }
    
    // En producción, guardar el correo en la lista de pendientes
    try {
      await EmailPendiente.create({
        destinatario,
        asunto,
        contenido: contenidoHtml,
        datosAdjuntos: adjuntos,
        ultimoError: error.message
      });
      console.log('📥 Correo guardado en cola de pendientes para reintento');
    } catch (dbError) {
      console.error('Error al guardar correo en pendientes:', dbError);
    }
    
    return false;
  }
};

/**
 * Reintenta enviar los correos pendientes
 */
const reintentarCorreosPendientes = async () => {
  try {
    // Buscar correos pendientes con menos de 5 intentos
    const correosPendientes = await EmailPendiente.findAll({
      where: {
        estado: 'pendiente',
        intentos: { [sequelize.Op.lt]: 5 }
      },
      limit: 10 // Procesar en lotes pequeños
    });
    
    console.log(`📨 Reintentando envío de ${correosPendientes.length} correos pendientes`);
    
    // Procesar cada correo pendiente
    for (const email of correosPendientes) {
      try {
        // Incrementar contador de intentos
        email.intentos += 1;
        
        // Enviar el correo
        const resultado = await transporter.sendMail({
          from: process.env.EMAIL_FROM || 'Notaría <correo@notaria.com>',
          to: email.destinatario,
          subject: email.asunto,
          html: email.contenido,
          attachments: email.datosAdjuntos
        });
        
        // Actualizar estado a enviado
        email.estado = 'enviado';
        await email.save();
        
        console.log(`✅ Correo pendiente ID ${email.id} enviado correctamente: ${resultado.messageId}`);
      } catch (error) {
        console.error(`❌ Error al reenviar correo ID ${email.id}:`, error);
        
        // Actualizar estado si supera el máximo de intentos
        if (email.intentos >= 5) {
          email.estado = 'fallido';
        }
        
        email.ultimoError = error.message;
        await email.save();
      }
    }
  } catch (error) {
    console.error('Error en proceso de reintento de correos:', error);
  }
};

/**
 * Envía una notificación de documento listo para entrega
 * @param {Object} documento - Datos del documento
 * @param {Object} cliente - Datos del cliente
 * @returns {Promise<Object>} Resultado del envío
 */
const enviarNotificacionDocumentoListo = async (documento, cliente) => {
  try {
    // Verificar si el cliente tiene correo
    if (!cliente.email) {
      console.warn(`Cliente ${cliente.nombre} no tiene correo para notificación`);
      return {
        exito: false,
        error: 'Cliente no tiene correo electrónico',
        destinatario: null,
        timestamp: new Date().toISOString()
      };
    }
    
    // Verificar configuración de envío real
    const envioRealHabilitado = process.env.EMAIL_ENVIO_REAL === 'true' || process.env.NODE_ENV === 'production';
    
    // Modo desarrollo - simular envío SOLO si no está habilitado el envío real
    if (!envioRealHabilitado) {
      const mensaje = `Su documento ${documento.tipoDocumento} está listo para retirar. Código: ${documento.codigoBarras}`;
      console.log(`[SIMULADO] 📧 Email a ${cliente.email}:`);
      console.log(`   Asunto: Documento listo para entrega - ${documento.tipoDocumento}`);
      console.log(`   Mensaje: ${mensaje}`);
      console.log(`[DESARROLLO] Notificación Email registrada sin envío real`);
      
      return {
        exito: true,
        simulado: true,
        destinatario: cliente.email,
        mensaje: mensaje,
        timestamp: new Date().toISOString()
      };
    }
    
    // ============== ENVÍO REAL ACTIVADO ==============
    console.log(`📧 [REAL] Enviando email a ${cliente.email} para documento ${documento.codigoBarras}`);
    
    // Compilar la plantilla con los datos del documento y cliente
    const contenidoHtml = await compilarPlantilla('documento-listo', {
      documento,
      cliente,
      fechaDisponible: new Date().toLocaleDateString('es-ES'),
      urlVerificacion: `${process.env.BASE_URL || 'https://servidor-local.notaria:3000'}/verificar?codigo=${documento.codigoBarras}`
    });
    
    // Enviar el correo
    const resultado = await enviarCorreo(
      cliente.email,
      `Documento listo para entrega - ${documento.tipoDocumento}`,
      contenidoHtml
    );
    
    if (resultado) {
      console.log(`✅ [REAL] Email enviado exitosamente a ${cliente.email}`);
    } else {
      console.log(`❌ [REAL] Error al enviar email a ${cliente.email}`);
    }
    
    return {
      exito: resultado,
      simulado: false,
      destinatario: cliente.email,
      mensaje: contenidoHtml,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error al enviar notificación de documento listo:', error);
    return {
      exito: false,
      error: error.message,
      destinatario: cliente.email,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Envía una confirmación de entrega de documento
 * @param {Object} documento - Datos del documento
 * @param {Object} cliente - Datos del cliente
 * @param {Object} datosEntrega - Datos de la entrega
 * @returns {Promise<Object>} Resultado del envío
 */
const enviarConfirmacionEntrega = async (documento, cliente, datosEntrega) => {
  try {
    // Verificar si el cliente tiene correo
    if (!cliente.email) {
      console.warn(`Cliente ${cliente.nombre} no tiene correo para confirmación`);
      return {
        exito: false,
        error: 'Cliente no tiene correo electrónico',
        destinatario: null,
        timestamp: new Date().toISOString()
      };
    }
    
    // Modo desarrollo - simular envío
    if (process.env.NODE_ENV !== 'production') {
      const fechaEntrega = new Date(datosEntrega.fechaEntrega || new Date()).toLocaleDateString('es-CO');
      const mensaje = `Documento ${documento.tipoDocumento} entregado a ${datosEntrega.nombreReceptor} el ${fechaEntrega}`;
      console.log(`[SIMULADO] 📧 Email confirmación a ${cliente.email}:`);
      console.log(`   Asunto: Confirmación de entrega - ${documento.tipoDocumento}`);
      console.log(`   Mensaje: ${mensaje}`);
      console.log(`[DESARROLLO] Confirmación Email registrada sin envío real`);
      
      return {
        exito: true,
        simulado: true,
        destinatario: cliente.email,
        mensaje: mensaje,
        timestamp: new Date().toISOString()
      };
    }
    
    // Compilar la plantilla con los datos
    const contenidoHtml = await compilarPlantilla('confirmacion-entrega', {
      documento,
      cliente,
      datosEntrega,
      fechaEntrega: new Date(datosEntrega.fechaEntrega || documento.fechaEntrega).toLocaleDateString('es-ES'),
      horaEntrega: new Date(datosEntrega.fechaEntrega || documento.fechaEntrega).toLocaleTimeString('es-ES')
    });
    
    // Enviar el correo
    const resultado = await enviarCorreo(
      cliente.email,
      `Confirmación de entrega - ${documento.tipoDocumento}`,
      contenidoHtml
    );
    
    return {
      exito: resultado,
      simulado: false,
      destinatario: cliente.email,
      mensaje: contenidoHtml,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error al enviar confirmación de entrega:', error);
    return {
      exito: false,
      error: error.message,
      destinatario: cliente.email,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Envía una alerta de documento sin recoger
 * @param {Object} documento - Datos del documento
 * @param {Object} cliente - Datos del cliente
 * @param {number} diasPendiente - Días que lleva pendiente el documento
 * @returns {Promise<boolean>} Resultado del envío
 */
const enviarAlertaDocumentoSinRecoger = async (documento, cliente, diasPendiente) => {
  try {
    // Verificar si el cliente tiene correo
    if (!cliente.email) {
      console.warn(`Cliente ${cliente.nombre} no tiene correo para alerta`);
      return false;
    }
    
    // Compilar la plantilla con los datos
    const contenidoHtml = await compilarPlantilla('alerta-sin-recoger', {
      documento,
      cliente,
      diasPendiente,
      fechaDisponible: new Date(documento.updated_at).toLocaleDateString('es-ES'),
      urlVerificacion: `${process.env.BASE_URL || 'https://servidor-local.notaria:3000'}/verificar?codigo=${documento.codigoBarras}`
    });
    
    // Enviar el correo
    return await enviarCorreo(
      cliente.email,
      `IMPORTANTE: Documento pendiente por recoger - ${documento.tipoDocumento}`,
      contenidoHtml
    );
  } catch (error) {
    console.error('Error al enviar alerta de documento sin recoger:', error);
    return false;
  }
};

module.exports = {
  inicializar,
  enviarCorreo,
  enviarNotificacionDocumentoListo,
  enviarConfirmacionEntrega,
  enviarAlertaDocumentoSinRecoger,
  reintentarCorreosPendientes
}; 