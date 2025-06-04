/**
 * Script para corregir constraint de id_documento en eventos_documentos
 * Hacer que id_documento sea nullable ya que ahora usamos documento_id
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

async function corregirConstraintEventos() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Corrigiendo constraint de id_documento en eventos_documentos...\n');
    
    // 1. Verificar constraint actual
    const constraintInfo = await client.query(`
      SELECT 
        column_name, 
        is_nullable, 
        column_default,
        data_type
      FROM information_schema.columns 
      WHERE table_name = 'eventos_documentos' 
      AND column_name IN ('id_documento', 'documento_id')
      ORDER BY column_name
    `);
    
    console.log('📋 Estado actual de las columnas:');
    console.table(constraintInfo.rows);
    
    // 2. Hacer id_documento nullable (ya que usamos documento_id)
    console.log('\n🔄 Haciendo id_documento nullable...');
    
    await client.query(`
      ALTER TABLE eventos_documentos 
      ALTER COLUMN id_documento DROP NOT NULL
    `);
    
    console.log('✅ Columna id_documento ahora es nullable');
    
    // 3. Verificar que todos los registros tengan documento_id
    const verificacion = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN id_documento IS NOT NULL THEN 1 END) as con_id_documento,
        COUNT(CASE WHEN documento_id IS NOT NULL THEN 1 END) as con_documento_id,
        COUNT(CASE WHEN id_documento IS NULL AND documento_id IS NULL THEN 1 END) as sin_documento
      FROM eventos_documentos
    `);
    
    console.log('\n📊 Verificación de datos:');
    console.table(verificacion.rows);
    
    // 4. Actualizar registros que tengan id_documento pero no documento_id
    const actualizacion = await client.query(`
      UPDATE eventos_documentos 
      SET documento_id = id_documento 
      WHERE documento_id IS NULL AND id_documento IS NOT NULL
    `);
    
    if (actualizacion.rowCount > 0) {
      console.log(`✅ Actualizados ${actualizacion.rowCount} registros con documento_id`);
    }
    
    // 5. Verificar estado final
    const estadoFinal = await client.query(`
      SELECT 
        column_name, 
        is_nullable, 
        data_type
      FROM information_schema.columns 
      WHERE table_name = 'eventos_documentos' 
      AND column_name IN ('id_documento', 'documento_id')
      ORDER BY column_name
    `);
    
    console.log('\n🎯 Estado final de las columnas:');
    console.table(estadoFinal.rows);
    
    // 6. Mostrar registros recientes
    console.log('\n📋 Últimos 5 registros:');
    const muestra = await client.query(`
      SELECT id, documento_id, id_documento, tipo, titulo, usuario, created_at
      FROM eventos_documentos 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    console.table(muestra.rows);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

// Ejecutar corrección
corregirConstraintEventos()
  .then(() => {
    console.log('\n✅ Constraint corregido exitosamente');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  }); 