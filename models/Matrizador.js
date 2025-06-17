/**
 * Modelo para la tabla de Matrizadores
 * Define los usuarios que crean y gestionan documentos notariales
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Matrizador = sequelize.define('Matrizador', {
  // ID único del matrizador
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  
  // Nombre completo del matrizador
  nombre: {
    type: DataTypes.STRING,
    allowNull: false
  },
  
  // Correo electrónico (usado como nombre de usuario)
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  
  // Número de identificación
  identificacion: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  
  // Cargo o rol en la notaría
  cargo: {
    type: DataTypes.STRING,
    allowNull: false
  },
  
  // Rol del usuario en el sistema
  rol: {
    type: DataTypes.ENUM('admin', 'matrizador', 'recepcion', 'consulta', 'caja', 'caja_archivo', 'archivo'),
    allowNull: false,
    defaultValue: 'matrizador'
  },
  
  // Estado: activo o inactivo
  activo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  
  // Contraseña (hasheada)
  password: {
    type: DataTypes.STRING,
    allowNull: true
  },
  
  // Última fecha de acceso
  ultimoAcceso: {
    type: DataTypes.DATE,
    field: 'ultimo_acceso',
    allowNull: true
  }
}, {
  // Opciones del modelo
  tableName: 'matrizadores',
  timestamps: true, // Crea automáticamente createdAt y updatedAt
  underscored: true // Usa snake_case para los nombres de columnas
});

module.exports = Matrizador; 