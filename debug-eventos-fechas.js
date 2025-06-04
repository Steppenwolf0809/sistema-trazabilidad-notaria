/**
 * Script para debuggar el problema de fechas en eventos
 */

const { sequelize } = require('./config/database');
const EventoDocumento = require('./models/EventoDocumento');

async function debugEventosFechas() {
  try {
    console.log('🔍 DEBUGGING FECHAS EN EVENTOS');
    console.log('===============================');
    
    // Buscar algunos eventos para depurar
    const eventos = await EventoDocumento.findAll({
      limit: 5,
      order: [['created_at', 'DESC']]
    });
    
    console.log(`📊 Encontrados ${eventos.length} eventos para debug`);
    
    eventos.forEach((evento, index) => {
      console.log(`\n🔍 EVENTO ${index + 1}:`);
      console.log('ID:', evento.id);
      console.log('Tipo:', evento.tipo);
      console.log('DocumentoId:', evento.documentoId);
      console.log('created_at (raw):', evento.created_at);
      console.log('created_at (tipo):', typeof evento.created_at);
      console.log('created_at (Date):', new Date(evento.created_at));
      console.log('created_at (ISO):', evento.created_at ? evento.created_at.toISOString() : 'NULL');
      
      // Probar helpers manualmente
      if (evento.created_at) {
        const fecha = new Date(evento.created_at);
        console.log('📅 TEST formatDate:', formatDate(fecha));
        console.log('🕐 TEST formatTime:', formatTime(fecha));
        console.log('📅🕐 TEST formatDateTime:', formatDateTime(fecha));
      }
    });
    
    console.log('\n✅ Debug completado');
    
  } catch (error) {
    console.error('❌ Error en debug:', error);
  } finally {
    await sequelize.close();
  }
}

// Helpers para probar
function formatDate(date) {
  if (!date) return '';
  try {
    const moment = require('moment-timezone');
    return moment(date).tz('America/Guayaquil').format('DD/MM/YYYY');
  } catch (error) {
    console.error('Error en formatDate:', error);
    return '';
  }
}

function formatTime(date) {
  if (!date) return '';
  try {
    const moment = require('moment-timezone');
    return moment(date).tz('America/Guayaquil').format('HH:mm:ss');
  } catch (error) {
    console.error('Error en formatTime:', error);
    return '';
  }
}

function formatDateTime(date) {
  if (!date) return '';
  try {
    const moment = require('moment-timezone');
    return moment(date).tz('America/Guayaquil').format('DD/MM/YYYY HH:mm:ss');
  } catch (error) {
    console.error('Error en formatDateTime:', error);
    return '';
  }
}

debugEventosFechas(); 