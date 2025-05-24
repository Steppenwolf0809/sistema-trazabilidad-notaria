'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // ============== LIMPIEZA DE CAMPOS PROBLEMÁTICOS ==============
    
    // Eliminar campos duplicados o problemáticos si existen
    try {
      await queryInterface.removeColumn('documentos', 'fecha_creacion');
    } catch (error) {
      console.log('Campo fecha_creacion no existe, continuando...');
    }
    
    try {
      await queryInterface.removeColumn('documentos', 'fecha_registro_pago');
    } catch (error) {
      console.log('Campo fecha_registro_pago no existe, continuando...');
    }
    
    try {
      await queryInterface.removeColumn('documentos', 'fecha_eliminacion');
    } catch (error) {
      console.log('Campo fecha_eliminacion no existe, continuando...');
    }
    
    // ============== AGREGAR CAMPOS SIMPLIFICADOS ==============
    
    // Agregar fecha_pago (reemplaza fecha_registro_pago)
    try {
      await queryInterface.addColumn('documentos', 'fecha_pago', {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp de cuando se registró el pago en el sistema'
      });
    } catch (error) {
      console.log('Campo fecha_pago ya existe, continuando...');
    }
    
    // Asegurar que fecha_factura sea DATEONLY (solo fecha)
    try {
      await queryInterface.changeColumn('documentos', 'fecha_factura', {
        type: Sequelize.DATEONLY,
        allowNull: true,
        comment: 'Fecha del documento original extraída del XML (DD/MM/YYYY)'
      });
    } catch (error) {
      console.log('Error al cambiar tipo de fecha_factura:', error.message);
    }
    
    // Agregar columnas para información de factura si no existen
    try {
      await queryInterface.addColumn('documentos', 'numero_factura', {
        type: Sequelize.STRING,
        allowNull: true
      });
    } catch (error) {
      console.log('Campo numero_factura ya existe, continuando...');
    }

    try {
      await queryInterface.addColumn('documentos', 'valor_factura', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      });
    } catch (error) {
      console.log('Campo valor_factura ya existe, continuando...');
    }

    try {
      await queryInterface.addColumn('documentos', 'estado_pago', {
        type: Sequelize.ENUM('pagado', 'pendiente'),
        defaultValue: 'pendiente',
        allowNull: false
      });
    } catch (error) {
      console.log('Campo estado_pago ya existe, continuando...');
    }

    try {
      await queryInterface.addColumn('documentos', 'metodo_pago', {
        type: Sequelize.ENUM('pendiente', 'efectivo', 'tarjeta_credito', 'tarjeta_debito', 'transferencia', 'otro'),
        allowNull: true,
        defaultValue: 'pendiente'
      });
    } catch (error) {
      console.log('Campo metodo_pago ya existe, continuando...');
    }

    // Columnas para omisión de notificaciones
    try {
      await queryInterface.addColumn('documentos', 'omitir_notificacion', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      });
    } catch (error) {
      console.log('Campo omitir_notificacion ya existe, continuando...');
    }

    try {
      await queryInterface.addColumn('documentos', 'motivo_omision', {
        type: Sequelize.ENUM('entrega_directa', 'parte_expediente', 'cliente_rechaza', 'otro'),
        allowNull: true
      });
    } catch (error) {
      console.log('Campo motivo_omision ya existe, continuando...');
    }

    try {
      await queryInterface.addColumn('documentos', 'detalle_omision', {
        type: Sequelize.TEXT,
        allowNull: true
      });
    } catch (error) {
      console.log('Campo detalle_omision ya existe, continuando...');
    }

    // Columna para indicar si es documento secundario
    try {
      await queryInterface.addColumn('documentos', 'es_documento_secundario', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      });
    } catch (error) {
      console.log('Campo es_documento_secundario ya existe, continuando...');
    }

    // Columnas para rastrear creación
    try {
      await queryInterface.addColumn('documentos', 'id_usuario_creador', {
        type: Sequelize.INTEGER,
        allowNull: true
      });
    } catch (error) {
      console.log('Campo id_usuario_creador ya existe, continuando...');
    }

    try {
      await queryInterface.addColumn('documentos', 'rol_usuario_creador', {
        type: Sequelize.ENUM('admin', 'matrizador', 'recepcion', 'caja'),
        allowNull: true
      });
    } catch (error) {
      console.log('Campo rol_usuario_creador ya existe, continuando...');
    }
    
    // Campo para auditoría de pagos
    try {
      await queryInterface.addColumn('documentos', 'registrado_por', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'matrizadores',
          key: 'id'
        }
      });
    } catch (error) {
      console.log('Campo registrado_por ya existe, continuando...');
    }
  },

  async down (queryInterface, Sequelize) {
    // Eliminar todas las columnas en caso de rollback
    const columnas = [
      'numero_factura',
      'valor_factura', 
      'fecha_factura',
      'fecha_pago',
      'estado_pago',
      'metodo_pago',
      'omitir_notificacion',
      'motivo_omision',
      'detalle_omision',
      'es_documento_secundario',
      'id_usuario_creador',
      'rol_usuario_creador',
      'registrado_por'
    ];
    
    for (const columna of columnas) {
      try {
        await queryInterface.removeColumn('documentos', columna);
      } catch (error) {
        console.log(`Error al eliminar columna ${columna}:`, error.message);
      }
    }
  }
};
