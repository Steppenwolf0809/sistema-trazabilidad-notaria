/**
 * Script de Testing Matemática Financiera - ProNotary
 * 
 * OBJETIVO: Validar que los cálculos financieros sean matemáticamente correctos
 * 
 * Ejecutar con: node test-matematica-financiera.js
 */

const { sequelize } = require('./config/database');
const db = require('./models');

/**
 * Función para calcular métricas financieras actuales
 */
async function calcularMetricasFinancieras(fechaInicio = null, fechaFin = null) {
  try {
    let whereClause = `
      WHERE numero_factura IS NOT NULL
      AND estado NOT IN ('eliminado', 'nota_credito')
    `;
    
    if (fechaInicio && fechaFin) {
      whereClause += ` AND fecha_factura BETWEEN '${fechaInicio}' AND '${fechaFin}'`;
    }
    
    // 1. Total facturado
    const [facturadoResult] = await sequelize.query(`
      SELECT COALESCE(SUM(valor_factura), 0) as total
      FROM documentos
      ${whereClause}
    `);
    
    // 2. Total cobrado (pagado)
    const [cobradoResult] = await sequelize.query(`
      SELECT COALESCE(SUM(valor_factura), 0) as total
      FROM documentos
      ${whereClause}
      AND estado_pago = 'pagado'
    `);
    
    // 3. Total pendiente
    const [pendienteResult] = await sequelize.query(`
      SELECT COALESCE(SUM(valor_factura), 0) as total
      FROM documentos
      ${whereClause}
      AND estado_pago = 'pendiente'
    `);
    
    // 4. Conteos
    const [conteoResult] = await sequelize.query(`
      SELECT 
        COUNT(*) as total_documentos,
        COUNT(CASE WHEN estado_pago = 'pagado' THEN 1 END) as documentos_pagados,
        COUNT(CASE WHEN estado_pago = 'pendiente' THEN 1 END) as documentos_pendientes
      FROM documentos
      ${whereClause}
    `);
    
    const facturado = parseFloat(facturadoResult[0]?.total || 0);
    const cobrado = parseFloat(cobradoResult[0]?.total || 0);
    const pendiente = parseFloat(pendienteResult[0]?.total || 0);
    
    const conteos = conteoResult[0];
    
    return {
      facturado,
      cobrado,
      pendiente,
      totalDocumentos: parseInt(conteos.total_documentos),
      documentosPagados: parseInt(conteos.documentos_pagados),
      documentosPendientes: parseInt(conteos.documentos_pendientes)
    };
    
  } catch (error) {
    console.error('Error calculando métricas financieras:', error);
    throw error;
  }
}

/**
 * Función para validar consistencia matemática
 */
function validarConsistenciaMatematica(metricas) {
  const { facturado, cobrado, pendiente, totalDocumentos, documentosPagados, documentosPendientes } = metricas;
  
  const resultados = {
    valido: true,
    errores: [],
    advertencias: []
  };
  
  // Validación 1: Facturado = Cobrado + Pendiente
  const suma = cobrado + pendiente;
  const diferencia = Math.abs(facturado - suma);
  
  if (diferencia > 0.01) {
    resultados.valido = false;
    resultados.errores.push({
      tipo: 'INCONSISTENCIA_FINANCIERA',
      descripcion: `Facturado ($${facturado.toFixed(2)}) ≠ Cobrado + Pendiente ($${suma.toFixed(2)})`,
      diferencia: diferencia.toFixed(2)
    });
  }
  
  // Validación 2: Conteo de documentos
  const sumaDocumentos = documentosPagados + documentosPendientes;
  if (totalDocumentos !== sumaDocumentos) {
    resultados.valido = false;
    resultados.errores.push({
      tipo: 'INCONSISTENCIA_CONTEO',
      descripcion: `Total documentos (${totalDocumentos}) ≠ Pagados + Pendientes (${sumaDocumentos})`,
      diferencia: Math.abs(totalDocumentos - sumaDocumentos)
    });
  }
  
  // Validación 3: Valores negativos
  if (facturado < 0 || cobrado < 0 || pendiente < 0) {
    resultados.valido = false;
    resultados.errores.push({
      tipo: 'VALORES_NEGATIVOS',
      descripcion: 'Se encontraron valores negativos en las métricas financieras'
    });
  }
  
  // Advertencias
  if (facturado === 0 && totalDocumentos > 0) {
    resultados.advertencias.push({
      tipo: 'SIN_FACTURACION',
      descripcion: 'Hay documentos pero no hay facturación registrada'
    });
  }
  
  if (pendiente > facturado * 0.8) {
    resultados.advertencias.push({
      tipo: 'ALTO_PENDIENTE',
      descripcion: 'Más del 80% de la facturación está pendiente de cobro'
    });
  }
  
  return resultados;
}

