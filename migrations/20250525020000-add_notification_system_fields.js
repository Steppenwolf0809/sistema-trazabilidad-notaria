'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // ============== CAMPOS PARA SISTEMA DE NOTIFICACIONES ==============
    
    // Campo para controlar si se debe notificar automáticamente
    try {
      await queryInterface.addColumn('documentos', 'notificar_automatico', {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
        comment: 'Indica si el documento debe ser notificado automáticamente cuando esté listo'
      });
    } catch (error) {
      console.log('Campo notificar_automatico ya existe, continuando...');
    }

    // Campo para método de notificación
    try {
      await queryInterface.addColumn('documentos', 'metodo_notificacion', {
        type: Sequelize.ENUM('whatsapp', 'email', 'ambos', 'ninguno'),
        defaultValue: 'ambos',
        allowNull: false,
        comment: 'Método preferido para notificar al cliente'
      });
    } catch (error) {
      console.log('Campo metodo_notificacion ya existe, continuando...');
    }

    // Campo para referencia al documento principal (self-referencing)
    try {
      await queryInterface.addColumn('documentos', 'documento_principal_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'documentos',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'ID del documento principal si este es un documento habilitante'
      });
    } catch (error) {
      console.log('Campo documento_principal_id ya existe, continuando...');
    }

    // Campo para indicar si es documento principal
    try {
      await queryInterface.addColumn('documentos', 'es_documento_principal', {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
        comment: 'Indica si este documento es principal (true) o habilitante (false)'
      });
    } catch (error) {
      console.log('Campo es_documento_principal ya existe, continuando...');
    }

    // Campo para indicar si fue entregado inmediatamente
    try {
      await queryInterface.addColumn('documentos', 'entregado_inmediatamente', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Indica si el documento fue entregado inmediatamente sin necesidad de notificación'
      });
    } catch (error) {
      console.log('Campo entregado_inmediatamente ya existe, continuando...');
    }

    // Campo para razón de no notificar
    try {
      await queryInterface.addColumn('documentos', 'razon_sin_notificar', {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Razón específica por la cual no se debe notificar este documento'
      });
    } catch (error) {
      console.log('Campo razon_sin_notificar ya existe, continuando...');
    }

    // Crear índice para mejorar performance en consultas de documentos principales
    try {
      await queryInterface.addIndex('documentos', ['documento_principal_id'], {
        name: 'idx_documentos_principal_id'
      });
    } catch (error) {
      console.log('Índice idx_documentos_principal_id ya existe, continuando...');
    }

    // Crear índice para consultas de notificación automática
    try {
      await queryInterface.addIndex('documentos', ['notificar_automatico', 'estado'], {
        name: 'idx_documentos_notificacion_estado'
      });
    } catch (error) {
      console.log('Índice idx_documentos_notificacion_estado ya existe, continuando...');
    }
  },

  async down (queryInterface, Sequelize) {
    // Eliminar índices primero
    try {
      await queryInterface.removeIndex('documentos', 'idx_documentos_principal_id');
    } catch (error) {
      console.log('Error al eliminar índice idx_documentos_principal_id:', error.message);
    }

    try {
      await queryInterface.removeIndex('documentos', 'idx_documentos_notificacion_estado');
    } catch (error) {
      console.log('Error al eliminar índice idx_documentos_notificacion_estado:', error.message);
    }

    // Eliminar columnas
    const columnas = [
      'razon_sin_notificar',
      'entregado_inmediatamente',
      'es_documento_principal',
      'documento_principal_id',
      'metodo_notificacion',
      'notificar_automatico'
    ];
    
    for (const columna of columnas) {
      try {
        await queryInterface.removeColumn('documentos', columna);
      } catch (error) {
        console.log(`Error al eliminar columna ${columna}:`, error.message);
      }
    }

    // Eliminar ENUM para metodo_notificacion
    try {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_documentos_metodo_notificacion";');
    } catch (error) {
      console.log('Error al eliminar ENUM metodo_notificacion:', error.message);
    }
  }
}; 