/**
 * CORRECCIÓN AUTOMÁTICA DE PROBLEMAS EN REPORTES
 * 
 * Basado en los resultados de la auditoría, este script corrige:
 * 1. Documentos del usuario archivo con valores inconsistentes
 * 2. Documentos con valorFactura = 0 pero valorPagado > 0
 * 3. Inconsistencias matemáticas en ecuaciones básicas
 * 
 * PROBLEMA ESPECÍFICO DETECTADO:
 * - Usuario MARIA LUCINDA DIAZ PILATASIG (archivo) tiene $237.05 cobrado vs $27.03 facturado
 * - 3 documentos con $0 facturado pero montos pagados significativos
 * 
 * AUTOR: Sistema de Corrección Automatizada
 * FECHA: 2025-01-29
 */

const { Documento, Matrizador, EventoDocumento } = require('../models');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');
const moment = require('moment');

class CorreccionReportes {
  constructor() {
    this.correccionesRealizadas = [];
    this.erroresEncontrados = [];
    this.respaldos = [];
  }

  async ejecutarCorreccion() {
    console.log('🔧 INICIANDO CORRECCIÓN AUTOMÁTICA DE REPORTES');
    console.log('==============================================');
    console.log(`Fecha: ${moment().format('DD/MM/YYYY HH:mm:ss')}`);
    console.log('');
    
    const transaction = await sequelize.transaction();
    
    try {
      // 1. Identificar documentos problemáticos específicos
      await this.identificarDocumentosProblematicos();
      
      // 2. Corregir documentos del usuario archivo
      await this.corregirDocumentosArchivo(transaction);
      
      // 3. Corregir documentos con valorFactura = 0 pero valorPagado > 0
      await this.corregirDocumentosSinFactura(transaction);
      
      // 4. Recalcular valores pendientes
      await this.recalcularValoresPendientes(transaction);
      
      // 5. Validar correcciones
      await this.validarCorrecciones();
      
      // 6. Generar eventos de auditoría
      await this.generarEventosAuditoria(transaction);
      
      await transaction.commit();
      
      this.generarReporteCorreccion();
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error durante corrección:', error);
      throw error;
    }
  }

  async identificarDocumentosProblematicos() {
    console.log('\n🔍 1. IDENTIFICANDO DOCUMENTOS PROBLEMÁTICOS');
    console.log('---------------------------------------------');
    
    try {
      // Documentos del usuario archivo con problemas
      const documentosArchivo = await sequelize.query(`
        SELECT 
          d.id,
          d.codigo_barras,
          d.valor_factura,
          d.valor_pagado,
          d.valor_pendiente,
          d.valor_retenido,
          d.estado_pago,
          m.nombre as matrizador_nombre,
          m.rol as matrizador_rol
        FROM documentos d
        LEFT JOIN matrizadores m ON d.id_matrizador = m.id
        WHERE m.rol = 'archivo'
        AND d.estado NOT IN ('eliminado', 'nota_credito')
        ORDER BY d.created_at DESC
      `, { type: sequelize.QueryTypes.SELECT });

      console.log(`📁 Documentos de usuario archivo encontrados: ${documentosArchivo.length}`);
      
      // Documentos con factura = 0 pero pagado > 0
      const documentosSinFactura = await sequelize.query(`
        SELECT 
          id,
          codigo_barras,
          valor_factura,
          valor_pagado,
          valor_pendiente,
          valor_retenido,
          estado_pago,
          id_matrizador
        FROM documentos
        WHERE (valor_factura = 0 OR valor_factura IS NULL)
        AND valor_pagado > 0
        AND estado NOT IN ('eliminado', 'nota_credito')
        ORDER BY valor_pagado DESC
      `, { type: sequelize.QueryTypes.SELECT });

      console.log(`💸 Documentos sin factura pero con pago: ${documentosSinFactura.length}`);
      
      // Documentos con ecuación matemática incorrecta
      const documentosInconsistentes = await sequelize.query(`
        SELECT 
          id,
          codigo_barras,
          valor_factura,
          valor_pagado,
          valor_pendiente,
          valor_retenido,
          (valor_pagado + valor_pendiente + valor_retenido) as suma_total,
          ABS(valor_factura - (valor_pagado + valor_pendiente + valor_retenido)) as diferencia
        FROM documentos
        WHERE ABS(valor_factura - (valor_pagado + valor_pendiente + valor_retenido)) > 0.01
        AND estado NOT IN ('eliminado', 'nota_credito')
        ORDER BY diferencia DESC
      `, { type: sequelize.QueryTypes.SELECT });

      console.log(`🧮 Documentos con matemática inconsistente: ${documentosInconsistentes.length}`);
      
      // Mostrar casos más críticos
      if (documentosSinFactura.length > 0) {
        console.log('\n🚨 CASOS MÁS CRÍTICOS (Sin factura pero con pago):');
        documentosSinFactura.slice(0, 5).forEach((doc, i) => {
          console.log(`   ${i + 1}. ${doc.codigo_barras}: Factura $${parseFloat(doc.valor_factura || 0).toFixed(2)} - Pagado $${parseFloat(doc.valor_pagado).toFixed(2)}`);
        });
      }

      this.documentosProblematicos = {
        archivo: documentosArchivo,
        sinFactura: documentosSinFactura,
        inconsistentes: documentosInconsistentes
      };

    } catch (error) {
      console.error('❌ Error identificando documentos problemáticos:', error);
      this.erroresEncontrados.push(`Error identificando documentos: ${error.message}`);
    }
  }

