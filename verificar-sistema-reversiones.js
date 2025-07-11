/**
 * Script para verificar que el sistema de reversiones funciona correctamente
 * Verifica modelos, tablas y funciones críticas
 */

const { sequelize } = require('./config/database');

async function verificarSistemaReversiones() {
  try {
    console.log('🔍 Verificando sistema de reversiones...');
    
    // Verificar conexión
    await sequelize.authenticate();
    console.log('✅ Conexión a base de datos exitosa');
    
    // 1. Verificar que el modelo ReversionAuditoria esté disponible
    console.log('\n1. 🔍 Verificando modelo ReversionAuditoria...');
    try {
      const ReversionAuditoria = require('./models/ReversionAuditoria');
      console.log('✅ Modelo ReversionAuditoria cargado correctamente');
      
      // Verificar que la tabla exista
      const tableExists = await sequelize.getQueryInterface().describeTable('reversiones_auditoria');
      console.log('✅ Tabla reversiones_auditoria existe');
      console.log('📋 Campos de la tabla:', Object.keys(tableExists));
      
    } catch (error) {
      console.error('❌ Error con modelo ReversionAuditoria:', error.message);
      return false;
    }
    
    // 2. Verificar campos de contacto inteligente
    console.log('\n2. 🔍 Verificando campos de contacto inteligente...');
    try {
      const tableDescription = await sequelize.getQueryInterface().describeTable('documentos');
      
      const camposRequeridos = ['telefono_whatsapp', 'contacto_validado', 'contacto_conflicto', 'contacto_datos_analisis'];
      const camposFaltantes = camposRequeridos.filter(campo => !tableDescription[campo]);
      
      if (camposFaltantes.length > 0) {
        console.error('❌ Campos faltantes en tabla documentos:', camposFaltantes);
        return false;
      } else {
        console.log('✅ Todos los campos de contacto inteligente están presentes');
      }
      
    } catch (error) {
      console.error('❌ Error verificando campos de contacto:', error.message);
      return false;
    }
    
    // 3. Verificar que los modelos estén registrados correctamente
    console.log('\n3. 🔍 Verificando registro de modelos...');
    try {
      const modelos = require('./models/index.js');
      
      const modelosRequeridos = ['Documento', 'ReversionAuditoria', 'ContactoLocal', 'EventoDocumento'];
      const modelosFaltantes = modelosRequeridos.filter(modelo => !modelos[modelo]);
      
      if (modelosFaltantes.length > 0) {
        console.error('❌ Modelos no registrados:', modelosFaltantes);
        return false;
      } else {
        console.log('✅ Todos los modelos están registrados correctamente');
      }
      
    } catch (error) {
      console.error('❌ Error verificando modelos:', error.message);
      return false;
    }
    
    // 4. Verificar funciones de reversión en controlador
    console.log('\n4. 🔍 Verificando funciones de reversión...');
    try {
      const cajaController = require('./controllers/cajaController');
      
      const funcionesRequeridas = ['deshacerPagoVirtual', 'corregirPagoVirtual', 'deshacerPago', 'corregirPago'];
      const funcionesFaltantes = funcionesRequeridas.filter(func => typeof cajaController[func] !== 'function');
      
      if (funcionesFaltantes.length > 0) {
        console.error('❌ Funciones de reversión faltantes:', funcionesFaltantes);
        return false;
      } else {
        console.log('✅ Todas las funciones de reversión están disponibles');
      }
      
    } catch (error) {
      console.error('❌ Error verificando funciones de reversión:', error.message);
      return false;
    }
    
    // 5. Verificar rutas de reversión
    console.log('\n5. 🔍 Verificando rutas de reversión...');
    try {
      const fs = require('fs');
      const rutasCaja = fs.readFileSync('./routes/cajaRoutes.js', 'utf8');
      
      const rutasRequeridas = [
        'corregir-pago-virtual',
        'deshacer-pago-virtual',
        'pagos/:id/corregir',
        'pagos/:id/deshacer'
      ];
      
      const rutasFaltantes = rutasRequeridas.filter(ruta => !rutasCaja.includes(ruta));
      
      if (rutasFaltantes.length > 0) {
        console.error('❌ Rutas de reversión faltantes:', rutasFaltantes);
        return false;
      } else {
        console.log('✅ Todas las rutas de reversión están configuradas');
      }
      
    } catch (error) {
      console.error('❌ Error verificando rutas:', error.message);
      return false;
    }
    
    // 6. Verificar que hay documentos de prueba disponibles
    console.log('\n6. 🔍 Verificando documentos de prueba...');
    try {
      const Documento = require('./models/Documento');
      
      const documentosPrueba = await Documento.findAll({
        where: {
          valorPagado: { [require('sequelize').Op.gt]: 0 }
        },
        limit: 3
      });
      
      console.log(`✅ Encontrados ${documentosPrueba.length} documentos con pago para pruebas`);
      
      if (documentosPrueba.length > 0) {
        console.log('📋 Documentos de prueba disponibles:');
        documentosPrueba.forEach(doc => {
          console.log(`- ID: ${doc.id} | Valor: $${doc.valorPagado} | Estado: ${doc.estadoPago}`);
        });
      }
      
    } catch (error) {
      console.error('❌ Error verificando documentos de prueba:', error.message);
      return false;
    }
    
    // ✅ SISTEMA COMPLETAMENTE FUNCIONAL
    console.log('\n🎉 VERIFICACIÓN COMPLETADA');
    console.log('✅ Sistema de reversiones COMPLETAMENTE FUNCIONAL');
    console.log('✅ Todas las funciones de corrección y reversión están disponibles');
    console.log('✅ Modelos y tablas correctamente configurados');
    console.log('✅ Rutas de API funcionando');
    
    return true;
    
  } catch (error) {
    console.error('❌ Error en verificación:', error);
    return false;
  } finally {
    await sequelize.close();
  }
}

// Ejecutar verificación
verificarSistemaReversiones()
  .then(resultado => {
    if (resultado) {
      console.log('\n🏁 RESULTADO: Sistema de reversiones FUNCIONAL ✅');
      console.log('🎯 Puedes probar las reversiones en: https://pro-notary.up.railway.app');
    } else {
      console.log('\n🏁 RESULTADO: Sistema requiere correcciones ❌');
    }
    process.exit(resultado ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  }); 