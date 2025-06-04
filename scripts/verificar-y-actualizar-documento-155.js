/**
 * Script para verificar y actualizar el documento 155 si es necesario
 * Ejecutar con: node scripts/verificar-y-actualizar-documento-155.js
 */

const { sequelize } = require('../config/database');
const Documento = require('../models/Documento');

async function verificarYActualizar() {
  try {
    console.log('🔍 VERIFICANDO Y ACTUALIZANDO DOCUMENTO 155');
    console.log('='.repeat(60));
    
    await sequelize.authenticate();
    const doc = await Documento.findByPk(155);
    
    if (!doc) {
      console.log('❌ Documento 155 no encontrado');
      return;
    }
    
    console.log('📄 ESTADO ACTUAL:');
    console.log('- Valor Factura:', doc.valorFactura);
    console.log('- Valor Pagado:', doc.valorPagado);
    console.log('- Valor Retenido:', doc.valorRetenido);
    console.log('- Valor Pendiente:', doc.valorPendiente);
    console.log('- Estado Pago:', doc.estadoPago);
    console.log('- Tiene Retención:', doc.tieneRetencion);
    console.log('- Fecha Último Pago:', doc.fechaUltimoPago);
    console.log('');
    
    // Verificar si los valores son correctos
    const valorFactura = parseFloat(doc.valorFactura || 0);
    const valorPagado = parseFloat(doc.valorPagado || 0);
    const valorRetenido = parseFloat(doc.valorRetenido || 0);
    const valorPendiente = parseFloat(doc.valorPendiente || 0);
    
    const totalCubierto = valorPagado + valorRetenido;
    const pendienteCalculado = valorFactura - totalCubierto;
    
    console.log('🧮 ANÁLISIS:');
    console.log('- Total Cubierto:', totalCubierto);
    console.log('- Pendiente Calculado:', pendienteCalculado);
    console.log('- Pendiente en BD:', valorPendiente);
    
    // Determinar estado esperado
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
    
    // Verificar si necesita actualización
    const necesitaActualizacion = 
      Math.abs(pendienteCalculado - valorPendiente) > 0.01 ||
      estadoEsperado !== doc.estadoPago;
    
    if (necesitaActualizacion) {
      console.log('');
      console.log('⚠️ EL DOCUMENTO NECESITA ACTUALIZACIÓN');
      console.log('🔧 Aplicando correcciones...');
      
      await doc.update({
        valorPendiente: Math.max(0, pendienteCalculado),
        estadoPago: estadoEsperado,
        tieneRetencion: valorRetenido > 0
      });
      
      console.log('✅ Documento actualizado correctamente');
      
      // Verificar actualización
      await doc.reload();
      console.log('');
      console.log('📄 ESTADO DESPUÉS DE ACTUALIZACIÓN:');
      console.log('- Valor Pendiente:', doc.valorPendiente);
      console.log('- Estado Pago:', doc.estadoPago);
      console.log('- Tiene Retención:', doc.tieneRetencion);
      
    } else {
      console.log('');
      console.log('✅ EL DOCUMENTO ESTÁ CORRECTO - NO NECESITA ACTUALIZACIÓN');
    }
    
    // Verificar pagos registrados
    try {
      const { default: Pago } = await import('../models/Pago.js');
      const pagos = await Pago.findAll({ 
        where: { documentoId: 155 },
        order: [['fechaPago', 'DESC']]
      });
      
      console.log('');
      console.log('💰 PAGOS REGISTRADOS:', pagos.length);
      if (pagos.length > 0) {
        let totalPagos = 0;
        let totalRetenciones = 0;
        
        pagos.forEach((pago, i) => {
          console.log(`  Pago ${i+1}:`);
          console.log(`    - Monto: $${pago.monto}`);
          console.log(`    - Tipo: ${pago.esRetencion ? 'Retención' : 'Efectivo'}`);
          console.log(`    - Forma: ${pago.formaPago}`);
          console.log(`    - Fecha: ${pago.fechaPago}`);
          
          if (pago.esRetencion) {
            totalRetenciones += parseFloat(pago.monto);
          } else {
            totalPagos += parseFloat(pago.monto);
          }
        });
        
        console.log('');
        console.log('📊 RESUMEN DE PAGOS:');
        console.log('- Total Pagos Efectivos:', totalPagos.toFixed(2));
        console.log('- Total Retenciones:', totalRetenciones.toFixed(2));
        console.log('- Total General:', (totalPagos + totalRetenciones).toFixed(2));
        
        // Verificar consistencia con documento
        if (Math.abs(totalPagos - valorPagado) > 0.01) {
          console.log('⚠️ INCONSISTENCIA: Total pagos efectivos no coincide con valorPagado del documento');
        }
        
        if (Math.abs(totalRetenciones - valorRetenido) > 0.01) {
          console.log('⚠️ INCONSISTENCIA: Total retenciones no coincide con valorRetenido del documento');
        }
      }
    } catch (error) {
      console.log('⚠️ Error consultando pagos:', error.message);
    }
    
    console.log('');
    console.log('🎯 RECOMENDACIONES PARA EL FRONTEND:');
    console.log('1. Actualizar la página del documento (Ctrl+F5)');
    console.log('2. Verificar que aparezca el mensaje de éxito');
    console.log('3. Comprobar que el estado sea "pagado_con_retencion"');
    console.log('4. Verificar que el documento NO aparezca en la lista de pendientes');
    console.log('5. Confirmar que aparezca en la lista de pagos registrados');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

verificarYActualizar(); 