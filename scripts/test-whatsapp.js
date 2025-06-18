#!/usr/bin/env node
/**
 * Script de prueba para WhatsApp con Twilio
 * Verifica configuración y envía mensaje de prueba
 */

require('dotenv').config();
const whatsappService = require('../services/whatsappService');

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

/**
 * Imprime texto con color
 */
function colorPrint(text, color = 'reset') {
  console.log(`${colors[color]}${text}${colors.reset}`);
}

/**
 * Imprime un separador visual
 */
function printSeparator(title = '') {
  const separator = '='.repeat(60);
  if (title) {
    const padding = Math.max(0, Math.floor((60 - title.length) / 2));
    const titleLine = '='.repeat(padding) + ` ${title} ` + '='.repeat(60 - padding - title.length - 2);
    colorPrint(titleLine, 'cyan');
  } else {
    colorPrint(separator, 'cyan');
  }
}

/**
 * Verifica las variables de entorno necesarias
 */
function verificarConfiguracion() {
  printSeparator('VERIFICACIÓN DE CONFIGURACIÓN');
  
  const variablesRequeridas = [
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN', 
    'TWILIO_WHATSAPP_FROM',
    'TEST_PHONE'
  ];
  
  const variablesOpcionales = [
    'WHATSAPP_ENABLED',
    'TEST_MODE',
    'NODE_ENV',
    'NOTARIA_NOMBRE',
    'NOTARIA_DIRECCION',
    'NOTARIA_HORARIO',
    'NOTARIA_TELEFONO'
  ];
  
  let configuracionValida = true;
  
  // Verificar variables requeridas
  colorPrint('\n📋 Variables de entorno requeridas:', 'bright');
  variablesRequeridas.forEach(variable => {
    const valor = process.env[variable];
    if (valor) {
      // Ocultar datos sensibles
      if (variable.includes('TOKEN') || variable.includes('SID')) {
        const valorOculto = valor.substring(0, 8) + '*'.repeat(Math.max(0, valor.length - 8));
        colorPrint(`  ✅ ${variable}: ${valorOculto}`, 'green');
      } else {
        colorPrint(`  ✅ ${variable}: ${valor}`, 'green');
      }
    } else {
      colorPrint(`  ❌ ${variable}: NO CONFIGURADA`, 'red');
      configuracionValida = false;
    }
  });
  
  // Verificar variables opcionales
  colorPrint('\n📋 Variables de entorno opcionales:', 'bright');
  variablesOpcionales.forEach(variable => {
    const valor = process.env[variable];
    if (valor) {
      colorPrint(`  ✅ ${variable}: ${valor}`, 'green');
    } else {
      colorPrint(`  ⚠️  ${variable}: no configurada (usando valor por defecto)`, 'yellow');
    }
  });
  
  return configuracionValida;
}

/**
 * Muestra información del servicio de WhatsApp
 */
