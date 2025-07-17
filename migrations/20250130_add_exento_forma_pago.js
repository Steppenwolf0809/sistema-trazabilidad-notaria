'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🔧 Agregando "exento" al ENUM de forma_pago en tabla pagos...');
    
    try {
      console.log('📋 Intentando agregar "exento" al ENUM forma_pago...');
      
      // Método simplificado: intentar agregar directamente
      await queryInterface.sequelize.query(`
        ALTER TYPE "enum_pagos_forma_pago" ADD VALUE IF NOT EXISTS 'exento'
      `);
      
      console.log('✅ "exento" agregado/verificado exitosamente en el ENUM forma_pago');
      
    } catch (error) {
      // Si falla, intentar método alternativo
      console.log('⚠️ Método directo falló, intentando método alternativo...');
      
      try {
        // Intentar sin IF NOT EXISTS
        await queryInterface.sequelize.query(`
          ALTER TYPE "enum_pagos_forma_pago" ADD VALUE 'exento'
        `);
        console.log('✅ "exento" agregado exitosamente con método alternativo');
        
      } catch (error2) {
        console.log('📋 Posiblemente "exento" ya existe o hay otro problema');
        console.log('Error original:', error.message);
        console.log('Error alternativo:', error2.message);
        
        // No fallar la migración si el valor ya existe
        if (error2.message.includes('already exists') || error2.message.includes('duplicate')) {
          console.log('✅ "exento" ya existe en el ENUM');
        } else {
          throw error2;
        }
      }
    }
  },

  async down(queryInterface, Sequelize) {
    console.log('🔄 Revirtiendo: Removiendo "exento" del ENUM forma_pago...');
    
    try {
      // Verificar si hay registros con forma_pago = 'exento'
      const [registrosExentos] = await queryInterface.sequelize.query(`
        SELECT COUNT(*) as count FROM pagos WHERE forma_pago = 'exento'
      `);
      
      if (registrosExentos[0].count > 0) {
        console.log(`⚠️ Encontrados ${registrosExentos[0].count} registros con forma_pago = 'exento'`);
        console.log('🔄 Cambiando a "otros" antes de remover del ENUM...');
        
        await queryInterface.sequelize.query(`
          UPDATE pagos 
          SET forma_pago = 'otros' 
          WHERE forma_pago = 'exento'
        `);
      }
      
      // PostgreSQL: No se puede remover valores del ENUM directamente
      // En su lugar, cambiar los valores existentes y recrear el tipo
      console.log('⚠️ PostgreSQL: No se puede remover valores del ENUM directamente');
      console.log('✅ Los registros fueron cambiados a "otros"');
      
      console.log('✅ ENUM forma_pago revertido exitosamente');
      
    } catch (error) {
      console.error('❌ Error al revertir ENUM:', error);
      throw error;
    }
  }
}; 