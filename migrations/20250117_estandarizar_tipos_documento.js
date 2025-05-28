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
        CREATE TYPE enum_documentos_tipo_documento AS ENUM (
          'Protocolo', 
          'Diligencias', 
          'Certificaciones', 
          'Arrendamientos', 
          'Otros'
        );
      `);
      console.log('✅ ENUM creado exitosamente');
    } catch (error) {
      console.log('⚠️ ENUM ya existe, continuando...');
    }
    
    // PASO 3: Cambiar el tipo de columna a ENUM
    console.log('🔧 Cambiando tipo de columna a ENUM...');
    
    await queryInterface.changeColumn('documentos', 'tipo_documento', {
      type: Sequelize.ENUM('Protocolo', 'Diligencias', 'Certificaciones', 'Arrendamientos', 'Otros'),
      allowNull: false,
      comment: 'Tipo de documento notarial: P=Protocolo, D=Diligencias, C=Certificaciones, A=Arrendamientos, O=Otros'
    });
    
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
    
    // Cambiar columna de vuelta a STRING
    await queryInterface.changeColumn('documentos', 'tipo_documento', {
      type: Sequelize.STRING,
      allowNull: false
    });
    
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