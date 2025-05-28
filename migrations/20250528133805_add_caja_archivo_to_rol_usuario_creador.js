'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      console.log('🔧 Agregando valor "caja_archivo" al ENUM rol_usuario_creador...');
      
      // Método compatible para PostgreSQL - agregar valor al ENUM existente
      await queryInterface.sequelize.query(`
        ALTER TYPE enum_documentos_rol_usuario_creador 
        ADD VALUE IF NOT EXISTS 'caja_archivo';
      `);
      
      console.log('✅ Valor "caja_archivo" agregado exitosamente al ENUM rol_usuario_creador');
      
    } catch (error) {
      console.error('❌ Error al agregar valor al ENUM:', error.message);
      
      // Si el método anterior falla, intentar método alternativo
      console.log('🔄 Intentando método alternativo...');
      
      try {
        // Verificar si el valor ya existe
        const [results] = await queryInterface.sequelize.query(`
          SELECT unnest(enum_range(NULL::enum_documentos_rol_usuario_creador)) as valor;
        `);
        
        const valoresExistentes = results.map(row => row.valor);
        
        if (!valoresExistentes.includes('caja_archivo')) {
          // Si no existe, usar método de recreación del ENUM
          console.log('⚠️  Recreando ENUM con nuevo valor...');
          
          await queryInterface.sequelize.query(`
            -- Crear nuevo tipo temporal
            CREATE TYPE enum_documentos_rol_usuario_creador_new AS ENUM (
              'admin', 'matrizador', 'recepcion', 'caja', 'caja_archivo'
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
          
          console.log('✅ ENUM recreado exitosamente con valor "caja_archivo"');
        } else {
          console.log('ℹ️  El valor "caja_archivo" ya existe en el ENUM');
        }
        
      } catch (alternativeError) {
        console.error('❌ Error en método alternativo:', alternativeError.message);
        throw new Error(`No se pudo agregar "caja_archivo" al ENUM: ${alternativeError.message}`);
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    console.log('⚠️  ROLLBACK: Eliminar "caja_archivo" del ENUM requiere recreación manual');
    console.log('📝 Para hacer rollback manualmente:');
    console.log('   1. Verificar que no hay documentos con rol_usuario_creador = "caja_archivo"');
    console.log('   2. Recrear ENUM sin "caja_archivo"');
    console.log('   3. Actualizar columna al nuevo tipo');
    
    // Por seguridad, no implementamos rollback automático
    // ya que podría causar pérdida de datos si hay registros con 'caja_archivo'
  }
}; 