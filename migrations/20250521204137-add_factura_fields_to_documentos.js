'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Agregar columnas para información de factura
    await queryInterface.addColumn('documentos', 'numero_factura', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('documentos', 'valor_factura', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true
    });

    await queryInterface.addColumn('documentos', 'fecha_factura', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn('documentos', 'estado_pago', {
      type: Sequelize.ENUM('pagado', 'pendiente'),
      defaultValue: 'pendiente',
      allowNull: false
    });

    await queryInterface.addColumn('documentos', 'metodo_pago', {
      type: Sequelize.ENUM('pendiente', 'efectivo', 'tarjeta_credito', 'tarjeta_debito', 'transferencia', 'otro'),
      allowNull: true,
      defaultValue: 'pendiente'
    });

    // Columnas para omisión de notificaciones
    await queryInterface.addColumn('documentos', 'omitir_notificacion', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
    });

    await queryInterface.addColumn('documentos', 'motivo_omision', {
      type: Sequelize.ENUM('entrega_directa', 'parte_expediente', 'cliente_rechaza', 'otro'),
      allowNull: true
    });

    await queryInterface.addColumn('documentos', 'detalle_omision', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    // Columna para indicar si es documento secundario
    await queryInterface.addColumn('documentos', 'es_documento_secundario', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
    });

    // Columnas para rastrear creación
    await queryInterface.addColumn('documentos', 'id_usuario_creador', {
      type: Sequelize.INTEGER,
      allowNull: true
    });

    await queryInterface.addColumn('documentos', 'rol_usuario_creador', {
      type: Sequelize.ENUM('admin', 'matrizador', 'recepcion', 'caja'),
      allowNull: true
    });
  },

  async down (queryInterface, Sequelize) {
    // Eliminar todas las columnas en caso de rollback
    await queryInterface.removeColumn('documentos', 'numero_factura');
    await queryInterface.removeColumn('documentos', 'valor_factura');
    await queryInterface.removeColumn('documentos', 'fecha_factura');
    await queryInterface.removeColumn('documentos', 'estado_pago');
    await queryInterface.removeColumn('documentos', 'metodo_pago');
    await queryInterface.removeColumn('documentos', 'omitir_notificacion');
    await queryInterface.removeColumn('documentos', 'motivo_omision');
    await queryInterface.removeColumn('documentos', 'detalle_omision');
    await queryInterface.removeColumn('documentos', 'es_documento_secundario');
    await queryInterface.removeColumn('documentos', 'id_usuario_creador');
    await queryInterface.removeColumn('documentos', 'rol_usuario_creador');
  }
};
