/**
 * VERIFICAR ESTADO ACTUAL DE DOCUMENTOS DESPUÉS DE CORRECCIÓN
 */

const { Documento, sequelize } = require('../models');

(async () => {
  try {
    console.log('🔍 VERIFICANDO ESTADO ACTUAL DE DOCUMENTOS');
    console.log('==========================================');
    
    // Verificar documentos del usuario archivo problemáticos
    const docs = await sequelize.query(`
      SELECT 
        id,
        codigo_barras,
        valor_factura,
        valor_pagado,
        valor_pendiente,
        valor_retenido,
        estado_pago,
        id_matrizador
      FROM documentos 
      WHERE id_matrizador = 39 
      ORDER BY created_at DESC
    `, { type: sequelize.QueryTypes.SELECT });
    
    console.log(`📋 DOCUMENTOS DEL USUARIO ARCHIVO (ID 39):`);
    console.log(`Total: ${docs.length} documentos\n`);
    
    let totalFacturado = 0;
    let totalPagado = 0;
    let problematicoCount = 0;
    
    docs.forEach((doc, i) => {
      const factura = parseFloat(doc.valor_factura || 0);
      const pagado = parseFloat(doc.valor_pagado || 0);
      const pendiente = parseFloat(doc.valor_pendiente || 0);
      const retenido = parseFloat(doc.valor_retenido || 0);
      
      totalFacturado += factura;
      totalPagado += pagado;
      
      const esProblematico = (factura === 0 && pagado > 0) || pagado > factura;
      if (esProblematico) problematicoCount++;
      
      console.log(`${i + 1}. Doc ${doc.codigo_barras} ${esProblematico ? '❌ PROBLEMÁTICO' : '✅ OK'}:`);
      console.log(`   Factura: $${factura.toFixed(2)}`);
      console.log(`   Pagado: $${pagado.toFixed(2)}`);
      console.log(`   Pendiente: $${pendiente.toFixed(2)}`);
      console.log(`   Retenido: $${retenido.toFixed(2)}`);
      console.log(`   Estado: ${doc.estado_pago}`);
      
      if (esProblematico) {
        if (factura === 0 && pagado > 0) {
          console.log(`   🚨 PROBLEMA: Factura $0 pero pagado $${pagado.toFixed(2)}`);
        }
        if (pagado > factura) {
          console.log(`   🚨 PROBLEMA: Pagado > Facturado`);
        }
      }
      console.log('');
    });
    
    console.log('📊 RESUMEN:');
    console.log(`Total Facturado: $${totalFacturado.toFixed(2)}`);
    console.log(`Total Pagado: $${totalPagado.toFixed(2)}`);
    console.log(`Documentos problemáticos: ${problematicoCount}`);
    
    if (problematicoCount > 0) {
      console.log('\n🚨 CONCLUSIÓN: La corrección NO se aplicó correctamente');
      console.log('💡 CAUSA PROBABLE: Error en transacción o rollback');
    } else {
      console.log('\n✅ CONCLUSIÓN: Documentos corregidos exitosamente');
    }
    
    // Verificar también con la query que usa la auditoría
    const problematicosDirect = await sequelize.query(`
      SELECT COUNT(*) as total
      FROM documentos
      WHERE (valor_factura = 0 OR valor_factura IS NULL)
      AND valor_pagado > 0
      AND estado NOT IN ('eliminado', 'nota_credito')
    `, { type: sequelize.QueryTypes.SELECT });
    
    console.log(`\n🔍 Verificación con query de auditoría: ${problematicosDirect[0].total} documentos problemáticos`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
})(); 