const { sequelize } = require('./config/database');

async function resetearGruposNotificacion() {
  try {
    console.log('🔄 [RESETEAR GRUPOS] Iniciando reseteo de grupos de notificación...');
    
    // Usar consulta SQL directa para evitar problemas de relaciones
    const [grupos] = await sequelize.query(`
      SELECT ng.*, COUNT(d.id) as total_documentos
      FROM notificaciones_grupales ng
      LEFT JOIN documentos d ON d.notificacion_grupal_id = ng.id
      WHERE ng.estado = 'enviada'
      GROUP BY ng.id
    `);
    
    console.log(`📊 [RESETEAR GRUPOS] Encontrados ${grupos.length} grupos marcados como enviados`);
    
    for (const grupo of grupos) {
      console.log(`🔄 [RESETEAR GRUPO ${grupo.id}] Código: ${grupo.codigo_verificacion}, Documentos: ${grupo.total_documentos}`);
      
      // Cambiar estado a pendiente usando SQL directo
      await sequelize.query(`
        UPDATE notificaciones_grupales 
        SET estado = 'pendiente', 
            fecha_envio = NULL, 
            mensaje_enviado = NULL,
            updated_at = NOW()
        WHERE id = :grupoId
      `, {
        replacements: { grupoId: grupo.id }
      });
      
      console.log(`✅ [RESETEAR GRUPO ${grupo.id}] Estado cambiado a 'pendiente'`);
    }
    
    console.log('🎉 [RESETEAR GRUPOS] Proceso completado exitosamente');
    
    // Mostrar estado actual de todos los grupos
    const [todosLosGrupos] = await sequelize.query(`
      SELECT ng.*, COUNT(d.id) as total_documentos
      FROM notificaciones_grupales ng
      LEFT JOIN documentos d ON d.notificacion_grupal_id = ng.id
      GROUP BY ng.id
      ORDER BY ng.id
    `);
    
    console.log('\n📊 [ESTADO ACTUAL] Resumen de todos los grupos:');
    for (const grupo of todosLosGrupos) {
      console.log(`   Grupo ${grupo.id}: Estado=${grupo.estado}, Código=${grupo.codigo_verificacion}, Documentos=${grupo.total_documentos}`);
    }
    
  } catch (error) {
    console.error('❌ [RESETEAR GRUPOS] Error:', error);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

// Ejecutar el script
resetearGruposNotificacion(); 