/**
 * Migración para simplificar el sistema de notificaciones a solo WhatsApp
 * - Actualiza el enum metodo_notificacion para solo permitir 'whatsapp' y 'ninguno'
 * - Convierte datos existentes: 'email' y 'ambos' → 'whatsapp'
 */

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('🔧 Iniciando migración para simplificar notificaciones a solo WhatsApp...');
      
      // 1. Actualizar registros existentes para convertir email y ambos a whatsapp
      console.log('📋 Actualizando registros existentes de documentos...');
      
      await queryInterface.sequelize.query(`
        UPDATE documentos 
        SET metodo_notificacion = 'whatsapp' 
        WHERE metodo_notificacion IN ('email', 'ambos')
      `, { transaction });
      
      const [results] = await queryInterface.sequelize.query(`
        SELECT COUNT(*) as total FROM documentos 
        WHERE metodo_notificacion = 'whatsapp'
      `, { transaction });
      
      console.log(`✅ Documentos actualizados a WhatsApp: ${results[0]?.total || 0}`);
      
      // 2. Verificar que no hay valores no válidos
      const [invalidResults] = await queryInterface.sequelize.query(`
        SELECT COUNT(*) as total FROM documentos 
        WHERE metodo_notificacion NOT IN ('whatsapp', 'ninguno')
      `, { transaction });
      
      if (invalidResults[0]?.total > 0) {
        console.log(`⚠️ Encontrados ${invalidResults[0].total} registros con valores no válidos, corrigiendo...`);
        
        // Convertir cualquier valor no válido a 'whatsapp' por defecto
        await queryInterface.sequelize.query(`
          UPDATE documentos 
          SET metodo_notificacion = 'whatsapp' 
          WHERE metodo_notificacion NOT IN ('whatsapp', 'ninguno')
        `, { transaction });
      }
      
      // 3. Eliminar el enum existente y crear uno nuevo (solo en PostgreSQL)
      // En MySQL/MariaDB se manejará diferente
      const dialect = queryInterface.sequelize.getDialect();
      
      if (dialect === 'postgres') {
        console.log('🔧 Actualizando enum en PostgreSQL...');
        
        // Crear nuevo enum
        await queryInterface.sequelize.query(`
          CREATE TYPE metodo_notificacion_nuevo AS ENUM ('whatsapp', 'ninguno')
        `, { transaction });
        
        // Cambiar columna al nuevo tipo
        await queryInterface.sequelize.query(`
          ALTER TABLE documentos 
          ALTER COLUMN metodo_notificacion TYPE metodo_notificacion_nuevo 
          USING metodo_notificacion::text::metodo_notificacion_nuevo
        `, { transaction });
        
        // Eliminar enum anterior
        await queryInterface.sequelize.query(`
          DROP TYPE IF EXISTS metodo_notificacion_enum
        `, { transaction });
        
        // Renombrar nuevo enum
        await queryInterface.sequelize.query(`
          ALTER TYPE metodo_notificacion_nuevo RENAME TO metodo_notificacion_enum
        `, { transaction });
        
      } else {
        console.log('🔧 Actualizando enum en MySQL/MariaDB...');
        
        // En MySQL, cambiar el tipo de la columna directamente
        await queryInterface.changeColumn('documentos', 'metodo_notificacion', {
          type: Sequelize.ENUM('whatsapp', 'ninguno'),
          allowNull: false,
          defaultValue: 'whatsapp'
        }, { transaction });
      }
      
      // 4. Verificar resultado final
      const [finalResults] = await queryInterface.sequelize.query(`
        SELECT 
          metodo_notificacion, 
          COUNT(*) as total 
        FROM documentos 
        GROUP BY metodo_notificacion 
        ORDER BY total DESC
      `, { transaction });
      
      console.log('📊 Distribución final de métodos de notificación:');
      finalResults.forEach(row => {
        console.log(`   - ${row.metodo_notificacion}: ${row.total} documentos`);
      });
      
      await transaction.commit();
      console.log('✅ Migración completada exitosamente');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error en migración:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('🔄 Revirtiendo migración de notificaciones...');
      
      const dialect = queryInterface.sequelize.getDialect();
      
      if (dialect === 'postgres') {
        // Recrear enum original
        await queryInterface.sequelize.query(`
          CREATE TYPE metodo_notificacion_original AS ENUM ('whatsapp', 'email', 'ambos', 'ninguno')
        `, { transaction });
        
        // Cambiar columna al tipo original
        await queryInterface.sequelize.query(`
          ALTER TABLE documentos 
          ALTER COLUMN metodo_notificacion TYPE metodo_notificacion_original 
          USING metodo_notificacion::text::metodo_notificacion_original
        `, { transaction });
        
        // Eliminar enum nuevo
        await queryInterface.sequelize.query(`
          DROP TYPE IF EXISTS metodo_notificacion_enum
        `, { transaction });
        
        // Renombrar enum original
        await queryInterface.sequelize.query(`
          ALTER TYPE metodo_notificacion_original RENAME TO metodo_notificacion_enum
        `, { transaction });
        
      } else {
        // En MySQL, restaurar enum original
        await queryInterface.changeColumn('documentos', 'metodo_notificacion', {
          type: Sequelize.ENUM('whatsapp', 'email', 'ambos', 'ninguno'),
          allowNull: false,
          defaultValue: 'ambos'
        }, { transaction });
      }
      
      console.log('✅ Enum restaurado a versión original');
      
      await transaction.commit();
      console.log('✅ Reversión completada');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error en reversión:', error);
      throw error;
    }
  }
}; 