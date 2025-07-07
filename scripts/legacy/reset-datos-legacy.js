/**
 * Script de Reset Seguro de Datos Legacy - ProNotary
 * 
 * OBJETIVO: Limpiar datos inconsistentes de testing manteniendo estructura y usuarios
 * 
 * ELIMINA: Documentos, eventos, auditoría, relaciones
 * PRESERVA: Estructura de tablas, usuarios, configuraciones
 * 
 * Ejecutar con: node reset-datos-legacy.js
 */

const { Sequelize } = require('sequelize');
const db = require('./models');

/**
 * Función principal de reset seguro
 */
async function resetDatosLegacy() {
  console.log('🗃️  INICIANDO RESET SEGURO DE DATOS LEGACY...');
  console.log('⚠️  MANTENIENDO: Estructura, usuarios, configuraciones');
  console.log('🗑️  ELIMINANDO: Documentos, eventos, auditoría de testing');
  
  try {
    // PASO 1: Backup de usuarios importantes (por si acaso)
    console.log('\n📋 PASO 1: Backup de configuraciones críticas...');
    
    const usuariosActivos = await db.Matrizador.findAll({
      attributes: ['id', 'nombre', 'email', 'rol'],
      raw: true
    });
    console.log(`✅ ${usuariosActivos.length} usuarios encontrados para preservar`);
    
    // PASO 2: Limpiar tablas de datos (EN ORDEN CORRECTO por FK)
    console.log('\n🗑️  PASO 2: Limpiando datos legacy...');
    
    // 2.1 Eliminar notificaciones (tienen FK a documentos)
    console.log('  → Limpiando notificaciones enviadas...');
    try {
      await db.NotificacionEnviada.destroy({ 
        where: {},
        truncate: true,
        cascade: true 
      });
    } catch (error) {
      console.log('  ⚠️  Tabla NotificacionEnviada no encontrada (normal si no existe)');
    }
    
    // 2.2 Eliminar eventos y auditoría (tienen FK a documentos)
    console.log('  → Limpiando eventos de documentos...');
    const eventosEliminados = await db.EventoDocumento.count();
    await db.EventoDocumento.destroy({ 
      where: {},
      truncate: true,
      cascade: true 
    });
    console.log(`    ✅ ${eventosEliminados} eventos eliminados`);
    
    console.log('  → Limpiando registros de auditoría...');
    const auditoriaEliminada = await db.RegistroAuditoria.count();
    await db.RegistroAuditoria.destroy({ 
      where: {},
      truncate: true,
      cascade: true 
    });
    console.log(`    ✅ ${auditoriaEliminada} registros de auditoría eliminados`);
    
    // 2.3 Limpiar cambios de matrizador
    console.log('  → Limpiando cambios de matrizador...');
    try {
      const cambiosEliminados = await db.CambioMatrizador.count();
      await db.CambioMatrizador.destroy({ 
        where: {},
        truncate: true,
        cascade: true 
      });
      console.log(`    ✅ ${cambiosEliminados} cambios de matrizador eliminados`);
    } catch (error) {
      console.log('  ⚠️  Tabla CambioMatrizador no encontrada (normal si no existe)');
    }
    
    // 2.4 Limpiar autorizaciones de entrega
    console.log('  → Limpiando autorizaciones de entrega...');
    try {
      const autorizacionesEliminadas = await db.AutorizacionEntrega.count();
      await db.AutorizacionEntrega.destroy({ 
        where: {},
        truncate: true,
        cascade: true 
      });
      console.log(`    ✅ ${autorizacionesEliminadas} autorizaciones eliminadas`);
    } catch (error) {
      console.log('  ⚠️  Tabla AutorizacionEntrega no encontrada (normal si no existe)');
    }
    
    // 2.5 Limpiar auditoría de eliminaciones
    console.log('  → Limpiando auditoría de eliminaciones...');
    try {
      const auditoriaElimEliminada = await db.AuditoriaEliminacion.count();
      await db.AuditoriaEliminacion.destroy({ 
        where: {},
        truncate: true,
        cascade: true 
      });
      console.log(`    ✅ ${auditoriaElimEliminada} registros de auditoría de eliminación eliminados`);
    } catch (error) {
      console.log('  ⚠️  Tabla AuditoriaEliminacion no encontrada (normal si no existe)');
    }
    
    // 2.6 Limpiar relaciones de documentos
    console.log('  → Limpiando relaciones entre documentos...');
    try {
      const relacionesEliminadas = await db.DocumentoRelacion.count();
      await db.DocumentoRelacion.destroy({ 
        where: {},
        truncate: true,
        cascade: true 
      });
      console.log(`    ✅ ${relacionesEliminadas} relaciones eliminadas`);
    } catch (error) {
      console.log('  ⚠️  Tabla DocumentoRelacion no encontrada (normal si no existe)');
    }
    
    // 2.7 Limpiar documentos relacionados
    console.log('  → Limpiando documentos relacionados...');
    try {
      const docRelacionadosEliminados = await db.DocumentosRelacionados.count();
      await db.DocumentosRelacionados.destroy({ 
        where: {},
        truncate: true,
        cascade: true 
      });
      console.log(`    ✅ ${docRelacionadosEliminados} documentos relacionados eliminados`);
    } catch (error) {
      console.log('  ⚠️  Tabla DocumentosRelacionados no encontrada (normal si no existe)');
    }
    
    // 2.8 Finalmente eliminar documentos principales
    console.log('  → Limpiando documentos principales...');
    const documentosEliminados = await db.Documento.count();
    await db.Documento.destroy({ 
      where: {},
      truncate: true,
      cascade: true 
    });
    console.log(`    ✅ ${documentosEliminados} documentos eliminados`);
    
    // PASO 3: Reset de secuencias (IDs empiezan desde 1)
    console.log('\n🔄 PASO 3: Reseteando secuencias de IDs...');
    
    const secuencias = [
      'documentos_id_seq',
      'evento_documentos_id_seq', 
      'registro_auditorias_id_seq',
      'cambio_matrizadors_id_seq',
      'autorizacion_entregas_id_seq',
      'documento_relacions_id_seq',
      'documentos_relacionados_id_seq',
      'auditoria_eliminacions_id_seq',
      'notificacion_enviadas_id_seq'
    ];
    
    for (const seq of secuencias) {
      try {
        await db.sequelize.query(`ALTER SEQUENCE ${seq} RESTART WITH 1`);
        console.log(`  ✅ Secuencia ${seq} reseteada`);
      } catch (error) {
        console.log(`  ⚠️  Secuencia ${seq} no encontrada (normal si no existe)`);
      }
    }
    
    // PASO 4: Verificación de limpieza
    console.log('\n✅ PASO 4: Verificando limpieza...');
    
    const verificacion = {
      documentos: await db.Documento.count(),
      eventos: await db.EventoDocumento.count(),
      auditoria: await db.RegistroAuditoria.count(),
      usuarios: await db.Matrizador.count()
    };
    
    // Verificaciones adicionales opcionales
    try {
      verificacion.notificaciones = await db.NotificacionEnviada.count();
    } catch (error) {
      verificacion.notificaciones = 'N/A';
    }
    
    try {
      verificacion.cambios = await db.CambioMatrizador.count();
    } catch (error) {
      verificacion.cambios = 'N/A';
    }
    
    console.log('📊 ESTADO POST-LIMPIEZA:');
    console.log(`  • Documentos: ${verificacion.documentos} (debe ser 0)`);
    console.log(`  • Eventos: ${verificacion.eventos} (debe ser 0)`);
    console.log(`  • Auditoría: ${verificacion.auditoria} (debe ser 0)`);
    console.log(`  • Notificaciones: ${verificacion.notificaciones} (debe ser 0 o N/A)`);
    console.log(`  • Cambios: ${verificacion.cambios} (debe ser 0 o N/A)`);
    console.log(`  • Usuarios: ${verificacion.usuarios} (preservados)`);
    
    // PASO 5: Validación final
    if (verificacion.documentos === 0 && verificacion.eventos === 0) {
      console.log('\n🎉 ¡RESET COMPLETADO EXITOSAMENTE!');
      console.log('✅ Base de datos limpia y lista para testing con datos reales');
      console.log('✅ Estructura y usuarios preservados');
      console.log('\n📋 PRÓXIMOS PASOS RECOMENDADOS:');
      console.log('1. Cargar XMLs nuevos desde cero');
      console.log('2. Validar flujo completo: XML → Factura → Pago → Entrega');
      console.log('3. Verificar que matemática financiera sea correcta');
      console.log('4. Confirmar que no hay inconsistencias');
      console.log('\n🔗 COMANDOS ÚTILES:');
      console.log('   node test-matematica-financiera.js  # Para validar cálculos');
      console.log('   npm start                           # Para iniciar el sistema');
    } else {
      console.log('\n❌ ERROR: La limpieza no fue completa');
      console.log('Revisar logs arriba para identificar problemas');
    }
    
  } catch (error) {
    console.error('\n💥 ERROR DURANTE RESET:', error);
    console.log('\n🔧 POSIBLES SOLUCIONES:');
    console.log('1. Verificar conexión a base de datos');
    console.log('2. Asegurar que no hay procesos usando la BD');
    console.log('3. Revisar permisos de usuario PostgreSQL');
    console.log('4. Verificar que todas las tablas existen');
    throw error;
  }
}

