/**
 * Migración: Agregar campos de notificación grupal a tabla documentos
 * Fecha: 20/01/2025
 * Propósito: Agregar campos para relacionar documentos con notificaciones grupales
 */

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Agregar campo notificacion_grupal_id
    await queryInterface.addColumn('documentos', 'notificacion_grupal_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'notificaciones_grupales',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'ID del grupo de notificación al que pertenece este documento'
    });

    // Agregar campo es_lider_grupo
    await queryInterface.addColumn('documentos', 'es_lider_grupo', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: 'True si es el documento principal/líder del grupo de notificación'
    });

    // Crear índices para optimizar consultas
    await queryInterface.addIndex('documentos', ['notificacion_grupal_id'], {
      name: 'idx_documentos_notificacion_grupal'
    });

    await queryInterface.addIndex('documentos', ['es_lider_grupo'], {
      name: 'idx_documentos_es_lider_grupo'
    });

    // Índice compuesto para consultas optimizadas
    await queryInterface.addIndex('documentos', ['notificacion_grupal_id', 'es_lider_grupo'], {
      name: 'idx_documentos_grupo_lider'
    });

    console.log('✅ Campos de notificación grupal agregados a tabla documentos');
  },

  async down(queryInterface, Sequelize) {
    // Eliminar índices primero
    await queryInterface.removeIndex('documentos', 'idx_documentos_notificacion_grupal');
    await queryInterface.removeIndex('documentos', 'idx_documentos_es_lider_grupo');
    await queryInterface.removeIndex('documentos', 'idx_documentos_grupo_lider');
    
    // Eliminar columnas
    await queryInterface.removeColumn('documentos', 'notificacion_grupal_id');
    await queryInterface.removeColumn('documentos', 'es_lider_grupo');
    
    console.log('✅ Campos de notificación grupal eliminados de tabla documentos');
  }
}; 