/**
 * Script de prueba para verificar el cálculo correcto del estado de pago con retenciones
 * Ejecutar con: node scripts/test-estado-pago-retencion.js
 */

const { calcularValoresActualizados, calcularEstadoPago } = require('../utils/mathValidation');

console.log('🧪 INICIANDO PRUEBAS DE ESTADO DE PAGO CON RETENCIONES');
console.log('='.repeat(60));

// Caso de prueba: Documento con valor $2.06
const documentoEjemplo = {
  valorFactura: 2.06,
  valorPagado: 0.00,
  valorPendiente: 2.06,
  valorRetenido: 0.00,
  tieneRetencion: false,
  estadoPago: 'pendiente'
};

// Datos de retención extraídos del PDF
const datosRetencion = {
  retencionIva: 0.27,
  retencionRenta: 0.18,
  totalRetenido: 0.45,
  numeroComprobanteRetencion: '001-002-000117750',
  rucEmpresaRetenedora: '1234567890001',
  razonSocialRetenedora: 'EMPRESA RETENEDORA S.A.'
};

console.log('📄 DOCUMENTO DE PRUEBA:');
console.log('- Valor Factura:', documentoEjemplo.valorFactura);
console.log('- Valor Pagado:', documentoEjemplo.valorPagado);
console.log('- Valor Pendiente:', documentoEjemplo.valorPendiente);
console.log('- Valor Retenido:', documentoEjemplo.valorRetenido);
console.log('- Estado Actual:', documentoEjemplo.estadoPago);
console.log('');

console.log('💰 DATOS DE RETENCIÓN:');
console.log('- Retención IVA:', datosRetencion.retencionIva);
console.log('- Retención Renta:', datosRetencion.retencionRenta);
console.log('- Total Retenido:', datosRetencion.totalRetenido);
console.log('');

// Caso 1: Pago de $1.61 con retención de $0.45
console.log('🧮 CASO 1: Pago de $1.61 con retención de $0.45');
console.log('-'.repeat(50));

try {
  const montoPago = 1.61;
  const valoresActualizados = calcularValoresActualizados(documentoEjemplo, montoPago, datosRetencion);
  
  console.log('✅ RESULTADO:');
  console.log('- Nuevo Valor Pagado:', valoresActualizados.valorPagado);
  console.log('- Nuevo Valor Pendiente:', valoresActualizados.valorPendiente);
  console.log('- Nuevo Valor Retenido:', valoresActualizados.valorRetenido);
  console.log('- Nuevo Estado:', valoresActualizados.estadoPago);
  console.log('- Tiene Retención:', valoresActualizados.tieneRetencion);
  
  // Verificar ecuación matemática
  const suma = valoresActualizados.valorPagado + valoresActualizados.valorPendiente + valoresActualizados.valorRetenido;
  const diferencia = Math.abs(suma - documentoEjemplo.valorFactura);
  
  console.log('');
  console.log('🔍 VERIFICACIÓN MATEMÁTICA:');
  console.log(`${documentoEjemplo.valorFactura} = ${valoresActualizados.valorPagado} + ${valoresActualizados.valorPendiente} + ${valoresActualizados.valorRetenido}`);
  console.log(`${documentoEjemplo.valorFactura} = ${suma.toFixed(2)}`);
  console.log(`Diferencia: ${diferencia.toFixed(4)} (debe ser ≤ 0.02)`);
  
  if (diferencia <= 0.02) {
    console.log('✅ Ecuación matemática CORRECTA');
  } else {
    console.log('❌ Ecuación matemática INCORRECTA');
  }
  
  // Verificar estado esperado
  if (valoresActualizados.estadoPago === 'pagado_con_retencion') {
    console.log('✅ Estado de pago CORRECTO: pagado_con_retencion');
  } else {
    console.log(`❌ Estado de pago INCORRECTO: esperado "pagado_con_retencion", obtenido "${valoresActualizados.estadoPago}"`);
  }
  
} catch (error) {
  console.log('❌ ERROR:', error.message);
}

console.log('');

// Caso 2: Solo pago sin retención
console.log('🧮 CASO 2: Pago completo de $2.06 sin retención');
console.log('-'.repeat(50));

try {
  const montoPago = 2.06;
  const valoresActualizados = calcularValoresActualizados(documentoEjemplo, montoPago, null);
  
  console.log('✅ RESULTADO:');
  console.log('- Nuevo Valor Pagado:', valoresActualizados.valorPagado);
  console.log('- Nuevo Valor Pendiente:', valoresActualizados.valorPendiente);
  console.log('- Nuevo Valor Retenido:', valoresActualizados.valorRetenido);
  console.log('- Nuevo Estado:', valoresActualizados.estadoPago);
  console.log('- Tiene Retención:', valoresActualizados.tieneRetencion);
  
  // Verificar estado esperado
  if (valoresActualizados.estadoPago === 'pagado_completo') {
    console.log('✅ Estado de pago CORRECTO: pagado_completo');
  } else {
    console.log(`❌ Estado de pago INCORRECTO: esperado "pagado_completo", obtenido "${valoresActualizados.estadoPago}"`);
  }
  
} catch (error) {
  console.log('❌ ERROR:', error.message);
}

console.log('');

// Caso 3: Pago parcial
console.log('🧮 CASO 3: Pago parcial de $1.00 sin retención');
console.log('-'.repeat(50));

try {
  const montoPago = 1.00;
  const valoresActualizados = calcularValoresActualizados(documentoEjemplo, montoPago, null);
  
  console.log('✅ RESULTADO:');
  console.log('- Nuevo Valor Pagado:', valoresActualizados.valorPagado);
  console.log('- Nuevo Valor Pendiente:', valoresActualizados.valorPendiente);
  console.log('- Nuevo Valor Retenido:', valoresActualizados.valorRetenido);
  console.log('- Nuevo Estado:', valoresActualizados.estadoPago);
  console.log('- Tiene Retención:', valoresActualizados.tieneRetencion);
  
  // Verificar estado esperado
  if (valoresActualizados.estadoPago === 'pago_parcial') {
    console.log('✅ Estado de pago CORRECTO: pago_parcial');
  } else {
    console.log(`❌ Estado de pago INCORRECTO: esperado "pago_parcial", obtenido "${valoresActualizados.estadoPago}"`);
  }
  
} catch (error) {
  console.log('❌ ERROR:', error.message);
}

console.log('');

// Caso 4: Prueba directa de calcularEstadoPago
console.log('🧮 CASO 4: Prueba directa de calcularEstadoPago');
console.log('-'.repeat(50));

const documentoConRetencion = {
  valorFactura: 2.06,
  valorPagado: 1.61,
  valorRetenido: 0.45,
  tieneRetencion: true
};

try {
  const estado = calcularEstadoPago(documentoConRetencion);
  console.log('✅ Estado calculado:', estado);
  
  if (estado === 'pagado_con_retencion') {
    console.log('✅ Función calcularEstadoPago CORRECTA');
  } else {
    console.log(`❌ Función calcularEstadoPago INCORRECTA: esperado "pagado_con_retencion", obtenido "${estado}"`);
  }
} catch (error) {
  console.log('❌ ERROR:', error.message);
}

console.log('');
console.log('🎯 PRUEBAS COMPLETADAS');
console.log('='.repeat(60)); 