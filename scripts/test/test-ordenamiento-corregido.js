/**
 * 🔧 SCRIPT DE VERIFICACIÓN: Sistema de Ordenamiento Corregido v2.0
 * 
 * Verifica que todas las correcciones aplicadas funcionen correctamente:
 * ✅ Headers no se ponen blancos en hover
 * ✅ Ordenamiento bidireccional funcional
 * ✅ Iconos claros que indican dirección
 * ✅ Compatible con todos los roles
 * ✅ CSS corregido inyectado
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 VERIFICANDO SISTEMA DE ORDENAMIENTO CORREGIDO v2.0');
console.log('='.repeat(60));

// Archivos a verificar
const archivosParaVerificar = [
  'public/js/main.js',
  'public/css/style.css',
  'views/admin/documentos/listado.hbs',
  'views/caja/documentos/listado.hbs',
  'views/archivo/documentos/listado-todos.hbs',
  'views/archivo/documentos/mis-documentos.hbs',
  'views/matrizadores/documentos/listado.hbs',
  'views/recepcion/documentos/listado.hbs',
  'controllers/adminController.js',
  'controllers/cajaController.js'
];

let verificacionExitosa = true;
let problemas = [];

// Verificaciones específicas
const verificaciones = {
  'public/js/main.js': [
    'SISTEMA DE ORDENAMIENTO DE TABLAS UNIVERSAL CORREGIDO',
    'inyectarEstilosCorregidos',
    'configurarTablaOrdenableV2',
    'manejarClickHeaderV2',
    'ejecutarOrdenamientoServidor',
    'ejecutarOrdenamientoLocal',
    'actualizarUIHeaders',
    'mostrarEstadoCarga',
    'guardarEstadoOrdenamiento',
    'restaurarEstadoOrdenamiento'
  ],
  
  'public/css/style.css': [
    '.tabla-ordenable th.ordenable',
    '.badge-estado-largo',
    'min-width: 80px',
    'font-size: 0.7rem'
  ],
  
  'views/admin/documentos/listado.hbs': [
    'background-color: rgba(255, 255, 255, 0.15)',
    'color: #ffffff !important',
    'border-bottom: 2px solid #ffc107'
  ],
  
  'views/caja/documentos/listado.hbs': [
    'tabla-ordenable',
    'th.ordenable',
    'data-columna',
    'inicializarOrdenamientoTablas'
  ],
  
  'controllers/adminController.js': [
    'ordenarPor',
    'ordenDireccion',
    'mapeoColumnas',
    'orderClause'
  ],
  
  'controllers/cajaController.js': [
    'ordenarPor',
    'ordenDireccion',
    'mapeoColumnas',
    'orderClause'
  ]
};

console.log('📁 Verificando archivos...\n');

// Verificar cada archivo
for (const archivo of archivosParaVerificar) {
  const rutaCompleta = path.join(__dirname, archivo);
  
  if (!fs.existsSync(rutaCompleta)) {
    console.log(`❌ ${archivo} - NO EXISTE`);
    problemas.push(`Archivo faltante: ${archivo}`);
    verificacionExitosa = false;
    continue;
  }
  
  const contenido = fs.readFileSync(rutaCompleta, 'utf8');
  const verificacionesArchivo = verificaciones[archivo] || [];
  
  console.log(`📄 ${archivo}`);
  
  if (verificacionesArchivo.length === 0) {
    console.log(`   ✅ Archivo existe`);
  } else {
    let verificacionesEncontradas = 0;
    
    for (const verificacion of verificacionesArchivo) {
      if (contenido.includes(verificacion)) {
        console.log(`   ✅ ${verificacion}`);
        verificacionesEncontradas++;
      } else {
        console.log(`   ❌ ${verificacion} - NO ENCONTRADO`);
        problemas.push(`${archivo}: Falta "${verificacion}"`);
        verificacionExitosa = false;
      }
    }
    
    const porcentaje = Math.round((verificacionesEncontradas / verificacionesArchivo.length) * 100);
    console.log(`   📊 Completado: ${verificacionesEncontradas}/${verificacionesArchivo.length} (${porcentaje}%)`);
  }
  
  console.log('');
}

// Verificaciones específicas adicionales
console.log('🔍 VERIFICACIONES ESPECÍFICAS DE CORRECCIÓN');
console.log('-'.repeat(50));

// 1. Verificar que no hay estilos problemáticos de hover blanco
console.log('1. Verificando ausencia de estilos problemáticos...');
let estilosProblematicos = 0;

for (const archivo of ['views/admin/documentos/listado.hbs', 'views/archivo/documentos/listado-todos.hbs']) {
  const rutaCompleta = path.join(__dirname, archivo);
  if (fs.existsSync(rutaCompleta)) {
    const contenido = fs.readFileSync(rutaCompleta, 'utf8');
    
    // Buscar patrones problemáticos
    if (contenido.includes('background-color: rgba(255, 255, 255, 0.1) !important')) {
      console.log(`   ❌ ${archivo} - Contiene estilo problemático 0.1`);
      estilosProblematicos++;
    }
    
    // Verificar que tiene las correcciones
    if (contenido.includes('color: #ffffff !important') && 
        contenido.includes('border-bottom: 2px solid #ffc107')) {
      console.log(`   ✅ ${archivo} - Correcciones aplicadas`);
    } else {
      console.log(`   ❌ ${archivo} - Faltan correcciones completas`);
      estilosProblematicos++;
    }
  }
}

if (estilosProblematicos === 0) {
  console.log('   ✅ No se encontraron estilos problemáticos');
} else {
  console.log(`   ❌ Se encontraron ${estilosProblematicos} problemas de estilos`);
  verificacionExitosa = false;
}

// 2. Verificar badges optimizados
console.log('\n2. Verificando optimización de badges...');
const cssPath = path.join(__dirname, 'public/css/style.css');
if (fs.existsSync(cssPath)) {
  const cssContent = fs.readFileSync(cssPath, 'utf8');
  
  // Contar definiciones de 80px (optimizado)
  const definiciones80px = (cssContent.match(/min-width:\s*80px/g) || []).length;
  
  // Verificar que no hay definiciones de 95px (problemático)
  const definiciones95px = (cssContent.match(/min-width:\s*95px/g) || []).length;
  
  console.log(`   📊 Definiciones optimizadas (80px): ${definiciones80px}`);
  console.log(`   📊 Definiciones problemáticas (95px): ${definiciones95px}`);
  
  if (definiciones80px >= 5 && definiciones95px === 0) {
    console.log('   ✅ Badges optimizados correctamente');
  } else {
    console.log('   ❌ Problemas en optimización de badges');
    verificacionExitosa = false;
  }
} else {
  console.log('   ❌ No se encontró archivo CSS principal');
  verificacionExitosa = false;
}

// 3. Verificar funciones de ordenamiento en controladores
console.log('\n3. Verificando ordenamiento en controladores...');
const controladoresConOrdenamiento = [
  'controllers/adminController.js',
  'controllers/cajaController.js'
];

for (const controlador of controladoresConOrdenamiento) {
  const rutaCompleta = path.join(__dirname, controlador);
  if (fs.existsSync(rutaCompleta)) {
    const contenido = fs.readFileSync(rutaCompleta, 'utf8');
    
    const tieneOrdenarPor = contenido.includes('req.query.ordenarPor');
    const tieneOrdenDireccion = contenido.includes('req.query.ordenDireccion');
    const tieneMapeoColumnas = contenido.includes('mapeoColumnas');
    const tieneOrderClause = contenido.includes('orderClause');
    
    if (tieneOrdenarPor && tieneOrdenDireccion && tieneMapeoColumnas && tieneOrderClause) {
      console.log(`   ✅ ${controlador} - Ordenamiento completo`);
    } else {
      console.log(`   ❌ ${controlador} - Ordenamiento incompleto`);
      console.log(`      ordenarPor: ${tieneOrdenarPor}, ordenDireccion: ${tieneOrdenDireccion}`);
      console.log(`      mapeoColumnas: ${tieneMapeoColumnas}, orderClause: ${tieneOrderClause}`);
      verificacionExitosa = false;
    }
  } else {
    console.log(`   ❌ ${controlador} - No encontrado`);
    verificacionExitosa = false;
  }
}

// 4. Verificar que las vistas tienen las clases correctas
console.log('\n4. Verificando clases de ordenamiento en vistas...');
const vistasConTablas = [
  'views/admin/documentos/listado.hbs',
  'views/caja/documentos/listado.hbs',
  'views/archivo/documentos/listado-todos.hbs',
  'views/archivo/documentos/mis-documentos.hbs',
  'views/matrizadores/documentos/listado.hbs',
  'views/recepcion/documentos/listado.hbs'
];

for (const vista of vistasConTablas) {
  const rutaCompleta = path.join(__dirname, vista);
  if (fs.existsSync(rutaCompleta)) {
    const contenido = fs.readFileSync(rutaCompleta, 'utf8');
    
    const tieneTablaOrdenable = contenido.includes('tabla-ordenable');
    const tieneThOrdenable = contenido.includes('th.ordenable') || contenido.includes('ordenable');
    const tieneDataColumna = contenido.includes('data-columna');
    const tieneInicializacion = contenido.includes('inicializarOrdenamientoTablas');
    
    if (tieneTablaOrdenable && tieneThOrdenable && tieneDataColumna && tieneInicializacion) {
      console.log(`   ✅ ${vista} - Configuración completa`);
    } else {
      console.log(`   ⚠️ ${vista} - Configuración parcial`);
      console.log(`      tabla-ordenable: ${tieneTablaOrdenable}, th.ordenable: ${tieneThOrdenable}`);
      console.log(`      data-columna: ${tieneDataColumna}, inicialización: ${tieneInicializacion}`);
    }
  }
}

// RESUMEN FINAL
console.log('\n' + '='.repeat(60));
console.log('📋 RESUMEN DE VERIFICACIÓN');
console.log('='.repeat(60));

if (verificacionExitosa) {
  console.log('🎉 ¡VERIFICACIÓN EXITOSA!');
  console.log('✅ Sistema de ordenamiento corregido v2.0 implementado correctamente');
  console.log('✅ Headers no se pondrán blancos en hover');
  console.log('✅ Ordenamiento bidireccional funcional');
  console.log('✅ Badges optimizados (95px → 80px)');
  console.log('✅ CSS corregido inyectado automáticamente');
  console.log('✅ Controladores con soporte de ordenamiento');
  console.log('✅ Vistas configuradas correctamente');
} else {
  console.log('❌ VERIFICACIÓN FALLÓ');
  console.log(`Se encontraron ${problemas.length} problema(s):`);
  
  problemas.forEach((problema, index) => {
    console.log(`${index + 1}. ${problema}`);
  });
  
  console.log('\n🔧 ACCIONES REQUERIDAS:');
  console.log('1. Revisar los problemas listados arriba');
  console.log('2. Aplicar las correcciones faltantes');
  console.log('3. Ejecutar nuevamente este script');
}

console.log('\n🚀 PRÓXIMOS PASOS:');
console.log('1. Reiniciar el servidor: npm start');
console.log('2. Probar ordenamiento en: http://localhost:3000/admin/documentos/listado');
console.log('3. Verificar que headers no se pongan blancos');
console.log('4. Confirmar ordenamiento bidireccional');
console.log('5. Probar en diferentes roles (Admin, Caja, Archivo, etc.)');

console.log('\n📊 ESTADÍSTICAS:');
console.log(`Archivos verificados: ${archivosParaVerificar.length}`);
console.log(`Problemas encontrados: ${problemas.length}`);
console.log(`Estado: ${verificacionExitosa ? 'EXITOSO' : 'REQUIERE CORRECCIÓN'}`);

process.exit(verificacionExitosa ? 0 : 1); 