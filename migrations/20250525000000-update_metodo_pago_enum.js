'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Paso 1: Obtener los valores actuales
    await queryInterface.sequelize.query(`
      UPDATE documentos 
      SET metodo_pago = 'pendiente'
      WHERE metodo_pago IS NULL
    `);

    // Paso 2: Migrar la tabla documentos
    await queryInterface.changeColumn('documentos', 'metodo_pago', {
      type: Sequelize.ENUM('pendiente', 'efectivo', 'tarjeta_credito', 'tarjeta_debito', 'transferencia', 'otro')
    });

    // Paso 3: Actualizar valores antiguos a nuevos
    await queryInterface.sequelize.query(`
      UPDATE documentos 
      SET metodo_pago = 'tarjeta_credito'
      WHERE metodo_pago = 'tarjeta'
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // Revertir a los valores originales
    await queryInterface.sequelize.query(`
      UPDATE documentos 
      SET metodo_pago = 'tarjeta'
      WHERE metodo_pago IN ('tarjeta_credito', 'tarjeta_debito')
    `);

    await queryInterface.changeColumn('documentos', 'metodo_pago', {
      type: Sequelize.ENUM('efectivo', 'tarjeta', 'transferencia', 'otro')
    });
  }
}; 