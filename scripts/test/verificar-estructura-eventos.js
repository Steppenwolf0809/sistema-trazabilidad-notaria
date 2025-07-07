/**
 * Script para verificar la estructura actual de la tabla eventos_documentos
 * y crear las columnas faltantes si es necesario
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

async function verificarEstructuraTabla() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Verificando estructura de la tabla eventos_documentos...\n');
    
    // Consultar la estructura actual de la tabla
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'eventos_documentos' 
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 Estructura actual de la tabla:');
    console.log('=====================================');
    result.rows.forEach(row => {
      console.log(`• ${row.column_name} (${row.data_type}) - Nullable: ${row.is_nullable} - Default: ${row.column_default || 'None'}`);
    });
    
    console.log('\n🔧 Verificando columnas necesarias...');
    
    const columnasActuales = result.rows.map(row => row.column_name);
    const columnasNecesarias = ['documento_id', 'usuario_id'];
    const columnasFaltantes = columnasNecesarias.filter(col => !columnasActuales.includes(col));
    
    if (columnasFaltantes.length === 0) {
      console.log('✅ Todas las columnas necesarias están presentes');
    } else {
      console.log(`❌ Faltan las siguientes columnas: ${columnasFaltantes.join(', ')}`);
      console.log('\n🛠️ Creando columnas faltantes...');
      
      for (const columna of columnasFaltantes) {
        if (columna === 'documento_id') {
          await client.query(`
            ALTER TABLE eventos_documentos 
            ADD COLUMN documento_id INTEGER REFERENCES documentos(id);
          `);
          console.log('✅ Columna documento_id creada');
        } else if (columna === 'usuario_id') {
          await client.query(`
            ALTER TABLE eventos_documentos 
            ADD COLUMN usuario_id INTEGER REFERENCES matrizadores(id);
          `);
          console.log('✅ Columna usuario_id creada');
        }
      }
    }
    
    // Verificar si hay datos en la tabla
    const countResult = await client.query('SELECT COUNT(*) FROM eventos_documentos');
    const totalRows = countResult.rows[0].count;
    console.log(`\n📊 Total de registros en eventos_documentos: ${totalRows}`);
    
    if (totalRows > 0) {
      console.log('\n📋 Primeros 5 registros:');
      const sampleResult = await client.query('SELECT * FROM eventos_documentos LIMIT 5');
      console.table(sampleResult.rows);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

// Ejecutar verificación
verificarEstructuraTabla()
  .then(() => {
    console.log('\n✅ Verificación completada');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  }); 