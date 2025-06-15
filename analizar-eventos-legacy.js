const { sequelize } = require('./config/database');
const EventoDocumento = require('./models/EventoDocumento');

async function analizarEventosLegacy() {
  try {
    console.log('🔍 ANALIZANDO EVENTOS LEGACY...');
    console.log('================================');
    
    // Obtener tipos de eventos únicos
    const tiposEventos = await sequelize.query(
      'SELECT tipo, COUNT(*) as cantidad FROM eventos_documentos GROUP BY tipo ORDER BY cantidad DESC',
      { type: sequelize.QueryTypes.SELECT }
    );
    
    console.log('\n📊 TIPOS DE EVENTOS EXISTENTES:');
    tiposEventos.forEach(tipo => {
      console.log(`   ${tipo.tipo}: ${tipo.cantidad} eventos`);
    });
    
    // Buscar eventos que podrían ser notificaciones de entrega
    const eventosEntrega = await sequelize.query(
      `SELECT tipo, detalles, descripcion, COUNT(*) as cantidad 
       FROM eventos_documentos 
       WHERE tipo IN ('documento_entregado', 'entrega', 'otro') 
       AND (detalles ILIKE '%entrega%' OR descripcion ILIKE '%entrega%' OR titulo ILIKE '%entrega%') 
       GROUP BY tipo, detalles, descripcion 
       ORDER BY cantidad DESC 
       LIMIT 10`,
      { type: sequelize.QueryTypes.SELECT }
    );
    
    console.log('\n📦 EVENTOS DE ENTREGA LEGACY:');
    eventosEntrega.forEach(evento => {
      console.log(`   ${evento.tipo}: ${evento.cantidad} - ${evento.detalles || evento.descripcion}`);
    });
    
    // Buscar eventos de notificación legacy
    const eventosNotificacion = await sequelize.query(
      `SELECT tipo, detalles, descripcion, COUNT(*) as cantidad 
       FROM eventos_documentos 
       WHERE tipo IN ('documento_listo', 'notificacion_enviada', 'otro') 
       AND (detalles ILIKE '%notificacion%' OR descripcion ILIKE '%notificacion%' OR titulo ILIKE '%notificacion%' OR detalles ILIKE '%listo%') 
       GROUP BY tipo, detalles, descripcion 
       ORDER BY cantidad DESC 
       LIMIT 10`,
      { type: sequelize.QueryTypes.SELECT }
    );
    
    console.log('\n📧 EVENTOS DE NOTIFICACIÓN LEGACY:');
    eventosNotificacion.forEach(evento => {
      console.log(`   ${evento.tipo}: ${evento.cantidad} - ${evento.detalles || evento.descripcion}`);
    });
    
    // Verificar si existen registros en NotificacionEnviada
    const notificacionesEnviadas = await sequelize.query(
      'SELECT COUNT(*) as total FROM notificaciones_enviadas',
      { type: sequelize.QueryTypes.SELECT }
    );
    
    console.log(`\n📋 NOTIFICACIONES EN TABLA NUEVA: ${notificacionesEnviadas[0].total}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

analizarEventosLegacy(); 