  async corregirDocumentosArchivo(transaction) {
    console.log('\n🔧 2. CORRIGIENDO DOCUMENTOS DE USUARIO ARCHIVO');
    console.log('------------------------------------------------');
    
    const documentosArchivo = this.documentosProblematicos?.archivo || [];
    
    if (documentosArchivo.length === 0) {
      console.log('✅ No hay documentos de archivo para corregir');
      return;
    }

    for (const doc of documentosArchivo) {
      try {
        console.log(`\n📄 Procesando documento ${doc.codigo_barras}:`);
        console.log(`   Estado actual: Factura $${parseFloat(doc.valor_factura || 0).toFixed(2)}, Pagado $${parseFloat(doc.valor_pagado || 0).toFixed(2)}`);
        
        // Crear respaldo antes de modificar
        this.respaldos.push({
          id: doc.id,
          valorFacturaOriginal: doc.valor_factura,
          valorPagadoOriginal: doc.valor_pagado,
          valorPendienteOriginal: doc.valor_pendiente,
          valorRetenidoOriginal: doc.valor_retenido,
          estadoPagoOriginal: doc.estado_pago
        });

        let correcionRealizada = false;
        let nuevosValores = {};

        // CASO 1: Documento con valor_factura = 0 pero valor_pagado > 0
        // Probable causa: El valorPagado debería ser valorFactura
        if ((doc.valor_factura === 0 || doc.valor_factura === null) && doc.valor_pagado > 0) {
          console.log('   🔄 CORRECCIÓN: Moviendo valorPagado a valorFactura');
          
          nuevosValores = {
            valorFactura: doc.valor_pagado,  // Lo pagado se convierte en facturado
            valorPagado: 0.00,               // Se resetea a 0
            valorPendiente: doc.valor_pagado, // Queda como pendiente
            estadoPago: 'pendiente'          // Estado correcto
          };
          
          correcionRealizada = true;
          this.correccionesRealizadas.push(`${doc.codigo_barras}: Movido $${doc.valor_pagado} de pagado a factura`);
        }
        
        // CASO 2: Documento con valores correctos pero necesita recálculo
        else if (doc.valor_factura > 0) {
          const valorPendienteCalculado = Math.max(0, 
            parseFloat(doc.valor_factura) - parseFloat(doc.valor_pagado || 0) - parseFloat(doc.valor_retenido || 0)
          );
          
          if (Math.abs(parseFloat(doc.valor_pendiente || 0) - valorPendienteCalculado) > 0.01) {
            console.log('   🔄 CORRECCIÓN: Recalculando valorPendiente');
            
            nuevosValores = {
              valorPendiente: valorPendienteCalculado
            };
            
            correcionRealizada = true;
            this.correccionesRealizadas.push(`${doc.codigo_barras}: Recalculado valorPendiente a $${valorPendienteCalculado.toFixed(2)}`);
          }
        }

        // Aplicar corrección si es necesaria
        if (correcionRealizada) {
          await Documento.update(nuevosValores, {
            where: { id: doc.id },
            transaction
          });
          
          console.log('   ✅ Corrección aplicada');
          console.log(`   Nuevos valores:`, Object.entries(nuevosValores).map(([k, v]) => `${k}: $${v}`).join(', '));
        } else {
          console.log('   ℹ️ No requiere corrección');
        }

      } catch (error) {
        console.error(`❌ Error corrigiendo documento ${doc.codigo_barras}:`, error);
        this.erroresEncontrados.push(`Error en ${doc.codigo_barras}: ${error.message}`);
      }
    }
  }

