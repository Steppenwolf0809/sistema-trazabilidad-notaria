/**
 * Script completo para limpiar TODOS los eventos de vista innecesarios
 * Incluye: 'vista', eventos con 'Documento Revisado', 'Documento visto', etc.
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'sistema_notaria',
  password: process.env.DB_PASSWORD || 'admin',
  port: process.env.DB_PORT || 5432,
});

async function limpiarEventosVistaCompleto() {
  const client = await pool.connect();
  
  try {
    console.log('🧹 Iniciando limpieza COMPLETA de eventos de vista innecesarios...\n');
    
    // 1. Identificar todos los tipos de eventos de vista
    const tiposEventosVista = [
      'vista',
      'revision',
      'documento_revisado'
    ];
    
    // 2. Identificar eventos por contenido de detalles
    const textosEventosVista = [
      'Documento Revisado',
      'Documento visto',
      'vista_detalle',
      'documento revisado',
      'documento visto'
    ];
    
    // 3. Construir consulta para encontrar todos estos eventos
    const whereConditions = [];
    
    // Por tipo
    if (tiposEventosVista.length > 0) {
      whereConditions.push(`tipo IN ('${tiposEventosVista.join("', '")}')`);
    }
    
    // Por contenido en título
    textosEventosVista.forEach(texto => {
      whereConditions.push(`titulo ILIKE '%${texto}%'`);
      whereConditions.push(`detalles ILIKE '%${texto}%'`);
      whereConditions.push(`descripcion ILIKE '%${texto}%'`);
    });
    
    const whereClause = whereConditions.join(' OR ');
    
    // 4. Verificar cuántos eventos se van a eliminar
    const countQuery = `
      SELECT COUNT(*) as total
      FROM eventos_documentos 
      WHERE ${whereClause}
    `;
    
    const countResult = await client.query(countQuery);
    const totalEventos = parseInt(countResult.rows[0].total);
    
    console.log(`📊 Total de eventos de vista encontrados: ${totalEventos}`);
    
    if (totalEventos === 0) {
      console.log('✅ No hay eventos de vista para limpiar');
      return;
    }
    
    // 5. Mostrar ejemplos de lo que se va a eliminar
    const ejemplosQuery = `
      SELECT id, tipo, titulo, detalles, usuario, created_at
      FROM eventos_documentos 
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT 10
    `;
    
    const ejemplosResult = await client.query(ejemplosQuery);
    
    console.log('\n📋 Ejemplos de eventos que se eliminarán:');
    ejemplosResult.rows.forEach(evento => {
      const resumen = evento.titulo || evento.detalles || evento.tipo;
      const resumenCorto = resumen.length > 50 ? resumen.substring(0, 50) + '...' : resumen;
      console.log(`  • ${evento.tipo}: "${resumenCorto}" por ${evento.usuario}`);
    });
    
    // 6. Eliminar los eventos
    const deleteQuery = `
      DELETE FROM eventos_documentos 
      WHERE ${whereClause}
    `;
    
    const deleteResult = await client.query(deleteQuery);
    console.log(`\n🗑️ Eventos eliminados: ${deleteResult.rowCount}`);
    
    // 7. Verificar limpieza
    const verifyResult = await client.query(countQuery);
    const eventosRestantes = parseInt(verifyResult.rows[0].total);
    console.log(`✅ Eventos de vista restantes: ${eventosRestantes}`);
    
    // 8. Mostrar estadísticas finales
    const statsResult = await client.query(`
      SELECT 
        tipo,
        COUNT(*) as cantidad
      FROM eventos_documentos 
      GROUP BY tipo
      ORDER BY cantidad DESC
    `);
    
    console.log('\n📈 Estadísticas del historial después de la limpieza:');
    statsResult.rows.forEach(stat => {
      console.log(`  • ${stat.tipo}: ${stat.cantidad} eventos`);
    });
    
    console.log('\n✅ Limpieza COMPLETA finalizada');
    console.log('🎯 Solo quedan eventos importantes: pagos, entregas, cambios de estado, etc.');
    
  } catch (error) {
    console.error('❌ Error durante la limpieza completa:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  limpiarEventosVistaCompleto()
    .then(() => {
      console.log('\n🔚 Script de limpieza completa finalizado');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { limpiarEventosVistaCompleto }; 