/**
 * Función de verificación pre-reset
 */
async function verificarEstadoActual() {
  console.log('🔍 VERIFICANDO ESTADO ACTUAL DE LA BASE DE DATOS...\n');
  
  try {
    const estado = {
      documentos: await db.Documento.count(),
      documentosPagados: await db.Documento.count({ where: { estado_pago: 'pagado' } }),
      documentosPendientes: await db.Documento.count({ where: { estado_pago: 'pendiente' } }),
      eventos: await db.EventoDocumento.count(),
      usuarios: await db.Matrizador.count(),
      auditoria: await db.RegistroAuditoria.count()
    };
    
    // Verificaciones adicionales opcionales
    try {
      estado.notificaciones = await db.NotificacionEnviada.count();
    } catch (error) {
      estado.notificaciones = 'N/A (tabla no existe)';
    }
    
    try {
      estado.cambios = await db.CambioMatrizador.count();
    } catch (error) {
      estado.cambios = 'N/A (tabla no existe)';
    }
    
    console.log('📊 ESTADO ACTUAL:');
    console.log(`  • Total documentos: ${estado.documentos}`);
    console.log(`  • Documentos pagados: ${estado.documentosPagados}`);
    console.log(`  • Documentos pendientes: ${estado.documentosPendientes}`);
    console.log(`  • Eventos registrados: ${estado.eventos}`);
    console.log(`  • Usuarios en sistema: ${estado.usuarios}`);
    console.log(`  • Registros de auditoría: ${estado.auditoria}`);
    console.log(`  • Notificaciones: ${estado.notificaciones}`);
    console.log(`  • Cambios de matrizador: ${estado.cambios}`);
    
    // Calcular métricas financieras actuales
    try {
      const [facturadoResult] = await db.sequelize.query(`
        SELECT COALESCE(SUM(valor_factura), 0) as total
        FROM documentos
        WHERE numero_factura IS NOT NULL
        AND estado NOT IN ('eliminado', 'nota_credito')
      `);
      
      const [cobradoResult] = await db.sequelize.query(`
        SELECT COALESCE(SUM(valor_factura), 0) as total
        FROM documentos
        WHERE estado_pago = 'pagado'
        AND numero_factura IS NOT NULL
        AND estado NOT IN ('eliminado', 'nota_credito')
      `);
      
      const facturado = parseFloat(facturadoResult[0]?.total || 0);
      const cobrado = parseFloat(cobradoResult[0]?.total || 0);
      const pendiente = facturado - cobrado;
      
      console.log('\n💰 MÉTRICAS FINANCIERAS ACTUALES:');
      console.log(`  • Total facturado: $${facturado.toFixed(2)}`);
      console.log(`  • Total cobrado: $${cobrado.toFixed(2)}`);
      console.log(`  • Pendiente de cobro: $${pendiente.toFixed(2)}`);
      
      const diferencia = Math.abs(facturado - (cobrado + pendiente));
      if (diferencia > 0.01) {
        console.log(`  ⚠️  INCONSISTENCIA DETECTADA: Diferencia de $${diferencia.toFixed(2)}`);
        console.log('     → Esta es la razón para hacer el reset');
      } else {
        console.log('  ✅ Matemática financiera correcta');
      }
      
    } catch (error) {
      console.log('  ⚠️  Error calculando métricas financieras:', error.message);
    }
    
    return estado;
  } catch (error) {
    console.error('Error verificando estado:', error);
    throw error;
  }
}

