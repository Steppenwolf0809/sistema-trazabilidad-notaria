const { sequelize } = require('./config/database');
const moment = require('moment');

async function debugDashboardFiltros() {
  try {
    console.log('🔍 DEBUGGING MATEMÁTICO: Dashboard Filtros\n');
    
    // ============== VERIFICAR DATOS BASE ==============
    console.log('📊 DATOS BASE EN LA DB:');
    
    const [datosBase] = await sequelize.query(`
      SELECT 
        COUNT(*) as total_documentos,
        COUNT(CASE WHEN estado = 'en_proceso' THEN 1 END) as en_proceso,
        COUNT(CASE WHEN estado = 'listo_para_entrega' THEN 1 END) as listo_entrega,
        COUNT(CASE WHEN estado = 'entregado' THEN 1 END) as entregados,
        COUNT(CASE WHEN estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial') THEN 1 END) as documentos_pagados,
        COALESCE(SUM(valor_factura), 0) as total_facturado,
        COALESCE(SUM(valor_pagado), 0) as total_cobrado,
        COALESCE(SUM(valor_pendiente), 0) as total_pendiente
      FROM documentos
      WHERE estado NOT IN ('eliminado', 'nota_credito')
    `, {
      type: sequelize.QueryTypes.SELECT
    });
    
    console.log('  📈 Total documentos:', datosBase.total_documentos);
    console.log('  🔄 En proceso:', datosBase.en_proceso);
    console.log('  ✅ Listo entrega:', datosBase.listo_entrega);
    console.log('  📦 Entregados:', datosBase.entregados);
    console.log('  💰 Documentos pagados:', datosBase.documentos_pagados);
    console.log('  💵 Total facturado: $', parseFloat(datosBase.total_facturado).toFixed(2));
    console.log('  💚 Total cobrado: $', parseFloat(datosBase.total_cobrado).toFixed(2));
    console.log('  🔴 Total pendiente: $', parseFloat(datosBase.total_pendiente).toFixed(2));
    
    // VERIFICACIÓN MATEMÁTICA CRÍTICA
    const facturado = parseFloat(datosBase.total_facturado);
    const cobrado = parseFloat(datosBase.total_cobrado);
    const pendiente = parseFloat(datosBase.total_pendiente);
    const calculado = facturado - cobrado;
    
    console.log('\n🧮 VERIFICACIÓN MATEMÁTICA:');
    console.log('  Facturado - Cobrado =', calculado.toFixed(2));
    console.log('  Pendiente en DB =', pendiente.toFixed(2));
    console.log('  ✅ Matemática correcta:', Math.abs(calculado - pendiente) < 0.01 ? 'SÍ' : '❌ NO');
    
    // ============== PROBAR FILTROS ESPECÍFICOS ==============
    console.log('\n🎯 PROBANDO FILTROS ESPECÍFICOS:\n');
    
    const filtros = [
      { nombre: 'HOY', rango: 'hoy' },
      { nombre: '7 DÍAS', rango: 'semana' },
      { nombre: '30 DÍAS', rango: 'ultimo_mes' },
      { nombre: 'MES ACTUAL', rango: 'mes' },
      { nombre: 'HISTÓRICO', rango: 'desde_inicio' }
    ];
    
    for (const filtro of filtros) {
      console.log(`📅 FILTRO: ${filtro.nombre}`);
      
      // Calcular fechas según el filtro
      const hoy = moment().startOf('day');
      let fechaInicio, fechaFin;
      
      switch (filtro.rango) {
        case 'hoy':
          fechaInicio = hoy.clone();
          fechaFin = moment().endOf('day');
          break;
        case 'semana':
          fechaInicio = hoy.clone().startOf('week');
          fechaFin = moment().endOf('day');
          break;
        case 'ultimo_mes':
          fechaInicio = hoy.clone().subtract(30, 'days');
          fechaFin = moment().endOf('day');
          break;
        case 'mes':
          fechaInicio = hoy.clone().startOf('month');
          fechaFin = moment().endOf('day');
          break;
        case 'desde_inicio':
          fechaInicio = moment('2020-01-01').startOf('day');
          fechaFin = moment().endOf('day');
          break;
      }
      
      const fechaInicioSQL = fechaInicio.format('YYYY-MM-DD HH:mm:ss');
      const fechaFinSQL = fechaFin.format('YYYY-MM-DD HH:mm:ss');
      
      console.log(`  📆 Rango: ${fechaInicio.format('DD/MM/YYYY')} - ${fechaFin.format('DD/MM/YYYY')}`);
      
      // ============== MÉTRICAS COMO ESTÁN AHORA (SIN FILTROS) ==============
      console.log('  🔴 MÉTRICAS ACTUALES (SIN FILTROS):');
      
      // Total documentos (sin filtro)
      const totalDocsSinFiltro = await sequelize.query(`
        SELECT COUNT(*) as total
        FROM documentos
        WHERE estado NOT IN ('eliminado', 'nota_credito')
      `, { type: sequelize.QueryTypes.SELECT });
      
      // Total cobrado (sin filtro)
      const totalCobradoSinFiltro = await sequelize.query(`
        SELECT COALESCE(SUM(valor_pagado), 0) as total
        FROM documentos
        WHERE estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial')
        AND estado NOT IN ('eliminado', 'nota_credito')
      `, { type: sequelize.QueryTypes.SELECT });
      
      console.log(`    📊 Docs totales: ${totalDocsSinFiltro[0].total} (sin filtro)`);
      console.log(`    💰 Total cobrado: $${parseFloat(totalCobradoSinFiltro[0].total).toFixed(2)} (sin filtro)`);
      
      // ============== MÉTRICAS COMO DEBERÍAN SER (CON FILTROS) ==============
      console.log('  ✅ MÉTRICAS CORRECTAS (CON FILTROS):');
      
      const [metricasConFiltro] = await sequelize.query(`
        SELECT 
          COUNT(*) as total_documentos,
          COUNT(CASE WHEN estado = 'en_proceso' THEN 1 END) as en_proceso,
          COUNT(CASE WHEN estado = 'listo_para_entrega' THEN 1 END) as listo_entrega,
          COUNT(CASE WHEN estado = 'entregado' THEN 1 END) as entregados,
          COALESCE(SUM(valor_factura), 0) as facturado_periodo,
          COALESCE(SUM(CASE WHEN estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial') THEN valor_pagado ELSE 0 END), 0) as cobrado_periodo,
          COALESCE(SUM(CASE WHEN estado_pago IN ('pendiente', 'pago_parcial') THEN valor_pendiente ELSE 0 END), 0) as pendiente_periodo
        FROM documentos
        WHERE created_at BETWEEN :fechaInicio AND :fechaFin
        AND estado NOT IN ('eliminado', 'nota_credito')
      `, {
        replacements: { fechaInicio: fechaInicioSQL, fechaFin: fechaFinSQL },
        type: sequelize.QueryTypes.SELECT
      });
      
      console.log(`    📊 Docs del período: ${metricasConFiltro.total_documentos}`);
      console.log(`    🔄 En proceso: ${metricasConFiltro.en_proceso}`);
      console.log(`    ✅ Listos: ${metricasConFiltro.listo_entrega}`);
      console.log(`    📦 Entregados: ${metricasConFiltro.entregados}`);
      console.log(`    💵 Facturado: $${parseFloat(metricasConFiltro.facturado_periodo).toFixed(2)}`);
      console.log(`    💚 Cobrado: $${parseFloat(metricasConFiltro.cobrado_periodo).toFixed(2)}`);
      console.log(`    🔴 Pendiente: $${parseFloat(metricasConFiltro.pendiente_periodo).toFixed(2)}`);
      
      // Verificación matemática del período
      const facturadoPeriodo = parseFloat(metricasConFiltro.facturado_periodo);
      const cobradoPeriodo = parseFloat(metricasConFiltro.cobrado_periodo);
      const pendientePeriodo = parseFloat(metricasConFiltro.pendiente_periodo);
      const calculadoPeriodo = facturadoPeriodo - cobradoPeriodo;
      
      console.log(`    🧮 Verificación: ${facturadoPeriodo.toFixed(2)} - ${cobradoPeriodo.toFixed(2)} = ${calculadoPeriodo.toFixed(2)}`);
      console.log(`    ✅ Matemática período: ${Math.abs(calculadoPeriodo - pendientePeriodo) < 0.01 ? 'CORRECTA' : '❌ INCORRECTA'}`);
      
      console.log('');
    }
    
    // ============== VERIFICAR DOCUMENTOS POR FECHA ==============
    console.log('📅 DOCUMENTOS POR FECHA DE CREACIÓN:');
    
    const documentosPorFecha = await sequelize.query(`
      SELECT 
        DATE(created_at) as fecha,
        COUNT(*) as cantidad,
        COALESCE(SUM(valor_factura), 0) as facturado,
        COALESCE(SUM(valor_pagado), 0) as cobrado,
        COALESCE(SUM(valor_pendiente), 0) as pendiente
      FROM documentos
      WHERE estado NOT IN ('eliminado', 'nota_credito')
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at) DESC
      LIMIT 10
    `, {
      type: sequelize.QueryTypes.SELECT
    });
    
    documentosPorFecha.forEach(dia => {
      console.log(`  ${dia.fecha}: ${dia.cantidad} docs, $${parseFloat(dia.facturado).toFixed(2)} facturado, $${parseFloat(dia.cobrado).toFixed(2)} cobrado`);
    });
    
    console.log('\n🎯 CONCLUSIÓN:');
    console.log('Si las métricas "SIN FILTROS" son iguales para todos los períodos,');
    console.log('entonces el problema está confirmado: LOS FILTROS NO FUNCIONAN.');
    
  } catch (error) {
    console.error('❌ Error en debugging:', error);
  } finally {
    process.exit(0);
  }
}

debugDashboardFiltros(); 