/**
 * Utilidades para el manejo de documentos
 */

/**
 * Infiere el tipo de documento basándose en el código numérico
 * @param {string} numeroLibro - Número de libro/código que contiene el código
 * @returns {string} - Tipo de documento inferido
 */
const inferirTipoDocumentoPorCodigo = (numeroLibro) => {
  if (!numeroLibro || typeof numeroLibro !== 'string') {
    return 'Otro';
  }
  
  // Buscar la primera letra en el código (puede estar en diferentes posiciones)
  const codigo = numeroLibro.toUpperCase();
  
  // Extraer letra del código - puede estar al inicio o después de números
  let letraCodigo = '';
  for (let i = 0; i < codigo.length; i++) {
    const char = codigo[i];
    if (char >= 'A' && char <= 'Z') {
      letraCodigo = char;
      break;
    }
  }
  
  // Mapeo correcto según especificación:
  const mapeoTipos = {
    'P': 'Protocolo',     // P = Escritura pública o protocolo
    'D': 'Diligencia',    // D = Diligencia
    'A': 'Arrendamiento', // A = Arrendamiento
    'C': 'Certificación', // C = Certificación
    'O': 'Otro',          // O = Otro
    'E': 'Escritura',     // E = Escritura
    'T': 'Testamento',    // T = Testamento
    'POD': 'Poder',       // POD = Poder
    'DON': 'Donación'     // DON = Donación
  };
  
  return mapeoTipos[letraCodigo] || 'Otro';
};

/**
 * Procesa correctamente la fecha de factura desde formato DD/MM/YYYY
 * @param {string} fechaString - Fecha en formato DD/MM/YYYY o cualquier otro formato
 * @returns {Date|null} - Fecha procesada o null si es inválida
 */
const procesarFechaFactura = (fechaString) => {
  if (!fechaString) return null;

  // Intentar convertir si está en formato DD/MM/YYYY
  if (fechaString.includes('/')) {
    const partesFecha = fechaString.split('/');
    if (partesFecha.length === 3) {
      const fechaFactura = new Date(
        parseInt(partesFecha[2]), // año
        parseInt(partesFecha[1]) - 1, // mes (0-11)
        parseInt(partesFecha[0]), // día
        0, 0, 0, 0 // hora 00:00:00
      );
      
      if (!isNaN(fechaFactura.getTime())) {
        return fechaFactura;
      }
    }
  }
  
  // Intentar con formato estándar Date
  const fechaEstandar = new Date(fechaString);
  if (!isNaN(fechaEstandar.getTime())) {
    return fechaEstandar;
  }
  
  // Si no se pudo convertir, retornar null
  return null;
};

/**
 * Formatea un valor monetario a máximo 2 decimales
 * @param {number|string} valor - Valor a formatear
 * @returns {string} - Valor formateado con máximo 2 decimales
 */
const formatearValorMonetario = (valor) => {
  if (valor === null || valor === undefined || valor === '') {
    return '0.00';
  }
  
  const numero = parseFloat(valor);
  if (isNaN(numero)) {
    return '0.00';
  }
  
  return (Math.round(numero * 100) / 100).toFixed(2);
};

/**
 * Mapea los valores del formulario a los valores del enum de la base de datos
 * @param {string} metodoFormulario - Valor del método de pago desde el formulario
 * @returns {string} - Valor compatible con la base de datos
 */
const mapearMetodoPago = (metodoFormulario) => {
  const mapeo = {
    'pendiente': null,
    'efectivo': 'efectivo',
    'transferencia': 'transferencia',
    'cheque': 'otro',
    'tarjeta_credito': 'tarjeta',
    'tarjeta_debito': 'tarjeta',
    'tarjeta': 'tarjeta',
    'otro': 'otro'
  };
  
  return mapeo[metodoFormulario] !== undefined ? mapeo[metodoFormulario] : metodoFormulario;
};

/**
 * Mapea los valores de la base de datos a los valores para el formulario
 * @param {string} metodoDB - Valor del método de pago desde la base de datos
 * @returns {string} - Valor para mostrar en el formulario
 */
const mapearMetodoPagoInverso = (metodoDB) => {
  if (metodoDB === null) return 'pendiente';
  return metodoDB;
};

module.exports = {
  inferirTipoDocumentoPorCodigo,
  procesarFechaFactura,
  formatearValorMonetario,
  mapearMetodoPago,
  mapearMetodoPagoInverso
}; 