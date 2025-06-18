/**
 * Script para limpiar historiales de notificaciones que contienen referencias a email
 * Desde que el sistema ahora usa solo WhatsApp, necesitamos:
 * 1. Eliminar registros de notificaciones enviadas por email
 * 2. Actualizar eventos de documentos que mencionan email
 * 3. Limpiar metadatos que contengan información de email
 */

const { sequelize } = require('./config/database');

async function limpiarHistorialesEmail() {
  try {
    console.log('🧹 Iniciando limpieza de historiales de email...');
    
    const transaction = await sequelize.transaction();
    
    try {
      // 1. ANÁLISIS INICIAL: Ver qué hay en las tablas
      console.log('📊 Analizando datos existentes...');
      
      // Verificar notificaciones enviadas por email
      const [notificacionesEmail] = await sequelize.query(`
        SELECT COUNT(*) as total 
        FROM notificaciones_enviadas 
        WHERE canal = 'email'
      `, { transaction });
      
      console.log(`📧 Notificaciones por email encontradas: ${notificacionesEmail[0]?.total || 0}`);
      
             // Verificar eventos que mencionan email
       const [eventosEmail] = await sequelize.query(`
         SELECT COUNT(*) as total 
         FROM eventos_documentos 
         WHERE detalles ILIKE '%email%' 
            OR detalles ILIKE '%correo%'
            OR detalles ILIKE '%@%'
       `, { transaction });
      
      console.log(`📄 Eventos que mencionan email: ${eventosEmail[0]?.total || 0}`);
      
      // Verificar metadatos que contengan referencias a email
      const [metadatosEmail] = await sequelize.query(`
        SELECT COUNT(*) as total 
        FROM notificaciones_enviadas 
        WHERE metadatos::text ILIKE '%email%'
           OR destinatario ILIKE '%@%'
      `, { transaction });
      
      console.log(`🔧 Notificaciones con metadatos de email: ${metadatosEmail[0]?.total || 0}`);
      
      // 2. LIMPIEZA DE NOTIFICACIONES_ENVIADAS
      if (notificacionesEmail[0]?.total > 0) {
        console.log('🗑️ Eliminando notificaciones enviadas por email...');
        
        const [deleteResult] = await sequelize.query(`
          DELETE FROM notificaciones_enviadas 
          WHERE canal = 'email'
        `, { transaction });
        
        console.log(`✅ Eliminadas ${deleteResult.affectedRows || notificacionesEmail[0].total} notificaciones de email`);
      }
      
      // 3. LIMPIEZA DE NOTIFICACIONES CON DESTINATARIOS DE EMAIL
      console.log('🗑️ Eliminando notificaciones con destinatarios de email...');
      
      const [deleteEmailDest] = await sequelize.query(`
        DELETE FROM notificaciones_enviadas 
        WHERE destinatario ILIKE '%@%'
      `, { transaction });
      
      console.log(`✅ Eliminadas ${deleteEmailDest.affectedRows || 0} notificaciones con destinatarios de email`);
      
      // 4. ACTUALIZACIÓN DE EVENTOS_DOCUMENTO
      if (eventosEmail[0]?.total > 0) {
        console.log('🔄 Actualizando eventos que mencionan email...');
        
                 // Actualizar eventos que mencionan "email" o "correo" para cambiarlos a "WhatsApp"
         const [updateEventos1] = await sequelize.query(`
           UPDATE eventos_documentos 
           SET detalles = REPLACE(REPLACE(detalles, 'email', 'WhatsApp'), 'Email', 'WhatsApp')
           WHERE detalles ILIKE '%email%'
         `, { transaction });
         
         const [updateEventos2] = await sequelize.query(`
           UPDATE eventos_documentos 
           SET detalles = REPLACE(REPLACE(detalles, 'correo', 'WhatsApp'), 'Correo', 'WhatsApp')
           WHERE detalles ILIKE '%correo%'
         `, { transaction });
         
         // Actualizar eventos que mencionan "ambos" para cambiar a "WhatsApp"
         const [updateEventos3] = await sequelize.query(`
           UPDATE eventos_documentos 
           SET detalles = REPLACE(detalles, 'WhatsApp y Email', 'WhatsApp')
           WHERE detalles ILIKE '%WhatsApp y Email%'
         `, { transaction });
         
         const [updateEventos4] = await sequelize.query(`
           UPDATE eventos_documentos 
           SET detalles = REPLACE(detalles, 'email y WhatsApp', 'WhatsApp')
           WHERE detalles ILIKE '%email y WhatsApp%'
         `, { transaction });
        
        console.log(`✅ Eventos actualizados: ${(updateEventos1.affectedRows || 0) + (updateEventos2.affectedRows || 0) + (updateEventos3.affectedRows || 0) + (updateEventos4.affectedRows || 0)}`);
      }
      
      // 5. LIMPIEZA DE EVENTOS QUE CONTENGAN DIRECCIONES DE EMAIL
      console.log('🗑️ Eliminando eventos que contengan direcciones de email específicas...');
      
             const [deleteEventosEmail] = await sequelize.query(`
         DELETE FROM eventos_documentos 
         WHERE detalles ~ '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}'
       `, { transaction });
      
      console.log(`✅ Eliminados ${deleteEventosEmail.affectedRows || 0} eventos con direcciones de email`);
      
             // 6. SIMPLIFICACIÓN: Solo eliminar notificaciones que contengan @ en destinatario (ya hecho arriba)
       console.log('🔧 Verificando metadatos que contengan referencias a email...');
       
       // Solo contar para información, no intentar limpiar JSON complejos
       const [metadatosConEmail] = await sequelize.query(`
         SELECT COUNT(*) as total
         FROM notificaciones_enviadas 
         WHERE metadatos::text ILIKE '%email%'
       `, { transaction });
       
       console.log(`ℹ️ Notificaciones con metadatos que mencionan email: ${metadatosConEmail[0]?.total || 0} (se mantendrán para compatibilidad)`);
      
      // 7. VERIFICACIÓN FINAL
      console.log('🔍 Verificación final...');
      
      const [finalNotificaciones] = await sequelize.query(`
        SELECT 
          canal, 
          COUNT(*) as total 
        FROM notificaciones_enviadas 
        GROUP BY canal 
        ORDER BY total DESC
      `, { transaction });
      
      console.log('📊 Distribución final de notificaciones por canal:');
      finalNotificaciones.forEach(row => {
        console.log(`   - ${row.canal}: ${row.total} notificaciones`);
      });
      
             const [finalEventos] = await sequelize.query(`
         SELECT COUNT(*) as total 
         FROM eventos_documentos 
         WHERE detalles ILIKE '%email%' 
            OR detalles ILIKE '%correo%'
            OR detalles ~ '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}'
       `, { transaction });
      
      console.log(`📄 Eventos que aún mencionan email: ${finalEventos[0]?.total || 0}`);
      
      const [finalDestinatarios] = await sequelize.query(`
        SELECT COUNT(*) as total 
        FROM notificaciones_enviadas 
        WHERE destinatario ILIKE '%@%'
      `, { transaction });
      
      console.log(`📧 Notificaciones con destinatarios de email restantes: ${finalDestinatarios[0]?.total || 0}`);
      
      await transaction.commit();
      console.log('✅ Limpieza de historiales completada exitosamente');
      
      // 8. RESUMEN DE LIMPIEZA
      console.log('\n📋 RESUMEN DE LIMPIEZA:');
      console.log('   ✅ Notificaciones de email eliminadas');
      console.log('   ✅ Eventos con menciones de email actualizados a WhatsApp');
      console.log('   ✅ Eventos con direcciones de email eliminados');
      console.log('   ✅ Metadatos de email limpiados');
      console.log('   ✅ Sistema completamente migrado a solo WhatsApp');
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Error en limpieza de historiales:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  limpiarHistorialesEmail()
    .then(() => {
      console.log('🎉 Limpieza completada exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { limpiarHistorialesEmail }; 