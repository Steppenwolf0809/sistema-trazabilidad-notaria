const { sequelize } = require('./config/database');
const Matrizador = require('./models/Matrizador');
const bcrypt = require('bcryptjs');

async function crearUsuarioArchivoPrueba() {
  try {
    console.log('👤 Creando usuario de prueba con rol archivo...');
    
    // Verificar si ya existe un usuario archivo
    const usuarioExistente = await Matrizador.findOne({
      where: { rol: 'archivo' }
    });
    
    if (usuarioExistente) {
      console.log('ℹ️  Ya existe un usuario con rol archivo:');
      console.log(`   - ID: ${usuarioExistente.id}`);
      console.log(`   - Nombre: ${usuarioExistente.nombre}`);
      console.log(`   - Email: ${usuarioExistente.email}`);
      console.log(`   - Rol: ${usuarioExistente.rol}`);
      await sequelize.close();
      return;
    }
    
    // Crear contraseña hasheada
    const passwordHash = await bcrypt.hash('archivo123', 10);
    
    // Crear nuevo usuario archivo
    const nuevoUsuario = await Matrizador.create({
      nombre: 'Usuario Archivo',
      email: 'archivo@notaria.com',
      identificacion: 'archivo001',
      cargo: 'Responsable de Archivo',
      rol: 'archivo',
      activo: true,
      password: passwordHash
    });
    
    console.log('✅ Usuario archivo creado exitosamente:');
    console.log(`   - ID: ${nuevoUsuario.id}`);
    console.log(`   - Nombre: ${nuevoUsuario.nombre}`);
    console.log(`   - Email: ${nuevoUsuario.email}`);
    console.log(`   - Rol: ${nuevoUsuario.rol}`);
    console.log(`   - Contraseña: archivo123`);
    
    console.log('🎉 Usuario de prueba creado. Ahora puedes hacer login con:');
    console.log('   Email: archivo@notaria.com');
    console.log('   Contraseña: archivo123');
    
    await sequelize.close();
  } catch (error) {
    console.error('❌ Error al crear usuario archivo:', error.message);
    if (error.errors) {
      console.error('Detalles de validación:');
      error.errors.forEach(err => {
        console.error(`  - ${err.path}: ${err.message}`);
      });
    }
    await sequelize.close();
    process.exit(1);
  }
}

crearUsuarioArchivoPrueba(); 