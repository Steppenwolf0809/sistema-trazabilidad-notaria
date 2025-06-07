const { sequelize } = require('./config/database');
const moment = require('moment');

async function debugPagosRecibidos() {
  try {
    console.log('🔍 DEBUGGING "PAGOS RECIBIDOS" EN DASHBOARD...\n');
    
    // 1. VERIFICAR QUÉ MUESTRA ACTUALMENTE EL DASHBOARD
    console.log('📊 ANÁLISIS ACTUAL DEL DASHBOARD:');
    
    const hoy = moment().startOf('day');
    const rangos = [
      { nombre: 'Hoy', inicio: hoy.clone(), fin: moment().endOf('day') },
      { nombre: '7 días', inicio: hoy.clone().subtract(7, 'days'), fin: moment().endOf('day') },
      { nombre: '30 días', inicio: hoy.clone().subtract(30, 'days'), fin: moment().endOf('day') },
      { nombre: 'Histórico', inicio: moment('2020-01-01'), fin: moment().endOf('day') }
    ];
    
    for (const rango of rangos) {
      console.log(`\n🎯 RANGO: ${rango.nombre.toUpperCase()}`);
      console.log(`  Período: ${rango.inicio.format('DD/MM/YYYY')} - ${rango.fin.format('DD/MM/YYYY')}`);
      
      // LÓGICA ACTUAL DEL DASHBOARD (con fecha_ultimo_pago)
      const fechaInicioSQL = rango.inicio.format('YYYY-MM-DD HH:mm:ss');
      const fechaFinSQL = rango.fin.format('YYYY-MM-DD HH:mm:ss');
      
      let ingresosPeriodoQuery, ingresosPeriodoReplacements;
      
      if (rango.nombre === 'Histórico') {
        // Para histórico, sin filtro de fecha
        ingresosPeriodoQuery = `
          SELECT COALESCE(SUM(valor_pagado), 0) as total
          FROM documentos
          WHERE estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial')
          AND estado NOT IN ('eliminado', 'nota_credito')
        `;
        ingresosPeriodoReplacements = {};
      } else {
        // Para otros rangos, filtrar por fecha_ultimo_pago
        ingresosPeriodoQuery = `
          SELECT COALESCE(SUM(valor_pagado), 0) as total
          FROM documentos
          WHERE fecha_ultimo_pago BETWEEN :fechaInicio AND :fechaFin
          AND estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial')
          AND estado NOT IN ('eliminado', 'nota_credito')
        `;
        ingresosPeriodoReplacements = { fechaInicio: fechaInicioSQL, fechaFin: fechaFinSQL };
      }
      
      const [resultado] = await sequelize.query(ingresosPeriodoQuery, {
        replacements: ingresosPeriodoReplacements,
        type: sequelize.QueryTypes.SELECT
      });
      
      console.log(`  💰 Dashboard muestra: $${parseFloat(resultado.total).toFixed(2)}`);
      
      // VERIFICAR DOCUMENTOS QUE INCLUYE
      let documentosQuery, documentosReplacements;
      
      if (rango.nombre === 'Histórico') {
        documentosQuery = `
          SELECT 
            codigo_barras,
            valor_pagado,
            fecha_ultimo_pago,
            estado_pago,
            created_at
          FROM documentos
          WHERE estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial')
          AND estado NOT IN ('eliminado', 'nota_credito')
          ORDER BY fecha_ultimo_pago DESC NULLS LAST
        `;
        documentosReplacements = {};
      } else {
        documentosQuery = `
          SELECT 
            codigo_barras,
            valor_pagado,
            fecha_ultimo_pago,
            estado_pago,
            created_at
          FROM documentos
          WHERE fecha_ultimo_pago BETWEEN :fechaInicio AND :fechaFin
          AND estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial')
          AND estado NOT IN ('eliminado', 'nota_credito')
          ORDER BY fecha_ultimo_pago DESC
        `;
        documentosReplacements = { fechaInicio: fechaInicioSQL, fechaFin: fechaFinSQL };
      }
      
      const documentos = await sequelize.query(documentosQuery, {
        replacements: documentosReplacements,
        type: sequelize.QueryTypes.SELECT
      });
      
      console.log(`  📄 Documentos incluidos: ${documentos.length}`);
      
      if (documentos.length > 0) {
        console.log('  📋 Detalle de documentos:');
        documentos.slice(0, 5).forEach(doc => {
          const fechaPago = doc.fecha_ultimo_pago ? moment(doc.fecha_ultimo_pago).format('DD/MM/YYYY') : 'Sin fecha';
          console.log(`    ${doc.codigo_barras}: $${parseFloat(doc.valor_pagado).toFixed(2)} (${fechaPago})`);
        });
        if (documentos.length > 5) {
          console.log(`    ... y ${documentos.length - 5} más`);
        }
      }
    }
    
    // 2. COMPARAR CON TOTAL REAL COBRADO
    console.log('\n🎯 COMPARACIÓN CON TOTAL REAL:');
    
    const [totalReal] = await sequelize.query(`
      SELECT COALESCE(SUM(valor_pagado), 0) as total
      FROM documentos
      WHERE estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial')
      AND estado NOT IN ('eliminado', 'nota_credito')
    `, { type: sequelize.QueryTypes.SELECT });
    
    console.log(`  💰 Total REAL cobrado (histórico): $${parseFloat(totalReal.total).toFixed(2)}`);
    
    // 3. PROBLEMA IDENTIFICADO
    console.log('\n🚨 PROBLEMA IDENTIFICADO:');
    console.log('  El dashboard usa filtros de fecha_ultimo_pago para "Pagos Recibidos"');
    console.log('  Pero algunos documentos pagados NO tienen fecha_ultimo_pago');
    console.log('  Por eso no muestra el total real cobrado');
    
    // 4. SOLUCIÓN PROPUESTA
    console.log('\n💡 SOLUCIÓN:');
    console.log('  OPCIÓN 1: Migrar datos legacy (asignar fecha_ultimo_pago)');
    console.log('  OPCIÓN 2: Cambiar lógica para no usar filtros de fecha en "Pagos Recibidos"');
    console.log('  OPCIÓN 3: Mostrar total histórico sin filtros de período');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

debugPagosRecibidos(); 