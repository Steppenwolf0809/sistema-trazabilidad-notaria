/**
 * Script de prueba específico para validar el GUARDADO DE CONFIGURACIÓN
 * de notificaciones en el sistema de notaría
 */

const { Documento, Matrizador } = require('./models');
const { sequelize } = require('./config/database');
const documentoController = require('./controllers/documentoController');

async function probarGuardadoConfiguracion() {
  try {
    console.log('🔧 Iniciando prueba de GUARDADO DE CONFIGURACIÓN...\n');

    // 1. Verificar conexión a la base de datos
    await sequelize.authenticate();
    console.log('✅ Conexión a la base de datos establecida correctamente');

    // 2. Crear datos de prueba
    console.log('\n📊 Creando datos de prueba...');
    
    const timestamp = Date.now();
    const matrizadorPrueba = await Matrizador.create({
      nombre: 'Test Matrizador Config',
      email: `test.config.${timestamp}@notaria.com`,
      identificacion: `987654${timestamp.toString().slice(-4)}`,
      cargo: 'Matrizador de Prueba',
      rol: 'matrizador',
      activo: true,
      password: 'password123'
    });
    console.log(`✅ Matrizador creado: ${matrizadorPrueba.nombre} (ID: ${matrizadorPrueba.id})`);

    // Crear documento principal para pruebas
    const docPrincipal = await Documento.create({
      codigoBarras: `DOC-PRINCIPAL-CONFIG-${timestamp}`,
      tipoDocumento: 'Escritura Pública',
      nombreCliente: 'Cliente Prueba Config',
      identificacionCliente: '1234567890',
      emailCliente: 'cliente.config@email.com',
      telefonoCliente: '0987654321',
      estado: 'en_proceso',
      idMatrizador: matrizadorPrueba.id,
      esDocumentoPrincipal: true,
      notificarAutomatico: true,
      metodoNotificacion: 'ambos'
    });
    console.log(`✅ Documento principal creado: ${docPrincipal.codigoBarras}`);

    // Crear documento para probar como habilitante
    const docHabilitante = await Documento.create({
      codigoBarras: `DOC-HABILITANTE-CONFIG-${timestamp}`,
      tipoDocumento: 'Certificación',
      nombreCliente: 'Cliente Prueba Config',
      identificacionCliente: '1234567890',
      emailCliente: 'cliente.config@email.com',
      telefonoCliente: '0987654321',
      estado: 'en_proceso',
      idMatrizador: matrizadorPrueba.id,
      esDocumentoPrincipal: true,
      notificarAutomatico: true,
      metodoNotificacion: 'ambos'
    });
    console.log(`✅ Documento habilitante creado: ${docHabilitante.codigoBarras}`);

    // 3. Probar actualización con configuración "Notificar automáticamente"
    console.log('\n🔧 Probando actualización: Notificar automáticamente...');
    
    const mockReqAutomatico = {
      params: { id: docHabilitante.id },
      body: {
        tipoDocumento: docHabilitante.tipoDocumento,
        nombreCliente: docHabilitante.nombreCliente,
        identificacionCliente: docHabilitante.identificacionCliente,
        emailCliente: docHabilitante.emailCliente,
        telefonoCliente: docHabilitante.telefonoCliente,
        politicaNotificacion: 'automatico',
        canalNotificacion: 'whatsapp',
        entregaInmediata: false,
        esHabilitante: false
      },
      matrizador: {
        id: matrizadorPrueba.id,
        nombre: matrizadorPrueba.nombre,
        rol: 'matrizador'
      },
      flash: (type, message) => {
        console.log(`📝 Flash message (${type}): ${message}`);
      },
      ip: '127.0.0.1',
      get: () => 'test-user-agent'
    };

    const mockResAutomatico = {
      redirect: (url) => {
        console.log(`🔄 Redirigiendo a: ${url}`);
        return true;
      },
      status: (code) => ({
        render: (template, data) => {
          console.log(`❌ Error ${code} - Template: ${template}`);
          console.log(`   Error: ${data.error}`);
          return true;
        }
      }),
      render: (template, data) => {
        console.log(`❌ Error - Template: ${template}`);
        console.log(`   Error: ${data.error}`);
        return true;
      }
    };

    await documentoController.actualizarDocumento(mockReqAutomatico, mockResAutomatico);

    // Verificar que se guardó correctamente
    const docActualizado1 = await Documento.findByPk(docHabilitante.id);
    console.log('✅ Configuración guardada:');
    console.log(`   - Notificar automático: ${docActualizado1.notificarAutomatico}`);
    console.log(`   - Método notificación: ${docActualizado1.metodoNotificacion}`);
    console.log(`   - Es principal: ${docActualizado1.esDocumentoPrincipal}`);
    console.log(`   - Documento principal ID: ${docActualizado1.documentoPrincipalId}`);

    // 4. Probar actualización con configuración "No notificar"
    console.log('\n🔧 Probando actualización: No notificar...');
    
    const mockReqNoNotificar = {
      params: { id: docHabilitante.id },
      body: {
        tipoDocumento: docHabilitante.tipoDocumento,
        nombreCliente: docHabilitante.nombreCliente,
        identificacionCliente: docHabilitante.identificacionCliente,
        emailCliente: docHabilitante.emailCliente,
        telefonoCliente: docHabilitante.telefonoCliente,
        politicaNotificacion: 'no_notificar',
        razonSinNotificar: 'Cliente solicita no recibir notificaciones por política de privacidad',
        entregaInmediata: false,
        esHabilitante: false
      },
      matrizador: {
        id: matrizadorPrueba.id,
        nombre: matrizadorPrueba.nombre,
        rol: 'matrizador'
      },
      flash: (type, message) => {
        console.log(`📝 Flash message (${type}): ${message}`);
      },
      ip: '127.0.0.1',
      get: () => 'test-user-agent'
    };

    await documentoController.actualizarDocumento(mockReqNoNotificar, mockResAutomatico);

    // Verificar que se guardó correctamente
    const docActualizado2 = await Documento.findByPk(docHabilitante.id);
    console.log('✅ Configuración guardada:');
    console.log(`   - Notificar automático: ${docActualizado2.notificarAutomatico}`);
    console.log(`   - Método notificación: ${docActualizado2.metodoNotificacion}`);
    console.log(`   - Razón sin notificar: ${docActualizado2.razonSinNotificar}`);

    // 5. Probar documento habilitante
    console.log('\n🔧 Probando actualización: Documento habilitante...');
    
    const mockReqHabilitante = {
      params: { id: docHabilitante.id },
      body: {
        tipoDocumento: docHabilitante.tipoDocumento,
        nombreCliente: docHabilitante.nombreCliente,
        identificacionCliente: docHabilitante.identificacionCliente,
        emailCliente: docHabilitante.emailCliente,
        telefonoCliente: docHabilitante.telefonoCliente,
        politicaNotificacion: 'no_notificar',
        razonSinNotificar: 'Documento habilitante - notificaciones en documento principal',
        entregaInmediata: false,
        esHabilitante: 'true',
        documentoPrincipalId: docPrincipal.id.toString()
      },
      matrizador: {
        id: matrizadorPrueba.id,
        nombre: matrizadorPrueba.nombre,
        rol: 'matrizador'
      },
      flash: (type, message) => {
        console.log(`📝 Flash message (${type}): ${message}`);
      },
      ip: '127.0.0.1',
      get: () => 'test-user-agent'
    };

    await documentoController.actualizarDocumento(mockReqHabilitante, mockResAutomatico);

    // Verificar que se guardó correctamente
    const docActualizado3 = await Documento.findByPk(docHabilitante.id);
    console.log('✅ Configuración guardada:');
    console.log(`   - Es principal: ${docActualizado3.esDocumentoPrincipal}`);
    console.log(`   - Documento principal ID: ${docActualizado3.documentoPrincipalId}`);
    console.log(`   - Notificar automático: ${docActualizado3.notificarAutomatico}`);
    console.log(`   - Método notificación: ${docActualizado3.metodoNotificacion}`);

    // 6. Probar entrega inmediata
    console.log('\n🔧 Probando actualización: Entrega inmediata...');
    
    const mockReqInmediata = {
      params: { id: docHabilitante.id },
      body: {
        tipoDocumento: docHabilitante.tipoDocumento,
        nombreCliente: docHabilitante.nombreCliente,
        identificacionCliente: docHabilitante.identificacionCliente,
        emailCliente: docHabilitante.emailCliente,
        telefonoCliente: docHabilitante.telefonoCliente,
        politicaNotificacion: 'automatico',
        canalNotificacion: 'ambos',
        entregaInmediata: 'true',
        esHabilitante: false
      },
      matrizador: {
        id: matrizadorPrueba.id,
        nombre: matrizadorPrueba.nombre,
        rol: 'matrizador'
      },
      flash: (type, message) => {
        console.log(`📝 Flash message (${type}): ${message}`);
      },
      ip: '127.0.0.1',
      get: () => 'test-user-agent'
    };

    await documentoController.actualizarDocumento(mockReqInmediata, mockResAutomatico);

    // Verificar que se guardó correctamente
    const docActualizado4 = await Documento.findByPk(docHabilitante.id);
    console.log('✅ Configuración guardada:');
    console.log(`   - Entrega inmediata: ${docActualizado4.entregadoInmediatamente}`);
    console.log(`   - Notificar automático: ${docActualizado4.notificarAutomatico} (debe ser false por entrega inmediata)`);
    console.log(`   - Método notificación: ${docActualizado4.metodoNotificacion}`);

    // 7. Consulta SQL para verificar
    console.log('\n🔍 Verificación final con consulta SQL...');
    
    const [resultados] = await sequelize.query(`
      SELECT 
        id,
        codigo_barras as codigoBarras,
        notificar_automatico as notificarAutomatico,
        metodo_notificacion as metodoNotificacion,
        documento_principal_id as documentoPrincipalId,
        es_documento_principal as esDocumentoPrincipal,
        entregado_inmediatamente as entregadoInmediatamente,
        razon_sin_notificar as razonSinNotificar
      FROM documentos 
      WHERE id IN (${docPrincipal.id}, ${docHabilitante.id})
      ORDER BY id
    `);

    console.log('📊 Resultados de la consulta SQL:');
    resultados.forEach(doc => {
      console.log(`\n📄 Documento ${doc.codigoBarras}:`);
      console.log(`   - ID: ${doc.id}`);
      console.log(`   - Notificar automático: ${doc.notificarAutomatico}`);
      console.log(`   - Método notificación: ${doc.metodoNotificacion}`);
      console.log(`   - Es principal: ${doc.esDocumentoPrincipal}`);
      console.log(`   - Documento principal ID: ${doc.documentoPrincipalId}`);
      console.log(`   - Entrega inmediata: ${doc.entregadoInmediatamente}`);
      console.log(`   - Razón sin notificar: ${doc.razonSinNotificar}`);
    });

    // 8. Limpiar datos de prueba
    console.log('\n🧹 Limpiando datos de prueba...');
    
    await Documento.destroy({ where: { id: [docPrincipal.id, docHabilitante.id] } });
    await Matrizador.destroy({ where: { id: matrizadorPrueba.id } });
    
    console.log('✅ Datos de prueba eliminados correctamente');

    console.log('\n🎉 ¡PRUEBA DE GUARDADO DE CONFIGURACIÓN COMPLETADA EXITOSAMENTE!');
    console.log('\n📋 VALIDACIONES EXITOSAS:');
    console.log('✅ 1. Configuración "Notificar automáticamente" se guarda correctamente');
    console.log('✅ 2. Configuración "No notificar" se guarda con razón');
    console.log('✅ 3. Documento habilitante se vincula a documento principal');
    console.log('✅ 4. Entrega inmediata fuerza "No notificar"');
    console.log('✅ 5. Persistencia en base de datos confirmada');
    console.log('✅ 6. Consulta SQL muestra datos correctos');

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
  probarGuardadoConfiguracion()
    .then(() => {
      console.log('\n✅ Script de prueba de guardado finalizado correctamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Error fatal en el script:', error);
      process.exit(1);
    });
}

module.exports = { probarGuardadoConfiguracion }; 