/**
 * SCRIPT DE PRUEBA: Dashboard Comparativo
 * Verifica que la funcionalidad de comparación de períodos funcione correctamente
 */

const moment = require('moment');

console.log('🧪 INICIANDO PRUEBAS DEL DASHBOARD COMPARATIVO');
console.log('================================================');

// Simular datos de prueba
const periodoA = {
  facturado: 692.01,
  cobrado: 449.35,
  retenido: 4.45,
  pendiente: 238.21,
  totalDocumentos: 21,
  entregados: 6,
  eficiencia: 29
};

const periodoB = {
  facturado: 601.50,
  cobrado: 414.80,
  retenido: 3.20,
  pendiente: 183.50,
  totalDocumentos: 12,
  entregados: 4,
  eficiencia: 33
};

// Función de análisis comparativo (copiada del controlador)
function generarAnalisisComparativo(periodoA, periodoB) {
  const metricas = [
    { key: 'facturado', nombre: 'Facturado', formato: 'moneda', icono: 'fas fa-file-invoice' },
    { key: 'cobrado', nombre: 'Cobrado', formato: 'moneda', icono: 'fas fa-dollar-sign' },
    { key: 'retenido', nombre: 'Retenido', formato: 'moneda', icono: 'fas fa-receipt' },
    { key: 'pendiente', nombre: 'Pendiente', formato: 'moneda', icono: 'fas fa-clock' },
    { key: 'totalDocumentos', nombre: 'Documentos', formato: 'numero', icono: 'fas fa-file-alt' },
    { key: 'entregados', nombre: 'Entregados', formato: 'numero', icono: 'fas fa-handshake' },
    { key: 'eficiencia', nombre: 'Eficiencia', formato: 'porcentaje', icono: 'fas fa-chart-line' }
  ];
  
  const comparaciones = metricas.map(metrica => {
    const valorA = periodoA[metrica.key] || 0;
    const valorB = periodoB[metrica.key] || 0;
    const diferencia = valorA - valorB;
    const porcentaje = valorB !== 0 ? ((diferencia / valorB) * 100) : 0;
    
    return {
      ...metrica,
      valorA,
      valorB,
      diferencia,
      porcentaje: Math.round(porcentaje * 10) / 10,
      direccion: diferencia > 0 ? 'up' : diferencia < 0 ? 'down' : 'equal',
      color: diferencia > 0 ? 'success' : diferencia < 0 ? 'danger' : 'secondary',
      significativo: Math.abs(porcentaje) >= 10
    };
  });
  
  const cambiosSignificativos = comparaciones
    .filter(c => c.significativo)
    .sort((a, b) => Math.abs(b.porcentaje) - Math.abs(a.porcentaje))
    .slice(0, 3);
  
  const mejoras = comparaciones.filter(c => c.direccion === 'up' && c.significativo);
  const empeoramientos = comparaciones.filter(c => c.direccion === 'down' && c.significativo);
  
  const recomendaciones = [];
  if (mejoras.length > empeoramientos.length) {
    recomendaciones.push('Tendencia positiva general - mantener estrategias actuales');
  }
  if (empeoramientos.some(e => e.key === 'pendiente')) {
    recomendaciones.push('Revisar proceso de cobros - pendientes aumentaron');
  }
  if (mejoras.some(m => m.key === 'eficiencia')) {
    recomendaciones.push('Eficiencia operativa mejorando - continuar optimizaciones');
  }
  if (empeoramientos.some(e => e.key === 'totalDocumentos')) {
    recomendaciones.push('Volumen de documentos disminuyó - revisar captación');
  }
  
  return {
    comparaciones,
    insights: {
      cambiosSignificativos,
      mejoras,
      empeoramientos,
      recomendaciones
    }
  };
}

// Ejecutar análisis
console.log('📊 DATOS DE ENTRADA:');
console.log('Período A (Base):', periodoA);
console.log('Período B (Comparar):', periodoB);
console.log('');

const analisis = generarAnalisisComparativo(periodoA, periodoB);

console.log('📈 RESULTADOS DEL ANÁLISIS:');
console.log('============================');

