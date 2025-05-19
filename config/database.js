/**
 * Configuración de la conexión a la base de datos PostgreSQL
 * Este archivo exporta una instancia de Sequelize configurada con las variables de entorno
 */

const { Sequelize } = require('sequelize');
require('dotenv').config();

// Conexión real a PostgreSQL
const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5433, // Puerto 5433 en lugar de 5432
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'notaria',
  logging: false,
  // Opciones globales para todos los modelos
  define: {
    underscored: true, // Usar snake_case para nombres de columnas en la BD
    timestamps: true,  // Incluir createdAt y updatedAt automáticamente
    freezeTableName: false, // Permite pluralización de nombres de tablas
    charset: 'utf8',
    dialectOptions: {
      collate: 'utf8_general_ci'
    }
  }
});

// Función para comprobar la conexión a la base de datos
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Conexión establecida con la base de datos PostgreSQL.');
    return true;
  } catch (error) {
    console.error('❌ Error al conectar con la base de datos:', error);
    return false;
  }
};

// Función para sincronizar los modelos con la base de datos
const syncModels = async () => {
  try {
    // Aseguramos que todos los modelos estén cargados antes de sincronizar
    // No es necesario almacenar el resultado, solo queremos que se carguen
    require('../models');
    
    // Sincronizamos todos los modelos con la base de datos
    await sequelize.sync({ force: false });
    console.log('✅ Tablas sincronizadas correctamente');
    return true;
  } catch (error) {
    console.error('❌ Error al sincronizar tablas:', error);
    console.error(error.stack);
    return false;
  }
};

module.exports = {
  sequelize,
  Sequelize,
  testConnection,
  syncModels
}; 