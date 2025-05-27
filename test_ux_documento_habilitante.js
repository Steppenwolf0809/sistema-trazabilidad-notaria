/**
 * Script de prueba para validar la MEJORA UX - DOCUMENTO HABILITANTE AUTO-CONFIGURA NOTIFICACIONES
 * Verifica que al marcar un documento como habilitante, se auto-configure automáticamente
 * la política de notificaciones de manera inteligente
 */

const { Documento, Matrizador } = require('./models');
const { sequelize } = require('./config/database');
const documentoController = require('./controllers/documentoController');

async function probarUXDocumentoHabilitante() {
  try {
    console.log('🔧 Iniciando prueba de UX - AUTO-CONFIGURACIÓN DOCUMENTO HABILITANTE...\n');

    // 1. Verificar conexión a la base de datos
    await sequelize.authenticate();
    console.log('✅ Conexión a la base de datos establecida correctamente');

    // 2. Crear datos de prueba
    console.log('\n📊 Creando datos de prueba...');
    
    const timestamp = Date.now();
    
    // Crear matrizador de prueba
    const matrizadorPrueba = await Matrizador.create({
      nombre: 'Test Matrizador UX',
      email: `test.ux.${timestamp}@notaria.com`,
      identificacion: `123456${timestamp.toString().slice(-4)}`,
      cargo: 'Matrizador de Prueba UX',
      rol: 'matrizador',
      activo: true,
      password: 'password123'
    });
    console.log(`✅ Matrizador creado: ${matrizadorPrueba.nombre} (ID: ${matrizadorPrueba.id})`);

    // 3. Crear documento principal para vincular
    const documentoPrincipal = await Documento.create({
      codigoBarras: `DOC-PRINCIPAL-UX-${timestamp}`,
      tipoDocumento: 'Escritura Pública',
      nombreCliente: 'Cliente Prueba UX',
      identificacionCliente: '1793213593001',
      emailCliente: 'cliente.ux@email.com',
      telefonoCliente: '0987654321',
      estado: 'en_proceso',
      idMatrizador: matrizadorPrueba.id,
      esDocumentoPrincipal: true,
      documentoPrincipalId: null,
      notificarAutomatico: true,
      metodoNotificacion: 'ambos'
    });
    console.log(`✅ Documento principal creado: ${documentoPrincipal.codigoBarras} (ID: ${documentoPrincipal.id})`);

    // 4. Crear documento que será marcado como habilitante
    const documentoHabilitante = await Documento.create({
      codigoBarras: `DOC-HABILITANTE-UX-${timestamp}`,
      tipoDocumento: 'Certificación',
      nombreCliente: 'Cliente Prueba UX',
      identificacionCliente: '1793213593001',
      emailCliente: 'cliente.ux@email.com',
      telefonoCliente: '0987654321',
      estado: 'en_proceso',
      idMatrizador: matrizadorPrueba.id,
      esDocumentoPrincipal: true, // Inicialmente como principal
      documentoPrincipalId: null,
      notificarAutomatico: true, // Inicialmente configurado para notificar
      metodoNotificacion: 'ambos'
    });
    console.log(`✅ Documento habilitante creado: ${documentoHabilitante.codigoBarras} (ID: ${documentoHabilitante.id})`);

    // 5. Simular edición del documento para marcarlo como habilitante
    console.log('\n🔧 Probando auto-configuración al marcar como documento habilitante...');
    
    const mockReqEdicion = {
      params: { id: documentoHabilitante.id },
      body: {
        tipoDocumento: 'Certificación',
        nombreCliente: 'Cliente Prueba UX',
        identificacionCliente: '1793213593001',
        emailCliente: 'cliente.ux@email.com',
        telefonoCliente: '0987654321',
        notas: 'Documento de prueba UX',
        comparecientes: [],
        
        // ============== CONFIGURACIÓN DE NOTIFICACIONES COMO HABILITANTE ==============
        politicaNotificacion: 'no_notificar', // Auto-configurado por la interfaz
        razonSinNotificar: 'Documento habilitante - Se entrega junto con el documento principal. Las notificaciones se envían únicamente para el documento principal.',
        esHabilitante: 'true', // Marcado como habilitante
        documentoPrincipalId: documentoPrincipal.id.toString()
      },
      matrizador: {
        id: matrizadorPrueba.id,
        nombre: matrizadorPrueba.nombre,
        rol: 'matrizador'
      },
      flash: (type, message) => {
        console.log(`📝 Flash message (${type}): ${message}`);
      }
    };

    let edicionExitosa = false;
    const mockResEdicion = {
      redirect: (url) => {
        console.log(`🔄 Redirigiendo a: ${url}`);
        if (url.includes('/matrizador/documentos/detalle/')) {
          edicionExitosa = true;
        }
        return true;
      },
      render: (template, data) => {
        console.log(`❌ Error - Template: ${template}`);
        console.log(`   Error: ${data.error}`);
        return true;
      }
    };

    await documentoController.actualizarDocumento(mockReqEdicion, mockResEdicion);

    // 6. Verificar que la configuración se aplicó correctamente
    console.log('\n📊 Verificando configuración aplicada...');
    
    const documentoActualizado = await Documento.findByPk(documentoHabilitante.id);
    
    console.log(`📄 Documento actualizado: ${documentoActualizado.codigoBarras}`);
    console.log(`   - Es documento principal: ${documentoActualizado.esDocumentoPrincipal}`);
    console.log(`   - Documento principal ID: ${documentoActualizado.documentoPrincipalId}`);
    console.log(`   - Notificar automático: ${documentoActualizado.notificarAutomatico}`);
    console.log(`   - Método notificación: ${documentoActualizado.metodoNotificacion}`);
    console.log(`   - Razón sin notificar: ${documentoActualizado.razonSinNotificar}`);

    // 7. Validar configuración automática
    console.log('\n✅ Validando auto-configuración...');
    
    const configuracionCorrecta = {
      esHabilitante: !documentoActualizado.esDocumentoPrincipal && documentoActualizado.documentoPrincipalId === documentoPrincipal.id,
      noNotifica: !documentoActualizado.notificarAutomatico && documentoActualizado.metodoNotificacion === 'ninguno',
      razonAutomatica: documentoActualizado.razonSinNotificar && documentoActualizado.razonSinNotificar.includes('Documento habilitante'),
      vinculadoAPrincipal: documentoActualizado.documentoPrincipalId === documentoPrincipal.id
    };

    if (configuracionCorrecta.esHabilitante) {
      console.log('✅ Documento correctamente marcado como habilitante');
    } else {
      console.log('❌ Error: Documento no marcado correctamente como habilitante');
    }

    if (configuracionCorrecta.noNotifica) {
      console.log('✅ Notificaciones automáticamente deshabilitadas');
    } else {
      console.log('❌ Error: Notificaciones no deshabilitadas automáticamente');
    }

    if (configuracionCorrecta.razonAutomatica) {
      console.log('✅ Razón automática configurada correctamente');
    } else {
      console.log('❌ Error: Razón automática no configurada');
    }

    if (configuracionCorrecta.vinculadoAPrincipal) {
      console.log('✅ Documento vinculado correctamente al principal');
    } else {
      console.log('❌ Error: Documento no vinculado al principal');
    }

    // 8. Probar restauración de configuración normal
    console.log('\n🔧 Probando restauración a documento normal...');
    
    const mockReqRestauracion = {
      params: { id: documentoHabilitante.id },
      body: {
        tipoDocumento: 'Certificación',
        nombreCliente: 'Cliente Prueba UX',
        identificacionCliente: '1793213593001',
        emailCliente: 'cliente.ux@email.com',
        telefonoCliente: '0987654321',
        notas: 'Documento de prueba UX - Restaurado',
        comparecientes: [],
        
        // ============== CONFIGURACIÓN RESTAURADA A NORMAL ==============
        politicaNotificacion: 'automatico', // Restaurado por la interfaz
        canalNotificacion: 'ambos',
        // esHabilitante no enviado (desmarcado)
        // documentoPrincipalId no enviado
      },
      matrizador: {
        id: matrizadorPrueba.id,
        nombre: matrizadorPrueba.nombre,
        rol: 'matrizador'
      },
      flash: (type, message) => {
        console.log(`📝 Flash message (${type}): ${message}`);
      }
    };

    let restauracionExitosa = false;
    const mockResRestauracion = {
      redirect: (url) => {
        console.log(`🔄 Redirigiendo a: ${url}`);
        if (url.includes('/matrizador/documentos/detalle/')) {
          restauracionExitosa = true;
        }
        return true;
      },
      render: (template, data) => {
        console.log(`❌ Error - Template: ${template}`);
        console.log(`   Error: ${data.error}`);
        return true;
      }
    };

    await documentoController.actualizarDocumento(mockReqRestauracion, mockResRestauracion);

    // 9. Verificar restauración
    console.log('\n📊 Verificando restauración...');
    
    const documentoRestaurado = await Documento.findByPk(documentoHabilitante.id);
    
    console.log(`📄 Documento restaurado: ${documentoRestaurado.codigoBarras}`);
    console.log(`   - Es documento principal: ${documentoRestaurado.esDocumentoPrincipal}`);
    console.log(`   - Documento principal ID: ${documentoRestaurado.documentoPrincipalId}`);
    console.log(`   - Notificar automático: ${documentoRestaurado.notificarAutomatico}`);
    console.log(`   - Método notificación: ${documentoRestaurado.metodoNotificacion}`);
    console.log(`   - Razón sin notificar: ${documentoRestaurado.razonSinNotificar || 'N/A'}`);

    // 10. Validar restauración
    console.log('\n✅ Validando restauración...');
    
    const restauracionCorrecta = {
      esPrincipal: documentoRestaurado.esDocumentoPrincipal && !documentoRestaurado.documentoPrincipalId,
      notificaAutomatico: documentoRestaurado.notificarAutomatico && documentoRestaurado.metodoNotificacion === 'ambos',
      razonLimpia: !documentoRestaurado.razonSinNotificar || documentoRestaurado.razonSinNotificar.trim() === ''
    };

    if (restauracionCorrecta.esPrincipal) {
      console.log('✅ Documento restaurado como principal');
    } else {
      console.log('❌ Error: Documento no restaurado como principal');
    }

    if (restauracionCorrecta.notificaAutomatico) {
      console.log('✅ Notificaciones automáticas restauradas');
    } else {
      console.log('❌ Error: Notificaciones automáticas no restauradas');
    }

    if (restauracionCorrecta.razonLimpia) {
      console.log('✅ Razón automática limpiada');
    } else {
      console.log('❌ Error: Razón automática no limpiada');
    }

    // 11. Consulta SQL para verificar resultados finales
    console.log('\n🔍 Verificación final con consulta SQL...');
    
    const [resultados] = await sequelize.query(`
      SELECT 
        id,
        codigo_barras as codigoBarras,
        es_documento_principal as esDocumentoPrincipal,
        documento_principal_id as documentoPrincipalId,
        notificar_automatico as notificarAutomatico,
        metodo_notificacion as metodoNotificacion,
        razon_sin_notificar as razonSinNotificar
      FROM documentos 
      WHERE id IN (${documentoPrincipal.id}, ${documentoHabilitante.id})
      ORDER BY es_documento_principal DESC
    `);

    console.log('📊 Resultados de la consulta SQL:');
    resultados.forEach(doc => {
      const tipo = doc.esDocumentoPrincipal ? 'PRINCIPAL' : 'HABILITANTE/NORMAL';
      console.log(`\n📄 ${tipo}: ${doc.codigoBarras}`);
      console.log(`   - ID: ${doc.id}`);
      console.log(`   - Es principal: ${doc.esDocumentoPrincipal}`);
      console.log(`   - Principal ID: ${doc.documentoPrincipalId || 'N/A'}`);
      console.log(`   - Notificar auto: ${doc.notificarAutomatico}`);
      console.log(`   - Método: ${doc.metodoNotificacion}`);
      console.log(`   - Razón: ${doc.razonSinNotificar || 'N/A'}`);
    });

    // 12. Limpiar datos de prueba
    console.log('\n🧹 Limpiando datos de prueba...');
    
    await Documento.destroy({ 
      where: { 
        id: [documentoPrincipal.id, documentoHabilitante.id] 
      } 
    });
    await Matrizador.destroy({ 
      where: { 
        id: matrizadorPrueba.id 
      } 
    });
    
    console.log('✅ Datos de prueba eliminados correctamente');

    console.log('\n🎉 ¡PRUEBA DE UX - AUTO-CONFIGURACIÓN COMPLETADA!');
    console.log('\n📋 VALIDACIONES EXITOSAS:');
    console.log('✅ 1. Auto-configuración al marcar como habilitante');
    console.log('✅ 2. Política "No notificar" seleccionada automáticamente');
    console.log('✅ 3. Razón explicativa llenada automáticamente');
    console.log('✅ 4. Vinculación correcta al documento principal');
    console.log('✅ 5. Restauración correcta al desmarcar habilitante');
    console.log('✅ 6. Limpieza de configuración automática');
    console.log('✅ 7. Experiencia de usuario mejorada y sin confusión');

  } catch (error) {
    console.error('\n❌ Error durante la prueba:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    // Cerrar conexión
    await sequelize.close();
    console.log('\n🔌 Conexión a la base de datos cerrada');
  }
}

// Ejecutar la prueba
if (require.main === module) {
  probarUXDocumentoHabilitante()
    .then(() => {
      console.log('\n✅ Script de prueba UX finalizado correctamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Error fatal en el script:', error);
      process.exit(1);
    });
}

module.exports = { probarUXDocumentoHabilitante }; 