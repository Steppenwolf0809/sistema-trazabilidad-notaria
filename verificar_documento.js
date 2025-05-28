const { sequelize } = require('./config/database');

async function verificarDocumento() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conexión establecida');
    
    const result = await sequelize.query(
      `SELECT 
        codigo_barras, 
        nombre_cliente, 
        fecha_factura, 
        created_at,
        DATE(fecha_factura) as fecha_doc,
        DATE(created_at) as fecha_registro
      FROM documentos 
      WHERE codigo_barras = '20251701018P01152'`,
      { type: sequelize.QueryTypes.SELECT }
    );
    
    if (result.length > 0) {
      console.log('📊 ESTADO ACTUAL DEL DOCUMENTO:');
      console.log('Código:', result[0].codigo_barras);
      console.log('Cliente:', result[0].nombre_cliente);
      console.log('Fecha Documento:', result[0].fecha_doc);
      console.log('Fecha Registro:', result[0].fecha_registro);
      console.log('Fecha Factura completa:', result[0].fecha_factura);
      console.log('Created At completo:', result[0].created_at);
      
      if (result[0].fecha_doc === result[0].fecha_registro) {
        console.log('✅ DOCUMENTO CORREGIDO: Las fechas coinciden');
      } else {
        console.log('❌ DOCUMENTO AÚN PROBLEMÁTICO: Las fechas no coinciden');
      }
    } else {
      console.log('❌ Documento no encontrado');
    }
    
    await sequelize.close();
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

verificarDocumento(); 