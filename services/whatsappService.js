/**
 * Servicio de WhatsApp
 * Gestiona el envío de mensajes de WhatsApp para notificaciones del sistema
 */

const axios = require('axios');
const { sequelize } = require('../config/database');
const configNotaria = require('../config/notaria');

// Configuración del servicio
let configuracion = {
  habilitado: false,
  modoDesarrollo: true,
  apiUrl: process.env.WHATSAPP_API_URL || '',
  token: process.env.WHATSAPP_TOKEN || '',
  maxIntentos: 3,
  delayReintentos: 60000 // 1 minuto
};

/**
 * Inicializa el servicio de WhatsApp
 * @param {Object} config - Configuración del servicio
 */
const inicializar = (config = {}) => {
  try {
    configuracion = {
      ...configuracion,
      ...config
    };
    
    if (configuracion.modoDesarrollo) {
      console.log('📱 Servicio de WhatsApp inicializado en MODO DESARROLLO');
      console.log('   - Las notificaciones se simularán sin envío real');
      return true;
    }
    
    if (!configuracion.habilitado) {
      console.log('📱 Servicio de WhatsApp DESHABILITADO');
      return true;
    }
    
    // Validar configuración para modo producción
    if (!configuracion.apiUrl || !configuracion.token) {
      console.warn('⚠️ Servicio de WhatsApp: Faltan credenciales de API');
      configuracion.habilitado = false;
      return false;
    }
    
    console.log('✅ Servicio de WhatsApp inicializado correctamente');
    return true;
  } catch (error) {
    console.error('❌ Error al inicializar servicio de WhatsApp:', error);
    configuracion.habilitado = false;
    return false;
  }
};

/**
 * Valida un número de teléfono ecuatoriano
 * @param {string} telefono - Número de teléfono a validar
 * @returns {string|null} Número formateado o null si es inválido
 */
const validarTelefono = (telefono) => {
  if (!telefono) return null;
  
  // Remover espacios, guiones y paréntesis
  let numeroLimpio = telefono.toString().replace(/[\s\-\(\)]/g, '');
  
  // Remover el símbolo + si existe
  if (numeroLimpio.startsWith('+')) {
    numeroLimpio = numeroLimpio.substring(1);
  }
  
  // Validar formato ecuatoriano
  // Celular Ecuador: 593 + 9XXXXXXXX (9 dígitos después del 593)
  // Formato común: 0999801901 → +593999801901
  
  if (numeroLimpio.startsWith('593')) {
    // Ya tiene código de país Ecuador
    if (numeroLimpio.length === 12) { // 593 + 9 dígitos
      return '+' + numeroLimpio;
    }
  } else if (numeroLimpio.startsWith('0') && numeroLimpio.length === 10) {
    // Formato nacional: 0999801901 → +593999801901
    return '+593' + numeroLimpio.substring(1);
  } else if (numeroLimpio.length === 9 && numeroLimpio.startsWith('9')) {
    // Solo el número sin código: 999801901 → +593999801901
    return '+593' + numeroLimpio;
  }
  
  console.warn(`❌ Formato de número no reconocido para Ecuador: ${telefono} (limpio: ${numeroLimpio})`);
  return null;
};

/**
 * Genera el mensaje para documento listo
 * @param {Object} documento - Datos del documento
 * @returns {string} Mensaje formateado
 */
const generarMensajeDocumentoListo = (documento) => {
  let contextoTramite = '';
  if (documento.notas && 
      typeof documento.notas === 'string' && 
      documento.notas.trim().length > 0) {
    contextoTramite = ` - ${documento.notas.trim()}`;
  }

  // Usar plantilla centralizada
  const mensaje = configNotaria.plantillas.documentoListo.whatsapp
    .replace('{{tipoDocumento}}', documento.tipoDocumento)
    .replace('{{contextoTramite}}', contextoTramite)
    .replace('{{codigoBarras}}', documento.codigoBarras)
    .replace('{{codigoVerificacion}}', documento.codigoVerificacion || 'N/A')
    .replace('{{nombreCliente}}', documento.nombreCliente);

  return mensaje;
};

/**
 * Genera el mensaje para confirmación de entrega
 * @param {Object} documento - Datos del documento
 * @param {Object} datosEntrega - Información de la entrega
 * @returns {string} Mensaje formateado
 */
