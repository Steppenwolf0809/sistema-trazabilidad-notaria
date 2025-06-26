/**
 * Script de migración para agregar campos de autorización de crédito
 * Ejecutar con: node migrations/ejecutar-migracion-autorizacion-credito.js
 */

const { sequelize } = require('../config/database');

async function ejecutarMigracion() {
  console.log('🔧 Iniciando migración: Campos de autorización de crédito...');
  
  try {
    // Verificar conexión
    await sequelize.authenticate();
    console.log('✅ Conexión a la base de datos establecida');
    
    // Obtener QueryInterface
    const queryInterface = sequelize.getQueryInterface();
    
    // Ejecutar todas las alteraciones en una transacción
    const transaction = await sequelize.transaction();
    
    try {
      console.log('📝 Agregando campo: entrega_sin_verificar_pago...');
      await queryInterface.addColumn('documentos', 'entrega_sin_verificar_pago', {
        type: sequelize.Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Indica si el cliente tiene crédito autorizado y puede retirar sin pago previo'
      }, { transaction });
      
      console.log('📝 Agregando campo: justificacion_entrega_sin_pago...');
      await queryInterface.addColumn('documentos', 'justificacion_entrega_sin_pago', {
        type: sequelize.Sequelize.ENUM('cliente_corporativo', 'historial_pagos', 'urgencia_justificada', 'cliente_frecuente', 'otro'),
        allowNull: true,
        comment: 'Justificación para autorizar entrega sin verificación de pago'
      }, { transaction });
      
      console.log('📝 Agregando campo: fecha_autorizacion_entrega...');
      await queryInterface.addColumn('documentos', 'fecha_autorizacion_entrega', {
        type: sequelize.Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp de cuando se autorizó la entrega sin verificación de pago'
      }, { transaction });
      
      console.log('📝 Agregando campo: autorizado_por_matrizador_id...');
      await queryInterface.addColumn('documentos', 'autorizado_por_matrizador_id', {
        type: sequelize.Sequelize.INTEGER,
        allowNull: true,
        comment: 'ID del matrizador que autorizó la entrega sin verificación de pago',
        references: {
          model: 'matrizadores',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      }, { transaction });
      
      console.log('📝 Agregando índices para mejor performance...');
      
      // Índice en entrega_sin_verificar_pago
      await queryInterface.addIndex('documentos', ['entrega_sin_verificar_pago'], {
        name: 'idx_entrega_sin_verificar_pago',
        transaction
      });
      
      // Índice en autorizado_por_matrizador_id
      await queryInterface.addIndex('documentos', ['autorizado_por_matrizador_id'], {
        name: 'idx_autorizado_por_matrizador',
        transaction
      });
      
      await transaction.commit();
      
      console.log('✅ Migración completada exitosamente!');
      console.log('📊 Campos agregados:');
      console.log('   - entrega_sin_verificar_pago (BOOLEAN)');
      console.log('   - justificacion_entrega_sin_pago (ENUM)');
      console.log('   - fecha_autorizacion_entrega (DATE)');
      console.log('   - autorizado_por_matrizador_id (INTEGER FK)');
      console.log('📈 Índices creados:');
      console.log('   - idx_entrega_sin_verificar_pago');
      console.log('   - idx_autorizado_por_matrizador');
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Error en la migración:', error);
    
    // Verificar si los campos ya existen
    if (error.original && error.original.code === 'ER_DUP_FIELDNAME') {
      console.log('⚠️ Los campos ya existen en la base de datos. Migración omitida.');
    } else {
      throw error;
    }
  } finally {
    await sequelize.close();
    console.log('🔐 Conexión a la base de datos cerrada');
  }
}

// Ejecutar migración si el script se ejecuta directamente
if (require.main === module) {
  ejecutarMigracion()
    .then(() => {
      console.log('🎉 Proceso completado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { ejecutarMigracion }; 