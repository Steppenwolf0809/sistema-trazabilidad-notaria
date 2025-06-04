/**
 * Script para limpiar eventos de tipo 'vista' que contaminan el historial
 * Estos eventos se registraban cada vez que se abría la vista de detalle
 * y no aportan valor al seguimiento del documento
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

async function limpiarEventosVista() {
  const client = await pool.connect();
  
  try {
    console.log('🧹 Iniciando limpieza de eventos de vista innecesarios...\n');
    
    // 1. Verificar cuántos eventos de vista existen
    const countResult = await client.query(`
      SELECT COUNT(*) as total
      FROM eventos_documentos 
      WHERE tipo = 'vista'
    `);
    
    const totalEventosVista = parseInt(countResult.rows[0].total);
    console.log(`📊 Total de eventos de tipo 'vista' encontrados: ${totalEventosVista}`);
    
    if (totalEventosVista === 0) {
      console.log('✅ No hay eventos de vista para limpiar');
      return;
    }
    
    // 2. Mostrar algunos ejemplos de eventos que se van a eliminar
    const ejemplosResult = await client.query(`
      SELECT ed.id, ed.tipo, ed.detalles, ed.usuario, ed.created_at,
             d.codigo_barras, d.nombre_cliente
      FROM eventos_documentos ed
      LEFT JOIN documentos d ON ed.documento_id = d.id
      WHERE ed.tipo = 'vista'
      ORDER BY ed.created_at DESC
      LIMIT 5
    `);
    
    console.log('\n📋 Ejemplos de eventos que se eliminarán:');
    ejemplosResult.rows.forEach(evento => {
      console.log(`  • ${evento.created_at} - ${evento.detalles} (Doc: ${evento.codigo_barras || 'N/A'}) por ${evento.usuario}`);
    });
    
    // 3. Eliminar los eventos de vista
    const deleteResult = await client.query(`
      DELETE FROM eventos_documentos 
      WHERE tipo = 'vista'
    `);
    
    console.log(`\n🗑️ Eventos eliminados: ${deleteResult.rowCount}`);
    
    // 4. Verificar que se eliminaron correctamente
    const verifyResult = await client.query(`
      SELECT COUNT(*) as restantes
      FROM eventos_documentos 
      WHERE tipo = 'vista'
    `);
    
    const eventosRestantes = parseInt(verifyResult.rows[0].restantes);
    console.log(`✅ Eventos de vista restantes: ${eventosRestantes}`);
    
    // 5. Mostrar estadísticas actuales del historial
    const statsResult = await client.query(`
      SELECT 
        tipo,
        COUNT(*) as cantidad
      FROM eventos_documentos 
      GROUP BY tipo
      ORDER BY cantidad DESC
    `);
    
    console.log('\n📈 Estadísticas actuales del historial (por tipo):');
    statsResult.rows.forEach(stat => {
      console.log(`  • ${stat.tipo}: ${stat.cantidad} eventos`);
    });
    
    console.log('\n✅ Limpieza completada exitosamente');
    console.log('🎯 El historial ahora solo contiene eventos importantes: pagos, entregas, cambios de estado, etc.');
    
  } catch (error) {
    console.error('❌ Error durante la limpieza:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  limpiarEventosVista()
    .then(() => {
      console.log('\n🔚 Script finalizado');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { limpiarEventosVista }; 