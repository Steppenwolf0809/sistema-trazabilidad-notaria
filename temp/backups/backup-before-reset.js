/**
 * Script de Backup Preventivo - ProNotary
 * 
 * OBJETIVO: Crear backup completo antes del reset de datos legacy
 * 
 * Ejecutar con: node backup-before-reset.js
 */

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

/**
 * Función principal para crear backup preventivo
 */
async function crearBackupPreventivo() {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const backupDir = './backups';
  const backupFile = path.join(backupDir, `backup_pre_reset_${timestamp}.sql`);
  
  console.log('💾 CREANDO BACKUP PREVENTIVO ANTES DEL RESET...');
  console.log('===============================================\n');
  
  try {
    // Crear directorio de backups si no existe
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir);
      console.log('📁 Directorio de backups creado');
    }
    
    // Obtener configuración de base de datos desde variables de entorno
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5433,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'notaria'
    };
    
    console.log('🔧 Configuración de base de datos:');
    console.log(`   Host: ${dbConfig.host}`);
    console.log(`   Puerto: ${dbConfig.port}`);
    console.log(`   Usuario: ${dbConfig.user}`);
    console.log(`   Base de datos: ${dbConfig.database}`);
    console.log(`   Archivo de backup: ${backupFile}\n`);
    
    // Construir comando pg_dump
    const comando = `pg_dump -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} -d ${dbConfig.database} --no-password > "${backupFile}"`;
    
    console.log('⏳ Ejecutando backup...');
    
    return new Promise((resolve, reject) => {
      // Configurar variable de entorno para la contraseña
      const env = { ...process.env };
      env.PGPASSWORD = dbConfig.password;
      
      exec(comando, { env }, (error, stdout, stderr) => {
        if (error) {
          console.error('❌ Error creando backup:', error.message);
          console.log('\n🔧 POSIBLES SOLUCIONES:');
          console.log('1. Verificar que pg_dump esté instalado y en el PATH');
          console.log('2. Verificar credenciales de base de datos en .env');
          console.log('3. Asegurar que PostgreSQL esté corriendo');
          console.log('4. Verificar permisos de acceso a la base de datos');
          reject(error);
          return;
        }
        
        if (stderr && stderr.trim()) {
          console.log('⚠️  Advertencias durante el backup:');
          console.log(stderr);
        }
        
        // Verificar que el archivo se creó correctamente
        if (fs.existsSync(backupFile)) {
          const stats = fs.statSync(backupFile);
          const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
          
          console.log('✅ ¡BACKUP CREADO EXITOSAMENTE!');
          console.log(`   Archivo: ${backupFile}`);
          console.log(`   Tamaño: ${fileSizeInMB} MB`);
          console.log(`   Fecha: ${new Date().toLocaleString()}`);
          
          console.log('\n📋 INFORMACIÓN DEL BACKUP:');
          console.log('• Este backup contiene TODOS los datos actuales');
          console.log('• Incluye estructura de tablas y datos');
          console.log('• Se puede restaurar con: psql -d nombre_bd < archivo.sql');
          console.log('• Mantener este archivo hasta confirmar que el reset fue exitoso');
          
          resolve(backupFile);
        } else {
          const error = new Error('El archivo de backup no se creó correctamente');
          console.error('❌', error.message);
          reject(error);
        }
      });
    });
    
  } catch (error) {
    console.error('💥 Error durante el proceso de backup:', error);
    throw error;
  }
}

/**
 * Función para listar backups existentes
 */
function listarBackupsExistentes() {
  const backupDir = './backups';
  
  console.log('📋 BACKUPS EXISTENTES:');
  console.log('======================\n');
  
  if (!fs.existsSync(backupDir)) {
    console.log('📁 No existe el directorio de backups');
    return [];
  }
  
  const archivos = fs.readdirSync(backupDir)
    .filter(archivo => archivo.endsWith('.sql'))
    .map(archivo => {
      const rutaCompleta = path.join(backupDir, archivo);
      const stats = fs.statSync(rutaCompleta);
      return {
        nombre: archivo,
        ruta: rutaCompleta,
        tamaño: (stats.size / (1024 * 1024)).toFixed(2) + ' MB',
        fecha: stats.mtime.toLocaleString()
      };
    })
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  
  if (archivos.length === 0) {
    console.log('📁 No hay backups existentes');
    return [];
  }
  
  archivos.forEach((archivo, index) => {
    console.log(`${index + 1}. ${archivo.nombre}`);
    console.log(`   Tamaño: ${archivo.tamaño}`);
    console.log(`   Fecha: ${archivo.fecha}`);
    console.log(`   Ruta: ${archivo.ruta}\n`);
  });
  
  return archivos;
}

/**
 * Función para verificar herramientas necesarias
 */
function verificarHerramientas() {
  console.log('🔍 VERIFICANDO HERRAMIENTAS NECESARIAS...\n');
  
  return new Promise((resolve, reject) => {
    exec('pg_dump --version', (error, stdout, stderr) => {
      if (error) {
        console.error('❌ pg_dump no encontrado');
        console.log('\n🔧 INSTALACIÓN REQUERIDA:');
        console.log('• Windows: Instalar PostgreSQL client tools');
        console.log('• Ubuntu/Debian: sudo apt-get install postgresql-client');
        console.log('• macOS: brew install postgresql');
        reject(new Error('pg_dump no disponible'));
        return;
      }
      
      console.log('✅ pg_dump disponible:', stdout.trim());
      resolve(true);
    });
  });
}

/**
 * Función principal de ejecución
 */
async function ejecutarBackup() {
  try {
    console.log('🛡️  SISTEMA DE BACKUP PREVENTIVO - PRONOTARY');
    console.log('=============================================\n');
    
    // Verificar herramientas
    await verificarHerramientas();
    
    // Listar backups existentes
    listarBackupsExistentes();
    
    // Crear nuevo backup
    const archivoBackup = await crearBackupPreventivo();
    
    console.log('\n🎯 BACKUP COMPLETADO - LISTO PARA RESET SEGURO');
    console.log('\n📋 PRÓXIMOS PASOS:');
    console.log('1. Ejecutar: node reset-datos-legacy.js');
    console.log('2. Verificar que el reset fue exitoso');
    console.log('3. Si hay problemas, restaurar con el backup creado');
    console.log('\n🔗 COMANDO DE RESTAURACIÓN (si es necesario):');
    console.log(`   psql -h localhost -p 5433 -U postgres -d notaria < "${archivoBackup}"`);
    
  } catch (error) {
    console.error('💥 Error ejecutando backup:', error);
    console.log('\n🆘 Si el error persiste:');
    console.log('1. Verificar instalación de PostgreSQL client tools');
    console.log('2. Verificar credenciales en archivo .env');
    console.log('3. Asegurar que PostgreSQL esté corriendo');
    console.log('4. Verificar permisos de escritura en directorio actual');
    process.exit(1);
  }
}

// Exportar funciones para uso modular
module.exports = {
  crearBackupPreventivo,
  listarBackupsExistentes,
  verificarHerramientas,
  ejecutarBackup
};

// Si se ejecuta directamente
if (require.main === module) {
  ejecutarBackup();
} 