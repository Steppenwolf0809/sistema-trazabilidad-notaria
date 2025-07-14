/**
 * 🚀 SETUP COMPLETO PARA STAGING
 * Script para configurar el ambiente de staging con usuarios de prueba
 */

const bcrypt = require('bcryptjs');
const { sequelize } = require('./config/database');
const { Matrizador } = require('./models');

// 👥 USUARIOS DE PRUEBA PARA STAGING
const usuariosStagingCompletos = [
  // 👑 ADMINISTRACIÓN
  {
    nombre: 'Admin Staging',
    email: 'admin@staging.com',
    identificacion: 'ADMIN-STG',
    cargo: 'Administrador Staging',
    password: 'admin123',
    rol: 'admin',
    activo: true,
    descripcion: 'Usuario administrador para testing en staging'
  },
  
  // 📋 MATRIZADORES
  {
    nombre: 'Matrizador Test',
    email: 'matrizador@staging.com',
    identificacion: 'MAT-STG-001',
    cargo: 'Matrizador de Prueba',
    password: 'mat123',
    rol: 'matrizador',
    activo: true,
    descripcion: 'Matrizador para testing de funcionalidades'
  },
  {
    nombre: 'Mayra Test',
    email: 'mayra@staging.com',
    identificacion: 'MAT-STG-002',
    cargo: 'Matrizador Principal Test',
    password: 'mayra123',
    rol: 'matrizador',
    activo: true,
    descripcion: 'Usuario para probar funcionalidades específicas de Mayra'
  },
  
  // 💰 CAJA
  {
    nombre: 'Caja Test',
    email: 'caja@staging.com',
    identificacion: 'CAJA-STG-001',
    cargo: 'Cajero de Prueba',
    password: 'caja123',
    rol: 'caja',
    activo: true,
    descripcion: 'Usuario para testing de funciones de caja'
  },
  {
    nombre: 'Caja Archivo Test',
    email: 'caja.archivo@staging.com',
    identificacion: 'CAJA-ARCH-STG',
    cargo: 'Caja Archivo de Prueba',
    password: 'archivo123',
    rol: 'caja_archivo',
    activo: true,
    descripcion: 'Usuario para testing de caja + archivo'
  },
  
  // 📥 RECEPCIÓN
  {
    nombre: 'Recepción Test',
    email: 'recepcion@staging.com',
    identificacion: 'REC-STG-001',
    cargo: 'Recepcionista de Prueba',
    password: 'rec123',
    rol: 'recepcion',
    activo: true,
    descripcion: 'Usuario para testing de recepción de documentos'
  },
  
  // 📁 ARCHIVO
  {
    nombre: 'Archivo Test',
    email: 'archivo@staging.com',
    identificacion: 'ARCH-STG-001',
    cargo: 'Archivista de Prueba',
    password: 'archivo123',
    rol: 'archivo',
    activo: true,
    descripcion: 'Usuario para testing de funciones de archivo'
  }
];

