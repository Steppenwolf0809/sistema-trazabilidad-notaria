/**
 * Script para verificar que todos los helpers de Handlebars estén disponibles
 */

const Handlebars = require('handlebars');

// Importar helpers
require('./utils/handlebarsHelpers');

console.log('🔍 Verificando helpers de Handlebars...\n');

// Lista de helpers que deberían estar disponibles
const helpersEsperados = [
  'formatDate',
  'formatDateEcuador', 
  'formatDateDocument',
  'formatDateTime',
  'formatMoney',
  'formatNumber',
  'eq',
  'ne', 
  'gt',
  'gte',
  'lt',
  'lte',
  'add',
  'subtract',
  'generatePageNumbers',
  'buildQueryString',
  'capitalize',
  'truncate',
  'pluralize',
  'ifCond',
  'getPriorityClass',
  'getPriorityText',
  'getPriorityIcon',
  'debug'
];

let todosDisponibles = true;

console.log('📋 Verificando helpers registrados:\n');

helpersEsperados.forEach(helper => {
  const disponible = Handlebars.helpers[helper] !== undefined;
  const icono = disponible ? '✅' : '❌';
  const estado = disponible ? 'DISPONIBLE' : 'FALTANTE';
  
  console.log(`${icono} ${helper}: ${estado}`);
  
  if (!disponible) {
    todosDisponibles = false;
  }
});

console.log('\n' + '='.repeat(50));

if (todosDisponibles) {
  console.log('✅ TODOS LOS HELPERS ESTÁN DISPONIBLES');
} else {
  console.log('❌ ALGUNOS HELPERS ESTÁN FALTANDO');
  console.log('💡 Revisa el archivo utils/handlebarsHelpers.js');
}

console.log('\n📊 Total de helpers registrados en Handlebars:', Object.keys(Handlebars.helpers).length);
console.log('📋 Helpers disponibles:', Object.keys(Handlebars.helpers).sort().join(', '));

console.log('\n🔍 Verificación completada.'); 