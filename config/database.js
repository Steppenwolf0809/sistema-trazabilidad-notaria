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
  logging: false
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

module.exports = {
  sequelize,
  testConnection
}; 