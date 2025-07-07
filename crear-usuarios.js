/**
 * Script para crear usuarios reales de la notaría en ProNotary
 * Compatible con auto-setup en Render
 * Ejecutar con: node crear-usuarios.js
 */

const bcrypt = require('bcryptjs');
const { sequelize, Sequelize } = require('./config/database');
const Matrizador = require('./models/Matrizador');

// Función para crear los usuarios reales de la notaría
const crearUsuarios = async () => {
  try {
    console.log('👥 Creando usuarios reales de la notaría...');
    
    // Importar modelo con retry
    let Matrizador;
    try {
      Matrizador = require('./models/Matrizador');
      console.log('✅ Modelo importado correctamente');
    } catch (error) {
      console.log('❌ Error importando modelo:', error.message);
      throw error;
    }
    
    // Verificar conexión antes de continuar
    try {
      await Matrizador.sync({ alter: false });
      console.log('✅ Modelo sincronizado correctamente');
    } catch (syncError) {
      console.log('❌ Error sincronizando modelo:', syncError.message);
      throw syncError;
    }

    // Contraseña temporal para todos (cambiar después del primer login)
    const passwordTemporal = 'notaria123';
    const hashPassword = await bcrypt.hash(passwordTemporal, 10);
    
    const usuariosReales = [
      // ADMINISTRACIÓN
      {
        nombre: 'Administrador',
        email: 'admin@notaria.com',
        identificacion: 'ADMIN001',
        cargo: 'Administrador del Sistema',
        rol: 'admin',
        activo: true,
        password: hashPassword
      },
      
      // MATRIZADORES
      {
        nombre: 'MAYRA CRISTINA CORELLA PARRA',
        email: 'mayra@notaria.com',
        identificacion: 'MAT001',
        cargo: 'Matrizador Principal',
        rol: 'matrizador',
        activo: true,
        password: hashPassword
      },
      {
        nombre: 'Jose Luis Zapata Silva',
        email: 'joseluiszapata393@gmail.com',
        identificacion: 'MAT002',
        cargo: 'Matrizador',
        rol: 'matrizador',
        activo: true,
        password: hashPassword
      },
      {
        nombre: 'GISSELA VANESSA VELASTEGUI CADENA',
        email: 'gissela@notaria.com',
        identificacion: 'MAT003',
        cargo: 'Matrizador',
        rol: 'matrizador',
        activo: true,
        password: hashPassword
      },
      {
        nombre: 'KAROL DANIELA VELASTEGUI CADENA',
        email: 'karol@notaria.com',
        identificacion: 'MAT004',
        cargo: 'Matrizador',
        rol: 'matrizador',
        activo: true,
        password: hashPassword
      },
      {
        nombre: 'FRANCISCO ESTEBAN PROAÑO ASTUDILLO',
        email: 'esteban@notaria.com',
        identificacion: 'MAT005',
        cargo: 'Matrizador',
        rol: 'matrizador',
        activo: true,
        password: hashPassword
      },
      
      // CAJA
      {
        nombre: 'Cindy Pazmiño',
        email: 'cindy@notaria.com',
        identificacion: 'CAJA001',
        cargo: 'Caja',
        rol: 'caja',
        activo: true,
        password: hashPassword
      },
      {
        nombre: 'Mauricio Quinga',
        email: 'mauricio@notaria.com',
        identificacion: 'CAJA002',
        cargo: 'Facturación/Caja',
        rol: 'caja',
        activo: true,
        password: hashPassword
      },
      
      // RECEPCIÓN
      {
        nombre: 'KAROL VELASTEGUI',
        email: 'karolrecepcion@notaria.com',
        identificacion: 'REC001',
        cargo: 'Encargada de Recepción',
        rol: 'recepcion',
        activo: true,
        password: hashPassword
      },
      {
        nombre: 'GISSELA RECEPCIÓN',
        email: 'gisselarecepcion@notaria.com',
        identificacion: 'REC002',
        cargo: 'Recepción',
        rol: 'recepcion',
        activo: true,
        password: hashPassword
      },
      {
        nombre: 'EDGAR RECEPCIÓN',
        email: 'edgar@notaria.com',
        identificacion: 'REC003',
        cargo: 'Recepción',
        rol: 'recepcion',
        activo: true,
        password: hashPassword
      },
      
      // ARCHIVO
      {
        nombre: 'MARIA LUCINDA DIAZ PILATASIG',
        email: 'lmdiazarchivo@notaria.com',
        identificacion: 'ARC001',
        cargo: 'Archivo',
        rol: 'archivo',
        activo: true,
        password: hashPassword
      }
    ];

    let usuariosCreados = 0;
    let usuariosExistentes = 0;

    // Crear o actualizar usuarios reales
    for (const usuario of usuariosReales) {
      try {
        const [usuarioCreado, created] = await Matrizador.findOrCreate({
          where: { email: usuario.email },
          defaults: usuario
        });
        
        if (created) {
          console.log(`✅ Usuario creado: ${usuario.nombre} (${usuario.email}) - ${usuario.rol}`);
          usuariosCreados++;
        } else {
          console.log(`ℹ️ Usuario ya existe: ${usuario.email}`);
          usuariosExistentes++;
        }
      } catch (error) {
        console.log(`❌ Error creando usuario ${usuario.email}:`, error.message);
      }
    }
    
    console.log(`\n📊 RESUMEN DE USUARIOS REALES DE LA NOTARÍA:`);
    console.log(`✅ Usuarios creados: ${usuariosCreados}`);
    console.log(`ℹ️ Usuarios ya existentes: ${usuariosExistentes}`);
    console.log(`\n🔐 CREDENCIALES TEMPORALES (cambiar en primer login):`);
    console.log(`🔑 Contraseña para TODOS los usuarios: ${passwordTemporal}`);
    console.log(`\n👥 USUARIOS DISPONIBLES POR ROL:`);
    console.log(`👑 ADMINISTRACIÓN:`);
    console.log(`   - admin@notaria.com (Administrador)`);
    console.log(`\n📋 MATRIZADORES:`);
    console.log(`   - mayra@notaria.com (MAYRA CRISTINA CORELLA PARRA)`);
    console.log(`   - joseluiszapata393@gmail.com (Jose Luis Zapata Silva)`);
    console.log(`   - gissela@notaria.com (GISSELA VANESSA VELASTEGUI CADENA)`);
    console.log(`   - karol@notaria.com (KAROL DANIELA VELASTEGUI CADENA)`);
    console.log(`   - esteban@notaria.com (FRANCISCO ESTEBAN PROAÑO ASTUDILLO)`);
    console.log(`\n💰 CAJA:`);
    console.log(`   - cindy@notaria.com (Cindy Pazmiño)`);
    console.log(`   - mauricio@notaria.com (Mauricio Quinga)`);
    console.log(`\n📨 RECEPCIÓN:`);
    console.log(`   - karolrecepcion@notaria.com (KAROL VELASTEGUI)`);
    console.log(`   - gisselarecepcion@notaria.com (GISSELA RECEPCIÓN)`);
    console.log(`   - edgar@notaria.com (EDGAR RECEPCIÓN)`);
    console.log(`\n🗂️ ARCHIVO:`);
    console.log(`   - lmdiazarchivo@notaria.com (MARIA LUCINDA DIAZ PILATASIG)`);
    console.log(`\n⚠️ IMPORTANTE: Cambiar contraseñas después del primer login`);
    console.log(`🎉 Sistema ProNotary listo para el personal de la notaría!`);

  } catch (error) {
    console.error('❌ Error al crear usuarios reales de la notaría:', error);
    throw error; // Re-throw para que el auto-setup lo maneje
  } finally {
    // Solo cerrar conexión si se ejecuta directamente
    if (require.main === module) {
      await sequelize.close();
    }
  }
};

// Ejecutar solo si se llama directamente
if (require.main === module) {
  crearUsuarios()
    .then(() => {
      console.log('✅ Proceso completado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

module.exports = crearUsuarios; 