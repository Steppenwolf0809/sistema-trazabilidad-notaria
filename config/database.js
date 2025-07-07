/**
 * Configuración de la conexión a la base de datos PostgreSQL
 * Este archivo exporta una instancia de Sequelize configurada con las variables de entorno
 */

const { Sequelize } = require('sequelize');
require('dotenv').config();

// Configuración optimizada para Render + desarrollo local
let sequelize;

if (process.env.DATABASE_URL) {
  // Producción (Render) - Usar DATABASE_URL
  console.log('🌐 Configurando conexión para producción (Render)...');
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    define: {
      underscored: true,
      timestamps: true,
      freezeTableName: false
    }
  });
} else {
  // Desarrollo local - Usar variables individuales
  console.log('🛠️ Configurando conexión para desarrollo local...');
  sequelize = new Sequelize({
    dialect: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5433,
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'notaria',
    logging: false,
    define: {
      underscored: true,
      timestamps: true,
      freezeTableName: false,
      charset: 'utf8',
      dialectOptions: {
        collate: 'utf8_general_ci'
      }
    }
  });
}

// Función para comprobar la conexión a la base de datos con retry
const testConnection = async (maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`🔌 Probando conexión a la base de datos (intento ${i + 1}/${maxRetries})...`);
      await sequelize.authenticate();
      console.log('✅ Conexión establecida con la base de datos PostgreSQL.');
      return true;
    } catch (error) {
      console.error(`❌ Intento ${i + 1} falló:`, error.message);
      if (i < maxRetries - 1) {
        console.log('⏳ Esperando 3 segundos antes del siguiente intento...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  }
  console.error('❌ No se pudo establecer conexión después de varios intentos');
  return false;
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