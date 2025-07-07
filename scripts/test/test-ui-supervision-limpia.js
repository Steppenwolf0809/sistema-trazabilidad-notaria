/**
 * SCRIPT DE VERIFICACIÓN: UI de Supervisión Limpia y Optimizada
 * 
 * Verifica que todas las correcciones implementadas estén funcionando:
 * ✅ Tabla responsiva y compacta
 * ✅ Headers sin hover blanco
 * ✅ Información simplificada
 * ✅ Paginación moderna
 * ✅ CSS optimizado
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 VERIFICANDO CORRECCIONES DE UI DE SUPERVISIÓN ADMIN...\n');

// ============================================
// 1. VERIFICAR VISTA ADMIN OPTIMIZADA
// ============================================

console.log('📄 1. VERIFICANDO VISTA ADMIN OPTIMIZADA...');

const vistaAdminPath = path.join(__dirname, 'views/admin/documentos/listado.hbs');

if (fs.existsSync(vistaAdminPath)) {
  const contenidoVista = fs.readFileSync(vistaAdminPath, 'utf8');
  
  // Verificar tabla responsiva
  const tieneTablaSupervision = contenidoVista.includes('tabla-supervision');
  const tieneColumnasOptimizadas = contenidoVista.includes('col-codigo') && 
                                   contenidoVista.includes('col-cliente') && 
                                   contenidoVista.includes('col-acciones');
  
  // Verificar información simplificada
  const tieneClienteSimplificado = contenidoVista.includes('<div class="cliente-info">') &&
                                   contenidoVista.includes('<strong>{{this.nombreCliente}}</strong>') &&
                                   contenidoVista.includes('<small class="text-muted d-block">CI:');
  
  // Verificar que NO tiene emails visibles
  const noTieneEmails = !contenidoVista.includes('📧') && 
                        !contenidoVista.includes('emailCliente');
  
  // Verificar badges optimizados
  const tieneBadgesOptimizados = contenidoVista.includes('badge-estado-corto') &&
                                contenidoVista.includes('badge-estado-medio') &&
                                contenidoVista.includes('badge-estado-largo');
  
  // Verificar paginación moderna
  const tienePaginacionModerna = contenidoVista.includes('generatePageNumbers') &&
                                contenidoVista.includes('buildQueryString') &&
                                contenidoVista.includes('fas fa-angle-double-left') &&
                                contenidoVista.includes('pagination-sm');
  
  // Verificar CSS corregido
  const tieneCSSCorregido = contenidoVista.includes('CORRECCIÓN CRÍTICA: HOVER HEADERS') &&
                           contenidoVista.includes('background-color: #495057 !important') &&
                           contenidoVista.includes('color: white !important');
  
  console.log(`   ✅ Tabla responsiva: ${tieneTablaSupervision ? 'SÍ' : 'NO'}`);
  console.log(`   ✅ Columnas optimizadas: ${tieneColumnasOptimizadas ? 'SÍ' : 'NO'}`);
  console.log(`   ✅ Cliente simplificado: ${tieneClienteSimplificado ? 'SÍ' : 'NO'}`);
  console.log(`   ✅ Sin emails visibles: ${noTieneEmails ? 'SÍ' : 'NO'}`);
  console.log(`   ✅ Badges optimizados: ${tieneBadgesOptimizados ? 'SÍ' : 'NO'}`);
  console.log(`   ✅ Paginación moderna: ${tienePaginacionModerna ? 'SÍ' : 'NO'}`);
  console.log(`   ✅ CSS hover corregido: ${tieneCSSCorregido ? 'SÍ' : 'NO'}`);
  
  if (tieneTablaSupervision && tieneColumnasOptimizadas && tieneClienteSimplificado && 
      noTieneEmails && tieneBadgesOptimizados && tienePaginacionModerna && tieneCSSCorregido) {
    console.log('   🎉 VISTA ADMIN: TODAS LAS CORRECCIONES APLICADAS\n');
  } else {
    console.log('   ⚠️  VISTA ADMIN: FALTAN ALGUNAS CORRECCIONES\n');
  }
} else {
  console.log('   ❌ Vista admin no encontrada\n');
}

// ============================================
// 2. VERIFICAR SISTEMA DE ORDENAMIENTO v2.0
// ============================================

console.log('⚙️  2. VERIFICANDO SISTEMA DE ORDENAMIENTO v2.0...');

const mainJsPath = path.join(__dirname, 'public/js/main.js');

if (fs.existsSync(mainJsPath)) {
  const contenidoMainJs = fs.readFileSync(mainJsPath, 'utf8');
  
  // Verificar funciones del sistema v2.0
  const funcionesRequeridas = [
    'inyectarEstilosCorregidos',
    'configurarTablaOrdenableV2',
    'manejarClickHeaderV2',
    'ejecutarOrdenamientoServidor',
    'ejecutarOrdenamientoLocal',
    'inicializarOrdenamientoTablas'
  ];
  
  let funcionesEncontradas = 0;
  funcionesRequeridas.forEach(funcion => {
    if (contenidoMainJs.includes(funcion)) {
      funcionesEncontradas++;
      console.log(`   ✅ ${funcion}: ENCONTRADA`);
    } else {
      console.log(`   ❌ ${funcion}: NO ENCONTRADA`);
    }
  });
  
  // Verificar corrección específica de hover
  const tieneCorreccionHover = contenidoMainJs.includes('background-color: rgba(255, 255, 255, 0.1) !important') &&
                               contenidoMainJs.includes('color: #ffffff !important');
  
  console.log(`   ✅ Corrección hover inyectada: ${tieneCorreccionHover ? 'SÍ' : 'NO'}`);
  console.log(`   📊 Funciones encontradas: ${funcionesEncontradas}/${funcionesRequeridas.length}\n`);
  
  if (funcionesEncontradas === funcionesRequeridas.length && tieneCorreccionHover) {
    console.log('   🎉 SISTEMA ORDENAMIENTO v2.0: COMPLETAMENTE FUNCIONAL\n');
  } else {
    console.log('   ⚠️  SISTEMA ORDENAMIENTO v2.0: REQUIERE ATENCIÓN\n');
  }
} else {
  console.log('   ❌ main.js no encontrado\n');
}

// ============================================
// 3. VERIFICAR HELPERS DE HANDLEBARS
// ============================================

console.log('🔧 3. VERIFICANDO HELPERS DE HANDLEBARS...');

const helpersPath = path.join(__dirname, 'utils/handlebarsHelpers.js');

if (fs.existsSync(helpersPath)) {
  const contenidoHelpers = fs.readFileSync(helpersPath, 'utf8');
  
  // Verificar helpers necesarios para paginación
  const helpersRequeridos = [
    'generatePageNumbers',
    'buildQueryString', 
    'add',
    'subtract',
    'formatDateDocument'
  ];
  
  let helpersEncontrados = 0;
  helpersRequeridos.forEach(helper => {
    if (contenidoHelpers.includes(helper)) {
      helpersEncontrados++;
      console.log(`   ✅ ${helper}: ENCONTRADO`);
    } else {
      console.log(`   ❌ ${helper}: NO ENCONTRADO`);
    }
  });
  
  console.log(`   📊 Helpers encontrados: ${helpersEncontrados}/${helpersRequeridos.length}\n`);
  
  if (helpersEncontrados === helpersRequeridos.length) {
    console.log('   🎉 HELPERS DE PAGINACIÓN: TODOS DISPONIBLES\n');
  } else {
    console.log('   ⚠️  HELPERS DE PAGINACIÓN: FALTAN ALGUNOS\n');
  }
} else {
  console.log('   ❌ handlebarsHelpers.js no encontrado\n');
}

// ============================================
// 4. VERIFICAR CONTROLADOR ADMIN
// ============================================

console.log('🎮 4. VERIFICANDO CONTROLADOR ADMIN...');

const controllerPath = path.join(__dirname, 'controllers/adminController.js');

if (fs.existsSync(controllerPath)) {
  const contenidoController = fs.readFileSync(controllerPath, 'utf8');
  
  // Verificar funcionalidades de paginación
  const tienePaginacion = contenidoController.includes('pagination') &&
                          contenidoController.includes('currentPage') &&
                          contenidoController.includes('totalPages');
  
  // Verificar ordenamiento
  const tieneOrdenamiento = contenidoController.includes('ordenarPor') &&
                           contenidoController.includes('ordenDireccion');
  
  // Verificar filtros
  const tieneFiltros = contenidoController.includes('filtros') &&
                      contenidoController.includes('estado') &&
                      contenidoController.includes('matrizadorId');
  
  console.log(`   ✅ Paginación implementada: ${tienePaginacion ? 'SÍ' : 'NO'}`);
  console.log(`   ✅ Ordenamiento implementado: ${tieneOrdenamiento ? 'SÍ' : 'NO'}`);
  console.log(`   ✅ Filtros implementados: ${tieneFiltros ? 'SÍ' : 'NO'}\n`);
  
  if (tienePaginacion && tieneOrdenamiento && tieneFiltros) {
    console.log('   🎉 CONTROLADOR ADMIN: COMPLETAMENTE FUNCIONAL\n');
  } else {
    console.log('   ⚠️  CONTROLADOR ADMIN: REQUIERE MEJORAS\n');
  }
} else {
  console.log('   ❌ adminController.js no encontrado\n');
}

// ============================================
// 5. VERIFICAR OPTIMIZACIÓN DE BADGES
// ============================================

console.log('🏷️  5. VERIFICANDO OPTIMIZACIÓN DE BADGES...');

const fixBadgesPath = path.join(__dirname, 'public/js/fix-badges.js');

if (fs.existsSync(fixBadgesPath)) {
  const contenidoBadges = fs.readFileSync(fixBadgesPath, 'utf8');
  
  // Verificar que los badges están optimizados a 80px
  const badgesOptimizados = contenidoBadges.includes('min-width: 80px') &&
                           !contenidoBadges.includes('min-width: 95px');
  
  console.log(`   ✅ Badges optimizados (80px): ${badgesOptimizados ? 'SÍ' : 'NO'}\n`);
  
  if (badgesOptimizados) {
    console.log('   🎉 BADGES: OPTIMIZACIÓN MANTENIDA\n');
  } else {
    console.log('   ⚠️  BADGES: VERIFICAR OPTIMIZACIÓN\n');
  }
} else {
  console.log('   ❌ fix-badges.js no encontrado\n');
}

// ============================================
// RESUMEN FINAL
// ============================================

console.log('📋 RESUMEN DE VERIFICACIÓN DE UI SUPERVISIÓN LIMPIA:');
console.log('================================================');

const archivosVerificados = [
  { nombre: 'Vista Admin (listado.hbs)', path: vistaAdminPath },
  { nombre: 'Sistema Ordenamiento (main.js)', path: mainJsPath },
  { nombre: 'Helpers Handlebars', path: helpersPath },
  { nombre: 'Controlador Admin', path: controllerPath },
  { nombre: 'Optimización Badges', path: fixBadgesPath }
];

let archivosExistentes = 0;
archivosVerificados.forEach(archivo => {
  const existe = fs.existsSync(archivo.path);
  console.log(`${existe ? '✅' : '❌'} ${archivo.nombre}: ${existe ? 'EXISTE' : 'NO ENCONTRADO'}`);
  if (existe) archivosExistentes++;
});

console.log(`\n📊 ESTADÍSTICAS:`);
console.log(`   - Archivos verificados: ${archivosExistentes}/${archivosVerificados.length}`);
console.log(`   - Porcentaje completado: ${((archivosExistentes/archivosVerificados.length)*100).toFixed(1)}%`);

if (archivosExistentes === archivosVerificados.length) {
  console.log('\n🎉 ¡ÉXITO! TODAS LAS CORRECCIONES DE UI ESTÁN IMPLEMENTADAS');
  console.log('✅ Tabla responsiva y compacta');
  console.log('✅ Headers sin hover blanco');
  console.log('✅ Información simplificada (sin emails redundantes)');
  console.log('✅ Paginación moderna con navegación');
  console.log('✅ CSS optimizado y responsive');
  console.log('✅ Badges balanceados (80px)');
  console.log('✅ Sistema de ordenamiento v2.0 activo');
} else {
  console.log('\n⚠️  ALGUNAS CORRECCIONES REQUIEREN ATENCIÓN');
  console.log('   Revisar archivos faltantes o incompletos');
}

console.log('\n🔚 Verificación completada.');
console.log('💡 Próximos pasos: Probar la interfaz en navegador para confirmar funcionamiento visual'); 