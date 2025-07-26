/**
 * Servicio de WhatsApp con Twilio
 * Gestiona el envío de mensajes de WhatsApp usando Twilio API
 */

const twilio = require('twilio');
const moment = require('moment-timezone');
const configNotaria = require('../config/notaria');

// Zona horaria de Ecuador
const TIMEZONE_ECUADOR = 'America/Guayaquil';

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
 * ✅ NUEVO: Determina el estado de pago de un documento
 * @param {Object} documento - Datos del documento
 * @returns {Object} Información del estado de pago
 */
const determinarEstadoPago = (documento) => {
  const estadoPago = documento.estadoPago || 'pendiente';
  const valorFactura = parseFloat(documento.valorFactura) || 0;
  const valorPagado = parseFloat(documento.valorPagado) || 0;
  const valorPendiente = valorFactura - valorPagado;
  
  return {
    estado: estadoPago,
    valorFactura: valorFactura,
    valorPagado: valorPagado,
    valorPendiente: Math.max(0, valorPendiente),
    estaPagado: estadoPago === 'pagado_completo' || estadoPago === 'pagado_con_retencion',
    esPagoParcial: estadoPago === 'pago_parcial',
    tieneValor: valorFactura > 0
  };
};

/**
 * ✅ NUEVO: Selecciona la plantilla apropiada según el estado de pago
 * @param {Object} infoPago - Información del estado de pago
 * @returns {string|null} Plantilla de mensaje o null si no hay plantilla
 */
const seleccionarPlantillaPorPago = (infoPago) => {
  const plantillas = configNotaria.plantillas?.documentoListo;
  
  if (!plantillas) return null;
  
  // Documento pagado completamente (incluye pagado con retención)
  if (infoPago.estaPagado) {
    return plantillas.whatsappPagado;
  }
  
  // Documento con pago parcial
  if (infoPago.esPagoParcial && infoPago.valorPendiente > 0) {
    return plantillas.whatsappPagoParcial;
  }
  
  // Documento no pagado (pero con valor)
  if (!infoPago.estaPagado && infoPago.tieneValor) {
    return plantillas.whatsappNoPagado;
  }
  
  // Documento sin valor o estado no determinado - usar plantilla genérica
  return plantillas.whatsapp;
};

/**
 * ✅ ACTUALIZADO: Genera el mensaje para documento listo según estado de pago
 * @param {Object} documento - Datos del documento
 * @returns {string} Mensaje formateado
 */
