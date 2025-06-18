#!/usr/bin/env node
/**
 * Script para identificar variables obsoletas en el .env
 * Ayuda a limpiar configuración del sistema anterior de notificaciones
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Colores para consola
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function colorPrint(text, color = 'reset') {
  console.log(`${colors[color]}${text}${colors.reset}`);
}

function printSeparator(title = '') {
  const separator = '='.repeat(60);
  if (title) {
    const padding = Math.max(0, Math.floor((60 - title.length) / 2));
    const titleLine = '='.repeat(padding) + ` ${title} ` + '='.repeat(60 - padding - title.length - 2);
    colorPrint(titleLine, 'cyan');
  } else {
    colorPrint(separator, 'cyan');
  }
}

// Variables que YA NO SE NECESITAN (relacionadas con el sistema anterior)
const variablesObsoletas = [
  'WHATSAPP_API_URL',
  'WHATSAPP_TOKEN',
  'WHATSAPP_ENVIO_REAL',
  'EMAIL_ENVIO_REAL',
  'NOTIFICATION_MODE'
];

// Variables NUEVAS requeridas para Twilio
const variablesNuevas = [
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
      'TWILIO_WHATSAPP_FROM',
  'TEST_MODE',
  'TEST_PHONE'
];

// Variables que se mantienen
const variablesExistentes = [
  'WHATSAPP_ENABLED',
  'NODE_ENV',
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
  'SESSION_SECRET',
  'PORT',
  'NOTARIA_NOMBRE',
  'NOTARIA_DIRECCION',
  'NOTARIA_HORARIO',
  'NOTARIA_TELEFONO',
  'LOG_LEVEL'
];

/**
 * Analiza el archivo .env actual
 */
function analizarEnv() {
  const envPath = path.join(process.cwd(), '.env');
  
  if (!fs.existsSync(envPath)) {
    colorPrint('❌ Archivo .env no encontrado', 'red');
    colorPrint('💡 Crea el archivo .env con las variables necesarias', 'yellow');
    return null;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  
  const variables = {
    obsoletas: [],
    nuevas: [],
    existentes: [],
    otras: []
  };
  
  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key] = trimmed.split('=');
      if (key) {
        const cleanKey = key.trim();
        
        if (variablesObsoletas.includes(cleanKey)) {
          variables.obsoletas.push({ key: cleanKey, line: trimmed });
        } else if (variablesNuevas.includes(cleanKey)) {
          variables.nuevas.push({ key: cleanKey, line: trimmed });
        } else if (variablesExistentes.includes(cleanKey)) {
          variables.existentes.push({ key: cleanKey, line: trimmed });
        } else {
          variables.otras.push({ key: cleanKey, line: trimmed });
        }
      }
    }
  });
  
  return variables;
}

/**
 * Muestra el análisis del .env
 */
function mostrarAnalisis(variables) {
  if (!variables) return;
  
  printSeparator('ANÁLISIS DEL ARCHIVO .ENV');
  
  // Variables obsoletas
  if (variables.obsoletas.length > 0) {
    colorPrint('\n🗑️  Variables OBSOLETAS (ya no se necesitan):', 'red');
    variables.obsoletas.forEach(v => {
      colorPrint(`  ❌ ${v.key} (del sistema anterior)`, 'red');
    });
    colorPrint('\n💡 Estas variables pueden ser eliminadas del .env', 'yellow');
  } else {
    colorPrint('\n✅ No hay variables obsoletas', 'green');
  }
  
  // Variables nuevas
  colorPrint('\n🆕 Variables para Twilio:', 'blue');
  const variablesNuevasEncontradas = variables.nuevas.map(v => v.key);
  variablesNuevas.forEach(varName => {
    if (variablesNuevasEncontradas.includes(varName)) {
      const valor = process.env[varName];
      if (valor) {
        if (varName.includes('TOKEN') || varName.includes('SID')) {
          const valorOculto = valor.substring(0, 8) + '*'.repeat(Math.max(0, valor.length - 8));
          colorPrint(`  ✅ ${varName}: ${valorOculto}`, 'green');
        } else {
          colorPrint(`  ✅ ${varName}: ${valor}`, 'green');
        }
      } else {
        colorPrint(`  ⚠️  ${varName}: configurada pero vacía`, 'yellow');
      }
    } else {
      colorPrint(`  ❌ ${varName}: NO CONFIGURADA`, 'red');
    }
  });
  
  // Variables existentes
  if (variables.existentes.length > 0) {
    colorPrint('\n🔧 Variables existentes (se mantienen):', 'blue');
    variables.existentes.forEach(v => {
      const valor = process.env[v.key];
      if (valor) {
        if (v.key.includes('PASSWORD') || v.key.includes('SECRET')) {
          colorPrint(`  ✅ ${v.key}: ****`, 'green');
        } else {
          colorPrint(`  ✅ ${v.key}: ${valor}`, 'green');
        }
      } else {
        colorPrint(`  ⚠️  ${v.key}: vacía`, 'yellow');
      }
    });
  }
  
  // Otras variables
  if (variables.otras.length > 0) {
    colorPrint('\n❓ Otras variables encontradas:', 'blue');
    variables.otras.forEach(v => {
      colorPrint(`  ℹ️  ${v.key}`, 'blue');
    });
  }
}

