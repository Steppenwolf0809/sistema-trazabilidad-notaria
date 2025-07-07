const { sequelize } = require('./config/database');

async function debugMarcarListo() {
  try {
    console.log('🔍 [DEBUG] Iniciando debug de marcar como listo...');
    
    // Verificar estado actual del documento 249 con SQL directo
    const [documento] = await sequelize.query(`
      SELECT d.*, ng.estado as grupo_estado, ng.codigo_verificacion as grupo_codigo
      FROM documentos d
      LEFT JOIN notificaciones_grupales ng ON d.notificacion_grupal_id = ng.id
      WHERE d.id = 249
    `);
    
    if (documento.length === 0) {
      console.log('❌ Documento 249 no encontrado');
      return;
    }
    
    const doc = documento[0];
    
    console.log('📄 Estado actual del documento 249:');
    console.log('   ID:', doc.id);
    console.log('   Código:', doc.codigo_barras);
    console.log('   Estado:', doc.estado);
    console.log('   Grupo ID:', doc.notificacion_grupal_id);
    console.log('   Código verificación:', doc.codigo_verificacion);
    console.log('   Es líder:', doc.es_lider_grupo);
    console.log('   Matrizador ID:', doc.id_matrizador);
    
    if (doc.notificacion_grupal_id) {
      console.log('📱 Información del grupo:');
      console.log('   Estado grupo:', doc.grupo_estado);
      console.log('   Código grupo:', doc.grupo_codigo);
      
      // Verificar todos los documentos del grupo
      const [documentosGrupo] = await sequelize.query(`
        SELECT id, codigo_barras, estado, es_lider_grupo
        FROM documentos 
        WHERE notificacion_grupal_id = :grupoId
        ORDER BY id
      `, {
        replacements: { grupoId: doc.notificacion_grupal_id }
      });
      
      console.log('📋 Documentos en el grupo:');
      documentosGrupo.forEach(d => {
        console.log(`   - Doc ${d.id}: ${d.codigo_barras} (Estado: ${d.estado}, Líder: ${d.es_lider_grupo})`);
      });
      
      // Verificar si el grupo puede modificarse
      const puedeModificar = ['pendiente', 'cancelada'].includes(doc.grupo_estado);
      console.log('🧪 ¿Puede modificarse el grupo?:', puedeModificar);
      console.log('   Estado actual:', doc.grupo_estado);
      console.log('   Estados permitidos: pendiente, cancelada');
    }
    
    // Simular la lógica del controlador
    console.log('\n🎯 [SIMULACIÓN] Probando lógica de marcar como listo...');
    
    if (doc.estado !== 'en_proceso') {
      console.log('❌ El documento no está en estado "en_proceso"');
      return;
    }
    
    if (doc.notificacion_grupal_id) {
      if (!['pendiente', 'cancelada'].includes(doc.grupo_estado)) {
        console.log('❌ El grupo no puede modificarse porque está en estado:', doc.grupo_estado);
        return;
      } else {
        console.log('✅ El grupo SÍ puede modificarse');
      }
    }
    
    console.log('✅ Todas las validaciones pasaron - el documento debería poder marcarse como listo');
    
  } catch (error) {
    console.error('❌ Error en debug:', error);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

debugMarcarListo(); 