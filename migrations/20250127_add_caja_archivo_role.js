'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Agregar el rol 'caja_archivo' al ENUM existente
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_matrizadores_rol" ADD VALUE 'caja_archivo';
    `);
    
    console.log('✅ Rol caja_archivo agregado exitosamente al ENUM');
  },

  down: async (queryInterface, Sequelize) => {
    // Para rollback, necesitaríamos recrear el ENUM sin caja_archivo
    // Esto es más complejo en PostgreSQL, por lo que documentamos el proceso
    console.log('⚠️ Para hacer rollback de esta migración:');
    console.log('1. Cambiar todos los usuarios con rol caja_archivo a otro rol');
    console.log('2. Recrear el ENUM sin caja_archivo');
    console.log('3. Esto requiere intervención manual en producción');
    
    // Por seguridad, no implementamos rollback automático
    throw new Error('Rollback manual requerido para esta migración');
  }
}; 