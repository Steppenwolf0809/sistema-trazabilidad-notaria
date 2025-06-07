const { sequelize } = require('./config/database');

async function testCorreccionDashboard() {
  try {
    console.log('🧪 PROBANDO CORRECCIÓN DEL DASHBOARD...\n');
    
    // Simular la lógica corregida del dashboard
    const rango = 'desde_inicio';
    
    // NUEVA LÓGICA: Para "desde_inicio", no usar filtro de fecha
    let ingresosPeriodoQuery, ingresosPeriodoReplacements;
    
    if (rango === 'desde_inicio') {
      // Para "desde_inicio", no usar filtro de fecha para incluir documentos sin fecha_ultimo_pago
      ingresosPeriodoQuery = `
        SELECT COALESCE(SUM(valor_pagado), 0) as total
        FROM documentos
        WHERE estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial')
        AND estado NOT IN ('eliminado', 'nota_credito')
      `;
      ingresosPeriodoReplacements = {};
    } else {
      // Para otros rangos, usar filtro de fecha normal
      ingresosPeriodoQuery = `
        SELECT COALESCE(SUM(valor_pagado), 0) as total
        FROM documentos
        WHERE fecha_ultimo_pago BETWEEN :fechaInicio AND :fechaFin
        AND estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial')
        AND estado NOT IN ('eliminado', 'nota_credito')
      `;
      ingresosPeriodoReplacements = { fechaInicio: '2025-01-01 00:00:00', fechaFin: '2025-06-06 23:59:59' };
    }
    
    const [ingresosPeriodoResult] = await sequelize.query(ingresosPeriodoQuery, {
      replacements: ingresosPeriodoReplacements,
      type: sequelize.QueryTypes.SELECT
    });
    const ingresosPeriodo = parseFloat(ingresosPeriodoResult.total);
    
    console.log('📊 RESULTADO DE LA CORRECCIÓN:');
    console.log(`  Rango seleccionado: ${rango}`);
    console.log(`  Ingresos calculados: $${ingresosPeriodo.toFixed(2)}`);
    
    if (ingresosPeriodo.toFixed(2) === '449.35') {
      console.log('  ✅ CORRECCIÓN EXITOSA: Ahora muestra el total histórico correcto');
    } else if (ingresosPeriodo.toFixed(2) === '81.29') {
      console.log('  ❌ CORRECCIÓN FALLIDA: Sigue mostrando solo los pagos con fecha');
    } else {
      console.log(`  ❓ RESULTADO INESPERADO: ${ingresosPeriodo.toFixed(2)}`);
    }
    
    // También probar documentos cobrados
    let documentosCobradosPeriodo;
    if (rango === 'desde_inicio') {
      // Para "desde_inicio", no usar filtro de fecha
      const [countResult] = await sequelize.query(`
        SELECT COUNT(*) as count
        FROM documentos
        WHERE estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial')
        AND estado NOT IN ('eliminado', 'nota_credito')
      `, { type: sequelize.QueryTypes.SELECT });
      documentosCobradosPeriodo = parseInt(countResult.count);
    } else {
      // Para otros rangos, usar filtro de fecha normal
      const [countResult] = await sequelize.query(`
        SELECT COUNT(*) as count
        FROM documentos
        WHERE estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial')
        AND fecha_ultimo_pago BETWEEN :fechaInicio AND :fechaFin
      `, { 
        replacements: { fechaInicio: '2025-01-01 00:00:00', fechaFin: '2025-06-06 23:59:59' },
        type: sequelize.QueryTypes.SELECT 
      });
      documentosCobradosPeriodo = parseInt(countResult.count);
    }
    
    console.log(`  Documentos cobrados: ${documentosCobradosPeriodo}`);
    
    if (documentosCobradosPeriodo === 13) {
      console.log('  ✅ DOCUMENTOS COBRADOS: Correcto (13 documentos)');
    } else if (documentosCobradosPeriodo === 6) {
      console.log('  ❌ DOCUMENTOS COBRADOS: Incorrecto (solo 6 con fecha)');
    } else {
      console.log(`  ❓ DOCUMENTOS COBRADOS: Resultado inesperado (${documentosCobradosPeriodo})`);
    }
    
    console.log('\n🎯 RESUMEN:');
    console.log('  La corrección permite que "Histórico Completo" muestre:');
    console.log(`  - Total de ingresos: $${ingresosPeriodo.toFixed(2)} (debería ser $449.35)`);
    console.log(`  - Documentos cobrados: ${documentosCobradosPeriodo} (debería ser 13)`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testCorreccionDashboard(); 