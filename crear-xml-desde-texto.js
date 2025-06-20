/**
 * Script para crear archivos XML desde texto pegado
 * 
 * USO:
 * 1. Ejecuta: node crear-xml-desde-texto.js
 * 2. Pega el contenido XML cuando te lo pida
 * 3. El archivo se guardará automáticamente en xmls-correccion/
 */

const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function crearXMLDesdeTexto() {
  console.log('📝 CREADOR DE ARCHIVOS XML DESDE TEXTO');
  console.log('=' .repeat(50));
  console.log('📋 Pega el contenido XML completo y presiona Enter dos veces cuando termines:');
  console.log('   (Para terminar, escribe "FIN" en una línea vacía)');
  console.log('');

  let contenidoXML = '';
  let lineasVacias = 0;

  return new Promise((resolve) => {
    rl.on('line', (linea) => {
      if (linea.trim() === 'FIN') {
        procesarXML(contenidoXML);
        rl.close();
        resolve();
      } else if (linea.trim() === '') {
        lineasVacias++;
        if (lineasVacias >= 2) {
          procesarXML(contenidoXML);
          rl.close();
          resolve();
        }
      } else {
        lineasVacias = 0;
        contenidoXML += linea + '\n';
      }
    });
  });
}

function procesarXML(contenido) {
  if (!contenido.trim()) {
    console.log('❌ No se proporcionó contenido XML');
    return;
  }

  try {
    // Extraer número de factura para el nombre del archivo
    const numeroFacturaMatch = contenido.match(/<secuencial>(\d+)<\/secuencial>/);
    const establecimientoMatch = contenido.match(/<estab>(\d+)<\/estab>/);
    const puntoEmisionMatch = contenido.match(/<ptoEmi>(\d+)<\/ptoEmi>/);

    let nombreArchivo = `factura_${Date.now()}.xml`;
    
    if (numeroFacturaMatch && establecimientoMatch && puntoEmisionMatch) {
      const estab = establecimientoMatch[1];
      const ptoEmi = puntoEmisionMatch[1];
      const secuencial = numeroFacturaMatch[1];
      nombreArchivo = `factura_${estab}_${ptoEmi}_${secuencial}.xml`;
    }

    // Crear carpeta si no existe
    if (!fs.existsSync('./xmls-correccion')) {
      fs.mkdirSync('./xmls-correccion');
    }

    // Guardar archivo
    const rutaArchivo = `./xmls-correccion/${nombreArchivo}`;
    fs.writeFileSync(rutaArchivo, contenido);

    console.log(`✅ XML guardado como: ${nombreArchivo}`);
    console.log(`📁 Ubicación: ${rutaArchivo}`);
    console.log('');
    console.log('🔄 ¿Quieres agregar otro XML? (s/n)');
    
    rl.question('', (respuesta) => {
      if (respuesta.toLowerCase() === 's' || respuesta.toLowerCase() === 'si') {
        console.log('\n📝 Pega el siguiente XML:');
        crearXMLDesdeTexto();
      } else {
        console.log('\n✅ Archivos XML creados. Ahora ejecuta:');
        console.log('   node procesar-xmls-correccion.js');
        rl.close();
      }
    });

  } catch (error) {
    console.error('❌ Error procesando XML:', error.message);
    rl.close();
  }
}

crearXMLDesdeTexto(); 