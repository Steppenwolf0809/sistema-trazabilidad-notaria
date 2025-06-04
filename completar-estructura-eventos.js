/**
 * Script para completar la estructura de eventos_documentos
 * Agregar columnas faltantes: categoria, titulo, descripcion
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

async function completarEstructuraEventos() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Completando estructura de eventos_documentos...\n');
    
    // Verificar columnas actuales
    const columnasActuales = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'eventos_documentos'
    `);
    
    const nombresColumnas = columnasActuales.rows.map(row => row.column_name);
    console.log('📋 Columnas actuales:', nombresColumnas.join(', '));
    
    // Definir columnas que necesitamos agregar
    const columnasNecesarias = [
      {
        nombre: 'categoria',
        tipo: 'VARCHAR(50)',
        defecto: "'general'"
      },
      {
        nombre: 'titulo',
        tipo: 'VARCHAR(255)',
        defecto: 'NULL'
      },
      {
        nombre: 'descripcion',
        tipo: 'TEXT',
        defecto: 'NULL'
      }
    ];
    
    console.log('\n🔍 Verificando columnas necesarias...');
    
    for (const columna of columnasNecesarias) {
      if (!nombresColumnas.includes(columna.nombre)) {
        console.log(`\n➕ Agregando columna: ${columna.nombre}`);
        
        const sql = `
          ALTER TABLE eventos_documentos 
          ADD COLUMN ${columna.nombre} ${columna.tipo} DEFAULT ${columna.defecto}
        `;
        
        await client.query(sql);
        console.log(`✅ Columna ${columna.nombre} agregada exitosamente`);
      } else {
        console.log(`✅ Columna ${columna.nombre} ya existe`);
      }
    }
    
    // Verificar estructura final
    console.log('\n📋 Verificando estructura final...');
    const estructuraFinal = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'eventos_documentos' 
      ORDER BY ordinal_position
    `);
    
    console.log('\n🎯 Estructura final de eventos_documentos:');
    console.log('========================================');
    estructuraFinal.rows.forEach(row => {
      console.log(`• ${row.column_name} (${row.data_type}) - Nullable: ${row.is_nullable} - Default: ${row.column_default || 'None'}`);
    });
    
    // Actualizar algunos registros existentes con categorías por defecto
    console.log('\n🔄 Actualizando categorías en registros existentes...');
    
    const actualizaciones = [
      { tipo: 'creacion', categoria: 'sistema' },
      { tipo: 'pago', categoria: 'financiero' },
      { tipo: 'entrega', categoria: 'operacion' },
      { tipo: 'cambio_estado', categoria: 'estado' },
      { tipo: 'modificacion', categoria: 'edicion' }
    ];
    
    for (const actualizacion of actualizaciones) {
      const resultado = await client.query(`
        UPDATE eventos_documentos 
        SET categoria = $1 
        WHERE tipo = $2 AND categoria = 'general'
      `, [actualizacion.categoria, actualizacion.tipo]);
      
      if (resultado.rowCount > 0) {
        console.log(`✅ Actualizados ${resultado.rowCount} eventos de tipo "${actualizacion.tipo}" a categoría "${actualizacion.categoria}"`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

// Ejecutar completación
completarEstructuraEventos()
  .then(() => {
    console.log('\n✅ Estructura de eventos_documentos completada');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  }); 