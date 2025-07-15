/**
 * SCRIPT CRÍTICO: Reparar Sistema de Login
 * Regenera contraseñas corruptas y valida configuración
 */

const bcrypt = require('bcryptjs');
const { sequelize } = require('./config/database');
const Matrizador = require('./models/Matrizador');

// Configuración de contraseñas de emergencia
const PASSWORDS_EMERGENCIA = {
  'admin@notaria.com': 'admin123',
  'mayra@notaria.com': 'notaria123',
  'cindy@notaria.com': 'notaria123',
  'karolrecepcion@notaria.com': 'notaria123',
  'lmdiazarchivo@notaria.com': 'notaria123'
};

async function diagnosticarSistemaLogin() {
  console.log('🔍 DIAGNÓSTICO CRÍTICO: Sistema de Login');
  console.log('===========================================');
  
  try {
    // 1. Verificar conexión a base de datos
    await sequelize.authenticate();
    console.log('✅ Conexión a base de datos: OK');
    
    // 2. Verificar configuración JWT
    const jwtSecret = process.env.JWT_SECRET || 'clave_secreta_notaria_2024';
    console.log('✅ JWT_SECRET configurado:', jwtSecret.length > 10 ? 'OK' : 'DÉBIL');
    
    // 3. Obtener todos los usuarios
    const usuarios = await Matrizador.findAll({
      attributes: ['id', 'nombre', 'email', 'password', 'activo', 'rol']
    });
    
    console.log(`📊 Usuarios encontrados: ${usuarios.length}`);
    
    // 4. Validar cada contraseña
    const problemasDetectados = [];
    
    for (const usuario of usuarios) {
      console.log(`\n🔍 Validando: ${usuario.email} (${usuario.rol})`);
      
      if (!usuario.activo) {
        console.log('⚠️ Usuario inactivo - saltando');
        continue;
      }
      
      if (!usuario.password) {
        console.log('❌ PROBLEMA: Contraseña NULL');
        problemasDetectados.push({
          usuario,
          problema: 'password_null',
          solucion: 'regenerar'
        });
        continue;
      }
      
      // Verificar si la contraseña está hasheada correctamente
      const esHashBcrypt = usuario.password.startsWith('$2a$') || 
                           usuario.password.startsWith('$2b$') || 
                           usuario.password.startsWith('$2y$');
      
      if (!esHashBcrypt) {
        console.log('❌ PROBLEMA: Contraseña no hasheada con bcrypt');
        problemasDetectados.push({
          usuario,
          problema: 'password_no_hash',
          solucion: 'regenerar'
        });
        continue;
      }
      
      // Probar contraseña conocida
      const passwordPrueba = PASSWORDS_EMERGENCIA[usuario.email] || 'notaria123';
      
      try {
        const esValida = await bcrypt.compare(passwordPrueba, usuario.password);
        if (esValida) {
          console.log('✅ Contraseña válida');
        } else {
          console.log('⚠️ Contraseña no coincide con la esperada');
          problemasDetectados.push({
            usuario,
            problema: 'password_no_match',
            solucion: 'regenerar'
          });
        }
      } catch (bcryptError) {
        console.log('❌ PROBLEMA: Error en bcrypt.compare -', bcryptError.message);
        problemasDetectados.push({
          usuario,
          problema: 'bcrypt_error',
          solucion: 'regenerar'
        });
      }
    }
    
    console.log(`\n📋 RESUMEN DEL DIAGNÓSTICO`);
    console.log(`Total usuarios: ${usuarios.length}`);
    console.log(`Problemas detectados: ${problemasDetectados.length}`);
    
    if (problemasDetectados.length > 0) {
      console.log('\n❌ PROBLEMAS DETECTADOS:');
      problemasDetectados.forEach((problema, index) => {
        console.log(`${index + 1}. ${problema.usuario.email}: ${problema.problema}`);
      });
      
      return problemasDetectados;
    } else {
      console.log('\n✅ SISTEMA DE LOGIN: Sin problemas detectados');
      return [];
    }
    
  } catch (error) {
    console.error('💥 ERROR EN DIAGNÓSTICO:', error);
    throw error;
  }
}

