/**
 * UTILIDADES DE FECHA PARA FRONTEND
 * Funciones JavaScript para manejar fechas de forma consistente en las vistas
 */

/**
 * Formatea una fecha de forma segura para mostrar en la interfaz
 * @param {string|Date|null|undefined} fechaRaw - Fecha a formatear
 * @returns {string} - Fecha formateada o mensaje apropiado
 */
function formatearFechaSegura(fechaRaw) {
  try {
    // Casos donde no hay fecha
    if (!fechaRaw || fechaRaw === null || fechaRaw === undefined) {
      return 'Sin fecha';
    }

    // Casos de strings problemáticos
    if (typeof fechaRaw === 'string') {
      const fechaLimpia = fechaRaw.trim();
      
      if (fechaLimpia === '' || fechaLimpia === 'null' || fechaLimpia === 'undefined' || fechaLimpia === 'Invalid Date') {
        return 'Sin fecha';
      }
    }

    let fecha;

    // Si ya es un objeto Date
    if (fechaRaw instanceof Date) {
      fecha = fechaRaw;
    } 
    // Si es un string, intentar parsearlo
    else if (typeof fechaRaw === 'string') {
      // Intentar diferentes formatos
      if (fechaRaw.includes('T') || fechaRaw.includes('Z')) {
        // Formato ISO
        fecha = new Date(fechaRaw);
      } else if (fechaRaw.includes('-')) {
        // Formato YYYY-MM-DD
        fecha = new Date(fechaRaw + 'T00:00:00');
      } else if (fechaRaw.includes('/')) {
        // Formato DD/MM/YYYY
        const partes = fechaRaw.split('/');
        if (partes.length === 3) {
          const dia = parseInt(partes[0], 10);
          const mes = parseInt(partes[1], 10) - 1; // Mes base 0
          const año = parseInt(partes[2], 10);
          fecha = new Date(año, mes, dia);
        } else {
          fecha = new Date(fechaRaw);
        }
      } else {
        fecha = new Date(fechaRaw);
      }
    }
    // Si es un número (timestamp)
    else if (typeof fechaRaw === 'number') {
      fecha = new Date(fechaRaw);
    }
    else {
      console.warn('⚠️ Tipo de fecha no soportado:', typeof fechaRaw, fechaRaw);
      return 'Formato no soportado';
    }

    // Verificar que la fecha sea válida
    if (!fecha || isNaN(fecha.getTime())) {
      console.warn('⚠️ Fecha inválida después de conversión:', fechaRaw);
      return 'Fecha inválida';
    }

    // Verificar que esté en un rango razonable
    const año = fecha.getFullYear();
    if (año < 2000 || año > 2050) {
      console.warn('⚠️ Fecha fuera de rango esperado:', año);
      return 'Fecha fuera de rango';
    }

    return fecha;

  } catch (error) {
    console.error('❌ Error procesando fecha:', error, 'Fecha original:', fechaRaw);
    return 'Error en fecha';
  }
}

/**
 * Formatea una fecha a DD/MM/YYYY
 * @param {string|Date|null|undefined} fechaRaw - Fecha a formatear
 * @returns {string} - Fecha en formato DD/MM/YYYY
 */
function formatearFechaDD_MM_YYYY(fechaRaw) {
  const fecha = formatearFechaSegura(fechaRaw);
  
  if (fecha instanceof Date) {
    const dia = fecha.getDate().toString().padStart(2, '0');
    const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const año = fecha.getFullYear();
    return `${dia}/${mes}/${año}`;
  }
  
  return fecha; // Retorna el mensaje de error
}

/**
 * Formatea una fecha a DD/MM/YYYY HH:mm
 * @param {string|Date|null|undefined} fechaRaw - Fecha a formatear
 * @returns {string} - Fecha en formato DD/MM/YYYY HH:mm
 */
function formatearFechaCompleta(fechaRaw) {
  const fecha = formatearFechaSegura(fechaRaw);
  
  if (fecha instanceof Date) {
    const dia = fecha.getDate().toString().padStart(2, '0');
    const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const año = fecha.getFullYear();
    const hora = fecha.getHours().toString().padStart(2, '0');
    const minutos = fecha.getMinutes().toString().padStart(2, '0');
    return `${dia}/${mes}/${año} ${hora}:${minutos}`;
  }
  
  return fecha; // Retorna el mensaje de error
}

/**
 * Formatea solo la hora HH:mm
 * @param {string|Date|null|undefined} fechaRaw - Fecha a formatear
 * @returns {string} - Hora en formato HH:mm
 */
function formatearHora(fechaRaw) {
  const fecha = formatearFechaSegura(fechaRaw);
  
  if (fecha instanceof Date) {
    const hora = fecha.getHours().toString().padStart(2, '0');
    const minutos = fecha.getMinutes().toString().padStart(2, '0');
    return `${hora}:${minutos}`;
  }
  
  return '-'; // Para errores de hora, mostrar guión
}

/**
 * Aplica formateo automático a elementos con clases específicas
 */
function aplicarFormateoFechas() {
  console.log('🔄 Aplicando formateo automático de fechas...');
  
  // Formatear fechas simples (DD/MM/YYYY)
  document.querySelectorAll('.fecha-simple, .fecha-evento-detalle').forEach(function(elemento) {
    const fechaRaw = elemento.getAttribute('data-fecha') || elemento.textContent;
    const fechaFormateada = formatearFechaDD_MM_YYYY(fechaRaw);
    
    elemento.textContent = fechaFormateada;
    
    // Agregar clase de estilo según el resultado
    if (fechaFormateada === 'Sin fecha' || fechaFormateada === 'Fecha inválida' || fechaFormateada === 'Error en fecha') {
      elemento.classList.add('text-muted');
    } else {
      elemento.classList.add('text-success');
    }
  });
  
  // Formatear fechas completas (DD/MM/YYYY HH:mm)
  document.querySelectorAll('.fecha-completa').forEach(function(elemento) {
    const fechaRaw = elemento.getAttribute('data-fecha') || elemento.textContent;
    const fechaFormateada = formatearFechaCompleta(fechaRaw);
    
    elemento.textContent = fechaFormateada;
    
    if (fechaFormateada === 'Sin fecha' || fechaFormateada === 'Fecha inválida' || fechaFormateada === 'Error en fecha') {
      elemento.classList.add('text-muted');
    } else {
      elemento.classList.add('text-success');
    }
  });
  
  // Formatear solo horas
  document.querySelectorAll('.hora-simple, .hora-evento-detalle').forEach(function(elemento) {
    const fechaRaw = elemento.getAttribute('data-fecha') || elemento.textContent;
    const horaFormateada = formatearHora(fechaRaw);
    
    elemento.textContent = horaFormateada;
  });
  
  console.log('✅ Formateo automático de fechas completado');
}

// Aplicar formateo cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {
  aplicarFormateoFechas();
});

// Exportar funciones para uso global
window.formatearFechaSegura = formatearFechaSegura;
window.formatearFechaDD_MM_YYYY = formatearFechaDD_MM_YYYY;
window.formatearFechaCompleta = formatearFechaCompleta;
window.formatearHora = formatearHora;
window.aplicarFormateoFechas = aplicarFormateoFechas; 