/**
 * Script para corregir fechas de notificaciones existentes
 * Actualiza los metadatos de eventos para incluir fechas formateadas correctamente
 */

const { sequelize } = require('./config/database');
const EventoDocumento = require('./models/EventoDocumento');

async function corregirFechasNotificaciones() {
  console.log('🔧 Iniciando corrección de fechas en notificaciones...');
  
  const transaction = await sequelize.transaction();
  
  try {
    // Obtener todas las notificaciones que necesitan corrección
    const notificaciones = await EventoDocumento.findAll({
      where: {
        tipo: {
          [sequelize.Sequelize.Op.in]: ['documento_listo', 'documento_entregado', 'cambio_estado', 'otro']
        }
      },
      transaction
    });
    
    console.log(`📋 Encontradas ${notificaciones.length} notificaciones para procesar`);
    
    let actualizadas = 0;
    let errores = 0;
    
    for (const notificacion of notificaciones) {
      try {
        // Obtener la fecha actual del registro
        const fechaCreacion = notificacion.created_at || notificacion.createdAt;
        
        if (!fechaCreacion) {
          console.log(`⚠️ Notificación ID ${notificacion.id} no tiene fecha de creación`);
          continue;
        }
        
        // Asegurar que la fecha esté en formato correcto
        const fechaISO = new Date(fechaCreacion).toISOString();
        
        // Actualizar metadatos para incluir información de fecha procesada
        const metadatosActualizados = {
          ...notificacion.metadatos,
          fechaProcesada: fechaISO,
          fechaFormateada: new Date(fechaCreacion).toLocaleDateString('es-EC', {
            day: '2-digit',
            month: '2-digit', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }),
          timestampCorreccion: new Date().toISOString()
        };
        
        // Actualizar el registro
        await notificacion.update({
          metadatos: metadatosActualizados
        }, { transaction });
        
        actualizadas++;
        
        if (actualizadas % 10 === 0) {
          console.log(`✅ Procesadas ${actualizadas} notificaciones...`);
        }
        
      } catch (error) {
        console.error(`❌ Error procesando notificación ID ${notificacion.id}:`, error.message);
        errores++;
      }
    }
    
    await transaction.commit();
    
    console.log('\n🎉 Corrección completada:');
    console.log(`✅ Notificaciones actualizadas: ${actualizadas}`);
    console.log(`❌ Errores: ${errores}`);
    console.log(`📊 Total procesadas: ${notificaciones.length}`);
    
    return {
      total: notificaciones.length,
      actualizadas,
      errores
    };
    
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error en la corrección de fechas:', error);
    throw error;
  }
}

// Función para verificar el estado de las fechas
async function verificarEstadoFechas() {
  console.log('🔍 Verificando estado actual de las fechas...');
  
  try {
    const notificaciones = await EventoDocumento.findAll({
      where: {
        tipo: {
          [sequelize.Sequelize.Op.in]: ['documento_listo', 'documento_entregado', 'cambio_estado', 'otro']
        }
      },
      limit: 10,
      order: [['created_at', 'DESC']]
    });
    
    console.log('\n📋 Muestra de notificaciones:');
    
    notificaciones.forEach(notif => {
      const fechaCreacion = notif.created_at || notif.createdAt;
      const tieneFechaProcesada = notif.metadatos?.fechaProcesada;
      
      console.log(`ID: ${notif.id} | Tipo: ${notif.tipo} | Fecha: ${fechaCreacion} | Procesada: ${tieneFechaProcesada ? '✅' : '❌'}`);
    });
    
  } catch (error) {
    console.error('❌ Error verificando fechas:', error);
  }
}

// Ejecutar el script
async function main() {
  try {
    console.log('🚀 Script de corrección de fechas de notificaciones');
    console.log('================================================\n');
    
    // Verificar estado actual
    await verificarEstadoFechas();
    
    console.log('\n¿Desea continuar con la corrección? (Presione Ctrl+C para cancelar)');
    
    // Esperar 3 segundos antes de continuar
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Ejecutar corrección
    const resultado = await corregirFechasNotificaciones();
    
    console.log('\n🔍 Verificando resultado...');
    await verificarEstadoFechas();
    
    console.log('\n✅ Script completado exitosamente');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error ejecutando script:', error);
    process.exit(1);
  }
}

// Ejecutar solo si es llamado directamente
if (require.main === module) {
  main();
}

module.exports = {
  corregirFechasNotificaciones,
  verificarEstadoFechas
}; 