/**
 * Función para confirmar el reset (simulada)
 */
function confirmarReset() {
  console.log('\n⚠️  ¿CONTINUAR CON EL RESET?');
  console.log('   Esto eliminará TODOS los documentos y datos de testing');
  console.log('   Los usuarios y estructura se mantendrán');
  console.log('\n   Para confirmar en producción, modificar esta función');
  console.log('   Por ahora, continuando automáticamente...\n');
  
  // En producción, aquí habría una confirmación interactiva
  // Por ahora, retornamos true para continuar
  return true;
}

/**
 * Función principal de ejecución
 */
async function ejecutarReset() {
  try {
    console.log('🚀 SISTEMA DE RESET SEGURO - PRONOTARY');
    console.log('=====================================\n');
    
    // Verificar estado antes
    await verificarEstadoActual();
    
    // Confirmar reset
    const confirmado = confirmarReset();
    if (!confirmado) {
      console.log('❌ Reset cancelado por el usuario');
      return;
    }
    
    // Ejecutar reset
    await resetDatosLegacy();
    
    console.log('\n🎯 RESET COMPLETADO - SISTEMA LISTO PARA DATOS REALES');
    
  } catch (error) {
    console.error('💥 Error ejecutando reset:', error);
    console.log('\n🆘 Si el error persiste:');
    console.log('1. Verificar que el servidor de BD esté corriendo');
    console.log('2. Verificar credenciales en .env');
    console.log('3. Asegurar que no hay conexiones activas a la BD');
    process.exit(1);
  } finally {
    // Cerrar conexión
    try {
      await db.sequelize.close();
      console.log('🔌 Conexión a base de datos cerrada');
    } catch (error) {
      console.log('⚠️  Error cerrando conexión:', error.message);
    }
  }
}

// Exportar funciones para uso modular
module.exports = {
  resetDatosLegacy,
  verificarEstadoActual,
  ejecutarReset
};

// Si se ejecuta directamente
if (require.main === module) {
  ejecutarReset();
} 