/**
 * Función para generar reporte detallado
 */
function generarReporte(metricas, validacion, periodo = 'TODOS LOS DATOS') {
  console.log('📊 REPORTE DE MATEMÁTICA FINANCIERA');
  console.log('===================================\n');
  
  console.log(`🗓️  Período: ${periodo}`);
  console.log(`📅 Fecha del reporte: ${new Date().toLocaleString()}\n`);
  
  // Métricas principales
  console.log('💰 MÉTRICAS FINANCIERAS:');
  console.log(`   • Total facturado: $${metricas.facturado.toFixed(2)}`);
  console.log(`   • Total cobrado: $${metricas.cobrado.toFixed(2)}`);
  console.log(`   • Pendiente de cobro: $${metricas.pendiente.toFixed(2)}`);
  console.log(`   • Suma (C+P): $${(metricas.cobrado + metricas.pendiente).toFixed(2)}\n`);
  
  // Conteos
  console.log('📋 CONTEO DE DOCUMENTOS:');
  console.log(`   • Total documentos: ${metricas.totalDocumentos}`);
  console.log(`   • Documentos pagados: ${metricas.documentosPagados}`);
  console.log(`   • Documentos pendientes: ${metricas.documentosPendientes}`);
  console.log(`   • Suma documentos: ${metricas.documentosPagados + metricas.documentosPendientes}\n`);
  
  // Porcentajes
  if (metricas.facturado > 0) {
    const porcentajeCobrado = (metricas.cobrado / metricas.facturado * 100).toFixed(1);
    const porcentajePendiente = (metricas.pendiente / metricas.facturado * 100).toFixed(1);
    
    console.log('📈 PORCENTAJES:');
    console.log(`   • Cobrado: ${porcentajeCobrado}%`);
    console.log(`   • Pendiente: ${porcentajePendiente}%\n`);
  }
  
  // Validación
  console.log('✅ VALIDACIÓN MATEMÁTICA:');
  if (validacion.valido) {
    console.log('   🎉 ¡MATEMÁTICA CORRECTA! Todos los cálculos son consistentes\n');
  } else {
    console.log('   ❌ ERRORES DETECTADOS:\n');
    validacion.errores.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error.tipo}:`);
      console.log(`      ${error.descripcion}`);
      if (error.diferencia) {
        console.log(`      Diferencia: $${error.diferencia}`);
      }
      console.log('');
    });
  }
  
  // Advertencias
  if (validacion.advertencias.length > 0) {
    console.log('⚠️  ADVERTENCIAS:');
    validacion.advertencias.forEach((advertencia, index) => {
      console.log(`   ${index + 1}. ${advertencia.tipo}:`);
      console.log(`      ${advertencia.descripcion}\n`);
    });
  }
  
  return validacion.valido;
}

/**
 * Función para testing con datos de muestra
 */
async function testearConDatosMuestra() {
  console.log('🧪 TESTING CON DATOS DE MUESTRA...\n');
  
  try {
    // Verificar si hay datos para testear
    const totalDocs = await db.Documento.count();
    
    if (totalDocs === 0) {
      console.log('📝 No hay documentos en la base de datos');
      console.log('   Para testing completo, cargar algunos documentos XML\n');
      return true;
    }
    
    console.log(`📄 Encontrados ${totalDocs} documentos para analizar\n`);
    
    // Obtener muestra de documentos
    const muestra = await db.Documento.findAll({
      attributes: ['id', 'codigo_barras', 'numero_factura', 'valor_factura', 'estado_pago'],
      limit: 5,
      order: [['created_at', 'DESC']]
    });
    
    console.log('📋 MUESTRA DE DOCUMENTOS:');
    muestra.forEach((doc, index) => {
      console.log(`   ${index + 1}. ${doc.codigo_barras}`);
      console.log(`      Factura: ${doc.numero_factura || 'Sin facturar'}`);
      console.log(`      Valor: $${doc.valor_factura || '0.00'}`);
      console.log(`      Estado pago: ${doc.estado_pago || 'pendiente'}\n`);
    });
    
    return true;
    
  } catch (error) {
    console.error('Error en testing con datos de muestra:', error);
    return false;
  }
}

/**
 * Función para testing por períodos
 */
async function testearPorPeriodos() {
  console.log('📅 TESTING POR PERÍODOS...\n');
  
  try {
    const hoy = new Date();
    const hace30Dias = new Date(hoy);
    hace30Dias.setDate(hoy.getDate() - 30);
    
    const fechaInicio = hace30Dias.toISOString().split('T')[0];
    const fechaFin = hoy.toISOString().split('T')[0];
    
    console.log(`🗓️  Analizando período: ${fechaInicio} a ${fechaFin}\n`);
    
    const metricas = await calcularMetricasFinancieras(fechaInicio, fechaFin);
    const validacion = validarConsistenciaMatematica(metricas);
    
    const esValido = generarReporte(metricas, validacion, `${fechaInicio} a ${fechaFin}`);
    
    return esValido;
    
  } catch (error) {
    console.error('Error en testing por períodos:', error);
    return false;
  }
}

/**
 * Función principal de testing
 */
async function testearMatematicaFinanciera() {
  try {
    console.log('🧮 SISTEMA DE TESTING MATEMÁTICA FINANCIERA - PRONOTARY');
    console.log('======================================================\n');
    
    // Test 1: Análisis general
    console.log('🔍 TEST 1: ANÁLISIS GENERAL DE TODA LA BASE DE DATOS\n');
    
    const metricasGenerales = await calcularMetricasFinancieras();
    const validacionGeneral = validarConsistenciaMatematica(metricasGenerales);
    
    const generalValido = generarReporte(metricasGenerales, validacionGeneral);
    
    // Test 2: Datos de muestra
    console.log('\n' + '='.repeat(60) + '\n');
    console.log('🔍 TEST 2: ANÁLISIS DE DATOS DE MUESTRA\n');
    
    const muestraValida = await testearConDatosMuestra();
    
    // Test 3: Análisis por período
    console.log('\n' + '='.repeat(60) + '\n');
    console.log('🔍 TEST 3: ANÁLISIS POR PERÍODO (ÚLTIMOS 30 DÍAS)\n');
    
    const periodoValido = await testearPorPeriodos();
    
    // Resumen final
    console.log('\n' + '='.repeat(60) + '\n');
    console.log('🎯 RESUMEN FINAL DEL TESTING\n');
    
    const todosLosTestsValidos = generalValido && muestraValida && periodoValido;
    
    if (todosLosTestsValidos) {
      console.log('✅ ¡TODOS LOS TESTS PASARON EXITOSAMENTE!');
      console.log('✅ La matemática financiera es correcta');
      console.log('✅ No se detectaron inconsistencias');
      console.log('\n🎉 El sistema está listo para uso en producción');
    } else {
      console.log('❌ ALGUNOS TESTS FALLARON');
      console.log('⚠️  Revisar los errores reportados arriba');
      console.log('🔧 Considerar ejecutar el reset de datos legacy');
    }
    
    console.log('\n📋 PRÓXIMOS PASOS RECOMENDADOS:');
    if (metricasGenerales.totalDocumentos === 0) {
      console.log('1. Cargar documentos XML reales para testing completo');
      console.log('2. Facturar algunos documentos');
      console.log('3. Registrar pagos de prueba');
      console.log('4. Ejecutar este test nuevamente');
    } else {
      console.log('1. Verificar dashboard administrativo');
      console.log('2. Confirmar que las métricas mostradas coinciden');
      console.log('3. Realizar flujo completo: XML → Factura → Pago → Entrega');
    }
    
    return todosLosTestsValidos;
    
  } catch (error) {
    console.error('💥 Error durante testing:', error);
    console.log('\n🆘 Si el error persiste:');
    console.log('1. Verificar conexión a base de datos');
    console.log('2. Asegurar que las tablas existen');
    console.log('3. Verificar que los modelos están correctamente definidos');
    return false;
  } finally {
    // Cerrar conexión
    try {
      await sequelize.close();
      console.log('\n🔌 Conexión a base de datos cerrada');
    } catch (error) {
      console.log('⚠️  Error cerrando conexión:', error.message);
    }
  }
}

// Exportar funciones para uso modular
module.exports = {
  calcularMetricasFinancieras,
  validarConsistenciaMatematica,
  generarReporte,
  testearMatematicaFinanciera
};

// Si se ejecuta directamente
if (require.main === module) {
  testearMatematicaFinanciera();
} 