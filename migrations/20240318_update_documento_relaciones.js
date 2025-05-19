'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Primero, eliminar índices existentes si existen
    await queryInterface.removeIndex('documento_relaciones', 'documento_relaciones_id_documento_principal_id_documento_relacionado_key');
    await queryInterface.removeIndex('documento_relaciones', 'documento_relaciones_es_principal_idx');
    
    // Crear nuevos índices con nombres específicos
    await queryInterface.addIndex('documento_relaciones', ['id_documento_principal'], {
      name: 'idx_doc_rel_principal'
    });
    
    await queryInterface.addIndex('documento_relaciones', ['id_documento_relacionado'], {
      name: 'idx_doc_rel_relacionado'
    });
    
    await queryInterface.addIndex('documento_relaciones', ['grupo_entrega'], {
      name: 'idx_doc_rel_grupo'
    });
    
    await queryInterface.addIndex('documento_relaciones', ['id_documento_principal', 'id_documento_relacionado'], {
      name: 'idx_doc_rel_principal_relacionado',
      unique: true
    });
    
    // Modificar el tipo de columna tipo_relacion
    await queryInterface.changeColumn('documento_relaciones', 'tipo_relacion', {
      type: Sequelize.ENUM('componente', 'relacionado', 'anexo'),
      allowNull: false
    });
    
    // Modificar el tipo de columna grupo_entrega
    await queryInterface.changeColumn('documento_relaciones', 'grupo_entrega', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Eliminar los nuevos índices
    await queryInterface.removeIndex('documento_relaciones', 'idx_doc_rel_principal');
    await queryInterface.removeIndex('documento_relaciones', 'idx_doc_rel_relacionado');
    await queryInterface.removeIndex('documento_relaciones', 'idx_doc_rel_grupo');
    await queryInterface.removeIndex('documento_relaciones', 'idx_doc_rel_principal_relacionado');
    
    // Restaurar el tipo de columna tipo_relacion
    await queryInterface.changeColumn('documento_relaciones', 'tipo_relacion', {
      type: Sequelize.STRING,
      allowNull: false
    });
    
    // Restaurar el tipo de columna grupo_entrega
    await queryInterface.changeColumn('documento_relaciones', 'grupo_entrega', {
      type: Sequelize.UUID,
      allowNull: true
    });
    
    // Restaurar índices originales
    await queryInterface.addIndex('documento_relaciones', ['id_documento_principal', 'id_documento_relacionado'], {
      unique: true
    });
    
    await queryInterface.addIndex('documento_relaciones', ['es_principal']);
  }
}; 