/**
 * Script para migrar datos de eventos_documentos
 * Copiar datos de id_documento a documento_id
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

async function migrarDatosEventos() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Iniciando migración de datos eventos_documentos...\n');
    
    // 1. Verificar datos actuales
    const verificacion = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN id_documento IS NOT NULL THEN 1 END) as con_id_documento,
        COUNT(CASE WHEN documento_id IS NOT NULL THEN 1 END) as con_documento_id
      FROM eventos_documentos
    `);
    
    console.log('📊 Estado actual de los datos:');
    console.log(`• Total registros: ${verificacion.rows[0].total}`);
    console.log(`• Con id_documento: ${verificacion.rows[0].con_id_documento}`);
    console.log(`• Con documento_id: ${verificacion.rows[0].con_documento_id}`);
    
    // 2. Migrar datos de id_documento a documento_id
    if (verificacion.rows[0].con_id_documento > 0) {
      console.log('\n🔄 Copiando datos de id_documento a documento_id...');
      
      const resultado = await client.query(`
        UPDATE eventos_documentos 
        SET documento_id = id_documento 
        WHERE documento_id IS NULL AND id_documento IS NOT NULL
      `);
      
      console.log(`✅ Migrados ${resultado.rowCount} registros`);
    }
    
    // 3. Intentar mapear usuario a usuario_id donde sea posible
    console.log('\n🔄 Intentando mapear usuarios a usuario_id...');
    
    const mapeoUsuarios = await client.query(`
      UPDATE eventos_documentos e
      SET usuario_id = m.id
      FROM matrizadores m
      WHERE e.usuario = m.nombre 
      AND e.usuario_id IS NULL
      AND e.usuario IS NOT NULL
    `);
    
    console.log(`✅ Mapeados ${mapeoUsuarios.rowCount} usuarios`);
    
    // 4. Verificar resultado final
    const verificacionFinal = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN documento_id IS NOT NULL THEN 1 END) as con_documento_id,
        COUNT(CASE WHEN usuario_id IS NOT NULL THEN 1 END) as con_usuario_id
      FROM eventos_documentos
    `);
    
    console.log('\n📊 Estado final:');
    console.log(`• Total registros: ${verificacionFinal.rows[0].total}`);
    console.log(`• Con documento_id: ${verificacionFinal.rows[0].con_documento_id}`);
    console.log(`• Con usuario_id: ${verificacionFinal.rows[0].con_usuario_id}`);
    
    // 5. Mostrar algunos registros migrados
    console.log('\n📋 Muestra de registros migrados:');
    const muestra = await client.query(`
      SELECT id, documento_id, id_documento, usuario, usuario_id, tipo, created_at
      FROM eventos_documentos 
      ORDER BY id DESC 
      LIMIT 5
    `);
    
    console.table(muestra.rows);
    
  } catch (error) {
    console.error('❌ Error en migración:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

// Ejecutar migración
migrarDatosEventos()
  .then(() => {
    console.log('\n✅ Migración completada');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  }); 