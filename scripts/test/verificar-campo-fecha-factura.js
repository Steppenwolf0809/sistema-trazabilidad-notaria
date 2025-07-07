const { sequelize } = require('./config/database');

async function verificarCampoDirecto() {
  try {
    console.log('🔍 VERIFICANDO CAMPO fecha_factura DIRECTAMENTE...');
    
    // Verificar que la columna existe en la tabla
    const [columns] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'documentos' 
      AND column_name = 'fecha_factura'
    `);
    
    console.log('📋 Información de la columna fecha_factura:');
    console.log(columns);
    
    // Verificar los últimos documentos
    const docs = await sequelize.query('SELECT id, codigo_barras, fecha_factura, created_at FROM documentos ORDER BY id DESC LIMIT 5', {
      type: sequelize.QueryTypes.SELECT
    });
    
    console.log('📄 Últimos 5 documentos:');
    docs.forEach(doc => {
      console.log(`   ID: ${doc.id}, Código: ${doc.codigo_barras}, fechaFactura: ${doc.fecha_factura}, created_at: ${doc.created_at}`);
    });
    
    // Verificar específicamente el documento 233 y 234
    const doc233 = await sequelize.query('SELECT id, codigo_barras, fecha_factura, created_at FROM documentos WHERE id = 233', {
      type: sequelize.QueryTypes.SELECT
    });
    
    const doc234 = await sequelize.query('SELECT id, codigo_barras, fecha_factura, created_at FROM documentos WHERE id = 234', {
      type: sequelize.QueryTypes.SELECT
    });
    
    console.log('📄 Documento 233:', doc233);
    console.log('📄 Documento 234:', doc234);
    
    await sequelize.close();
  } catch (error) {
    console.error('Error:', error);
    await sequelize.close();
  }
}

verificarCampoDirecto(); 