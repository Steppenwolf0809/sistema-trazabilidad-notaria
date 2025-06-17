'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      console.log('🔧 Agregando rol "archivo" al ENUM de roles...');
      
      // Agregar el rol 'archivo' al ENUM existente
      await queryInterface.sequelize.query(`
        ALTER TYPE "enum_matrizadores_rol" ADD VALUE 'archivo';
      `);
      
      console.log('✅ Rol archivo agregado exitosamente al ENUM');
      
      // También agregar a enum de rol_usuario_creador en documentos
      console.log('🔧 Agregando "archivo" al ENUM rol_usuario_creador...');
      
      await queryInterface.sequelize.query(`
        ALTER TYPE enum_documentos_rol_usuario_creador 
        ADD VALUE IF NOT EXISTS 'archivo';
      `);
      
      console.log('✅ Valor "archivo" agregado exitosamente al ENUM rol_usuario_creador');
      
    } catch (error) {
      console.error('❌ Error al agregar rol archivo:', error.message);
      
      // Si el método anterior falla, intentar método alternativo para rol_usuario_creador
      try {
        console.log('🔄 Intentando método alternativo para rol_usuario_creador...');
        
        // Verificar si el valor ya existe
        const [results] = await queryInterface.sequelize.query(`
          SELECT unnest(enum_range(NULL::enum_documentos_rol_usuario_creador)) as valor;
        `);
        
        const valoresExistentes = results.map(row => row.valor);
        
        if (!valoresExistentes.includes('archivo')) {
          // Recrear ENUM con nuevo valor
          await queryInterface.sequelize.query(`
            -- Crear nuevo tipo temporal
            CREATE TYPE enum_documentos_rol_usuario_creador_new AS ENUM (
              'admin', 'matrizador', 'recepcion', 'caja', 'caja_archivo', 'archivo'
            );
            
            -- Actualizar columna al nuevo tipo
            ALTER TABLE documentos 
            ALTER COLUMN rol_usuario_creador TYPE enum_documentos_rol_usuario_creador_new 
            USING rol_usuario_creador::text::enum_documentos_rol_usuario_creador_new;
            
            -- Eliminar tipo anterior
            DROP TYPE enum_documentos_rol_usuario_creador;
            
            -- Renombrar nuevo tipo
            ALTER TYPE enum_documentos_rol_usuario_creador_new 
            RENAME TO enum_documentos_rol_usuario_creador;
          `);
          
          console.log('✅ ENUM rol_usuario_creador recreado exitosamente con valor "archivo"');
        } else {
          console.log('ℹ️  El valor "archivo" ya existe en el ENUM rol_usuario_creador');
        }
        
      } catch (alternativeError) {
        console.error('❌ Error en método alternativo:', alternativeError.message);
        throw new Error(`No se pudo agregar "archivo" al ENUM: ${alternativeError.message}`);
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    console.log('⚠️ Para hacer rollback de esta migración:');
    console.log('1. Cambiar todos los usuarios con rol archivo a otro rol');
    console.log('2. Recrear el ENUM sin archivo');
    console.log('3. Esto requiere intervención manual en producción');
    
    // Por seguridad, no implementamos rollback automático
    throw new Error('Rollback manual requerido para esta migración');
  }
}; 