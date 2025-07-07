/**
 * Script de prueba para debuggear el problema de valorFactura
 * Simula una petición de registro de pago al documento ID 160
 */

const axios = require('axios');

async function testRegistrarPago() {
  try {
    console.log('🧪 INICIANDO PRUEBA DE REGISTRO DE PAGO');
    console.log('📋 Documento ID: 160');
    
    const datosParaPrueba = {
      documentoId: '160',
      monto: '100.00',
      formaPago: 'efectivo',
      numeroComprobante: 'TEST-001',
      observaciones: 'Prueba de debugging para valorFactura'
    };
    
    console.log('📦 Datos de la petición:', datosParaPrueba);
    
    // Realizar petición POST al servidor local
    const response = await axios.post('http://localhost:3000/caja/registrar-pago', datosParaPrueba, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 segundos de timeout
    });
    
    console.log('✅ Respuesta exitosa:', response.data);
    
  } catch (error) {
    console.log('❌ Error en la petición:');
    
    if (error.response) {
      // El servidor respondió con un error
      console.log('📋 Status:', error.response.status);
      console.log('📋 Datos del error:', error.response.data);
      console.log('📋 Headers:', error.response.headers);
    } else if (error.request) {
      // La petición se hizo pero no se recibió respuesta
      console.log('📋 Error de red:', error.request);
    } else {
      // Error al configurar la petición
      console.log('📋 Error de configuración:', error.message);
    }
  }
}

// Ejecutar la prueba
console.log('🚀 Ejecutando prueba de debugging...');
testRegistrarPago().then(() => {
  console.log('🏁 Prueba completada');
  process.exit(0);
}).catch(err => {
  console.error('💥 Error fatal:', err);
  process.exit(1);
}); 