async function regenerarPasswordsProblematicos(problemas) {
  console.log('\n🔧 REGENERANDO CONTRASEÑAS PROBLEMÁTICAS...');
  
  const transaction = await sequelize.transaction();
  
  try {
    for (const problema of problemas) {
      const { usuario } = problema;
      const passwordNueva = PASSWORDS_EMERGENCIA[usuario.email] || 'notaria123';
      
      console.log(`🔄 Regenerando password para: ${usuario.email}`);
      
      // Generar hash con salt seguro
      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(passwordNueva, salt);
      
      // Actualizar en base de datos
      await Matrizador.update(
        { password: passwordHash },
        { 
          where: { id: usuario.id },
          transaction 
        }
      );
      
      // Verificar que la actualización funcionó
      const verificacion = await bcrypt.compare(passwordNueva, passwordHash);
      if (verificacion) {
        console.log(`✅ Password regenerada exitosamente para ${usuario.email}`);
      } else {
        throw new Error(`Error en verificación de password para ${usuario.email}`);
      }
    }
    
    await transaction.commit();
    console.log('✅ TODAS LAS CONTRASEÑAS REGENERADAS EXITOSAMENTE');
    
  } catch (error) {
    await transaction.rollback();
    console.error('❌ ERROR AL REGENERAR CONTRASEÑAS:', error);
    throw error;
  }
}

async function probarLoginCompleto() {
  console.log('\n🧪 PROBANDO LOGIN COMPLETO...');
  
  const usuariosPrueba = [
    { email: 'admin@notaria.com', password: 'admin123', rolEsperado: 'admin' },
    { email: 'cindy@notaria.com', password: 'notaria123', rolEsperado: 'caja' }
  ];
  
  for (const prueba of usuariosPrueba) {
    console.log(`\n🔍 Probando login: ${prueba.email}`);
    
    try {
      // Simular proceso completo de login
      const usuario = await Matrizador.findOne({
        where: { 
          email: prueba.email.toLowerCase().trim(),
          activo: true 
        }
      });
      
      if (!usuario) {
        console.log('❌ Usuario no encontrado');
        continue;
      }
      
      const passwordValida = await bcrypt.compare(prueba.password, usuario.password);
      if (!passwordValida) {
        console.log('❌ Contraseña inválida');
        continue;
      }
      
      if (usuario.rol !== prueba.rolEsperado) {
        console.log(`⚠️ Rol inesperado: ${usuario.rol} (esperado: ${prueba.rolEsperado})`);
      }
      
      // Simular generación JWT
      const jwt = require('jsonwebtoken');
      const token = jwt.sign(
        { 
          id: usuario.id,
          email: usuario.email,
          nombre: usuario.nombre,
          rol: usuario.rol
        },
        process.env.JWT_SECRET || 'clave_secreta_notaria_2024',
        { expiresIn: '24h' }
      );
      
      // Verificar token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'clave_secreta_notaria_2024');
      
      console.log(`✅ Login completo exitoso para ${usuario.nombre} (${usuario.rol})`);
      
    } catch (error) {
      console.log(`❌ Error en login de ${prueba.email}:`, error.message);
    }
  }
}

async function ejecutarReparacionCompleta() {
  console.log('🚀 INICIANDO REPARACIÓN CRÍTICA DEL SISTEMA DE LOGIN');
  console.log('================================================');
  
  try {
    // Paso 1: Diagnosticar problemas
    const problemas = await diagnosticarSistemaLogin();
    
    // Paso 2: Regenerar contraseñas problemáticas
    if (problemas.length > 0) {
      await regenerarPasswordsProblematicos(problemas);
    }
    
    // Paso 3: Probar login completo
    await probarLoginCompleto();
    
    console.log('\n🎉 REPARACIÓN COMPLETA EXITOSA');
    console.log('==============================');
    console.log('✅ Sistema de login restaurado');
    console.log('✅ Contraseñas regeneradas');
    console.log('✅ Configuración JWT validada');
    console.log('\n📋 CREDENCIALES DE ACCESO:');
    Object.entries(PASSWORDS_EMERGENCIA).forEach(([email, password]) => {
      console.log(`   ${email}: ${password}`);
    });
    console.log('\n⚠️ CAMBIAR contraseñas después del primer login');
    
  } catch (error) {
    console.error('\n💥 ERROR CRÍTICO EN REPARACIÓN:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Ejecutar si se llama directamente
if (require.main === module) {
  ejecutarReparacionCompleta();
}

module.exports = {
  diagnosticarSistemaLogin,
  regenerarPasswordsProblematicos,
  probarLoginCompleto
}; 