const { sequelize } = require('../config/database');
const Documento = require('../models/Documento');
const Matrizador = require('../models/Matrizador');

async function testRegistrarPago() {
  try {
    console.log('🧪 Probando funcionalidad de registrar pago...');
    
    // Test 1: Verificar documentos pendientes
    console.log('\n📊 Test 1: Consultando documentos pendientes...');
    const documentosPendientes = await Documento.findAll({
      where: {
        estadoPago: 'pendiente'
      },
      include: [
        {
          model: Matrizador,
          as: 'matrizador',
          attributes: ['id', 'nombre']
        }
      ],
      order: [['created_at', 'DESC']],
      limit: 5
    });
    
    console.log(`✅ Documentos pendientes encontrados: ${documentosPendientes.length}`);
    
    if (documentosPendientes.length > 0) {
      console.log('\n📋 Primeros documentos pendientes:');
      documentosPendientes.forEach((doc, index) => {
        console.log(`${index + 1}. ID: ${doc.id} | Cliente: ${doc.nombreCliente} | Estado: ${doc.estadoPago} | Valor: $${doc.valorFactura}`);
      });
    } else {
      console.log('⚠️  No hay documentos pendientes de pago');
    }
    
    // Test 2: Verificar estructura de campos
    console.log('\n📊 Test 2: Verificando campos de pago...');
    const [campos] = await sequelize.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'documentos' 
      AND column_name IN ('estado_pago', 'valor_pagado', 'valor_pendiente')
      ORDER BY column_name
    `);
    
    console.log('✅ Campos de pago en base de datos:');
    campos.forEach(campo => {
      console.log(`   - ${campo.column_name}: ${campo.data_type}`);
    });
    
    // Test 3: Verificar estados de pago existentes
    console.log('\n📊 Test 3: Verificando estados de pago...');
    const [estados] = await sequelize.query(`
      SELECT estado_pago, COUNT(*) as cantidad
      FROM documentos 
      WHERE numero_factura IS NOT NULL
      GROUP BY estado_pago
      ORDER BY cantidad DESC
    `);
    
    console.log('✅ Estados de pago en sistema:');
    estados.forEach(estado => {
      console.log(`   - ${estado.estado_pago}: ${estado.cantidad} documentos`);
    });
    
    console.log('\n🎉 Testing completado exitosamente!');
    
  } catch (error) {
    console.error('❌ Error durante el testing:', error);
  } finally {
    await sequelize.close();
  }
}

testRegistrarPago(); 