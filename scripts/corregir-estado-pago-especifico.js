/**
 * Script de corrección inmediata para documento específico
 * PROBLEMA: Pago registrado pero estadoPago no actualizado
 * SOLUCIÓN: Actualizar SOLO estadoPago (NO tocar estado general)
 * 
 * Ejecutar con: node scripts/corregir-estado-pago-especifico.js
 */

const { sequelize } = require('../config/database');
const Documento = require('../models/Documento');
const Pago = require('../models/Pago');

async function corregirEstadoPagoEspecifico() {
    try {
        console.log('🔧 INICIANDO CORRECCIÓN DE ESTADO DE PAGO...');
        console.log('='.repeat(60));
        
        // Buscar documento específico
        const documento = await Documento.findOne({
            where: { codigoBarras: '20251701018C00923' }
        });
        
        if (!documento) {
            throw new Error('❌ Documento no encontrado');
        }
        
        console.log('📋 ESTADO ANTES DE CORRECCIÓN:');
        console.log('- Código de Barras:', documento.codigoBarras);
        console.log('- Estado General:', documento.estado, '← NO debe cambiar');
        console.log('- Estado de Pago:', documento.estadoPago, '← DEBE cambiar');
        console.log('- Valor Factura:', documento.valorFactura);
        console.log('- Valor Pagado:', documento.valorPagado);
        console.log('- Valor Retenido:', documento.valorRetenido);
        console.log('- Valor Pendiente:', documento.valorPendiente);
        console.log('- Tiene Retención:', documento.tieneRetencion);
        
        // Verificar pagos registrados en tabla pagos
        const pagos = await Pago.findAll({
            where: { documentoId: documento.id },
            order: [['fechaPago', 'ASC']]
        });
        
        console.log('\n💰 PAGOS REGISTRADOS EN HISTORIAL:');
        if (pagos.length === 0) {
            console.log('❌ No se encontraron pagos registrados');
            return;
        }
        
        pagos.forEach((pago, index) => {
            console.log(`${index + 1}. Monto: $${pago.monto} | Forma: ${pago.formaPago} | Es Retención: ${pago.esRetencion} | Fecha: ${pago.fechaPago}`);
        });
        
        // Calcular totales reales
        const pagoEfectivo = pagos.filter(p => !p.esRetencion).reduce((sum, pago) => sum + parseFloat(pago.monto), 0);
        const pagoRetencion = pagos.filter(p => p.esRetencion).reduce((sum, pago) => sum + parseFloat(pago.monto), 0);
        const totalPagado = pagoEfectivo + pagoRetencion;
        const pendiente = parseFloat(documento.valorFactura) - totalPagado;
        const tieneRetencion = pagos.some(pago => pago.esRetencion === true);
        
        console.log('\n📊 ANÁLISIS FINANCIERO:');
        console.log('- Valor Factura:', documento.valorFactura);
        console.log('- Pago Efectivo:', pagoEfectivo);
        console.log('- Pago Retención:', pagoRetencion);
        console.log('- Total Pagado:', totalPagado);
        console.log('- Pendiente:', pendiente);
        console.log('- Tiene Retención:', tieneRetencion);
        
        // Determinar estado de pago correcto
        let estadoPagoCorrector = 'pendiente';
        if (Math.abs(pendiente) <= 0.01) { // Considerar diferencias mínimas por redondeo
            estadoPagoCorrector = tieneRetencion ? 'pagado_con_retencion' : 'pagado_completo';
        } else if (totalPagado > 0) {
            estadoPagoCorrector = 'pago_parcial';
        }
        
        console.log('\n🎯 DETERMINACIÓN DE ESTADO:');
        console.log('- Estado de Pago Actual:', documento.estadoPago);
        console.log('- Estado de Pago Correcto:', estadoPagoCorrector);
        console.log('- Razón:', pendiente <= 0.01 ? 
            (tieneRetencion ? 'Pagado completo con retención' : 'Pagado completo sin retención') :
            (totalPagado > 0 ? 'Pago parcial' : 'Sin pagos')
        );
        
        // ACTUALIZAR SOLO ESTADO DE PAGO (NO tocar estado general)
        console.log('\n🔄 APLICANDO CORRECCIÓN...');
        
        const datosActualizacion = {
            // ✅ CAMPOS QUE SÍ actualizamos (responsabilidad de CAJA):
            estadoPago: estadoPagoCorrector,
            valorPagado: totalPagado,
            valorRetenido: pagoRetencion,
            valorPendiente: Math.max(0, pendiente),
            tieneRetencion: tieneRetencion,
            fechaUltimoPago: new Date(),
            
            // ❌ NO tocar estos campos (responsabilidad de MATRIZADOR):
            // estado: NO CAMBIAR - solo matrizador lo maneja
        };
        
        console.log('📝 Datos a actualizar:', datosActualizacion);
        
        await documento.update(datosActualizacion);
        
        // Verificar resultado
        await documento.reload();
        
        console.log('\n✅ ESTADO DESPUÉS DE CORRECCIÓN:');
        console.log('- Estado General:', documento.estado, '← Sin cambios (correcto)');
        console.log('- Estado de Pago:', documento.estadoPago, '← Actualizado');
        console.log('- Valor Pagado:', documento.valorPagado);
        console.log('- Valor Retenido:', documento.valorRetenido);
        console.log('- Valor Pendiente:', documento.valorPendiente);
        console.log('- Tiene Retención:', documento.tieneRetencion);
        
        console.log('\n🎉 CORRECCIÓN COMPLETADA EXITOSAMENTE');
        console.log('='.repeat(60));
        
        return {
            success: true,
            mensaje: 'Estado de pago corregido exitosamente',
            antes: 'pendiente',
            despues: documento.estadoPago,
            estadoGeneral: documento.estado + ' (sin cambios - correcto)',
            totalPagado: totalPagado,
            tieneRetencion: tieneRetencion
        };
        
    } catch (error) {
        console.error('❌ ERROR CORRIGIENDO ESTADO DE PAGO:', error);
        throw error;
    } finally {
        await sequelize.close();
    }
}

// Ejecutar corrección inmediata
if (require.main === module) {
    corregirEstadoPagoEspecifico()
        .then(resultado => {
            console.log('\n🎯 RESULTADO FINAL:', resultado);
            process.exit(0);
        })
        .catch(error => {
            console.error('\n💥 ERROR FATAL:', error.message);
            process.exit(1);
        });
}

module.exports = { corregirEstadoPagoEspecifico }; 