/**
 * Genera recomendaciones
 */
function generarRecomendaciones(variables) {
  if (!variables) return;
  
  printSeparator('RECOMENDACIONES');
  
  const problemas = [];
  const acciones = [];
  
  // Verificar variables obsoletas
  if (variables.obsoletas.length > 0) {
    problemas.push(`${variables.obsoletas.length} variables obsoletas encontradas`);
    acciones.push('Eliminar variables obsoletas del .env');
  }
  
  // Verificar variables faltantes
  const variablesNuevasEncontradas = variables.nuevas.map(v => v.key);
  const faltantes = variablesNuevas.filter(v => !variablesNuevasEncontradas.includes(v));
  
  if (faltantes.length > 0) {
    problemas.push(`${faltantes.length} variables de Twilio faltantes`);
    acciones.push('Agregar variables de Twilio al .env');
  }
  
  // Mostrar problemas
  if (problemas.length > 0) {
    colorPrint('⚠️  Problemas encontrados:', 'yellow');
    problemas.forEach(problema => {
      colorPrint(`  • ${problema}`, 'yellow');
    });
  } else {
    colorPrint('✅ No se encontraron problemas de configuración', 'green');
  }
  
  // Mostrar acciones recomendadas
  if (acciones.length > 0) {
    colorPrint('\n🔧 Acciones recomendadas:', 'blue');
    acciones.forEach((accion, index) => {
      colorPrint(`  ${index + 1}. ${accion}`, 'blue');
    });
    
    // Mostrar comandos específicos
    if (variables.obsoletas.length > 0) {
      colorPrint('\n📝 Variables a eliminar del .env:', 'red');
      variables.obsoletas.forEach(v => {
        colorPrint(`     ${v.line}`, 'red');
      });
    }
    
    if (faltantes.length > 0) {
      colorPrint('\n📝 Variables a agregar al .env:', 'green');
      faltantes.forEach(varName => {
        let valorEjemplo = '';
        switch (varName) {
          case 'TWILIO_ACCOUNT_SID':
            valorEjemplo = 'AC...';
            break;
          case 'TWILIO_AUTH_TOKEN':
            valorEjemplo = 'tu_auth_token';
            break;
          case 'TWILIO_WHATSAPP_FROM':
            valorEjemplo = 'whatsapp:+14155238886';
            break;
          case 'TEST_MODE':
            valorEjemplo = 'true';
            break;
          case 'TEST_PHONE':
            valorEjemplo = '+593999801901';
            break;
        }
        colorPrint(`     ${varName}=${valorEjemplo}`, 'green');
      });
    }
  }
  
  // Próximos pasos
  colorPrint('\n🚀 Próximos pasos:', 'bright');
  colorPrint('  1. Edita tu archivo .env según las recomendaciones', 'blue');
  colorPrint('  2. Ejecuta: node scripts/test-whatsapp.js', 'blue');
  colorPrint('  3. Si todo funciona, el sistema está listo', 'blue');
}

/**
 * Función principal
 */
function main() {
  console.clear();
  printSeparator('LIMPIEZA DE CONFIGURACIÓN - WHATSAPP TWILIO');
  
  colorPrint('🔍 Analizando archivo .env para migración a Twilio...', 'bright');
  
  const variables = analizarEnv();
  mostrarAnalisis(variables);
  generarRecomendaciones(variables);
  
  printSeparator('ANÁLISIS COMPLETADO');
  colorPrint('💡 Tip: Mantén una copia de respaldo de tu .env antes de hacer cambios', 'yellow');
}

// Ejecutar si es el archivo principal
if (require.main === module) {
  main();
}

module.exports = {
  analizarEnv,
  mostrarAnalisis,
  generarRecomendaciones
}; 