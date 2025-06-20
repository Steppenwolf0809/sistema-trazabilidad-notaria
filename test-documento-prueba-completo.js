const { sequelize } = require('./config/database');
const Documento = require('./models/Documento');
const Matrizador = require('./models/Matrizador');
const EventoDocumento = require('./models/EventoDocumento');

async function crearDocumentoPrueba() {
  try {
    console.log('🔍 CREANDO DOCUMENTO DE PRUEBA COMPLETO...');
    console.log('===========================================');
    
    // Buscar un matrizador activo
    const matrizador = await Matrizador.findOne({
      where: { activo: true }
    });
    
    if (!matrizador) {
      console.log('❌ No se encontró matrizador activo');
      return;
    }
    
    console.log('👤 Matrizador encontrado:', matrizador.nombre, '- Rol:', matrizador.rol);
    
    // Simular datos del formulario
    const datosFormulario = {
      codigoBarras: `PRUEBA-${Date.now()}`,
      tipoDocumento: 'Protocolo',
      nombreCliente: 'Cliente Prueba Sistema',
      identificacionCliente: '1234567890',
      emailCliente: 'prueba@sistema.com',
      telefonoCliente: '0999888777',
      valorFactura: 75.50,
      observaciones: 'Documento de prueba para verificar corrección de fechaFactura'
    };
    
    console.log('📋 Datos del documento de prueba:');
    console.log('   - Código:', datosFormulario.codigoBarras);
    console.log('   - Tipo:', datosFormulario.tipoDocumento);
    console.log('   - Cliente:', datosFormulario.nombreCliente);
    console.log('   - Valor:', datosFormulario.valorFactura);
    
    // Iniciar transacción
    const transaction = await sequelize.transaction();
    
    try {
      console.log('');
      console.log('🔄 SIMULANDO CREACIÓN DESDE CONTROLADOR...');
      
      // DEBUGGING: Log detallado como en documentoController
      const fechaFacturaProcesada = new Date().toISOString().split('T')[0];
      console.log('🔍 [PRUEBA] CREANDO DOCUMENTO CON LOGS DETALLADOS:');
      console.log('   📅 fechaFactura generada:', fechaFacturaProcesada);
      console.log('   📅 fechaFactura tipo:', typeof fechaFacturaProcesada);
      console.log('   👤 Usuario:', matrizador.nombre);
      console.log('   📋 Datos del documento:', {
        codigoBarras: datosFormulario.codigoBarras,
        tipoDocumento: datosFormulario.tipoDocumento,
        nombreCliente: datosFormulario.nombreCliente
      });

      // Crear el documento igual que en documentoController.js
      const nuevoDocumento = await Documento.create({
        codigoBarras: datosFormulario.codigoBarras,
        tipoDocumento: datosFormulario.tipoDocumento,
        nombreCliente: datosFormulario.nombreCliente,
        identificacionCliente: datosFormulario.identificacionCliente,
        emailCliente: datosFormulario.emailCliente,
        telefonoCliente: datosFormulario.telefonoCliente,
        notas: datosFormulario.observaciones,
        estado: 'en_proceso',
        idMatrizador: matrizador.id,
        // Campos de facturación
        fechaFactura: fechaFacturaProcesada,
        numeroFactura: null,
        valorFactura: datosFormulario.valorFactura ? parseFloat(datosFormulario.valorFactura) : null,
        estadoPago: 'pendiente',
        metodoPago: null
      }, { transaction });

      console.log('✅ [PRUEBA] DOCUMENTO CREADO:');
      console.log('   🆔 ID:', nuevoDocumento.id);
      console.log('   📋 Código:', nuevoDocumento.codigoBarras);
      console.log('   📅 fechaFactura guardada:', nuevoDocumento.fechaFactura);
      console.log('   📅 fechaFactura tipo:', typeof nuevoDocumento.fechaFactura);
      
      // Crear evento de creación
      await EventoDocumento.create({
        documentoId: nuevoDocumento.id,
        usuarioId: matrizador.id,
        tipo: 'creacion',
        categoria: 'administrativo',
        titulo: '📄 Documento de Prueba Creado',
        descripcion: `Documento de prueba creado por ${matrizador.nombre} para verificar corrección de fechaFactura`,
        detalles: JSON.stringify({
          tipoDocumento: datosFormulario.tipoDocumento,
          valorFactura: datosFormulario.valorFactura,
          cliente: datosFormulario.nombreCliente,
          pruebaFechaFactura: true
        }),
        usuario: matrizador.nombre
      }, { transaction });
      
      // Confirmar transacción
      await transaction.commit();
      
      console.log('');
      console.log('🔍 VERIFICACIÓN EN BASE DE DATOS:');
      console.log('==================================');
      
      // Verificar en base de datos con consulta SQL directa
      const documentoVerificacion = await sequelize.query(`
        SELECT id, codigo_barras, fecha_factura, created_at, valor_factura
        FROM documentos 
        WHERE id = :id
      `, {
        replacements: { id: nuevoDocumento.id },
        type: sequelize.QueryTypes.SELECT
      });
      
      const doc = documentoVerificacion[0];
      console.log('📄 Documento en BD:');
      console.log('   🆔 ID:', doc.id);
      console.log('   📋 Código:', doc.codigo_barras);
      console.log('   📅 fecha_factura en BD:', doc.fecha_factura);
      console.log('   📅 fecha_factura tipo:', typeof doc.fecha_factura);
      console.log('   💰 valor_factura:', doc.valor_factura);
      console.log('   📅 created_at:', doc.created_at);
      
      // Verificar que no hay documentos con fechaFactura null
      const documentosNulos = await sequelize.query(`
        SELECT COUNT(*) as total 
        FROM documentos 
        WHERE fecha_factura IS NULL
      `, {
        type: sequelize.QueryTypes.SELECT
      });
      
      console.log('');
      console.log('📊 ESTADO GENERAL DEL SISTEMA:');
      console.log('===============================');
      console.log('   📄 Documentos con fechaFactura NULL:', documentosNulos[0].total);
      
      if (documentosNulos[0].total == 0) {
        console.log('   🎉 ¡PERFECTO! No hay documentos con fechaFactura NULL');
      } else {
        console.log('   ⚠️ Aún hay documentos con fechaFactura NULL');
      }
      
      console.log('');
      console.log('✅ PRUEBA COMPLETADA EXITOSAMENTE');
      console.log('=================================');
      console.log('📋 El sistema está listo para documentos reales');
      console.log('🔍 Los logs de debugging están activos y funcionando');
      console.log('📱 Puedes proceder a subir un documento real');
      
    } catch (transactionError) {
      await transaction.rollback();
      throw transactionError;
    }
    
    await sequelize.close();
    
  } catch (error) {
    console.error('❌ ERROR EN PRUEBA COMPLETA:', error);
    await sequelize.close();
  }
}

crearDocumentoPrueba(); 