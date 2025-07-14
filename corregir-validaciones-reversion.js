/**
 * SCRIPT: Corregir Validaciones de Justificación
 * Corrige todas las validaciones de justificación en funciones de reversión
 */

const fs = require('fs');

function corregirValidaciones() {
  console.log('🔧 CORRIGIENDO VALIDACIONES DE JUSTIFICACIÓN...');
  
  // Leer el archivo del controlador
  const archivo = 'controllers/cajaController.js';
  let contenido = fs.readFileSync(archivo, 'utf8');
  
  // Patrón a buscar (validación antigua)
  const patronAntiguo = `    // Validaciones iniciales
    if (!justificacion || justificacion.length < 20) {
      return res.status(400).json({
        error: 'Justificación requerida',
        mensaje: 'La justificación debe tener al menos 20 caracteres'
      });
    }`;
  
  // Nuevo patrón (validación corregida)
  const patronNuevo = `    // Validaciones iniciales CORREGIDAS
    if (!justificacion || justificacion.trim().length < 5) {
      return res.status(400).json({
        success: false,
        error: 'Justificación insuficiente',
        mensaje: \`La justificación debe tener al menos 5 caracteres. Caracteres actuales: \${justificacion ? justificacion.trim().length : 0}\`
      });
    }`;
  
  // Contar ocurrencias
  const ocurrencias = (contenido.match(new RegExp(patronAntiguo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  console.log(`📊 Encontradas ${ocurrencias} validaciones a corregir`);
  
  // Reemplazar todas las ocurrencias
  const contenidoCorregido = contenido.replace(new RegExp(patronAntiguo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), patronNuevo);
  
  // Verificar que se hicieron cambios
  if (contenidoCorregido !== contenido) {
    // Guardar el archivo corregido
    fs.writeFileSync(archivo, contenidoCorregido, 'utf8');
    console.log(`✅ ${ocurrencias} validaciones corregidas exitosamente`);
    console.log('📋 Cambios aplicados:');
    console.log('  - Reducido mínimo de caracteres de 20 a 5');
    console.log('  - Agregado trim() para eliminar espacios');
    console.log('  - Cambiado error por success: false');
    console.log('  - Mejorado mensaje con contador de caracteres');
    console.log('  - Agregado template literal para mostrar caracteres actuales');
  } else {
    console.log('⚠️ No se encontraron validaciones para corregir');
  }
  
  console.log('✅ Corrección completada');
}

// Ejecutar corrección
if (require.main === module) {
  corregirValidaciones();
}

module.exports = { corregirValidaciones }; 