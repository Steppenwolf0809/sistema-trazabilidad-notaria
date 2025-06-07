const { sequelize } = require('./config/database');
const moment = require('moment');

async function debugPeriodoDashboard() {
  try {
    console.log('🔍 DEBUGGING PERÍODO DEL DASHBOARD...\n');
    
    // Simular diferentes rangos de fecha para entender el problema
    const hoy = moment().startOf('day');
    
    // 1. VERIFICAR RANGO "AÑO" (como debería ser)
    const inicioAño = moment().startOf('year');
    const finAño = moment().endOf('day');
    
    console.log(`📅 RANGO AÑO COMPLETO:`);
    console.log(`  Desde: ${inicioAño.format('DD/MM/YYYY HH:mm:ss')}`);
    console.log(`  Hasta: ${finAño.format('DD/MM/YYYY HH:mm:ss')}\n`);
    
    const [ingresosAño] = await sequelize.query(`
      SELECT COALESCE(SUM(valor_pagado), 0) as total
      FROM documentos
      WHERE fecha_ultimo_pago BETWEEN :fechaInicio AND :fechaFin
      AND estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial')
      AND estado NOT IN ('eliminado', 'nota_credito')
    `, {
      replacements: { 
        fechaInicio: inicioAño.format('YYYY-MM-DD HH:mm:ss'), 
        fechaFin: finAño.format('YYYY-MM-DD HH:mm:ss') 
      },
      type: sequelize.QueryTypes.SELECT
    });
    
    console.log(`💰 Ingresos año completo: $${parseFloat(ingresosAño.total).toFixed(2)}`);
    
    // 2. VERIFICAR RANGO "MES" (como está configurado por defecto)
    const inicioMes = hoy.clone().startOf('month');
    const finMes = moment().endOf('day');
    
    console.log(`\n📅 RANGO MES ACTUAL:`);
    console.log(`  Desde: ${inicioMes.format('DD/MM/YYYY HH:mm:ss')}`);
    console.log(`  Hasta: ${finMes.format('DD/MM/YYYY HH:mm:ss')}\n`);
    
    const [ingresosMes] = await sequelize.query(`
      SELECT COALESCE(SUM(valor_pagado), 0) as total
      FROM documentos
      WHERE fecha_ultimo_pago BETWEEN :fechaInicio AND :fechaFin
      AND estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial')
      AND estado NOT IN ('eliminado', 'nota_credito')
    `, {
      replacements: { 
        fechaInicio: inicioMes.format('YYYY-MM-DD HH:mm:ss'), 
        fechaFin: finMes.format('YYYY-MM-DD HH:mm:ss') 
      },
      type: sequelize.QueryTypes.SELECT
    });
    
    console.log(`💰 Ingresos mes actual: $${parseFloat(ingresosMes.total).toFixed(2)}`);
    
    // 3. VERIFICAR TODOS LOS PAGOS CON FECHA
    const [todosPagos] = await sequelize.query(`
      SELECT 
        COUNT(*) as cantidad,
        MIN(fecha_ultimo_pago) as primer_pago,
        MAX(fecha_ultimo_pago) as ultimo_pago,
        COALESCE(SUM(valor_pagado), 0) as total
      FROM documentos
      WHERE estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial')
      AND fecha_ultimo_pago IS NOT NULL
      AND estado NOT IN ('eliminado', 'nota_credito')
    `, { type: sequelize.QueryTypes.SELECT });
    
    console.log(`\n📊 TODOS LOS PAGOS REGISTRADOS:`);
    console.log(`  Cantidad: ${todosPagos.cantidad}`);
    console.log(`  Primer pago: ${todosPagos.primer_pago ? moment(todosPagos.primer_pago).format('DD/MM/YYYY HH:mm:ss') : 'N/A'}`);
    console.log(`  Último pago: ${todosPagos.ultimo_pago ? moment(todosPagos.ultimo_pago).format('DD/MM/YYYY HH:mm:ss') : 'N/A'}`);
    console.log(`  Total: $${parseFloat(todosPagos.total).toFixed(2)}`);
    
    // 4. VERIFICAR PAGOS POR MES
    const pagosPorMes = await sequelize.query(`
      SELECT 
        EXTRACT(YEAR FROM fecha_ultimo_pago) as año,
        EXTRACT(MONTH FROM fecha_ultimo_pago) as mes,
        COUNT(*) as cantidad,
        COALESCE(SUM(valor_pagado), 0) as total
      FROM documentos
      WHERE estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial')
      AND fecha_ultimo_pago IS NOT NULL
      AND estado NOT IN ('eliminado', 'nota_credito')
      GROUP BY EXTRACT(YEAR FROM fecha_ultimo_pago), EXTRACT(MONTH FROM fecha_ultimo_pago)
      ORDER BY año DESC, mes DESC
    `, { type: sequelize.QueryTypes.SELECT });
    
    console.log(`\n📈 PAGOS POR MES:`);
    pagosPorMes.forEach(mes => {
      console.log(`  ${mes.año}/${mes.mes.toString().padStart(2, '0')}: ${mes.cantidad} pagos, $${parseFloat(mes.total).toFixed(2)}`);
    });
    
    // 5. VERIFICAR SI EL PROBLEMA ES EL RANGO POR DEFECTO
    console.log(`\n🔍 ANÁLISIS:`);
    console.log(`  Dashboard muestra: $81.29`);
    console.log(`  Mes actual: $${parseFloat(ingresosMes.total).toFixed(2)}`);
    console.log(`  Año completo: $${parseFloat(ingresosAño.total).toFixed(2)}`);
    console.log(`  Total histórico: $${parseFloat(todosPagos.total).toFixed(2)}`);
    
    if (parseFloat(ingresosMes.total).toFixed(2) === '81.29') {
      console.log(`  ❌ PROBLEMA: Dashboard está usando rango de MES en lugar de AÑO`);
    } else if (parseFloat(ingresosAño.total).toFixed(2) === '81.29') {
      console.log(`  ✅ Dashboard está usando rango de AÑO correctamente`);
    } else {
      console.log(`  ❓ Dashboard está usando un rango diferente`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

debugPeriodoDashboard(); 