const axios = require('axios').default;

async function testMarcarListoAPI() {
  try {
    console.log('🧪 [TEST API] Probando marcar documento 249 como listo...');
    
    // Simular la petición exacta que hace el frontend
    const response = await axios.post('http://localhost:3000/matrizador/documentos/249/marcar-listo', {
      entrega_sin_verificar_pago: false,
      justificacion_entrega_sin_pago: '',
      accion_autorizacion: 'marcar_solo_documento',
      marcarTodoElGrupo: false
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        // Simular cookies de autenticación - necesitarías las cookies reales
        'Cookie': 'token=tu_token_aqui'
      },
      timeout: 30000
    });
    
    console.log('✅ [TEST API] Respuesta exitosa:');
    console.log('   Status:', response.status);
    console.log('   Data:', response.data);
    
  } catch (error) {
    console.log('❌ [TEST API] Error en la petición:');
    
    if (error.response) {
      // Error HTTP del servidor
      console.log('   Status:', error.response.status);
      console.log('   Status Text:', error.response.statusText);
      console.log('   Headers:', error.response.headers);
      console.log('   Data:', error.response.data);
    } else if (error.request) {
      // Error de red
      console.log('   Error de red:', error.message);
      console.log('   Code:', error.code);
    } else {
      // Error de configuración
      console.log('   Error de configuración:', error.message);
    }
  }
}

// Alternativa: Test directo sin autenticación para debug
async function testDirecto() {
  try {
    console.log('\n🔧 [TEST DIRECTO] Probando endpoint sin autenticación...');
    
    const response = await axios.get('http://localhost:3000/matrizador/documentos/obtener-datos/249', {
      timeout: 10000
    });
    
    console.log('✅ [TEST DIRECTO] Endpoint de datos responde:');
    console.log('   Status:', response.status);
    console.log('   Data:', response.data);
    
  } catch (error) {
    console.log('❌ [TEST DIRECTO] Error:');
    console.log('   Message:', error.message);
    if (error.response) {
      console.log('   Status:', error.response.status);
      console.log('   Data:', error.response.data);
    }
  }
}

console.log('🚀 Iniciando tests de API...\n');

// Ejecutar ambos tests
testMarcarListoAPI().then(() => {
  return testDirecto();
}).then(() => {
  console.log('\n✅ Tests completados');
  process.exit(0);
}).catch(err => {
  console.error('💥 Error fatal:', err);
  process.exit(1);
}); 