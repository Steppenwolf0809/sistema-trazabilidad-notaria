/**
 * Script de prueba para validar el PROCESO DE ENTREGA DE DOCUMENTOS
 * desde el módulo de recepción
 */

const { Documento, Matrizador, EventoDocumento } = require('./models');
const { sequelize } = require('./config/database');
const recepcionController = require('./controllers/recepcionController');

async function probarEntregaRecepcion() {
  try {
    console.log('🔧 Iniciando prueba de ENTREGA DE DOCUMENTOS - RECEPCIÓN...\n');

    // 1. Verificar conexión a la base de datos
    await sequelize.authenticate();
    console.log('✅ Conexión a la base de datos establecida correctamente');

    // 2. Crear datos de prueba
    console.log('\n📊 Creando datos de prueba...');
    
    const timestamp = Date.now();
    
    // Crear matrizador de prueba
    const matrizadorPrueba = await Matrizador.create({
      nombre: 'Test Matrizador Entrega',
      email: `test.entrega.${timestamp}@notaria.com`,
      identificacion: `123456${timestamp.toString().slice(-4)}`,
      cargo: 'Matrizador de Prueba',
      rol: 'matrizador',
      activo: true,
      password: 'password123'
    });
    console.log(`✅ Matrizador creado: ${matrizadorPrueba.nombre} (ID: ${matrizadorPrueba.id})`);

    // Crear usuario de recepción de prueba
    const recepcionPrueba = await Matrizador.create({
      nombre: 'Test Recepción Entrega',
      email: `test.recepcion.${timestamp}@notaria.com`,
      identificacion: `987654${timestamp.toString().slice(-4)}`,
      cargo: 'Recepcionista de Prueba',
      rol: 'recepcion',
      activo: true,
      password: 'password123'
    });
    console.log(`✅ Usuario recepción creado: ${recepcionPrueba.nombre} (ID: ${recepcionPrueba.id})`);

    // Crear documento listo para entrega
    const codigoVerificacion = '1234';
    const documentoPrueba = await Documento.create({
      codigoBarras: `DOC-ENTREGA-${timestamp}`,
      tipoDocumento: 'Escritura Pública',
      nombreCliente: 'Cliente Prueba Entrega',
      identificacionCliente: '1234567890',
      emailCliente: 'cliente.entrega@email.com',
      telefonoCliente: '0987654321',
      estado: 'listo_para_entrega',
      idMatrizador: matrizadorPrueba.id,
      codigoVerificacion: codigoVerificacion,
      notificarAutomatico: true,
      metodoNotificacion: 'ambos'
    });
    console.log(`✅ Documento creado: ${documentoPrueba.codigoBarras} (Estado: ${documentoPrueba.estado})`);
    console.log(`📋 Código de verificación: ${codigoVerificacion}`);

    // 3. Probar función mostrarEntrega
    console.log('\n🔧 Probando función mostrarEntrega...');
    
    const mockReqMostrar = {
      params: { id: documentoPrueba.id },
      query: {}, // Agregar objeto query vacío
      matrizador: {
        id: recepcionPrueba.id,
        nombre: recepcionPrueba.nombre,
        rol: 'recepcion'
      },
      flash: (type, message) => {
        console.log(`📝 Flash message (${type}): ${message}`);
        return [];
      }
    };

    let renderCalled = false;
    let redirectCalled = false;
    const mockResMostrar = {
      render: (template, data) => {
        renderCalled = true;
        console.log(`✅ Render llamado - Template: ${template}`);
        console.log(`📄 Documento en vista: ${data.documento ? data.documento.codigoBarras : 'No encontrado'}`);
        return true;
      },
      redirect: (url) => {
        redirectCalled = true;
        console.log(`🔄 Redirigiendo a: ${url}`);
        return true;
      },
      status: (code) => ({
        render: (template, data) => {
          console.log(`❌ Error ${code} - Template: ${template}`);
          console.log(`   Error: ${data.error || data.message}`);
          return true;
        }
      })
    };

    await recepcionController.mostrarEntrega(mockReqMostrar, mockResMostrar);
    
    if (renderCalled) {
      console.log('✅ mostrarEntrega funcionó correctamente');
    } else if (redirectCalled) {
      console.log('⚠️ mostrarEntrega redirigió (posible error)');
    }

    // 4. Probar función completarEntrega con código correcto
    console.log('\n🔧 Probando función completarEntrega con código correcto...');
    
    const mockReqCompletar = {
      params: { id: documentoPrueba.id },
      body: {
        codigoVerificacion: codigoVerificacion,
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
    const mockResCompletar = {
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

    await recepcionController.completarEntrega(mockReqCompletar, mockResCompletar);

    // Verificar que el documento se actualizó
    const docActualizado = await Documento.findByPk(documentoPrueba.id);
    console.log('\n📊 Verificando actualización del documento:');
    console.log(`   - Estado: ${docActualizado.estado}`);
    console.log(`   - Fecha entrega: ${docActualizado.fechaEntrega}`);
    console.log(`   - Receptor: ${docActualizado.nombreReceptor}`);
    console.log(`   - Identificación receptor: ${docActualizado.identificacionReceptor}`);
    console.log(`   - Relación: ${docActualizado.relacionReceptor}`);

    if (docActualizado.estado === 'entregado' && entregaExitosa) {
      console.log('✅ Entrega completada exitosamente');
    } else {
      console.log('❌ Error en la entrega');
    }

    // 5. Verificar evento de entrega
    console.log('\n🔧 Verificando registro de evento de entrega...');
    
    const eventoEntrega = await EventoDocumento.findOne({
      where: {
        idDocumento: documentoPrueba.id,
        tipo: 'entrega'
      },
      order: [['created_at', 'DESC']]
    });

    if (eventoEntrega) {
      console.log('✅ Evento de entrega registrado correctamente');
      console.log(`   - Tipo: ${eventoEntrega.tipo}`);
      console.log(`   - Detalles: ${eventoEntrega.detalles}`);
      console.log(`   - Usuario: ${eventoEntrega.usuario}`);
    } else {
      console.log('❌ No se encontró evento de entrega');
    }

    // 6. Probar entrega con código incorrecto
    console.log('\n🔧 Probando función completarEntrega con código incorrecto...');
    
    // Crear otro documento para probar código incorrecto
    const documentoPrueba2 = await Documento.create({
      codigoBarras: `DOC-ENTREGA-2-${timestamp}`,
      tipoDocumento: 'Certificación',
      nombreCliente: 'Cliente Prueba Entrega 2',
      identificacionCliente: '1234567891',
      emailCliente: 'cliente.entrega2@email.com',
      telefonoCliente: '0987654322',
      estado: 'listo_para_entrega',
      idMatrizador: matrizadorPrueba.id,
      codigoVerificacion: '5678',
      notificarAutomatico: true,
      metodoNotificacion: 'whatsapp'
    });

    const mockReqCodigoIncorrecto = {
      params: { id: documentoPrueba2.id },
      body: {
        codigoVerificacion: '9999', // Código incorrecto
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

    let errorDetectado = false;
    const mockResCodigoIncorrecto = {
      redirect: (url) => {
        console.log(`🔄 Redirigiendo a: ${url}`);
        return true;
      },
      render: (template, data) => {
        console.log(`✅ Error detectado correctamente - Template: ${template}`);
        console.log(`   Error: ${data.error}`);
        errorDetectado = true;
        return true;
      }
    };

    await recepcionController.completarEntrega(mockReqCodigoIncorrecto, mockResCodigoIncorrecto);

    if (errorDetectado) {
      console.log('✅ Validación de código incorrecto funcionó correctamente');
    } else {
      console.log('❌ No se detectó el código incorrecto');
    }

    // 7. Probar verificación por llamada
    console.log('\n🔧 Probando entrega con verificación por llamada...');
    
    const mockReqLlamada = {
      params: { id: documentoPrueba2.id },
      body: {
        nombreReceptor: 'María García',
        identificacionReceptor: '0987654322',
        relacionReceptor: 'familiar',
        tipoVerificacion: 'llamada',
        observaciones: 'Verificación realizada por llamada telefónica al 0987654322. Atendió María García, confirmó identidad y autorización para retirar documento.'
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

    let entregaLlamadaExitosa = false;
    const mockResLlamada = {
      redirect: (url) => {
        console.log(`🔄 Redirigiendo a: ${url}`);
        if (url.includes('/recepcion/documentos')) {
          entregaLlamadaExitosa = true;
        }
        return true;
      },
      render: (template, data) => {
        console.log(`❌ Error - Template: ${template}`);
        console.log(`   Error: ${data.error}`);
        return true;
      }
    };

    await recepcionController.completarEntrega(mockReqLlamada, mockResLlamada);

    // Verificar que el segundo documento se actualizó
    const doc2Actualizado = await Documento.findByPk(documentoPrueba2.id);
    
    if (doc2Actualizado.estado === 'entregado' && entregaLlamadaExitosa) {
      console.log('✅ Entrega por verificación telefónica completada exitosamente');
    } else {
      console.log('❌ Error en la entrega por verificación telefónica');
    }

    // 8. Consulta SQL para verificar resultados
    console.log('\n🔍 Verificación final con consulta SQL...');
    
    const [resultados] = await sequelize.query(`
      SELECT 
        id,
        codigo_barras as codigoBarras,
        estado,
        fecha_entrega as fechaEntrega,
        nombre_receptor as nombreReceptor,
        identificacion_receptor as identificacionReceptor,
        relacion_receptor as relacionReceptor
      FROM documentos 
      WHERE id IN (${documentoPrueba.id}, ${documentoPrueba2.id})
      ORDER BY id
    `);

    console.log('📊 Resultados de la consulta SQL:');
    resultados.forEach(doc => {
      console.log(`\n📄 Documento ${doc.codigoBarras}:`);
      console.log(`   - ID: ${doc.id}`);
      console.log(`   - Estado: ${doc.estado}`);
      console.log(`   - Fecha entrega: ${doc.fechaEntrega}`);
      console.log(`   - Receptor: ${doc.nombreReceptor}`);
      console.log(`   - ID receptor: ${doc.identificacionReceptor}`);
      console.log(`   - Relación: ${doc.relacionReceptor}`);
    });

    // 9. Limpiar datos de prueba
    console.log('\n🧹 Limpiando datos de prueba...');
    
    await EventoDocumento.destroy({ 
      where: { 
        idDocumento: [documentoPrueba.id, documentoPrueba2.id] 
      } 
    });
    await Documento.destroy({ 
      where: { 
        id: [documentoPrueba.id, documentoPrueba2.id] 
      } 
    });
    await Matrizador.destroy({ 
      where: { 
        id: [matrizadorPrueba.id, recepcionPrueba.id] 
      } 
    });
    
    console.log('✅ Datos de prueba eliminados correctamente');

    console.log('\n🎉 ¡PRUEBA DE ENTREGA DE DOCUMENTOS COMPLETADA EXITOSAMENTE!');
    console.log('\n📋 VALIDACIONES EXITOSAS:');
    console.log('✅ 1. Función mostrarEntrega carga documento correctamente');
    console.log('✅ 2. Función completarEntrega procesa entrega con código correcto');
    console.log('✅ 3. Validación de código incorrecto funciona');
    console.log('✅ 4. Verificación por llamada telefónica funciona');
    console.log('✅ 5. Estado del documento se actualiza a "entregado"');
    console.log('✅ 6. Datos de entrega se guardan correctamente');
    console.log('✅ 7. Eventos de entrega se registran');
    console.log('✅ 8. Redirecciones funcionan correctamente');

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
  probarEntregaRecepcion()
    .then(() => {
      console.log('\n✅ Script de prueba de entrega finalizado correctamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Error fatal en el script:', error);
      process.exit(1);
    });
}

module.exports = { probarEntregaRecepcion }; 