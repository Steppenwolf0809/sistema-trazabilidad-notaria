/**
 * Script de prueba para debuggear el error de valorFactura
 * Ejecutar con: node scripts/test-debug-valor-factura.js
 */

const { calcularValoresActualizados, calcularEstadoPago } = require('../utils/mathValidation');

console.log('🔍 INICIANDO DEBUG DEL ERROR VALOR FACTURA');
console.log('='.repeat(60));

// Simular documento problemático (como viene de la BD)
const documentoProblematico = {
  id: 155,
  valorFactura: null, // ❌ PROBLEMA: null en lugar de 2.06
  valorPagado: 0.00,
  valorPendiente: 0.00,
  valorRetenido: 0.00,
  estadoPago: 'pendiente',
  tieneRetencion: false
};

// Documento correcto
const documentoCorrecto = {
  id: 155,
  valorFactura: 2.06, // ✅ CORRECTO
  valorPagado: 0.00,
  valorPendiente: 2.06,
  valorRetenido: 0.00,
  estadoPago: 'pendiente',
  tieneRetencion: false
};

// Datos de retención
const datosRetencion = {
  numeroComprobanteRetencion: '001-002-000023591',
  razonSocialRetenedora: 'GRANCOMERCIO CIA. LTDA.',
  retencionIva: 0.27,
  retencionRenta: 0.18,
  totalRetenido: 0.45
};

console.log('📄 DOCUMENTO PROBLEMÁTICO:');
console.log('- ID:', documentoProblematico.id);
console.log('- Valor Factura:', documentoProblematico.valorFactura, '❌ NULL/UNDEFINED');
console.log('- Valor Pagado:', documentoProblematico.valorPagado);
console.log('- Valor Pendiente:', documentoProblematico.valorPendiente);
console.log('');

// PRUEBA 1: Reproducir el error
console.log('🧮 PRUEBA 1: Reproducir error con documento problemático');
console.log('-'.repeat(60));

try {
  const resultado1 = calcularValoresActualizados(documentoProblematico, 1.61, datosRetencion);
  console.log('✅ RESULTADO (inesperado):', resultado1);
} catch (error) {
  console.log('❌ ERROR REPRODUCIDO:', error.message);
  console.log('🔍 Stack trace:', error.stack);
}

console.log('');

// PRUEBA 2: Probar con documento correcto
console.log('🧮 PRUEBA 2: Probar con documento correcto');
console.log('-'.repeat(60));

try {
  const resultado2 = calcularValoresActualizados(documentoCorrecto, 1.61, datosRetencion);
  console.log('✅ RESULTADO CORRECTO:', resultado2);
} catch (error) {
  console.log('❌ ERROR INESPERADO:', error.message);
}

console.log('');

// PRUEBA 3: Probar calcularEstadoPago directamente
console.log('🧮 PRUEBA 3: Probar calcularEstadoPago directamente');
console.log('-'.repeat(60));

try {
  const estado1 = calcularEstadoPago(documentoProblematico);
  console.log('✅ Estado problemático:', estado1);
} catch (error) {
  console.log('❌ ERROR EN CALCULAR ESTADO:', error.message);
}

try {
  const estado2 = calcularEstadoPago(documentoCorrecto);
  console.log('✅ Estado correcto:', estado2);
} catch (error) {
  console.log('❌ ERROR INESPERADO EN ESTADO:', error.message);
}

console.log('');

// PRUEBA 4: Simular diferentes tipos de valorFactura problemáticos
console.log('🧮 PRUEBA 4: Diferentes tipos de valorFactura problemáticos');
console.log('-'.repeat(60));

const casosProblematicos = [
  { valorFactura: null, descripcion: 'null' },
  { valorFactura: undefined, descripcion: 'undefined' },
  { valorFactura: 0, descripcion: 'cero' },
  { valorFactura: '', descripcion: 'string vacío' },
  { valorFactura: 'abc', descripcion: 'string no numérico' },
  { valorFactura: NaN, descripcion: 'NaN' }
];

casosProblematicos.forEach((caso, index) => {
  console.log(`\n📋 Caso ${index + 1}: valorFactura = ${caso.descripcion}`);
  
  const documentoTest = {
    ...documentoCorrecto,
    valorFactura: caso.valorFactura
  };
  
  try {
    const resultado = calcularEstadoPago(documentoTest);
    console.log(`✅ Resultado inesperado: ${resultado}`);
  } catch (error) {
    console.log(`❌ Error esperado: ${error.message}`);
  }
});

console.log('');
console.log('🎯 ANÁLISIS DEL PROBLEMA');
console.log('='.repeat(60));
console.log('✅ El error se reproduce cuando:');
console.log('   • valorFactura es null, undefined, 0, o string no numérico');
console.log('   • parseFloat(valorFactura) resulta en 0 o NaN');
console.log('');
console.log('🔧 POSIBLES CAUSAS EN EL SISTEMA:');
console.log('   • El documento no se está cargando correctamente de la BD');
console.log('   • El campo valorFactura no existe en el modelo');
console.log('   • Hay un problema en la consulta SQL');
console.log('   • El documento se está modificando antes de llegar a la función');
console.log('');
console.log('🔍 SIGUIENTE PASO:');
console.log('   • Verificar el log del controlador para ver qué documento se está pasando');
console.log('   • Revisar la consulta de base de datos');
console.log('   • Verificar el modelo Documento.js'); 