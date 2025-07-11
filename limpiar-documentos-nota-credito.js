/**
 * Script para limpiar documentos en estado nota_credito sin soft delete
 * Problema: Documentos marcados como nota_credito pero no eliminados correctamente
 * Solución: Aplicar soft delete para liberar XMLs y permitir resubidas
 */

const { sequelize } = require('./config/database');
const Documento = require('./models/Documento');
const EventoDocumento = require('./models/EventoDocumento');

async function limpiarDocumentosNotaCredito() {
  try {
    console.log('🔧 Iniciando limpieza de documentos nota_credito...');
    
    // Verificar conexión
    await sequelize.authenticate();
    console.log('✅ Conexión a base de datos exitosa');
    
    // Buscar documentos en estado nota_credito sin soft delete
    const documentosProblematicos = await Documento.findAll({
      where: {
        estado: 'nota_credito',
        deletedAt: null // Sin soft delete
      }
    });
    
    console.log(`📋 Encontrados ${documentosProblematicos.length} documentos problemáticos`);
    
    if (documentosProblematicos.length === 0) {
      console.log('✅ No hay documentos que requieran corrección');
      return;
    }
    
    // Mostrar lista de documentos problemáticos
    console.log('📋 Documentos que serán corregidos:');
    documentosProblematicos.forEach(doc => {
      console.log(`- ID: ${doc.id} | Código: ${doc.codigoBarras} | Cliente: ${doc.nombreCliente} | Valor: $${doc.valorFactura}`);
    });
    
    // Ejecutar corrección en transacción
    const transaction = await sequelize.transaction();
    
    try {
      console.log('🔄 Aplicando correcciones...');
      
      for (const documento of documentosProblematicos) {
        console.log(`🔧 Corrigiendo documento ID ${documento.id}...`);
        
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
            limpiezaMasiva: true,
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
        
        console.log(`✅ Documento ID ${documento.id} corregido`);
      }
      
      await transaction.commit();
      console.log('✅ Todas las correcciones aplicadas exitosamente');
      
      console.log('📊 Resumen de correcciones:');
      console.log(`- Documentos corregidos: ${documentosProblematicos.length}`);
      console.log('- Estado final: nota_credito + soft delete aplicado');
      console.log('- XMLs liberados para resubida: SÍ');
      
      console.log('🎉 Los XMLs ahora pueden ser subidos nuevamente');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error en transacción:', error);
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Error en limpieza:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Ejecutar limpieza
limpiarDocumentosNotaCredito()
  .then(() => {
    console.log('🏁 Limpieza completada');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  }); 