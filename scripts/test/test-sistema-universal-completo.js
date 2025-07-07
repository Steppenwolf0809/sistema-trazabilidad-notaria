/**
 * PRUEBA COMPLETA DEL SISTEMA UNIVERSAL DE TABLAS
 * ================================================
 * 
 * Este script verifica:
 * 1. Que todos los helpers de Handlebars estén disponibles
 * 2. Que todas las vistas usen el sistema universal correctamente
 * 3. Que no falten dependencias CSS/JS
 * 4. Que las tablas se vean uniformes
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 INICIANDO PRUEBA COMPLETA DEL SISTEMA UNIVERSAL');
console.log('==================================================\n');

// ============== VERIFICAR HELPERS DE HANDLEBARS ==============

console.log('📋 1. VERIFICANDO HELPERS DE HANDLEBARS');
console.log('=========================================');

const helpersPath = './utils/handlebarsHelpers.js';
let helpersContent = '';

try {
  helpersContent = fs.readFileSync(helpersPath, 'utf8');
  console.log('✅ Archivo handlebarsHelpers.js encontrado');
} catch (error) {
  console.error('❌ Error leyendo handlebarsHelpers.js:', error.message);
  process.exit(1);
}

// Lista de helpers requeridos para el sistema universal
const helpersRequeridos = [
  // Helpers de fecha
  'formatDateTime',
  'formatDate', 
  'formatDateEcuador',
  'formatFechaCorta',
  'formatFechaFactura',
  
  // Helpers de formato monetario
  'formatMoney',
  'formatDineroCompleto',
  'formatNumber',
  
  // Helpers de comparación
  'eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'and', 'or',
  
  // Helpers de utilidades
  'truncate',
  'capitalize',
  'ucfirst',
  'json',
  
  // Helpers universales de tabla
  'getTipoLetra',
  'getIniciales',
  'getEstadoIcono',
  'getPagoIcono',
  'getEstadoClase',
  'getPagoClase',
  'getTituloEstado',
  'getTituloPago',
  
  // Helpers matemáticos
  'add',
  'subtract',
  
  // Helpers de paginación
  'generatePageNumbers',
  'buildQueryString'
];

console.log(`\n🔍 Verificando ${helpersRequeridos.length} helpers requeridos...`);

let helpersEncontrados = 0;
let helpersFaltantes = [];

helpersRequeridos.forEach(helper => {
  // Buscar en module.exports y en Handlebars.registerHelper
  const regexModuleExports = new RegExp(`${helper}\\s*:\\s*`, 'g');
  const regexRegisterHelper = new RegExp(`registerHelper\\s*\\(\\s*['"]${helper}['"]`, 'g');
  
  if (regexModuleExports.test(helpersContent) || regexRegisterHelper.test(helpersContent)) {
    console.log(`  ✅ ${helper}`);
    helpersEncontrados++;
  } else {
    console.log(`  ❌ ${helper} - FALTANTE`);
    helpersFaltantes.push(helper);
  }
});

console.log(`\n📊 RESULTADO HELPERS: ${helpersEncontrados}/${helpersRequeridos.length} encontrados`);

if (helpersFaltantes.length > 0) {
  console.log(`\n⚠️  HELPERS FALTANTES (${helpersFaltantes.length}):`);
  helpersFaltantes.forEach(helper => console.log(`   - ${helper}`));
} else {
  console.log('✅ Todos los helpers requeridos están disponibles');
}

// ============== VERIFICAR ARCHIVOS CSS Y JS ==============

console.log('\n\n📋 2. VERIFICANDO ARCHIVOS DEL SISTEMA UNIVERSAL');
console.log('===============================================');

const archivosSistema = [
  './public/css/table-universal.css',
  './public/js/table-universal.js'
];

archivosSistema.forEach(archivo => {
  if (fs.existsSync(archivo)) {
    const stats = fs.statSync(archivo);
    console.log(`✅ ${archivo} - ${(stats.size / 1024).toFixed(2)} KB`);
  } else {
    console.log(`❌ ${archivo} - FALTANTE`);
  }
});

// ============== VERIFICAR VISTAS MIGRADAS ==============

console.log('\n\n📋 3. VERIFICANDO VISTAS MIGRADAS AL SISTEMA UNIVERSAL');
console.log('====================================================');

const vistasMigradas = [
  './views/admin/documentos/listado.hbs',
  './views/caja/documentos/listado.hbs',
  './views/matrizadores/documentos/listado.hbs',
  './views/recepcion/documentos/listado.hbs',
  './views/archivo/documentos/listado-todos.hbs'
];

let vistasMigradasCorrectamente = 0;

vistasMigradas.forEach(vista => {
  console.log(`\n🔍 Verificando: ${vista}`);
  
  if (!fs.existsSync(vista)) {
    console.log(`  ❌ Archivo no encontrado`);
    return;
  }
  
  const contenido = fs.readFileSync(vista, 'utf8');
  
  // Verificaciones del sistema universal
  const verificaciones = [
    {
      nombre: 'Clase tabla-ordenable',
      regex: /tabla-ordenable/g,
      requerido: true
    },
    {
      nombre: 'Headers con data-columna',
      regex: /data-columna=/g,
      requerido: true
    },
    {
      nombre: 'Iconos de ordenamiento',
      regex: /sort-icon/g,
      requerido: true
    },
    {
      nombre: 'Círculos de pago',
      regex: /pago-circulo/g,
      requerido: true
    },
    {
      nombre: 'Helper formatFechaCorta',
      regex: /formatFechaCorta/g,
      requerido: true
    },
    {
      nombre: 'Helper getTipoLetra',
      regex: /getTipoLetra/g,
      requerido: true
    },
    {
      nombre: 'Helper getIniciales',
      regex: /getIniciales/g,
      requerido: true
    },
    {
      nombre: 'JavaScript de ordenamiento',
      regex: /inicializarOrdenamientoManual/g,
      requerido: true
    }
  ];
  
  let verificacionesOK = 0;
  
  verificaciones.forEach(verificacion => {
    const matches = contenido.match(verificacion.regex);
    const encontrado = matches && matches.length > 0;
    
    if (encontrado) {
      console.log(`  ✅ ${verificacion.nombre} (${matches.length} ocurrencias)`);
      verificacionesOK++;
    } else if (verificacion.requerido) {
      console.log(`  ❌ ${verificacion.nombre} - FALTANTE`);
    } else {
      console.log(`  ⚠️  ${verificacion.nombre} - Opcional no encontrado`);
    }
  });
  
  const porcentaje = Math.round((verificacionesOK / verificaciones.length) * 100);
  console.log(`  📊 Migración: ${verificacionesOK}/${verificaciones.length} (${porcentaje}%)`);
  
  if (porcentaje >= 85) {
    console.log(`  ✅ Vista migrada correctamente`);
    vistasMigradasCorrectamente++;
  } else {
    console.log(`  ⚠️  Vista necesita revisión`);
  }
});

console.log(`\n📊 RESULTADO MIGRACIÓN: ${vistasMigradasCorrectamente}/${vistasMigradas.length} vistas migradas correctamente`);

// ============== VERIFICAR CONSISTENCIA DE ESTILOS ==============

console.log('\n\n📋 4. VERIFICANDO CONSISTENCIA DE ESTILOS CSS');
console.log('============================================');

const cssUniversal = './public/css/table-universal.css';

if (fs.existsSync(cssUniversal)) {
  const cssContent = fs.readFileSync(cssUniversal, 'utf8');
  
  const estilosRequeridos = [
    '.tabla-ordenable',
    '.col-codigo',
    '.col-cliente', 
    '.col-matrizador',
    '.col-fecha',
    '.col-estado',
    '.col-pago',
    '.col-valor',
    '.col-acciones',
    '.codigo-universal',
    '.nombre-persona',
    '.info-secundaria',
    '.matrizador-universal',
    '.fecha-universal',
    '.estado-universal',
    '.pago-circulo',
    '.valor-monetario',
    '.btn-universal',
    '.sort-icon',
    '.sin-resultados'
  ];
  
  let estilosEncontrados = 0;
  
  estilosRequeridos.forEach(estilo => {
    if (cssContent.includes(estilo)) {
      console.log(`  ✅ ${estilo}`);
      estilosEncontrados++;
    } else {
      console.log(`  ❌ ${estilo} - FALTANTE`);
    }
  });
  
  console.log(`\n📊 ESTILOS: ${estilosEncontrados}/${estilosRequeridos.length} encontrados`);
} else {
  console.log('❌ Archivo CSS universal no encontrado');
}

// ============== VERIFICAR JAVASCRIPT UNIVERSAL ==============

console.log('\n\n📋 5. VERIFICANDO JAVASCRIPT UNIVERSAL');
console.log('=====================================');

const jsUniversal = './public/js/table-universal.js';

if (fs.existsSync(jsUniversal)) {
  const jsContent = fs.readFileSync(jsUniversal, 'utf8');
  
  const funcionesRequeridas = [
    'InicializadorTablas',
    'inicializarOrdenamiento',
    'inicializarFiltrosFechas',
    'aplicarOrdenamiento',
    'toggleOrdenamiento'
  ];
  
  let funcionesEncontradas = 0;
  
  funcionesRequeridas.forEach(funcion => {
    if (jsContent.includes(funcion)) {
      console.log(`  ✅ ${funcion}`);
      funcionesEncontradas++;
    } else {
      console.log(`  ❌ ${funcion} - FALTANTE`);
    }
  });
  
  console.log(`\n📊 FUNCIONES JS: ${funcionesEncontradas}/${funcionesRequeridas.length} encontradas`);
} else {
  console.log('❌ Archivo JavaScript universal no encontrado');
}

// ============== VERIFICAR REPORTES DE CAJA ==============

console.log('\n\n📋 6. VERIFICANDO REPORTES DE CAJA');
console.log('=================================');

const reportesCaja = [
  './views/caja/reportes/financiero.hbs',
  './views/caja/reportes/pendientes.hbs',
  './views/caja/reportes/cobros-matrizador.hbs',
  './views/caja/reportes/documentos.hbs'
];

reportesCaja.forEach(reporte => {
  if (fs.existsSync(reporte)) {
    const contenido = fs.readFileSync(reporte, 'utf8');
    
    // Verificar si usa tablas que necesiten migración
    const tieneTablas = contenido.includes('<table') && contenido.includes('<th');
    const usaSistemaUniversal = contenido.includes('tabla-ordenable') || contenido.includes('table-universal');
    
    if (tieneTablas) {
      if (usaSistemaUniversal) {
        console.log(`  ✅ ${reporte} - Usa sistema universal`);
      } else {
        console.log(`  ⚠️  ${reporte} - Tiene tablas pero NO usa sistema universal`);
      }
    } else {
      console.log(`  ℹ️  ${reporte} - Sin tablas complejas`);
    }
  } else {
    console.log(`  ❌ ${reporte} - No encontrado`);
  }
});

// ============== RESUMEN FINAL ==============

console.log('\n\n🎯 RESUMEN FINAL DE LA PRUEBA');
console.log('============================');

const puntuacionTotal = 
  (helpersEncontrados / helpersRequeridos.length) * 25 +
  (vistasMigradasCorrectamente / vistasMigradas.length) * 35 +
  (fs.existsSync('./public/css/table-universal.css') ? 20 : 0) +
  (fs.existsSync('./public/js/table-universal.js') ? 20 : 0);

console.log(`\n📊 PUNTUACIÓN TOTAL: ${Math.round(puntuacionTotal)}/100`);

if (puntuacionTotal >= 90) {
  console.log('🎉 EXCELENTE: Sistema universal completamente funcional');
} else if (puntuacionTotal >= 75) {
  console.log('✅ BUENO: Sistema universal mayormente funcional');
} else if (puntuacionTotal >= 60) {
  console.log('⚠️  REGULAR: Sistema universal necesita mejoras');
} else {
  console.log('❌ DEFICIENTE: Sistema universal necesita revisión completa');
}

console.log('\n📋 RECOMENDACIONES:');

if (helpersFaltantes.length > 0) {
  console.log('- Agregar helpers faltantes en handlebarsHelpers.js');
}

if (vistasMigradasCorrectamente < vistasMigradas.length) {
  console.log('- Completar migración de vistas pendientes');
}

if (!fs.existsSync('./public/css/table-universal.css')) {
  console.log('- Crear archivo CSS universal');
}

if (!fs.existsSync('./public/js/table-universal.js')) {
  console.log('- Crear archivo JavaScript universal');
}

console.log('\n✨ SIGUIENTE PASO: Ejecutar servidor y probar visualmente cada vista');
console.log('🔗 URLs a probar:');
console.log('   - /admin/documentos/listado');
console.log('   - /caja/documentos');
console.log('   - /matrizadores/documentos');
console.log('   - /recepcion/documentos');
console.log('   - /archivo/documentos/todos');

console.log('\n🧪 PRUEBA COMPLETADA'); 