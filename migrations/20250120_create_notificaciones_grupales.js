/**
 * Migración: Crear tabla notificaciones_grupales
 * Fecha: 20/01/2025
 * Propósito: Implementar sistema de notificaciones grupales por cliente
 */

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Crear tabla notificaciones_grupales
    await queryInterface.createTable('notificaciones_grupales', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      
      codigo_verificacion: {
        type: Sequelize.STRING(4),
        unique: true,
        allowNull: false,
        comment: 'Código único de 4 dígitos válido para todos los documentos del grupo'
      },
      
      cliente_nombre: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Nombre del cliente propietario de todos los documentos del grupo'
      },
      
      cliente_identificacion: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Identificación del cliente (cédula/RUC/pasaporte)'
      },
      
      cliente_telefono: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Número de teléfono del cliente para WhatsApp'
      },
      
      cliente_email: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Email del cliente para notificaciones'
      },
      
      estado: {
        type: Sequelize.ENUM('pendiente', 'enviada', 'entregada', 'cancelada'),
        defaultValue: 'pendiente',
        allowNull: false,
        comment: 'Estado del grupo de notificación'
      },
      
      mensaje_enviado: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Contenido del mensaje WhatsApp enviado al cliente'
      },
      
      fecha_envio: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp de cuando se envió la notificación'
      },
      
      total_documentos: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
        comment: 'Número total de documentos en el grupo'
      },
      
      matrizador_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'matrizadores',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
        comment: 'ID del matrizador que creó/maneja el grupo'
      },
      
      metadatos: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: {},
        comment: 'Información adicional: tipos de documentos, fechas, etc.'
      },
      
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        onUpdate: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Crear índices para optimizar consultas
    await queryInterface.addIndex('notificaciones_grupales', ['codigo_verificacion'], {
      unique: true,
      name: 'idx_notificaciones_grupales_codigo_verificacion'
    });

    await queryInterface.addIndex('notificaciones_grupales', ['cliente_identificacion', 'matrizador_id'], {
      name: 'idx_notificaciones_grupales_cliente_matrizador'
    });

    await queryInterface.addIndex('notificaciones_grupales', ['estado'], {
      name: 'idx_notificaciones_grupales_estado'
    });

    await queryInterface.addIndex('notificaciones_grupales', ['matrizador_id'], {
      name: 'idx_notificaciones_grupales_matrizador'
    });

    console.log('✅ Tabla notificaciones_grupales creada exitosamente');
  },

  async down(queryInterface, Sequelize) {
    // Eliminar índices primero
    await queryInterface.removeIndex('notificaciones_grupales', 'idx_notificaciones_grupales_codigo_verificacion');
    await queryInterface.removeIndex('notificaciones_grupales', 'idx_notificaciones_grupales_cliente_matrizador');
    await queryInterface.removeIndex('notificaciones_grupales', 'idx_notificaciones_grupales_estado');
    await queryInterface.removeIndex('notificaciones_grupales', 'idx_notificaciones_grupales_matrizador');
    
    // Eliminar tabla
    await queryInterface.dropTable('notificaciones_grupales');
    
    console.log('✅ Tabla notificaciones_grupales eliminada exitosamente');
  }
}; 