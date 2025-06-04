/**
 * Utilidades para validaciones matemáticas del sistema de pagos
 * Garantiza coherencia matemática en todos los cálculos financieros
 */

/**
 * Calcula el estado de pago basado en los montos (ACTUALIZADO para pagos parciales)
 * @param {Object} documento - Documento con información financiera
 * @param {number} nuevoPago - Monto del nuevo pago (opcional)
 * @returns {string} Estado de pago calculado
 */
function calcularEstadoPago(documento, nuevoPago = 0) {
  // 🔍 DEBUG: Añadir logging detallado
  console.log('🔍 DEBUG calcularEstadoPago - Parámetros recibidos:', {
    documento: {
      id: documento?.id,
      valorFactura: documento?.valorFactura,
      valorPagado: documento?.valorPagado,
      valorRetenido: documento?.valorRetenido,
      tieneRetencion: documento?.tieneRetencion,
      estadoPago: documento?.estadoPago
    },
    nuevoPago,
    tipoDocumento: typeof documento
  });
  
  // Validar que documento existe
  if (!documento) {
    console.error('❌ Error: documento es null o undefined');
    throw new Error('Documento no proporcionado para calcular estado de pago');
  }
  
  const totalFactura = parseFloat(documento.valorFactura || 0);
  const totalPagado = parseFloat(documento.valorPagado || 0) + parseFloat(nuevoPago);
  const totalRetenido = parseFloat(documento.valorRetenido || 0);
  const tieneRetencion = documento.tieneRetencion || false;
  
  console.log('🔍 DEBUG calcularEstadoPago - Valores parseados:', {
    totalFactura,
    totalPagado,
    totalRetenido,
    tieneRetencion,
    valorFacturaOriginal: documento.valorFactura,
    tipoValorFactura: typeof documento.valorFactura
  });
  
  // Validación básica con mensaje más descriptivo
  if (totalFactura <= 0) {
    console.error('❌ Error en calcularEstadoPago:', {
      valorFacturaOriginal: documento.valorFactura,
      valorFacturaParsed: totalFactura,
      documentoCompleto: documento
    });
    throw new Error(`El valor de la factura debe ser mayor a 0. Recibido: ${documento.valorFactura} (tipo: ${typeof documento.valorFactura})`);
  }
  
  if (totalPagado < 0) {
    throw new Error('El total pagado no puede ser negativo');
  }
  
  if (totalRetenido < 0) {
    throw new Error('El total retenido no puede ser negativo');
  }
  
  // CORREGIDO: Calcular total cubierto (pagado + retenido)
  const totalCubierto = totalPagado + totalRetenido;
  
  console.log('🔍 DEBUG calcularEstadoPago - Cálculos:', {
    totalFactura,
    totalPagado,
    totalRetenido,
    totalCubierto,
    diferencia: totalFactura - totalCubierto
  });
  
  if (totalCubierto > totalFactura + 0.01) { // Tolerancia de 1 centavo
    throw new Error(`El total cubierto ($${totalCubierto.toFixed(2)}) excede el valor de la factura ($${totalFactura.toFixed(2)})`);
  }
  
  // ACTUALIZADO: Determinar estado basado en total cubierto con soporte para pagos parciales
  let estadoCalculado;
  const diferencia = totalFactura - totalCubierto;
  
  if (totalCubierto === 0) {
    estadoCalculado = 'pendiente';
  } else if (diferencia > 0.01) { // Más de 1 centavo pendiente
    estadoCalculado = 'pago_parcial'; // NUEVO: Estado para pagos parciales
  } else if (Math.abs(diferencia) <= 0.01) { // Completamente pagado (tolerancia de 1 centavo)
    // CORREGIDO: Determinar tipo de pago completo
    if (tieneRetencion || totalRetenido > 0) {
      estadoCalculado = 'pagado'; // Simplificado: usar 'pagado' para todos los casos completos
    } else {
      estadoCalculado = 'pagado';
    }
  } else {
    throw new Error('Estado de pago indeterminado');
  }
  
  console.log('✅ DEBUG calcularEstadoPago - Estado calculado:', {
    estadoCalculado,
    diferencia: diferencia.toFixed(2),
    totalCubierto: totalCubierto.toFixed(2),
    totalFactura: totalFactura.toFixed(2)
  });
  
  return estadoCalculado;
}

