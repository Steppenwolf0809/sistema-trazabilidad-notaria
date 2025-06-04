/**
 * Script de prueba para verificar cálculos de retención
 * Simula la función JavaScript que se usa en el frontend
 */

// Función de cálculo de retención (igual que en el frontend)
function calcularNetoConRetencion(totalFactura) {
  const subtotal = totalFactura / 1.15;        // Quitar IVA (15%)
  const iva = totalFactura - subtotal;         // IVA = diferencia
  
  // Retenciones típicas
  const retencionIVA = iva * 1.00;             // 100% del IVA
  const retencionRenta = subtotal * 0.10;      // 10% del subtotal
  const totalRetencion = retencionIVA + retencionRenta;
  
  const netoARecibir = totalFactura - totalRetencion;
  
  return {
    total: parseFloat(totalFactura.toFixed(2)),
    subtotal: parseFloat(subtotal.toFixed(2)),
    iva: parseFloat(iva.toFixed(2)),
    retencionIVA: parseFloat(retencionIVA.toFixed(2)),
    retencionRenta: parseFloat(retencionRenta.toFixed(2)),
    totalRetencion: parseFloat(totalRetencion.toFixed(2)),
    neto: parseFloat(netoARecibir.toFixed(2))
  };
}

// Casos de prueba
const casosPrueba = [
  2.06,   // Caso real del usuario
  10.00,  // Caso redondo
  23.00,  // Caso típico
  115.00, // Caso más grande
  1.15    // Caso mínimo
];

console.log('🧮 PRUEBAS DE CÁLCULO DE RETENCIÓN');
console.log('=====================================');

casosPrueba.forEach((total, index) => {
  console.log(`\n📊 CASO ${index + 1}: Factura de $${total}`);
  console.log('─'.repeat(40));
  
  const calculo = calcularNetoConRetencion(total);
  
  console.log(`Total Factura:     $${calculo.total}`);
  console.log(`Subtotal s/IVA:    $${calculo.subtotal}`);
  console.log(`IVA (15%):         $${calculo.iva}`);
  console.log(`Retención IVA:    -$${calculo.retencionIVA}`);
  console.log(`Retención Renta:  -$${calculo.retencionRenta}`);
  console.log(`Total Retenciones: -$${calculo.totalRetencion}`);
  console.log(`🎯 NETO A RECIBIR: $${calculo.neto}`);
  
  // Verificación matemática
  const verificacion = calculo.neto + calculo.totalRetencion;
  const esCorrecta = Math.abs(verificacion - calculo.total) < 0.01;
  console.log(`✓ Verificación: $${calculo.neto} + $${calculo.totalRetencion} = $${verificacion.toFixed(2)} ${esCorrecta ? '✅' : '❌'}`);
});

console.log('\n🎯 RESUMEN DE FUNCIONALIDAD:');
console.log('• Fórmula: Total - (IVA_100% + Renta_10%)');
console.log('• IVA se calcula como: Total - (Total/1.15)');
console.log('• Retención Renta: 10% del subtotal sin IVA');
console.log('• Retención IVA: 100% del IVA calculado');
console.log('• Resultado: Monto neto que recibirá la notaría');

console.log('\n✅ Script de prueba completado'); 