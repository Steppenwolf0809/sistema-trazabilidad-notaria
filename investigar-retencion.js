const { sequelize } = require('./config/database');

async function investigarDiferencia() {
  try {
    // Verificar documentos con retención específicamente
    const retencion = await sequelize.query(`
      SELECT 
        codigo_barras,
        valor_factura,
        valor_pagado,
        valor_pendiente,
        valor_retenido,
        estado_pago
      FROM documentos
      WHERE estado_pago = 'pagado_con_retencion'
    `, { type: sequelize.QueryTypes.SELECT });
    
    console.log('📋 DOCUMENTOS CON RETENCIÓN:');
    let totalRetenido = 0;
    retencion.forEach(doc => {
      const facturado = parseFloat(doc.valor_factura);
      const pagado = parseFloat(doc.valor_pagado);
      const pendiente = parseFloat(doc.valor_pendiente);
      const retenido = parseFloat(doc.valor_retenido);
      
      console.log(`  ${doc.codigo_barras}:`);
      console.log(`    Facturado: $${facturado.toFixed(2)}`);
      console.log(`    Pagado: $${pagado.toFixed(2)}`);
      console.log(`    Retenido: $${retenido.toFixed(2)}`);
      console.log(`    Pendiente: $${pendiente.toFixed(2)}`);
      console.log(`    Suma (pagado + retenido + pendiente): $${(pagado + retenido + pendiente).toFixed(2)}`);
      console.log(`    Diferencia: $${(facturado - (pagado + retenido + pendiente)).toFixed(2)}`);
      
      totalRetenido += retenido;
    });
    
    console.log(`\nTotal retenido: $${totalRetenido.toFixed(2)}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

investigarDiferencia(); 