/**
 * Valida la coherencia matemática de un documento
 * @param {Object} documento - Documento a validar
 * @returns {Object} Resultado de la validación
 */
function validarCoherenciaMatematica(documento) {
  const errores = [];
  const advertencias = [];
  
  const valorFactura = parseFloat(documento.valorFactura || 0);
  const valorPagado = parseFloat(documento.valorPagado || 0);
  const valorPendiente = parseFloat(documento.valorPendiente || 0);
  const valorRetenido = parseFloat(documento.valorRetenido || 0);
  
  // Validación principal: Factura = Pagado + Pendiente + Retenido
  const sumaCalculada = valorPagado + valorPendiente + valorRetenido;
  const diferencia = Math.abs(valorFactura - sumaCalculada);
  
  if (diferencia > 0.02) { // Tolerancia de 2 centavos por redondeos
    errores.push(`Inconsistencia matemática: Factura ($${valorFactura.toFixed(2)}) ≠ Pagado + Pendiente + Retenido ($${sumaCalculada.toFixed(2)})`);
  }
  
  // Validar valores no negativos
  if (valorFactura < 0) errores.push('El valor de la factura no puede ser negativo');
  if (valorPagado < 0) errores.push('El valor pagado no puede ser negativo');
  if (valorPendiente < 0) errores.push('El valor pendiente no puede ser negativo');
  if (valorRetenido < 0) errores.push('El valor retenido no puede ser negativo');
  
  // Validar coherencia con estado de pago
  const estadoCalculado = calcularEstadoPago(documento);
  if (documento.estadoPago !== estadoCalculado) {
    advertencias.push(`Estado de pago inconsistente: actual "${documento.estadoPago}", calculado "${estadoCalculado}"`);
  }
  
  // Validar retenciones
  if (documento.tieneRetencion && valorRetenido === 0) {
    advertencias.push('El documento indica tener retención pero el valor retenido es 0');
  }
  
  if (!documento.tieneRetencion && valorRetenido > 0) {
    advertencias.push('El documento tiene valor retenido pero no está marcado como con retención');
  }
  
  return {
    valido: errores.length === 0,
    errores,
    advertencias,
    diferencia: diferencia
  };
}

/**
 * Calcula los valores actualizados después de un pago
 * @param {Object} documento - Documento actual
 * @param {number} montoPago - Monto del nuevo pago
 * @param {Object} datosRetencion - Datos de retención (opcional)
 * @returns {Object} Valores actualizados
 */
