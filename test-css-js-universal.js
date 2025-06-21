const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando archivos CSS y JS universales...\n');

// Verificar archivos CSS
const cssPath = path.join(__dirname, 'public', 'css', 'table-universal.css');
console.log('📄 CSS Universal:');
if (fs.existsSync(cssPath)) {
  const stats = fs.statSync(cssPath);
  console.log(`✅ Archivo existe: ${cssPath}`);
  console.log(`📊 Tamaño: ${(stats.size / 1024).toFixed(2)} KB`);
  console.log(`📅 Modificado: ${stats.mtime.toLocaleString()}`);
} else {
  console.log(`❌ Archivo NO existe: ${cssPath}`);
}

// Verificar archivos JS
const jsPath = path.join(__dirname, 'public', 'js', 'table-universal.js');
console.log('\n📄 JavaScript Universal:');
if (fs.existsSync(jsPath)) {
  const stats = fs.statSync(jsPath);
  console.log(`✅ Archivo existe: ${jsPath}`);
  console.log(`📊 Tamaño: ${(stats.size / 1024).toFixed(2)} KB`);
  console.log(`📅 Modificado: ${stats.mtime.toLocaleString()}`);
} else {
  console.log(`❌ Archivo NO existe: ${jsPath}`);
}

// Verificar layouts actualizados
const layouts = ['admin', 'caja', 'matrizador', 'recepcion', 'archivo'];
console.log('\n📄 Verificando layouts actualizados:');

layouts.forEach(layout => {
  const layoutPath = path.join(__dirname, 'views', 'layouts', `${layout}.hbs`);
  if (fs.existsSync(layoutPath)) {
    const content = fs.readFileSync(layoutPath, 'utf8');
    const hasCSS = content.includes('table-universal.css');
    const hasJS = content.includes('table-universal.js');
    
    console.log(`📁 Layout ${layout}.hbs:`);
    console.log(`  ${hasCSS ? '✅' : '❌'} CSS Universal incluido`);
    console.log(`  ${hasJS ? '✅' : '❌'} JS Universal incluido`);
  } else {
    console.log(`❌ Layout ${layout}.hbs NO existe`);
  }
});

// Verificar vistas migradas
const vistas = [
  'views/admin/documentos/listado.hbs',
  'views/caja/documentos/listado.hbs',
  'views/matrizadores/documentos/listado.hbs',
  'views/recepcion/documentos/listado.hbs',
  'views/archivo/documentos/listado-todos.hbs'
];

console.log('\n📄 Verificando vistas migradas:');
vistas.forEach(vista => {
  const vistaPath = path.join(__dirname, vista);
  if (fs.existsSync(vistaPath)) {
    const content = fs.readFileSync(vistaPath, 'utf8');
    const hasTablaOrdenable = content.includes('tabla-ordenable');
    const hasCirculosPago = content.includes('pago-circulo');
    const hasOrdenamiento = content.includes('inicializarOrdenamientoManual');
    
    const nombreVista = vista.split('/').slice(-2).join('/');
    console.log(`📁 ${nombreVista}:`);
    console.log(`  ${hasTablaOrdenable ? '✅' : '❌'} Tabla ordenable`);
    console.log(`  ${hasCirculosPago ? '✅' : '❌'} Círculos de pago`);
    console.log(`  ${hasOrdenamiento ? '✅' : '❌'} Ordenamiento manual`);
  } else {
    console.log(`❌ Vista ${vista} NO existe`);
  }
});

console.log('\n🎯 Resumen:');
console.log('- Si todos los archivos existen y están incluidos, el sistema debería funcionar');
console.log('- Reinicie el servidor para aplicar los cambios en los layouts');
console.log('- Verifique que las rutas /css/table-universal.css y /js/table-universal.js son accesibles'); 