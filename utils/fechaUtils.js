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
 * CRÍTICO: Maneja fechas de BD (YYYY-MM-DD) y Date objects sin problemas de timezone
 * @param {Date|string} fecha - Fecha a formatear
 * @returns {string} - Fecha en formato DD/MM/YYYY o 'Sin fecha'
 */
function formatearFecha(fecha) {
  if (!fecha) return 'Sin fecha';
  
  try {
    // CASO 1: String en formato YYYY-MM-DD (viene de PostgreSQL)
    if (typeof fecha === 'string') {
      // Si es formato YYYY-MM-DD, parsear manualmente para evitar timezone
      if (/^\d{4}-\d{2}-\d{2}$/.test(fecha.trim())) {
        const partes = fecha.trim().split('-');
        const año = parseInt(partes[0], 10);
        const mes = parseInt(partes[1], 10);
        const dia = parseInt(partes[2], 10);
        
        return `${dia.toString().padStart(2, '0')}/${mes.toString().padStart(2, '0')}/${año}`;
      }
      
      // Si es otro formato string, convertir a Date
      fecha = new Date(fecha);
    }
    
    // CASO 2: Date object
    if (fecha instanceof Date) {
      if (isNaN(fecha.getTime())) {
        return 'Fecha inválida';
      }
      
      // Formatear usando métodos nativos para evitar problemas de timezone
      const dia = fecha.getDate().toString().padStart(2, '0');
      const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
      const año = fecha.getFullYear();
      
      return `${dia}/${mes}/${año}`;
    }
    
    return 'Formato de fecha no reconocido';
    
  } catch (error) {
    console.error('❌ [FECHA-XML] Error formateando fecha:', error);
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