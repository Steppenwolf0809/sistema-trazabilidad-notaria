/**
 * Servicio de WhatsApp con Twilio
 * Gestiona el envío de mensajes de WhatsApp usando Twilio API
 */

const twilio = require('twilio');
const configNotaria = require('../config/notaria');

// Configuración del servicio
let configuracion = {
  habilitado: false,
  modoDesarrollo: true,
  testMode: true,
  maxIntentos: 3,
  delayReintentos: 60000, // 1 minuto
  client: null
};

// Variables de entorno requeridas
const requiredEnvVars = [
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_WHATSAPP_FROM'
];

/**
 * Inicializa el servicio de WhatsApp con Twilio
 * @param {Object} config - Configuración del servicio
 */
const inicializar = (config = {}) => {
  try {
    // Actualizar configuración
    configuracion = {
      ...configuracion,
      ...config,
      habilitado: process.env.WHATSAPP_ENABLED === 'true',
      testMode: process.env.TEST_MODE === 'true',
      modoDesarrollo: process.env.NODE_ENV === 'development'
    };

    console.log('🔧 Inicializando servicio de WhatsApp con Twilio...');
    
    // Verificar variables de entorno
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.warn(`⚠️ Variables de entorno faltantes: ${missingVars.join(', ')}`);
      console.warn('   El servicio funcionará en modo simulado únicamente');
      configuracion.habilitado = false;
    } else {
      // Inicializar cliente de Twilio
      try {
        configuracion.client = twilio(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN
        );
        console.log('✅ Cliente de Twilio inicializado correctamente');
      } catch (twilioError) {
        console.error('❌ Error al inicializar cliente de Twilio:', twilioError.message);
        configuracion.habilitado = false;
      }
    }

    // Mostrar estado del servicio
    if (configuracion.modoDesarrollo || !configuracion.habilitado) {
      console.log('📱 Servicio de WhatsApp en MODO DESARROLLO/SIMULADO');
      console.log('   - Las notificaciones se simularán sin envío real');
      if (configuracion.testMode) {
        console.log(`   - TEST_MODE activado: solo envíos a ${process.env.TEST_PHONE || 'TEST_PHONE no configurado'}`);
      }
    } else {
      console.log('✅ Servicio de WhatsApp inicializado en MODO PRODUCCIÓN');
      console.log(`   - Número Twilio: ${process.env.TWILIO_WHATSAPP_FROM}`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error al inicializar servicio de WhatsApp:', error);
    configuracion.habilitado = false;
    return false;
  }
};

/**
 * Valida y formatea un número de teléfono ecuatoriano para WhatsApp
 * @param {string} telefono - Número de teléfono a validar
 * @returns {string|null} Número formateado para WhatsApp o null si es inválido
 */
const validarTelefono = (telefono) => {
  if (!telefono) return null;
  
  // Remover espacios, guiones, paréntesis
  let numeroLimpio = telefono.toString().replace(/[\s\-\(\)]/g, '');
  
  // Si ya tiene el prefijo whatsapp:, extraer solo el número
  if (numeroLimpio.startsWith('whatsapp:')) {
    numeroLimpio = numeroLimpio.replace('whatsapp:', '');
  }
  
  // Remover el símbolo + si existe
  if (numeroLimpio.startsWith('+')) {
    numeroLimpio = numeroLimpio.substring(1);
  }
  
  // Validar formato ecuatoriano y convertir
  if (numeroLimpio.startsWith('593')) {
    // Ya tiene código de país Ecuador (593XXXXXXXXX)
    // Los celulares en Ecuador: +593 + 9XXXXXXXX (9 dígitos que empiezan con 9)
    if (numeroLimpio.length === 12 && numeroLimpio[3] === '9') {
      return `whatsapp:+${numeroLimpio}`;
    }
  } else if (numeroLimpio.startsWith('0') && numeroLimpio.length === 10) {
    // Formato nacional ecuatoriano (09XXXXXXXX → whatsapp:+5939XXXXXXXX)
    if (numeroLimpio[0] === '0' && numeroLimpio[1] === '9') {
      return `whatsapp:+593${numeroLimpio.substring(1)}`;
    }
  } else if (numeroLimpio.length === 9 && numeroLimpio.startsWith('9')) {
    // Solo el número celular sin código de país (9XXXXXXXX → whatsapp:+5939XXXXXXXX)
    return `whatsapp:+593${numeroLimpio}`;
  }
  
  console.warn(`❌ Formato de número no válido para Ecuador: ${telefono} (limpio: ${numeroLimpio})`);
  console.warn('   Formatos válidos para celulares ecuatorianos:');
  console.warn('   - 09XXXXXXXX (formato nacional, ej: 0999266015)');
  console.warn('   - 5939XXXXXXXX (con código país, ej: 593999266015)');
  console.warn('   - +5939XXXXXXXX (con + y código país, ej: +593999266015)');
  console.warn('   - whatsapp:+5939XXXXXXXX (formato WhatsApp completo)');
  console.warn('   - 9XXXXXXXX (solo número celular, ej: 999266015)');
  return null;
};

/**
 * Genera código de verificación de 4 dígitos
 * @returns {string} Código de 4 dígitos
 */
const generarCodigoVerificacion = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

/**
 * Genera el mensaje para documento listo usando las plantillas de la notaría
 * @param {Object} documento - Datos del documento
 * @returns {string} Mensaje formateado
 */
const generarMensajeDocumentoListo = (documento) => {
  // Generar código de verificación si no existe
  const codigoVerificacion = documento.codigoVerificacion || generarCodigoVerificacion();
  
  // Contexto del trámite si existe
  let contextoTramite = '';
  if (documento.notas && typeof documento.notas === 'string' && documento.notas.trim().length > 0) {
    contextoTramite = ` - ${documento.notas.trim()}`;
  }

  // Usar plantilla centralizada de la notaría
  if (configNotaria.plantillas?.documentoListo?.whatsapp) {
    return configNotaria.plantillas.documentoListo.whatsapp
      .replace('{{tipoDocumento}}', documento.tipoDocumento || 'Documento')
      .replace('{{contextoTramite}}', contextoTramite)
      .replace('{{codigoBarras}}', documento.codigoBarras || 'N/A')
      .replace('{{codigoVerificacion}}', codigoVerificacion)
      .replace('{{nombreCliente}}', documento.nombreCliente || 'Cliente');
  }

  // Mensaje de respaldo si no hay plantilla
  return `🏛️ *NOTARÍA DÉCIMA OCTAVA*

Su documento está listo para retiro:

📋 *Tipo:* ${documento.tipoDocumento || 'Documento'}${contextoTramite}
👤 *Cliente:* ${documento.nombreCliente || 'Cliente'}
🔢 *Código de verificación:* ${codigoVerificacion}

📍 *Dirección:* ${process.env.NOTARIA_DIRECCION || 'Consultar en la notaría'}
⏰ *Horario:* ${process.env.NOTARIA_HORARIO || 'Horario de oficina'}
📞 *Consultas:* ${process.env.NOTARIA_TELEFONO || 'Teléfono de la notaría'}

Presente este código al retirar su documento.`;
};

/**
 * Genera el mensaje para confirmación de entrega
 * @param {Object} documento - Datos del documento
 * @param {Object} datosEntrega - Información de la entrega
 * @returns {string} Mensaje formateado
 */
const generarMensajeEntregaConfirmada = (documento, datosEntrega) => {
  // Contexto del trámite si existe
  let contextoTramite = '';
  if (documento.notas && typeof documento.notas === 'string' && documento.notas.trim().length > 0) {
    contextoTramite = ` - ${documento.notas.trim()}`;
  }

  // Formatear fecha y hora
  const fechaEntrega = new Date(datosEntrega.fechaEntrega || new Date()).toLocaleDateString('es-EC', {
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric'
  });
  
  const horaEntrega = new Date(datosEntrega.fechaEntrega || new Date()).toLocaleTimeString('es-EC', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false
  });
  
  // Usar plantilla centralizada si existe
  if (configNotaria.plantillas?.documentoEntregado?.whatsapp) {
    return configNotaria.plantillas.documentoEntregado.whatsapp
      .replace('{{tipoDocumento}}', documento.tipoDocumento || 'Documento')
      .replace('{{contextoTramite}}', contextoTramite)
      .replace('{{codigoBarras}}', documento.codigoBarras || 'N/A')
      .replace('{{nombreCliente}}', documento.nombreCliente || 'Cliente')
      .replace('{{nombreReceptor}}', datosEntrega.nombreReceptor || 'Receptor')
      .replace('{{identificacionReceptor}}', datosEntrega.identificacionReceptor || 'N/A')
      .replace('{{relacionReceptor}}', datosEntrega.relacionReceptor || 'Autorizado')
      .replace('{{fechaEntrega}}', fechaEntrega)
      .replace('{{horaEntrega}}', horaEntrega);
  }

  // Mensaje de respaldo
  return `🏛️ *NOTARÍA DÉCIMA OCTAVA*

✅ *DOCUMENTO ENTREGADO*

📋 *Tipo:* ${documento.tipoDocumento || 'Documento'}${contextoTramite}
👤 *Cliente:* ${documento.nombreCliente || 'Cliente'}
🆔 *Código:* ${documento.codigoBarras || 'N/A'}

📤 *Entregado a:* ${datosEntrega.nombreReceptor || 'Receptor'}
🆔 *Identificación:* ${datosEntrega.identificacionReceptor || 'N/A'}
🔗 *Relación:* ${datosEntrega.relacionReceptor || 'Autorizado'}

📅 *Fecha:* ${fechaEntrega}
⏰ *Hora:* ${horaEntrega}

Gracias por confiar en nuestros servicios.`;
};

