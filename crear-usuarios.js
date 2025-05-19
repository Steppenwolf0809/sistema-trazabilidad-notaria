/**
 * Script para crear usuarios de prueba en la base de datos
 * Ejecutar con: node crear-usuarios.js
 */

const bcrypt = require('bcryptjs');
const { sequelize, Sequelize } = require('./config/database');
const Matrizador = require('./models/Matrizador');

// Función para crear los usuarios de prueba
const crearUsuarios = async () => {
  try {
    // Asegurar que la tabla existe
    await Matrizador.sync({ alter: true });

    // Contraseña común para todos los usuarios de prueba: "password"
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('password', salt);

    // Definir usuarios de prueba con diferentes roles
    const usuarios = [
      {
        nombre: 'Administrador',
        email: 'admin@notaria.com',
        identificacion: 'ADMIN001',
        cargo: 'Administrador del Sistema',
        rol: 'admin',
        activo: true,
        password: passwordHash
      },
      {
        nombre: 'Juan Pérez',
        email: 'matrizador@notaria.com',
        identificacion: 'MAT001',
        cargo: 'Matrizador Principal',
        rol: 'matrizador',
        activo: true,
        password: passwordHash
      },
      {
        nombre: 'María López',
        email: 'recepcion@notaria.com',
        identificacion: 'REC001',
        cargo: 'Encargada de Recepción',
        rol: 'recepcion',
        activo: true,
        password: passwordHash
      },
      {
        nombre: 'Carlos Gómez',
        email: 'consulta@notaria.com',
        identificacion: 'CON001',
        cargo: 'Consultor',
        rol: 'consulta',
        activo: true,
        password: passwordHash
      }
    ];

    // Crear o actualizar usuarios
    for (const usuario of usuarios) {
      const [user, created] = await Matrizador.findOrCreate({
        where: { email: usuario.email },
        defaults: usuario
      });

      if (!created) {
        // Actualizar usuario existente
        await user.update(usuario);
        console.log(`✅ Usuario actualizado: ${usuario.nombre} (${usuario.rol})`);
      } else {
        console.log(`✅ Usuario creado: ${usuario.nombre} (${usuario.rol})`);
      }
    }

    console.log('✅ Usuarios de prueba creados correctamente');
    console.log('----------------------------------------');
    console.log('🔐 Credenciales de acceso:');
    console.log('Administrador: admin@notaria.com / password');
    console.log('Matrizador: matrizador@notaria.com / password');
    console.log('Recepción: recepcion@notaria.com / password');
    console.log('Consulta: consulta@notaria.com / password');
    console.log('----------------------------------------');

  } catch (error) {
    console.error('❌ Error al crear usuarios de prueba:', error);
  } finally {
    // Cerrar la conexión
    await sequelize.close();
  }
};

// Ejecutar la función
crearUsuarios(); 