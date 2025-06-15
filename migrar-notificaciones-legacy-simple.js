const { sequelize } = require('./config/database');
const EventoDocumento = require('./models/EventoDocumento');
const NotificacionEnviada = require('./models/NotificacionEnviada');
const Documento = require('./models/Documento');

async function migrarNotificacionesLegacy() {
  const transaction = await sequelize.transaction();
  
  try {
    console.log('🔄 MIGRANDO NOTIFICACIONES LEGACY...');
    console.log('====================================');
    
    // 1. Migrar eventos de tipo 'documento_entregado'
    console.log('\n📦 1. Migrando eventos de entrega legacy...');
    const eventosEntregaLegacy = await EventoDocumento.findAll({
      where: {
        tipo: 'documento_entregado'
      },
      transaction
    });
    
    let migradosEntrega = 0;
    for (const evento of eventosEntregaLegacy) {
      try {
        // Verificar si ya existe en la nueva tabla
        const existeNotificacion = await NotificacionEnviada.findOne({
          where: {
            documentoId: evento.documentoId,
            tipoEvento: 'entrega_confirmada',
            created_at: evento.created_at
          },
          transaction
        });
        
        if (!existeNotificacion) {
          // Obtener documento por separado
          const documento = await Documento.findByPk(evento.documentoId, { transaction });
          
          if (documento) {
            // Determinar canal basado en metadatos o documento
            let canal = 'email'; // default
            if (evento.metadatos?.canal) {
              canal = evento.metadatos.canal;
            } else if (documento.metodoNotificacion) {
              canal = documento.metodoNotificacion === 'ambos' ? 'whatsapp' : documento.metodoNotificacion;
            }
            
            // Determinar destinatario
            let destinatario = 'no-disponible';
            if (canal === 'email' && documento.emailCliente) {
              destinatario = documento.emailCliente;
            } else if (canal === 'whatsapp' && documento.telefonoCliente) {
              destinatario = documento.telefonoCliente;
            }
            
            await NotificacionEnviada.create({
              documentoId: evento.documentoId,
              documentosIds: null,
              tipoEntrega: 'individual',
              tipoEvento: 'entrega_confirmada',
              canal: canal,
              destinatario: destinatario,
              estado: 'enviado',
              mensajeEnviado: evento.detalles || evento.descripcion || 'Documento entregado exitosamente',
              respuestaApi: null,
              intentos: 1,
              metadatos: {
                migradoDesde: 'eventos_documentos',
                eventoOriginalId: evento.id,
                fechaOriginal: evento.created_at,
                usuario: evento.usuario || 'Sistema Legacy',
                ...evento.metadatos
              },
              created_at: evento.created_at,
              updated_at: evento.updated_at
            }, { transaction });
            
            migradosEntrega++;
          }
        }
      } catch (error) {
        console.error(`❌ Error migrando evento entrega ${evento.id}:`, error.message);
      }
    }
    
    console.log(`   ✅ Migrados ${migradosEntrega} eventos de entrega`);
    
    // 2. Migrar eventos de tipo 'documento_listo'
    console.log('\n📧 2. Migrando eventos de documento listo legacy...');
    const eventosListoLegacy = await EventoDocumento.findAll({
      where: {
        tipo: 'documento_listo'
      },
      transaction
    });
    
    let migradosListo = 0;
    for (const evento of eventosListoLegacy) {
      try {
        // Verificar si ya existe en la nueva tabla
        const existeNotificacion = await NotificacionEnviada.findOne({
          where: {
            documentoId: evento.documentoId,
            tipoEvento: 'documento_listo',
            created_at: evento.created_at
          },
          transaction
        });
        
        if (!existeNotificacion) {
          // Obtener documento por separado
          const documento = await Documento.findByPk(evento.documentoId, { transaction });
          
          if (documento) {
            // Determinar canal basado en metadatos o documento
            let canal = 'email'; // default
            if (evento.metadatos?.canal) {
              canal = evento.metadatos.canal;
            } else if (documento.metodoNotificacion) {
              canal = documento.metodoNotificacion === 'ambos' ? 'whatsapp' : documento.metodoNotificacion;
            }
            
            // Determinar destinatario
            let destinatario = 'no-disponible';
            if (canal === 'email' && documento.emailCliente) {
              destinatario = documento.emailCliente;
            } else if (canal === 'whatsapp' && documento.telefonoCliente) {
              destinatario = documento.telefonoCliente;
            }
            
            await NotificacionEnviada.create({
              documentoId: evento.documentoId,
              documentosIds: null,
              tipoEntrega: 'individual',
              tipoEvento: 'documento_listo',
              canal: canal,
              destinatario: destinatario,
              estado: 'enviado',
              mensajeEnviado: evento.detalles || evento.descripcion || 'Documento listo para retirar',
              respuestaApi: null,
              intentos: 1,
              metadatos: {
                migradoDesde: 'eventos_documentos',
                eventoOriginalId: evento.id,
                fechaOriginal: evento.created_at,
                usuario: evento.usuario || 'Sistema Legacy',
                ...evento.metadatos
              },
              created_at: evento.created_at,
              updated_at: evento.updated_at
            }, { transaction });
            
            migradosListo++;
          }
        }
      } catch (error) {
        console.error(`❌ Error migrando evento listo ${evento.id}:`, error.message);
      }
    }
    
    console.log(`   ✅ Migrados ${migradosListo} eventos de documento listo`);
    
    // 3. Migrar eventos de entrega grupal
    console.log('\n📦 3. Migrando eventos de entrega grupal legacy...');
    const eventosGrupalLegacy = await EventoDocumento.findAll({
      where: {
        tipo: 'notificacion_grupal'
      },
      transaction
    });
    
    let migradosGrupal = 0;
    for (const evento of eventosGrupalLegacy) {
      try {
        // Verificar si ya existe en la nueva tabla
        const existeNotificacion = await NotificacionEnviada.findOne({
          where: {
            documentoId: evento.documentoId,
            tipoEvento: 'entrega_grupal',
            created_at: evento.created_at
          },
          transaction
        });
        
        if (!existeNotificacion) {
          // Obtener documento por separado
          const documento = await Documento.findByPk(evento.documentoId, { transaction });
          
          if (documento) {
            // Determinar canal basado en metadatos
            let canal = evento.metadatos?.canal || 'email';
            
            // Determinar destinatario
            let destinatario = 'no-disponible';
            if (canal === 'email' && documento.emailCliente) {
              destinatario = documento.emailCliente;
            } else if (canal === 'whatsapp' && documento.telefonoCliente) {
              destinatario = documento.telefonoCliente;
            }
            
            // Para entrega grupal, documentoId puede ser null y usar documentosIds
            const documentosIds = evento.detalles?.documentosIncluidos?.map(d => d.id) || [evento.documentoId];
            
            await NotificacionEnviada.create({
              documentoId: documentosIds.length === 1 ? evento.documentoId : null,
              documentosIds: documentosIds.length > 1 ? documentosIds : null,
              tipoEntrega: 'grupal',
              tipoEvento: 'entrega_grupal',
              canal: canal,
              destinatario: destinatario,
              estado: 'enviado',
              mensajeEnviado: evento.detalles || evento.descripcion || 'Entrega grupal completada',
              respuestaApi: null,
              intentos: 1,
              metadatos: {
                migradoDesde: 'eventos_documentos',
                eventoOriginalId: evento.id,
                fechaOriginal: evento.created_at,
                usuario: evento.usuario || 'Sistema Legacy',
                totalDocumentos: evento.detalles?.totalDocumentos || documentosIds.length,
                ...evento.metadatos
              },
              created_at: evento.created_at,
              updated_at: evento.updated_at
            }, { transaction });
            
            migradosGrupal++;
          }
        }
      } catch (error) {
        console.error(`❌ Error migrando evento grupal ${evento.id}:`, error.message);
      }
    }
    
    console.log(`   ✅ Migrados ${migradosGrupal} eventos de entrega grupal`);
    
    // 4. Migrar eventos de tipo 'otro' que sean notificaciones
    console.log('\n📧 4. Migrando eventos de notificación en tipo "otro"...');
    const eventosOtroNotificacion = await EventoDocumento.findAll({
      where: {
        tipo: 'otro',
        [sequelize.Op.or]: [
          { detalles: { [sequelize.Op.iLike]: '%notificación%' } },
          { descripcion: { [sequelize.Op.iLike]: '%notificación%' } },
          { titulo: { [sequelize.Op.iLike]: '%notificación%' } },
          { detalles: { [sequelize.Op.iLike]: '%listo%' } }
        ]
      },
      transaction
    });
    
    let migradosOtro = 0;
    for (const evento of eventosOtroNotificacion) {
      try {
        // Verificar si ya existe en la nueva tabla
        const existeNotificacion = await NotificacionEnviada.findOne({
          where: {
            documentoId: evento.documentoId,
            created_at: evento.created_at
          },
          transaction
        });
        
        if (!existeNotificacion) {
          // Obtener documento por separado
          const documento = await Documento.findByPk(evento.documentoId, { transaction });
          
          if (documento) {
            // Determinar tipo de evento basado en contenido
            let tipoEvento = 'documento_listo'; // default
            const contenido = (evento.detalles || evento.descripcion || evento.titulo || '').toLowerCase();
            if (contenido.includes('entrega') || contenido.includes('entregado')) {
              tipoEvento = 'entrega_confirmada';
            }
            
            // Determinar canal basado en metadatos
            let canal = evento.metadatos?.canal || 'email';
            if (evento.metadatos?.canalesEnviados?.length > 0) {
              canal = evento.metadatos.canalesEnviados[0];
            }
            
            // Determinar destinatario
            let destinatario = 'no-disponible';
            if (canal === 'email' && documento.emailCliente) {
              destinatario = documento.emailCliente;
            } else if (canal === 'whatsapp' && documento.telefonoCliente) {
              destinatario = documento.telefonoCliente;
            }
            
            await NotificacionEnviada.create({
              documentoId: evento.documentoId,
              documentosIds: null,
              tipoEntrega: 'individual',
              tipoEvento: tipoEvento,
              canal: canal,
              destinatario: destinatario,
              estado: evento.metadatos?.estado === 'error' ? 'fallido' : 'enviado',
              mensajeEnviado: evento.detalles || evento.descripcion || 'Notificación enviada',
              respuestaApi: null,
              intentos: 1,
              metadatos: {
                migradoDesde: 'eventos_documentos',
                eventoOriginalId: evento.id,
                fechaOriginal: evento.created_at,
                usuario: evento.usuario || 'Sistema Legacy',
                tipoOriginal: 'otro',
                ...evento.metadatos
              },
              created_at: evento.created_at,
              updated_at: evento.updated_at
            }, { transaction });
            
            migradosOtro++;
          }
        }
      } catch (error) {
        console.error(`❌ Error migrando evento otro ${evento.id}:`, error.message);
      }
    }
    
    console.log(`   ✅ Migrados ${migradosOtro} eventos de tipo "otro"`);
    
    await transaction.commit();
    
    // 5. Mostrar resumen final
    console.log('\n📊 RESUMEN DE MIGRACIÓN:');
    console.log('========================');
    console.log(`   📦 Eventos de entrega: ${migradosEntrega}`);
    console.log(`   📧 Eventos de documento listo: ${migradosListo}`);
    console.log(`   📦 Eventos de entrega grupal: ${migradosGrupal}`);
    console.log(`   📧 Eventos de tipo "otro": ${migradosOtro}`);
    console.log(`   🎯 TOTAL MIGRADO: ${migradosEntrega + migradosListo + migradosGrupal + migradosOtro}`);
    
    // Verificar total en nueva tabla
    const totalNuevo = await NotificacionEnviada.count();
    console.log(`   📋 Total en tabla nueva: ${totalNuevo}`);
    
    console.log('\n✅ MIGRACIÓN COMPLETADA EXITOSAMENTE');
    
    process.exit(0);
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error en migración:', error);
    process.exit(1);
  }
}

migrarNotificacionesLegacy(); 