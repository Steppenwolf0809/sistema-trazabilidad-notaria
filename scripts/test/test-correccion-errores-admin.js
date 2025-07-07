#!/usr/bin/env node

/**
 * 🔧 SCRIPT DE VERIFICACIÓN - CORRECCIÓN ERRORES ADMIN
 * Verifica las correcciones implementadas:
 * ✅ Eliminación de avisos de "Modo Supervisión"
 * ✅ Corrección de campos en el controlador (camelCase)
 * ✅ Función verDetalle operativa
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Verificando corrección de errores en admin');
console.log('=' .repeat(70));

let verificacionCompleta = true;
let contadorExitos = 0;
let contadorTotal = 0;

/**
 * Función auxiliar para verificar contenido
 */
function verificarContenido(archivo, patron, descripcion, exito = null, negativo = false) {
  contadorTotal++;
  
  try {
    if (!fs.existsSync(archivo)) {
      console.log(`❌ ${descripcion}: Archivo no encontrado - ${archivo}`);
      verificacionCompleta = false;
      return false;
    }
    
    const contenido = fs.readFileSync(archivo, 'utf8');
    const coincide = typeof patron === 'string' ? 
      contenido.includes(patron) : 
      patron.test(contenido);
    
    if (negativo) {
      // Para verificar que algo NO esté presente
      if (!coincide) {
        console.log(`✅ ${descripcion}${exito ? ` - ${exito}` : ''}`);
        contadorExitos++;
        return true;
      } else {
        console.log(`❌ ${descripcion}: Aún presente (debería estar eliminado)`);
        verificacionCompleta = false;
        return false;
      }
    } else {
      // Para verificar que algo SÍ esté presente
      if (coincide) {
        console.log(`✅ ${descripcion}${exito ? ` - ${exito}` : ''}`);
        contadorExitos++;
        return true;
      } else {
        console.log(`❌ ${descripción}: No encontrado`);
        verificacionCompleta = false;
        return false;
      }
    }
  } catch (error) {
    console.log(`❌ ${descripcion}: Error - ${error.message}`);
    verificacionCompleta = false;
    return false;
  }
}

console.log('\n🗑️  1. VERIFICANDO ELIMINACIÓN DE AVISOS');
console.log('-'.repeat(50));

// Verificar que el aviso del header esté eliminado
verificarContenido(
  'views/admin/documentos/listado.hbs',
  'Modo Supervisión: Solo puede consultar información',
  'Aviso header eliminado',
  'Header limpio y profesional',
  true // negativo - verificar que NO esté presente
);

// Verificar que el aviso grande esté eliminado
verificarContenido(
  'views/admin/documentos/listado.hbs',
  'Segregación de Funciones - Control de Auditoría',
  'Aviso segregación eliminado',
  'Interfaz más limpia',
  true // negativo
);

// Verificar que el aviso de detalle esté eliminado
verificarContenido(
  'views/admin/documentos/detalle.hbs',
  'Modo Supervisión Activo: Esta vista es de solo lectura',
  'Aviso detalle eliminado',
  'Vista de detalle limpia',
  true // negativo
);

console.log('\n🔧 2. VERIFICANDO CORRECCIONES DE BACKEND');
console.log('-'.repeat(50));

// Verificar corrección de estadoPago
verificarContenido(
  'controllers/adminController.js',
  'where.estadoPago = estadoPago;  // CORREGIDO: Usar camelCase',
  'Campo estadoPago corregido',
  'Usa camelCase consistente'
);

// Verificar corrección de idMatrizador
verificarContenido(
  'controllers/adminController.js',
  'where.idMatrizador = matrizadorId;',
  'Campo idMatrizador corregido',
  'Referencia a matrizador arreglada'
);

// Verificar corrección de numeroFactura
verificarContenido(
  'controllers/adminController.js',
  'numeroFactura: { [Op.iLike]: `%${busqueda}%` }  // CORREGIDO: Usar camelCase',
  'Campo numeroFactura corregido',
  'Búsqueda por factura funcional'
);

console.log('\n🎯 3. VERIFICANDO FUNCIÓN VERDETALLE');
console.log('-'.repeat(50));

