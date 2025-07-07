const { sequelize } = require('./config/database');
const moment = require('moment');

async function testDashboardCorregido() {
  try {
    console.log('🧪 PROBANDO DASHBOARD CORREGIDO\n');
    
    // Simular diferentes filtros como lo haría el dashboard
    const filtros = [
      { nombre: 'HOY', rango: 'hoy' },
      { nombre: '7 DÍAS', rango: 'semana' },
      { nombre: '30 DÍAS', rango: 'ultimo_mes' },
      { nombre: 'HISTÓRICO', rango: 'desde_inicio' }
    ];
    
    for (const filtro of filtros) {
      console.log(`🎯 PROBANDO FILTRO: ${filtro.nombre}`);
      
      // Calcular fechas igual que el dashboard
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
        case 'desde_inicio':
          fechaInicio = moment('2020-01-01').startOf('day');
          fechaFin = moment().endOf('day');
          break;
      }
      
      const fechaInicioSQL = fechaInicio.format('YYYY-MM-DD HH:mm:ss');
      const fechaFinSQL = fechaFin.format('YYYY-MM-DD HH:mm:ss');
      
      console.log(`  📅 Período: ${fechaInicio.format('DD/MM/YYYY')} - ${fechaFin.format('DD/MM/YYYY')}`);
      
      // ============== SIMULAR NUEVA LÓGICA DEL DASHBOARD ==============
      
      // 1. Métricas principales con filtros
      const [metricas] = await sequelize.query(`
        SELECT 
          COUNT(*) as total_documentos,
          COUNT(CASE WHEN estado = 'en_proceso' THEN 1 END) as en_proceso,
          COUNT(CASE WHEN estado = 'listo_para_entrega' THEN 1 END) as listo_entrega,
          COUNT(CASE WHEN estado = 'entregado' THEN 1 END) as entregados
        FROM documentos
        WHERE created_at BETWEEN :fechaInicio AND :fechaFin
        AND estado NOT IN ('eliminado', 'nota_credito')
      `, {
        replacements: { fechaInicio: fechaInicioSQL, fechaFin: fechaFinSQL },
        type: sequelize.QueryTypes.SELECT
      });
      
      // 2. Métricas financieras con filtros (USANDO LÓGICA CORREGIDA DEL DASHBOARD)
      const [financieras] = await sequelize.query(`
        SELECT 
          COALESCE(SUM(valor_factura), 0) as facturado_periodo,
          COALESCE(SUM(CASE WHEN estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial') THEN valor_pagado ELSE 0 END), 0) as cobrado_periodo,
          COALESCE(SUM(
            CASE 
              WHEN estado_pago = 'pagado_con_retencion' THEN 0
              ELSE valor_pendiente
            END
          ), 0) as pendiente_periodo,
          COUNT(CASE WHEN estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial') THEN 1 END) as docs_cobrados
        FROM documentos
        WHERE created_at BETWEEN :fechaInicio AND :fechaFin
        AND estado NOT IN ('eliminado', 'nota_credito')
      `, {
        replacements: { fechaInicio: fechaInicioSQL, fechaFin: fechaFinSQL },
        type: sequelize.QueryTypes.SELECT
      });
      
      // Mostrar resultados
      console.log(`  📊 Documentos: ${metricas.total_documentos} total, ${metricas.en_proceso} proceso, ${metricas.listo_entrega} listos, ${metricas.entregados} entregados`);
      console.log(`  💰 Financiero: $${parseFloat(financieras.facturado_periodo).toFixed(2)} facturado, $${parseFloat(financieras.cobrado_periodo).toFixed(2)} cobrado, $${parseFloat(financieras.pendiente_periodo).toFixed(2)} pendiente`);
      console.log(`  📈 Documentos cobrados: ${financieras.docs_cobrados}`);
      
      // Verificación matemática
      const facturado = parseFloat(financieras.facturado_periodo);
      const cobrado = parseFloat(financieras.cobrado_periodo);
      const pendiente = parseFloat(financieras.pendiente_periodo);
      const calculado = facturado - cobrado;
      
      console.log(`  🧮 Verificación: ${facturado.toFixed(2)} - ${cobrado.toFixed(2)} = ${calculado.toFixed(2)}`);
      console.log(`  ✅ Matemática: ${Math.abs(calculado - pendiente) < 0.01 ? 'CORRECTA ✅' : 'INCORRECTA ❌'}`);
      
      if (Math.abs(calculado - pendiente) >= 0.01) {
        console.log(`  ⚠️  Diferencia: $${Math.abs(calculado - pendiente).toFixed(2)}`);
      }
      
      console.log('');
    }
    
    // ============== VERIFICAR QUE LOS FILTROS REALMENTE CAMBIEN ==============
    console.log('🔍 VERIFICACIÓN FINAL: ¿Los filtros realmente cambian los resultados?');
    
    const resultadosHoy = await sequelize.query(`
      SELECT COUNT(*) as total FROM documentos 
      WHERE created_at BETWEEN :fechaInicio AND :fechaFin
      AND estado NOT IN ('eliminado', 'nota_credito')
    `, {
      replacements: { 
        fechaInicio: moment().startOf('day').format('YYYY-MM-DD HH:mm:ss'),
        fechaFin: moment().endOf('day').format('YYYY-MM-DD HH:mm:ss')
      },
      type: sequelize.QueryTypes.SELECT
    });
    
    const resultadosHistorico = await sequelize.query(`
      SELECT COUNT(*) as total FROM documentos 
      WHERE created_at BETWEEN :fechaInicio AND :fechaFin
      AND estado NOT IN ('eliminado', 'nota_credito')
    `, {
      replacements: { 
        fechaInicio: moment('2020-01-01').format('YYYY-MM-DD HH:mm:ss'),
        fechaFin: moment().endOf('day').format('YYYY-MM-DD HH:mm:ss')
      },
      type: sequelize.QueryTypes.SELECT
    });
    
    const docsHoy = parseInt(resultadosHoy[0].total);
    const docsHistorico = parseInt(resultadosHistorico[0].total);
    
    console.log(`  📊 Documentos HOY: ${docsHoy}`);
    console.log(`  📊 Documentos HISTÓRICO: ${docsHistorico}`);
    console.log(`  ✅ Filtros funcionan: ${docsHoy !== docsHistorico ? 'SÍ ✅' : 'NO ❌'}`);
    
    if (docsHoy === docsHistorico) {
      console.log('  ⚠️  PROBLEMA: Los filtros siguen devolviendo los mismos resultados');
    } else {
      console.log('  🎉 ÉXITO: Los filtros ahora devuelven resultados diferentes');
    }
    
  } catch (error) {
    console.error('❌ Error en test:', error);
  } finally {
    process.exit(0);
  }
}

testDashboardCorregido(); 