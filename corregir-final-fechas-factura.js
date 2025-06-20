const { sequelize } = require('./config/database');

async function corregirFinalFechasFactura() {
  try {
    console.log('🔧 CORRECCIÓN FINAL DE FECHAS DE FACTURA');
    console.log('==========================================');
    
    // 1. Verificar documentos con fechaFactura null
    const documentosNulos = await sequelize.query(`
      SELECT id, codigo_barras, created_at, fecha_factura 
      FROM documentos 
      WHERE fecha_factura IS NULL 
      ORDER BY id
    `, {
      type: sequelize.QueryTypes.SELECT
    });
    
    console.log(`📋 Documentos con fechaFactura NULL: ${documentosNulos.length}`);
    
    if (documentosNulos.length === 0) {
      console.log('✅ No hay documentos con fechaFactura NULL');
      await sequelize.close();
      return;
    }
    
    console.log('📄 Lista de documentos a corregir:');
    documentosNulos.forEach(doc => {
      const fechaCreacion = new Date(doc.created_at).toISOString().split('T')[0];
      console.log(`   ID: ${doc.id}, Código: ${doc.codigo_barras}, Created: ${fechaCreacion}`);
    });
    
    console.log('');
    console.log('🔄 Iniciando corrección...');
    
    // 2. Corregir cada documento usando su fecha de creación
    let corregidos = 0;
    
    for (const doc of documentosNulos) {
      const fechaCreacion = new Date(doc.created_at).toISOString().split('T')[0];
      
      console.log(`🔧 Corrigiendo documento ${doc.id}:`);
      console.log(`   - Código: ${doc.codigo_barras}`);
      console.log(`   - fechaFactura anterior: ${doc.fecha_factura}`);
      console.log(`   - fechaFactura nueva: ${fechaCreacion}`);
      
      // Actualizar usando SQL directo para asegurar que se guarde
      const [resultado] = await sequelize.query(`
        UPDATE documentos 
        SET fecha_factura = :fechaFactura 
        WHERE id = :id
      `, {
        replacements: { 
          fechaFactura: fechaCreacion, 
          id: doc.id 
        }
      });
      
      console.log(`   ✅ Actualizado (filas afectadas: ${resultado})`);
      corregidos++;
    }
    
    console.log('');
    console.log('🔍 VERIFICACIÓN FINAL:');
    console.log('======================');
    
    // 3. Verificar que la corrección funcionó
    const documentosNulosPostCorreccion = await sequelize.query(`
      SELECT COUNT(*) as total 
      FROM documentos 
      WHERE fecha_factura IS NULL
    `, {
      type: sequelize.QueryTypes.SELECT
    });
    
    const totalNulosRestantes = documentosNulosPostCorreccion[0].total;
    
    console.log(`📊 Documentos corregidos: ${corregidos}`);
    console.log(`📊 Documentos con fechaFactura NULL restantes: ${totalNulosRestantes}`);
    
    if (totalNulosRestantes == 0) {
      console.log('🎉 ¡CORRECCIÓN EXITOSA! Todos los documentos tienen fechaFactura válida');
    } else {
      console.log('⚠️ Aún quedan documentos con fechaFactura NULL');
    }
    
    // 4. Mostrar resumen de los últimos 10 documentos
    console.log('');
    console.log('📄 ÚLTIMOS 10 DOCUMENTOS (verificación):');
    console.log('=========================================');
    
    const ultimosDocumentos = await sequelize.query(`
      SELECT id, codigo_barras, fecha_factura, created_at 
      FROM documentos 
      ORDER BY id DESC 
      LIMIT 10
    `, {
      type: sequelize.QueryTypes.SELECT
    });
    
    ultimosDocumentos.forEach(doc => {
      const status = doc.fecha_factura ? '✅' : '❌';
      console.log(`   ${status} ID: ${doc.id}, Código: ${doc.codigo_barras}, fechaFactura: ${doc.fecha_factura}`);
    });
    
    await sequelize.close();
    
  } catch (error) {
    console.error('❌ ERROR EN CORRECCIÓN FINAL:', error);
    await sequelize.close();
  }
}

corregirFinalFechasFactura(); 