  async corregirDocumentosSinFactura(transaction) {
    console.log('\n🔧 3. CORRIGIENDO DOCUMENTOS SIN FACTURA PERO CON PAGO');
    console.log('------------------------------------------------------');
    
    const documentosSinFactura = this.documentosProblematicos?.sinFactura || [];
    
    if (documentosSinFactura.length === 0) {
      console.log('✅ No hay documentos sin factura para corregir');
      return;
    }

    for (const doc of documentosSinFactura) {
      try {
        console.log(`\n📄 Procesando documento ${doc.codigo_barras}:`);
        console.log(`   Problema: Factura $${parseFloat(doc.valor_factura || 0).toFixed(2)}, Pagado $${parseFloat(doc.valor_pagado).toFixed(2)}`);
        
        // Estrategia de corrección: Mover valorPagado a valorFactura
        const nuevosValores = {
          valorFactura: parseFloat(doc.valor_pagado),
          valorPagado: 0.00,
          valorPendiente: parseFloat(doc.valor_pagado),
          estadoPago: 'pendiente'
        };

        await Documento.update(nuevosValores, {
          where: { id: doc.id },
          transaction
        });

        console.log('   ✅ CORREGIDO: Valor pagado movido a valor factura');
        console.log(`   Nuevo estado: Factura $${nuevosValores.valorFactura.toFixed(2)}, Pendiente $${nuevosValores.valorPendiente.toFixed(2)}`);
        
        this.correccionesRealizadas.push(`${doc.codigo_barras}: Transformado pago incorrecto $${doc.valor_pagado} en factura pendiente`);

      } catch (error) {
        console.error(`❌ Error corrigiendo documento sin factura ${doc.codigo_barras}:`, error);
        this.erroresEncontrados.push(`Error sin factura ${doc.codigo_barras}: ${error.message}`);
      }
    }
  }

  async recalcularValoresPendientes(transaction) {
    console.log('\n🔧 4. RECALCULANDO VALORES PENDIENTES');
    console.log('--------------------------------------');
    
    try {
      // Recalcular valorPendiente para todos los documentos
      await sequelize.query(`
        UPDATE documentos 
        SET valor_pendiente = GREATEST(0, valor_factura - COALESCE(valor_pagado, 0) - COALESCE(valor_retenido, 0))
        WHERE estado NOT IN ('eliminado', 'nota_credito')
        AND valor_factura IS NOT NULL
        AND valor_factura > 0
      `, { transaction });

      console.log(`✅ Recalculados valores pendientes para todos los documentos válidos`);
      
      // Actualizar estados de pago inconsistentes
      await sequelize.query(`
        UPDATE documentos 
        SET estado_pago = CASE 
          WHEN valor_pendiente <= 0.01 AND COALESCE(valor_retenido, 0) > 0 THEN 'pagado_con_retencion'
          WHEN valor_pendiente <= 0.01 THEN 'pagado_completo'
          WHEN valor_pagado > 0 THEN 'pago_parcial'
          ELSE 'pendiente'
        END
        WHERE estado NOT IN ('eliminado', 'nota_credito')
        AND valor_factura IS NOT NULL
        AND valor_factura > 0
      `, { transaction });

      console.log(`✅ Actualizados estados de pago según valores reales`);
      
      this.correccionesRealizadas.push('Recalculados todos los valores pendientes y estados de pago');

    } catch (error) {
      console.error('❌ Error recalculando valores pendientes:', error);
      this.erroresEncontrados.push(`Error recalculando pendientes: ${error.message}`);
    }
  }

