const { sequelize } = require('./config/database');

async function analizarRetenciones() {
  try {
    console.log('🔍 ANÁLISIS ESPECÍFICO DE RETENCIONES\n');
    
    // Obtener documentos con retención
    const documentosConRetencion = await sequelize.query(`
      SELECT 
        id,
        codigo_barras,
        nombre_cliente,
        valor_factura,
        valor_pagado,
        valor_pendiente,
        valor_retenido,
        estado_pago,
        tiene_retencion,
        numero_comprobante_retencion
      FROM documentos
      WHERE estado_pago = 'pagado_con_retencion'
      OR valor_retenido > 0
      ORDER BY id
    `, {
      type: sequelize.QueryTypes.SELECT
    });
    
    console.log(`📊 Encontrados ${documentosConRetencion.length} documentos con retención:`);
    console.log('ID | Código | Factura | Pagado | Retenido | Pendiente | ¿Correcto?');
    console.log('---|--------|---------|--------|----------|-----------|----------');
    
    documentosConRetencion.forEach(doc => {
      const factura = parseFloat(doc.valor_factura || 0);
      const pagado = parseFloat(doc.valor_pagado || 0);
      const retenido = parseFloat(doc.valor_retenido || 0);
      const pendiente = parseFloat(doc.valor_pendiente || 0);
      
      // LÓGICA CORRECTA PARA RETENCIONES:
      // valor_factura = valor_pagado + valor_retenido + valor_pendiente
      // Por lo tanto: valor_pendiente = valor_factura - valor_pagado - valor_retenido
      
      const pendienteCalculado = factura - pagado - retenido;
      const esCorrecto = Math.abs(pendienteCalculado - pendiente) < 0.01;
      
      console.log(`${doc.id} | ${doc.codigo_barras} | $${factura.toFixed(2)} | $${pagado.toFixed(2)} | $${retenido.toFixed(2)} | $${pendiente.toFixed(2)} | ${esCorrecto ? '✅' : '❌'}`);
      
      if (!esCorrecto) {
        console.log(`   ⚠️  Debería ser: $${pendienteCalculado.toFixed(2)}`);
      }
    });
    
    // Verificar la lógica matemática correcta
    console.log('\n🧮 LÓGICA MATEMÁTICA PARA RETENCIONES:');
    console.log('valor_factura = valor_pagado + valor_retenido + valor_pendiente');
    console.log('Por lo tanto:');
    console.log('valor_pendiente = valor_factura - valor_pagado - valor_retenido');
    
    // Verificar si hay documentos sin retención pero marcados como pagado_con_retencion
    const inconsistentes = await sequelize.query(`
      SELECT 
        id,
        codigo_barras,
        estado_pago,
        valor_retenido,
        tiene_retencion
      FROM documentos
      WHERE estado_pago = 'pagado_con_retencion'
      AND (valor_retenido = 0 OR valor_retenido IS NULL)
    `, {
      type: sequelize.QueryTypes.SELECT
    });
    
    if (inconsistentes.length > 0) {
      console.log('\n⚠️  DOCUMENTOS INCONSISTENTES (marcados con retención pero sin valor retenido):');
      inconsistentes.forEach(doc => {
        console.log(`  ID ${doc.id}: estado=${doc.estado_pago}, retenido=$${doc.valor_retenido || 0}, flag=${doc.tiene_retencion}`);
      });
    }
    
    // Proponer corrección específica
    console.log('\n🔧 CORRECCIÓN PROPUESTA:');
    console.log('UPDATE documentos SET');
    console.log('  valor_pendiente = GREATEST(0, valor_factura - valor_pagado - COALESCE(valor_retenido, 0))');
    console.log('WHERE estado_pago = \'pagado_con_retencion\'');
    console.log('  OR valor_retenido > 0;');
    
  } catch (error) {
    console.error('❌ Error en análisis:', error);
  } finally {
    process.exit(0);
  }
}

analizarRetenciones(); 