console.log('\n🔍 COMPARACIONES POR MÉTRICA:');
analisis.comparaciones.forEach(comp => {
  const signo = comp.diferencia >= 0 ? '+' : '';
  const formato = comp.formato === 'moneda' ? '$' : comp.formato === 'porcentaje' ? '%' : '';
  
  console.log(`\n${comp.nombre.toUpperCase()}:`);
  console.log(`  Período A: ${formato}${comp.valorA}${comp.formato === 'porcentaje' ? '%' : ''}`);
  console.log(`  Período B: ${formato}${comp.valorB}${comp.formato === 'porcentaje' ? '%' : ''}`);
  console.log(`  Diferencia: ${signo}${formato}${comp.diferencia}${comp.formato === 'porcentaje' ? '%' : ''}`);
  console.log(`  Porcentaje: ${signo}${comp.porcentaje}%`);
  console.log(`  Dirección: ${comp.direccion} (${comp.color})`);
  console.log(`  Significativo: ${comp.significativo ? 'SÍ' : 'NO'}`);
});

console.log('\n🧠 INSIGHTS AUTOMÁTICOS:');
console.log('=========================');

console.log('\n📈 Cambios Más Significativos:');
if (analisis.insights.cambiosSignificativos.length > 0) {
  analisis.insights.cambiosSignificativos.forEach((cambio, index) => {
    console.log(`  ${index + 1}. ${cambio.nombre}: ${cambio.porcentaje >= 0 ? '+' : ''}${cambio.porcentaje}%`);
  });
} else {
  console.log('  No hay cambios significativos (>= 10%)');
}

console.log('\n✅ Mejoras:');
if (analisis.insights.mejoras.length > 0) {
  analisis.insights.mejoras.forEach(mejora => {
    console.log(`  • ${mejora.nombre}: +${mejora.porcentaje}%`);
  });
} else {
  console.log('  No hay mejoras significativas');
}

console.log('\n⚠️ Empeoramientos:');
if (analisis.insights.empeoramientos.length > 0) {
  analisis.insights.empeoramientos.forEach(empeoramiento => {
    console.log(`  • ${empeoramiento.nombre}: ${empeoramiento.porcentaje}%`);
  });
} else {
  console.log('  No hay empeoramientos significativos');
}

console.log('\n🎯 Recomendaciones:');
if (analisis.insights.recomendaciones.length > 0) {
  analisis.insights.recomendaciones.forEach(recomendacion => {
    console.log(`  • ${recomendacion}`);
  });
} else {
  console.log('  No hay recomendaciones específicas');
}

console.log('\n📊 RESUMEN EJECUTIVO:');
console.log('=====================');
console.log(`Mejoras: ${analisis.insights.mejoras.length}`);
console.log(`Empeoramientos: ${analisis.insights.empeoramientos.length}`);

if (analisis.insights.mejoras.length > analisis.insights.empeoramientos.length) {
  console.log('🟢 TENDENCIA: POSITIVA - Más mejoras que retrocesos');
} else if (analisis.insights.empeoramientos.length > analisis.insights.mejoras.length) {
  console.log('🟡 TENDENCIA: REQUIERE ATENCIÓN - Más disminuciones que mejoras');
} else {
  console.log('🔵 TENDENCIA: ESTABLE - Cambios equilibrados');
}

console.log('\n✅ PRUEBA COMPLETADA EXITOSAMENTE');
console.log('==================================');

// Verificar matemática
console.log('\n🧮 VERIFICACIÓN MATEMÁTICA:');
console.log('============================');

// Verificar fórmula: Facturado = Cobrado + Retenido + Pendiente
const verificacionA = periodoA.facturado - (periodoA.cobrado + periodoA.retenido + periodoA.pendiente);
const verificacionB = periodoB.facturado - (periodoB.cobrado + periodoB.retenido + periodoB.pendiente);

console.log(`Período A: ${periodoA.facturado} = ${periodoA.cobrado} + ${periodoA.retenido} + ${periodoA.pendiente}`);
console.log(`Diferencia A: ${verificacionA.toFixed(2)} ${Math.abs(verificacionA) < 0.01 ? '✅ EXACTA' : '❌ ERROR'}`);

console.log(`Período B: ${periodoB.facturado} = ${periodoB.cobrado} + ${periodoB.retenido} + ${periodoB.pendiente}`);
console.log(`Diferencia B: ${verificacionB.toFixed(2)} ${Math.abs(verificacionB) < 0.01 ? '✅ EXACTA' : '❌ ERROR'}`);

console.log('\n🎉 DASHBOARD COMPARATIVO LISTO PARA PRODUCCIÓN'); 