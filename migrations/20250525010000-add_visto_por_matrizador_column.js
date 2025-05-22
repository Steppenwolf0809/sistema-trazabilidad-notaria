'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Añadir columna visto_por_matrizador
    await queryInterface.addColumn('documentos', 'visto_por_matrizador', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Eliminar columna visto_por_matrizador
    await queryInterface.removeColumn('documentos', 'visto_por_matrizador');
  }
}; 