function calcularValoresActualizados(documento, montoPago, datosRetencion = null) {
  console.log('🔍 DEBUG calcularValoresActualizados - Entrada:', {
    documentoId: documento?.id,
    valorFactura: documento?.valorFactura,
    valorPagadoActual: documento?.valorPagado,
    valorRetenidoActual: documento?.valorRetenido,
    montoPago,
    datosRetencion,
    tipoDocumento: typeof documento
  });
  
  // Validar que documento existe y tiene valorFactura
  if (!documento) {
    console.error('❌ Error: documento es null o undefined en calcularValoresActualizados');
    throw new Error('Documento no proporcionado para calcular valores actualizados');
  }
  
  if (!documento.valorFactura || documento.valorFactura <= 0) {
    console.error('❌ Error: documento sin valorFactura válido:', {
      valorFactura: documento.valorFactura,
      tipoValorFactura: typeof documento.valorFactura,
      documentoCompleto: documento
    });
    throw new Error(`Documento inválido o sin valor de factura válido. Valor: ${documento.valorFactura}`);
  }
  
  const valorFactura = parseFloat(documento.valorFactura || 0);
  const valorPagadoActual = parseFloat(documento.valorPagado || 0);
  const valorRetenidoActual = parseFloat(documento.valorRetenido || 0);
  
  // Calcular nuevos valores
  const nuevoValorPagado = valorPagadoActual + parseFloat(montoPago);
  const nuevoValorRetenido = valorRetenidoActual + parseFloat(datosRetencion?.totalRetenido || 0);
  const nuevoValorPendiente = valorFactura - nuevoValorPagado - nuevoValorRetenido;
  
  console.log('💰 DEBUG calcularValoresActualizados - Cálculos:', {
    valorFactura,
    valorPagadoActual,
    valorRetenidoActual,
    montoPago: parseFloat(montoPago),
    totalRetencion: parseFloat(datosRetencion?.totalRetenido || 0),
    nuevoValorPagado,
    nuevoValorRetenido,
    nuevoValorPendiente
  });
  
  // Validar que el pendiente no sea significativamente negativo (tolerancia de 2 centavos)
  if (nuevoValorPendiente < -0.02) {
    throw new Error(`El pago y retención exceden el valor de la factura. Pendiente resultante: $${nuevoValorPendiente.toFixed(2)}`);
  }
  
  // Si el pendiente es muy pequeño (menor a 2 centavos), ajustarlo a 0
  const pendienteFinal = nuevoValorPendiente < 0.02 ? 0 : nuevoValorPendiente;
  
  // Determinar nuevo estado
  const documentoTemporal = {
    // Preservar propiedades esenciales del documento original
    id: documento.id,
    valorFactura: documento.valorFactura,
    estadoPago: documento.estadoPago,
    tieneRetencion: documento.tieneRetencion || (datosRetencion !== null),
    // Nuevos valores calculados
    valorPagado: nuevoValorPagado,
    valorRetenido: nuevoValorRetenido,
    valorPendiente: pendienteFinal
  };
  
  console.log('🔍 DEBUG calcularValoresActualizados - Documento temporal para calcular estado:', {
    id: documentoTemporal.id,
    valorFactura: documentoTemporal.valorFactura,
    valorPagado: documentoTemporal.valorPagado,
    valorRetenido: documentoTemporal.valorRetenido,
    valorPendiente: documentoTemporal.valorPendiente,
    tieneRetencion: documentoTemporal.tieneRetencion
  });
  
  const nuevoEstado = calcularEstadoPago(documentoTemporal);
  
  const resultado = {
    valorPagado: parseFloat(nuevoValorPagado.toFixed(2)),
    valorPendiente: parseFloat(pendienteFinal.toFixed(2)),
    valorRetenido: parseFloat(nuevoValorRetenido.toFixed(2)),
    estadoPago: nuevoEstado,
    tieneRetencion: documentoTemporal.tieneRetencion
  };
  
  console.log('✅ DEBUG calcularValoresActualizados - Resultado:', resultado);
  
  return resultado;
}

/**
 * Procesa una retención tardía (cuando llega después del pago)
 * @param {Object} documento - Documento actual
 * @param {Object} datosRetencion - Datos de la retención
 * @returns {Object} Valores ajustados
 */
function procesarRetencionTardia(documento, datosRetencion) {
  const valorPendienteActual = parseFloat(documento.valorPendiente || 0);
  const totalRetenido = parseFloat(datosRetencion.totalRetenido || 0);
  
  // Validar que la retención no exceda el pendiente
  if (totalRetenido > valorPendienteActual) {
    throw new Error(`La retención ($${totalRetenido.toFixed(2)}) excede el valor pendiente ($${valorPendienteActual.toFixed(2)})`);
  }
  
  // Calcular nuevo pendiente
  const nuevoValorPendiente = valorPendienteActual - totalRetenido;
  const nuevoValorRetenido = parseFloat(documento.valorRetenido || 0) + totalRetenido;
  
  // Determinar nuevo estado
  const documentoTemporal = {
    ...documento,
    valorPendiente: nuevoValorPendiente,
    valorRetenido: nuevoValorRetenido,
    tieneRetencion: true
  };
  
  const nuevoEstado = calcularEstadoPago(documentoTemporal);
  
  return {
    valorPendiente: parseFloat(nuevoValorPendiente.toFixed(2)),
    valorRetenido: parseFloat(nuevoValorRetenido.toFixed(2)),
    estadoPago: nuevoEstado,
    tieneRetencion: true
  };
}

