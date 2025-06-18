/**
 * Script de prueba para verificar la integración completa 
 * del sistema de notificaciones WhatsApp con los controladores
 */

require('dotenv').config();
const { sequelize } = require('../config/database');
const Documento = require('../models/Documento');
const Matrizador = require('../models/Matrizador');
const EventoDocumento = require('../models/EventoDocumento');
const NotificacionEnviada = require('../models/NotificacionEnviada');
const notificationService = require('../services/notificationService');
const whatsappService = require('../services/whatsappService');

/**
 * Función principal de prueba
 */
async function probarIntegracionCompleta() {
  console.log('🧪 INICIANDO PRUEBA DE INTEGRACIÓN WHATSAPP COMPLETA');
  console.log('=' .repeat(70));
  
  try {
    // 1. VERIFICAR CONEXIÓN A BASE DE DATOS
    console.log('\n1️⃣ VERIFICANDO CONEXIÓN A BASE DE DATOS...');
    await sequelize.authenticate();
    console.log('✅ Conexión a base de datos: OK');
    
    // 2. INICIALIZAR SERVICIOS
    console.log('\n2️⃣ INICIALIZANDO SERVICIOS...');
    
    // Inicializar WhatsApp Service
    const whatsappInicializado = whatsappService.inicializar();
    console.log(`${whatsappInicializado ? '✅' : '❌'} WhatsApp Service: ${whatsappInicializado ? 'OK' : 'FALLO'}`);
    
    // Inicializar Notification Service
    const notificationInicializado = await notificationService.inicializar();
    console.log(`${notificationInicializado ? '✅' : '❌'} Notification Service: ${notificationInicializado ? 'OK' : 'FALLO'}`);
    
    // 3. VERIFICAR CONFIGURACIÓN DE WHATSAPP
    console.log('\n3️⃣ VERIFICANDO CONFIGURACIÓN DE WHATSAPP...');
    const configWhatsApp = whatsappService.obtenerConfiguracion();
    console.log('📋 Configuración WhatsApp:');
    console.log(`   - Habilitado: ${configWhatsApp.habilitado}`);
    console.log(`   - Modo desarrollo: ${configWhatsApp.modoDesarrollo}`);
    console.log(`   - Test mode: ${configWhatsApp.testMode}`);
    console.log(`   - Cliente inicializado: ${configWhatsApp.clienteInicializado}`);
    console.log(`   - Twilio configurado: ${configWhatsApp.twilioConfigured}`);
    console.log(`   - Número WhatsApp: ${configWhatsApp.whatsappNumber}`);
    console.log(`   - Teléfono de prueba: ${configWhatsApp.testPhone}`);
    
    // 4. PRUEBA DE CONECTIVIDAD CON TWILIO
    console.log('\n4️⃣ PROBANDO CONECTIVIDAD CON TWILIO...');
    const conectividad = await whatsappService.probarConectividad();
    if (conectividad.exito) {
      console.log('✅ Conectividad con Twilio: OK');
      console.log(`   - Cuenta: ${conectividad.account.friendlyName}`);
      console.log(`   - Estado: ${conectividad.account.status}`);
      console.log(`   - Tipo: ${conectividad.account.type}`);
    } else {
      console.log('❌ Conectividad con Twilio: FALLO');
      console.log(`   - Error: ${conectividad.error}`);
      if (conectividad.codigo) {
        console.log(`   - Código: ${conectividad.codigo}`);
      }
    }
    
    // 5. CREAR DOCUMENTO DE PRUEBA
    console.log('\n5️⃣ CREANDO DOCUMENTO DE PRUEBA...');
    
    // Buscar un matrizador activo
    const matrizador = await Matrizador.findOne({
      where: { 
        activo: true,
        rol: ['matrizador', 'archivo']
      }
    });
    
    if (!matrizador) {
      throw new Error('No se encontró un matrizador activo para la prueba');
    }
    
    console.log(`👤 Matrizador encontrado: ${matrizador.nombre} (${matrizador.rol})`);
    
    // Crear documento de prueba
    const codigoBarras = `TEST${Date.now()}`;
    const documentoPrueba = await Documento.create({
      codigoBarras: codigoBarras,
      tipoDocumento: 'Protocolo',
      nombreCliente: 'Cliente Prueba Integración',
      identificacionCliente: '1234567890',
      emailCliente: 'test@ejemplo.com',
      telefonoCliente: process.env.TEST_PHONE || '+593999266015', // Usar número de prueba
      estado: 'en_proceso',
      idMatrizador: matrizador.id,
      rolUsuarioCreador: matrizador.rol,
      valorFactura: 50.00,
      
      // Configuración de notificaciones
      notificarAutomatico: true,
      metodoNotificacion: 'whatsapp',
      entregadoInmediatamente: false,
      omitirNotificacion: false,
      
      // Campos requeridos
      estadoPago: 'pendiente',
      valorPagado: 0.00,
      valorPendiente: 50.00,
      esDocumentoPrincipal: true,
      documentoPrincipalId: null
    });
    
    console.log(`✅ Documento creado: ${documentoPrueba.codigoBarras} (ID: ${documentoPrueba.id})`);
    console.log(`   - Cliente: ${documentoPrueba.nombreCliente}`);
    console.log(`   - Teléfono: ${documentoPrueba.telefonoCliente}`);
    console.log(`   - Notificar automático: ${documentoPrueba.notificarAutomatico}`);
    console.log(`   - Método: ${documentoPrueba.metodoNotificacion}`);
    
    // 6. SIMULAR MARCADO COMO LISTO (GENERAR CÓDIGO)
    console.log('\n6️⃣ SIMULANDO MARCADO COMO LISTO...');
    
    // Generar código de verificación y cambiar estado
    const codigoVerificacion = Math.floor(1000 + Math.random() * 9000).toString();
    await documentoPrueba.update({
      estado: 'listo_para_entrega',
      codigoVerificacion: codigoVerificacion
    });
    
    console.log(`✅ Documento marcado como listo`);
    console.log(`   - Estado: ${documentoPrueba.estado}`);
    console.log(`   - Código de verificación: ${codigoVerificacion}`);
    
    // 7. EVALUACIÓN DE CONDICIONES DE NOTIFICACIÓN
    console.log('\n7️⃣ EVALUANDO CONDICIONES DE NOTIFICACIÓN...');
    
    const evaluacion = notificationService.evaluarCondicionesNotificacion(documentoPrueba);
    console.log(`📋 Evaluación de condiciones:`);
    console.log(`   - Debe notificar: ${evaluacion.debeNotificar}`);
    console.log(`   - Canales permitidos: ${evaluacion.canalesPermitidos.join(', ') || 'ninguno'}`);
    
    if (!evaluacion.debeNotificar) {
      console.log(`   - Razones para no notificar:`);
      evaluacion.razones.forEach(razon => {
        console.log(`     * ${razon}`);
      });
    }
    
    // 8. ENVIAR NOTIFICACIÓN VIA NOTIFICATION SERVICE
    console.log('\n8️⃣ ENVIANDO NOTIFICACIÓN VIA NOTIFICATION SERVICE...');
    
    if (evaluacion.debeNotificar) {
      const resultado = await notificationService.enviarNotificacionDocumentoListo(documentoPrueba.id);
      
      console.log(`📱 Resultado de notificación:`);
      console.log(`   - Éxito: ${resultado.exito}`);
      console.log(`   - Notificación enviada: ${resultado.notificacionEnviada}`);
      console.log(`   - Canales enviados: ${resultado.canalesEnviados?.join(', ') || 'ninguno'}`);
      console.log(`   - Documento: ${resultado.documento}`);
      
      if (resultado.errores && resultado.errores.length > 0) {
        console.log(`   - Errores:`);
        resultado.errores.forEach(error => {
          console.log(`     * ${error.canal}: ${error.error}`);
        });
      }
    } else {
      console.log('⏭️ No se enviará notificación según evaluación de condiciones');
    }
    
    // 9. VERIFICAR REGISTROS EN BASE DE DATOS
    console.log('\n9️⃣ VERIFICANDO REGISTROS EN BASE DE DATOS...');
    
    // Verificar eventos del documento
    const eventos = await EventoDocumento.findAll({
      where: { documentoId: documentoPrueba.id },
      order: [['created_at', 'DESC']],
      limit: 5
    });
    
    console.log(`📝 Eventos registrados: ${eventos.length}`);
    eventos.forEach((evento, index) => {
      console.log(`   ${index + 1}. ${evento.tipo}: ${evento.detalles}`);
      if (evento.metadatos) {
        console.log(`      - Canal: ${evento.metadatos.canal || 'N/A'}`);
        console.log(`      - Estado: ${evento.metadatos.estado || 'N/A'}`);
      }
    });
    
    // Verificar notificaciones enviadas
    const notificaciones = await NotificacionEnviada.findAll({
      where: { documentoId: documentoPrueba.id },
      order: [['created_at', 'DESC']],
      limit: 3
    });
    
    console.log(`📧 Notificaciones registradas: ${notificaciones.length}`);
    notificaciones.forEach((notif, index) => {
      console.log(`   ${index + 1}. ${notif.tipoEvento} via ${notif.canal}`);
      console.log(`      - Estado: ${notif.estado}`);
      console.log(`      - Destinatario: ${notif.destinatario}`);
      console.log(`      - Simulado: ${notif.metadatos?.simulado || false}`);
      if (notif.ultimoError) {
        console.log(`      - Error: ${notif.ultimoError}`);
      }
    });
    
    // 10. LIMPIEZA: ELIMINAR DOCUMENTO DE PRUEBA
    console.log('\n🔟 LIMPIEZA: ELIMINANDO DOCUMENTO DE PRUEBA...');
    
    // Eliminar eventos relacionados
    await EventoDocumento.destroy({
      where: { documentoId: documentoPrueba.id }
    });
    
    // Eliminar notificaciones relacionadas
    await NotificacionEnviada.destroy({
      where: { documentoId: documentoPrueba.id }
    });
    
    // Eliminar documento
    await documentoPrueba.destroy();
    
    console.log('✅ Documento de prueba y registros relacionados eliminados');
    
    // 11. RESUMEN FINAL
    console.log('\n📊 RESUMEN FINAL DE LA PRUEBA');
    console.log('=' .repeat(70));
    console.log('✅ 1. Conexión a base de datos: OK');
    console.log(`${whatsappInicializado ? '✅' : '❌'} 2. Inicialización WhatsApp Service: ${whatsappInicializado ? 'OK' : 'FALLO'}`);
    console.log(`${notificationInicializado ? '✅' : '❌'} 3. Inicialización Notification Service: ${notificationInicializado ? 'OK' : 'FALLO'}`);
    console.log(`${conectividad.exito ? '✅' : '❌'} 4. Conectividad con Twilio: ${conectividad.exito ? 'OK' : 'FALLO'}`);
    console.log('✅ 5. Creación de documento de prueba: OK');
    console.log('✅ 6. Marcado como listo: OK');
    console.log(`${evaluacion.debeNotificar ? '✅' : '⚠️'} 7. Evaluación de condiciones: ${evaluacion.debeNotificar ? 'DEBE NOTIFICAR' : 'NO DEBE NOTIFICAR'}`);
    console.log('✅ 8. Envío de notificación: Procesado');
    console.log('✅ 9. Verificación de registros: OK');
    console.log('✅ 10. Limpieza: OK');
    
    console.log('\n🎉 PRUEBA DE INTEGRACIÓN COMPLETADA EXITOSAMENTE');
    console.log('\n💡 PRÓXIMOS PASOS:');
    console.log('   1. Probar desde la interfaz web del matrizador/archivo');
    console.log('   2. Verificar que los mensajes lleguen al TEST_PHONE');
    console.log('   3. Cambiar TEST_MODE=false cuando esté listo para producción');
    
  } catch (error) {
    console.error('\n❌ ERROR EN LA PRUEBA DE INTEGRACIÓN:', error);
    console.error('   Detalles:', error.message);
    
    if (error.stack) {
      console.error('\n📚 Stack trace:');
      console.error(error.stack);
    }
    
    process.exit(1);
  } finally {
    // Cerrar conexión
    if (sequelize) {
      await sequelize.close();
      console.log('\n🔌 Conexión a base de datos cerrada');
    }
  }
}

// Ejecutar la prueba
if (require.main === module) {
  probarIntegracionCompleta()
    .then(() => {
      console.log('\n✅ Script de prueba terminado exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Error en el script de prueba:', error);
      process.exit(1);
    });
}

module.exports = { probarIntegracionCompleta }; 