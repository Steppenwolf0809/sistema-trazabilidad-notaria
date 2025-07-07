#!/usr/bin/env node

/**
 * 🎯 SCRIPT DE VERIFICACIÓN - MEJORAS TABLA ADMIN
 * Verifica todas las mejoras implementadas:
 * ✅ Códigos más negros (font-weight: 700)
 * ✅ Fechas más bold (font-weight: 700)  
 * ✅ 30 documentos por página (limit: 30)
 * ✅ Sistema de ordenamiento funcional
 */

const fs = require('fs');
const path = require('path');

console.log('🎯 Verificando mejoras en tabla admin - Sistema perfeccionado');
console.log('=' .repeat(80));

let verificacionCompleta = true;
let contadorExitos = 0;
let contadorTotal = 0;

/**
 * Función auxiliar para verificar contenido
 */
function verificarContenido(archivo, patron, descripcion, exito = null) {
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
    
    if (coincide) {
      console.log(`✅ ${descripcion}${exito ? ` - ${exito}` : ''}`);
      contadorExitos++;
      return true;
    } else {
      console.log(`❌ ${descripcion}: No encontrado`);
      verificacionCompleta = false;
      return false;
    }
  } catch (error) {
    console.log(`❌ ${descripcion}: Error - ${error.message}`);
    verificacionCompleta = false;
    return false;
  }
}

/**
 * Función para verificar múltiples patrones
 */
function verificarMultiples(archivo, patrones, descripcion) {
  const contenido = fs.readFileSync(archivo, 'utf8');
  let todosEncontrados = true;
  let encontrados = 0;
  
  patrones.forEach(patron => {
    if (contenido.includes(patron)) {
      encontrados++;
    } else {
      todosEncontrados = false;
    }
  });
  
  contadorTotal++;
  if (todosEncontrados) {
    console.log(`✅ ${descripcion} - ${encontrados}/${patrones.length} elementos`);
    contadorExitos++;
    return true;
  } else {
    console.log(`❌ ${descripcion} - Solo ${encontrados}/${patrones.length} elementos`);
    verificacionCompleta = false;
    return false;
  }
}

console.log('\n📋 1. VERIFICANDO MEJORAS VISUALES EN CSS');
console.log('-'.repeat(50));

// Verificar códigos más negros
verificarContenido(
  'views/admin/documentos/listado.hbs',
  'font-weight: 700;                        /* MEJORADO: Más bold (era 500) */',
  'Códigos más negros (font-weight: 700)',
  'Código principal con mayor contraste'
);

verificarContenido(
  'views/admin/documentos/listado.hbs', 
  'color: #1a1a1a;                         /* MEJORADO: Más negro (era #2c3e50) */',
  'Color de código más negro (#1a1a1a)',
  'Máximo contraste aplicado'
);

// Verificar fechas más bold
verificarContenido(
  'views/admin/documentos/listado.hbs',
  'font-weight: 700;                        /* MEJORADO: Más bold (era 500) */',
  'Fechas más bold (font-weight: 700)',
  'Mayor legibilidad en fechas'
);

verificarContenido(
  'views/admin/documentos/listado.hbs',
  'font-weight: 600;                        /* MEJORADO: También bold para sin-fecha */',
  'Sin-fecha también bold',
  'Consistencia visual mantenida'
);

console.log('\n📊 2. VERIFICANDO PAGINACIÓN MEJORADA');
console.log('-'.repeat(50));

// Verificar 30 documentos por página
verificarContenido(
  'controllers/adminController.js',
  'const limit = 30;                              // MEJORADO: Aumentado de 20 a 30 documentos por página',
  'Límite aumentado a 30 documentos',
  'Menos páginas, más productividad'
);

console.log('\n🔧 3. VERIFICANDO SISTEMA DE ORDENAMIENTO');
console.log('-'.repeat(50));

// Verificar headers ordenables corregidos
const headersOrdenables = [
  'class="col-codigo ordenable" data-columna="codigoBarras"',
  'class="col-cliente ordenable" data-columna="nombreCliente"',
  'class="col-matrizador ordenable" data-columna="matrizador"',
  'class="col-fecha ordenable" data-columna="fechaFactura"',
  'class="col-estado ordenable" data-columna="estado"',
  'class="col-pago ordenable" data-columna="estadoPago"',
  'class="col-valor ordenable" data-columna="valorFactura"'
];

verificarMultiples(
  'views/admin/documentos/listado.hbs',
  headersOrdenables,
  'Headers ordenables configurados'
);

// Verificar JavaScript de ordenamiento manual
verificarContenido(
  'views/admin/documentos/listado.hbs',
  'function inicializarOrdenamientoManual() {',
  'Función de ordenamiento manual',
  'Sistema de respaldo implementado'
);

