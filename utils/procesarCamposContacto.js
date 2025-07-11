/**
 * UTILIDAD: Procesamiento de Campos de Contacto
 * Maneja validación y limpieza de datos de contacto del XML
 */

/**
 * Valida y limpia un número de teléfono
 * @param {string} telefono - Número de teléfono a validar
 * @returns {string|null} - Número limpio o null si es inválido
 */
function validarYLimpiarTelefono(telefono) {
  // Si está vacío, null o undefined, retornar null
  if (!telefono || telefono.trim() === '') {
    return null;
  }
  
  // Convertir a string y limpiar
  const telefonoStr = String(telefono).trim();
  
  // Eliminar todos los caracteres no numéricos
  const telefonoLimpio = telefonoStr.replace(/\D/g, '');
  
  // Verificar que tenga exactamente 10 dígitos (formato ecuatoriano)
  if (telefonoLimpio.length === 10) {
    return telefonoLimpio;
  }
  
  // Si tiene 9 dígitos y empieza con 9, agregar 0 al inicio
  if (telefonoLimpio.length === 9 && telefonoLimpio.startsWith('9')) {
    return '0' + telefonoLimpio;
  }
  
  // Si no cumple los criterios, retornar null
  console.log(`⚠️ Teléfono inválido: "${telefono}" -> "${telefonoLimpio}" (${telefonoLimpio.length} dígitos)`);
  return null;
}

/**
 * Valida un email
 * @param {string} email - Email a validar
 * @returns {string|null} - Email limpio o null si es inválido
 */
function validarYLimpiarEmail(email) {
  // Si está vacío, null o undefined, retornar null
  if (!email || email.trim() === '') {
    return null;
  }
  
  // Convertir a string y limpiar
  const emailStr = String(email).trim().toLowerCase();
  
  // Regex básico para validar email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (emailRegex.test(emailStr)) {
    return emailStr;
  }
  
  console.log(`⚠️ Email inválido: "${email}"`);
  return null;
}

/**
 * Procesa todos los campos de contacto del XML
 * @param {object} datosXML - Datos extraídos del XML
 * @returns {object} - Campos de contacto procesados
 */
function procesarCamposContacto(datosXML) {
  console.log('🔍 Procesando campos de contacto del XML...');
  
  const resultado = {
    // Campos básicos (siempre presentes)
    telefonoCliente: validarYLimpiarTelefono(datosXML.telefonoCliente),
    emailCliente: validarYLimpiarEmail(datosXML.emailCliente),
    
    // Campos adicionales del sistema de contactos
    celularCliente: validarYLimpiarTelefono(datosXML.celularCliente),
    
    // Campos del sistema inteligente (se procesarán si están disponibles)
    telefonoWhatsapp: null,
    contactoValidado: false,
    contactoConflicto: false,
    contactoDatosAnalisis: null
  };
  
  // Determinar el mejor número para WhatsApp
  let mejorNumero = null;
  
  // Prioridad: celular > teléfono
  if (resultado.celularCliente) {
    mejorNumero = resultado.celularCliente;
    console.log(`📱 Usando celular para WhatsApp: ${mejorNumero}`);
  } else if (resultado.telefonoCliente) {
    mejorNumero = resultado.telefonoCliente;
    console.log(`📞 Usando teléfono para WhatsApp: ${mejorNumero}`);
  } else {
    console.log('⚠️ No se encontró número válido para WhatsApp');
  }
  
  // Asignar número de WhatsApp
  resultado.telefonoWhatsapp = mejorNumero;
  
  // Si hay número, marcarlo como validado básicamente
  if (mejorNumero) {
    resultado.contactoValidado = true;
    resultado.contactoDatosAnalisis = {
      fuente: resultado.celularCliente ? 'celular_xml' : 'telefono_xml',
      numeroOriginal: resultado.celularCliente || resultado.telefonoCliente,
      numeroLimpio: mejorNumero,
      fechaAnalisis: new Date().toISOString(),
      metodo: 'procesamiento_xml_basico'
    };
  }
  
  console.log('✅ Campos de contacto procesados:', {
    telefonoCliente: resultado.telefonoCliente ? 'VÁLIDO' : 'VACÍO',
    emailCliente: resultado.emailCliente ? 'VÁLIDO' : 'VACÍO',
    celularCliente: resultado.celularCliente ? 'VÁLIDO' : 'VACÍO',
    telefonoWhatsapp: resultado.telefonoWhatsapp ? 'ASIGNADO' : 'VACÍO'
  });
  
  return resultado;
}

/**
 * Crea un objeto de contacto vacío/por defecto
 * @returns {object} - Objeto con campos de contacto vacíos
 */
function crearContactoVacio() {
  return {
    telefonoCliente: null,
    emailCliente: null,
    celularCliente: null,
    telefonoWhatsapp: null,
    contactoValidado: false,
    contactoConflicto: false,
    contactoDatosAnalisis: null
  };
}

/**
 * Valida si un documento tiene suficientes datos de contacto
 * @param {object} camposContacto - Campos de contacto procesados
 * @returns {object} - Resultado de la validación
 */
function validarContactoCompleto(camposContacto) {
  const tieneEmail = camposContacto.emailCliente !== null;
  const tieneTelefono = camposContacto.telefonoWhatsapp !== null;
  
  return {
    esCompleto: tieneEmail || tieneTelefono,
    tieneEmail,
    tieneTelefono,
    puedeNotificar: tieneEmail || tieneTelefono,
    recomendacion: !tieneEmail && !tieneTelefono ? 
      'Se recomienda solicitar email o teléfono al cliente para notificaciones' :
      tieneEmail && tieneTelefono ? 
        'Contacto completo - se pueden usar ambos canales' :
        tieneEmail ? 
          'Solo email disponible - notificaciones por correo' :
          'Solo teléfono disponible - notificaciones por WhatsApp'
  };
}

module.exports = {
  validarYLimpiarTelefono,
  validarYLimpiarEmail,
  procesarCamposContacto,
  crearContactoVacio,
  validarContactoCompleto
}; 