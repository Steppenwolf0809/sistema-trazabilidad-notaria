/**
 * HOTFIX URGENTE: Deshabilitar Sistema de Contactos Temporalmente
 * 
 * Este script modifica temporalmente el modelo Documento para remover
 * los campos de contacto inteligente que están causando errores.
 * 
 * USAR SOLO EN EMERGENCIA - Restaurar después de ejecutar migraciones
 */

const fs = require('fs');
const path = require('path');

console.log('🚨 HOTFIX URGENTE: Deshabilitando sistema de contactos temporalmente...');

// Ruta del modelo Documento
const modeloDocumentoPath = path.join(__dirname, 'models', 'Documento.js');

// Leer el archivo actual
let contenidoModelo = fs.readFileSync(modeloDocumentoPath, 'utf8');

// Crear backup del archivo original
const backupPath = modeloDocumentoPath + '.backup-contactos-' + Date.now();
fs.writeFileSync(backupPath, contenidoModelo);
console.log(`📋 Backup creado: ${backupPath}`);

// Comentar los campos problemáticos
const camposProblematicos = [
  'telefonoWhatsapp',
  'contactoValidado', 
  'contactoConflicto',
  'contactoDatosAnalisis'
];

camposProblematicos.forEach(campo => {
  // Buscar el campo y comentarlo
  const regex = new RegExp(`(\\s+${campo}:\\s*\\{[^}]*\\}[^,]*,?)`, 'gs');
  contenidoModelo = contenidoModelo.replace(regex, (match) => {
    return `  // TEMPORALMENTE DESHABILITADO - ${campo}:\n  /*${match.trim()}*/\n`;
  });
});

// Escribir el archivo modificado
fs.writeFileSync(modeloDocumentoPath, contenidoModelo);

console.log('✅ Campos de contacto temporalmente deshabilitados:');
camposProblematicos.forEach(campo => {
  console.log(`   - ${campo}`);
});

console.log('\n🔧 PASOS SIGUIENTES:');
console.log('1. Reiniciar la aplicación');
console.log('2. Verificar que el sistema funciona');
console.log('3. Ejecutar migraciones cuando sea posible');
console.log('4. Restaurar campos con: node restaurar-campos-contactos.js');

console.log('\n⚠️  IMPORTANTE: Este es un hotfix temporal. Restaurar después de las migraciones.'); 