// Verificar que la función verDetalle esté bien definida
verificarContenido(
  'views/admin/documentos/listado.hbs',
  'function verDetalle(documentoId) {',
  'Función verDetalle definida',
  'Navegación a detalle operativa'
);

// Verificar la URL correcta
verificarContenido(
  'views/admin/documentos/listado.hbs',
  'window.location.href = `/admin/documentos/detalle/${documentoId}`;',
  'URL de detalle correcta',
  'Redirección configurada'
);

// Verificar ruta en adminRoutes
verificarContenido(
  'routes/adminRoutes.js',
  "router.get('/documentos/detalle/:id', adminController.verDetalleDocumentoAdmin);",
  'Ruta admin detalle configurada',
  'Backend preparado para detalle'
);

// Verificar función del controlador
verificarContenido(
  'controllers/adminController.js',
  'exports.verDetalleDocumentoAdmin = async (req, res) => {',
  'Función controlador existe',
  'Backend operativo'
);

console.log('\n🎨 4. VERIFICANDO INTERFAZ MEJORADA');
console.log('-'.repeat(50));

// Verificar header simplificado
verificarContenido(
  'views/admin/documentos/listado.hbs',
  '<span><i class="fas fa-binoculars me-2"></i> Supervisión de Documentos</span>',
  'Header simplificado',
  'Título claro y directo'
);

// Verificar que la tabla siga funcionando
verificarContenido(
  'views/admin/documentos/listado.hbs',
  'tabla-supervision-perfecta',
  'Tabla modelo maestro preservada',
  'Funcionalidad mantenida'
);

console.log('\n📊 5. VERIFICANDO CONSISTENCIA DE CAMPOS');
console.log('-'.repeat(50));

// Verificar que no queden referencias a snake_case en lugares críticos
verificarContenido(
  'controllers/adminController.js',
  'estado_pago',
  'Sin referencias snake_case',
  'Limpieza completa',
  true // negativo
);

verificarContenido(
  'controllers/adminController.js',
  'id_matrizador',
  'Sin referencias id_matrizador',
  'Consistencia mantenida',
  true // negativo
);

console.log('\n' + '='.repeat(70));
console.log('📊 RESUMEN DE VERIFICACIÓN');
console.log('='.repeat(70));

const porcentajeExito = Math.round((contadorExitos / contadorTotal) * 100);

console.log(`✅ Verificaciones exitosas: ${contadorExitos}/${contadorTotal} (${porcentajeExito}%)`);

if (verificacionCompleta) {
  console.log('\n🎉 ¡CORRECCIONES APLICADAS EXITOSAMENTE!');
  console.log('');
  console.log('🔥 PROBLEMAS RESUELTOS:');
  console.log('   ✅ Avisos eliminados - Interfaz más limpia');
  console.log('   ✅ Campos backend corregidos - camelCase consistente');
  console.log('   ✅ Función verDetalle operativa');
  console.log('   ✅ Rutas admin configuradas correctamente');
  console.log('   ✅ Sin referencias snake_case problemáticas');
  console.log('   ✅ Header simplificado y profesional');
  console.log('');
  console.log('🚀 TABLA ADMIN LISTA PARA USO');
  console.log('');
  console.log('📝 PRÓXIMOS PASOS:');
  console.log('   1. Reiniciar el servidor si está ejecutándose');
  console.log('   2. Probar clic en botón "Ver Detalle"');
  console.log('   3. Verificar navegación sin errores');
  console.log('');
  console.log('🌐 ACCESO: http://localhost:3000/admin/documentos/listado');
  
} else {
  console.log('\n⚠️  VERIFICACIÓN INCOMPLETA');
  console.log(`   ${contadorTotal - contadorExitos} elementos requieren atención`);
  
  if (porcentajeExito >= 80) {
    console.log('   ℹ️  La mayoría de correcciones están aplicadas');
  } else {
    console.log('   ⚠️  Se requieren más correcciones');
  }
}

console.log('\n' + '='.repeat(70));
console.log(`Verificación completada: ${new Date().toLocaleString()}`);
console.log('Sistema de Trazabilidad Documental - Notaría Digital');

// Salir con código de estado apropiado
process.exit(verificacionCompleta ? 0 : 1); 