const generarMensajeDocumentoListo = (documento) => {
  // ✅ FIX CRÍTICO: Usar SIEMPRE el código del documento, no generar uno nuevo
  const codigoVerificacion = documento.codigoVerificacion;
  
  // Si no hay código, algo está mal - log de error pero no generar uno nuevo
  if (!codigoVerificacion) {
    console.error(`❌ [WHATSAPP] Documento ${documento.codigoBarras} sin código de verificación!`);
    console.error(`   Este es un error grave - el documento debería tener código antes de notificar`);
  }
  
  // Contexto del trámite si existe
  let contextoTramite = '';
  if (documento.notas && typeof documento.notas === 'string' && documento.notas.trim().length > 0) {
    contextoTramite = ` - ${documento.notas.trim()}`;
  }
  
  // ✅ NUEVA LÓGICA: Determinar estado de pago y seleccionar plantilla
  const infoPago = determinarEstadoPago(documento);
  const plantilla = seleccionarPlantillaPorPago(infoPago);
  
  if (plantilla) {
    console.log(`📱 [WHATSAPP] Usando plantilla para estado: ${infoPago.estado} (pagado: ${infoPago.estaPagado})`);
    console.log(`🔑 [WHATSAPP] Código de verificación a enviar: ${codigoVerificacion || 'ERROR-SIN-CODIGO'}`);
    
    // Reemplazar variables en la plantilla seleccionada
    return plantilla
      .replace('{{tipoDocumento}}', documento.tipoDocumento || 'Documento')
      .replace('{{contextoTramite}}', contextoTramite)
      .replace('{{codigoBarras}}', documento.codigoBarras || 'N/A')
      .replace('{{codigoVerificacion}}', codigoVerificacion || 'ERROR-SIN-CODIGO')
      .replace('{{nombreCliente}}', documento.nombreCliente || 'Cliente')
      .replace('{{valorFactura}}', infoPago.valorFactura.toFixed(2))
      .replace('{{valorPendiente}}', infoPago.valorPendiente.toFixed(2));
  }

  // ✅ MENSAJE DE RESPALDO MEJORADO si no hay plantillas
  console.log('⚠️ [WHATSAPP] No se encontraron plantillas, usando mensaje de respaldo');
  
  const estadoTexto = infoPago.estaPagado ? 
    '✅ PAGO CONFIRMADO - Listo para retiro' : 
    (infoPago.tieneValor ? `⚠️ PAGO PENDIENTE - Valor: $${infoPago.valorFactura.toFixed(2)}` : 'Listo para retiro');
  
  return `🏛️ *NOTARÍA 18*

Su documento está listo para retiro:

📋 *Tipo:* ${documento.tipoDocumento || 'Documento'}${contextoTramite}
👤 *Cliente:* ${documento.nombreCliente || 'Cliente'}
🔢 *Código de verificación:* ${codigoVerificacion}

${estadoTexto}

📍 *Dirección:* Notaría Décima Octava, Quito
⏰ *Horario:* Lunes a Viernes 8:00-17:00

Presente este código al retirar su documento.`;
};

/**
 * Genera el mensaje para confirmación de entrega
 * @param {Object} documento - Datos del documento
 * @param {Object} datosEntrega - Información de la entrega
 * @returns {string} Mensaje formateado
 */
const generarMensajeEntregaConfirmada = (documento, datosEntrega) => {
  // Importar función de censura
  const { censurarIdentificacion } = require('../utils/documentoUtils');
  
  // Contexto del trámite si existe
  let contextoTramite = '';
  if (documento.notas && typeof documento.notas === 'string' && documento.notas.trim().length > 0) {
    contextoTramite = ` - ${documento.notas.trim()}`;
  }

  // 🇪🇨 Formatear fecha y hora CON ZONA HORARIA ECUADOR
  const fechaEntregaEcuador = datosEntrega.fechaEntrega ? 
    moment(datosEntrega.fechaEntrega).tz(TIMEZONE_ECUADOR) : 
    moment().tz(TIMEZONE_ECUADOR);
    
  const fechaEntrega = fechaEntregaEcuador.format('DD/MM/YYYY');
  const horaEntrega = fechaEntregaEcuador.format('HH:mm');
  
  // ✅ CORRECCIÓN: Aplicar censura directamente aquí
  const identificacionCensurada = censurarIdentificacion(datosEntrega.identificacionReceptor);
  
  // Usar plantilla centralizada si existe
  if (configNotaria.plantillas?.documentoEntregado?.whatsapp) {
    return configNotaria.plantillas.documentoEntregado.whatsapp
      .replace('{{tipoDocumento}}', documento.tipoDocumento || 'Documento')
      .replace('{{contextoTramite}}', contextoTramite)
      .replace('{{codigoBarras}}', documento.codigoBarras || 'N/A')
      .replace('{{nombreCliente}}', documento.nombreCliente || 'Cliente')
      .replace('{{nombreReceptor}}', datosEntrega.nombreReceptor || 'Receptor')
      .replace('{{identificacionCensurada}}', identificacionCensurada)
      .replace('{{relacionReceptor}}', datosEntrega.relacionReceptor || 'Autorizado')
      .replace('{{fechaEntrega}}', fechaEntrega)
      .replace('{{horaEntrega}}', horaEntrega);
  }

  // Mensaje de respaldo con enlace de Google Reviews
  return `🏛️ *NOTARÍA DÉCIMA OCTAVA*

✅ *DOCUMENTO ENTREGADO*

📋 *Tipo:* ${documento.tipoDocumento || 'Documento'}${contextoTramite}
👤 *Cliente:* ${documento.nombreCliente || 'Cliente'}
🆔 *Código:* ${documento.codigoBarras || 'N/A'}

📤 *Entregado a:* ${datosEntrega.nombreReceptor || 'Receptor'}
🆔 *Identificación:* ${identificacionCensurada}
🔗 *Relación:* ${datosEntrega.relacionReceptor || 'Autorizado'}

📅 *Fecha:* ${fechaEntrega}
⏰ *Hora:* ${horaEntrega}

Gracias por confiar en nuestros servicios.

⭐ *¿Quedó satisfecho con nuestro servicio?*
Comparta su experiencia en Google:
https://g.page/r/CYfAY05X_ylIEBM/review?utm_source=gbp&utm_medium=reviews&utm_campaign=qr

Su opinión nos ayuda a mejorar cada día.`;
};

