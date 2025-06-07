const { sequelize } = require('./config/database');

async function corregirMatematicaDocumentos() {
  try {
    console.log('🔧 CORRECCIÓN AUTOMÁTICA DE MATEMÁTICA\n');
    
    // 1. Identificar documentos problemáticos
    const documentosProblematicos = await sequelize.query(`
      SELECT 
        id,
        codigo_barras,
        nombre_cliente,
        valor_factura,
        valor_pagado,
        valor_pendiente,
        valor_retenido,
        estado_pago,
        (valor_factura - valor_pagado) as calculado_pendiente,
        (valor_factura - valor_pagado - valor_pendiente) as diferencia
      FROM documentos
      WHERE estado NOT IN ('eliminado', 'nota_credito')
      AND numero_factura IS NOT NULL
      AND ABS(valor_factura - valor_pagado - valor_pendiente) > 0.01
      ORDER BY ABS(valor_factura - valor_pagado - valor_pendiente) DESC
    `, {
      type: sequelize.QueryTypes.SELECT
    });
    
    console.log(`🔍 Encontrados ${documentosProblematicos.length} documentos con problemas matemáticos:`);
    
    if (documentosProblematicos.length === 0) {
      console.log('✅ No hay documentos con problemas matemáticos');
      return;
    }
    
    // Mostrar documentos problemáticos
    documentosProblematicos.forEach(doc => {
      const factura = parseFloat(doc.valor_factura || 0);
      const pagado = parseFloat(doc.valor_pagado || 0);
      const pendiente = parseFloat(doc.valor_pendiente || 0);
      const retenido = parseFloat(doc.valor_retenido || 0);
      const calculado = factura - pagado;
      const diferencia = Math.abs(calculado - pendiente);
      
      console.log(`  📄 ID ${doc.id} (${doc.codigo_barras}): $${factura.toFixed(2)} - $${pagado.toFixed(2)} = $${calculado.toFixed(2)}, DB dice $${pendiente.toFixed(2)} (diff: $${diferencia.toFixed(2)})`);
      console.log(`     Estado: ${doc.estado_pago}, Retenido: $${retenido.toFixed(2)}`);
    });
    
    // 2. Aplicar corrección
    console.log('\n🔧 APLICANDO CORRECCIÓN AUTOMÁTICA...');
    
    const transaction = await sequelize.transaction();
    
    try {
      // Corregir valor_pendiente para que sea matemáticamente correcto
      const [updateResult] = await sequelize.query(`
        UPDATE documentos 
        SET valor_pendiente = GREATEST(0, valor_factura - valor_pagado - COALESCE(valor_retenido, 0))
        WHERE estado NOT IN ('eliminado', 'nota_credito')
        AND numero_factura IS NOT NULL
        AND ABS(valor_factura - valor_pagado - valor_pendiente) > 0.01
      `, {
        transaction,
        type: sequelize.QueryTypes.UPDATE
      });
      
      console.log(`✅ Actualizados ${updateResult} documentos`);
      
      // 3. Verificar corrección
      const [verificacion] = await sequelize.query(`
        SELECT 
          COUNT(*) as total_docs,
          COALESCE(SUM(valor_factura), 0) as suma_facturado,
          COALESCE(SUM(valor_pagado), 0) as suma_pagado,
          COALESCE(SUM(valor_pendiente), 0) as suma_pendiente,
          COALESCE(SUM(valor_factura - valor_pagado), 0) as suma_calculada,
          COALESCE(SUM(ABS(valor_factura - valor_pagado - valor_pendiente)), 0) as suma_diferencias
        FROM documentos
        WHERE estado NOT IN ('eliminado', 'nota_credito')
        AND numero_factura IS NOT NULL
      `, {
        transaction,
        type: sequelize.QueryTypes.SELECT
      });
      
      const facturado = parseFloat(verificacion.suma_facturado);
      const pagado = parseFloat(verificacion.suma_pagado);
      const pendiente = parseFloat(verificacion.suma_pendiente);
      const calculado = parseFloat(verificacion.suma_calculada);
      const diferencias = parseFloat(verificacion.suma_diferencias);
      
      console.log('\n🧮 VERIFICACIÓN POST-CORRECCIÓN:');
      console.log(`💵 Suma facturado: $${facturado.toFixed(2)}`);
      console.log(`💚 Suma pagado: $${pagado.toFixed(2)}`);
      console.log(`🔴 Suma pendiente (corregida): $${pendiente.toFixed(2)}`);
      console.log(`🧮 Suma calculada: $${calculado.toFixed(2)}`);
      console.log(`⚠️  Suma diferencias: $${diferencias.toFixed(2)}`);
      console.log(`✅ Matemática global: ${Math.abs(calculado - pendiente) < 0.01 ? 'CORRECTA ✅' : 'INCORRECTA ❌'}`);
      
      if (Math.abs(calculado - pendiente) < 0.01) {
        await transaction.commit();
        console.log('\n🎉 CORRECCIÓN EXITOSA - Matemática perfecta lograda');
        
        // Mostrar documentos corregidos
        const documentosCorregidos = await sequelize.query(`
          SELECT 
            id,
            codigo_barras,
            valor_factura,
            valor_pagado,
            valor_pendiente,
            valor_retenido,
            estado_pago
          FROM documentos
          WHERE id IN (${documentosProblematicos.map(d => d.id).join(',')})
        `, {
          type: sequelize.QueryTypes.SELECT
        });
        
        console.log('\n📊 DOCUMENTOS CORREGIDOS:');
        documentosCorregidos.forEach(doc => {
          const factura = parseFloat(doc.valor_factura || 0);
          const pagado = parseFloat(doc.valor_pagado || 0);
          const pendiente = parseFloat(doc.valor_pendiente || 0);
          const retenido = parseFloat(doc.valor_retenido || 0);
          
          console.log(`  ✅ ID ${doc.id}: $${factura.toFixed(2)} - $${pagado.toFixed(2)} = $${pendiente.toFixed(2)} (retenido: $${retenido.toFixed(2)})`);
        });
        
      } else {
        await transaction.rollback();
        console.log('\n❌ CORRECCIÓN FALLÓ - Rollback aplicado');
      }
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error durante corrección:', error);
    }
    
  } catch (error) {
    console.error('❌ Error en corrección:', error);
  } finally {
    process.exit(0);
  }
}

corregirMatematicaDocumentos(); 