/**
 * Envía un mensaje de WhatsApp usando Twilio
 * @param {string} telefono - Número de teléfono del destinatario
 * @param {string} mensaje - Mensaje a enviar
 * @returns {Promise<Object>} Resultado del envío
 */
const enviarMensaje = async (telefono, mensaje) => {
  try {
    // Validar número de teléfono
    const telefonoWhatsApp = validarTelefono(telefono);
    if (!telefonoWhatsApp) {
      throw new Error(`Número de teléfono inválido para WhatsApp: ${telefono}`);
    }

    // Modo test: solo enviar al número de prueba
    let destinatarioFinal = telefonoWhatsApp;
    if (configuracion.testMode && process.env.TEST_PHONE) {
      const testPhone = validarTelefono(process.env.TEST_PHONE);
      if (testPhone) {
        destinatarioFinal = testPhone;
        mensaje = `[MODO TEST - Original: ${telefono}]\n\n${mensaje}`;
        console.log(`📱 TEST_MODE: Redirigiendo mensaje a ${process.env.TEST_PHONE}`);
      }
    }

    // Verificar si el envío real está habilitado
    // CORREGIDO: Solo verificar que Twilio esté configurado correctamente
    const envioRealHabilitado = configuracion.habilitado && 
                                configuracion.client && 
                                process.env.TWILIO_ACCOUNT_SID && 
                                process.env.TWILIO_AUTH_TOKEN &&
                                process.env.TWILIO_WHATSAPP_FROM;
    
    // MODO SIMULADO (solo si falta configuración de Twilio)
    if (!envioRealHabilitado) {
      console.log(`📱 [SIMULADO] WhatsApp a ${destinatarioFinal} (Twilio no configurado):`);
      console.log('─'.repeat(50));
      console.log(mensaje);
      console.log('─'.repeat(50));
      console.log('[SIMULADO] Mensaje registrado sin envío real - Configurar credenciales de Twilio');
      
      return {
        exito: true,
        simulado: true,
        destinatario: telefono,
        destinatarioFinal: destinatarioFinal,
        mensaje: mensaje,
        timestamp: new Date().toISOString(),
        configuracion: 'simulado-sin-twilio'
      };
    }
    
    // ENVÍO REAL CON TWILIO
    console.log(`🚀 [REAL] Enviando WhatsApp REAL via Twilio a ${destinatarioFinal}`);
    console.log(`📡 Usando Twilio desde: ${process.env.TWILIO_WHATSAPP_FROM}`);
    
    const resultado = await configuracion.client.messages.create({
      body: mensaje,
      from: process.env.TWILIO_WHATSAPP_FROM,
      to: destinatarioFinal
    });
    
    console.log(`✅ WhatsApp REAL enviado exitosamente!`);
    console.log(`📋 Message SID: ${resultado.sid}`);
    console.log(`📊 Status: ${resultado.status}`);
    console.log(`📱 Destinatario: ${resultado.to}`);
    
    return {
      exito: true,
      simulado: false,
      destinatario: telefono,
      destinatarioFinal: destinatarioFinal,
      mensaje: mensaje,
      respuestaApi: {
        sid: resultado.sid,
        status: resultado.status,
        direction: resultado.direction,
        dateCreated: resultado.dateCreated
      },
      timestamp: new Date().toISOString(),
      configuracion: 'twilio-real'
    };
    
  } catch (error) {
    console.error('❌ Error al enviar mensaje de WhatsApp:', error.message);
    
    // Proporcionar información útil sobre errores comunes
    if (error.code === 20003) {
      console.error('💡 SOLUCIÓN: El número no está conectado al Sandbox de WhatsApp');
      console.error('   1. Ve a https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn');
      console.error('   2. Envía el código de activación al número desde WhatsApp');
      console.error('   3. Verifica que el número esté en formato +593XXXXXXXXX');
    } else if (error.code === 20404) {
      console.error('💡 SOLUCIÓN: Credenciales de Twilio incorrectas');
      console.error('   1. Verifica TWILIO_ACCOUNT_SID en tu .env');
      console.error('   2. Verifica TWILIO_AUTH_TOKEN en tu .env');
      console.error('   3. Ve a https://console.twilio.com para obtener las credenciales correctas');
    }
    
    return {
      exito: false,
      simulado: false,
      destinatario: telefono,
      error: error.message,
      codigo: error.code || 'UNKNOWN',
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Envía notificación de documento listo
 * @param {string} telefono - Número de teléfono del cliente
 * @param {Object} documento - Datos del documento
 * @returns {Promise<Object>} Resultado del envío
 */
const enviarNotificacionDocumentoListo = async (telefono, documento) => {
  try {
    const mensaje = generarMensajeDocumentoListo(documento);
    return await enviarMensaje(telefono, mensaje);
  } catch (error) {
    console.error('Error al enviar notificación de documento listo:', error);
    return {
      exito: false,
      error: error.message,
      destinatario: telefono
    };
  }
};

/**
 * Envía confirmación de entrega
 * @param {string} telefono - Número de teléfono del cliente
 * @param {Object} documento - Datos del documento
 * @param {Object} datosEntrega - Información de la entrega
 * @returns {Promise<Object>} Resultado del envío
 */
const enviarConfirmacionEntrega = async (telefono, documento, datosEntrega) => {
  try {
    const mensaje = generarMensajeEntregaConfirmada(documento, datosEntrega);
    return await enviarMensaje(telefono, mensaje);
  } catch (error) {
    console.error('Error al enviar confirmación de entrega:', error);
    return {
      exito: false,
      error: error.message,
      destinatario: telefono
    };
  }
};

/**
 * Obtiene la configuración actual del servicio
 * @returns {Object} Configuración actual (sin credenciales sensibles)
 */
const obtenerConfiguracion = () => {
  return {
    habilitado: configuracion.habilitado,
    modoDesarrollo: configuracion.modoDesarrollo,
    testMode: configuracion.testMode,
    maxIntentos: configuracion.maxIntentos,
    delayReintentos: configuracion.delayReintentos,
    clienteInicializado: !!configuracion.client,
    twilioConfigured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
    whatsappNumber: process.env.TWILIO_WHATSAPP_FROM ? 
      process.env.TWILIO_WHATSAPP_FROM.replace(/\d(?=\d{4})/g, '*') : 'No configurado',
    testPhone: process.env.TEST_PHONE || 'No configurado'
  };
};

/**
 * Actualiza la configuración del servicio
 * @param {Object} nuevaConfig - Nueva configuración
 */
const actualizarConfiguracion = (nuevaConfig) => {
  configuracion = {
    ...configuracion,
    ...nuevaConfig
  };
  
  console.log('🔧 Configuración de WhatsApp actualizada');
};

/**
 * Prueba la conectividad con Twilio
 * @returns {Promise<Object>} Resultado de la prueba
 */
const probarConectividad = async () => {
  try {
    if (!configuracion.client) {
      return {
        exito: false,
        error: 'Cliente de Twilio no inicializado'
      };
    }

    // Obtener información de la cuenta
    const account = await configuracion.client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
    
    return {
      exito: true,
      account: {
        friendlyName: account.friendlyName,
        status: account.status,
        type: account.type
      }
    };
  } catch (error) {
    return {
      exito: false,
      error: error.message,
      codigo: error.code || 'UNKNOWN'
    };
  }
};

module.exports = {
  inicializar,
  validarTelefono,
  generarCodigoVerificacion,
  generarMensajeDocumentoListo,
  generarMensajeEntregaConfirmada,
  enviarMensaje,
  enviarNotificacionDocumentoListo,
  enviarConfirmacionEntrega,
  obtenerConfiguracion,
  actualizarConfiguracion,
  probarConectividad
}; 