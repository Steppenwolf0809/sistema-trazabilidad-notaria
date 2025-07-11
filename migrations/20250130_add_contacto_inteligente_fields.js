/**
 * Migración: Agregar campos del sistema de contactos inteligente
 * Fecha: 2025-01-30
 * Propósito: Agregar campos necesarios para el sistema de contactos inteligente
 */

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔄 Agregando campos del sistema de contactos inteligente...');
    
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Verificar si la tabla documentos existe
      const tableExists = await queryInterface.describeTable('documentos');
      if (!tableExists) {
        throw new Error('La tabla documentos no existe');
      }
      
      // Agregar campo telefono_whatsapp
      await queryInterface.addColumn('documentos', 'telefono_whatsapp', {
        type: Sequelize.STRING(15),
        allowNull: true,
        comment: 'Número de teléfono validado para notificaciones WhatsApp'
      }, { transaction });
      
      // Agregar campo contacto_validado
      await queryInterface.addColumn('documentos', 'contacto_validado', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Indica si el contacto ha sido validado por el sistema inteligente'
      }, { transaction });
      
      // Agregar campo contacto_conflicto
      await queryInterface.addColumn('documentos', 'contacto_conflicto', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Indica si hay conflicto entre contacto XML y base de datos local'
      }, { transaction });
      
      // Agregar campo contacto_datos_analisis
      await queryInterface.addColumn('documentos', 'contacto_datos_analisis', {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Datos del análisis del sistema inteligente de contactos'
      }, { transaction });
      
      await transaction.commit();
      console.log('✅ Campos del sistema de contactos inteligente agregados exitosamente');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error en migración:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 Eliminando campos del sistema de contactos inteligente...');
    
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Eliminar campos en orden inverso
      await queryInterface.removeColumn('documentos', 'contacto_datos_analisis', { transaction });
      await queryInterface.removeColumn('documentos', 'contacto_conflicto', { transaction });
      await queryInterface.removeColumn('documentos', 'contacto_validado', { transaction });
      await queryInterface.removeColumn('documentos', 'telefono_whatsapp', { transaction });
      
      await transaction.commit();
      console.log('✅ Campos del sistema de contactos inteligente eliminados exitosamente');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error en rollback:', error);
      throw error;
    }
  }
}; 