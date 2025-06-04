const { sequelize } = require('./config/database');

async function checkTableStructure() {
  try {
    console.log('🔍 Verificando estructura de tabla eventos_documentos...\n');
    
    // Verificar columnas
    const [columns] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'eventos_documentos'
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 Columnas de eventos_documentos:');
    columns.forEach(col => {
      console.log(`  • ${col.column_name} (${col.data_type}) - Null: ${col.is_nullable} - Default: ${col.column_default || 'N/A'}`);
    });
    
    // Verificar algunos registros reales (SIN updated_at)
    const [events] = await sequelize.query(`
      SELECT id, documento_id, tipo, created_at, usuario, titulo, descripcion
      FROM eventos_documentos 
      ORDER BY id DESC 
      LIMIT 5;
    `);
    
    console.log('\n📊 Últimos 5 eventos:');
    events.forEach(event => {
      console.log(`  ID: ${event.id} - Documento: ${event.documento_id} - Tipo: ${event.tipo}`);
      console.log(`       created_at: ${event.created_at}`);
      console.log(`       Usuario: ${event.usuario || 'NULL'}`);
      console.log(`       Título: ${event.titulo || 'NULL'}`);
      console.log(`       Descripción: ${event.descripcion || 'NULL'}`);
      console.log('       ---');
    });
    
    await sequelize.close();
    
  } catch (error) {
    console.error('❌ Error:', error);
    await sequelize.close();
  }
}

checkTableStructure(); 