/**
 * 🆕 NUEVO: Genera mensaje consolidado para notificación grupal
 * @param {Array} documentos - Array de documentos del grupo
 * @param {string} codigoVerificacionGrupal - Código único para todo el grupo
 * @returns {string} Mensaje formateado consolidado
 */
const generarMensajeNotificacionGrupal = (documentos, codigoVerificacionGrupal) => {
  if (!documentos || documentos.length === 0) {
    throw new Error('Se requiere al menos un documento para generar notificación grupal');
  }
  
  const documentoPrincipal = documentos[0];
  const totalDocumentos = documentos.length;
  
  // Construir encabezado
  let mensaje = `🏛️ *NOTARÍA 18*\n\n`;
  mensaje += `¡Sus documentos están listos para retirar!\n\n`;
  
  // Listar todos los documentos del grupo
  documentos.forEach((documento, index) => {
    // Contexto del trámite si existe
    let contextoTramite = '';
    if (documento.notas && typeof documento.notas === 'string' && documento.notas.trim().length > 0) {
      contextoTramite = ` - ${documento.notas.trim()}`;
    }
    
    mensaje += `📄 *Trámite:* ${documento.tipoDocumento}${contextoTramite}\n`;
    if (index < documentos.length - 1) {
      mensaje += `\n`;
    }
  });
  
  mensaje += `👤 *Cliente:* ${documentoPrincipal.nombreCliente}\n\n`;
  
  // ✅ NUEVA LÓGICA: Analizar estados de pago de todos los documentos del grupo
  if (documentos.length > 1) {
    // Analizar estados de pago de todos los documentos del grupo
    const estadosPago = documentos.map(doc => doc.estadoPago);
    const valoresPendientes = documentos
      .filter(doc => doc.estadoPago === 'pendiente')
      .map(doc => parseFloat(doc.valorFactura) || 0);
    const valorTotalPendiente = valoresPendientes.reduce((sum, valor) => sum + valor, 0);
    
    const todosPageados = estadosPago.every(estado => 
      estado === 'pagado_completo' || estado === 'pagado_con_retencion'
    );
    const todosPendientes = estadosPago.every(estado => estado === 'pendiente');

    // Crear sección de pago según el estado
    let seccionPago = '';
    
    if (todosPageados) {
      // Formato igual a documentos individuales pagados
      seccionPago = `✅ PAGO CONFIRMADO
🔢 Código de retiro: ${codigoVerificacionGrupal}

☑️ PARA RETIRAR:
• Presentar código de retiro
• Presentar identificación`;
      
    } else if (todosPendientes) {
      // Formato igual a documentos individuales pendientes
      seccionPago = `⚠️ IMPORTANTE: PAGO PENDIENTE
💰 Valor total a pagar: $${valorTotalPendiente.toFixed(2)}
🔢 Código de retiro: ${codigoVerificacionGrupal}

☑️ PASOS PARA RETIRAR:
1️⃣ Realizar el pago en caja
2️⃣ Presentar código de retiro
3️⃣ Retirar documentos`;
      
    } else {
      // Estados mixtos
      seccionPago = `⚠️ ESTADO MIXTO DE PAGOS
💰 Pendiente de pago: $${valorTotalPendiente.toFixed(2)}
🔢 Código de retiro: ${codigoVerificacionGrupal}

☑️ PASOS PARA RETIRAR:
1️⃣ Realizar pago pendiente en caja
2️⃣ Presentar código de retiro
3️⃣ Retirar todos los documentos`;
    }
    
    mensaje += seccionPago;
  } else {
    // Para documentos individuales, mantener lógica anterior
    mensaje += `🔢 *Código de verificación:* ${codigoVerificacionGrupal}\n`;
    mensaje += `(Un solo código válido para todos los documentos)\n`;
  }
  
  // Información de contacto y ubicación
  mensaje += `\n\n📍 *Ubicación:* Notaría Décima Octava\n`;
  mensaje += `🕒 *Horario:* Lunes a Viernes 8:00-17:00\n\n`;
  
  mensaje += `Gracias por confiar en nosotros.`;
  
  return mensaje;
};

