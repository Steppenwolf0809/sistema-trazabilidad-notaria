/**
 * Script de Testing para Detección Automática de Tipos de Documento
 * Ejecutar con: node test_deteccion_tipos.js
 */

const { detectarTipoDocumento, inferirTipoDocumentoPorCodigo } = require('./utils/documentoUtils');

console.log('🧪 TESTING: Detección Automática de Tipos de Documento');
console.log('=' .repeat(60));

// Casos de prueba con códigos reales
const casosPrueba = [
  // Casos principales según especificación (posición 12, índice 11)
  { codigo: '20251701018P01149', esperado: 'Protocolo', descripcion: 'Protocolo notarial' },
  { codigo: '20251701018D00531', esperado: 'Diligencias', descripcion: 'Diligencia notarial' },
  { codigo: '20251701018C00123', esperado: 'Certificaciones', descripcion: 'Certificación' },
  { codigo: '20251701018A00456', esperado: 'Arrendamientos', descripcion: 'Contrato de arrendamiento' },
  { codigo: '20251701018O00789', esperado: 'Otros', descripcion: 'Otro tipo de documento' },
  
  // Casos edge
  { codigo: '12345678901P23456', esperado: 'Protocolo', descripcion: 'Protocolo con formato diferente' },
  { codigo: 'ABCDEFGHIJKD12345', esperado: 'Diligencias', descripcion: 'Código con letras (D en posición 12)' },
  { codigo: '123456789', esperado: 'Otros', descripcion: 'Código muy corto' },
  { codigo: '', esperado: 'Otros', descripcion: 'Código vacío' },
  { codigo: null, esperado: 'Otros', descripcion: 'Código nulo' },
  { codigo: undefined, esperado: 'Otros', descripcion: 'Código indefinido' },
  
  // Casos con letras minúsculas
  { codigo: '20251701018p01149', esperado: 'Protocolo', descripcion: 'Protocolo con letra minúscula' },
  { codigo: '20251701018d00531', esperado: 'Diligencias', descripcion: 'Diligencia con letra minúscula' },
  
  // Casos con letras no válidas
  { codigo: '20251701018X01149', esperado: 'Otros', descripcion: 'Letra no válida (X)' },
  { codigo: '20251701018Z00531', esperado: 'Otros', descripcion: 'Letra no válida (Z)' },
  
  // Casos adicionales para verificar posición correcta
  { codigo: 'ABCDEFGHIJKC12345', esperado: 'Certificaciones', descripcion: 'Certificación (C en posición 12)' },
  { codigo: 'XYZXYZXYZXYA98765', esperado: 'Arrendamientos', descripcion: 'Arrendamiento (A en posición 12)' }
];

console.log('🔍 Probando función detectarTipoDocumento():');
console.log('-'.repeat(60));

let exitosos = 0;
let fallidos = 0;

casosPrueba.forEach((caso, index) => {
  const resultado = detectarTipoDocumento(caso.codigo);
  const exito = resultado === caso.esperado;
  
  if (exito) {
    exitosos++;
    console.log(`✅ Test ${index + 1}: ${caso.descripcion}`);
    console.log(`   Código: "${caso.codigo}" → "${resultado}"`);
  } else {
    fallidos++;
    console.log(`❌ Test ${index + 1}: ${caso.descripcion}`);
    console.log(`   Código: "${caso.codigo}"`);
    console.log(`   Esperado: "${caso.esperado}", Obtenido: "${resultado}"`);
  }
  console.log('');
});

console.log('📊 RESULTADOS:');
console.log(`✅ Exitosos: ${exitosos}`);
console.log(`❌ Fallidos: ${fallidos}`);
console.log(`📈 Porcentaje de éxito: ${((exitosos / casosPrueba.length) * 100).toFixed(1)}%`);

console.log('\n' + '='.repeat(60));
console.log('🔄 Comparando con función legacy inferirTipoDocumentoPorCodigo():');
console.log('-'.repeat(60));

// Casos específicos para comparar legacy vs nueva función
const casosComparacion = [
  '20251701018P01149',
  '20251701018D00531', 
  'ESCRITURA123',
  'PODER456',
  'CERTIFICACION789'
];

casosComparacion.forEach(codigo => {
  const nuevo = detectarTipoDocumento(codigo);
  const legacy = inferirTipoDocumentoPorCodigo(codigo);
  
  console.log(`Código: "${codigo}"`);
  console.log(`  Nueva función: "${nuevo}"`);
  console.log(`  Función legacy: "${legacy}"`);
  console.log(`  ${nuevo === legacy ? '✅ Coinciden' : '⚠️ Diferentes'}`);
  console.log('');
});

console.log('🎯 MAPEO DE CÓDIGOS:');
console.log('P → Protocolo (Escrituras, Poderes, Testamentos, etc.)');
console.log('D → Diligencias (Diligencias, Reconocimientos, etc.)');
console.log('C → Certificaciones (Certificaciones, Copias, etc.)');
console.log('A → Arrendamientos (Contratos de arrendamiento)');
console.log('O → Otros (Documentos no clasificados)');

console.log('\n🔧 Para usar en producción:');
console.log('1. Ejecutar migración: npm run migrate');
console.log('2. Reiniciar servidor para cargar nuevos tipos');
console.log('3. Verificar que las vistas muestren los 5 tipos estandarizados');
console.log('4. Probar carga de XML con detección automática');

if (fallidos === 0) {
  console.log('\n🎉 ¡Todos los tests pasaron! La detección automática está funcionando correctamente.');
  process.exit(0);
} else {
  console.log('\n⚠️ Algunos tests fallaron. Revisar la implementación.');
  process.exit(1);
} 