const { sequelize } = require('./config/database');

async function fixArchivoConstraint() {
  try {
    console.log('🔧 Iniciando corrección de restricción CHECK para rol archivo...');
    
    // Primero, eliminar la restricción existente
    console.log('1. Eliminando restricción CHECK existente...');
    await sequelize.query("ALTER TABLE matrizadores DROP CONSTRAINT IF EXISTS rol_check;");
    console.log('✅ Restricción CHECK eliminada');
    
    // Crear nueva restricción que incluya 'archivo'
    console.log('2. Creando nueva restricción CHECK con rol archivo...');
    await sequelize.query(`
      ALTER TABLE matrizadores 
      ADD CONSTRAINT rol_check 
      CHECK (rol = ANY (ARRAY['admin'::text, 'matrizador'::text, 'recepcion'::text, 'consulta'::text, 'caja'::text, 'caja_archivo'::text, 'archivo'::text]))
    `);
    console.log('✅ Nueva restricción CHECK creada con rol archivo');
    
    // Verificar la nueva restricción
    console.log('3. Verificando nueva restricción...');
    const result = await sequelize.query(
      "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'matrizadores'::regclass AND contype = 'c';",
      { type: sequelize.QueryTypes.SELECT }
    );
    console.log('Nueva restricción CHECK:');
    console.log(JSON.stringify(result, null, 2));
    
    console.log('🎉 Corrección completada exitosamente');
    await sequelize.close();
  } catch (error) {
    console.error('❌ Error al corregir restricción:', error.message);
    await sequelize.close();
    process.exit(1);
  }
}

fixArchivoConstraint(); 