async function mostrarInformacionServicio() {
  printSeparator('INFORMACIÓN DEL SERVICIO');
  
  try {
    // Inicializar el servicio
    const inicializado = whatsappService.inicializar();
    
    if (inicializado) {
      colorPrint('✅ Servicio de WhatsApp inicializado correctamente\n', 'green');
    } else {
      colorPrint('❌ Error al inicializar el servicio de WhatsApp\n', 'red');
      return false;
    }
    
    // Obtener configuración
    const config = whatsappService.obtenerConfiguracion();
    
    colorPrint('📱 Estado del servicio:', 'bright');
    colorPrint(`  Habilitado: ${config.habilitado ? '✅ Sí' : '❌ No'}`, config.habilitado ? 'green' : 'red');
    colorPrint(`  Modo desarrollo: ${config.modoDesarrollo ? '✅ Sí' : '❌ No'}`, config.modoDesarrollo ? 'yellow' : 'green');
    colorPrint(`  Modo test: ${config.testMode ? '✅ Sí' : '❌ No'}`, config.testMode ? 'yellow' : 'blue');
    colorPrint(`  Cliente inicializado: ${config.clienteInicializado ? '✅ Sí' : '❌ No'}`, config.clienteInicializado ? 'green' : 'red');
    colorPrint(`  Twilio configurado: ${config.twilioConfigured ? '✅ Sí' : '❌ No'}`, config.twilioConfigured ? 'green' : 'red');
    
    colorPrint('\n📞 Configuración de números:', 'bright');
    colorPrint(`  Número WhatsApp Twilio: ${config.whatsappNumber}`, 'blue');
    colorPrint(`  Número de prueba: ${config.testPhone}`, 'blue');
    
    return true;
  } catch (error) {
    colorPrint(`❌ Error al obtener información del servicio: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Prueba la conectividad con Twilio
 */
async function probarConectividad() {
  printSeparator('PRUEBA DE CONECTIVIDAD');
  
  try {
    colorPrint('🔍 Probando conexión con Twilio...', 'blue');
    
    const resultado = await whatsappService.probarConectividad();
    
    if (resultado.exito) {
      colorPrint('✅ Conexión con Twilio exitosa', 'green');
      colorPrint(`  Cuenta: ${resultado.account.friendlyName}`, 'blue');
      colorPrint(`  Estado: ${resultado.account.status}`, 'blue');
      colorPrint(`  Tipo: ${resultado.account.type}`, 'blue');
      return true;
    } else {
      colorPrint('❌ Error en la conexión con Twilio', 'red');
      colorPrint(`  Error: ${resultado.error}`, 'red');
      if (resultado.codigo) {
        colorPrint(`  Código: ${resultado.codigo}`, 'red');
      }
      return false;
    }
  } catch (error) {
    colorPrint(`❌ Error al probar conectividad: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Valida el número de teléfono de prueba
 */
function validarNumeroTest() {
  printSeparator('VALIDACIÓN DE NÚMERO DE PRUEBA');
  
  const numeroTest = process.env.TEST_PHONE;
  if (!numeroTest) {
    colorPrint('❌ No se configuró TEST_PHONE en el archivo .env', 'red');
    return false;
  }
  
  colorPrint(`📱 Número de prueba configurado: ${numeroTest}`, 'blue');
  
  const numeroValidado = whatsappService.validarTelefono(numeroTest);
  if (numeroValidado) {
    colorPrint(`✅ Número válido para WhatsApp: ${numeroValidado}`, 'green');
    return true;
  } else {
    colorPrint('❌ El número de prueba no tiene un formato válido para Ecuador', 'red');
    colorPrint('💡 Formatos válidos:', 'yellow');
    colorPrint('   - 0999801901 (formato nacional)', 'yellow');
    colorPrint('   - 593999801901 (con código de país)', 'yellow');
    colorPrint('   - 999801901 (solo número)', 'yellow');
    return false;
  }
}

/**
 * Envía un mensaje de prueba
 */
async function enviarMensajePrueba() {
  printSeparator('ENVÍO DE MENSAJE DE PRUEBA');
  
  const numeroTest = process.env.TEST_PHONE;
  if (!numeroTest) {
    colorPrint('❌ No se puede enviar mensaje: TEST_PHONE no configurado', 'red');
    colorPrint('💡 Configura TEST_PHONE en tu .env con tu número personal ecuatoriano', 'yellow');
    colorPrint('   Ejemplo: TEST_PHONE=+593999801901', 'yellow');
    return false;
  }

  // Verificar que el número de WhatsApp de Twilio esté configurado
  const twilioWhatsAppFrom = process.env.TWILIO_WHATSAPP_FROM;
  if (!twilioWhatsAppFrom) {
    colorPrint('❌ No se puede enviar mensaje: TWILIO_WHATSAPP_FROM no configurado', 'red');
    colorPrint('💡 Configura TWILIO_WHATSAPP_FROM en tu .env', 'yellow');
    colorPrint('   Para desarrollo: TWILIO_WHATSAPP_FROM=whatsapp:+14155238886', 'yellow');
    colorPrint('   Para producción: usa tu número WhatsApp Business verificado', 'yellow');
    return false;
  }
  
  // Crear documento de prueba
  const documentoPrueba = {
    tipoDocumento: 'Escritura Pública',
    nombreCliente: 'USUARIO DE PRUEBA',
    codigoBarras: 'TEST20250618001',
    codigoVerificacion: '1234',
    notas: 'Compraventa de inmueble - PRUEBA'
  };
  
  try {
    colorPrint(`📱 Enviando mensaje de prueba a ${numeroTest}...`, 'blue');
    
    const resultado = await whatsappService.enviarNotificacionDocumentoListo(numeroTest, documentoPrueba);
    
    if (resultado.exito) {
      if (resultado.simulado) {
        colorPrint('✅ Mensaje de prueba simulado correctamente', 'green');
        colorPrint('💡 El mensaje se mostró en la consola (modo desarrollo)', 'yellow');
      } else {
        colorPrint('✅ Mensaje de prueba enviado exitosamente', 'green');
        colorPrint(`📱 Revisa tu WhatsApp en ${numeroTest}`, 'bright');
        if (resultado.respuestaApi?.sid) {
          colorPrint(`  SID de Twilio: ${resultado.respuestaApi.sid}`, 'blue');
        }
      }
      
      colorPrint('\n📋 Detalles del envío:', 'bright');
      colorPrint(`  Destinatario original: ${resultado.destinatario}`, 'blue');
      if (resultado.destinatarioFinal !== resultado.destinatario) {
        colorPrint(`  Destinatario final (TEST_MODE): ${resultado.destinatarioFinal}`, 'yellow');
      }
      colorPrint(`  Timestamp: ${resultado.timestamp}`, 'blue');
      colorPrint(`  Configuración: ${resultado.configuracion || 'desarrollo'}`, 'blue');
      
      return true;
    } else {
      colorPrint('❌ Error al enviar mensaje de prueba', 'red');
      colorPrint(`  Error: ${resultado.error}`, 'red');
      if (resultado.codigo) {
        colorPrint(`  Código: ${resultado.codigo}`, 'red');
        
        // Proporcionar ayuda específica según el error
        if (resultado.codigo === '20003') {
          colorPrint('\n💡 SOLUCIÓN para Error 20003:', 'yellow');
          colorPrint('  1. Ve a: https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn', 'yellow');
          colorPrint('  2. Envía el código de activación desde tu WhatsApp personal', 'yellow');
          colorPrint('  3. Verifica que tu número esté en el Sandbox', 'yellow');
        } else if (resultado.codigo === '20404') {
          colorPrint('\n💡 SOLUCIÓN para Error 20404:', 'yellow');
          colorPrint('  1. Verifica TWILIO_ACCOUNT_SID en tu .env', 'yellow');
          colorPrint('  2. Verifica TWILIO_AUTH_TOKEN en tu .env', 'yellow');
          colorPrint('  3. Ve a https://console.twilio.com para obtener credenciales correctas', 'yellow');
        }
      }
      return false;
    }
  } catch (error) {
    colorPrint(`❌ Error inesperado al enviar mensaje: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Muestra instrucciones de configuración
 */
function mostrarInstrucciones() {
  printSeparator('INSTRUCCIONES DE CONFIGURACIÓN');
  
  colorPrint('📝 Para configurar WhatsApp con Twilio:', 'bright');
  colorPrint('', 'reset');
  colorPrint('1. 🔐 Obtener credenciales de Twilio:', 'blue');
  colorPrint('   • Ve a https://console.twilio.com', 'reset');
  colorPrint('   • Crea una cuenta gratuita', 'reset');
  colorPrint('   • Copia tu Account SID y Auth Token', 'reset');
  colorPrint('', 'reset');
  
  colorPrint('2. 📱 Configurar WhatsApp Sandbox:', 'blue');
  colorPrint('   • Ve a https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn', 'reset');
  colorPrint('   • Envía el código de activación desde tu WhatsApp', 'reset');
  colorPrint('   • Copia el número del Sandbox (+14155238886)', 'reset');
  colorPrint('', 'reset');
  
  colorPrint('3. ⚙️ Configurar archivo .env:', 'blue');
  colorPrint('   TWILIO_ACCOUNT_SID=tu_account_sid', 'yellow');
  colorPrint('   TWILIO_AUTH_TOKEN=tu_auth_token', 'yellow');
  colorPrint('   TWILIO_WHATSAPP_FROM=whatsapp:+14155238886', 'yellow');
  colorPrint('   TEST_MODE=true', 'yellow');
  colorPrint('   TEST_PHONE=+593999801901  # Tu número personal', 'yellow');
  colorPrint('   WHATSAPP_ENABLED=true', 'yellow');
  colorPrint('', 'reset');
  
  colorPrint('4. 🧪 Ejecutar esta prueba:', 'blue');
  colorPrint('   node scripts/test-whatsapp.js', 'green');
  colorPrint('', 'reset');
  
  colorPrint('📄 Plantilla de configuración:', 'blue');
  colorPrint('   • Ve a docs-cursor-temp/env.example', 'reset');
  colorPrint('   • Copia y renombra como .env en la raíz', 'reset');
  colorPrint('   • Completa con tus credenciales reales', 'reset');
}

/**
 * Función principal
 */
async function main() {
  try {
    console.clear();
    printSeparator('PRUEBA DE WHATSAPP CON TWILIO');
    
    colorPrint('🚀 Iniciando prueba del servicio de WhatsApp...', 'bright');
    colorPrint('', 'reset');
    
    // 1. Verificar configuración
    const configuracionValida = verificarConfiguracion();
    
    if (!configuracionValida) {
      colorPrint('\n❌ La configuración no es válida. No se puede continuar.', 'red');
      mostrarInstrucciones();
      process.exit(1);
    }
    
    // 2. Mostrar información del servicio
    const servicioOk = await mostrarInformacionServicio();
    
    if (!servicioOk) {
      colorPrint('\n❌ El servicio no se inicializó correctamente.', 'red');
      process.exit(1);
    }
    
    // 3. Probar conectividad con Twilio
    const conectividadOk = await probarConectividad();
    
    if (!conectividadOk) {
      colorPrint('\n⚠️ No se pudo conectar con Twilio, pero se puede continuar en modo simulado.', 'yellow');
    }
    
    // 4. Validar número de prueba
    const numeroValido = validarNumeroTest();
    
    if (!numeroValido) {
      colorPrint('\n❌ El número de prueba no es válido.', 'red');
      process.exit(1);
    }
    
    // 5. Enviar mensaje de prueba
    const mensajeEnviado = await enviarMensajePrueba();
    
    // 6. Resultado final
    printSeparator('RESULTADO FINAL');
    
    if (mensajeEnviado) {
      colorPrint('🎉 ¡PRUEBA EXITOSA!', 'green');
      colorPrint('✅ El servicio de WhatsApp está funcionando correctamente', 'green');
      
      if (process.env.TEST_MODE === 'true') {
        colorPrint('\n💡 Próximos pasos:', 'blue');
        colorPrint('  • Para producción: cambia TEST_MODE=false en tu .env', 'blue');
        colorPrint('  • Configura un número WhatsApp Business verificado', 'blue');
        colorPrint('  • Solicita aprobación para tu aplicación en Twilio', 'blue');
      }
    } else {
      colorPrint('❌ LA PRUEBA FALLÓ', 'red');
      colorPrint('   Revisa los errores mostrados arriba', 'red');
      mostrarInstrucciones();
      process.exit(1);
    }
    
  } catch (error) {
    printSeparator('ERROR FATAL');
    colorPrint(`❌ Error inesperado: ${error.message}`, 'red');
    console.error(error.stack);
    process.exit(1);
  }
}

// Ejecutar solo si es el archivo principal
if (require.main === module) {
  main();
}

module.exports = {
  verificarConfiguracion,
  mostrarInformacionServicio,
  probarConectividad,
  validarNumeroTest,
  enviarMensajePrueba
}; 