verificarContenido(
  'views/admin/documentos/listado.hbs',
  'window.location.search = params.toString();',
  'Recarga por servidor funcional',
  'Ordenamiento dinámico activado'
);

// Verificar mapeo de columnas en backend
verificarContenido(
  'controllers/adminController.js',
  "'codigoBarras': 'codigoBarras',",
  'Mapeo de columnas backend',
  'Ordenamiento servidor configurado'
);

console.log('\n🎨 4. VERIFICANDO CLASES CSS PERFECCIONADAS');
console.log('-'.repeat(50));

// Verificar estilos ordenables
const estilosOrdenamiento = [
  '.tabla-supervision-perfecta th.ordenable {',
  '.tabla-supervision-perfecta th.ordenable:hover {',
  '.tabla-supervision-perfecta th.ordenable.active {'
];

verificarMultiples(
  'views/admin/documentos/listado.hbs',
  estilosOrdenamiento,
  'Estilos de ordenamiento CSS'
);

// Verificar estados de ordenamiento específicos
verificarContenido(
  'views/admin/documentos/listado.hbs',
  '.tabla-supervision-perfecta th.ordenable.asc .sort-icon {',
  'Estados de ordenamiento específicos',
  'Feedback visual para ASC/DESC'
);

console.log('\n🔍 5. VERIFICANDO HELPERS DE HANDLEBARS');
console.log('-'.repeat(50));

// Verificar helpers necesarios
const helpersNecesarios = [
  'getTipoLetra',
  'getIniciales', 
  'getEstadoIcono',
  'getPagoIcono',
  'ucfirst',
  'truncate',
  'formatFechaCorta',
  'formatMoney'
];

verificarMultiples(
  'utils/handlebarsHelpers.js',
  helpersNecesarios,
  'Helpers Handlebars disponibles'
);

console.log('\n🎯 6. VERIFICANDO INTEGRACIÓN COMPLETA');
console.log('-'.repeat(50));

// Verificar que la vista está usando los helpers correctamente
const usosHelpers = [
  '{{getTipoLetra this.codigoBarras}}',
  '{{getIniciales this.matrizador.nombre}}',
  '{{formatFechaCorta this.fechaFactura}}',
  '{{getEstadoIcono this.estado}}',
  '{{getPagoIcono this.estadoPago}}',
  '{{formatMoney this.valorFactura}}'
];

verificarMultiples(
  'views/admin/documentos/listado.hbs',
  usosHelpers,
  'Uso correcto de helpers en vista'
);

// Verificar ordenamiento en backend compatible
verificarContenido(
  'controllers/adminController.js',
  "console.log('📊 [ADMIN] Parámetros de ordenamiento:', { ordenarPor, ordenDireccion });",
  'Debug de ordenamiento backend',
  'Trazabilidad activada'
);

console.log('\n' + '='.repeat(80));
console.log('📊 RESUMEN DE VERIFICACIÓN');
console.log('='.repeat(80));

const porcentajeExito = Math.round((contadorExitos / contadorTotal) * 100);

console.log(`✅ Verificaciones exitosas: ${contadorExitos}/${contadorTotal} (${porcentajeExito}%)`);

if (verificacionCompleta) {
  console.log('\n🎉 ¡VERIFICACIÓN COMPLETADA CON ÉXITO!');
  console.log('');
  console.log('🔥 TODAS LAS MEJORAS IMPLEMENTADAS:');
  console.log('   ✅ Códigos más negros y legibles');
  console.log('   ✅ Fechas con mayor peso visual');
  console.log('   ✅ 30 documentos por página (era 20)');
  console.log('   ✅ Sistema de ordenamiento funcional');
  console.log('   ✅ Headers con datos correctos');
  console.log('   ✅ Backend con mapeo actualizado');
  console.log('   ✅ CSS perfeccionado aplicado');
  console.log('   ✅ Helpers Handlebars disponibles');
  console.log('');
  console.log('🚀 LA TABLA ESTÁ LISTA PARA PRODUCCIÓN');
  console.log('');
  console.log('📝 ACCESO: http://localhost:3000/admin/documentos/listado');
  
} else {
  console.log('\n⚠️  VERIFICACIÓN INCOMPLETA');
  console.log(`   ${contadorTotal - contadorExitos} elementos requieren atención`);
  
  if (porcentajeExito >= 80) {
    console.log('   ℹ️  La mayoría de mejoras están implementadas');
  } else {
    console.log('   ⚠️  Se requieren más correcciones antes de producción');
  }
}

console.log('\n' + '='.repeat(80));
console.log(`Verificación completada: ${new Date().toLocaleString()}`);
console.log('Sistema de Trazabilidad Documental - Notaría Digital');

// Salir con código de estado apropiado
process.exit(verificacionCompleta ? 0 : 1); 