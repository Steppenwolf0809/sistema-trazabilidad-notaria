/**
 * Script de prueba para verificar acceso de usuarios de caja
 */

const axios = require('axios');

async function testCajaAccess() {
  try {
    console.log('🧪 Iniciando pruebas de acceso para usuarios de caja...');
    
    const baseURL = 'http://localhost:3000';
    
    // Crear una instancia de axios con cookies habilitadas
    const client = axios.create({
      baseURL,
      withCredentials: true,
      timeout: 10000
    });
    
    console.log('1️⃣ Probando acceso a página de login...');
    const loginPageResponse = await client.get('/login');
    console.log('✅ Página de login accesible:', loginPageResponse.status === 200);
    
    console.log('2️⃣ Intentando login con usuario de caja...');
    
    // Datos de login para usuario de caja (ajustar según tus datos)
    const loginData = {
      email: 'caja@notaria.com', // Ajustar según tu base de datos
      password: '123456' // Ajustar según tu base de datos
    };
    
    try {
      const loginResponse = await client.post('/login', loginData);
      console.log('✅ Login exitoso:', loginResponse.status === 302 || loginResponse.status === 200);
      
      // Extraer cookies de la respuesta
      const cookies = loginResponse.headers['set-cookie'];
      if (cookies) {
        console.log('🍪 Cookies recibidas:', cookies.length);
      }
      
      console.log('3️⃣ Probando acceso a dashboard de caja...');
      
      try {
        const dashboardResponse = await client.get('/caja');
        console.log('✅ Dashboard de caja accesible:', dashboardResponse.status === 200);
        console.log('📊 Respuesta contiene "Dashboard":', dashboardResponse.data.includes('Dashboard'));
        
      } catch (dashboardError) {
        console.log('❌ Error accediendo al dashboard:', dashboardError.response?.status || dashboardError.message);
        if (dashboardError.response?.status === 302) {
          console.log('🔄 Redirección detectada a:', dashboardError.response.headers.location);
        }
      }
      
    } catch (loginError) {
      console.log('❌ Error en login:', loginError.response?.status || loginError.message);
      console.log('💡 Esto es normal si no tienes usuarios de caja configurados');
      
      // Probar acceso directo sin autenticación
      console.log('4️⃣ Probando acceso directo a /caja (sin auth)...');
      try {
        const directResponse = await client.get('/caja');
        console.log('✅ Acceso directo exitoso:', directResponse.status === 200);
      } catch (directError) {
        console.log('🔄 Redirección esperada a login:', directError.response?.status === 302);
        console.log('📍 Ubicación de redirección:', directError.response?.headers.location);
      }
    }
    
    console.log('🎯 Pruebas completadas');
    
  } catch (error) {
    console.error('❌ Error general en las pruebas:', error.message);
  }
}

// Ejecutar las pruebas
testCajaAccess(); 