require('./models/index');
const { sequelize } = require('./config/database');
const Documento = require('./models/Documento');

async function corregirTodosDocumentosFechaNula() {
  try {
    console.log('🔧 CORRECCIÓN MASIVA DE DOCUMENTOS CON fechaFactura NULL');
    console.log('='.repeat(60));
    
    // Buscar TODOS los documentos con fechaFactura null
    const documentosConFechaNula = await Documento.findAll({
      where: {
        fechaFactura: null
      },
      order: [['id', 'ASC']]
    });
    
    console.log(`📊 Encontrados ${documentosConFechaNula.length} documentos con fechaFactura NULL`);
    
    if (documentosConFechaNula.length === 0) {
      console.log('✅ No hay documentos que corregir');
      await sequelize.close();
      return;
    }
    
    console.log('\n📋 DOCUMENTOS A CORREGIR:');
    documentosConFechaNula.forEach((doc, index) => {
      console.log(`${index + 1}. ID ${doc.id}: ${doc.codigoBarras} | Cliente: ${doc.nombreCliente} | Creado: ${doc.created_at}`);
    });
    
    console.log('\n🔄 INICIANDO CORRECCIÓN MASIVA...');
    
    let corregidos = 0;
    let errores = 0;
    
    for (const doc of documentosConFechaNula) {
      try {
        // Usar la fecha de creación como fecha de factura (solo la fecha, sin hora)
        const fechaCreacion = new Date(doc.created_at);
        const fechaFacturaCorrecta = fechaCreacion.toISOString().split('T')[0];
        
        await doc.update({
          fechaFactura: fechaFacturaCorrecta
        });
        
        console.log(`✅ ID ${doc.id}: ${doc.fechaFactura} (antes: null) -> ${fechaFacturaCorrecta}`);
        corregidos++;
        
      } catch (error) {
        console.error(`❌ Error corrigiendo ID ${doc.id}:`, error.message);
        errores++;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DE CORRECCIÓN:');
    console.log(`   ✅ Documentos corregidos: ${corregidos}`);
    console.log(`   ❌ Errores: ${errores}`);
    console.log(`   📋 Total procesados: ${documentosConFechaNula.length}`);
    
    if (corregidos > 0) {
      console.log('\n🎯 VERIFICACIÓN FINAL:');
      
      // Verificar que no queden documentos con fecha null
      const documentosRestantes = await Documento.count({
        where: {
          fechaFactura: null
        }
      });
      
      console.log(`   📊 Documentos con fechaFactura NULL restantes: ${documentosRestantes}`);
      
      if (documentosRestantes === 0) {
        console.log('   ✅ TODOS los documentos han sido corregidos exitosamente');
      } else {
        console.log('   ⚠️ Aún quedan documentos sin corregir');
      }
    }
    
    await sequelize.close();
    
  } catch (error) {
    console.error('❌ Error en corrección masiva:', error);
    await sequelize.close();
  }
}

corregirTodosDocumentosFechaNula(); 