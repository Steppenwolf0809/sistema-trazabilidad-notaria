/**
 * Script para corregir documento ID 51 en estado nota_credito
 * Problema: El documento está marcado como nota_credito pero no está eliminado (soft delete)
 * Solución: Marcar correctamente como eliminado para liberar el XML
 */

const { sequelize } = require('./config/database');
const Documento = require('./models/Documento');
const EventoDocumento = require('./models/EventoDocumento');

async function corregirDocumento51() {
  try {
    console.log('🔧 Iniciando corrección del documento ID 51...');
    
    // Verificar conexión
    await sequelize.authenticate();
    console.log('✅ Conexión a base de datos exitosa');
    
    // Buscar documento ID 51
    const documento = await Documento.findByPk(51);
    if (!documento) {
      console.log('❌ Documento ID 51 no encontrado');
      return;
    }
    
    console.log('📋 Estado actual del documento:', {
      id: documento.id,
      estado: documento.estado,
      deletedAt: documento.deletedAt,
      deletedBy: documento.deletedBy,
      codigoBarras: documento.codigoBarras,
      valorFactura: documento.valorFactura,
      valorPagado: documento.valorPagado
    });
    
    // Verificar si ya está correctamente eliminado
    if (documento.deletedAt) {
      console.log('✅ El documento ya está correctamente eliminado (soft delete)');
      return;
    }
    
    // Ejecutar corrección en transacción
    const transaction = await sequelize.transaction();
    
    try {
      console.log('🔄 Aplicando corrección...');
      
      // Marcar como eliminado (soft delete) para liberar XML
      await documento.update({
        deletedAt: new Date(),
        deletedBy: 1, // Usuario admin por defecto
        deletionReason: 'solicitud_nota_credito',
        deletionJustification: 'Corrección automática: Documento marcado como nota de crédito debe estar eliminado para liberar XML',
        paymentHandling: 'nota_credito_automatica'
      }, { transaction });
      
      // Crear evento de auditoría
      await EventoDocumento.create({
        documentoId: documento.id,
        usuarioId: 1,
        tipo: 'correccion_sistema',
        categoria: 'sistema',
        titulo: '🔧 Corrección Automática - Nota de Crédito',
        descripcion: 'Documento corregido automáticamente: marcado como eliminado para liberar XML y permitir resubida',
        detalles: {
          problemaCorregido: 'documento_nota_credito_sin_soft_delete',
          motivoCorreccion: 'liberar_xml_para_resubida',
          estadoAnterior: {
            estado: documento.estado,
            deletedAt: documento.deletedAt,
            deletedBy: documento.deletedBy
          },
          estadoNuevo: {
            estado: 'nota_credito',
            deletedAt: new Date(),
            deletedBy: 1
          }
        },
        usuario: 'Sistema'
      }, { transaction });
      
      await transaction.commit();
      console.log('✅ Corrección aplicada exitosamente');
      
      console.log('📋 Estado final del documento:', {
        id: documento.id,
        estado: 'nota_credito',
        deletedAt: 'MARCADO',
        liberadoParaResubida: true
      });
      
      console.log('🎉 El XML ahora puede ser subido nuevamente');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error en transacción:', error);
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Error en corrección:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Ejecutar corrección
corregirDocumento51()
  .then(() => {
    console.log('🏁 Corrección completada');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  }); 