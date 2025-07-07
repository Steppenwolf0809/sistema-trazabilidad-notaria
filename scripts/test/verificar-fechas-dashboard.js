const { sequelize } = require('./config/database');
const moment = require('moment');

async function verificarFechasDashboard() {
  try {
    console.log('🔍 VERIFICANDO FECHAS DEL DASHBOARD\n');
    
    // Simular exactamente la lógica del dashboard
    const hoy = moment().startOf('day');
    
    const rangos = {
      'hoy': {
        fechaInicio: hoy.clone(),
        fechaFin: moment().endOf('day')
      },
      'semana': {
        fechaInicio: hoy.clone().subtract(7, 'days'),
        fechaFin: moment().endOf('day')
      },
      'ultimo_mes': {
        fechaInicio: hoy.clone().subtract(30, 'days'),
        fechaFin: moment().endOf('day')
      },
      'desde_inicio': {
        fechaInicio: moment('2020-01-01'),
        fechaFin: moment().endOf('day')
      }
    };
    
    console.log('📅 RANGOS DE FECHAS CALCULADOS:');
    for (const [nombre, rango] of Object.entries(rangos)) {
      console.log(`  ${nombre.toUpperCase()}: ${rango.fechaInicio.format('DD/MM/YYYY HH:mm')} - ${rango.fechaFin.format('DD/MM/YYYY HH:mm')}`);
    }
    
    // Verificar documentos por cada rango
    for (const [nombre, rango] of Object.entries(rangos)) {
      console.log(`\n🎯 RANGO: ${nombre.toUpperCase()}`);
      
      const documentos = await sequelize.query(`
        SELECT 
          COUNT(*) as total,
          COALESCE(SUM(valor_factura), 0) as facturado,
          COALESCE(SUM(CASE WHEN estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial') THEN valor_pagado ELSE 0 END), 0) as pagado,
          COALESCE(SUM(
            CASE 
              WHEN estado_pago = 'pagado_con_retencion' THEN 0
              ELSE valor_pendiente
            END
          ), 0) as pendiente_corregido,
          COALESCE(SUM(valor_pendiente), 0) as pendiente_original
        FROM documentos
        WHERE created_at BETWEEN :fechaInicio AND :fechaFin
        AND estado NOT IN ('eliminado', 'nota_credito')
        AND numero_factura IS NOT NULL
      `, {
        replacements: { 
          fechaInicio: rango.fechaInicio.toDate(), 
          fechaFin: rango.fechaFin.toDate() 
        },
        type: sequelize.QueryTypes.SELECT
      });
      
             const datos = documentos[0];
       const facturado = parseFloat(datos.facturado);
       const pagado = parseFloat(datos.pagado);
       const pendienteCorregido = parseFloat(datos.pendiente_corregido);
       const pendienteOriginal = parseFloat(datos.pendiente_original);
       
       // CORREGIDO: Obtener total retenido para cálculo correcto
       const [retencionResult] = await sequelize.query(`
         SELECT COALESCE(SUM(valor_retenido), 0) as total_retenido
         FROM documentos
         WHERE created_at BETWEEN :fechaInicio AND :fechaFin
         AND estado NOT IN ('eliminado', 'nota_credito')
         AND numero_factura IS NOT NULL
       `, {
         replacements: { 
           fechaInicio: rango.fechaInicio.toDate(), 
           fechaFin: rango.fechaFin.toDate() 
         },
         type: sequelize.QueryTypes.SELECT
       });
       
       const totalRetenido = parseFloat(retencionResult.total_retenido);
       const calculadoCorregido = facturado - pagado - totalRetenido;
      
             console.log(`  📊 Documentos: ${datos.total}`);
       console.log(`  💵 Facturado: $${facturado.toFixed(2)}`);
       console.log(`  💚 Pagado: $${pagado.toFixed(2)}`);
       console.log(`  💰 Total retenido: $${totalRetenido.toFixed(2)}`);
       console.log(`  🔴 Pendiente (original): $${pendienteOriginal.toFixed(2)}`);
       console.log(`  🔄 Pendiente (corregido): $${pendienteCorregido.toFixed(2)}`);
       console.log(`  🧮 Calculado (facturado - pagado - retenido): $${calculadoCorregido.toFixed(2)}`);
       console.log(`  ⚖️  Diferencia: $${Math.abs(calculadoCorregido - pendienteCorregido).toFixed(2)}`);
       console.log(`  ✅ Matemática: ${Math.abs(calculadoCorregido - pendienteCorregido) < 0.01 ? 'CORRECTA ✅' : 'INCORRECTA ❌'}`);
    }
    
    // Verificar específicamente el problema de los 7 días
    console.log('\\n🔍 INVESTIGACIÓN ESPECÍFICA - 7 DÍAS:');
    
    const fechaInicio7d = hoy.clone().subtract(7, 'days');
    const fechaFin7d = moment().endOf('day');
    
    console.log(`📅 Rango exacto: ${fechaInicio7d.format('YYYY-MM-DD HH:mm:ss')} - ${fechaFin7d.format('YYYY-MM-DD HH:mm:ss')}`);
    
    const docs7d = await sequelize.query(`
      SELECT 
        id,
        codigo_barras,
        valor_factura,
        valor_pagado,
        valor_pendiente,
        estado_pago,
        created_at
      FROM documentos
      WHERE created_at BETWEEN :fechaInicio AND :fechaFin
      AND estado NOT IN ('eliminado', 'nota_credito')
      AND numero_factura IS NOT NULL
      ORDER BY created_at DESC
    `, {
      replacements: { 
        fechaInicio: fechaInicio7d.toDate(), 
        fechaFin: fechaFin7d.toDate() 
      },
      type: sequelize.QueryTypes.SELECT
    });
    
    console.log(`📊 Total documentos encontrados: ${docs7d.length}`);
    
    if (docs7d.length <= 15) {
      console.log('\\nDocumentos encontrados:');
      docs7d.forEach(doc => {
        const fecha = moment(doc.created_at).format('DD/MM/YYYY HH:mm');
        console.log(`  ID ${doc.id}: $${parseFloat(doc.valor_factura).toFixed(2)} (${doc.estado_pago}) - ${fecha}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error en verificación:', error);
  } finally {
    process.exit(0);
  }
}

verificarFechasDashboard(); 