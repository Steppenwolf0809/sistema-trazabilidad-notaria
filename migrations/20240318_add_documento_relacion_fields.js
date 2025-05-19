'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Agregar nuevos campos a la tabla documento_relaciones
    await queryInterface.addColumn('documento_relaciones', 'es_principal', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    await queryInterface.addColumn('documento_relaciones', 'grupo_entrega', {
      type: Sequelize.UUID,
      allowNull: true
    });

    // Agregar índices para mejorar el rendimiento
    await queryInterface.addIndex('documento_relaciones', ['grupo_entrega']);
    await queryInterface.addIndex('documento_relaciones', ['es_principal']);

    // Actualizar el enum de tipo_relacion para incluir 'componente_de'
    await queryInterface.sequelize.query(`
      ALTER TABLE documento_relaciones 
      DROP CONSTRAINT IF EXISTS documento_relaciones_tipo_relacion_check;
      
      ALTER TABLE documento_relaciones 
      ADD CONSTRAINT documento_relaciones_tipo_relacion_check 
      CHECK (tipo_relacion IN ('relacionado', 'deriva_de', 'complementa', 'reemplaza', 'componente_de', 'otro'));
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // Eliminar índices
    await queryInterface.removeIndex('documento_relaciones', ['grupo_entrega']);
    await queryInterface.removeIndex('documento_relaciones', ['es_principal']);

    // Eliminar columnas
    await queryInterface.removeColumn('documento_relaciones', 'es_principal');
    await queryInterface.removeColumn('documento_relaciones', 'grupo_entrega');

    // Restaurar el enum original
    await queryInterface.sequelize.query(`
      ALTER TABLE documento_relaciones 
      DROP CONSTRAINT IF EXISTS documento_relaciones_tipo_relacion_check;
      
      ALTER TABLE documento_relaciones 
      ADD CONSTRAINT documento_relaciones_tipo_relacion_check 
      CHECK (tipo_relacion IN ('relacionado', 'deriva_de', 'complementa', 'reemplaza', 'otro'));
    `);
  }
}; 