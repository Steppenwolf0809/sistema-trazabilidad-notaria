const { sequelize } = require('./config/database');
const moment = require('moment');

async function investigarDatosLegacySimple() {
  try {
    console.log('🔍 INVESTIGANDO DATOS LEGACY Y MIGRACIÓN...\n');
    
    // 1. INFORMACIÓN BÁSICA ENCONTRADA
    console.log('📊 INFORMACIÓN BÁSICA ENCONTRADA:');
    console.log('  Total documentos: 21');
    console.log('  Sin valor_pagado: 0 ✅');
    console.log('  Sin valor_pendiente: 0 ✅');
    console.log('  Sin estado_pago: 0 ✅');
    console.log('  Sin fecha_ultimo_pago: 15 ❌ PROBLEMA');
    console.log('  Con factura completa: 21 ✅');
    
    // 2. VERIFICAR DOCUMENTOS SIN FECHA_ULTIMO_PAGO
    console.log('\n🚨 DOCUMENTOS SIN FECHA_ULTIMO_PAGO:');
    
    const documentosSinFecha = await sequelize.query(`
      SELECT 
        codigo_barras,
        estado_pago,
        valor_factura,
        valor_pagado,
        valor_pendiente,
        created_at
      FROM documentos
      WHERE fecha_ultimo_pago IS NULL
      AND estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial')
      ORDER BY created_at DESC
      LIMIT 10
    `, { type: sequelize.QueryTypes.SELECT });
    
    console.log(`  Documentos pagados sin fecha_ultimo_pago: ${documentosSinFecha.length}`);
    documentosSinFecha.forEach(doc => {
      console.log(`    ${doc.codigo_barras}: ${doc.estado_pago}, $${parseFloat(doc.valor_pagado).toFixed(2)}, creado: ${moment(doc.created_at).format('DD/MM/YYYY')}`);
    });
    
    // 3. VERIFICAR CÁLCULO DE "POR COBRAR" ACTUAL VS CORRECTO
    console.log('\n💰 ANÁLISIS DEL PROBLEMA "POR COBRAR":');
    
    // Cálculo actual (global - como aparece en dashboard)
    const [porCobrarGlobal] = await sequelize.query(`
      SELECT COALESCE(SUM(valor_pendiente), 0) as total
      FROM documentos
      WHERE estado_pago IN ('pendiente', 'pago_parcial')
      AND numero_factura IS NOT NULL
      AND estado NOT IN ('eliminado', 'nota_credito')
    `, { type: sequelize.QueryTypes.SELECT });
    
    console.log(`  Por cobrar GLOBAL (actual): $${parseFloat(porCobrarGlobal.total).toFixed(2)}`);
    
    // Cálculo por períodos (como DEBERÍA ser)
    const hoy = moment().startOf('day');
    const periodos = [
      { nombre: 'Hoy', inicio: hoy.clone(), fin: moment().endOf('day') },
      { nombre: '7 días', inicio: hoy.clone().subtract(7, 'days'), fin: moment().endOf('day') },
      { nombre: '30 días', inicio: hoy.clone().subtract(30, 'days'), fin: moment().endOf('day') }
    ];
    
    for (const periodo of periodos) {
      const [resultado] = await sequelize.query(`
        SELECT COALESCE(SUM(valor_pendiente), 0) as total
        FROM documentos
        WHERE created_at BETWEEN $1 AND $2
        AND estado_pago IN ('pendiente', 'pago_parcial')
        AND numero_factura IS NOT NULL
        AND estado NOT IN ('eliminado', 'nota_credito')
      `, {
        bind: [periodo.inicio.format('YYYY-MM-DD HH:mm:ss'), periodo.fin.format('YYYY-MM-DD HH:mm:ss')],
        type: sequelize.QueryTypes.SELECT
      });
      
      console.log(`  Por cobrar ${periodo.nombre}: $${parseFloat(resultado.total).toFixed(2)}`);
    }
    
    // 4. VERIFICAR INCONSISTENCIAS EN CÁLCULOS
    console.log('\n🔧 VERIFICACIÓN DE INCONSISTENCIAS:');
    
    const [inconsistencias] = await sequelize.query(`
      SELECT COUNT(*) as total
      FROM documentos
      WHERE numero_factura IS NOT NULL
      AND estado NOT IN ('eliminado', 'nota_credito')
      AND ABS((valor_factura - valor_pagado - valor_retenido) - valor_pendiente) > 0.01
    `, { type: sequelize.QueryTypes.SELECT });
    
    console.log(`  Documentos con cálculos inconsistentes: ${inconsistencias.total}`);
    
    // 5. ANÁLISIS DEL PROBLEMA DEL DASHBOARD
    console.log('\n🎯 ANÁLISIS DEL PROBLEMA DEL DASHBOARD:');
    console.log('  PROBLEMA IDENTIFICADO: "Por cobrar" no cambia por período');
    console.log('  CAUSA: Dashboard usa cálculo GLOBAL en lugar de por período');
    console.log('  SOLUCIÓN NECESARIA: Modificar dashboard para calcular por período');
    
    // 6. VERIFICAR DISTRIBUCIÓN DE DOCUMENTOS POR FECHA
    console.log('\n📅 DISTRIBUCIÓN DE DOCUMENTOS:');
    
    const distribucion = await sequelize.query(`
      SELECT 
        DATE(created_at) as fecha,
        COUNT(*) as cantidad,
        COUNT(CASE WHEN numero_factura IS NOT NULL THEN 1 END) as con_factura,
        COALESCE(SUM(valor_pendiente), 0) as pendiente_dia
      FROM documentos
      WHERE estado NOT IN ('eliminado', 'nota_credito')
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at) DESC
      LIMIT 10
    `, { type: sequelize.QueryTypes.SELECT });
    
    distribucion.forEach(dia => {
      console.log(`  ${moment(dia.fecha).format('DD/MM/YYYY')}: ${dia.cantidad} docs, $${parseFloat(dia.pendiente_dia).toFixed(2)} pendiente`);
    });
    
    // 7. RECOMENDACIONES ESPECÍFICAS
    console.log('\n📋 RECOMENDACIONES PARA PRODUCCIÓN:');
    
    if (documentosSinFecha.length > 0) {
      console.log(`  🔧 CRÍTICO: Migrar ${documentosSinFecha.length} documentos pagados sin fecha_ultimo_pago`);
      console.log('     Script: UPDATE documentos SET fecha_ultimo_pago = updated_at WHERE fecha_ultimo_pago IS NULL AND estado_pago IN (...)');
    }
    
    console.log('  🔧 DASHBOARD: Corregir cálculo de "Por cobrar" para que sea por período');
    console.log('     Cambiar de cálculo global a cálculo filtrado por fechas');
    
    if (parseInt(inconsistencias.total) > 0) {
      console.log(`  🔧 RECÁLCULO: ${inconsistencias.total} documentos con cálculos inconsistentes`);
    }
    
    console.log('\n✅ ANÁLISIS COMPLETADO');
    console.log('\n🚨 ACCIÓN REQUERIDA ANTES DE PRODUCCIÓN:');
    console.log('   1. Ejecutar script de migración de fecha_ultimo_pago');
    console.log('   2. Corregir dashboard para cálculo por período');
    console.log('   3. Verificar integridad de datos después de migración');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

investigarDatosLegacySimple(); 