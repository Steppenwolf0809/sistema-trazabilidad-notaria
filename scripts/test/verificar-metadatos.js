const EventoDocumento = require('./models/EventoDocumento');
const { sequelize } = require('./config/database');

async function verificar() {
  try {
    const eventos = await EventoDocumento.findAll({
      where: { tipo: 'documento_listo' },
      order: [['created_at', 'DESC']],
      limit: 3
    });
    
    if (eventos.length > 0) {
      console.log(`📋 Encontrados ${eventos.length} eventos:`);
      
      eventos.forEach((evento, index) => {
        console.log(`\n--- Evento ${index + 1} ---`);
        console.log('ID:', evento.id);
        console.log('Tipo:', evento.tipo);
        console.log('Fecha creación:', evento.created_at);
        console.log('Tiene fechaFormateada:', !!evento.metadatos?.fechaFormateada);
        console.log('Tiene fechaProcesada:', !!evento.metadatos?.fechaProcesada);
        
        if (evento.metadatos?.fechaFormateada) {
          console.log('fechaFormateada:', evento.metadatos.fechaFormateada);
        }
        if (evento.metadatos?.fechaProcesada) {
          console.log('fechaProcesada:', evento.metadatos.fechaProcesada);
        }
      });
    } else {
      console.log('❌ No se encontraron eventos');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

verificar(); 