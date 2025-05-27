'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Crear tabla notificaciones_enviadas
    await queryInterface.createTable('notificaciones_enviadas', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      documento_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'documentos',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      tipo_evento: {
        type: Sequelize.ENUM('documento_listo', 'entrega_confirmada', 'recordatorio', 'alerta_sin_recoger'),
        allowNull: false,
        comment: 'Tipo de evento que generó la notificación'
      },
      canal: {
        type: Sequelize.ENUM('whatsapp', 'email', 'sms'),
        allowNull: false,
        comment: 'Canal utilizado para enviar la notificación'
      },
      destinatario: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Email, teléfono o identificador del destinatario'
      },
      estado: {
        type: Sequelize.ENUM('enviado', 'fallido', 'pendiente', 'simulado'),
        defaultValue: 'pendiente',
        allowNull: false,
        comment: 'Estado actual de la notificación'
      },
      mensaje_enviado: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Contenido del mensaje enviado'
      },
      respuesta_api: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Respuesta completa de la API externa (WhatsApp, Email, etc.)'
      },
      intentos: {
        type: Sequelize.INTEGER,
        defaultValue: 1,
        allowNull: false,
        comment: 'Número de intentos de envío realizados'
      },
      ultimo_error: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Último error registrado en caso de fallo'
      },
      proximo_intento: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Fecha programada para el próximo intento de envío'
      },
      metadatos: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: {},
        comment: 'Información adicional sobre la notificación'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Crear índices para optimizar consultas
    await queryInterface.addIndex('notificaciones_enviadas', ['documento_id'], {
      name: 'idx_notificaciones_documento_id'
    });

    await queryInterface.addIndex('notificaciones_enviadas', ['tipo_evento'], {
      name: 'idx_notificaciones_tipo_evento'
    });

    await queryInterface.addIndex('notificaciones_enviadas', ['canal'], {
      name: 'idx_notificaciones_canal'
    });

    await queryInterface.addIndex('notificaciones_enviadas', ['estado'], {
      name: 'idx_notificaciones_estado'
    });

    await queryInterface.addIndex('notificaciones_enviadas', ['created_at'], {
      name: 'idx_notificaciones_created_at'
    });

    await queryInterface.addIndex('notificaciones_enviadas', ['proximo_intento'], {
      name: 'idx_notificaciones_proximo_intento'
    });

    console.log('✅ Tabla notificaciones_enviadas creada con índices');
  },

  async down (queryInterface, Sequelize) {
    // Eliminar índices primero
    const indices = [
      'idx_notificaciones_documento_id',
      'idx_notificaciones_tipo_evento',
      'idx_notificaciones_canal',
      'idx_notificaciones_estado',
      'idx_notificaciones_created_at',
      'idx_notificaciones_proximo_intento'
    ];

    for (const indice of indices) {
      try {
        await queryInterface.removeIndex('notificaciones_enviadas', indice);
      } catch (error) {
        console.log(`Error al eliminar índice ${indice}:`, error.message);
      }
    }

    // Eliminar tabla
    await queryInterface.dropTable('notificaciones_enviadas');

    // Eliminar ENUMs
    try {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_notificaciones_enviadas_tipo_evento";');
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_notificaciones_enviadas_canal";');
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_notificaciones_enviadas_estado";');
    } catch (error) {
      console.log('Error al eliminar ENUMs:', error.message);
    }

    console.log('✅ Tabla notificaciones_enviadas eliminada');
  }
}; 