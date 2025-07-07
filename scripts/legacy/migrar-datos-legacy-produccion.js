const { sequelize } = require('./config/database');
const moment = require('moment');

/**
 * SCRIPT DE MIGRACIÓN PARA DATOS LEGACY
 * EJECUTAR ANTES DE SUBIR A PRODUCCIÓN
 * 
 * Corrige documentos pagados sin fecha_ultimo_pago
 */
async function migrarDatosLegacy() {
  const transaction = await sequelize.transaction();
  
  try {
    console.log('🔧 INICIANDO MIGRACIÓN DE DATOS LEGACY...\n');
    
    // 1. VERIFICAR ESTADO ACTUAL
    console.log('📊 ESTADO ACTUAL:');
    
    const [estadoActual] = await sequelize.query(`
      SELECT 
        COUNT(*) as total_documentos,
        COUNT(CASE WHEN fecha_ultimo_pago IS NULL THEN 1 END) as sin_fecha_pago,
        COUNT(CASE WHEN fecha_ultimo_pago IS NULL AND estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial') THEN 1 END) as pagados_sin_fecha
      FROM documentos
      WHERE estado NOT IN ('eliminado', 'nota_credito')
    `, { 
      transaction,
      type: sequelize.QueryTypes.SELECT 
    });
    
    console.log(`  Total documentos: ${estadoActual.total_documentos}`);
    console.log(`  Sin fecha_ultimo_pago: ${estadoActual.sin_fecha_pago}`);
    console.log(`  Pagados sin fecha: ${estadoActual.pagados_sin_fecha}`);
    
    if (estadoActual.pagados_sin_fecha === 0) {
      console.log('  ✅ No hay documentos pagados sin fecha. Migración no necesaria.');
      await transaction.rollback();
      return;
    }
    
    // 2. MOSTRAR DOCUMENTOS QUE SE VAN A MIGRAR
    console.log('\n📋 DOCUMENTOS QUE SE MIGRARÁN:');
    
    const documentosAMigrar = await sequelize.query(`
      SELECT 
        id,
        codigo_barras,
        estado_pago,
        valor_pagado,
        created_at,
        updated_at
      FROM documentos
      WHERE fecha_ultimo_pago IS NULL
      AND estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial')
      ORDER BY created_at DESC
    `, { 
      transaction,
      type: sequelize.QueryTypes.SELECT 
    });
    
    documentosAMigrar.forEach(doc => {
      console.log(`  ${doc.codigo_barras}: ${doc.estado_pago}, $${parseFloat(doc.valor_pagado).toFixed(2)}`);
      console.log(`    Creado: ${moment(doc.created_at).format('DD/MM/YYYY HH:mm')}`);
      console.log(`    Actualizado: ${moment(doc.updated_at).format('DD/MM/YYYY HH:mm')}`);
      console.log(`    Se asignará fecha_ultimo_pago: ${moment(doc.updated_at).format('DD/MM/YYYY HH:mm')}`);
    });
    
    // 3. CONFIRMAR MIGRACIÓN
    console.log(`\n🚨 ¿PROCEDER CON LA MIGRACIÓN DE ${documentosAMigrar.length} DOCUMENTOS?`);
    console.log('   Esta operación asignará fecha_ultimo_pago = updated_at');
    console.log('   para documentos pagados que no tienen fecha de pago.');
    
    // En producción, aquí podrías agregar una confirmación manual
    // Por ahora, procedemos automáticamente
    
    // 4. EJECUTAR MIGRACIÓN
    console.log('\n⚡ EJECUTANDO MIGRACIÓN...');
    
    const resultadoMigracion = await sequelize.query(`
      UPDATE documentos 
      SET fecha_ultimo_pago = updated_at
      WHERE fecha_ultimo_pago IS NULL
      AND estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial')
      AND estado NOT IN ('eliminado', 'nota_credito')
    `, { 
      transaction,
      type: sequelize.QueryTypes.UPDATE 
    });
    
    console.log(`  ✅ Migrados: ${resultadoMigracion[1]} documentos`);
    
    // 5. VERIFICAR RESULTADO
    console.log('\n🔍 VERIFICANDO RESULTADO:');
    
    const [estadoFinal] = await sequelize.query(`
      SELECT 
        COUNT(*) as total_documentos,
        COUNT(CASE WHEN fecha_ultimo_pago IS NULL THEN 1 END) as sin_fecha_pago,
        COUNT(CASE WHEN fecha_ultimo_pago IS NULL AND estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial') THEN 1 END) as pagados_sin_fecha
      FROM documentos
      WHERE estado NOT IN ('eliminado', 'nota_credito')
    `, { 
      transaction,
      type: sequelize.QueryTypes.SELECT 
    });
    
    console.log(`  Total documentos: ${estadoFinal.total_documentos}`);
    console.log(`  Sin fecha_ultimo_pago: ${estadoFinal.sin_fecha_pago}`);
    console.log(`  Pagados sin fecha: ${estadoFinal.pagados_sin_fecha}`);
    
    if (estadoFinal.pagados_sin_fecha === 0) {
      console.log('  ✅ MIGRACIÓN EXITOSA: Todos los documentos pagados tienen fecha');
    } else {
      throw new Error(`Aún quedan ${estadoFinal.pagados_sin_fecha} documentos pagados sin fecha`);
    }
    
    // 6. CONFIRMAR TRANSACCIÓN
    await transaction.commit();
    
    console.log('\n🎉 MIGRACIÓN COMPLETADA EXITOSAMENTE');
    console.log('\n📋 RESUMEN:');
    console.log(`   - Documentos migrados: ${resultadoMigracion[1]}`);
    console.log(`   - Documentos pagados sin fecha: ${estadoActual.pagados_sin_fecha} → ${estadoFinal.pagados_sin_fecha}`);
    console.log('   - Estado: ✅ LISTO PARA PRODUCCIÓN');
    
    console.log('\n🚀 PRÓXIMOS PASOS:');
    console.log('   1. ✅ Datos legacy migrados');
    console.log('   2. ✅ Dashboard corregido para cálculo por período');
    console.log('   3. 🔄 Probar dashboard con diferentes períodos');
    console.log('   4. 🚀 Desplegar a producción');
    
    process.exit(0);
    
  } catch (error) {
    await transaction.rollback();
    console.error('\n❌ ERROR EN MIGRACIÓN:', error.message);
    console.log('\n🔄 TRANSACCIÓN REVERTIDA - No se realizaron cambios');
    process.exit(1);
  }
}

// Ejecutar migración
migrarDatosLegacy(); 