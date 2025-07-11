/**
 * VALIDADOR: Sistema de Contactos Inteligente
 * Detecta problemas y proporciona soluciones para Railway
 */

const { sequelize } = require('./config/database');
const { verificarCampoExiste } = require('./ejecutar-migracion-contactos');

async function validarSistemaContactos() {
  try {
    console.log('🔍 VALIDANDO SISTEMA DE CONTACTOS INTELIGENTE');
    console.log('='.repeat(50));
    
    // Verificar conexión
    await sequelize.authenticate();
    console.log('✅ Conexión a la base de datos establecida');
    
    // Lista de campos requeridos
    const camposRequeridos = [
      'telefono_whatsapp',
      'contacto_validado',
      'contacto_conflicto', 
      'contacto_datos_analisis'
    ];
    
    console.log('📋 Verificando campos del sistema de contactos...');
    
    // Verificar cada campo
    const resultados = [];
    for (const campo of camposRequeridos) {
      const existe = await verificarCampoExiste('documentos', campo);
      resultados.push({
        campo,
        existe,
        estado: existe ? '✅ PRESENTE' : '❌ FALTANTE'
      });
      
      console.log(`   ${campo}: ${existe ? '✅ PRESENTE' : '❌ FALTANTE'}`);
    }
    
    // Análisis de resultados
    const camposFaltantes = resultados.filter(r => !r.existe);
    const todosCamposPresentes = camposFaltantes.length === 0;
    
    console.log('\n📊 RESUMEN DEL ANÁLISIS:');
    console.log('='.repeat(30));
    
    if (todosCamposPresentes) {
      console.log('🎉 SISTEMA COMPLETO: Todos los campos están presentes');
      console.log('✅ El sistema de contactos inteligente está funcionando correctamente');
      console.log('📱 Los XMLs se procesarán con análisis completo de contactos');
      
    } else {
      console.log('⚠️ SISTEMA INCOMPLETO: Faltan algunos campos');
      console.log(`❌ Campos faltantes: ${camposFaltantes.map(c => c.campo).join(', ')}`);
      console.log('🔧 El sistema funcionará en modo de compatibilidad');
      
      console.log('\n🚨 PROBLEMA DETECTADO:');
      console.log('El error "column telefono_whatsapp does not exist" indica que');
      console.log('la migración del sistema de contactos no se ha ejecutado en Railway.');
      
      console.log('\n💡 SOLUCIÓN PARA RAILWAY:');
      console.log('1. Ejecutar la migración en Railway:');
      console.log('   node ejecutar-migracion-contactos.js');
      console.log('');
      console.log('2. O usar el comando de Railway:');
      console.log('   railway run node ejecutar-migracion-contactos.js');
      console.log('');
      console.log('3. Verificar que se ejecutó correctamente:');
      console.log('   railway run node validar-sistema-contactos.js');
    }
    
    // Verificar si hay datos de prueba
    console.log('\n🔍 VERIFICANDO DATOS DE PRUEBA...');
    try {
      const [documentos] = await sequelize.query(`
        SELECT COUNT(*) as total 
        FROM documentos 
        WHERE telefono_cliente IS NOT NULL 
        OR email_cliente IS NOT NULL
      `);
      
      console.log(`📊 Documentos con datos de contacto: ${documentos[0].total}`);
      
      if (todosCamposPresentes) {
        const [documentosContacto] = await sequelize.query(`
          SELECT COUNT(*) as total 
          FROM documentos 
          WHERE telefono_whatsapp IS NOT NULL 
          OR contacto_validado = true
        `);
        
        console.log(`📱 Documentos con análisis de contacto: ${documentosContacto[0].total}`);
      }
      
    } catch (error) {
      console.log('⚠️ No se pudo verificar datos de prueba (normal si los campos no existen)');
    }
    
    console.log('\n🔧 MODO DE FUNCIONAMIENTO ACTUAL:');
    if (todosCamposPresentes) {
      console.log('✅ MODO COMPLETO: Sistema de contactos inteligente activo');
      console.log('   - Análisis automático de números de teléfono');
      console.log('   - Validación de contactos duplicados');
      console.log('   - Resolución de conflictos de contacto');
      console.log('   - Almacenamiento de datos de análisis');
    } else {
      console.log('⚠️ MODO COMPATIBILIDAD: Sistema básico de contactos');
      console.log('   - Solo teléfono y email básicos');
      console.log('   - Sin análisis inteligente');
      console.log('   - Sin validación automática');
      console.log('   - Los XMLs se procesarán pero sin funciones avanzadas');
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('🏁 VALIDACIÓN COMPLETADA');
    
    return {
      sistemaCompleto: todosCamposPresentes,
      camposFaltantes: camposFaltantes.map(c => c.campo),
      requiereMigracion: !todosCamposPresentes
    };
    
  } catch (error) {
    console.error('❌ Error durante la validación:', error);
    throw error;
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  validarSistemaContactos()
    .then(resultado => {
      if (resultado.sistemaCompleto) {
        console.log('🎉 Todo está funcionando correctamente');
        process.exit(0);
      } else {
        console.log('⚠️ Se requiere migración para funcionalidad completa');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('💥 Error fatal en la validación:', error);
      process.exit(1);
    });
}

module.exports = { validarSistemaContactos }; 