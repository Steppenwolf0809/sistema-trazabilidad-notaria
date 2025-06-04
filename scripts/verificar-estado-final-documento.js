/**
 * Script de verificación final del documento
 * Confirma que el estado de pago está correcto y el flujo funciona
 * 
 * Ejecutar con: node scripts/verificar-estado-final-documento.js
 */

const { sequelize } = require('../config/database');
const Documento = require('../models/Documento');
const Pago = require('../models/Pago');
const EventoDocumento = require('../models/EventoDocumento');

async function verificarEstadoFinalDocumento() {
    try {
        console.log('🔍 VERIFICACIÓN FINAL DEL DOCUMENTO');
        console.log('='.repeat(60));
        
        // Buscar documento específico
        const documento = await Documento.findOne({
            where: { codigoBarras: '20251701018C00923' }
        });
        
        if (!documento) {
            throw new Error('❌ Documento no encontrado');
        }
        
        console.log('📄 INFORMACIÓN COMPLETA DEL DOCUMENTO:');
        console.log('- ID:', documento.id);
        console.log('- Código de Barras:', documento.codigoBarras);
        console.log('- Cliente:', documento.nombreCliente);
        console.log('- Tipo:', documento.tipoDocumento);
        console.log('');
        
        console.log('🏷️ ESTADOS ACTUALES:');
        console.log('- Estado General:', documento.estado, '← Responsabilidad de MATRIZADOR');
        console.log('- Estado de Pago:', documento.estadoPago, '← Responsabilidad de CAJA');
        console.log('');
        
        console.log('💰 INFORMACIÓN FINANCIERA:');
        console.log('- Valor Factura:', `$${documento.valorFactura}`);
        console.log('- Valor Pagado:', `$${documento.valorPagado}`);
        console.log('- Valor Retenido:', `$${documento.valorRetenido}`);
        console.log('- Valor Pendiente:', `$${documento.valorPendiente}`);
        console.log('- Tiene Retención:', documento.tieneRetencion);
        console.log('');
        
        // Verificar pagos registrados
        const pagos = await Pago.findAll({
            where: { documentoId: documento.id },
            order: [['fechaPago', 'ASC']]
        });
        
        console.log('📋 HISTORIAL DE PAGOS:');
        if (pagos.length === 0) {
            console.log('❌ No hay pagos registrados');
        } else {
            pagos.forEach((pago, index) => {
                console.log(`${index + 1}. $${pago.monto} via ${pago.formaPago} ${pago.esRetencion ? '(RETENCIÓN)' : '(EFECTIVO)'}`);
                console.log(`   Fecha: ${pago.fechaPago}`);
                console.log(`   Comprobante: ${pago.numeroComprobante || 'N/A'}`);
            });
        }
        console.log('');
        
        // Verificar eventos del documento
        const eventos = await EventoDocumento.findAll({
            where: { idDocumento: documento.id },
            order: [['created_at', 'DESC']],
            limit: 5
        });
        
        console.log('📝 ÚLTIMOS EVENTOS:');
        eventos.forEach((evento, index) => {
            console.log(`${index + 1}. [${evento.tipo.toUpperCase()}] ${evento.detalles}`);
            console.log(`   Usuario: ${evento.usuario} | Fecha: ${evento.created_at}`);
        });
        console.log('');
        
        // Validación del flujo según README
        console.log('✅ VALIDACIÓN DEL FLUJO SEGÚN README:');
        
        // 1. Verificar que CAJA manejó correctamente el pago
        const pagoCorrectoEnCaja = documento.estadoPago === 'pagado_con_retencion' && 
                                   parseFloat(documento.valorPendiente) <= 0.01 && 
                                   documento.tieneRetencion === true;
        
        console.log('1. CAJA - Gestión de Pago:', pagoCorrectoEnCaja ? '✅ CORRECTO' : '❌ INCORRECTO');
        console.log(`   - Estado de pago: ${documento.estadoPago} (esperado: pagado_con_retencion)`);
        console.log(`   - Valor pendiente: $${documento.valorPendiente} (esperado: 0.00)`);
        console.log(`   - Tiene retención: ${documento.tieneRetencion} (esperado: true)`);
        
        // Debug adicional para la validación
        console.log('   🔍 Debug validación:');
        console.log(`     - estadoPago === 'pagado_con_retencion': ${documento.estadoPago === 'pagado_con_retencion'}`);
        console.log(`     - valorPendiente <= 0.01: ${parseFloat(documento.valorPendiente) <= 0.01} (valor: ${documento.valorPendiente})`);
        console.log(`     - tieneRetencion === true: ${documento.tieneRetencion === true}`);
        console.log('');
        
        // 2. Verificar que el estado general sigue siendo responsabilidad del MATRIZADOR
        const estadoGeneralCorrecto = documento.estado === 'en_proceso';
        
        console.log('2. MATRIZADOR - Estado General:', estadoGeneralCorrecto ? '✅ CORRECTO' : '❌ INCORRECTO');
        console.log(`   - Estado: ${documento.estado} (esperado: en_proceso hasta que matrizador lo procese)`);
        console.log('   - Próximo paso: Matrizador debe cambiar a "listo_para_entrega"');
        console.log('');
        
        // 3. Verificar coherencia matemática
        const totalCalculado = parseFloat(documento.valorPagado) + parseFloat(documento.valorRetenido);
        const coherenciaMatematica = Math.abs(totalCalculado - parseFloat(documento.valorFactura)) < 0.01;
        
        console.log('3. COHERENCIA MATEMÁTICA:', coherenciaMatematica ? '✅ CORRECTO' : '❌ INCORRECTO');
        console.log(`   - Valor factura: $${documento.valorFactura}`);
        console.log(`   - Pagado + Retenido: $${totalCalculado.toFixed(2)}`);
        console.log(`   - Diferencia: $${Math.abs(totalCalculado - parseFloat(documento.valorFactura)).toFixed(2)}`);
        console.log('');
        
        // Resumen final
        const todoCorrector = pagoCorrectoEnCaja && estadoGeneralCorrecto && coherenciaMatematica;
        
        console.log('🎯 RESUMEN FINAL:');
        console.log('='.repeat(40));
        if (todoCorrector) {
            console.log('🎉 ¡SISTEMA FUNCIONANDO CORRECTAMENTE!');
            console.log('');
            console.log('✅ Estado actual: CAJA completó su trabajo');
            console.log('✅ Pago registrado: $1.61 efectivo + $0.45 retención = $2.06 total');
            console.log('✅ Estado de pago: pagado_con_retencion');
            console.log('✅ Estado general: en_proceso (esperando a matrizador)');
            console.log('');
            console.log('📋 PRÓXIMOS PASOS EN EL FLUJO:');
            console.log('1. MATRIZADOR: Procesar documento → cambiar a "listo_para_entrega"');
            console.log('2. SISTEMA: Enviar notificación automática al cliente');
            console.log('3. RECEPCIÓN: Entregar documento → cambiar a "entregado"');
        } else {
            console.log('❌ HAY PROBLEMAS QUE CORREGIR');
            if (!pagoCorrectoEnCaja) console.log('- Problema en gestión de pago por CAJA');
            if (!estadoGeneralCorrecto) console.log('- Problema en estado general');
            if (!coherenciaMatematica) console.log('- Problema en coherencia matemática');
        }
        
        return {
            success: todoCorrector,
            documento: {
                codigoBarras: documento.codigoBarras,
                estadoGeneral: documento.estado,
                estadoPago: documento.estadoPago,
                valorFactura: documento.valorFactura,
                valorPagado: documento.valorPagado,
                valorRetenido: documento.valorRetenido,
                valorPendiente: documento.valorPendiente
            },
            validaciones: {
                pagoCorrectoEnCaja,
                estadoGeneralCorrecto,
                coherenciaMatematica
            },
            proximoPaso: estadoGeneralCorrecto ? 'Matrizador debe procesar documento' : 'Revisar estado general'
        };
        
    } catch (error) {
        console.error('❌ ERROR EN VERIFICACIÓN:', error);
        throw error;
    } finally {
        await sequelize.close();
    }
}

// Ejecutar verificación
if (require.main === module) {
    verificarEstadoFinalDocumento()
        .then(resultado => {
            console.log('\n📊 RESULTADO DE VERIFICACIÓN:', resultado.success ? 'EXITOSO' : 'CON PROBLEMAS');
            process.exit(resultado.success ? 0 : 1);
        })
        .catch(error => {
            console.error('\n💥 ERROR FATAL:', error.message);
            process.exit(1);
        });
}

module.exports = { verificarEstadoFinalDocumento }; 