async function setupStaging() {
  console.log('🚀 CONFIGURANDO STAGING COMPLETO...\n');
  
  try {
    // Verificar conexión a base de datos
    console.log('🔍 Verificando conexión a base de datos...');
    await sequelize.authenticate();
    console.log('✅ Conexión a base de datos exitosa');
    
    // Verificar que estamos en el entorno correcto
    const isStaging = process.env.NODE_ENV === 'staging' || 
                      process.env.RAILWAY_ENVIRONMENT === 'staging' ||
                      (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('staging'));
    
    console.log('\n📊 INFORMACIÓN DEL ENTORNO:');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('RAILWAY_ENVIRONMENT:', process.env.RAILWAY_ENVIRONMENT);
    console.log('Es staging:', isStaging ? '✅ SÍ' : '⚠️  NO DETECTADO');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✅ Configurada' : '❌ No configurada');
    
    if (!isStaging) {
      console.log('\n⚠️  ADVERTENCIA: No se detectó entorno staging');
      console.log('Continuando de todas formas para testing local...');
    }
    
    // Sincronizar modelos
    console.log('\n🔄 Sincronizando modelos de base de datos...');
    await sequelize.sync({ alter: false }); // No alterar en staging, solo verificar
    console.log('✅ Modelos sincronizados correctamente');
    
    // Verificar usuarios existentes
    console.log('\n👥 Verificando usuarios existentes...');
    const usuariosExistentes = await Matrizador.count();
    console.log(`📊 Usuarios actuales en BD: ${usuariosExistentes}`);
    
    if (usuariosExistentes > 0) {
      console.log('\n🤔 ¿Desea REEMPLAZAR todos los usuarios existentes?');
      console.log('⚠️  PRECAUCIÓN: Esto eliminará TODOS los usuarios actuales');
      console.log('✅ Continúa automáticamente en 5 segundos para staging...');
      
      // En staging, proceder automáticamente después de 5 segundos
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      console.log('🗑️  Eliminando usuarios existentes...');
      await Matrizador.destroy({ 
        where: {},
        truncate: true,
        cascade: true 
      });
      console.log('✅ Usuarios existentes eliminados');
    }
    
    // Crear usuarios de staging
    console.log('\n👥 Creando usuarios de prueba para staging...');
    let usuariosCreados = 0;
    
    for (const usuarioData of usuariosStagingCompletos) {
      try {
        // Hash de la contraseña
        const passwordHash = await bcrypt.hash(usuarioData.password, 10);
        
        // Crear usuario
        const usuario = await Matrizador.create({
          nombre: usuarioData.nombre,
          email: usuarioData.email,
          identificacion: usuarioData.identificacion,
          cargo: usuarioData.cargo,
          password: passwordHash,
          rol: usuarioData.rol,
          activo: usuarioData.activo
        });
        
        console.log(`✅ ${usuario.rol.toUpperCase()}: ${usuario.nombre} (${usuario.email})`);
        usuariosCreados++;
        
      } catch (error) {
        console.log(`❌ Error creando ${usuarioData.email}:`, error.message);
      }
    }
    
    console.log(`\n📊 RESUMEN DE CREACIÓN:`);
    console.log(`✅ Usuarios creados exitosamente: ${usuariosCreados}`);
    console.log(`🎯 Total esperado: ${usuariosStagingCompletos.length}`);
    
    // Verificar usuarios finales
    console.log('\n🔍 Verificando usuarios creados...');
    const usuariosFinales = await Matrizador.findAll({
      attributes: ['id', 'nombre', 'email', 'rol', 'activo'],
      order: [['rol', 'ASC'], ['nombre', 'ASC']]
    });
    
    console.log(`\n👥 USUARIOS DISPONIBLES EN STAGING (${usuariosFinales.length}):`);
    console.log(''.padEnd(80, '='));
    usuariosFinales.forEach(user => {
      const status = user.activo ? '🟢' : '🔴';
      const usuarioData = usuariosStagingCompletos.find(u => u.email === user.email);
      const password = usuarioData ? usuarioData.password : 'unknown';
      console.log(`${status} ${user.rol.toUpperCase().padEnd(12)} | ${user.email.padEnd(25)} | ${password}`);
    });
    console.log(''.padEnd(80, '='));
    
    // Información importante para testing
    console.log('\n📋 INFORMACIÓN IMPORTANTE PARA TESTING:');
    console.log('🌐 URL Staging: https://sistema-trazabilidad-notaria-staging.up.railway.app');
    console.log('🔑 Login con cualquiera de los usuarios listados arriba');
    console.log('🔐 Las contraseñas están junto a cada email');
    
    console.log('\n🧪 CASOS DE PRUEBA RECOMENDADOS:');
    console.log('1. Login como admin@staging.com / admin123');
    console.log('2. Login como mayra@staging.com / mayra123 (simular usuario real)');
    console.log('3. Login como caja@staging.com / caja123 (testing reversiones)');
    console.log('4. Probar todas las funcionalidades sin miedo de romper producción');
    
    console.log('\n🔄 WORKFLOW RECOMENDADO:');
    console.log('1. Hacer cambios en rama staging');
    console.log('2. Push a staging y probar en URL staging');
    console.log('3. Si funciona 100%: merge a railway-deploy');
    console.log('4. Deploy automático a producción');
    
    console.log('\n✅ STAGING CONFIGURADO EXITOSAMENTE');
    console.log('🎉 ¡Listo para testing sin riesgos!');
    
  } catch (error) {
    console.error('\n❌ ERROR CONFIGURANDO STAGING:', error);
    console.error('📝 Detalles:', error.message);
    
    if (error.name === 'SequelizeConnectionError') {
      console.log('\n🔧 POSIBLES SOLUCIONES:');
      console.log('1. Verificar que DATABASE_URL esté configurada en Railway');
      console.log('2. Verificar que la base de datos staging esté accesible');
      console.log('3. Ejecutar migraciones: npx sequelize-cli db:migrate');
    }
    
    process.exit(1);
  }
}

// Función para verificar login (testing)
async function testLogin() {
  console.log('\n🧪 PROBANDO FUNCIONALIDAD DE LOGIN...');
  
  try {
    const testUser = await Matrizador.findOne({
      where: { email: 'admin@staging.com' }
    });
    
    if (testUser) {
      const isValidPassword = await bcrypt.compare('admin123', testUser.password);
      console.log('✅ Usuario admin encontrado');
      console.log('🔐 Password hash válido:', isValidPassword ? '✅ SÍ' : '❌ NO');
      
      if (isValidPassword) {
        console.log('🎉 ¡Login debería funcionar correctamente!');
      } else {
        console.log('❌ Problema con hash de contraseña');
      }
    } else {
      console.log('❌ Usuario admin no encontrado');
    }
    
  } catch (error) {
    console.error('❌ Error probando login:', error.message);
  }
}

// Ejecutar setup
if (require.main === module) {
  setupStaging()
    .then(() => testLogin())
    .then(() => {
      console.log('\n🔚 Setup de staging completado');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { setupStaging, usuariosStagingCompletos }; 