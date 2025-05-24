/**
 * Utilidades para manejo de documentos y fechas
 * SIMPLIFICADO - Solo funciones esenciales
 */

const moment = require('moment-timezone');

// Zona horaria de Ecuador (constante)
const TIMEZONE_ECUADOR = 'America/Guayaquil';

// NUEVO: Importar logger (solo si está disponible)
let logger = null;
try {
  const loggerModule = require('./logger');
  logger = loggerModule.logger;
} catch (error) {
  // Si no está disponible el logger, usar console como fallback
  logger = {
    debug: () => {},
    info: (context, message, data) => console.log(`[${context}] ${message}`, data),
    warning: (context, message, data) => console.warn(`[${context}] ${message}`, data),
    error: (context, message, error) => console.error(`[${context}] ${message}`, error)
  };
}

// ============== FUNCIONES DE FECHA SIMPLIFICADAS ==============

/**
 * Obtiene el timestamp actual en zona horaria de Ecuador
 * USO: Para registrar pagos, entregas, y cualquier evento del sistema
 */
function obtenerTimestampEcuador() {
  try {
    logger.debug('TIMESTAMP', 'Generando timestamp de Ecuador...');
    
    const momentEcuador = moment().tz(TIMEZONE_ECUADOR);
    const timestamp = momentEcuador.toDate();
    
    logger.debug('TIMESTAMP', 'Timestamp generado', {
      momentString: momentEcuador.format('YYYY-MM-DD HH:mm:ss'),
      timezone: TIMEZONE_ECUADOR,
      timestamp: timestamp,
      timestampISO: timestamp.toISOString(),
      tipoResultado: typeof timestamp,
      esInstanciaDate: timestamp instanceof Date
    });
    
    return timestamp;
  } catch (error) {
    logger.error('TIMESTAMP', 'Error generando timestamp de Ecuador', error);
    // Fallback: devolver Date normal
    return new Date();
  }
}

/**
 * Procesa fecha del XML para almacenar como fecha_factura
 * USO: Al procesar XML, convertir fecha DD/MM/YYYY a DATE
 * @param {string} fechaXML - Fecha en formato DD/MM/YYYY del XML
 * @returns {Date|null} - Fecha como DATE (solo fecha, sin hora)
 */
function procesarFechaDocumento(fechaXML) {
  logger.debug('DOCUMENTO', 'Procesando fecha de documento XML', { fechaXML });
  
  if (!fechaXML) {
    logger.warning('DOCUMENTO', 'Fecha XML vacía o nula');
    return null;
  }
  
  try {
    // Convertir DD/MM/YYYY a fecha válida
    const partes = fechaXML.split('/');
    if (partes.length !== 3) {
      logger.warning('DOCUMENTO', 'Formato de fecha XML inválido', { fechaXML, partes });
      return null;
    }
    
    const dia = parseInt(partes[0]);
    const mes = parseInt(partes[1]) - 1; // Mes base 0
    const año = parseInt(partes[2]);
    
    // Crear fecha en zona horaria de Ecuador (solo fecha, sin hora)
    const fecha = moment.tz([año, mes, dia], TIMEZONE_ECUADOR).startOf('day').toDate();
    
    logger.debug('DOCUMENTO', 'Fecha XML procesada exitosamente', {
      fechaOriginal: fechaXML,
      fechaProcesada: fecha,
      fechaISO: fecha.toISOString(),
      año, mes: mes + 1, dia
    });
    
    return fecha;
  } catch (error) {
    logger.error('DOCUMENTO', 'Error al procesar fecha del documento', error);
    return null;
  }
}

/**
 * Formatea fecha para mostrar en vistas (solo fecha)
 * USO: Para mostrar fecha_factura en vistas
 */
function formatearFechaSinHora(fecha) {
  if (!fecha) return 'No definida';
  return moment(fecha).tz(TIMEZONE_ECUADOR).format('DD/MM/YYYY');
}

/**
 * Formatea timestamp completo para mostrar en vistas
 * USO: Para mostrar created_at, fecha_pago, fecha_entrega
 */
function formatearTimestamp(timestamp) {
  if (!timestamp) return 'No definido';
  return moment(timestamp).tz(TIMEZONE_ECUADOR).format('DD/MM/YYYY HH:mm');
}

/**
 * Convierte rango de fechas para consultas SQL
 * USO: Para filtros en dashboard y reportes
 */
function convertirRangoParaSQL(fechaInicio, fechaFin) {
  const inicio = moment.tz(fechaInicio, TIMEZONE_ECUADOR).startOf('day');
  const fin = moment.tz(fechaFin, TIMEZONE_ECUADOR).endOf('day');
  
  return {
    fechaInicioObj: inicio.toDate(),
    fechaFinObj: fin.toDate(),
    fechaInicioSQL: inicio.format('YYYY-MM-DD HH:mm:ss'),
    fechaFinSQL: fin.format('YYYY-MM-DD HH:mm:ss')
  };
}

// ============== FUNCIONES DE DOCUMENTO (sin cambios) ==============

/**
 * Infiere el tipo de documento basado en el código del libro
 */
function inferirTipoDocumentoPorCodigo(numeroLibro) {
  if (!numeroLibro) return 'Otro';
  
  const codigo = numeroLibro.toString().toUpperCase();
  
  if (codigo.includes('E') || codigo.includes('ESCRIT')) return 'Escritura';
  if (codigo.includes('D') || codigo.includes('DONAC')) return 'Donación';
  if (codigo.includes('P') || codigo.includes('PODER')) return 'Poder';
  if (codigo.includes('T') || codigo.includes('TEST')) return 'Testamento';
  if (codigo.includes('C') || codigo.includes('CERT')) return 'Certificación';
  if (codigo.includes('PROT')) return 'Protocolo';
  if (codigo.includes('DILI')) return 'Diligencia';
  if (codigo.includes('A') || codigo.includes('ARREN')) return 'Arrendamiento';
  
  return 'Otro';
}

/**
 * Formatea valor monetario
 */
function formatearValorMonetario(valor) {
  if (!valor) return '0.00';
  return parseFloat(valor).toLocaleString('es-EC', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Mapea método de pago para almacenamiento
 */
function mapearMetodoPago(metodoPago) {
  const mapeo = {
    'efectivo': 'efectivo',
    'tarjeta_credito': 'tarjeta_credito',
    'tarjeta_debito': 'tarjeta_debito',
    'transferencia': 'transferencia',
    'otro': 'otro',
    'pendiente': 'pendiente'
  };
  return mapeo[metodoPago] || 'pendiente';
}

/**
 * Mapea método de pago para visualización
 */
function mapearMetodoPagoInverso(metodoPago) {
  const mapeo = {
    'efectivo': 'Efectivo',
    'tarjeta_credito': 'Tarjeta de Crédito',
    'tarjeta_debito': 'Tarjeta de Débito',
    'transferencia': 'Transferencia',
    'otro': 'Otro',
    'pendiente': 'Pendiente'
  };
  return mapeo[metodoPago] || 'Pendiente';
}

module.exports = {
  // Funciones de fecha simplificadas
  obtenerTimestampEcuador,
  procesarFechaDocumento,
  formatearFechaSinHora,
  formatearTimestamp,
  convertirRangoParaSQL,
  
  // Funciones de documento (sin cambios)
  inferirTipoDocumentoPorCodigo,
  formatearValorMonetario,
  mapearMetodoPago,
  mapearMetodoPagoInverso,
  
  // Constante de zona horaria
  TIMEZONE_ECUADOR
}; 