/**
 * Script para consultar directamente la base de datos y verificar el documento ID 160
 */

const { sequelize } = require('./config/database');
const Documento = require('./models/Documento');

async function debugDocumento160() {
  try {
    console.log('🔍 DEBUGGING DOCUMENTO ID 160 - CONSULTA DIRECTA A BASE DE DATOS');
    
    // Conectar a la base de datos
    await sequelize.authenticate();
    console.log('✅ Conexión a base de datos exitosa');
    
    // Consultar el documento con todos los campos
    const documento = await Documento.findByPk(160, {
      raw: true, // Devolver objeto plano en lugar de instancia de Sequelize
    });
    
    if (!documento) {
      console.log('❌ Documento ID 160 NO ENCONTRADO en la base de datos');
      return;
    }
    
    console.log('✅ Documento ID 160 encontrado');
    console.log('📋 ANÁLISIS COMPLETO DE CAMPOS:');
    
    // Mostrar todos los campos del documento
    Object.keys(documento).forEach(campo => {
      const valor = documento[campo];
      console.log(`  ${campo}: ${valor} (tipo: ${typeof valor})`);
    });
    
    console.log('\n🔬 ANÁLISIS ESPECÍFICO DE CAMPOS DE VALOR:');
    console.log('  📊 valorFactura:', documento.valorFactura);
    console.log('  📊 valor_factura:', documento.valor_factura);
    console.log('  📊 valorPagado:', documento.valorPagado);
    console.log('  📊 valor_pagado:', documento.valor_pagado);
    console.log('  📊 valorPendiente:', documento.valorPendiente);
    console.log('  📊 valor_pendiente:', documento.valor_pendiente);
    console.log('  📊 numeroFactura:', documento.numeroFactura);
    console.log('  📊 numero_factura:', documento.numero_factura);
    
    console.log('\n🧪 PRUEBAS DE VALIDACIÓN:');
    console.log('  ✓ valorFactura === null?:', documento.valorFactura === null);
    console.log('  ✓ valorFactura === undefined?:', documento.valorFactura === undefined);
    console.log('  ✓ valor_factura === null?:', documento.valor_factura === null);
    console.log('  ✓ valor_factura === undefined?:', documento.valor_factura === undefined);
    console.log('  ✓ valorFactura > 0?:', documento.valorFactura > 0);
    console.log('  ✓ valor_factura > 0?:', documento.valor_factura > 0);
    
    // Simular la lógica de validación del controlador
    const valorFacturaDocumento = documento.valorFactura || 
                                  documento.valor_factura || 
                                  documento.valorPendiente ||
                                  parseFloat(documento.valorFactura || 0) ||
                                  parseFloat(documento.valor_factura || 0);
    
    console.log('\n🔧 SIMULACIÓN DE VALIDACIÓN DEL CONTROLADOR:');
    console.log('  📊 valorFacturaDocumento calculado:', valorFacturaDocumento);
    console.log('  📊 Es válido (> 0)?:', valorFacturaDocumento > 0);
    console.log('  📊 Pasaría la validación?:', !(!valorFacturaDocumento || valorFacturaDocumento <= 0));
    
    // Verificar también el estado de pago
    console.log('\n💰 ESTADO DE PAGO:');
    console.log('  📊 estadoPago:', documento.estadoPago);
    console.log('  📊 estado_pago:', documento.estado_pago);
    console.log('  📊 metodoPago:', documento.metodoPago);
    console.log('  📊 metodo_pago:', documento.metodo_pago);
    console.log('  📊 fechaPago:', documento.fechaPago);
    console.log('  📊 fecha_pago:', documento.fecha_pago);
    
  } catch (error) {
    console.error('❌ Error en debugging:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    await sequelize.close();
    console.log('🔒 Conexión a base de datos cerrada');
  }
}

// Ejecutar el debugging
console.log('🚀 Iniciando debugging del documento ID 160...');
debugDocumento160().then(() => {
  console.log('🏁 Debugging completado');
  process.exit(0);
}).catch(err => {
  console.error('💥 Error fatal:', err);
  process.exit(1);
}); 