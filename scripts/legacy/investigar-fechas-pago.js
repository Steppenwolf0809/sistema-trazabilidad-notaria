const { sequelize } = require('./config/database');

async function investigarFechasPago() {
  try {
    console.log('🔍 INVESTIGANDO FECHAS DE PAGO...\n');
    
    // 1. Verificar documentos pagados SIN filtro de fecha
    const [sinFiltro] = await sequelize.query(`
      SELECT 
        COUNT(*) as cantidad,
        COALESCE(SUM(valor_pagado), 0) as total_pagado
      FROM documentos
      WHERE estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial')
      AND estado NOT IN ('eliminado', 'nota_credito')
    `, { type: sequelize.QueryTypes.SELECT });
    
    console.log('📊 DOCUMENTOS PAGADOS (SIN FILTRO DE FECHA):');
    console.log(`  Cantidad: ${sinFiltro.cantidad}`);
    console.log(`  Total pagado: $${parseFloat(sinFiltro.total_pagado).toFixed(2)}`);
    
    // 2. Verificar documentos pagados CON fecha_ultimo_pago
    const [conFecha] = await sequelize.query(`
      SELECT 
        COUNT(*) as cantidad,
        COALESCE(SUM(valor_pagado), 0) as total_pagado
      FROM documentos
      WHERE estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial')
      AND fecha_ultimo_pago IS NOT NULL
      AND estado NOT IN ('eliminado', 'nota_credito')
    `, { type: sequelize.QueryTypes.SELECT });
    
    console.log('\n📅 DOCUMENTOS PAGADOS (CON FECHA_ULTIMO_PAGO):');
    console.log(`  Cantidad: ${conFecha.cantidad}`);
    console.log(`  Total pagado: $${parseFloat(conFecha.total_pagado).toFixed(2)}`);
    
    // 3. Verificar documentos pagados SIN fecha_ultimo_pago
    const [sinFecha] = await sequelize.query(`
      SELECT 
        COUNT(*) as cantidad,
        COALESCE(SUM(valor_pagado), 0) as total_pagado
      FROM documentos
      WHERE estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial')
      AND fecha_ultimo_pago IS NULL
      AND estado NOT IN ('eliminado', 'nota_credito')
    `, { type: sequelize.QueryTypes.SELECT });
    
    console.log('\n❌ DOCUMENTOS PAGADOS (SIN FECHA_ULTIMO_PAGO):');
    console.log(`  Cantidad: ${sinFecha.cantidad}`);
    console.log(`  Total pagado: $${parseFloat(sinFecha.total_pagado).toFixed(2)}`);
    
    // 4. Mostrar ejemplos de documentos sin fecha
    const ejemplosSinFecha = await sequelize.query(`
      SELECT codigo_barras, estado_pago, valor_pagado, created_at
      FROM documentos
      WHERE estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial')
      AND fecha_ultimo_pago IS NULL
      AND estado NOT IN ('eliminado', 'nota_credito')
      LIMIT 5
    `, { type: sequelize.QueryTypes.SELECT });
    
    if (ejemplosSinFecha.length > 0) {
      console.log('\n📄 EJEMPLOS DE DOCUMENTOS SIN FECHA_ULTIMO_PAGO:');
      ejemplosSinFecha.forEach(doc => {
        console.log(`  ${doc.codigo_barras}: ${doc.estado_pago}, $${parseFloat(doc.valor_pagado).toFixed(2)}, creado: ${doc.created_at}`);
      });
    }
    
    console.log('\n🚨 PROBLEMA IDENTIFICADO:');
    console.log(`  Total real: $${parseFloat(sinFiltro.total_pagado).toFixed(2)}`);
    console.log(`  Con fecha: $${parseFloat(conFecha.total_pagado).toFixed(2)}`);
    console.log(`  Sin fecha: $${parseFloat(sinFecha.total_pagado).toFixed(2)}`);
    
    const diferencia = parseFloat(sinFiltro.total_pagado) - parseFloat(conFecha.total_pagado);
    console.log(`  Diferencia: $${diferencia.toFixed(2)}`);
    
    if (diferencia > 0) {
      console.log('  ❌ HAY DOCUMENTOS PAGADOS SIN fecha_ultimo_pago');
      console.log('  💡 SOLUCIÓN: Actualizar fecha_ultimo_pago para documentos pagados');
    } else {
      console.log('  ✅ Todos los documentos pagados tienen fecha_ultimo_pago');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

investigarFechasPago(); 