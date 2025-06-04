/**
 * Script para verificar el estado actual del documento 155
 * Ejecutar con: node scripts/verificar-estado-documento-155.js
 */

const { sequelize } = require('../config/database');
const Documento = require('../models/Documento');

async function verificarDocumento() {
  try {
    console.log('🔍 VERIFICANDO ESTADO DEL DOCUMENTO 155');
    console.log('='.repeat(60));
    
    await sequelize.authenticate();
    const doc = await Documento.findByPk(155);
    
    if (!doc) {
      console.log('❌ Documento 155 no encontrado');
      return;
    }
    
    console.log('📄 ESTADO ACTUAL DEL DOCUMENTO 155:');
    console.log('- ID:', doc.id);
    console.log('- Código Barras:', doc.codigoBarras);
    console.log('- Cliente:', doc.nombreCliente);
    console.log('- Valor Factura:', doc.valorFactura);
    console.log('- Valor Pagado:', doc.valorPagado);
    console.log('- Valor Retenido:', doc.valorRetenido);
    console.log('- Valor Pendiente:', doc.valorPendiente);
    console.log('- Estado Pago:', doc.estadoPago);
    console.log('- Tiene Retención:', doc.tieneRetencion);
    console.log('- Fecha Último Pago:', doc.fechaUltimoPago);
    console.log('- Número Comprobante Retención:', doc.numeroComprobanteRetencion);
    console.log('- Razón Social Retenedora:', doc.razonSocialRetenedora);
    console.log('');
    
    // Verificar si hay pagos registrados
    try {
      const { default: Pago } = await import('../models/Pago.js');
      const pagos = await Pago.findAll({ 
        where: { documentoId: 155 },
        order: [['fechaPago', 'DESC']]
      });
      
      console.log('💰 PAGOS REGISTRADOS:', pagos.length);
      if (pagos.length > 0) {
        pagos.forEach((pago, i) => {
          console.log(`  Pago ${i+1}:`);
          console.log(`    - ID: ${pago.id}`);
          console.log(`    - Monto: $${pago.monto}`);
          console.log(`    - Forma: ${pago.formaPago}`);
          console.log(`    - Fecha: ${pago.fechaPago}`);
          console.log(`    - Usuario: ${pago.usuarioRegistro}`);
          console.log('');
        });
      } else {
        console.log('  No hay pagos registrados');
      }
    } catch (error) {
      console.log('⚠️ Error al consultar pagos:', error.message);
    }
    
    // Análisis de consistencia
    console.log('🔍 ANÁLISIS DE CONSISTENCIA:');
    console.log('-'.repeat(40));
    
    const valorFactura = parseFloat(doc.valorFactura || 0);
    const valorPagado = parseFloat(doc.valorPagado || 0);
    const valorRetenido = parseFloat(doc.valorRetenido || 0);
    const valorPendiente = parseFloat(doc.valorPendiente || 0);
    
    const totalCubierto = valorPagado + valorRetenido;
    const pendienteCalculado = valorFactura - totalCubierto;
    
    console.log('- Valor Factura:', valorFactura);
    console.log('- Total Cubierto (Pagado + Retenido):', totalCubierto);
    console.log('- Pendiente Calculado:', pendienteCalculado);
    console.log('- Pendiente en BD:', valorPendiente);
    
    if (Math.abs(pendienteCalculado - valorPendiente) > 0.01) {
      console.log('❌ INCONSISTENCIA: Valor pendiente en BD no coincide con el calculado');
    } else {
      console.log('✅ CONSISTENCIA: Valores son coherentes');
    }
    
    // Estado esperado
    console.log('');
    console.log('🎯 ESTADO ESPERADO VS ACTUAL:');
    console.log('-'.repeat(40));
    
    let estadoEsperado;
    if (pendienteCalculado <= 0.01) {
      if (valorRetenido > 0) {
        estadoEsperado = 'pagado_con_retencion';
      } else {
        estadoEsperado = 'pagado_completo';
      }
    } else if (totalCubierto > 0) {
      estadoEsperado = 'pago_parcial';
    } else {
      estadoEsperado = 'pendiente';
    }
    
    console.log('- Estado Esperado:', estadoEsperado);
    console.log('- Estado Actual:', doc.estadoPago);
    
    if (estadoEsperado === doc.estadoPago) {
      console.log('✅ ESTADO CORRECTO');
    } else {
      console.log('❌ ESTADO INCORRECTO');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

verificarDocumento(); 