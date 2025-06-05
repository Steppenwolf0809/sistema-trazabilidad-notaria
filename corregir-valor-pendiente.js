/**
 * Script de emergencia para corregir valores pendientes en documentos existentes
 * PROBLEMA: valorPendiente está en 0.00 cuando debería calcularse automáticamente
 * SOLUCIÓN: Recalcular valorPendiente = valorFactura - valorPagado - valorRetenido
 */

const { sequelize } = require('./config/database');
const Documento = require('./models/Documento');

async function corregirValoresPendientes() {
  try {
    console.log('🚨 INICIANDO CORRECCIÓN DE EMERGENCIA - VALORES PENDIENTES');
    console.log('=' .repeat(60));
    
    // Obtener todos los documentos que necesitan corrección
    const documentos = await Documento.findAll({
      where: {
        estado: {
          [require('sequelize').Op.notIn]: ['eliminado', 'nota_credito', 'cancelado']
        }
      },
      attributes: ['id', 'codigoBarras', 'valorFactura', 'valorPagado', 'valorRetenido', 'valorPendiente', 'estadoPago']
    });
    
    console.log(`📋 Documentos encontrados: ${documentos.length}`);
    
    let documentosCorregidos = 0;
    let documentosConProblemas = 0;
    
    for (const documento of documentos) {
      const valorFactura = parseFloat(documento.valorFactura) || 0;
      const valorPagado = parseFloat(documento.valorPagado) || 0;
      const valorRetenido = parseFloat(documento.valorRetenido) || 0;
      const valorPendienteActual = parseFloat(documento.valorPendiente) || 0;
      
      // Calcular valor pendiente correcto
      const valorPendienteCalculado = Math.max(0, valorFactura - valorPagado - valorRetenido);
      
      // Verificar si necesita corrección
      const diferencia = Math.abs(valorPendienteActual - valorPendienteCalculado);
      
      if (diferencia > 0.01) { // Diferencia mayor a 1 centavo
        console.log(`🔧 CORRIGIENDO Documento ${documento.codigoBarras}:`);
        console.log(`   Factura: $${valorFactura.toFixed(2)}`);
        console.log(`   Pagado: $${valorPagado.toFixed(2)}`);
        console.log(`   Retenido: $${valorRetenido.toFixed(2)}`);
        console.log(`   Pendiente actual: $${valorPendienteActual.toFixed(2)}`);
        console.log(`   Pendiente correcto: $${valorPendienteCalculado.toFixed(2)}`);
        
        try {
          // Actualizar el documento
          await documento.update({
            valorPendiente: valorPendienteCalculado
          });
          
          documentosCorregidos++;
          console.log(`   ✅ CORREGIDO`);
        } catch (error) {
          console.error(`   ❌ ERROR al corregir:`, error.message);
          documentosConProblemas++;
        }
        
        console.log('   ' + '-'.repeat(40));
      }
    }
    
    console.log('=' .repeat(60));
    console.log('📊 RESUMEN DE CORRECCIÓN:');
    console.log(`✅ Documentos corregidos: ${documentosCorregidos}`);
    console.log(`❌ Documentos con problemas: ${documentosConProblemas}`);
    console.log(`📋 Total procesados: ${documentos.length}`);
    
    if (documentosCorregidos > 0) {
      console.log('🎉 CORRECCIÓN COMPLETADA - Sistema de pagos restaurado');
    } else {
      console.log('ℹ️ No se encontraron documentos que requieran corrección');
    }
    
  } catch (error) {
    console.error('❌ ERROR CRÍTICO en corrección:', error);
    throw error;
  }
}

// Ejecutar corrección si se llama directamente
if (require.main === module) {
  corregirValoresPendientes()
    .then(() => {
      console.log('✅ Script de corrección completado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script de corrección falló:', error);
      process.exit(1);
    });
}

module.exports = { corregirValoresPendientes }; 