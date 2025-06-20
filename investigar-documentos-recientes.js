require('./models/index');
const { sequelize } = require('./config/database');

async function investigarDocumentosRecientes() {
  try {
    console.log('🔍 INVESTIGACIÓN PROFUNDA - DOCUMENTOS RECIENTES');
    console.log('='.repeat(60));
    
    // Buscar los últimos 5 documentos creados
    const result = await sequelize.query(`
      SELECT id, codigo_barras, nombre_cliente, fecha_factura, created_at, numero_factura
      FROM documentos 
      ORDER BY id DESC 
      LIMIT 5
    `, {
      type: sequelize.QueryTypes.SELECT
    });
    
    console.log('📊 ÚLTIMOS 5 DOCUMENTOS CREADOS:');
    result.forEach((doc, index) => {
      console.log(`${index + 1}. ID ${doc.id}:`);
      console.log(`   Código: ${doc.codigo_barras}`);
      console.log(`   Cliente: ${doc.nombre_cliente}`);
      console.log(`   fechaFactura: ${doc.fecha_factura}`);
      console.log(`   fechaFactura tipo: ${typeof doc.fecha_factura}`);
      console.log(`   created_at: ${doc.created_at}`);
      console.log(`   numeroFactura: ${doc.numero_factura}`);
      console.log('');
    });
    
    // Contar documentos con fecha_factura null
    const countResult = await sequelize.query('SELECT COUNT(*) as total FROM documentos WHERE fecha_factura IS NULL', {
      type: sequelize.QueryTypes.SELECT
    });
    console.log(`🚨 TOTAL DOCUMENTOS CON fechaFactura NULL: ${countResult[0].total}`);
    
    await sequelize.close();
  } catch (error) {
    console.error('Error:', error);
    await sequelize.close();
  }
}

investigarDocumentosRecientes(); 