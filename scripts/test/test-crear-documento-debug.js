const { sequelize } = require('./config/database');
const Documento = require('./models/Documento');
const Matrizador = require('./models/Matrizador');

async function testCrearDocumento() {
  try {
    console.log('🔍 INICIANDO TEST DE CREACIÓN DE DOCUMENTO...');
    
    // Buscar un matrizador de archivo
    const matrizadorArchivo = await Matrizador.findOne({
      where: { rol: 'archivo', activo: true }
    });
    
    if (!matrizadorArchivo) {
      console.log('❌ No se encontró matrizador de archivo');
      return;
    }
    
    console.log('👤 Matrizador encontrado:', matrizadorArchivo.nombre);
    
    // Simular datos como los que llegan del formulario
    const datosDocumento = {
      tipoDocumento: 'Protocolo',
      nombreCliente: 'Cliente de Prueba Debug',
      identificacionCliente: '1234567890',
      telefonoCliente: '0999999999',
      emailCliente: 'test@example.com',
      valorFactura: 50.00,
      observaciones: 'Documento de prueba para debugging'
    };
    
    // DEBUGGING: Log detallado de creación de documento
    const fechaFacturaGenerada = new Date().toISOString().split('T')[0];
    console.log('🔍 [TEST] CREANDO DOCUMENTO CON LOGS DETALLADOS:');
    console.log('   📅 fechaFactura generada:', fechaFacturaGenerada);
    console.log('   👤 Usuario:', matrizadorArchivo.nombre);
    console.log('   📋 Datos del documento:', {
      tipoDocumento: datosDocumento.tipoDocumento,
      clienteNombre: datosDocumento.nombreCliente,
      valorFactura: parseFloat(datosDocumento.valorFactura) || 0
    });

    // Crear el documento igual que en archivoController
    const nuevoDocumento = await Documento.create({
      tipoDocumento: datosDocumento.tipoDocumento,
      nombreCliente: datosDocumento.nombreCliente,
      identificacionCliente: datosDocumento.identificacionCliente,
      telefonoCliente: datosDocumento.telefonoCliente,
      emailCliente: datosDocumento.emailCliente,
      valorFactura: parseFloat(datosDocumento.valorFactura) || 0,
      valorPendiente: parseFloat(datosDocumento.valorFactura) || 0,
      fechaFactura: fechaFacturaGenerada, // CORREGIDO: Usar variable con log
      notas: datosDocumento.observaciones,
      estado: 'en_proceso',
      estadoPago: 'pendiente',
      idMatrizador: matrizadorArchivo.id,
      idUsuarioCreador: matrizadorArchivo.id,
      rolUsuarioCreador: 'archivo',
      codigoBarras: `TEST-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`
    });

    console.log('✅ [TEST] DOCUMENTO CREADO:');
    console.log('   🆔 ID:', nuevoDocumento.id);
    console.log('   📋 Código:', nuevoDocumento.codigoBarras);
    console.log('   📅 fechaFactura guardada:', nuevoDocumento.fechaFactura);
    console.log('   📅 fechaFactura tipo:', typeof nuevoDocumento.fechaFactura);
    
    // Verificar en base de datos
    const documentoVerificacion = await Documento.findByPk(nuevoDocumento.id, {
      raw: true
    });
    
    console.log('🔍 [VERIFICACIÓN] DOCUMENTO EN BD:');
    console.log('   🆔 ID:', documentoVerificacion.id);
    console.log('   📅 fecha_factura en BD:', documentoVerificacion.fecha_factura);
    console.log('   📅 fecha_factura tipo:', typeof documentoVerificacion.fecha_factura);
    console.log('   📅 created_at:', documentoVerificacion.created_at);
    
    await sequelize.close();
    
  } catch (error) {
    console.error('❌ ERROR EN TEST:', error);
    await sequelize.close();
  }
}

testCrearDocumento(); 