/**
 * 🆕 NUEVO: Genera mensaje consolidado para entrega grupal
 * @param {Array} documentos - Array de documentos entregados
 * @param {Object} datosEntrega - Información de la entrega
 * @returns {string} Mensaje formateado consolidado
 */
const generarMensajeEntregaGrupalConfirmada = (documentos, datosEntrega) => {
  if (!documentos || documentos.length === 0) {
    throw new Error('Se requiere al menos un documento para generar confirmación de entrega grupal');
  }
  
  // Importar función de censura
  const { censurarIdentificacion } = require('../utils/documentoUtils');
  
  const documentoPrincipal = documentos[0];
  const totalDocumentos = documentos.length;
  
  // 🇪🇨 Formatear fecha y hora CON ZONA HORARIA ECUADOR
  const fechaEntregaEcuador = datosEntrega.fechaEntrega ? 
    moment(datosEntrega.fechaEntrega).tz(TIMEZONE_ECUADOR) : 
    moment().tz(TIMEZONE_ECUADOR);
    
  const fechaEntrega = fechaEntregaEcuador.format('DD/MM/YYYY');
  const horaEntrega = fechaEntregaEcuador.format('HH:mm');
  
  // Aplicar censura a la identificación
  const identificacionCensurada = censurarIdentificacion(datosEntrega.identificacionReceptor);
  
  // Construir mensaje
  let mensaje = `🏛️ *NOTARÍA DÉCIMA OCTAVA*\n\n`;
  mensaje += `✅ *DOCUMENTOS ENTREGADOS*\n\n`;
  
  // Información del cliente
  mensaje += `👤 *Cliente:* ${documentoPrincipal.nombreCliente}\n`;
  mensaje += `📋 *Total entregado:* ${totalDocumentos} documento${totalDocumentos > 1 ? 's' : ''}\n\n`;
  
  // Listar documentos entregados
  mensaje += `📄 *Documentos entregados:*\n`;
  documentos.forEach((documento, index) => {
    // Contexto del trámite si existe
    let contextoTramite = '';
    if (documento.notas && typeof documento.notas === 'string' && documento.notas.trim().length > 0) {
      contextoTramite = ` - ${documento.notas.trim()}`;
    }
    
    mensaje += `${index + 1}. ${documento.tipoDocumento.toUpperCase()}${contextoTramite}\n`;
    mensaje += `   Código: ${documento.codigoBarras}\n`;
    
    if (index < documentos.length - 1) {
      mensaje += `\n`;
    }
  });
  
  // Información de la entrega
  mensaje += `\n📤 *Entregado a:* ${datosEntrega.nombreReceptor}\n`;
  mensaje += `🆔 *Identificación:* ${identificacionCensurada}\n`;
  mensaje += `🔗 *Relación:* ${datosEntrega.relacionReceptor || 'Autorizado'}\n\n`;
  
  mensaje += `📅 *Fecha:* ${fechaEntrega}\n`;
  mensaje += `⏰ *Hora:* ${horaEntrega}\n\n`;
  
  mensaje += `Gracias por confiar en nuestros servicios.\n\n`;
  
  mensaje += `⭐ *¿Quedó satisfecho con nuestro servicio?*\n`;
  mensaje += `Comparta su experiencia en Google:\n`;
  mensaje += `https://g.page/r/CYfAY05X_ylIEBM/review?utm_source=gbp&utm_medium=reviews&utm_campaign=qr\n\n`;
  
  mensaje += `Su opinión nos ayuda a mejorar cada día.`;
  
  return mensaje;
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
 * 🆕 NUEVO: Envía notificación consolidada para grupo de documentos
 * @param {string} telefono - Número de teléfono del cliente
 * @param {Array} documentos - Array de documentos del grupo
 * @param {string} codigoVerificacionGrupal - Código único para todo el grupo
 * @returns {Promise<Object>} Resultado del envío
 */
const enviarNotificacionGrupal = async (telefono, documentos, codigoVerificacionGrupal) => {
  try {
    console.log(`📱 [NOTIFICACIÓN GRUPAL] Enviando a ${telefono} para ${documentos.length} documentos`);
    
    const mensaje = generarMensajeNotificacionGrupal(documentos, codigoVerificacionGrupal);
    const resultado = await enviarMensaje(telefono, mensaje);
    
    if (resultado.exito) {
      console.log(`✅ [NOTIFICACIÓN GRUPAL] Enviada exitosamente - Código: ${codigoVerificacionGrupal}`);
    }
    
    return resultado;
  } catch (error) {
    console.error('❌ Error al enviar notificación grupal:', error);
    return {
      exito: false,
      error: error.message,
      destinatario: telefono,
      grupoDocumentos: documentos.length
    };
  }
};

/**
 * 🆕 NUEVO: Envía confirmación de entrega grupal
 * @param {string} telefono - Número de teléfono del cliente
 * @param {Array} documentos - Array de documentos entregados
 * @param {Object} datosEntrega - Información de la entrega
 * @returns {Promise<Object>} Resultado del envío
 */
const enviarConfirmacionEntregaGrupal = async (telefono, documentos, datosEntrega) => {
  try {
    console.log(`📱 [ENTREGA GRUPAL] Enviando confirmación a ${telefono} para ${documentos.length} documentos`);
    
    const mensaje = generarMensajeEntregaGrupalConfirmada(documentos, datosEntrega);
    const resultado = await enviarMensaje(telefono, mensaje);
    
    if (resultado.exito) {
      console.log(`✅ [ENTREGA GRUPAL] Confirmación enviada exitosamente`);
    }
    
    return resultado;
  } catch (error) {
    console.error('❌ Error al enviar confirmación de entrega grupal:', error);
    return {
      exito: false,
      error: error.message,
      destinatario: telefono,
      grupoDocumentos: documentos.length
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
  // ✅ NUEVAS FUNCIONES PARA ESTADO DE PAGO
  determinarEstadoPago,
  seleccionarPlantillaPorPago,
  // Funciones existentes actualizadas
  generarMensajeDocumentoListo,
  generarMensajeEntregaConfirmada,
  generarMensajeNotificacionGrupal,
  generarMensajeEntregaGrupalConfirmada,
  enviarMensaje,
  enviarNotificacionDocumentoListo,
  enviarConfirmacionEntrega,
  enviarNotificacionGrupal,
  enviarConfirmacionEntregaGrupal,
  obtenerConfiguracion,
  actualizarConfiguracion,
  probarConectividad
}; 