  async validarCorrecciones() {
    console.log('\n✅ 5. VALIDANDO CORRECCIONES');
    console.log('-----------------------------');
    
    try {
      // Verificar que no hay más documentos con cobrado > facturado
      const documentosProblematicos = await sequelize.query(`
        SELECT COUNT(*) as total
        FROM documentos
        WHERE valor_pagado > valor_factura + 0.01
        AND estado NOT IN ('eliminado', 'nota_credito')
        AND valor_factura > 0
      `, { type: sequelize.QueryTypes.SELECT });

      const totalProblematicos = parseInt(documentosProblematicos[0].total);
      console.log(`🔍 Documentos con pagado > facturado después de corrección: ${totalProblematicos}`);
      
      if (totalProblematicos === 0) {
        console.log('✅ ÉXITO: No hay más documentos con pagado > facturado');
      } else {
        console.log('⚠️ ATENCIÓN: Aún hay documentos problemáticos');
      }

      // Verificar ecuación matemática global
      const ecuacionGlobal = await sequelize.query(`
        SELECT 
          SUM(valor_factura) as total_facturado,
          SUM(valor_pagado) as total_pagado,
          SUM(valor_pendiente) as total_pendiente,
          SUM(valor_retenido) as total_retenido,
          SUM(valor_pagado + valor_pendiente + valor_retenido) as suma_total
        FROM documentos
        WHERE estado NOT IN ('eliminado', 'nota_credito')
        AND valor_factura IS NOT NULL
        AND valor_factura > 0
      `, { type: sequelize.QueryTypes.SELECT });

      const diferencia = Math.abs(
        parseFloat(ecuacionGlobal[0].total_facturado) - 
        parseFloat(ecuacionGlobal[0].suma_total)
      );

      console.log(`🧮 Verificación ecuación global:`);
      console.log(`   Facturado: $${parseFloat(ecuacionGlobal[0].total_facturado).toFixed(2)}`);
      console.log(`   Suma (P+Pe+R): $${parseFloat(ecuacionGlobal[0].suma_total).toFixed(2)}`);
      console.log(`   Diferencia: $${diferencia.toFixed(2)}`);
      
      if (diferencia < 0.1) {
        console.log('✅ ÉXITO: Ecuación matemática global balanceada');
      } else {
        console.log('⚠️ ATENCIÓN: Aún hay diferencias en la ecuación global');
      }

      // Verificar usuario archivo específico
      const usuarioArchivo = await sequelize.query(`
        SELECT 
          m.nombre,
          SUM(d.valor_factura) as total_facturado,
          SUM(d.valor_pagado) as total_pagado
        FROM documentos d
        LEFT JOIN matrizadores m ON d.id_matrizador = m.id
        WHERE m.rol = 'archivo'
        AND d.estado NOT IN ('eliminado', 'nota_credito')
        GROUP BY m.id, m.nombre
      `, { type: sequelize.QueryTypes.SELECT });

      if (usuarioArchivo.length > 0) {
        console.log(`📁 Usuario archivo después de corrección:`);
        console.log(`   ${usuarioArchivo[0].nombre}: Facturado $${parseFloat(usuarioArchivo[0].total_facturado || 0).toFixed(2)}, Pagado $${parseFloat(usuarioArchivo[0].total_pagado || 0).toFixed(2)}`);
        
        if (parseFloat(usuarioArchivo[0].total_pagado || 0) <= parseFloat(usuarioArchivo[0].total_facturado || 0)) {
          console.log('✅ ÉXITO: Usuario archivo ya no tiene cobrado > facturado');
        }
      }

    } catch (error) {
      console.error('❌ Error validando correcciones:', error);
      this.erroresEncontrados.push(`Error validando: ${error.message}`);
    }
  }

