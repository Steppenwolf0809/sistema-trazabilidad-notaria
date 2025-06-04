/**
 * Script de prueba para verificar la corrección del documentoTemporal
 * Ejecutar con: node scripts/test-fix-documento-temporal.js
 */

const { calcularValoresActualizados } = require('../utils/mathValidation');

console.log('🔍 PROBANDO CORRECCIÓN DEL DOCUMENTO TEMPORAL');
console.log('='.repeat(60));

// Simular documento Sequelize (como viene del controlador)
const documentoSequelize = {
  id: 155,
  valorFactura: '2.06',
  valorPagado: '0.00',
  valorRetenido: '0.00',
  valorPendiente: '2.06',
  estadoPago: 'pendiente',
  tieneRetencion: false,
  codigoBarras: '20251701018C00923',
  // Simular propiedades de Sequelize que causan problemas con spread operator
  dataValues: { /* datos internos */ },
  _previousDataValues: { /* datos internos */ },
  _changed: new Set(),
  _options: { /* opciones */ },
  isNewRecord: false
};

// Datos de retención
const datosRetencion = {
  numeroComprobanteRetencion: '001-002-000023591',
  razonSocialRetenedora: 'GRANCOMERCIO CIA. LTDA.',
  retencionIva: 0.27,
  retencionRenta: 0.18,
  totalRetenido: 0.45
};

console.log('📄 DOCUMENTO SEQUELIZE SIMULADO:');
console.log('- ID:', documentoSequelize.id);
console.log('- Valor Factura:', documentoSequelize.valorFactura);
console.log('- Valor Pagado:', documentoSequelize.valorPagado);
console.log('- Valor Retenido:', documentoSequelize.valorRetenido);
console.log('- Estado Pago:', documentoSequelize.estadoPago);
console.log('');

console.log('💰 DATOS DE RETENCIÓN:');
console.log('- Total Retenido:', datosRetencion.totalRetenido);
console.log('- IVA:', datosRetencion.retencionIva);
console.log('- Renta:', datosRetencion.retencionRenta);
console.log('');

// PRUEBA: Calcular valores actualizados
console.log('🧮 PRUEBA: Calcular valores actualizados con corrección');
console.log('-'.repeat(60));

try {
  const resultado = calcularValoresActualizados(documentoSequelize, 1.61, datosRetencion);
  
  console.log('✅ RESULTADO EXITOSO:');
  console.log('- Valor Pagado:', resultado.valorPagado);
  console.log('- Valor Retenido:', resultado.valorRetenido);
  console.log('- Valor Pendiente:', resultado.valorPendiente);
  console.log('- Estado Pago:', resultado.estadoPago);
  console.log('- Tiene Retención:', resultado.tieneRetencion);
  
  // Verificar que el estado sea correcto
  if (resultado.estadoPago === 'pagado_con_retencion') {
    console.log('✅ ESTADO CORRECTO: pagado_con_retencion');
  } else {
    console.log('❌ ESTADO INCORRECTO:', resultado.estadoPago);
  }
  
  // Verificar cálculos
  const totalMovimiento = resultado.valorPagado + resultado.valorRetenido;
  const valorFacturaNum = parseFloat(documentoSequelize.valorFactura);
  
  if (Math.abs(totalMovimiento - valorFacturaNum) < 0.01) {
    console.log('✅ CÁLCULOS CORRECTOS: Total movimiento =', totalMovimiento);
  } else {
    console.log('❌ CÁLCULOS INCORRECTOS: Total movimiento =', totalMovimiento, 'vs Factura =', valorFacturaNum);
  }
  
} catch (error) {
  console.log('❌ ERROR:', error.message);
  console.log('🔍 Stack trace:', error.stack);
}

console.log('');
console.log('🎯 ANÁLISIS DE LA CORRECCIÓN');
console.log('='.repeat(60));
console.log('✅ PROBLEMA ANTERIOR:');
console.log('   • El spread operator (...documento) no copiaba correctamente las propiedades de Sequelize');
console.log('   • valorFactura se volvía undefined en documentoTemporal');
console.log('   • calcularEstadoPago fallaba con "valor de factura debe ser mayor a 0"');
console.log('');
console.log('✅ SOLUCIÓN IMPLEMENTADA:');
console.log('   • Crear documentoTemporal manualmente con propiedades específicas');
console.log('   • Preservar id, valorFactura, estadoPago del documento original');
console.log('   • Añadir valores calculados (valorPagado, valorRetenido, valorPendiente)');
console.log('');
console.log('✅ RESULTADO ESPERADO:');
console.log('   • valorFactura se preserva correctamente (2.06)');
console.log('   • calcularEstadoPago funciona sin errores');
console.log('   • Estado final: "pagado_con_retencion"');
console.log('   • Pago se registra exitosamente'); 