/**
 * Inicializa los valores de pago de un documento nuevo
 * @param {number} valorFactura - Valor de la factura
 * @returns {Object} Valores iniciales
 */
function inicializarValoresPago(valorFactura) {
  const valor = parseFloat(valorFactura || 0);
  
  if (valor <= 0) {
    throw new Error('El valor de la factura debe ser mayor a 0');
  }
  
  return {
    valorPagado: 0.00,
    valorPendiente: parseFloat(valor.toFixed(2)),
    valorRetenido: 0.00,
    estadoPago: 'pendiente',
    tieneRetencion: false
  };
}

/**
 * Formatea un valor monetario para mostrar
 * @param {number} valor - Valor a formatear
 * @returns {string} Valor formateado
 */
function formatearValorMonetario(valor) {
  const numero = parseFloat(valor || 0);
  return numero.toFixed(2);
}

/**
 * Valida que un monto de pago sea válido
 * @param {number} monto - Monto a validar
 * @param {number} valorPendiente - Valor pendiente del documento
 * @returns {Object} Resultado de la validación
 */
function validarMontoPago(monto, valorPendiente) {
  const montoPago = parseFloat(monto || 0);
  const pendiente = parseFloat(valorPendiente || 0);
  
  const errores = [];
  
  if (isNaN(montoPago) || montoPago <= 0) {
    errores.push('El monto del pago debe ser mayor a 0');
  }
  
  if (montoPago > pendiente) {
    errores.push(`El monto del pago ($${montoPago.toFixed(2)}) no puede exceder el valor pendiente ($${pendiente.toFixed(2)})`);
  }
  
  return {
    valido: errores.length === 0,
    errores
  };
}

/**
 * Valida un pago considerando retenciones (ACTUALIZADO para pagos parciales)
 * @param {number} montoEfectivo - Monto en efectivo del pago (puede ser 0)
 * @param {Object} datosRetencion - Datos de retención (opcional)
 * @param {Object} documento - Documento a pagar
 * @returns {Object} Resultado de la validación
 */
