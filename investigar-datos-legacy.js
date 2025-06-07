const { sequelize } = require('./config/database');
const moment = require('moment');

async function investigarDatosLegacy() {
  try {
    console.log('🔍 INVESTIGANDO DATOS LEGACY Y MIGRACIÓN...\n');
    
    // 1. VERIFICAR ESTRUCTURA DE CAMPOS NUEVOS
    console.log('📊 ANÁLISIS DE CAMPOS DE PAGO:');
    
    const [camposAnalisis] = await sequelize.query(`
      SELECT 
        COUNT(*) as total_documentos,
        COUNT(CASE WHEN valor_pagado IS NULL THEN 1 END) as sin_valor_pagado,
        COUNT(CASE WHEN valor_pendiente IS NULL THEN 1 END) as sin_valor_pendiente,
        COUNT(CASE WHEN estado_pago IS NULL THEN 1 END) as sin_estado_pago,
        COUNT(CASE WHEN fecha_ultimo_pago IS NULL THEN 1 END) as sin_fecha_ultimo_pago,
        COUNT(CASE WHEN valor_factura IS NOT NULL AND numero_factura IS NOT NULL THEN 1 END) as con_factura_completa
      FROM documentos
      WHERE estado NOT IN ('eliminado', 'nota_credito')
    `, { type: sequelize.QueryTypes.SELECT });
    
    console.log(`  Total documentos: ${camposAnalisis.total_documentos}`);
    console.log(`  Sin valor_pagado: ${camposAnalisis.sin_valor_pagado}`);
    console.log(`  Sin valor_pendiente: ${camposAnalisis.sin_valor_pendiente}`);
    console.log(`  Sin estado_pago: ${camposAnalisis.sin_estado_pago}`);
    console.log(`  Sin fecha_ultimo_pago: ${camposAnalisis.sin_fecha_ultimo_pago}`);
    console.log(`  Con factura completa: ${camposAnalisis.con_factura_completa}`);
    
    // 2. VERIFICAR DOCUMENTOS POR FECHA DE CREACIÓN
    console.log('\n📅 DOCUMENTOS POR PERÍODO DE CREACIÓN:');
    
    const documentosPorPeriodo = await sequelize.query(`
      SELECT 
        CASE 
          WHEN created_at >= NOW() - INTERVAL '1 day' THEN 'Hoy'
          WHEN created_at >= NOW() - INTERVAL '7 days' THEN 'Últimos 7 días'
          WHEN created_at >= NOW() - INTERVAL '30 days' THEN 'Últimos 30 días'
          ELSE 'Más de 30 días (Legacy)'
        END as periodo,
        COUNT(*) as cantidad,
        COUNT(CASE WHEN numero_factura IS NOT NULL THEN 1 END) as con_factura,
        COALESCE(SUM(valor_factura), 0) as total_facturado,
        COALESCE(SUM(valor_pagado), 0) as total_pagado,
        COALESCE(SUM(valor_pendiente), 0) as total_pendiente,
        COUNT(CASE WHEN estado_pago = 'pendiente' THEN 1 END) as pendientes,
        COUNT(CASE WHEN estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial') THEN 1 END) as pagados
      FROM documentos
      WHERE estado NOT IN ('eliminado', 'nota_credito')
      GROUP BY 
        CASE 
          WHEN created_at >= NOW() - INTERVAL '1 day' THEN 'Hoy'
          WHEN created_at >= NOW() - INTERVAL '7 days' THEN 'Últimos 7 días'
          WHEN created_at >= NOW() - INTERVAL '30 days' THEN 'Últimos 30 días'
          ELSE 'Más de 30 días (Legacy)'
        END
      ORDER BY 
        CASE 
          WHEN periodo = 'Hoy' THEN 1
          WHEN periodo = 'Últimos 7 días' THEN 2
          WHEN periodo = 'Últimos 30 días' THEN 3
          ELSE 4
        END
    `, { type: sequelize.QueryTypes.SELECT });
    
    documentosPorPeriodo.forEach(periodo => {
      console.log(`\n  ${periodo.periodo}:`);
      console.log(`    Documentos: ${periodo.cantidad}`);
      console.log(`    Con factura: ${periodo.con_factura}`);
      console.log(`    Facturado: $${parseFloat(periodo.total_facturado).toFixed(2)}`);
      console.log(`    Pagado: $${parseFloat(periodo.total_pagado).toFixed(2)}`);
      console.log(`    Pendiente: $${parseFloat(periodo.total_pendiente).toFixed(2)}`);
      console.log(`    Estados: ${periodo.pendientes} pendientes, ${periodo.pagados} pagados`);
    });
    
    // 3. VERIFICAR INCONSISTENCIAS EN CÁLCULOS
    console.log('\n🚨 VERIFICACIÓN DE INCONSISTENCIAS:');
    
    const inconsistencias = await sequelize.query(`
      SELECT 
        id,
        codigo_barras,
        valor_factura,
        valor_pagado,
        valor_pendiente,
        estado_pago,
        (valor_factura - valor_pagado - valor_retenido) as pendiente_calculado,
        CASE 
          WHEN ABS((valor_factura - valor_pagado - valor_retenido) - valor_pendiente) > 0.01 THEN 'INCONSISTENTE'
          ELSE 'OK'
        END as estado_calculo
      FROM documentos
      WHERE numero_factura IS NOT NULL
      AND estado NOT IN ('eliminado', 'nota_credito')
      AND ABS((valor_factura - valor_pagado - valor_retenido) - valor_pendiente) > 0.01
      LIMIT 10
    `, { type: sequelize.QueryTypes.SELECT });
    
    if (inconsistencias.length > 0) {
      console.log(`  ❌ ENCONTRADAS ${inconsistencias.length} INCONSISTENCIAS:`);
      inconsistencias.forEach(doc => {
        console.log(`    ${doc.codigo_barras}: Factura $${parseFloat(doc.valor_factura).toFixed(2)}, Pagado $${parseFloat(doc.valor_pagado).toFixed(2)}, Pendiente DB $${parseFloat(doc.valor_pendiente).toFixed(2)}, Calculado $${parseFloat(doc.pendiente_calculado).toFixed(2)}`);
      });
    } else {
      console.log('  ✅ No se encontraron inconsistencias en cálculos');
    }
    
    // 4. VERIFICAR DOCUMENTOS LEGACY SIN MIGRAR
    console.log('\n🔧 DOCUMENTOS LEGACY QUE NECESITAN MIGRACIÓN:');
    
    const documentosLegacy = await sequelize.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN estado_pago IS NULL OR estado_pago = '' THEN 1 END) as sin_estado_pago,
        COUNT(CASE WHEN valor_pagado IS NULL THEN 1 END) as sin_valor_pagado,
        COUNT(CASE WHEN fecha_ultimo_pago IS NULL AND estado_pago IN ('pagado_completo', 'pagado_con_retencion') THEN 1 END) as pagados_sin_fecha
      FROM documentos
      WHERE created_at < NOW() - INTERVAL '30 days'
      AND estado NOT IN ('eliminado', 'nota_credito')
    `, { type: sequelize.QueryTypes.SELECT });
    
    const legacy = documentosLegacy[0];
    console.log(`  Documentos legacy (>30 días): ${legacy.total}`);
    console.log(`  Sin estado_pago: ${legacy.sin_estado_pago}`);
    console.log(`  Sin valor_pagado: ${legacy.sin_valor_pagado}`);
    console.log(`  Pagados sin fecha: ${legacy.pagados_sin_fecha}`);
    
    // 5. SIMULAR CÁLCULO CORRECTO DE "POR COBRAR" POR PERÍODO
    console.log('\n💰 SIMULACIÓN DE "POR COBRAR" CORRECTO POR PERÍODO:');
    
    const hoy = moment().startOf('day');
    const periodos = [
      { nombre: 'Hoy', inicio: hoy.clone(), fin: moment().endOf('day') },
      { nombre: '7 días', inicio: hoy.clone().subtract(7, 'days'), fin: moment().endOf('day') },
      { nombre: '30 días', inicio: hoy.clone().subtract(30, 'days'), fin: moment().endOf('day') }
    ];
    
    for (const periodo of periodos) {
      const [resultado] = await sequelize.query(`
        SELECT 
          COALESCE(SUM(valor_pendiente), 0) as pendiente_periodo
        FROM documentos
        WHERE created_at BETWEEN :inicio AND :fin
        AND estado_pago IN ('pendiente', 'pago_parcial')
        AND numero_factura IS NOT NULL
        AND estado NOT IN ('eliminado', 'nota_credito')
      `, {
        replacements: { 
          inicio: periodo.inicio.format('YYYY-MM-DD HH:mm:ss'), 
          fin: periodo.fin.format('YYYY-MM-DD HH:mm:ss') 
        },
        type: sequelize.QueryTypes.SELECT
      });
      
      console.log(`  ${periodo.nombre}: $${parseFloat(resultado.pendiente_periodo).toFixed(2)} por cobrar`);
    }
    
    // 6. RECOMENDACIONES
    console.log('\n📋 RECOMENDACIONES PARA MIGRACIÓN:');
    
    if (legacy.sin_estado_pago > 0) {
      console.log(`  🔧 Migrar ${legacy.sin_estado_pago} documentos sin estado_pago`);
    }
    
    if (legacy.sin_valor_pagado > 0) {
      console.log(`  🔧 Migrar ${legacy.sin_valor_pagado} documentos sin valor_pagado`);
    }
    
    if (legacy.pagados_sin_fecha > 0) {
      console.log(`  🔧 Asignar fecha_ultimo_pago a ${legacy.pagados_sin_fecha} documentos pagados`);
    }
    
    if (inconsistencias.length > 0) {
      console.log(`  🔧 Recalcular valor_pendiente para ${inconsistencias.length}+ documentos`);
    }
    
    console.log('\n✅ ANÁLISIS COMPLETADO');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

investigarDatosLegacy(); 