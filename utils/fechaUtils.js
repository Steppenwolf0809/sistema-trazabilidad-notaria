/**
 * 🔧 UTILIDADES DE FECHA PARA XML
 * PROPÓSITO: Procesar fechas de XML (DD/MM/YYYY) sin problemas de timezone
 */

const moment = require('moment');

/**
 * Procesa fecha del XML en formato DD/MM/YYYY y la convierte a Date
 * CRÍTICO: NO aplicar conversiones de timezone - la fecha es conceptual
 * @param {string} fechaInput - Fecha en formato DD/MM/YYYY o YYYY-MM-DD
 * @returns {Date|null} - Fecha procesada correctamente o null si es inválida
 */
function procesarFechaXML(fechaInput) {
  console.log('🔧 [FECHA-XML] Procesando fecha:', fechaInput);

  if (!fechaInput) {
    console.log('⚠️ [FECHA-XML] Fecha vacía o nula');
    return null;
  }

  // Si ya es un objeto Date, devolverlo
  if (fechaInput instanceof Date) {
    if (isNaN(fechaInput.getTime())) {
      console.log('❌ [FECHA-XML] Objeto Date inválido');
      return null;
    }
    console.log('✅ [FECHA-XML] La fecha ya es un objeto Date válido');
    return fechaInput;
  }

  if (typeof fechaInput !== 'string') {
    console.log('⚠️ [FECHA-XML] La fecha no es un string');
    return null;
  }

  const fechaTrim = fechaInput.trim();
  let partes;

  try {
    // Patrón 1: Formato YYYY-MM-DD (común desde frontend y BD)
    if (fechaTrim.includes('-')) {
      partes = fechaTrim.split('-');
      if (partes.length !== 3) {
        console.log('❌ [FECHA-XML] Formato YYYY-MM-DD inválido');
        return null;
      }
      const año = parseInt(partes[0], 10);
      const mes = parseInt(partes[1], 10) - 1; // Mes base 0
      const dia = parseInt(partes[2], 10);
      return crearFechaValidada(año, mes, dia, fechaInput);
    }

    // Patrón 2: Formato DD/MM/YYYY (común desde XML)
    if (fechaTrim.includes('/')) {
      partes = fechaTrim.split('/');
      if (partes.length !== 3) {
        console.log('❌ [FECHA-XML] Formato DD/MM/YYYY inválido');
        return null;
      }
      const dia = parseInt(partes[0], 10);
      const mes = parseInt(partes[1], 10) - 1; // Mes base 0
      const año = parseInt(partes[2], 10);
      return crearFechaValidada(año, mes, dia, fechaInput);
    }

    // Si no coincide con ningún patrón conocido
    console.log('❌ [FECHA-XML] Formato de fecha no reconocido (ni YYYY-MM-DD ni DD/MM/YYYY)');
    return null;

  } catch (error) {
    console.error('❌ [FECHA-XML] Error procesando fecha:', error);
    return null;
  }
}

/**
 * Función auxiliar para crear y validar una fecha
 */
function crearFechaValidada(año, mes, dia, fechaOriginal) {
  // Validar rangos
  if (dia < 1 || dia > 31 || mes < 0 || mes > 11 || año < 2020 || año > 2030) {
    console.log('❌ [FECHA-XML] Valores fuera de rango:', { dia, mes: mes + 1, año });
    return null;
  }

  // CRÍTICO: Crear fecha SIN timezone para evitar conversiones
  const fecha = new Date(año, mes, dia);

  // Verificar que la fecha creada es válida
  if (isNaN(fecha.getTime())) {
    console.log('❌ [FECHA-XML] Fecha resultante inválida');
    return null;
  }

  // Verificar que la fecha no cambió por overflow de días
  if (fecha.getDate() !== dia || fecha.getMonth() !== mes || fecha.getFullYear() !== año) {
    console.log('❌ [FECHA-XML] Fecha cambió por overflow:', {
      original: { dia, mes: mes + 1, año },
      resultado: { dia: fecha.getDate(), mes: fecha.getMonth() + 1, año: fecha.getFullYear() }
    });
    return null;
  }
  
  console.log('✅ [FECHA-XML] Fecha procesada correctamente:', {
    entrada: fechaOriginal,
    salida: fecha,
    verificacion: formatearFecha(fecha)
  });
  
  return fecha;
}

/**
 * Formatea una fecha a DD/MM/YYYY para mostrar en vistas
 * MEJORADO: Maneja todos los casos posibles de fechas problemáticas
 * @param {Date|string|null|undefined} fecha - Fecha a formatear
 * @returns {string} - Fecha en formato DD/MM/YYYY o mensaje apropiado
 */
