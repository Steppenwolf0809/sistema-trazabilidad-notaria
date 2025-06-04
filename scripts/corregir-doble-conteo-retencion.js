/**
 * Script para corregir el problema de doble conteo de retención
 * PROBLEMA: valorPagado incluye retención + valorRetenido también la incluye
 * SOLUCIÓN: Separar correctamente efectivo vs retención
 * 
 * Ejecutar con: node scripts/corregir-doble-conteo-retencion.js
 */

const { sequelize } = require('../config/database');
const Documento = require('../models/Documento');
const Pago = require('../models/Pago');

async function corregirDobleConteoRetencion() {
    try {
        console.log('🔧 CORRIGIENDO DOBLE CONTEO DE RETENCIÓN...');
        console.log('='.repeat(60));
        
        // Buscar documento específico
        const documento = await Documento.findOne({
            where: { codigoBarras: '20251701018C00923' }
        });
        
        if (!documento) {
            throw new Error('❌ Documento no encontrado');
        }
        
        console.log('📋 ESTADO ACTUAL (PROBLEMÁTICO):');
        console.log('- Valor Factura:', `$${documento.valorFactura}`);
        console.log('- Valor Pagado:', `$${documento.valorPagado}`, '← INCLUYE retención incorrectamente');
        console.log('- Valor Retenido:', `$${documento.valorRetenido}`, '← Retención contada por separado');
        console.log('- Valor Pendiente:', `$${documento.valorPendiente}`);
        console.log('- Total Calculado:', `$${(parseFloat(documento.valorPagado) + parseFloat(documento.valorRetenido)).toFixed(2)}`, '← EXCEDE factura');
        console.log('');
        
        // Obtener pagos reales de la tabla pagos
        const pagos = await Pago.findAll({
            where: { documentoId: documento.id },
            order: [['fechaPago', 'ASC']]
        });
        
        console.log('💰 PAGOS REALES EN HISTORIAL:');
        let pagoEfectivoReal = 0;
        let pagoRetencionReal = 0;
        
        pagos.forEach((pago, index) => {
            const monto = parseFloat(pago.monto);
            console.log(`${index + 1}. $${monto} via ${pago.formaPago} ${pago.esRetencion ? '(RETENCIÓN)' : '(EFECTIVO)'}`);
            
            if (pago.esRetencion) {
                pagoRetencionReal += monto;
            } else {
                pagoEfectivoReal += monto;
            }
        });
        
        const totalReal = pagoEfectivoReal + pagoRetencionReal;
        const pendienteReal = parseFloat(documento.valorFactura) - totalReal;
        
        console.log('');
        console.log('📊 CÁLCULOS CORRECTOS BASADOS EN HISTORIAL:');
        console.log('- Pago Efectivo Real:', `$${pagoEfectivoReal.toFixed(2)}`);
        console.log('- Pago Retención Real:', `$${pagoRetencionReal.toFixed(2)}`);
        console.log('- Total Real:', `$${totalReal.toFixed(2)}`);
        console.log('- Pendiente Real:', `$${pendienteReal.toFixed(2)}`);
        console.log('');
        
        // Determinar estado de pago correcto
        let estadoPagoCorrector = 'pendiente';
        if (Math.abs(pendienteReal) <= 0.01) {
            estadoPagoCorrector = pagoRetencionReal > 0 ? 'pagado_con_retencion' : 'pagado_completo';
        } else if (totalReal > 0) {
            estadoPagoCorrector = 'pago_parcial';
        }
        
        console.log('🎯 CORRECCIÓN A APLICAR:');
        console.log('- Valor Pagado (solo efectivo):', `$${pagoEfectivoReal.toFixed(2)}`, '← CORREGIDO');
        console.log('- Valor Retenido (solo retención):', `$${pagoRetencionReal.toFixed(2)}`, '← CORREGIDO');
        console.log('- Valor Pendiente:', `$${Math.max(0, pendienteReal).toFixed(2)}`, '← CORREGIDO');
        console.log('- Estado de Pago:', estadoPagoCorrector, '← CORREGIDO');
        console.log('');
        
        // Aplicar corrección
        console.log('🔄 APLICANDO CORRECCIÓN...');
        
        const datosCorreccion = {
            valorPagado: parseFloat(pagoEfectivoReal.toFixed(2)),      // Solo efectivo
            valorRetenido: parseFloat(pagoRetencionReal.toFixed(2)),   // Solo retención
            valorPendiente: parseFloat(Math.max(0, pendienteReal).toFixed(2)),
            estadoPago: estadoPagoCorrector,
            tieneRetencion: pagoRetencionReal > 0,
            fechaUltimoPago: new Date()
        };
        
        console.log('📝 Datos de corrección:', datosCorreccion);
        
        await documento.update(datosCorreccion);
        
        // Verificar resultado
        await documento.reload();
        
        console.log('');
        console.log('✅ ESTADO DESPUÉS DE CORRECCIÓN:');
        console.log('- Valor Factura:', `$${documento.valorFactura}`);
        console.log('- Valor Pagado (solo efectivo):', `$${documento.valorPagado}`);
        console.log('- Valor Retenido (solo retención):', `$${documento.valorRetenido}`);
        console.log('- Valor Pendiente:', `$${documento.valorPendiente}`);
        console.log('- Estado de Pago:', documento.estadoPago);
        console.log('- Total Verificación:', `$${(parseFloat(documento.valorPagado) + parseFloat(documento.valorRetenido)).toFixed(2)}`);
        console.log('');
        
        // Validación final
        const totalFinal = parseFloat(documento.valorPagado) + parseFloat(documento.valorRetenido);
        const diferencia = Math.abs(totalFinal - parseFloat(documento.valorFactura));
        const coherenciaFinal = diferencia < 0.01;
        
        console.log('🔍 VALIDACIÓN FINAL:');
        console.log('- Coherencia Matemática:', coherenciaFinal ? '✅ CORRECTA' : '❌ INCORRECTA');
        console.log('- Diferencia:', `$${diferencia.toFixed(2)}`);
        console.log('- Estado de Pago:', documento.estadoPago === estadoPagoCorrector ? '✅ CORRECTO' : '❌ INCORRECTO');
        
        if (coherenciaFinal) {
            console.log('');
            console.log('🎉 ¡CORRECCIÓN EXITOSA!');
            console.log('✅ El documento ahora tiene coherencia matemática correcta');
            console.log('✅ Efectivo y retención están separados correctamente');
            console.log('✅ Estado de pago es correcto');
        }
        
        return {
            success: coherenciaFinal,
            antes: {
                valorPagado: parseFloat(documento.valorPagado) + parseFloat(documento.valorRetenido), // Era el total
                valorRetenido: documento.valorRetenido,
                problema: 'Doble conteo de retención'
            },
            despues: {
                valorPagado: documento.valorPagado,
                valorRetenido: documento.valorRetenido,
                estadoPago: documento.estadoPago,
                coherencia: coherenciaFinal
            }
        };
        
    } catch (error) {
        console.error('❌ ERROR CORRIGIENDO DOBLE CONTEO:', error);
        throw error;
    } finally {
        await sequelize.close();
    }
}

// Ejecutar corrección
if (require.main === module) {
    corregirDobleConteoRetencion()
        .then(resultado => {
            console.log('\n🎯 RESULTADO FINAL:', resultado.success ? 'EXITOSO' : 'CON PROBLEMAS');
            process.exit(resultado.success ? 0 : 1);
        })
        .catch(error => {
            console.error('\n💥 ERROR FATAL:', error.message);
            process.exit(1);
        });
}

module.exports = { corregirDobleConteoRetencion }; 