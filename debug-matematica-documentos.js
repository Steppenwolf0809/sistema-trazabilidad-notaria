const { sequelize } = require('./config/database');

async function debugMatematicaDocumentos() {
  try {
    console.log('🔍 DEBUGGING MATEMÁTICA POR DOCUMENTO\n');
    
    // Verificar cada documento individualmente
    const documentos = await sequelize.query(`
      SELECT 
        id,
        codigo_barras,
        nombre_cliente,
        valor_factura,
        valor_pagado,
        valor_pendiente,
        estado_pago,
        (valor_factura - valor_pagado) as calculado_pendiente,
        (valor_factura - valor_pagado - valor_pendiente) as diferencia
      FROM documentos
      WHERE estado NOT IN ('eliminado', 'nota_credito')
      AND numero_factura IS NOT NULL
      ORDER BY ABS(valor_factura - valor_pagado - valor_pendiente) DESC
    `, {
      type: sequelize.QueryTypes.SELECT
    });
    
    console.log('📊 ANÁLISIS DOCUMENTO POR DOCUMENTO:');
    console.log('ID | Código | Cliente | Factura | Pagado | Pendiente | Calculado | Diferencia | Estado');
    console.log('---|--------|---------|---------|--------|-----------|-----------|------------|-------');
    
    let totalDiferencias = 0;
    let documentosProblematicos = 0;
    
    documentos.forEach(doc => {
      const factura = parseFloat(doc.valor_factura || 0);
      const pagado = parseFloat(doc.valor_pagado || 0);
      const pendiente = parseFloat(doc.valor_pendiente || 0);
      const calculado = factura - pagado;
      const diferencia = Math.abs(calculado - pendiente);
      
      if (diferencia > 0.01) {
        documentosProblematicos++;
        totalDiferencias += diferencia;
        console.log(`${doc.id} | ${doc.codigo_barras} | ${doc.nombre_cliente?.substring(0, 15)}... | $${factura.toFixed(2)} | $${pagado.toFixed(2)} | $${pendiente.toFixed(2)} | $${calculado.toFixed(2)} | $${diferencia.toFixed(2)} | ${doc.estado_pago}`);
      }
    });
    
    if (documentosProblematicos === 0) {
      console.log('✅ TODOS LOS DOCUMENTOS TIENEN MATEMÁTICA CORRECTA');
    } else {
      console.log(`\n❌ ENCONTRADOS ${documentosProblematicos} DOCUMENTOS CON PROBLEMAS MATEMÁTICOS`);
      console.log(`💰 Diferencia total acumulada: $${totalDiferencias.toFixed(2)}`);
    }
    
    // Verificar totales globales
    console.log('\n🧮 VERIFICACIÓN DE TOTALES GLOBALES:');
    
    const [totales] = await sequelize.query(`
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
      type: sequelize.QueryTypes.SELECT
    });
    
    const facturado = parseFloat(totales.suma_facturado);
    const pagado = parseFloat(totales.suma_pagado);
    const pendiente = parseFloat(totales.suma_pendiente);
    const calculado = parseFloat(totales.suma_calculada);
    const diferencias = parseFloat(totales.suma_diferencias);
    
    console.log(`📊 Total documentos: ${totales.total_docs}`);
    console.log(`💵 Suma facturado: $${facturado.toFixed(2)}`);
    console.log(`💚 Suma pagado: $${pagado.toFixed(2)}`);
    console.log(`🔴 Suma pendiente (DB): $${pendiente.toFixed(2)}`);
    console.log(`🧮 Suma calculada: $${calculado.toFixed(2)}`);
    console.log(`⚠️  Suma diferencias: $${diferencias.toFixed(2)}`);
    console.log(`✅ Matemática global: ${Math.abs(calculado - pendiente) < 0.01 ? 'CORRECTA' : 'INCORRECTA'}`);
    
    if (Math.abs(calculado - pendiente) >= 0.01) {
      console.log(`❌ Diferencia global: $${Math.abs(calculado - pendiente).toFixed(2)}`);
      
      // Proponer corrección automática
      console.log('\n🔧 PROPUESTA DE CORRECCIÓN AUTOMÁTICA:');
      console.log('Se puede ejecutar un UPDATE para corregir valor_pendiente en todos los documentos:');
      console.log('UPDATE documentos SET valor_pendiente = valor_factura - valor_pagado WHERE ...');
    }
    
    // Verificar si hay documentos con valores NULL o negativos
    console.log('\n🔍 VERIFICACIÓN DE DATOS ANÓMALOS:');
    
    const [anomalos] = await sequelize.query(`
      SELECT 
        COUNT(CASE WHEN valor_factura IS NULL THEN 1 END) as factura_null,
        COUNT(CASE WHEN valor_pagado IS NULL THEN 1 END) as pagado_null,
        COUNT(CASE WHEN valor_pendiente IS NULL THEN 1 END) as pendiente_null,
        COUNT(CASE WHEN valor_factura < 0 THEN 1 END) as factura_negativa,
        COUNT(CASE WHEN valor_pagado < 0 THEN 1 END) as pagado_negativo,
        COUNT(CASE WHEN valor_pendiente < 0 THEN 1 END) as pendiente_negativo
      FROM documentos
      WHERE estado NOT IN ('eliminado', 'nota_credito')
    `, {
      type: sequelize.QueryTypes.SELECT
    });
    
    console.log(`📊 Valores NULL: factura=${anomalos.factura_null}, pagado=${anomalos.pagado_null}, pendiente=${anomalos.pendiente_null}`);
    console.log(`📊 Valores negativos: factura=${anomalos.factura_negativa}, pagado=${anomalos.pagado_negativo}, pendiente=${anomalos.pendiente_negativo}`);
    
  } catch (error) {
    console.error('❌ Error en debugging:', error);
  } finally {
    process.exit(0);
  }
}

debugMatematicaDocumentos(); 