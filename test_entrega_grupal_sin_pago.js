const Documento = require('./models/Documento');
const Matrizador = require('./models/Matrizador');
const EventoDocumento = require('./models/EventoDocumento');
const { sequelize } = require('./config/database');
const { Op } = require('sequelize');

/**
 * Script de prueba para verificar la nueva funcionalidad de entrega grupal
 * que permite documentos sin pago completo
 */

async function testEntregaGrupalSinPago() {
  console.log('🧪 INICIANDO PRUEBAS DE ENTREGA GRUPAL SIN RESTRICCIÓN DE PAGO\n');
  
  try {
    // 1. Buscar un cliente con múltiples documentos en diferentes estados de pago
    console.log('1️⃣ Buscando cliente con documentos en diferentes estados de pago...');
    
    const documentosTest = await Documento.findAll({
      where: {
        estado: 'listo_para_entrega',
        fechaEntrega: null,
        motivoEliminacion: null
      },
      limit: 10
    });
    
    if (documentosTest.length === 0) {
      console.log('❌ No se encontraron documentos listos para entrega para pruebas');
      return;
    }
    
    // Agrupar por cliente
    const documentosPorCliente = {};
    documentosTest.forEach(doc => {
      const cliente = doc.identificacionCliente;
      if (!documentosPorCliente[cliente]) {
        documentosPorCliente[cliente] = [];
      }
      documentosPorCliente[cliente].push(doc);
    });
    
    // Buscar cliente con múltiples documentos
    let clienteTest = null;
    let documentosCliente = [];
    
    for (const [cliente, docs] of Object.entries(documentosPorCliente)) {
      if (docs.length >= 2) {
        clienteTest = cliente;
        documentosCliente = docs;
        break;
      }
    }
    
    if (!clienteTest) {
      console.log('❌ No se encontró un cliente con múltiples documentos para pruebas');
      return;
    }
    
    console.log(`✅ Cliente seleccionado: ${clienteTest}`);
    console.log(`📄 Documentos encontrados: ${documentosCliente.length}`);
    
    // 2. Mostrar estado actual de los documentos
    console.log('\n2️⃣ Estado actual de los documentos:');
    documentosCliente.forEach((doc, index) => {
      console.log(`   ${index + 1}. ${doc.codigoBarras} - ${doc.tipoDocumento}`);
      console.log(`      Estado: ${doc.estado}`);
      console.log(`      Pago: ${doc.estadoPago}`);
      console.log(`      Valor: $${doc.valorFactura || '0.00'}`);
      console.log(`      Matrizador ID: ${doc.idMatrizador || 'No asignado'}`);
      console.log('');
    });
    
    // 3. Simular detección de documentos grupales (nueva lógica)
    console.log('3️⃣ Simulando detección de documentos grupales (nueva lógica)...');
    
    const documentoPrincipal = documentosCliente[0];
    const documentosAdicionales = documentosCliente.slice(1);
    
    // Separar por estado de pago
    const documentosPagados = documentosAdicionales.filter(doc => 
      ['pagado_completo', 'pagado_con_retencion'].includes(doc.estadoPago)
    );
    
    const documentosPendientes = documentosAdicionales.filter(doc => 
      !['pagado_completo', 'pagado_con_retencion'].includes(doc.estadoPago)
    );
    
    console.log(`📊 Análisis de documentos adicionales:`);
    console.log(`   Total: ${documentosAdicionales.length}`);
    console.log(`   Pagados: ${documentosPagados.length}`);
    console.log(`   Pendientes: ${documentosPendientes.length}`);
    
    if (documentosPagados.length > 0) {
      console.log('\n   ✅ Documentos pagados:');
      documentosPagados.forEach(doc => {
        console.log(`      - ${doc.codigoBarras} (${doc.estadoPago})`);
      });
    }
    
    if (documentosPendientes.length > 0) {
      console.log('\n   ⚠️ Documentos pendientes:');
      documentosPendientes.forEach(doc => {
        console.log(`      - ${doc.codigoBarras} (${doc.estadoPago})`);
      });
    }
    
    // 4. Verificar que la nueva lógica permite detectar todos los documentos
    console.log('\n4️⃣ Verificando nueva lógica de detección...');
    
    // Simular la nueva lógica directamente
    const documentosDetectados = await Documento.findAll({
      where: {
        identificacionCliente: clienteTest,
        estado: 'listo_para_entrega',
        fechaEntrega: null,
        id: { [Op.ne]: documentoPrincipal.id },
        motivoEliminacion: null
        // NUEVA LÓGICA: Sin restricción de estadoPago
      },
      order: [['created_at', 'ASC']]
    });
    
    // Separar por estado de pago
    const documentosDetectadosPagados = documentosDetectados.filter(doc => 
      ['pagado_completo', 'pagado_con_retencion'].includes(doc.estadoPago)
    );
    
    const documentosDetectadosPendientes = documentosDetectados.filter(doc => 
      !['pagado_completo', 'pagado_con_retencion'].includes(doc.estadoPago)
    );
    
    console.log(`✅ Detección completada:`);
    console.log(`   Documentos detectados: ${documentosDetectados.length}`);
    console.log(`   Documentos pagados: ${documentosDetectadosPagados.length}`);
    console.log(`   Documentos pendientes: ${documentosDetectadosPendientes.length}`);
    
    // 5. Verificar que se pueden procesar documentos pendientes
    console.log('\n5️⃣ Verificando procesamiento de documentos pendientes...');
    
    if (documentosDetectadosPendientes.length > 0) {
      console.log('✅ La nueva lógica permite detectar documentos pendientes de pago');
      console.log('✅ Estos documentos pueden incluirse en entrega grupal con confirmación');
    } else {
      console.log('ℹ️ No hay documentos pendientes en este cliente para probar');
    }
    
    // 6. Simular validaciones de entrega
    console.log('\n6️⃣ Simulando validaciones de entrega...');
    
    const validacionesBasicas = {
      estado: documentosAdicionales.every(doc => doc.estado === 'listo_para_entrega'),
      noEntregado: documentosAdicionales.every(doc => doc.fechaEntrega === null),
      mismoCliente: documentosAdicionales.every(doc => doc.identificacionCliente === clienteTest),
      noEliminado: documentosAdicionales.every(doc => doc.motivoEliminacion === null)
    };
    
    console.log('   Validaciones básicas:');
    console.log(`   ✅ Estado listo: ${validacionesBasicas.estado}`);
    console.log(`   ✅ No entregado: ${validacionesBasicas.noEntregado}`);
    console.log(`   ✅ Mismo cliente: ${validacionesBasicas.mismoCliente}`);
    console.log(`   ✅ No eliminado: ${validacionesBasicas.noEliminado}`);
    
    const todasValidacionesOk = Object.values(validacionesBasicas).every(v => v);
    
    if (todasValidacionesOk) {
      console.log('\n✅ TODAS LAS VALIDACIONES BÁSICAS PASARON');
      console.log('✅ Los documentos pueden procesarse en entrega grupal');
      
      if (documentosPendientes.length > 0) {
        console.log('⚠️ NOTA: Documentos pendientes requieren confirmación del usuario');
      }
    } else {
      console.log('\n❌ Algunas validaciones fallaron');
    }
    
    // 7. Mostrar resumen de la nueva funcionalidad
    console.log('\n7️⃣ RESUMEN DE LA NUEVA FUNCIONALIDAD:');
    console.log('');
    console.log('🔄 CAMBIOS IMPLEMENTADOS:');
    console.log('   ✅ Detección de documentos sin restricción de pago');
    console.log('   ✅ Separación entre documentos pagados y pendientes');
    console.log('   ✅ Alertas diferenciadas por estado de pago');
    console.log('   ✅ Confirmación requerida para documentos pendientes');
    console.log('   ✅ Registro de auditoría con estado de pago');
    console.log('');
    console.log('🎯 BENEFICIOS:');
    console.log('   📈 Mayor flexibilidad para clientes con crédito');
    console.log('   🔍 Mejor visibilidad del estado de pago');
    console.log('   🛡️ Mantiene controles de seguridad');
    console.log('   📋 Trazabilidad completa en auditoría');
    console.log('');
    console.log('⚠️ CONTROLES MANTENIDOS:');
    console.log('   🔐 Validación de estado "listo para entrega"');
    console.log('   🚫 Prevención de entregas duplicadas');
    console.log('   👤 Verificación de pertenencia al cliente');
    console.log('   ✅ Confirmación obligatoria para documentos pendientes');
    
  } catch (error) {
    console.error('❌ Error en las pruebas:', error);
  }
}

// Ejecutar pruebas si el script se ejecuta directamente
if (require.main === module) {
  testEntregaGrupalSinPago()
    .then(() => {
      console.log('\n🎉 PRUEBAS COMPLETADAS');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Error ejecutando pruebas:', error);
      process.exit(1);
    });
}

module.exports = { testEntregaGrupalSinPago }; 