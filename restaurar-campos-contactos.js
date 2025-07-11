/**
 * RESTAURAR CAMPOS DE CONTACTO
 * 
 * Este script restaura los campos de contacto inteligente después 
 * de ejecutar las migraciones correspondientes.
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 RESTAURANDO CAMPOS DE CONTACTO...');

// Ruta del modelo Documento
const modeloDocumentoPath = path.join(__dirname, 'models', 'Documento.js');

// Buscar el backup más reciente
const dirModels = path.dirname(modeloDocumentoPath);
const archivos = fs.readdirSync(dirModels);
const backups = archivos.filter(archivo => archivo.startsWith('Documento.js.backup-contactos-'));

if (backups.length === 0) {
  console.log('❌ No se encontraron backups de contactos');
  process.exit(1);
}

// Ordenar por fecha (más reciente primero)
backups.sort().reverse();
const backupMasReciente = backups[0];
const backupPath = path.join(dirModels, backupMasReciente);

console.log(`📋 Restaurando desde backup: ${backupMasReciente}`);

// Leer el backup
const contenidoBackup = fs.readFileSync(backupPath, 'utf8');

// Crear backup del estado actual (por si acaso)
const backupActualPath = modeloDocumentoPath + '.backup-antes-restaurar-' + Date.now();
fs.writeFileSync(backupActualPath, fs.readFileSync(modeloDocumentoPath, 'utf8'));
console.log(`📋 Backup del estado actual creado: ${path.basename(backupActualPath)}`);

// Restaurar el archivo original
fs.writeFileSync(modeloDocumentoPath, contenidoBackup);

console.log('✅ Campos de contacto restaurados exitosamente');
console.log('\n🔧 PASOS SIGUIENTES:');
console.log('1. Verificar que las migraciones se ejecutaron correctamente');
console.log('2. Reiniciar la aplicación');
console.log('3. Probar el sistema de contactos inteligente');

console.log('\n📋 CAMPOS RESTAURADOS:');
console.log('   - telefonoWhatsapp');
console.log('   - contactoValidado');
console.log('   - contactoConflicto');
console.log('   - contactoDatosAnalisis'); 