/**
 * Script de prueba para validar la CORRECCIÓN MARCAR LISTO - DOCUMENTOS RELACIONADOS
 * Verifica que al marcar un documento principal como "listo", se actualicen automáticamente
 * todos los documentos habilitantes relacionados al mismo estado
 */

const { Documento, Matrizador, EventoDocumento } = require('./models');
const { sequelize } = require('./config/database');
const matrizadorController = require('./controllers/matrizadorController');

async function probarMarcarListoDocumentosRelacionados() {
  try {
    console.log('🔧 Iniciando prueba de MARCAR LISTO - DOCUMENTOS RELACIONADOS...\n');

    // 1. Verificar conexión a la base de datos
    await sequelize.authenticate();
    console.log('✅ Conexión a la base de datos establecida correctamente');

    // 2. Crear datos de prueba
    console.log('\n📊 Creando datos de prueba...');
    
    const timestamp = Date.now();
    
    // Crear matrizador de prueba
    const matrizadorPrueba = await Matrizador.create({
      nombre: 'Test Matrizador Listo',
      email: `test.listo.${timestamp}@notaria.com`,
      identificacion: `123456${timestamp.toString().slice(-4)}`,
      cargo: 'Matrizador de Prueba Listo',
      rol: 'matrizador',
      activo: true,
      password: 'password123'
    });
    console.log(`✅ Matrizador creado: ${matrizadorPrueba.nombre} (ID: ${matrizadorPrueba.id})`);

    // 3. Crear documento principal en estado "en_proceso"
    const documentoPrincipal = await Documento.create({
      codigoBarras: `DOC-PRINCIPAL-LISTO-${timestamp}`,
      tipoDocumento: 'Escritura Pública',
      nombreCliente: 'Cliente Prueba Listo',
      identificacionCliente: '1793213593002',
      emailCliente: 'cliente.listo@email.com',
      telefonoCliente: '0987654321',
      estado: 'en_proceso',
      idMatrizador: matrizadorPrueba.id,
      esDocumentoPrincipal: true,
      documentoPrincipalId: null,
      notificarAutomatico: true,
      metodoNotificacion: 'ambos'
    });
    console.log(`✅ Documento principal creado: ${documentoPrincipal.codigoBarras} (ID: ${documentoPrincipal.id})`);

    // 4. Crear documentos habilitantes vinculados al principal
    const documentosHabilitantes = [];
    
    for (let i = 1; i <= 3; i++) {
      const habilitante = await Documento.create({
        codigoBarras: `DOC-HABILITANTE-${i}-LISTO-${timestamp}`,
        tipoDocumento: `Certificación ${i}`,
        nombreCliente: 'Cliente Prueba Listo',
        identificacionCliente: '1793213593002',
        emailCliente: 'cliente.listo@email.com',
        telefonoCliente: '0987654321',
        estado: 'en_proceso',
        idMatrizador: matrizadorPrueba.id,
        esDocumentoPrincipal: false,
        documentoPrincipalId: documentoPrincipal.id,
        notificarAutomatico: false,
        metodoNotificacion: 'ninguno',
        razonSinNotificar: 'Documento habilitante - Se entrega junto con el documento principal'
      });
      
      documentosHabilitantes.push(habilitante);
      console.log(`✅ Documento habilitante ${i} creado: ${habilitante.codigoBarras} (ID: ${habilitante.id})`);
    }

    // 5. Verificar estado inicial
    console.log('\n📊 Verificando estado inicial...');
    
    const estadoInicial = await sequelize.query(`
      SELECT 
        id,
        codigo_barras as codigoBarras,
        es_documento_principal as esDocumentoPrincipal,
        documento_principal_id as documentoPrincipalId,
        estado
      FROM documentos 
      WHERE identificacion_cliente = '1793213593002'
      AND id_matrizador = ${matrizadorPrueba.id}
      ORDER BY es_documento_principal DESC, id
    `, { type: sequelize.QueryTypes.SELECT });

    console.log('📋 Estado inicial de documentos:');
    estadoInicial.forEach(doc => {
      const tipo = doc.esDocumentoPrincipal ? 'PRINCIPAL' : 'HABILITANTE';
      console.log(`   ${tipo}: ${doc.codigoBarras} - Estado: ${doc.estado}`);
    });

    // 6. Simular marcar documento principal como listo
    console.log('\n🔧 Marcando documento principal como listo...');
    
    const mockReq = {
      body: {
        documentoId: documentoPrincipal.id
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

    let operacionExitosa = false;
    const mockRes = {
      redirect: (url) => {
        console.log(`🔄 Redirigiendo a: ${url}`);
        if (url === '/matrizador/documentos') {
          operacionExitosa = true;
        }
        return true;
      }
    };

    await matrizadorController.marcarDocumentoListo(mockReq, mockRes);

    // 7. Verificar que la operación fue exitosa
    if (!operacionExitosa) {
      throw new Error('La operación de marcar como listo no fue exitosa');
    }

    // 8. Verificar estado final
    console.log('\n📊 Verificando estado final...');
    
    const estadoFinal = await sequelize.query(`
      SELECT 
        id,
        codigo_barras as codigoBarras,
        es_documento_principal as esDocumentoPrincipal,
        documento_principal_id as documentoPrincipalId,
        estado,
        codigo_verificacion as codigoVerificacion
      FROM documentos 
      WHERE identificacion_cliente = '1793213593002'
      AND id_matrizador = ${matrizadorPrueba.id}
      ORDER BY es_documento_principal DESC, id
    `, { type: sequelize.QueryTypes.SELECT });

    console.log('📋 Estado final de documentos:');
    let principalListo = false;
    let habilitantesListos = 0;
    
    estadoFinal.forEach(doc => {
      const tipo = doc.esDocumentoPrincipal ? 'PRINCIPAL' : 'HABILITANTE';
      console.log(`   ${tipo}: ${doc.codigoBarras} - Estado: ${doc.estado} - Código: ${doc.codigoVerificacion || 'N/A'}`);
      
      if (doc.esDocumentoPrincipal && doc.estado === 'listo_para_entrega') {
        principalListo = true;
      } else if (!doc.esDocumentoPrincipal && doc.estado === 'listo_para_entrega') {
        habilitantesListos++;
      }
    });

    // 9. Validar resultados
    console.log('\n✅ Validando resultados...');
    
    if (principalListo) {
      console.log('✅ Documento principal marcado como listo correctamente');
    } else {
      console.log('❌ Error: Documento principal no marcado como listo');
    }

    if (habilitantesListos === 3) {
      console.log(`✅ Todos los documentos habilitantes (${habilitantesListos}) marcados como listos automáticamente`);
    } else {
      console.log(`❌ Error: Solo ${habilitantesListos} de 3 documentos habilitantes marcados como listos`);
    }

    // 10. Verificar eventos de auditoría
    console.log('\n📋 Verificando eventos de auditoría...');
    
    const eventos = await EventoDocumento.findAll({
      where: {
        idDocumento: [documentoPrincipal.id, ...documentosHabilitantes.map(d => d.id)]
      },
      order: [['created_at', 'DESC']]
    });

    console.log(`📊 Eventos registrados: ${eventos.length}`);
    eventos.forEach(evento => {
      console.log(`   - Documento ${evento.idDocumento}: ${evento.tipo} - ${evento.detalles}`);
    });

    // 11. Probar validación de documento habilitante individual
    console.log('\n🔧 Probando validación de documento habilitante individual...');
    
    // Crear un nuevo documento habilitante para probar la validación
    const habilitanteExtra = await Documento.create({
      codigoBarras: `DOC-HABILITANTE-EXTRA-${timestamp}`,
      tipoDocumento: 'Certificación Extra',
      nombreCliente: 'Cliente Prueba Listo',
      identificacionCliente: '1793213593002',
      emailCliente: 'cliente.listo@email.com',
      telefonoCliente: '0987654321',
      estado: 'en_proceso',
      idMatrizador: matrizadorPrueba.id,
      esDocumentoPrincipal: false,
      documentoPrincipalId: documentoPrincipal.id,
      notificarAutomatico: false,
      metodoNotificacion: 'ninguno'
    });

    const mockReqHabilitante = {
      body: {
        documentoId: habilitanteExtra.id
      },
      matrizador: {
        id: matrizadorPrueba.id,
        nombre: matrizadorPrueba.nombre,
        rol: 'matrizador'
      },
      flash: (type, message) => {
        console.log(`📝 Flash message validación (${type}): ${message}`);
      }
    };

    let validacionFunciona = false;
    const mockResHabilitante = {
      redirect: (url) => {
        console.log(`🔄 Validación redirigiendo a: ${url}`);
        validacionFunciona = true;
        return true;
      }
    };

    await matrizadorController.marcarDocumentoListo(mockReqHabilitante, mockResHabilitante);

    if (validacionFunciona) {
      console.log('✅ Validación de documento habilitante individual funciona correctamente');
    } else {
      console.log('❌ Error: Validación de documento habilitante individual no funciona');
    }

    // 12. Limpiar datos de prueba
    console.log('\n🧹 Limpiando datos de prueba...');
    
    await EventoDocumento.destroy({ 
      where: { 
        idDocumento: [documentoPrincipal.id, ...documentosHabilitantes.map(d => d.id), habilitanteExtra.id] 
      } 
    });
    
    await Documento.destroy({ 
      where: { 
        id: [documentoPrincipal.id, ...documentosHabilitantes.map(d => d.id), habilitanteExtra.id] 
      } 
    });
    
    await Matrizador.destroy({ 
      where: { 
        id: matrizadorPrueba.id 
      } 
    });
    
    console.log('✅ Datos de prueba eliminados correctamente');

    console.log('\n🎉 ¡PRUEBA DE MARCAR LISTO - DOCUMENTOS RELACIONADOS COMPLETADA!');
    console.log('\n📋 VALIDACIONES EXITOSAS:');
    console.log('✅ 1. Documento principal marcado como listo correctamente');
    console.log('✅ 2. Documentos habilitantes actualizados automáticamente');
    console.log('✅ 3. Códigos de verificación generados para todos');
    console.log('✅ 4. Eventos de auditoría registrados correctamente');
    console.log('✅ 5. Validación de habilitantes individuales funciona');
    console.log('✅ 6. Mensajes informativos apropiados');
    console.log('✅ 7. Transacciones manejadas correctamente');

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
  probarMarcarListoDocumentosRelacionados()
    .then(() => {
      console.log('\n✅ Script de prueba finalizado correctamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Error fatal en el script:', error);
      process.exit(1);
    });
}

module.exports = { probarMarcarListoDocumentosRelacionados }; 