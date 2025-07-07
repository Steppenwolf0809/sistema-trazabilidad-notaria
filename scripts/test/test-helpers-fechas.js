const moment = require('moment-timezone');

console.log('🧪 TESTING HELPERS DE FECHA Y HORA');
console.log('=====================================');

// Simular una fecha de prueba
const fechaPrueba = new Date('2025-06-04T18:27:29.062Z');

console.log('📅 Fecha original:', fechaPrueba);
console.log('📅 ISO String:', fechaPrueba.toISOString());

// Probar formatDate
function formatDate(date) {
  if (!date) return '';
  try {
    // Usar momento con zona horaria de Ecuador
    return moment(date).tz('America/Guayaquil').format('DD/MM/YYYY');
  } catch (error) {
    console.error('Error en formatDate:', error);
    return '';
  }
}

// Probar formatTime  
function formatTime(date) {
  if (!date) return '';
  try {
    // Usar momento con zona horaria de Ecuador
    return moment(date).tz('America/Guayaquil').format('HH:mm:ss');
  } catch (error) {
    console.error('Error en formatTime:', error);
    return '';
  }
}

// Probar formatDateTime
function formatDateTime(date) {
  if (!date) return '';
  try {
    return moment(date).tz('America/Guayaquil').format('DD/MM/YYYY HH:mm:ss');
  } catch (error) {
    console.error('Error en formatDateTime:', error);
    return '';
  }
}

console.log('\n🔧 PRUEBAS DE HELPERS:');
console.log('formatDate:', formatDate(fechaPrueba));
console.log('formatTime:', formatTime(fechaPrueba));  
console.log('formatDateTime:', formatDateTime(fechaPrueba));

// Probar con fecha nula
console.log('\n🔧 PRUEBAS CON FECHA NULA:');
console.log('formatDate(null):', formatDate(null));
console.log('formatTime(null):', formatTime(null));
console.log('formatDateTime(null):', formatDateTime(null));

// Probar con fecha undefined
console.log('\n🔧 PRUEBAS CON FECHA UNDEFINED:');
console.log('formatDate(undefined):', formatDate(undefined));
console.log('formatTime(undefined):', formatTime(undefined));
console.log('formatDateTime(undefined):', formatDateTime(undefined));

console.log('\n✅ Test completado'); 