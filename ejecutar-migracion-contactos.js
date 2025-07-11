const { sequelize } = require('./config/database');

async function ejecutarMigracion() {
  try {
    console.log('🔄 Iniciando migración de campos de contactos inteligente...');
    
    // Verificar conexión
    await sequelize.authenticate();
    console.log('✅ Conexión a base de datos exitosa');
    
    // Ejecutar comandos SQL directamente
    const queryInterface = sequelize.getQueryInterface();
    
    // Verificar si los campos ya existen
    const tableDescription = await queryInterface.describeTable('documentos');
    
    if (tableDescription.telefono_whatsapp) {
      console.log('ℹ️ Los campos ya existen, saltando migración');
      return;
    }
    
    console.log('🔄 Agregando campos...');
    
    // Agregar campos uno por uno
    await queryInterface.addColumn('documentos', 'telefono_whatsapp', {
      type: sequelize.Sequelize.STRING(15),
      allowNull: true,
      comment: 'Número de teléfono validado para notificaciones WhatsApp'
    });
    console.log('✅ Campo telefono_whatsapp agregado');
    
    await queryInterface.addColumn('documentos', 'contacto_validado', {
      type: sequelize.Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Indica si el contacto ha sido validado por el sistema inteligente'
    });
    console.log('✅ Campo contacto_validado agregado');
    
    await queryInterface.addColumn('documentos', 'contacto_conflicto', {
      type: sequelize.Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Indica si hay conflicto entre contacto XML y base de datos local'
    });
    console.log('✅ Campo contacto_conflicto agregado');
    
    await queryInterface.addColumn('documentos', 'contacto_datos_analisis', {
      type: sequelize.Sequelize.JSON,
      allowNull: true,
      comment: 'Datos del análisis del sistema inteligente de contactos'
    });
    console.log('✅ Campo contacto_datos_analisis agregado');
    
    console.log('🎉 Migración completada exitosamente');
    
  } catch (error) {
    console.error('❌ Error en migración:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

ejecutarMigracion(); 