const { procesarFechaFactura } = require('./utils/documentoUtils');

console.log('🧪 PRUEBA DE procesarFechaFactura CORREGIDA');
console.log('='.repeat(50));

// Caso 1: Fecha válida del XML
console.log('📅 Caso 1: Fecha válida del XML');
const fechaXML = '20/06/2025';
const resultado1 = procesarFechaFactura(fechaXML);
console.log(`   Input: "${fechaXML}"`);
console.log(`   Output:`, resultado1);
console.log(`   Tipo:`, typeof resultado1);
console.log('');

// Caso 2: Fecha null (problema del documento 228)
console.log('📅 Caso 2: Fecha null (problema del documento 228)');
const fechaNull = null;
const resultado2 = procesarFechaFactura(fechaNull);
console.log(`   Input:`, fechaNull);
console.log(`   Output:`, resultado2);
console.log(`   Tipo:`, typeof resultado2);
console.log('');

// Caso 3: Fecha undefined
console.log('📅 Caso 3: Fecha undefined');
const fechaUndefined = undefined;
const resultado3 = procesarFechaFactura(fechaUndefined);
console.log(`   Input:`, fechaUndefined);
console.log(`   Output:`, resultado3);
console.log(`   Tipo:`, typeof resultado3);
console.log('');

// Caso 4: String vacío
console.log('📅 Caso 4: String vacío');
const fechaVacia = '';
const resultado4 = procesarFechaFactura(fechaVacia);
console.log(`   Input: "${fechaVacia}"`);
console.log(`   Output:`, resultado4);
console.log(`   Tipo:`, typeof resultado4);
console.log('');

console.log('✅ TODOS LOS CASOS PROBADOS');
console.log('💡 La función ahora devuelve fecha actual cuando no hay fecha XML'); 