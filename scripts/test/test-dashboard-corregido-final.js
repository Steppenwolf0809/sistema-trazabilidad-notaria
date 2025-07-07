const { sequelize } = require('./config/database');

async function testDashboardCorregido() {
  try {
    console.log('🎯 PROBANDO DASHBOARD CORREGIDO...\n');
    
    // 1. NUEVA LÓGICA: Total cobrado histórico (sin filtros de fecha)
    console.log('💰 NUEVA LÓGICA - TOTAL COBRADO HISTÓRICO:');
    
    const [totalCobradoResult] = await sequelize.query(`
      SELECT COALESCE(SUM(valor_pagado), 0) as total
      FROM documentos
      WHERE estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial')
      AND estado NOT IN ('eliminado', 'nota_credito')
    `, {
      type: sequelize.QueryTypes.SELECT
    });
    
    const totalCobrado = parseFloat(totalCobradoResult.total);
    console.log(`  ✅ Total cobrado (histórico): $${totalCobrado.toFixed(2)}`);
    
    // 2. VERIFICAR DOCUMENTOS INCLUIDOS
    const documentosCobrados = await sequelize.query(`
      SELECT 
        codigo_barras,
        valor_pagado,
        fecha_ultimo_pago,
        estado_pago,
        created_at
      FROM documentos
      WHERE estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial')
      AND estado NOT IN ('eliminado', 'nota_credito')
      ORDER BY valor_pagado DESC
    `, {
      type: sequelize.QueryTypes.SELECT
    });
    
    console.log(`  📄 Total documentos cobrados: ${documentosCobrados.length}`);
    console.log('  📋 Documentos incluidos:');
    
    documentosCobrados.forEach(doc => {
      const fechaPago = doc.fecha_ultimo_pago ? 
        new Date(doc.fecha_ultimo_pago).toLocaleDateString('es-EC') : 
        'Sin fecha_ultimo_pago';
      console.log(`    ${doc.codigo_barras}: $${parseFloat(doc.valor_pagado).toFixed(2)} (${fechaPago})`);
    });
    
    // 3. COMPARAR CON VALOR ESPERADO
    console.log('\n🎯 COMPARACIÓN:');
    console.log(`  Dashboard mostrará: $${totalCobrado.toFixed(2)}`);
    console.log(`  Valor esperado: $1,157.92`);
    
    if (totalCobrado >= 1157) {
      console.log('  ✅ ¡CORRECTO! Ahora muestra el total real');
    } else {
      console.log('  ❌ Aún falta dinero por incluir');
      
      // Buscar documentos pagados que no se están incluyendo
      const documentosExcluidos = await sequelize.query(`
        SELECT 
          codigo_barras,
          valor_pagado,
          estado_pago,
          fecha_ultimo_pago
        FROM documentos
        WHERE valor_pagado > 0
        AND estado_pago NOT IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial')
        AND estado NOT IN ('eliminado', 'nota_credito')
      `, {
        type: sequelize.QueryTypes.SELECT
      });
      
      if (documentosExcluidos.length > 0) {
        console.log('\n  🔍 Documentos con valor_pagado pero estado_pago incorrecto:');
        documentosExcluidos.forEach(doc => {
          console.log(`    ${doc.codigo_barras}: $${parseFloat(doc.valor_pagado).toFixed(2)} (estado: ${doc.estado_pago})`);
        });
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testDashboardCorregido(); 