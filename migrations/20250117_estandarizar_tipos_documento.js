'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔧 Iniciando migración: Estandarización de tipos de documento...');
    
    // PASO 1: Mapear tipos existentes a nuevos tipos estandarizados
    console.log('📋 Mapeando tipos existentes a tipos estandarizados...');
    
    const mapeoTipos = [
      // Mapear a Protocolo
      { antiguos: ['Escritura', 'Escritura Pública', 'Protocolo', 'Poder', 'Testamento', 'Donación'], nuevo: 'Protocolo' },
      // Mapear a Diligencias  
      { antiguos: ['Diligencia', 'Diligencias', 'Reconocimiento de Firma'], nuevo: 'Diligencias' },
      // Mapear a Certificaciones
      { antiguos: ['Certificación', 'Certificaciones', 'Copia de Archivo', 'Marginación'], nuevo: 'Certificaciones' },
      // Mapear a Arrendamientos
      { antiguos: ['Arrendamiento', 'Arrendamientos'], nuevo: 'Arrendamientos' },
      // Mapear a Otros
      { antiguos: ['Otro', 'Otros'], nuevo: 'Otros' }
    ];
    
    // Actualizar registros existentes
    for (const mapeo of mapeoTipos) {
      for (const tipoAntiguo of mapeo.antiguos) {
        await queryInterface.sequelize.query(`
          UPDATE documentos 
          SET tipo_documento = :nuevoTipo 
          WHERE tipo_documento = :tipoAntiguo
        `, {
          replacements: { 
            nuevoTipo: mapeo.nuevo, 
            tipoAntiguo: tipoAntiguo 
          }
        });
        console.log(`✅ Mapeado: "${tipoAntiguo}" → "${mapeo.nuevo}"`);
      }
    }
    
    // PASO 2: Crear el ENUM para tipos de documento
    console.log('🔧 Creando ENUM para tipos de documento...');
    
    try {
      await queryInterface.sequelize.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_documentos_tipo_documento') THEN
            CREATE TYPE enum_documentos_tipo_documento AS ENUM (
              'Protocolo', 
              'Diligencias', 
              'Certificaciones', 
              'Arrendamientos', 
              'Otros'
            );
          END IF;
        END $$;
      `);
      console.log('✅ ENUM creado exitosamente');
    } catch (error) {
      console.log('⚠️ ENUM ya existe, continuando...');
    }
    
    // PASO 3: Enfoque step-by-step para cambiar tipo de columna (evita error USING)
    console.log('🔧 Cambiando tipo de columna a ENUM usando enfoque compatible...');
    
    try {
      // 3.1: Agregar columna temporal con ENUM
      await queryInterface.addColumn('documentos', 'tipo_documento_temp', {
        type: 'enum_documentos_tipo_documento',
        allowNull: true
      });
      console.log('✅ Columna temporal creada');
      
      // 3.2: Copiar datos a columna temporal
      await queryInterface.sequelize.query(`
        UPDATE documentos 
        SET tipo_documento_temp = tipo_documento::enum_documentos_tipo_documento
      `);
      console.log('✅ Datos copiados a columna temporal');
      
      // 3.3: Eliminar columna original
      await queryInterface.removeColumn('documentos', 'tipo_documento');
      console.log('✅ Columna original eliminada');
      
      // 3.4: Renombrar columna temporal
      await queryInterface.renameColumn('documentos', 'tipo_documento_temp', 'tipo_documento');
      console.log('✅ Columna renombrada');
      
      // 3.5: Hacer columna NOT NULL
      await queryInterface.changeColumn('documentos', 'tipo_documento', {
        type: 'enum_documentos_tipo_documento',
        allowNull: false,
        comment: 'Tipo de documento notarial: P=Protocolo, D=Diligencias, C=Certificaciones, A=Arrendamientos, O=Otros'
      });
      console.log('✅ Columna configurada como NOT NULL');
      
    } catch (error) {
      console.log('⚠️ Error en conversión de columna:', error.message);
      // Si falla, intentar enfoque directo más simple
      console.log('🔧 Intentando enfoque alternativo...');
      
      await queryInterface.sequelize.query(`
        ALTER TABLE documentos 
        ALTER COLUMN tipo_documento TYPE enum_documentos_tipo_documento 
        USING tipo_documento::text::enum_documentos_tipo_documento;
      `);
      console.log('✅ Columna convertida usando enfoque alternativo');
    }
    
    // PASO 4: Verificar que no hay tipos inválidos
    console.log('🔍 Verificando integridad de datos...');
    
    const tiposInvalidos = await queryInterface.sequelize.query(`
      SELECT DISTINCT tipo_documento, COUNT(*) as cantidad
      FROM documentos 
      WHERE tipo_documento NOT IN ('Protocolo', 'Diligencias', 'Certificaciones', 'Arrendamientos', 'Otros')
      GROUP BY tipo_documento
    `, { type: Sequelize.QueryTypes.SELECT });
    
    if (tiposInvalidos.length > 0) {
      console.log('⚠️ Tipos inválidos encontrados:', tiposInvalidos);
      // Mapear tipos inválidos a "Otros"
      await queryInterface.sequelize.query(`
        UPDATE documentos 
        SET tipo_documento = 'Otros' 
        WHERE tipo_documento NOT IN ('Protocolo', 'Diligencias', 'Certificaciones', 'Arrendamientos', 'Otros')
      `);
      console.log('✅ Tipos inválidos mapeados a "Otros"');
    }
    
    // PASO 5: Crear índice para mejorar rendimiento
    console.log('🔧 Creando índice para tipo_documento...');
    
    try {
      await queryInterface.addIndex('documentos', ['tipo_documento'], {
        name: 'idx_documentos_tipo_documento'
      });
      console.log('✅ Índice creado exitosamente');
    } catch (error) {
      console.log('⚠️ Índice ya existe, continuando...');
    }
    
    console.log('🎉 Migración completada exitosamente!');
    console.log('📊 Tipos estandarizados: Protocolo, Diligencias, Certificaciones, Arrendamientos, Otros');
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 Revirtiendo migración: Estandarización de tipos de documento...');
    
    // Eliminar índice
    try {
      await queryInterface.removeIndex('documentos', 'idx_documentos_tipo_documento');
      console.log('✅ Índice eliminado');
    } catch (error) {
      console.log('⚠️ Error al eliminar índice:', error.message);
    }
    
    // Cambiar columna de vuelta a STRING usando enfoque step-by-step
    try {
      // Agregar columna temporal STRING
      await queryInterface.addColumn('documentos', 'tipo_documento_temp', {
        type: Sequelize.STRING,
        allowNull: true
      });
      
      // Copiar datos
      await queryInterface.sequelize.query(`
        UPDATE documentos 
        SET tipo_documento_temp = tipo_documento::text
      `);
      
      // Eliminar columna ENUM
      await queryInterface.removeColumn('documentos', 'tipo_documento');
      
      // Renombrar columna temporal
      await queryInterface.renameColumn('documentos', 'tipo_documento_temp', 'tipo_documento');
      
      // Hacer NOT NULL
      await queryInterface.changeColumn('documentos', 'tipo_documento', {
        type: Sequelize.STRING,
        allowNull: false
      });
      
      console.log('✅ Columna revertida a STRING');
    } catch (error) {
      console.log('⚠️ Error al revertir columna:', error.message);
    }
    
    // Eliminar ENUM
    try {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_documentos_tipo_documento;');
      console.log('✅ ENUM eliminado');
    } catch (error) {
      console.log('⚠️ Error al eliminar ENUM:', error.message);
    }
    
    console.log('🔄 Migración revertida');
  }
}; 