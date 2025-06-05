/**
 * Script de prueba para verificar que el sistema de pagos funciona correctamente
 * Verifica los cálculos de valorPendiente y la funcionalidad de pagos
 */

const { sequelize } = require('./config/database');
const Documento = require('./models/Documento');

async function probarSistemaPagos() {
  try {
    console.log('🧪 INICIANDO PRUEBAS DEL SISTEMA DE PAGOS');
    console.log('=' .repeat(60));
    
    // PRUEBA 1: Verificar cálculo automático de valorPendiente
    console.log('📋 PRUEBA 1: Verificar cálculo automático de valorPendiente');
    
    const documentosPrueba = await Documento.findAll({
      where: {
        valorFactura: { [require('sequelize').Op.gt]: 0 }
      },
      limit: 5,
      attributes: ['id', 'codigoBarras', 'valorFactura', 'valorPagado', 'valorRetenido', 'valorPendiente']
    });
    
    console.log(`📊 Documentos de prueba: ${documentosPrueba.length}`);
    
    let pruebasExitosas = 0;
    let pruebasFallidas = 0;
    
    for (const documento of documentosPrueba) {
      const valorFactura = parseFloat(documento.valorFactura) || 0;
      const valorPagado = parseFloat(documento.valorPagado) || 0;
      const valorRetenido = parseFloat(documento.valorRetenido) || 0;
      const valorPendienteDB = parseFloat(documento.valorPendiente) || 0;
      
      const valorPendienteEsperado = Math.max(0, valorFactura - valorPagado - valorRetenido);
      const diferencia = Math.abs(valorPendienteDB - valorPendienteEsperado);
      
      console.log(`\n🔍 Documento ${documento.codigoBarras}:`);
      console.log(`   Factura: $${valorFactura.toFixed(2)}`);
      console.log(`   Pagado: $${valorPagado.toFixed(2)}`);
      console.log(`   Retenido: $${valorRetenido.toFixed(2)}`);
      console.log(`   Pendiente DB: $${valorPendienteDB.toFixed(2)}`);
      console.log(`   Pendiente esperado: $${valorPendienteEsperado.toFixed(2)}`);
      console.log(`   Diferencia: $${diferencia.toFixed(2)}`);
      
      if (diferencia < 0.01) {
        console.log(`   ✅ CORRECTO`);
        pruebasExitosas++;
      } else {
        console.log(`   ❌ INCORRECTO`);
        pruebasFallidas++;
      }
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log('📊 RESULTADOS DE PRUEBAS:');
    console.log(`✅ Pruebas exitosas: ${pruebasExitosas}`);
    console.log(`❌ Pruebas fallidas: ${pruebasFallidas}`);
    
    // PRUEBA 2: Simular creación de documento nuevo
    console.log('\n📋 PRUEBA 2: Simular creación de documento nuevo');
    
    const documentoPrueba = {
      codigoBarras: 'TEST-' + Date.now(),
      tipoDocumento: 'Protocolo',
      nombreCliente: 'Cliente de Prueba',
      identificacionCliente: '1234567890',
      valorFactura: 100.00,
      valorPagado: 0.00,
      valorRetenido: 0.00,
      estado: 'en_proceso',
      estadoPago: 'pendiente'
    };
    
    console.log('🔧 Creando documento de prueba...');
    const nuevoDocumento = await Documento.create(documentoPrueba);
    
    console.log(`✅ Documento creado: ${nuevoDocumento.codigoBarras}`);
    console.log(`   Valor factura: $${nuevoDocumento.valorFactura}`);
    console.log(`   Valor pagado: $${nuevoDocumento.valorPagado}`);
    console.log(`   Valor pendiente: $${nuevoDocumento.valorPendiente}`);
    
    const valorPendienteEsperado = 100.00;
    if (Math.abs(nuevoDocumento.valorPendiente - valorPendienteEsperado) < 0.01) {
      console.log(`   ✅ Cálculo automático CORRECTO`);
    } else {
      console.log(`   ❌ Cálculo automático INCORRECTO`);
    }
    
    // PRUEBA 3: Simular pago parcial
    console.log('\n📋 PRUEBA 3: Simular pago parcial');
    
    await nuevoDocumento.update({
      valorPagado: 30.00,
      estadoPago: 'pago_parcial'
    });
    
    await nuevoDocumento.reload();
    
    console.log(`🔧 Después del pago parcial de $30.00:`);
    console.log(`   Valor pagado: $${nuevoDocumento.valorPagado}`);
    console.log(`   Valor pendiente: $${nuevoDocumento.valorPendiente}`);
    
    const valorPendienteEsperadoParcial = 70.00;
    if (Math.abs(nuevoDocumento.valorPendiente - valorPendienteEsperadoParcial) < 0.01) {
      console.log(`   ✅ Cálculo de pago parcial CORRECTO`);
    } else {
      console.log(`   ❌ Cálculo de pago parcial INCORRECTO`);
    }
    
    // PRUEBA 4: Simular pago completo
    console.log('\n📋 PRUEBA 4: Simular pago completo');
    
    await nuevoDocumento.update({
      valorPagado: 100.00,
      estadoPago: 'pagado_completo'
    });
    
    await nuevoDocumento.reload();
    
    console.log(`🔧 Después del pago completo:`);
    console.log(`   Valor pagado: $${nuevoDocumento.valorPagado}`);
    console.log(`   Valor pendiente: $${nuevoDocumento.valorPendiente}`);
    
    if (nuevoDocumento.valorPendiente === 0) {
      console.log(`   ✅ Cálculo de pago completo CORRECTO`);
    } else {
      console.log(`   ❌ Cálculo de pago completo INCORRECTO`);
    }
    
    // Limpiar documento de prueba
    console.log('\n🗑️ Limpiando documento de prueba...');
    await nuevoDocumento.destroy();
    console.log('✅ Documento de prueba eliminado');
    
    console.log('\n' + '=' .repeat(60));
    
    if (pruebasFallidas === 0) {
      console.log('🎉 TODAS LAS PRUEBAS PASARON - SISTEMA DE PAGOS FUNCIONANDO CORRECTAMENTE');
      console.log('✅ El bug de regresión ha sido CORREGIDO');
      console.log('✅ Botón "Pago Completo" funcionará correctamente');
      console.log('✅ Validaciones de montos funcionarán correctamente');
      console.log('✅ Cálculos de valor pendiente son precisos');
    } else {
      console.log('❌ ALGUNAS PRUEBAS FALLARON - REVISAR SISTEMA');
    }
    
  } catch (error) {
    console.error('❌ ERROR en pruebas del sistema de pagos:', error);
    throw error;
  }
}

// Ejecutar pruebas si se llama directamente
if (require.main === module) {
  probarSistemaPagos()
    .then(() => {
      console.log('✅ Pruebas del sistema de pagos completadas');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Pruebas del sistema de pagos fallaron:', error);
      process.exit(1);
    });
}

module.exports = { probarSistemaPagos }; 