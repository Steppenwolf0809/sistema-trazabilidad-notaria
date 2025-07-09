/**
 * 🚨 MIGRACIÓN CRÍTICA: Crear tabla PAGOS
 * Esta migración resuelve el error SequelizeDatabaseError: relation "pagos" does not exist
 * La tabla pagos es fundamental para el funcionamiento del sistema de caja
 */

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🚨 EJECUTANDO MIGRACIÓN CRÍTICA: Creando tabla PAGOS...');
    
    try {
      // Crear la tabla pagos con todas las columnas necesarias
      await queryInterface.createTable('pagos', {
        // ID único del pago
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false
        },
        
        // ID del documento al que pertenece el pago
        documento_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'documentos',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT'
        },
        
        // ID del usuario que registró el pago
        usuario_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'matrizadores',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT'
        },
        
        // Monto del pago
        monto: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false
        },
        
        // Forma de pago utilizada
        forma_pago: {
          type: Sequelize.ENUM('efectivo', 'transferencia', 'cheque', 'tarjeta_credito', 'tarjeta_debito', 'otros'),
          allowNull: false
        },
        
        // Número de comprobante (opcional)
        numero_comprobante: {
          type: Sequelize.STRING(100),
          allowNull: true
        },
        
        // Indica si este pago es una retención
        es_retencion: {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
          allowNull: false
        },
        
        // Observaciones del pago
        observaciones: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        
        // Fecha del pago
        fecha_pago: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        
        // Metadatos adicionales (JSON)
        metadatos: {
          type: Sequelize.JSON,
          allowNull: true,
          defaultValue: {}
        },
        
        // ================ CAMPOS PARA SISTEMA DE REVERSIONES ================
        
        // Indica si este pago ha sido revertido
        revertido: {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
          allowNull: false
        },
        
        // Fecha de reversión
        fecha_reversion: {
          type: Sequelize.DATE,
          allowNull: true
        },
        
        // Motivo de la reversión
        motivo_reversion: {
          type: Sequelize.STRING,
          allowNull: true
        },
        
        // Justificación de la reversión
        justificacion_reversion: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        
        // Timestamps automáticos
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      });
      
      // Crear índices para mejorar performance
      await queryInterface.addIndex('pagos', ['documento_id'], {
        name: 'idx_pagos_documento_id'
      });
      
      await queryInterface.addIndex('pagos', ['usuario_id'], {
        name: 'idx_pagos_usuario_id'
      });
      
      await queryInterface.addIndex('pagos', ['fecha_pago'], {
        name: 'idx_pagos_fecha_pago'
      });
      
      await queryInterface.addIndex('pagos', ['revertido'], {
        name: 'idx_pagos_revertido'
      });
      
      console.log('✅ Tabla PAGOS creada exitosamente con todos los índices');
      console.log('✅ Problema SequelizeDatabaseError: relation "pagos" does not exist - RESUELTO');
      
    } catch (error) {
      console.error('❌ Error crítico creando tabla PAGOS:', error.message);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 REVIRTIENDO: Eliminando tabla PAGOS...');
    
    try {
      // Eliminar índices primero
      await queryInterface.removeIndex('pagos', 'idx_pagos_documento_id');
      await queryInterface.removeIndex('pagos', 'idx_pagos_usuario_id');
      await queryInterface.removeIndex('pagos', 'idx_pagos_fecha_pago');
      await queryInterface.removeIndex('pagos', 'idx_pagos_revertido');
      
      // Eliminar tabla
      await queryInterface.dropTable('pagos');
      
      console.log('✅ Tabla PAGOS eliminada correctamente');
      
    } catch (error) {
      console.error('❌ Error revirtiendo migración de PAGOS:', error.message);
      throw error;
    }
  }
}; 