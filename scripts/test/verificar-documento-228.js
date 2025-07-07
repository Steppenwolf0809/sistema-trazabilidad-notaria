require('./models/index');
const { sequelize } = require('./config/database');
const Documento = require('./models/Documento');

async function verificarDocumento228() {
  try {
    console.log('🔍 VERIFICANDO DOCUMENTO 228');
    console.log('='.repeat(40));
    
    const doc = await Documento.findByPk(228);
    
    if (!doc) {
      console.log('❌ Documento 228 no encontrado');
      await sequelize.close();
      return;
    }
    
    console.log('📄 DATOS DEL DOCUMENTO 228:');
    console.log('   ID:', doc.id);
    console.log('   Código:', doc.codigoBarras);
    console.log('   Cliente:', doc.nombreCliente);
    console.log('   fechaFactura:', doc.fechaFactura);
    console.log('   fechaFactura tipo:', typeof doc.fechaFactura);
    console.log('   created_at:', doc.created_at);
    console.log('   numeroFactura:', doc.numeroFactura);
    
    // Verificar si es null
    if (doc.fechaFactura === null) {
      console.log('');
      console.log('🚨 PROBLEMA CONFIRMADO:');
      console.log('   fechaFactura es NULL');
      console.log('   Esto causa que no se muestre fecha en la vista');
      console.log('');
      console.log('💡 SOLUCIÓN NECESARIA:');
      console.log('   1. Corregir documento 228 específicamente');
      console.log('   2. Corregir lógica para documentos futuros');
    } else {
      console.log('');
      console.log('✅ fechaFactura tiene valor:', doc.fechaFactura);
    }
    
    await sequelize.close();
  } catch (error) {
    console.error('Error:', error);
    await sequelize.close();
  }
}

verificarDocumento228(); 