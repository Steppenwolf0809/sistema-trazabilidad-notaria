const { sequelize } = require('./config/database');
const moment = require('moment');

async function testDashboardLogicaCorregida() {
  try {
    console.log('🧪 PROBANDO LÓGICA CORREGIDA DEL DASHBOARD\n');
    
    // Simular exactamente la lógica del dashboard corregido
    const hoy = moment().startOf('day');
    
    const rangos = [
      { nombre: 'HOY', rango: 'hoy' },
      { nombre: '7 DÍAS', rango: 'semana' },
      { nombre: '30 DÍAS', rango: 'ultimo_mes' },
      { nombre: 'HISTÓRICO', rango: 'desde_inicio' }
    ];
    
    for (const filtro of rangos) {
      console.log(`🎯 PROBANDO FILTRO: ${filtro.nombre}`);
      
      // Calcular fechas igual que el dashboard
      let fechaInicio, fechaFin;
      
      switch (filtro.rango) {
        case 'hoy':
          fechaInicio = hoy.clone();
          fechaFin = moment().endOf('day');
          break;
        case 'semana':
          fechaInicio = hoy.clone().subtract(7, 'days');
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
      
      // 1. FACTURACIÓN DEL PERÍODO (lógica existente)
      const [facturacionResult] = await sequelize.query(`
        SELECT COALESCE(SUM(valor_factura), 0) as total
        FROM documentos
        WHERE created_at BETWEEN :fechaInicio AND :fechaFin
        AND numero_factura IS NOT NULL
        AND estado NOT IN ('eliminado', 'nota_credito')
      `, {
        replacements: { fechaInicio: fechaInicioSQL, fechaFin: fechaFinSQL },
        type: sequelize.QueryTypes.SELECT
      });
      
      const facturado = parseFloat(facturacionResult.total);
      
      // 2. PAGOS RECIBIDOS DEL PERÍODO (lógica existente)
      const [pagosResult] = await sequelize.query(`
        SELECT COALESCE(SUM(CASE WHEN estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial') THEN valor_pagado ELSE 0 END), 0) as total
        FROM documentos
        WHERE created_at BETWEEN :fechaInicio AND :fechaFin
        AND estado NOT IN ('eliminado', 'nota_credito')
      `, {
        replacements: { fechaInicio: fechaInicioSQL, fechaFin: fechaFinSQL },
        type: sequelize.QueryTypes.SELECT
      });
      
      const pagado = parseFloat(pagosResult.total);
      
      // 3. PENDIENTE CON NUEVA LÓGICA CORREGIDA
      let totalPendienteQuery, totalPendienteReplacements;
      
      if (filtro.rango === 'desde_inicio') {
        // Para "desde_inicio", usar cálculo global
        totalPendienteQuery = `
          SELECT COALESCE(SUM(valor_factura - valor_pagado - COALESCE(valor_retenido, 0)), 0) as total
          FROM documentos
          WHERE numero_factura IS NOT NULL
          AND estado NOT IN ('eliminado', 'nota_credito')
          AND (valor_factura - valor_pagado - COALESCE(valor_retenido, 0)) > 0
        `;
        totalPendienteReplacements = {};
      } else {
        // Para otros rangos, filtrar por período de creación
        totalPendienteQuery = `
          SELECT COALESCE(SUM(valor_factura - valor_pagado - COALESCE(valor_retenido, 0)), 0) as total
          FROM documentos
          WHERE created_at BETWEEN :fechaInicio AND :fechaFin
          AND numero_factura IS NOT NULL
          AND estado NOT IN ('eliminado', 'nota_credito')
          AND (valor_factura - valor_pagado - COALESCE(valor_retenido, 0)) > 0
        `;
        totalPendienteReplacements = { fechaInicio: fechaInicioSQL, fechaFin: fechaFinSQL };
      }
      
      const [pendienteResult] = await sequelize.query(totalPendienteQuery, {
        replacements: totalPendienteReplacements,
        type: sequelize.QueryTypes.SELECT
      });
      
      const pendienteCorregido = parseFloat(pendienteResult.total);
      
      // 4. VERIFICACIÓN MATEMÁTICA
      const calculado = facturado - pagado;
      const diferencia = Math.abs(calculado - pendienteCorregido);
      
      console.log(`  💵 Facturado: $${facturado.toFixed(2)}`);
      console.log(`  💚 Pagado: $${pagado.toFixed(2)}`);
      console.log(`  🔄 Pendiente (nueva lógica): $${pendienteCorregido.toFixed(2)}`);
      console.log(`  🧮 Calculado (facturado - pagado): $${calculado.toFixed(2)}`);
      console.log(`  ⚖️  Diferencia: $${diferencia.toFixed(2)}`);
      console.log(`  ✅ Matemática: ${diferencia < 0.01 ? 'CORRECTA ✅' : 'INCORRECTA ❌'}`);
      
      // 5. ANÁLISIS DETALLADO SI HAY DIFERENCIAS
      if (diferencia >= 0.01) {
        console.log(`\n  🔍 ANÁLISIS DETALLADO DE LA DIFERENCIA:`);
        
        // Verificar documentos con retención en este período
        const [retencionesResult] = await sequelize.query(`
          SELECT 
            COUNT(*) as docs_con_retencion,
            COALESCE(SUM(valor_retenido), 0) as total_retenido,
            COALESCE(SUM(valor_factura - valor_pagado), 0) as diferencia_sin_retencion
          FROM documentos
          WHERE created_at BETWEEN :fechaInicio AND :fechaFin
          AND numero_factura IS NOT NULL
          AND estado NOT IN ('eliminado', 'nota_credito')
          AND valor_retenido > 0
        `, {
          replacements: { fechaInicio: fechaInicioSQL, fechaFin: fechaFinSQL },
          type: sequelize.QueryTypes.SELECT
        });
        
        const retenciones = retencionesResult;
        console.log(`    📊 Documentos con retención: ${retenciones.docs_con_retencion}`);
        console.log(`    💰 Total retenido: $${parseFloat(retenciones.total_retenido).toFixed(2)}`);
        console.log(`    🧮 Diferencia sin considerar retenciones: $${parseFloat(retenciones.diferencia_sin_retencion).toFixed(2)}`);
        
        // Verificar si la nueva lógica está funcionando
        const diferenciaEsperada = calculado - parseFloat(retenciones.total_retenido);
        console.log(`    🎯 Pendiente esperado (calculado - retenido): $${diferenciaEsperada.toFixed(2)}`);
        console.log(`    🔄 Pendiente obtenido (nueva lógica): $${pendienteCorregido.toFixed(2)}`);
        console.log(`    ⚖️  Diferencia final: $${Math.abs(diferenciaEsperada - pendienteCorregido).toFixed(2)}`);
      }
      
      console.log(''); // Línea en blanco
    }
    
    console.log('🔍 VERIFICACIÓN FINAL: ¿La nueva lógica corrige el problema?');
    
    // Probar específicamente el caso problemático (30 días)
    const fechaInicio30 = hoy.clone().subtract(30, 'days');
    const fechaFin30 = moment().endOf('day');
    
    const [verificacionFinal] = await sequelize.query(`
      SELECT 
        COALESCE(SUM(valor_factura), 0) as facturado,
        COALESCE(SUM(CASE WHEN estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial') THEN valor_pagado ELSE 0 END), 0) as pagado,
        COALESCE(SUM(valor_factura - valor_pagado - COALESCE(valor_retenido, 0)), 0) as pendiente_nueva_logica,
        COALESCE(SUM(valor_pendiente), 0) as pendiente_db,
        COALESCE(SUM(valor_retenido), 0) as total_retenido
      FROM documentos
      WHERE created_at BETWEEN :fechaInicio AND :fechaFin
      AND numero_factura IS NOT NULL
      AND estado NOT IN ('eliminado', 'nota_credito')
    `, {
      replacements: { 
        fechaInicio: fechaInicio30.format('YYYY-MM-DD HH:mm:ss'), 
        fechaFin: fechaFin30.format('YYYY-MM-DD HH:mm:ss') 
      },
      type: sequelize.QueryTypes.SELECT
    });
    
    const verificacion = verificacionFinal;
    const facturadoFinal = parseFloat(verificacion.facturado);
    const pagadoFinal = parseFloat(verificacion.pagado);
    const pendienteNuevaLogica = parseFloat(verificacion.pendiente_nueva_logica);
    const pendienteDB = parseFloat(verificacion.pendiente_db);
    const totalRetenido = parseFloat(verificacion.total_retenido);
    const calculadoFinal = facturadoFinal - pagadoFinal;
    
    console.log(`📊 VERIFICACIÓN FINAL (30 días):`);
    console.log(`  💵 Facturado: $${facturadoFinal.toFixed(2)}`);
    console.log(`  💚 Pagado: $${pagadoFinal.toFixed(2)}`);
    console.log(`  💰 Total retenido: $${totalRetenido.toFixed(2)}`);
    console.log(`  🧮 Calculado (facturado - pagado): $${calculadoFinal.toFixed(2)}`);
    console.log(`  🔴 Pendiente DB (original): $${pendienteDB.toFixed(2)}`);
    console.log(`  🔄 Pendiente nueva lógica: $${pendienteNuevaLogica.toFixed(2)}`);
    console.log(`  ⚖️  Diferencia original: $${Math.abs(calculadoFinal - pendienteDB).toFixed(2)}`);
    console.log(`  ⚖️  Diferencia nueva lógica: $${Math.abs(calculadoFinal - pendienteNuevaLogica).toFixed(2)}`);
    console.log(`  🎉 ¿Problema resuelto?: ${Math.abs(calculadoFinal - pendienteNuevaLogica) < 0.01 ? 'SÍ ✅' : 'NO ❌'}`);
    
  } catch (error) {
    console.error('❌ Error en test:', error);
  } finally {
    process.exit(0);
  }
}

testDashboardLogicaCorregida(); 