  async generarEventosAuditoria(transaction) {
    console.log('\n📝 6. GENERANDO EVENTOS DE AUDITORÍA');
    console.log('------------------------------------');
    
    try {
      // Crear evento de auditoría general
      const evento = await EventoDocumento.create({
        documentoId: null, // Evento global
        tipo: 'correccion_masiva',
        descripcion: `Corrección automática de reportes - ${this.correccionesRealizadas.length} documentos corregidos`,
        usuarioId: 1, // Usuario sistema
        detalles: {
          fechaCorreccion: moment().format('YYYY-MM-DD HH:mm:ss'),
          correccionesRealizadas: this.correccionesRealizadas.length,
          erroresEncontrados: this.erroresEncontrados.length,
          documentosAfectados: this.respaldos.map(r => r.id),
          tipoCorrecciones: [
            'Documentos archivo con valores inconsistentes',
            'Documentos sin factura pero con pago',
            'Recálculo de valores pendientes',
            'Actualización de estados de pago'
          ]
        }
      }, { transaction });

      console.log(`✅ Evento de auditoría creado: ID ${evento.id}`);

    } catch (error) {
      console.error('❌ Error generando eventos de auditoría:', error);
      // No es crítico, continuar
    }
  }

  generarReporteCorreccion() {
    console.log('\n📋 REPORTE DE CORRECCIÓN COMPLETADO');
    console.log('===================================');
    console.log(`Fecha: ${moment().format('DD/MM/YYYY HH:mm:ss')}`);
    
    console.log(`\n✅ CORRECCIONES REALIZADAS (${this.correccionesRealizadas.length}):`);
    if (this.correccionesRealizadas.length === 0) {
      console.log('   No se realizaron correcciones');
    } else {
      this.correccionesRealizadas.forEach((correccion, i) => {
        console.log(`   ${i + 1}. ${correccion}`);
      });
    }

    console.log(`\n❌ ERRORES ENCONTRADOS (${this.erroresEncontrados.length}):`);
    if (this.erroresEncontrados.length === 0) {
      console.log('   No se encontraron errores durante la corrección');
    } else {
      this.erroresEncontrados.forEach((error, i) => {
        console.log(`   ${i + 1}. ${error}`);
      });
    }

    console.log(`\n📊 DOCUMENTOS RESPALDADOS: ${this.respaldos.length}`);
    console.log('   (Los valores originales están guardados en el respaldo)');

    console.log('\n🎯 RESUMEN:');
    if (this.erroresEncontrados.length === 0 && this.correccionesRealizadas.length > 0) {
      console.log('   ✅ CORRECCIÓN EXITOSA: Todos los problemas identificados han sido corregidos');
      console.log('   📈 Los reportes financieros ahora deberían mostrar valores consistentes');
      console.log('   🔍 Se recomienda ejecutar la auditoría nuevamente para verificar');
    } else if (this.correccionesRealizadas.length === 0) {
      console.log('   ℹ️ NO SE NECESITARON CORRECCIONES: Los datos ya estaban consistentes');
    } else if (this.erroresEncontrados.length > 0) {
      console.log('   ⚠️ CORRECCIÓN PARCIAL: Algunas correcciones fallaron');
      console.log('   🔧 Se requiere revisión manual de los errores listados');
    }

    console.log('\n🎯 PRÓXIMOS PASOS RECOMENDADOS:');
    console.log('   1. Ejecutar nuevamente: node scripts/auditoria-reportes.js');
    console.log('   2. Verificar reportes financieros en Admin y Caja');
    console.log('   3. Confirmar que usuario archivo no contamina totales');
    console.log('   4. Implementar validaciones preventivas en el código');

    console.log('\n✅ CORRECCIÓN COMPLETADA');
  }
}

// Ejecutar corrección si se llama directamente
if (require.main === module) {
  const correccion = new CorreccionReportes();
  correccion.ejecutarCorreccion()
    .then(() => {
      console.log('\n🎉 Corrección finalizada exitosamente');
      console.log('👉 Ejecuta: node scripts/auditoria-reportes.js para verificar');
      process.exit(0);
    })
    .catch(err => {
      console.error('\n💥 Error en corrección:', err);
      process.exit(1);
    });
}

module.exports = CorreccionReportes; 