function formatearFecha(fecha) {
  try {
    // Casos donde no hay fecha
    if (!fecha || fecha === null || fecha === undefined) {
      return 'Sin fecha';
    }

    // Casos de strings vacíos o solo espacios
    if (typeof fecha === 'string' && fecha.trim() === '') {
      return 'Sin fecha';
    }

    // Casos especiales de strings problemáticos
    if (typeof fecha === 'string') {
      const fechaLimpia = fecha.trim();
      
      // Verificar si es una fecha válida en string
      if (fechaLimpia === 'null' || fechaLimpia === 'undefined' || fechaLimpia === 'Invalid Date') {
        return 'Sin fecha';
      }
      
      // Verificar si es un timestamp en string
      if (/^\d+$/.test(fechaLimpia)) {
        const timestamp = parseInt(fechaLimpia);
        if (timestamp < 946684800000) { // Antes del año 2000
          return 'Fecha inválida';
        }
        fecha = new Date(timestamp);
      }
    }

    let fechaObj;

    if (fecha instanceof Date) {
      fechaObj = fecha;
    } else if (typeof fecha === 'string') {
      // Usar moment.js para parsear con múltiples formatos
      const momentDate = moment(fecha, [
        moment.ISO_8601,
        'YYYY-MM-DD HH:mm:ss.SSSZ',
        'YYYY-MM-DD HH:mm:ss',
        'YYYY-MM-DD',
        'DD/MM/YYYY HH:mm:ss',
        'DD/MM/YYYY',
        'MM/DD/YYYY',
        'YYYY/MM/DD'
      ], true);

      if (momentDate.isValid()) {
        // Para fechas solo de fecha (sin hora), usar UTC para evitar problemas de timezone
        if (fecha.includes('T') || fecha.includes(' ')) {
          fechaObj = momentDate.toDate();
        } else {
          // Para fechas solo de fecha, crear objeto Date local
          fechaObj = new Date(momentDate.year(), momentDate.month(), momentDate.date());
        }
      } else {
        console.warn('⚠️ Formato de fecha no reconocido:', fecha);
        return 'Formato inválido';
      }
    } else if (typeof fecha === 'number') {
      // Timestamp numérico
      fechaObj = new Date(fecha);
    } else {
      console.warn('⚠️ Tipo de fecha no soportado:', typeof fecha, fecha);
      return 'Formato no soportado';
    }

    // Verificar que la fecha resultante sea válida
    if (!fechaObj || isNaN(fechaObj.getTime())) {
      console.warn('⚠️ Fecha inválida después de conversión:', fecha);
      return 'Fecha inválida';
    }

    // Verificar que la fecha esté en un rango razonable
    const año = fechaObj.getFullYear();
    if (año < 2000 || año > 2050) {
      console.warn('⚠️ Fecha fuera de rango esperado:', año);
      return 'Fecha fuera de rango';
    }

    // Formatear a DD/MM/YYYY
    const dia = fechaObj.getDate().toString().padStart(2, '0');
    const mes = (fechaObj.getMonth() + 1).toString().padStart(2, '0');
    const anio = fechaObj.getFullYear();

    return `${dia}/${mes}/${anio}`;

  } catch (error) {
    console.error('❌ Error formateando fecha:', {
      valor: fecha,
      tipo: typeof fecha,
      error: error.message
    });
    return 'Error en fecha';
  }
}

/**
 * Convierte fecha DD/MM/YYYY a formato YYYY-MM-DD para almacenar en BD
 * @param {string} fechaXML - Fecha en formato DD/MM/YYYY
 * @returns {string|null} - Fecha en formato YYYY-MM-DD o null
 */
function fechaXMLaYYYYMMDD(fechaXML) {
  const fecha = procesarFechaXML(fechaXML);
  if (!fecha) return null;
  
  const año = fecha.getFullYear();
  const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
  const dia = fecha.getDate().toString().padStart(2, '0');
  
  return `${año}-${mes}-${dia}`;
}

/**
 * Valida que una fecha XML sea correcta
 * @param {string} fechaXML - Fecha en formato DD/MM/YYYY
 * @returns {Object} - { valida: boolean, error: string, fecha: Date }
 */
function validarFechaXML(fechaXML) {
  const fecha = procesarFechaXML(fechaXML);
  
  if (!fecha) {
    return {
      valida: false,
      error: 'Fecha inválida o formato incorrecto (debe ser DD/MM/YYYY)',
      fecha: null
    };
  }
  
  return {
    valida: true,
    error: null,
    fecha: fecha
  };
}

module.exports = {
  procesarFechaXML,
  formatearFecha,
  fechaXMLaYYYYMMDD,
  validarFechaXML
}; 