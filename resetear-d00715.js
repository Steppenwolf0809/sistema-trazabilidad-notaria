const { Documento } = require('./models');

async function resetearDocumento() {
  try {
    console.log('🔄 Verificando estado actual del documento D00715...');
    
    // Primero verificar estado actual
    const documento = await Documento.findOne({
      where: {
        codigoBarras: '20251701018D00715'
      },
      attributes: [
        'id', 'codigoBarras', 'estado', 'fechaEntrega', 'nombreReceptor',
        'entrega_sin_verificar_pago', 'estadoPago'
      ]
    });
    
    if (!documento) {
      console.log('❌ Documento D00715 no encontrado');
      process.exit(1);
    }
    
    console.log('📋 Estado actual:');
    console.log(`   ID: ${documento.id}`);
    console.log(`   Código: ${documento.codigoBarras}`);
    console.log(`   Estado: ${documento.estado}`);
    console.log(`   Fecha entrega: ${documento.fechaEntrega || 'Sin fecha'}`);
    console.log(`   Receptor: ${documento.nombreReceptor || 'Sin receptor'}`);
    console.log(`   Autorizado: ${documento.entrega_sin_verificar_pago}`);
    console.log(`   Estado pago: ${documento.estadoPago}`);
    
    if (documento.estado === 'listo_para_entrega' && !documento.fechaEntrega) {
      console.log('✅ El documento ya está en estado correcto para entrega grupal');
      process.exit(0);
    }
    
    console.log('\n🔄 Reseteando documento a estado listo para entrega...');
    
    // Resetear documento
    await documento.update({
      estado: 'listo_para_entrega',
      fechaEntrega: null,
      nombreReceptor: null,
      identificacionReceptor: null,
      relacionReceptor: null
      // Mantener entrega_sin_verificar_pago = true para evitar problemas
    });
    
    console.log('✅ Documento D00715 reseteado exitosamente');
    console.log('');
    console.log('📋 Estado nuevo:');
    console.log('   Estado: listo_para_entrega');
    console.log('   Fecha entrega: null');
    console.log('   Receptor: null');
    console.log('   Autorización: mantenida (true)');
    console.log('');
    console.log('🎯 ¡Ahora puedes hacer la entrega grupal de ambos documentos!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error reseteando documento:', error);
    process.exit(1);
  }
}

resetearDocumento(); 