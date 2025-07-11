/**
 * MIGRACIÓN SEGURA: Sistema de Contactos Inteligente
 * Versión mejorada que detecta campos existentes antes de agregarlos
 */

const { sequelize } = require('./config/database');

async function verificarCampoExiste(nombreTabla, nombreCampo) {
  try {
    // Intentar describir la tabla para verificar si el campo existe
    const queryInterface = sequelize.getQueryInterface();
    const tableDescription = await queryInterface.describeTable(nombreTabla);
    
    return tableDescription.hasOwnProperty(nombreCampo);
  } catch (error) {
    console.error(`Error verificando campo ${nombreCampo}:`, error.message);
    return false;
  }
}

async function ejecutarMigracionContactos() {
  try {
    console.log('🔍 Iniciando migración segura del sistema de contactos...');
    
    // Verificar conexión a la base de datos
    await sequelize.authenticate();
    console.log('✅ Conexión a la base de datos establecida');
    
    // Lista de campos a agregar
    const camposAgregar = [
      {
        nombre: 'telefono_whatsapp',
        definicion: 'VARCHAR(15) NULL COMMENT "Número de teléfono validado para notificaciones WhatsApp"'
      },
      {
        nombre: 'contacto_validado',
        definicion: 'BOOLEAN NOT NULL DEFAULT FALSE COMMENT "Indica si el contacto ha sido validado por el sistema inteligente"'
      },
      {
        nombre: 'contacto_conflicto',
        definicion: 'BOOLEAN NOT NULL DEFAULT FALSE COMMENT "Indica si hay conflicto entre contacto XML y base de datos local"'
      },
      {
        nombre: 'contacto_datos_analisis',
        definicion: 'JSON NULL COMMENT "Datos del análisis del sistema inteligente de contactos"'
      }
    ];
    
    console.log('📋 Verificando campos existentes en la tabla documentos...');
    
    // Verificar qué campos ya existen
    const resultadosVerificacion = [];
    for (const campo of camposAgregar) {
      const existe = await verificarCampoExiste('documentos', campo.nombre);
      resultadosVerificacion.push({
        campo: campo.nombre,
        existe: existe,
        definicion: campo.definicion
      });
      
      if (existe) {
        console.log(`✅ Campo ${campo.nombre} ya existe - omitiendo`);
      } else {
        console.log(`⚠️ Campo ${campo.nombre} no existe - será agregado`);
      }
    }
    
    // Agregar solo los campos que no existen
    const camposAgregar_filtrados = resultadosVerificacion.filter(r => !r.existe);
    
    if (camposAgregar_filtrados.length === 0) {
      console.log('✅ Todos los campos del sistema de contactos ya existen');
      console.log('🎉 Migración completada - no se requieren cambios');
      return;
    }
    
    console.log(`📝 Agregando ${camposAgregar_filtrados.length} campos faltantes...`);
    
    // Ejecutar alteraciones de tabla
    for (const campo of camposAgregar_filtrados) {
      try {
        console.log(`🔧 Agregando campo: ${campo.campo}`);
        
        await sequelize.query(`
          ALTER TABLE documentos 
          ADD COLUMN ${campo.campo} ${campo.definicion}
        `);
        
        console.log(`✅ Campo ${campo.campo} agregado exitosamente`);
        
      } catch (error) {
        console.error(`❌ Error agregando campo ${campo.campo}:`, error.message);
        
        // Si el error es que el campo ya existe, continuar
        if (error.message.includes('Duplicate column name')) {
          console.log(`⚠️ Campo ${campo.campo} ya existe - continuando`);
        } else {
          throw error;
        }
      }
    }
    
    // Verificación final
    console.log('🔍 Verificación final de la migración...');
    
    const verificacionFinal = [];
    for (const campo of camposAgregar) {
      const existe = await verificarCampoExiste('documentos', campo.nombre);
      verificacionFinal.push({
        campo: campo.nombre,
        existe: existe
      });
    }
    
    console.log('📊 Resultado final de la migración:');
    verificacionFinal.forEach(resultado => {
      const estado = resultado.existe ? '✅ PRESENTE' : '❌ FALTANTE';
      console.log(`   ${resultado.campo}: ${estado}`);
    });
    
    const todosCamposPresentes = verificacionFinal.every(r => r.existe);
    
    if (todosCamposPresentes) {
      console.log('🎉 MIGRACIÓN EXITOSA: Todos los campos del sistema de contactos están presentes');
      console.log('📱 El sistema ahora puede procesar XMLs con análisis inteligente de contactos');
    } else {
      console.log('⚠️ MIGRACIÓN PARCIAL: Algunos campos no pudieron ser agregados');
      console.log('🔧 El sistema funcionará en modo de compatibilidad');
    }
    
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    throw error;
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  ejecutarMigracionContactos()
    .then(() => {
      console.log('🏁 Proceso de migración completado');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Error fatal en la migración:', error);
      process.exit(1);
    });
}

module.exports = { ejecutarMigracionContactos, verificarCampoExiste }; 