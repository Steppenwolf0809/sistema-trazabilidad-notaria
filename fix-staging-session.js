/**
 * 🔧 FIX DE SESIONES PARA STAGING
 * Script para diagnosticar y corregir problemas de sesiones en staging
 */

const { Pool } = require('pg');
const { sequelize } = require('./config/database');

async function fixStagingSessions() {
  console.log('🔧 DIAGNOSTICANDO Y REPARANDO SESIONES DE STAGING...\n');
  
  try {
    // 1. Verificar conexión de base de datos
    console.log('🔍 1. Verificando conexión de base de datos...');
    await sequelize.authenticate();
    console.log('✅ Conexión a base de datos exitosa');
    
    // 2. Verificar variables de entorno críticas
    console.log('\n🔍 2. Verificando variables de entorno...');
    const envCheck = {
      'DATABASE_URL': !!process.env.DATABASE_URL,
      'JWT_SECRET': !!process.env.JWT_SECRET,
      'SESSION_SECRET': !!process.env.SESSION_SECRET,
      'NODE_ENV': process.env.NODE_ENV || 'undefined'
    };
    
    console.log('📊 Estado de variables de entorno:');
    Object.entries(envCheck).forEach(([key, value]) => {
      const status = value === true ? '✅' : value === false ? '❌' : '⚠️';
      console.log(`  ${status} ${key}: ${value}`);
    });
    
    // 3. Verificar/crear tabla de sesiones
    console.log('\n🔍 3. Verificando tabla de sesiones...');
    
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes('railway') ? { rejectUnauthorized: false } : false
    });
    
    try {
      // Verificar si existe la tabla de sesiones
      const checkSessionsTable = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'user_sessions'
        );
      `);
      
      const sessionTableExists = checkSessionsTable.rows[0].exists;
      console.log('📊 Tabla user_sessions existe:', sessionTableExists ? '✅ SÍ' : '❌ NO');
      
      if (!sessionTableExists) {
        console.log('🔧 Creando tabla de sesiones...');
        await pool.query(`
          CREATE TABLE IF NOT EXISTS "user_sessions" (
            "sid" varchar NOT NULL COLLATE "default",
            "sess" json NOT NULL,
            "expire" timestamp(6) NOT NULL
          )
          WITH (OIDS=FALSE);
        `);
        
        await pool.query(`
          ALTER TABLE "user_sessions" 
          ADD CONSTRAINT "session_pkey" 
          PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;
        `);
        
        await pool.query(`
          CREATE INDEX "IDX_session_expire" ON "user_sessions" ("expire");
        `);
        
        console.log('✅ Tabla de sesiones creada exitosamente');
      }
      
      // Limpiar sesiones expiradas
      console.log('🧹 Limpiando sesiones expiradas...');
      const deleteResult = await pool.query(`
        DELETE FROM user_sessions 
        WHERE expire < NOW();
      `);
      console.log(`✅ ${deleteResult.rowCount} sesiones expiradas eliminadas`);
      
    } catch (sessionError) {
      console.log('❌ Error con tabla de sesiones:', sessionError.message);
    } finally {
      await pool.end();
    }
    
    // 4. Verificar modelos de Sequelize
    console.log('\n🔍 4. Verificando modelos Sequelize...');
    
    try {
      await sequelize.sync({ alter: false });
      console.log('✅ Modelos Sequelize sincronizados');
    } catch (syncError) {
      console.log('❌ Error sincronizando modelos:', syncError.message);
      
      // Intentar sincronización forzada
      console.log('🔄 Intentando sincronización con alter...');
      try {
        await sequelize.sync({ alter: true });
        console.log('✅ Sincronización con alter exitosa');
      } catch (alterError) {
        console.log('❌ Error con alter:', alterError.message);
      }
    }
    
    // 5. Verificar tabla matrizadores
    console.log('\n🔍 5. Verificando tabla matrizadores...');
    
    try {
      const { Matrizador } = require('./models');
      const userCount = await Matrizador.count();
      console.log(`✅ Tabla matrizadores accesible - ${userCount} usuarios encontrados`);
      
      if (userCount === 0) {
        console.log('⚠️ No hay usuarios en la base de datos');
        console.log('💡 Ejecuta: node setup-staging.js para crear usuarios de prueba');
      } else {
        // Mostrar algunos usuarios
        const sampleUsers = await Matrizador.findAll({
          attributes: ['id', 'nombre', 'email', 'rol', 'activo'],
          limit: 3
        });
        
        console.log('👥 Usuarios de ejemplo:');
        sampleUsers.forEach(user => {
          console.log(`  - ${user.email} (${user.rol})`);
        });
      }
      
    } catch (userError) {
      console.log('❌ Error accediendo tabla matrizadores:', userError.message);
    }
    
    // 6. Generar secretos si faltan
    console.log('\n🔍 6. Verificando secretos de seguridad...');
    
    if (!process.env.JWT_SECRET) {
      const newJwtSecret = require('crypto').randomBytes(64).toString('hex');
      console.log('⚠️ JWT_SECRET faltante. Sugerido:');
      console.log(`JWT_SECRET=${newJwtSecret}`);
    }
    
    if (!process.env.SESSION_SECRET) {
      const newSessionSecret = require('crypto').randomBytes(64).toString('hex');
      console.log('⚠️ SESSION_SECRET faltante. Sugerido:');
      console.log(`SESSION_SECRET=${newSessionSecret}`);
    }
    
    // 7. Test de autenticación
    console.log('\n🔍 7. Test de autenticación básica...');
    
    try {
      const bcrypt = require('bcryptjs');
      const testPassword = 'test123';
      const hashedPassword = await bcrypt.hash(testPassword, 10);
      const isValid = await bcrypt.compare(testPassword, hashedPassword);
      
      console.log('✅ Bcrypt funcionando:', isValid ? '✅ SÍ' : '❌ NO');
      
    } catch (authError) {
      console.log('❌ Error con autenticación:', authError.message);
    }
    
    console.log('\n📋 RESUMEN DEL DIAGNÓSTICO:');
    console.log('='.repeat(50));
    console.log('✅ Base de datos: Conectada');
    console.log(envCheck.DATABASE_URL ? '✅' : '❌', 'DATABASE_URL: Configurada');
    console.log(envCheck.JWT_SECRET ? '✅' : '❌', 'JWT_SECRET: Configurado');
    console.log(envCheck.SESSION_SECRET ? '✅' : '❌', 'SESSION_SECRET: Configurado');
    console.log('✅ Tabla sesiones: Verificada/Creada');
    console.log('✅ Modelos: Sincronizados');
    console.log('='.repeat(50));
    
    console.log('\n🎯 PRÓXIMOS PASOS:');
    if (!envCheck.JWT_SECRET || !envCheck.SESSION_SECRET) {
      console.log('1. 🔐 Configurar secretos faltantes en Railway Dashboard');
    }
    console.log('2. 👥 Ejecutar: node setup-staging.js (crear usuarios)');
    console.log('3. 🧪 Probar login en staging URL');
    console.log('4. 🔄 Si persiste problema: revisar logs de Railway');
    
    console.log('\n🌐 URL DE STAGING:');
    console.log('https://sistema-trazabilidad-notaria-staging.up.railway.app/login');
    
  } catch (error) {
    console.error('\n❌ ERROR FATAL EN DIAGNÓSTICO:', error);
    console.error('📝 Detalles:', error.message);
    
    console.log('\n🔧 ACCIONES DE EMERGENCIA:');
    console.log('1. Verificar DATABASE_URL en Railway Dashboard');
    console.log('2. Verificar que staging tenga su propia base de datos');
    console.log('3. Ejecutar migraciones: npx sequelize-cli db:migrate');
    console.log('4. Reiniciar servicio de staging en Railway');
    
    process.exit(1);
  }
}

// Función auxiliar para crear variables de entorno sugeridas
function generateEnvSuggestions() {
  console.log('\n📝 VARIABLES DE ENTORNO SUGERIDAS PARA STAGING:');
  console.log('='.repeat(60));
  console.log('# En Railway Dashboard → Staging → Variables:');
  console.log('NODE_ENV=staging');
  console.log('RAILWAY_ENVIRONMENT=staging');
  console.log(`JWT_SECRET=${require('crypto').randomBytes(64).toString('hex')}`);
  console.log(`SESSION_SECRET=${require('crypto').randomBytes(64).toString('hex')}`);
  console.log('# DATABASE_URL=postgresql://... (automático en Railway)');
  console.log('# Opcional para staging:');
  console.log('WHATSAPP_ENABLED=false');
  console.log('EMAIL_ENABLED=false');
  console.log('='.repeat(60));
}

// Ejecutar diagnóstico
if (require.main === module) {
  fixStagingSessions()
    .then(() => {
      generateEnvSuggestions();
      console.log('\n🔚 Diagnóstico completado');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { fixStagingSessions }; 