function validarPagoConRetencion(montoEfectivo, datosRetencion, documento) {
  console.log('🔍 DEBUG validarPagoConRetencion - Entrada:', {
    montoEfectivo,
    datosRetencion,
    documentoId: documento?.id,
    valorFactura: documento?.valorFactura,
    valorPagado: documento?.valorPagado,
    valorPendiente: documento?.valorPendiente
  });
  
  const errores = [];
  const advertencias = [];
  const detalles = [];
  
  // Validar parámetros básicos
  if (!documento) {
    errores.push('Documento no proporcionado');
    return { valido: false, errores, advertencias, detalles };
  }
  
  const valorFactura = parseFloat(documento.valorFactura || 0);
  const valorPagadoActual = parseFloat(documento.valorPagado || 0);
  const valorRetenidoActual = parseFloat(documento.valorRetenido || 0);
  const valorPendienteActual = parseFloat(documento.valorPendiente || 0);
  
  if (valorFactura <= 0) {
    errores.push('El documento debe tener un valor de factura válido');
    return { valido: false, errores, advertencias, detalles };
  }
  
  // NUEVO: Validar que hay al menos monto O retención
  const montoEfectivoNum = parseFloat(montoEfectivo) || 0;
  const totalRetencion = parseFloat(datosRetencion?.totalRetenido || 0);
  
  if (montoEfectivoNum === 0 && totalRetencion === 0) {
    errores.push('Debe ingresar un monto de pago O procesar una retención XML');
    return { valido: false, errores, advertencias, detalles };
  }
  
  // Validar montos no negativos
  if (montoEfectivoNum < 0) {
    errores.push('El monto en efectivo no puede ser negativo');
  }
  
  if (totalRetencion < 0) {
    errores.push('El valor de retención no puede ser negativo');
  }
  
  // Calcular total del movimiento
  const totalMovimiento = montoEfectivoNum + totalRetencion;
  const valorPendienteReal = valorFactura - valorPagadoActual - valorRetenidoActual;
  
  detalles.push(`Valor factura: $${valorFactura.toFixed(2)}`);
  detalles.push(`Ya pagado: $${valorPagadoActual.toFixed(2)}`);
  detalles.push(`Ya retenido: $${valorRetenidoActual.toFixed(2)}`);
  detalles.push(`Pendiente real: $${valorPendienteReal.toFixed(2)}`);
  detalles.push(`Monto efectivo: $${montoEfectivoNum.toFixed(2)}`);
  detalles.push(`Retención: $${totalRetencion.toFixed(2)}`);
  detalles.push(`Total movimiento: $${totalMovimiento.toFixed(2)}`);
  
  // NUEVO: Permitir pagos parciales - validar que no exceda el pendiente
  if (totalMovimiento > valorPendienteReal + 0.01) { // Tolerancia de 1 centavo
    errores.push(`El total del movimiento ($${totalMovimiento.toFixed(2)}) excede el valor pendiente ($${valorPendienteReal.toFixed(2)})`);
  }
  
  // Validar coherencia de retención si existe
  if (datosRetencion && totalRetencion > 0) {
    // Validar estructura de datos de retención
    if (!datosRetencion.numeroComprobanteRetencion) {
      advertencias.push('Retención sin número de comprobante');
    }
    
    if (!datosRetencion.rucEmpresaRetenedora) {
      advertencias.push('Retención sin RUC de empresa retenedora');
    }
    
    // Validar coherencia de valores de retención
    const retencionIva = parseFloat(datosRetencion.retencionIva || 0);
    const retencionRenta = parseFloat(datosRetencion.retencionRenta || 0);
    const sumaRetenciones = retencionIva + retencionRenta;
    
    if (Math.abs(sumaRetenciones - totalRetencion) > 0.01) {
      advertencias.push(`Inconsistencia en retenciones: IVA + Renta ($${sumaRetenciones.toFixed(2)}) ≠ Total ($${totalRetencion.toFixed(2)})`);
    }
    
    detalles.push(`Retención IVA: $${retencionIva.toFixed(2)}`);
    detalles.push(`Retención Renta: $${retencionRenta.toFixed(2)}`);
  }
  
  // NUEVO: Determinar tipo de operación para logging
  let tipoOperacion = '';
  if (montoEfectivoNum > 0 && totalRetencion === 0) {
    tipoOperacion = 'pago_simple';
  } else if (montoEfectivoNum > 0 && totalRetencion > 0) {
    tipoOperacion = 'pago_con_retencion';
  } else if (montoEfectivoNum === 0 && totalRetencion > 0) {
    tipoOperacion = 'solo_retencion';
  }
  
  detalles.push(`Tipo de operación: ${tipoOperacion}`);
  
  // NUEVO: Calcular estado resultante
  const valorPagadoResultante = valorPagadoActual + montoEfectivoNum;
  const valorRetenidoResultante = valorRetenidoActual + totalRetencion;
  const valorPendienteResultante = valorFactura - valorPagadoResultante - valorRetenidoResultante;
  
  detalles.push(`Después del pago:`);
  detalles.push(`- Pagado: $${valorPagadoResultante.toFixed(2)}`);
  detalles.push(`- Retenido: $${valorRetenidoResultante.toFixed(2)}`);
  detalles.push(`- Pendiente: $${valorPendienteResultante.toFixed(2)}`);
  
  // Advertencias para pagos parciales
  if (valorPendienteResultante > 0.01) {
    advertencias.push(`Quedará un saldo pendiente de $${valorPendienteResultante.toFixed(2)} (pago parcial)`);
  }
  
  console.log('✅ DEBUG validarPagoConRetencion - Resultado:', {
    valido: errores.length === 0,
    errores,
    advertencias,
    totalMovimiento,
    valorPendienteReal,
    tipoOperacion
  });
  
  return {
    valido: errores.length === 0,
    errores,
    advertencias,
    detalles,
    totalMovimiento,
    valorPendienteReal,
    tipoOperacion,
    valorPendienteResultante
  };
}

module.exports = {
  calcularEstadoPago,
  validarCoherenciaMatematica,
  calcularValoresActualizados,
  procesarRetencionTardia,
  inicializarValoresPago,
  formatearValorMonetario,
  validarMontoPago,
  validarPagoConRetencion
}; 