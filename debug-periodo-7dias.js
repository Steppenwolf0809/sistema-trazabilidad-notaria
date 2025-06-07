const { sequelize } = require('./config/database');
const moment = require('moment');

async function debugPeriodo7Dias() {
  try {
    console.log('🔍 DEBUGGING PERÍODO 7 DÍAS\n');
    
    // Calcular fechas del período de 7 días
    const hoy = moment().startOf('day');
    const fechaInicio = hoy.clone().subtract(7, 'days');
    const fechaFin = moment().endOf('day');
    
    console.log(`📅 Período: ${fechaInicio.format('DD/MM/YYYY')} - ${fechaFin.format('DD/MM/YYYY')}`);
    
    // Obtener todos los documentos del período
    const documentos = await sequelize.query(`
      SELECT 
        id,
        codigo_barras,
        nombre_cliente,
        valor_factura,
        valor_pagado,
        valor_pendiente,
        valor_retenido,
        estado_pago,
        created_at,
        fecha_ultimo_pago
      FROM documentos
      WHERE created_at BETWEEN :fechaInicio AND :fechaFin
      AND estado NOT IN ('eliminado', 'nota_credito')
      ORDER BY created_at DESC
    `, {
      replacements: { 
        fechaInicio: fechaInicio.toDate(), 
        fechaFin: fechaFin.toDate() 
      },
      type: sequelize.QueryTypes.SELECT
    });
    
    console.log(`\n📊 DOCUMENTOS EN EL PERÍODO (${documentos.length} total):`);
    console.log('ID | Código | Cliente | Factura | Pagado | Pendiente | Retenido | Estado | Creado');
    console.log('---|--------|---------|---------|--------|-----------|----------|--------|--------');
    
    let totalFacturado = 0;
    let totalPagado = 0;
    let totalPendiente = 0;
    let totalPendienteCorregido = 0;
    
    documentos.forEach(doc => {
      const factura = parseFloat(doc.valor_factura || 0);
      const pagado = parseFloat(doc.valor_pagado || 0);
      const pendiente = parseFloat(doc.valor_pendiente || 0);
      const retenido = parseFloat(doc.valor_retenido || 0);
      
      // Aplicar lógica corregida: documentos con retención no cuentan como pendientes
      const pendienteCorregido = doc.estado_pago === 'pagado_con_retencion' ? 0 : pendiente;
      
      totalFacturado += factura;
      totalPagado += pagado;
      totalPendiente += pendiente;
      totalPendienteCorregido += pendienteCorregido;
      
      const fechaCreacion = moment(doc.created_at).format('DD/MM');
      
      console.log(`${doc.id} | ${doc.codigo_barras} | ${doc.nombre_cliente?.substring(0, 10)}... | $${factura.toFixed(2)} | $${pagado.toFixed(2)} | $${pendiente.toFixed(2)} | $${retenido.toFixed(2)} | ${doc.estado_pago} | ${fechaCreacion}`);
      
      if (doc.estado_pago === 'pagado_con_retencion') {
        console.log(`   🔄 Pendiente corregido: $${pendiente.toFixed(2)} → $${pendienteCorregido.toFixed(2)}`);
      }
    });
    
    console.log('\n🧮 TOTALES DEL PERÍODO:');
    console.log(`💵 Total facturado: $${totalFacturado.toFixed(2)}`);
    console.log(`💚 Total pagado: $${totalPagado.toFixed(2)}`);
    console.log(`🔴 Total pendiente (DB): $${totalPendiente.toFixed(2)}`);
    console.log(`🔄 Total pendiente (corregido): $${totalPendienteCorregido.toFixed(2)}`);
    
    const calculadoOriginal = totalFacturado - totalPagado;
    const calculadoCorregido = totalFacturado - totalPagado;
    
    console.log(`🧮 Calculado (facturado - pagado): $${calculadoOriginal.toFixed(2)}`);
    console.log(`⚖️  Diferencia original: $${Math.abs(calculadoOriginal - totalPendiente).toFixed(2)}`);
    console.log(`⚖️  Diferencia corregida: $${Math.abs(calculadoCorregido - totalPendienteCorregido).toFixed(2)}`);
    
    // Verificar específicamente documentos con retención en este período
    const conRetencion = documentos.filter(doc => doc.estado_pago === 'pagado_con_retencion');
    
    if (conRetencion.length > 0) {
      console.log(`\n🎯 DOCUMENTOS CON RETENCIÓN EN EL PERÍODO (${conRetencion.length}):`);
      conRetencion.forEach(doc => {
        const factura = parseFloat(doc.valor_factura || 0);
        const pagado = parseFloat(doc.valor_pagado || 0);
        const pendiente = parseFloat(doc.valor_pendiente || 0);
        const retenido = parseFloat(doc.valor_retenido || 0);
        
        console.log(`  📄 ID ${doc.id}: $${factura.toFixed(2)} - $${pagado.toFixed(2)} = $${(factura - pagado).toFixed(2)} (retenido: $${retenido.toFixed(2)}, pendiente DB: $${pendiente.toFixed(2)})`);
      });
      
      const totalRetencionPendiente = conRetencion.reduce((sum, doc) => sum + parseFloat(doc.valor_pendiente || 0), 0);
      console.log(`  💰 Total pendiente de documentos con retención: $${totalRetencionPendiente.toFixed(2)}`);
      console.log(`  🔄 Al corregir a 0: diferencia de $${totalRetencionPendiente.toFixed(2)}`);
    }
    
  } catch (error) {
    console.error('❌ Error en debugging:', error);
  } finally {
    process.exit(0);
  }
}

debugPeriodo7Dias(); 