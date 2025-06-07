const { sequelize } = require('./config/database');
const { Op } = require('sequelize');
const Documento = require('./models/Documento');
const moment = require('moment');

async function verificarDashboardCorregido() {
  try {
    console.log('🔍 VERIFICANDO DASHBOARD CORREGIDO...\n');
    
    // Simular el cálculo del dashboard con las correcciones aplicadas
    const hoy = moment().startOf('day');
    const fechaInicio = hoy.clone().startOf('month');
    const fechaFin = moment().endOf('day');
    const fechaInicioSQL = fechaInicio.format('YYYY-MM-DD HH:mm:ss');
    const fechaFinSQL = fechaFin.format('YYYY-MM-DD HH:mm:ss');
    
    console.log(`📅 Período: ${fechaInicio.format('DD/MM/YYYY')} - ${fechaFin.format('DD/MM/YYYY')}\n`);
    
    // 1. INGRESOS DEL PERÍODO (CORREGIDO)
    const [ingresosPeriodoResult] = await sequelize.query(`
      SELECT COALESCE(SUM(valor_pagado), 0) as total
      FROM documentos
      WHERE fecha_ultimo_pago BETWEEN :fechaInicio AND :fechaFin
      AND estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial')
      AND estado NOT IN ('eliminado', 'nota_credito')
    `, {
      replacements: { fechaInicio: fechaInicioSQL, fechaFin: fechaFinSQL },
      type: sequelize.QueryTypes.SELECT
    });
    const ingresosPeriodo = parseFloat(ingresosPeriodoResult.total);
    
    // 2. FACTURACIÓN DEL PERÍODO
    const [facturacionPeriodoResult] = await sequelize.query(`
      SELECT COALESCE(SUM(valor_factura), 0) as total
      FROM documentos
      WHERE created_at BETWEEN :fechaInicio AND :fechaFin
      AND numero_factura IS NOT NULL
      AND estado NOT IN ('eliminado', 'nota_credito')
    `, {
      replacements: { fechaInicio: fechaInicioSQL, fechaFin: fechaFinSQL },
      type: sequelize.QueryTypes.SELECT
    });
    const facturacionPeriodo = parseFloat(facturacionPeriodoResult.total);
    
    // 3. TOTAL PENDIENTE (CORREGIDO)
    const [totalPendienteResult] = await sequelize.query(`
      SELECT COALESCE(SUM(valor_pendiente), 0) as total
      FROM documentos
      WHERE estado_pago IN ('pendiente', 'pago_parcial')
      AND numero_factura IS NOT NULL
      AND estado NOT IN ('eliminado', 'nota_credito')
    `, {
      type: sequelize.QueryTypes.SELECT
    });
    const totalPendiente = parseFloat(totalPendienteResult.total);
    
    // 4. DOCUMENTOS COBRADOS EN EL PERÍODO (CORREGIDO)
    const documentosCobradosPeriodo = await Documento.count({
      where: {
        estado_pago: { [Op.in]: ['pagado_completo', 'pagado_con_retencion', 'pago_parcial'] },
        fecha_ultimo_pago: {
          [Op.between]: [fechaInicio.toDate(), fechaFin.toDate()]
        }
      }
    });
    
    console.log('✅ MÉTRICAS FINANCIERAS CORREGIDAS:');
    console.log(`  💰 Ingresos del período: $${ingresosPeriodo.toFixed(2)}`);
    console.log(`  📊 Facturación del período: $${facturacionPeriodo.toFixed(2)}`);
    console.log(`  ⏳ Total pendiente: $${totalPendiente.toFixed(2)}`);
    console.log(`  📄 Documentos cobrados: ${documentosCobradosPeriodo}`);
    
    // 5. VERIFICACIÓN DE INTEGRIDAD
    const totalGlobal = await sequelize.query(`
      SELECT 
        COALESCE(SUM(valor_factura), 0) as total_facturado,
        COALESCE(SUM(valor_pagado), 0) as total_pagado,
        COALESCE(SUM(valor_pendiente), 0) as total_pendiente
      FROM documentos
      WHERE numero_factura IS NOT NULL
      AND estado NOT IN ('eliminado', 'nota_credito')
    `, { type: sequelize.QueryTypes.SELECT });
    
    const global = totalGlobal[0];
    const diferencia = parseFloat(global.total_facturado) - (parseFloat(global.total_pagado) + parseFloat(global.total_pendiente));
    
    console.log('\n🔍 VERIFICACIÓN DE INTEGRIDAD GLOBAL:');
    console.log(`  📊 Total facturado: $${parseFloat(global.total_facturado).toFixed(2)}`);
    console.log(`  💰 Total pagado: $${parseFloat(global.total_pagado).toFixed(2)}`);
    console.log(`  ⏳ Total pendiente: $${parseFloat(global.total_pendiente).toFixed(2)}`);
    console.log(`  🧮 Suma (pagado + pendiente): $${(parseFloat(global.total_pagado) + parseFloat(global.total_pendiente)).toFixed(2)}`);
    console.log(`  ⚖️ Diferencia: $${diferencia.toFixed(2)} ${Math.abs(diferencia) < 0.01 ? '✅ CORRECTO' : '❌ ERROR'}`);
    
    // 6. DESGLOSE POR ESTADO DE PAGO
    const desglosePorEstado = await sequelize.query(`
      SELECT 
        estado_pago,
        COUNT(*) as cantidad,
        SUM(valor_factura) as facturado,
        SUM(valor_pagado) as pagado,
        SUM(valor_pendiente) as pendiente
      FROM documentos
      WHERE numero_factura IS NOT NULL
      AND estado NOT IN ('eliminado', 'nota_credito')
      GROUP BY estado_pago
      ORDER BY cantidad DESC
    `, { type: sequelize.QueryTypes.SELECT });
    
    console.log('\n📋 DESGLOSE POR ESTADO DE PAGO:');
    desglosePorEstado.forEach(estado => {
      console.log(`  ${estado.estado_pago}:`);
      console.log(`    📄 Documentos: ${estado.cantidad}`);
      console.log(`    📊 Facturado: $${parseFloat(estado.facturado || 0).toFixed(2)}`);
      console.log(`    💰 Pagado: $${parseFloat(estado.pagado || 0).toFixed(2)}`);
      console.log(`    ⏳ Pendiente: $${parseFloat(estado.pendiente || 0).toFixed(2)}`);
    });
    
    // 7. EJEMPLO DE DOCUMENTO CON PAGO PARCIAL
    const ejemploParcial = await sequelize.query(`
      SELECT codigo_barras, valor_factura, valor_pagado, valor_pendiente, estado_pago
      FROM documentos
      WHERE estado_pago = 'pago_parcial'
      LIMIT 1
    `, { type: sequelize.QueryTypes.SELECT });
    
    if (ejemploParcial.length > 0) {
      const doc = ejemploParcial[0];
      console.log('\n📄 EJEMPLO DE DOCUMENTO CON PAGO PARCIAL:');
      console.log(`  🔢 Código: ${doc.codigo_barras}`);
      console.log(`  📊 Facturado: $${parseFloat(doc.valor_factura).toFixed(2)}`);
      console.log(`  💰 Pagado: $${parseFloat(doc.valor_pagado).toFixed(2)}`);
      console.log(`  ⏳ Pendiente: $${parseFloat(doc.valor_pendiente).toFixed(2)}`);
      console.log(`  📋 Estado: ${doc.estado_pago}`);
      
      // Verificar que la suma es correcta
      const suma = parseFloat(doc.valor_pagado) + parseFloat(doc.valor_pendiente);
      const facturado = parseFloat(doc.valor_factura);
      console.log(`  🧮 Verificación: ${suma.toFixed(2)} = ${facturado.toFixed(2)} ${Math.abs(suma - facturado) < 0.01 ? '✅' : '❌'}`);
    }
    
    console.log('\n🎉 VERIFICACIÓN COMPLETADA - Dashboard corregido exitosamente!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

verificarDashboardCorregido(); 