const generarMensajeEntregaConfirmada = (documento, datosEntrega) => {
  let contextoTramite = '';
  if (documento.notas && 
      typeof documento.notas === 'string' && 
      documento.notas.trim().length > 0) {
    contextoTramite = ` - ${documento.notas.trim()}`;
  }

  const fechaEntrega = new Date(datosEntrega.fechaEntrega || new Date()).toLocaleDateString('es-EC', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
  
  const horaEntrega = new Date(datosEntrega.fechaEntrega || new Date()).toLocaleTimeString('es-EC', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false
  });
  
  // Usar plantilla centralizada
  const mensaje = configNotaria.plantillas.documentoEntregado.whatsapp
    .replace('{{tipoDocumento}}', documento.tipoDocumento)
    .replace('{{contextoTramite}}', contextoTramite)
    .replace('{{codigoBarras}}', documento.codigoBarras)
    .replace('{{nombreCliente}}', documento.nombreCliente)
    .replace('{{nombreReceptor}}', datosEntrega.nombreReceptor)
    .replace('{{identificacionReceptor}}', datosEntrega.identificacionReceptor)
    .replace('{{relacionReceptor}}', datosEntrega.relacionReceptor)
    .replace('{{fechaEntrega}}', fechaEntrega)
    .replace('{{horaEntrega}}', horaEntrega);

  return mensaje;
};

/**
 * Envía un mensaje de WhatsApp
 * @param {string} telefono - Número de teléfono del destinatario
 * @param {string} mensaje - Mensaje a enviar
 * @returns {Promise<Object>} Resultado del envío
 */
const enviarMensaje = async (telefono, mensaje) => {
  try {
    // Validar número de teléfono
    const telefonoValido = validarTelefono(telefono);
    if (!telefonoValido) {
      throw new Error(`Número de teléfono inválido: ${telefono}`);
    }
    
    // Verificar configuración de envío real
    const envioRealHabilitado = process.env.WHATSAPP_ENVIO_REAL === 'true' || process.env.NODE_ENV === 'production';
    
    // Modo desarrollo - simular envío SOLO si no está habilitado el envío real
    if (!envioRealHabilitado || configuracion.modoDesarrollo) {
      console.log(`[SIMULADO] 📱 WhatsApp a ${telefonoValido}:`);
      console.log(`${mensaje}`);
      console.log(`[DESARROLLO] Notificación WhatsApp registrada sin envío real`);
      
      return {
        exito: true,
        simulado: true,
        destinatario: telefonoValido,
        mensaje: mensaje,
        timestamp: new Date().toISOString()
      };
    }
    
    // ============== ENVÍO REAL ACTIVADO ==============
    console.log(`📱 [REAL] Enviando WhatsApp a ${telefonoValido}`);
    
    // Verificar si el servicio está habilitado
    if (!configuracion.habilitado) {
      console.log('⚠️ Servicio de WhatsApp no está habilitado, simulando envío...');
      return {
        exito: true,
        simulado: true,
        destinatario: telefonoValido,
        mensaje: mensaje,
        timestamp: new Date().toISOString(),
        razon: 'Servicio no habilitado'
      };
    }
    
    // Preparar datos para la API
    const datosApi = {
      to: telefonoValido,
      message: mensaje,
      type: 'text'
    };
    
    // Configurar headers
    const headers = {
      'Authorization': `Bearer ${configuracion.token}`,
      'Content-Type': 'application/json'
    };
    
    // Realizar petición a la API
    const respuesta = await axios.post(configuracion.apiUrl, datosApi, {
      headers,
      timeout: 30000 // 30 segundos
    });
    
    console.log(`✅ [REAL] WhatsApp enviado a ${telefonoValido}: ${respuesta.data.id || 'OK'}`);
    
    return {
      exito: true,
      simulado: false,
      destinatario: telefonoValido,
      mensaje: mensaje,
      respuestaApi: respuesta.data,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ Error al enviar WhatsApp:', error.message);
    
    // Determinar si es simulado basado en configuración
    const esSimulado = configuracion.modoDesarrollo || process.env.WHATSAPP_ENVIO_REAL !== 'true';
    
    return {
      exito: false,
      simulado: esSimulado,
      destinatario: telefono,
      mensaje: mensaje,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Envía notificación de documento listo por WhatsApp
 * @param {string} telefono - Número de teléfono del cliente
 * @param {Object} documento - Datos del documento
 * @returns {Promise<Object>} Resultado del envío
 */
const enviarNotificacionDocumentoListo = async (telefono, documento) => {
  try {
    const mensaje = generarMensajeDocumentoListo(documento);
    return await enviarMensaje(telefono, mensaje);
  } catch (error) {
    console.error('Error al enviar notificación de documento listo por WhatsApp:', error);
    return {
      exito: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Envía confirmación de entrega por WhatsApp
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
    console.error('Error al enviar confirmación de entrega por WhatsApp:', error);
    return {
      exito: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Obtiene la configuración actual del servicio
 * @returns {Object} Configuración actual
 */
const obtenerConfiguracion = () => {
  return { ...configuracion };
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
};

module.exports = {
  inicializar,
  enviarMensaje,
  enviarNotificacionDocumentoListo,
  enviarConfirmacionEntrega,
  validarTelefono,
  obtenerConfiguracion,
  actualizarConfiguracion
}; 