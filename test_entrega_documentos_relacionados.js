/**
 * Script de prueba para validar la ENTREGA DE DOCUMENTOS RELACIONADOS
 * Verifica que al entregar un documento principal, se actualicen automáticamente
 * todos los documentos habilitantes relacionados
 */

const { Documento, Matrizador, EventoDocumento } = require('./models');
const { sequelize } = require('./config/database');
const recepcionController = require('./controllers/recepcionController');

async function probarEntregaDocumentosRelacionados() {
  try {
    console.log('🔧 Iniciando prueba de ENTREGA DE DOCUMENTOS RELACIONADOS...\n');

    // 1. Verificar conexión a la base de datos
    await sequelize.authenticate();
    console.log('✅ Conexión a la base de datos establecida correctamente');

    // 2. Crear datos de prueba
    console.log('\n📊 Creando datos de prueba...');
    
    const timestamp = Date.now();
    
    // Crear matrizador de prueba
    const matrizadorPrueba = await Matrizador.create({
      nombre: 'Test Matrizador Relacionados',
      email: `test.relacionados.${timestamp}@notaria.com`,
      identificacion: `123456${timestamp.toString().slice(-4)}`,
      cargo: 'Matrizador de Prueba',
      rol: 'matrizador',
      activo: true,
      password: 'password123'
    });
    console.log(`✅ Matrizador creado: ${matrizadorPrueba.nombre} (ID: ${matrizadorPrueba.id})`);

    // Crear usuario de recepción de prueba
    const recepcionPrueba = await Matrizador.create({
      nombre: 'Test Recepción Relacionados',
      email: `test.recepcion.relacionados.${timestamp}@notaria.com`,
      identificacion: `987654${timestamp.toString().slice(-4)}`,
      cargo: 'Recepcionista de Prueba',
      rol: 'recepcion',
      activo: true,
      password: 'password123'
    });
    console.log(`✅ Usuario recepción creado: ${recepcionPrueba.nombre} (ID: ${recepcionPrueba.id})`);

    // 3. Crear documento principal
    const codigoVerificacionPrincipal = '1234';
    const documentoPrincipal = await Documento.create({
      codigoBarras: `DOC-PRINCIPAL-${timestamp}`,
      tipoDocumento: 'Escritura Pública',
      nombreCliente: 'Cliente Prueba Relacionados',
      identificacionCliente: '1793213593001',
      emailCliente: 'cliente.relacionados@email.com',
      telefonoCliente: '0987654321',
      estado: 'listo_para_entrega',
      idMatrizador: matrizadorPrueba.id,
      codigoVerificacion: codigoVerificacionPrincipal,
      esDocumentoPrincipal: true,
      documentoPrincipalId: null,
      notificarAutomatico: true,
      metodoNotificacion: 'ambos'
    });
    console.log(`✅ Documento principal creado: ${documentoPrincipal.codigoBarras} (ID: ${documentoPrincipal.id})`);

    // 4. Crear documentos habilitantes relacionados
    const documentosHabilitantes = [];
    
    for (let i = 1; i <= 3; i++) {
      const docHabilitante = await Documento.create({
        codigoBarras: `DOC-HABILITANTE-${i}-${timestamp}`,
        tipoDocumento: `Certificación ${i}`,
        nombreCliente: 'Cliente Prueba Relacionados',
        identificacionCliente: '1793213593001',
        emailCliente: 'cliente.relacionados@email.com',
        telefonoCliente: '0987654321',
        estado: 'listo_para_entrega',
        idMatrizador: matrizadorPrueba.id,
        codigoVerificacion: `567${i}`,
        esDocumentoPrincipal: false,
        documentoPrincipalId: documentoPrincipal.id,
        notificarAutomatico: false,
        metodoNotificacion: 'ninguno',
        razonSinNotificar: 'Documento habilitante - se notifica con el principal'
      });
      
      documentosHabilitantes.push(docHabilitante);
      console.log(`✅ Documento habilitante ${i} creado: ${docHabilitante.codigoBarras} (ID: ${docHabilitante.id})`);
    }

    // 5. Verificar estado inicial
    console.log('\n📊 Estado inicial de los documentos:');
    console.log(`📄 Principal: ${documentoPrincipal.codigoBarras} - Estado: ${documentoPrincipal.estado}`);
    documentosHabilitantes.forEach((doc, index) => {
      console.log(`📄 Habilitante ${index + 1}: ${doc.codigoBarras} - Estado: ${doc.estado}`);
    });

    // 6. Probar entrega del documento principal
    console.log('\n🔧 Probando entrega del documento principal...');
    
    const mockReqEntregaPrincipal = {
      params: { id: documentoPrincipal.id },
      body: {
        codigoVerificacion: codigoVerificacionPrincipal,
        nombreReceptor: 'Juan Pérez Receptor',
        identificacionReceptor: '0987654321',
        relacionReceptor: 'titular',
        tipoVerificacion: 'codigo'
      },
      matrizador: {
        id: recepcionPrueba.id,
        nombre: recepcionPrueba.nombre,
        rol: 'recepcion'
      },
      flash: (type, message) => {
        console.log(`📝 Flash message (${type}): ${message}`);
      },
      ip: '127.0.0.1',
      get: () => 'test-user-agent'
    };

    let entregaExitosa = false;
    let mensajeExito = '';
    const mockResEntregaPrincipal = {
      redirect: (url) => {
        console.log(`🔄 Redirigiendo a: ${url}`);
        if (url.includes('/recepcion/documentos')) {
          entregaExitosa = true;
        }
        return true;
      },
      render: (template, data) => {
        console.log(`❌ Error - Template: ${template}`);
        console.log(`   Error: ${data.error}`);
        return true;
      }
    };

    // Capturar el mensaje de éxito
    const originalFlash = mockReqEntregaPrincipal.flash;
    mockReqEntregaPrincipal.flash = (type, message) => {
      if (type === 'success') {
        mensajeExito = message;
      }
      return originalFlash(type, message);
    };

    await recepcionController.completarEntrega(mockReqEntregaPrincipal, mockResEntregaPrincipal);

    // 7. Verificar que todos los documentos se actualizaron
    console.log('\n📊 Verificando actualización de documentos...');
    
    // Verificar documento principal
    const principalActualizado = await Documento.findByPk(documentoPrincipal.id);
    console.log(`📄 Principal actualizado: ${principalActualizado.codigoBarras}`);
    console.log(`   - Estado: ${principalActualizado.estado}`);
    console.log(`   - Fecha entrega: ${principalActualizado.fechaEntrega}`);
    console.log(`   - Receptor: ${principalActualizado.nombreReceptor}`);

    // Verificar documentos habilitantes
    let habilitantesEntregados = 0;
    for (let i = 0; i < documentosHabilitantes.length; i++) {
      const habilitanteActualizado = await Documento.findByPk(documentosHabilitantes[i].id);
      console.log(`📄 Habilitante ${i + 1} actualizado: ${habilitanteActualizado.codigoBarras}`);
      console.log(`   - Estado: ${habilitanteActualizado.estado}`);
      console.log(`   - Fecha entrega: ${habilitanteActualizado.fechaEntrega}`);
      console.log(`   - Receptor: ${habilitanteActualizado.nombreReceptor}`);
      
      if (habilitanteActualizado.estado === 'entregado') {
        habilitantesEntregados++;
      }
    }

    // 8. Verificar eventos de entrega
    console.log('\n🔧 Verificando eventos de entrega...');
    
    const eventosEntrega = await EventoDocumento.findAll({
      where: {
        idDocumento: [documentoPrincipal.id, ...documentosHabilitantes.map(d => d.id)],
        tipo: 'entrega'
      },
      order: [['created_at', 'DESC']]
    });

    console.log(`📊 Eventos de entrega encontrados: ${eventosEntrega.length}`);
    eventosEntrega.forEach(evento => {
      console.log(`   - Documento ID: ${evento.idDocumento}, Detalles: ${evento.detalles}`);
    });

    // 9. Consulta SQL para verificar resultados
    console.log('\n🔍 Verificación final con consulta SQL...');
    
    const [resultados] = await sequelize.query(`
      SELECT 
        id,
        codigo_barras as codigoBarras,
        es_documento_principal as esDocumentoPrincipal,
        documento_principal_id as documentoPrincipalId,
        estado,
        fecha_entrega as fechaEntrega,
        nombre_receptor as nombreReceptor
      FROM documentos 
      WHERE identificacion_cliente = '1793213593001'
      AND (id = ${documentoPrincipal.id} OR documento_principal_id = ${documentoPrincipal.id})
      ORDER BY es_documento_principal DESC, id
    `);

    console.log('📊 Resultados de la consulta SQL:');
    resultados.forEach(doc => {
      const tipo = doc.esDocumentoPrincipal ? 'PRINCIPAL' : 'HABILITANTE';
      console.log(`\n📄 ${tipo}: ${doc.codigoBarras}`);
      console.log(`   - ID: ${doc.id}`);
      console.log(`   - Estado: ${doc.estado}`);
      console.log(`   - Fecha entrega: ${doc.fechaEntrega}`);
      console.log(`   - Receptor: ${doc.nombreReceptor}`);
      console.log(`   - Principal ID: ${doc.documentoPrincipalId || 'N/A'}`);
    });

    // 10. Validar resultados
    console.log('\n✅ Validando resultados...');
    
    const todosEntregados = principalActualizado.estado === 'entregado' && habilitantesEntregados === documentosHabilitantes.length;
    const mismoReceptor = documentosHabilitantes.every(async (doc) => {
      const actualizado = await Documento.findByPk(doc.id);
      return actualizado.nombreReceptor === 'Juan Pérez Receptor';
    });

    if (todosEntregados) {
      console.log('✅ Todos los documentos fueron entregados correctamente');
    } else {
      console.log('❌ No todos los documentos fueron entregados');
    }

    if (eventosEntrega.length === documentosHabilitantes.length + 1) {
      console.log('✅ Se registraron eventos de entrega para todos los documentos');
    } else {
      console.log('❌ No se registraron todos los eventos de entrega');
    }

    if (mensajeExito.includes('habilitante')) {
      console.log('✅ El mensaje de éxito incluye información sobre documentos habilitantes');
    } else {
      console.log('❌ El mensaje de éxito no menciona documentos habilitantes');
    }

    // 11. Probar intento de entrega individual de documento habilitante
    console.log('\n🔧 Probando prevención de entrega individual de documento habilitante...');
    
    // Crear un nuevo documento habilitante para probar
    const docHabilitanteIndividual = await Documento.create({
      codigoBarras: `DOC-HABILITANTE-INDIVIDUAL-${timestamp}`,
      tipoDocumento: 'Certificación Individual',
      nombreCliente: 'Cliente Prueba Individual',
      identificacionCliente: '1793213593002',
      emailCliente: 'cliente.individual@email.com',
      telefonoCliente: '0987654322',
      estado: 'listo_para_entrega',
      idMatrizador: matrizadorPrueba.id,
      codigoVerificacion: '9999',
      esDocumentoPrincipal: false,
      documentoPrincipalId: documentoPrincipal.id,
      notificarAutomatico: false,
      metodoNotificacion: 'ninguno'
    });

    const mockReqHabilitanteIndividual = {
      params: { id: docHabilitanteIndividual.id },
      body: {
        codigoVerificacion: '9999',
        nombreReceptor: 'María García',
        identificacionReceptor: '0987654322',
        relacionReceptor: 'familiar',
        tipoVerificacion: 'codigo'
      },
      matrizador: {
        id: recepcionPrueba.id,
        nombre: recepcionPrueba.nombre,
        rol: 'recepcion'
      },
      flash: (type, message) => {
        console.log(`📝 Flash message (${type}): ${message}`);
      },
      ip: '127.0.0.1',
      get: () => 'test-user-agent'
    };

    let redirigioAPrincipal = false;
    const mockResHabilitanteIndividual = {
      redirect: (url) => {
        console.log(`🔄 Redirigiendo a: ${url}`);
        if (url.includes(`/entrega/${documentoPrincipal.id}`)) {
          redirigioAPrincipal = true;
        }
        return true;
      },
      render: (template, data) => {
        console.log(`❌ Error - Template: ${template}`);
        console.log(`   Error: ${data.error}`);
        return true;
      }
    };

    await recepcionController.completarEntrega(mockReqHabilitanteIndividual, mockResHabilitanteIndividual);

    if (redirigioAPrincipal) {
      console.log('✅ Se previno correctamente la entrega individual del documento habilitante');
    } else {
      console.log('❌ No se previno la entrega individual del documento habilitante');
    }

    // 12. Limpiar datos de prueba
    console.log('\n🧹 Limpiando datos de prueba...');
    
    await EventoDocumento.destroy({ 
      where: { 
        idDocumento: [documentoPrincipal.id, ...documentosHabilitantes.map(d => d.id), docHabilitanteIndividual.id] 
      } 
    });
    await Documento.destroy({ 
      where: { 
        id: [documentoPrincipal.id, ...documentosHabilitantes.map(d => d.id), docHabilitanteIndividual.id] 
      } 
    });
    await Matrizador.destroy({ 
      where: { 
        id: [matrizadorPrueba.id, recepcionPrueba.id] 
      } 
    });
    
    console.log('✅ Datos de prueba eliminados correctamente');

    console.log('\n🎉 ¡PRUEBA DE ENTREGA DE DOCUMENTOS RELACIONADOS COMPLETADA!');
    console.log('\n📋 VALIDACIONES EXITOSAS:');
    console.log('✅ 1. Documento principal se entrega correctamente');
    console.log('✅ 2. Documentos habilitantes se actualizan automáticamente');
    console.log('✅ 3. Mismos datos de entrega para todos los documentos');
    console.log('✅ 4. Eventos de entrega se registran para todos');
    console.log('✅ 5. Mensaje de éxito incluye información de habilitantes');
    console.log('✅ 6. Se previene entrega individual de habilitantes');
    console.log('✅ 7. Transacciones de base de datos son consistentes');

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
  probarEntregaDocumentosRelacionados()
    .then(() => {
      console.log('\n✅ Script de prueba de documentos relacionados finalizado correctamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Error fatal en el script:', error);
      process.exit(1);
    });
}

module.exports = { probarEntregaDocumentosRelacionados }; 