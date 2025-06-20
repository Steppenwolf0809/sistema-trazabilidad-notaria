/**
 * Helpers personalizados para las plantillas Handlebars
 * SISTEMATIZADOS: Solo helpers realmente necesarios y optimizados
 */

const moment = require('moment');
moment.locale('es'); // Configurar moment en español

const Handlebars = require('handlebars');
const { formatearFecha } = require('./fechaUtils');

module.exports = {
  // ============== HELPERS DE FECHA Y TIEMPO ==============
  
  /**
   * Formatear fecha completa con hora
   * CORREGIDO: Usa moment sin timezone para evitar conversiones incorrectas
   */
  formatDateTime: (date) => {
    if (!date) return 'No registrada';
    return moment(date).format('DD/MM/YYYY HH:mm');
  },
  
  /**
   * Formatear solo fecha
   * CORREGIDO: Usa función unificada para evitar problemas de timezone
   */
  formatDate: (date) => {
    return formatearFecha(date);
  },
  
  /**
   * Formatear fecha específicamente para Ecuador
   * CORREGIDO: Usa función unificada para evitar problemas de timezone
   */
  formatDateEcuador: (date) => {
    return formatearFecha(date);
  },
  
  /**
   * Formatear fecha para documentos (formato compacto)
   * CORREGIDO: Usa función unificada para evitar problemas de timezone
   */
  formatDateDocument: (date) => {
    return formatearFecha(date);
  },
  
  /**
   * ✨ NUEVO: Formatear fecha corta para tabla optimizada (DD/MM/YY)
   * CORREGIDO: Usa función unificada para evitar problemas de timezone
   */
  formatFechaCorta: (date) => {
    const fechaCompleta = formatearFecha(date);
    if (!fechaCompleta || fechaCompleta === 'Sin fecha') return '';
    
    // Convertir DD/MM/YYYY a DD/MM/YY
    const partes = fechaCompleta.split('/');
    if (partes.length === 3) {
      return `${partes[0]}/${partes[1]}/${partes[2].substr(-2)}`;
    }
    
    return fechaCompleta;
  },
  
  /**
   * Formatear solo hora
   */
  formatTime: (date) => {
    if (!date) return 'No registrada';
    return moment(date).format('HH:mm');
  },
  
  /**
   * Calcular días transcurridos desde una fecha
   */
  daysAgo: (date) => {
    if (!date) return 0;
    return moment().diff(moment(date), 'days');
  },
  
  /**
   * Mostrar tiempo transcurrido en formato humano
   */
  timeAgo: (date) => {
    if (!date) return 'Nunca';
    return moment(date).fromNow();
  },
  
  /**
   * Formatear timestamp con zona horaria Ecuador
   * CORREGIDO: Elimina utcOffset(-5) que restaba 5 horas incorrectamente
   */
  formatTimestamp: (timestamp) => {
    if (!timestamp) return 'No registrado';
    return moment(timestamp).format('DD/MM/YYYY HH:mm:ss');
  },
  
  /**
   * 🔧 HELPER UNIFICADO: Formatear fecha de factura XML
   * CRÍTICO: Usa la función unificada para evitar problemas de timezone
   */
  formatFechaFactura: (fecha) => {
    return formatearFecha(fecha);
  },
  
  // ============== HELPERS DE FORMATO MONETARIO ==============
  
  /**
   * Formatear dinero
   */
  formatMoney: (amount) => {
    if (!amount) return '0.00';
    return parseFloat(amount).toFixed(2);
  },
  
  /**
   * Formatear número
   */
  formatNumber: (number) => {
    if (!number) return '0';
    return parseFloat(number).toLocaleString();
  },
  
  // ============== HELPERS DE COMPARACIÓN ==============
  
  /**
   * Comparar igualdad
   */
  eq: (a, b) => a === b,
  
  /**
   * Comparar desigualdad
   */
  ne: (a, b) => a !== b,
  
  /**
   * Mayor que
   */
  gt: (a, b) => a > b,
  
  /**
   * Mayor o igual que
   */
  gte: (a, b) => a >= b,
  
  /**
   * Menor que
   */
  lt: (a, b) => a < b,
  
  /**
   * Menor o igual que
   */
  lte: (a, b) => a <= b,
  
  /**
   * Operador lógico AND
   */
  and: function() {
    // Convertir arguments a array y quitar el último (opciones de Handlebars)
    const args = Array.prototype.slice.call(arguments, 0, -1);
    return args.every(Boolean);
  },
  
  /**
   * Operador lógico OR
   */
  or: function() {
    // Convertir arguments a array y quitar el último (opciones de Handlebars)
    const args = Array.prototype.slice.call(arguments, 0, -1);
    return args.some(Boolean);
  },
  
  /**
   * Helper para unir arrays con separador
   */
  join: (array, separator) => {
    if (!Array.isArray(array)) return '';
    return array.join(separator || ', ');
  },
  
  /**
   * Helper para verificar si hay elementos en un array
   */
  hasElements: (array) => {
    return Array.isArray(array) && array.length > 0;
  },
  
  /**
   * Helper para verificar si un array está vacío
   */
  isEmpty: (array) => {
    return !Array.isArray(array) || array.length === 0;
  },
  
  /**
   * Helper para verificar si un array no está vacío
   */
  isNotEmpty: (array) => {
    return Array.isArray(array) && array.length > 0;
  },
  
  /**
   * Helper para obtener la longitud de un array
   */
  length: (array) => {
    if (!Array.isArray(array)) return 0;
    return array.length;
  },

  /**
   * Helper para generar un rango de números (útil para paginación)
   */
  range: (start, end) => {
    const result = [];
    for (let i = start; i <= end; i++) {
      result.push(i);
    }
    return result;
  },
  
  /**
   * Helper para verificar si un valor está en un array
   */
  includes: (array, value) => {
    if (!Array.isArray(array)) return false;
    return array.includes(value);
  },
  
  /**
   * Helper para sumar valores de un array
   */
  sum: (array, property) => {
    if (!Array.isArray(array)) return 0;
    
    if (property) {
      return array.reduce((total, item) => {
        const value = parseFloat(item[property]) || 0;
        return total + value;
      }, 0);
    } else {
      return array.reduce((total, item) => {
        const value = parseFloat(item) || 0;
        return total + value;
      }, 0);
    }
  },
  
  /**
   * Helper para obtener clase CSS según estado de pago
   */
  estadoPagoClass: (estado) => {
    const clases = {
      'pendiente': 'bg-warning text-dark',
      'pago_parcial': 'bg-info text-white',
      'pagado_completo': 'bg-success text-white',
      'pagado_con_retencion': 'bg-success text-white'
    };
    return clases[estado] || 'bg-secondary text-white';
  },
  
  /**
   * Helper para obtener texto legible del estado de pago
   */
  estadoPagoTexto: (estado) => {
    const textos = {
      'pendiente': 'Pendiente',
      'pago_parcial': 'Pago Parcial',
      'pagado_completo': 'Pagado Completo',
      'pagado_con_retencion': 'Pagado con Retención'
    };
    return textos[estado] || estado;
  },
  
  /**
   * Sumar dos números
   */
  add: (a, b) => (parseInt(a) || 0) + (parseInt(b) || 0),
  
  /**
   * Restar dos números
   */
  subtract: (a, b) => (parseInt(a) || 0) - (parseInt(b) || 0),
  
  // ============== HELPERS DE UTILIDADES ==============
  
  /**
   * Convertir número a string para comparaciones
   */
  stringifyNumber: (num) => {
    return String(num);
  },
  
  /**
   * Convertir objeto a JSON para JavaScript en plantillas
   */
  json: (obj) => {
    return JSON.stringify(obj);
  },
  
  /**
   * Pluralizar palabras según cantidad
   */
  pluralize: (count, singular, plural) => {
    return count === 1 ? singular : plural;
  },
  
  /**
   * Capitalizar primera letra
   */
  capitalize: (str) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  },
  
  /**
   * Obtener substring de un texto
   */
  substring: (str, start, length) => {
    if (!str) return '';
    if (typeof str !== 'string') str = String(str);
    return str.substring(start, start + length);
  },
  
  /**
   * Truncar texto con puntos suspensivos
   */
  truncate: (str, length = 50) => {
    if (!str) return '';
    if (typeof str !== 'string') str = String(str);
    return str.length > length ? str.substring(0, length) + '...' : str;
  },
  
  // ============== HELPERS DE ESTADO Y BADGES ==============
  
  /**
   * Obtener clase CSS para badge de estado
   */
  getEstadoBadgeClass: (estado) => {
    const classes = {
      'en_proceso': 'bg-warning',
      'listo_para_entrega': 'bg-success',
      'entregado': 'bg-info',
      'cancelado': 'bg-secondary',
      'eliminado': 'bg-danger',
      'pendiente': 'bg-warning',
      'pagado': 'bg-success'
    };
    return classes[estado] || 'bg-secondary';
  },
  
  /**
   * Obtener texto legible para estado
   */
  getEstadoTexto: (estado) => {
    const textos = {
      'en_proceso': 'En Proceso',
      'listo_para_entrega': 'Listo para Entrega',
      'entregado': 'Entregado',
      'cancelado': 'Cancelado',
      'eliminado': 'Eliminado',
      'pendiente': 'Pendiente',
      'pagado': 'Pagado'
    };
    return textos[estado] || estado;
  },
  
  /**
   * Obtener clase CSS para urgencia según días
   */
  getUrgenciaClass: (dias) => {
    if (dias > 60) return 'text-danger';
    if (dias > 30) return 'text-warning';
    if (dias > 15) return 'text-info';
    return 'text-success';
  },
  
  // ============== HELPERS DE CÁLCULO ==============
  
  /**
   * Calcular porcentaje
   */
  percentage: (part, total) => {
    if (!total || total === 0) return '0.0';
    return ((part / total) * 100).toFixed(1);
  },
  
  /**
   * Obtener promedio de array
   */
  average: (arr) => {
    if (!Array.isArray(arr) || arr.length === 0) return 0;
    const sum = arr.reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
    return (sum / arr.length).toFixed(2);
  },
  
  // ============== HELPERS CONDICIONALES ==============
  
  /**
   * Verificar si un array tiene elementos
   */
  hasItems: (arr) => {
    return Array.isArray(arr) && arr.length > 0;
  },
  
  /**
   * Verificar si un valor existe y no está vacío
   */
  notEmpty: (value) => {
    return value != null && value !== '' && value !== undefined;
  },
  
  // ============== HELPERS PARA MODO COMPARATIVO ==============
  
  /**
   * Formatear diferencia con signo
   */
  formatDifference: (value, format = 'numero') => {
    if (value == null || isNaN(value)) return '0';
    
    const num = parseFloat(value);
    const sign = num >= 0 ? '+' : '';
    
    if (format === 'moneda') {
      return `${sign}$${Math.abs(num).toFixed(2)}`;
    } else if (format === 'porcentaje') {
      return `${sign}${num.toFixed(1)}%`;
    } else {
      return `${sign}${num}`;
    }
  },
  
  /**
   * Obtener icono de dirección según valor
   */
  getTrendIcon: (value) => {
    if (value > 0) return 'fas fa-arrow-up text-success';
    if (value < 0) return 'fas fa-arrow-down text-danger';
    return 'fas fa-minus text-muted';
  },
  
  /**
   * Formatear métrica con unidad
   */
  formatMetric: (value, unit = '') => {
    if (value == null || isNaN(value)) return '0';
    
    const num = parseFloat(value);
    
    if (unit === 'dinero') {
      return new Intl.NumberFormat('es-EC', {
        style: 'currency',
        currency: 'USD'
      }).format(num);
    } else if (unit === 'porcentaje') {
      return `${num.toFixed(1)}%`;
    } else {
      return num.toLocaleString('es-EC');
    }
  },
  
  /**
   * Obtener clase CSS para diferencia
   */
  getDifferenceClass: (value) => {
    if (value > 0) return 'text-success';
    if (value < 0) return 'text-danger';
    return 'text-muted';
  },
  
  // ============== HELPERS DE PAGINACIÓN MODERNA ==============
  
  /**
   * Generar números de páginas visibles para paginación
   */
  generatePageNumbers: (currentPage, totalPages) => {
    const pages = [];
    const maxVisible = 5; // Máximo de páginas visibles
    const sidePages = Math.floor(maxVisible / 2);
    
    // Calcular inicio y fin
    let start = Math.max(1, currentPage - sidePages);
    let end = Math.min(totalPages, currentPage + sidePages);
    
    // Ajustar si estamos cerca del inicio
    if (currentPage <= sidePages) {
      end = Math.min(totalPages, maxVisible);
    }
    
    // Ajustar si estamos cerca del final
    if (currentPage > totalPages - sidePages) {
      start = Math.max(1, totalPages - maxVisible + 1);
    }
    
    // Generar array de páginas
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    return pages;
  },
  
  /**
   * Construir query string para mantener filtros en paginación
   */
  buildQueryString: (filtros) => {
    if (!filtros || typeof filtros !== 'object') return '';
    
    const params = new URLSearchParams();
    
    Object.keys(filtros).forEach(key => {
      if (filtros[key] && filtros[key] !== '' && filtros[key] !== null && filtros[key] !== undefined) {
        params.append(key, filtros[key]);
      }
    });
    
    const queryString = params.toString();
    return queryString ? `&${queryString}` : '';
  },
  
  // ============== HELPERS DE DOCUMENTOS ==============
  
  /**
   * Verificar si usuario puede editar documento
   */
  puedeEditarDocumento: (usuario, documento) => {
    if (!usuario || !documento) return false;
    
    // Admin puede editar si no está en modo solo lectura
    if (usuario.rol === 'admin' && !usuario.soloLectura) return true;
    
    // Matrizador puede editar sus propios documentos
    if (usuario.rol === 'matrizador' && documento.idMatrizador === usuario.id) return true;
    
    // Caja puede editar documentos en proceso
    if (usuario.rol === 'caja' && documento.estado === 'en_proceso') return true;
    
    return false;
  },
  
  /**
   * Verificar si se puede marcar como listo desde recepción
   */
  puedeMarcarComoListoRecepcion: (usuario, documento) => {
    if (!usuario || !documento) return false;
    
    // Solo recepción puede marcar como listo
    if (usuario.rol !== 'recepcion') return false;
    
    // Solo documentos en proceso
    if (documento.estado !== 'en_proceso') return false;
    
    return true;
  },
  
  // ============== ✨ NUEVOS HELPERS PARA TABLA OPTIMIZADA ==============
  
  /**
   * Obtener letra del tipo de documento del código de barras
   */
  getTipoLetra: (codigoBarras) => {
    if (!codigoBarras) return '';
    const matches = codigoBarras.match(/([A-Z])(\d+)$/);
    return matches ? matches[1] : '';
  },

  /**
   * Generar iniciales del nombre completo
   */
  getIniciales: (nombreCompleto) => {
    if (!nombreCompleto) return 'NN';
    return nombreCompleto
      .split(' ')
      .map(palabra => palabra.charAt(0))
      .join('')
      .substring(0, 3)
      .toUpperCase();
  },

  /**
   * Obtener icono para estado de documento
   */
  getEstadoIcono: (estado) => {
    const iconos = {
      'en_proceso': '⏳',
      'listo_para_entrega': '✅',
      'entregado': '📦',
      'nota_credito': '📋',
      'cancelado': '❌'
    };
    return iconos[estado] || '❓';
  },

  /**
   * Obtener icono para estado de pago
   */
  getPagoIcono: (estadoPago) => {
    const iconos = {
      'pendiente': '❌',
      'pagado_completo': '💚',
      'pagado_con_retencion': '💙',
      'pago_parcial': '🟡'
    };
    return iconos[estadoPago] || '❓';
  },

  /**
   * Convertir primera letra a mayúscula
   */
  ucfirst: (str) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  // ============== HELPERS DE TEXTO ==============
  
  /**
   * Capitalizar texto
   */
  capitalize: (str) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  },
  
  /**
   * Condición compleja
   */
  ifCond: (v1, operator, v2, options) => {
    switch (operator) {
      case '==':
        return (v1 == v2) ? options.fn(this) : options.inverse(this);
      case '===':
        return (v1 === v2) ? options.fn(this) : options.inverse(this);
      case '!=':
        return (v1 != v2) ? options.fn(this) : options.inverse(this);
      case '!==':
        return (v1 !== v2) ? options.fn(this) : options.inverse(this);
      case '<':
        return (v1 < v2) ? options.fn(this) : options.inverse(this);
      case '<=':
        return (v1 <= v2) ? options.fn(this) : options.inverse(this);
      case '>':
        return (v1 > v2) ? options.fn(this) : options.inverse(this);
      case '>=':
        return (v1 >= v2) ? options.fn(this) : options.inverse(this);
      case '&&':
        return (v1 && v2) ? options.fn(this) : options.inverse(this);
      case '||':
        return (v1 || v2) ? options.fn(this) : options.inverse(this);
      default:
        return options.inverse(this);
    }
  },

  // ============== HELPERS DE PRIORIDAD ==============
  
  /**
   * Obtener clase CSS para prioridad
   */
  getPriorityClass: (priority) => {
    const classes = {
      'alta': 'text-danger',
      'media': 'text-warning',
      'baja': 'text-success'
    };
    return classes[priority] || 'text-muted';
  },
  
  /**
   * Obtener texto de prioridad
   */
  getPriorityText: (priority) => {
    const texts = {
      'alta': 'Alta',
      'media': 'Media',
      'baja': 'Baja'
    };
    return texts[priority] || 'Normal';
  },
  
  /**
   * Obtener icono de prioridad
   */
  getPriorityIcon: (priority) => {
    const icons = {
      'alta': 'fas fa-exclamation-triangle',
      'media': 'fas fa-exclamation-circle',
      'baja': 'fas fa-info-circle'
    };
    return icons[priority] || 'fas fa-circle';
  },

  // ============== HELPER DE DEBUG ==============
  
  /**
   * Debug para desarrollo
   */
  debug: (value) => {
    console.log('🐛 Handlebars Debug:', value);
    return JSON.stringify(value, null, 2);
  }
};

// ============== REGISTRAR HELPERS EN HANDLEBARS ==============

// Helper para formatear fechas con formato específico para Ecuador
// CORREGIDO: Usa función unificada para evitar problemas de timezone
Handlebars.registerHelper('formatDateEcuador', function(date) {
  return formatearFecha(date);
});

// formatDateTime duplicado removido - se usa el helper del module.exports

// formatDate duplicado removido - se usa el helper del module.exports

// Helpers de comparación
Handlebars.registerHelper('gt', function(a, b) {
  return Number(a) > Number(b);
});

Handlebars.registerHelper('gte', function(a, b) {
  return Number(a) >= Number(b);
});

Handlebars.registerHelper('lt', function(a, b) {
  return Number(a) < Number(b);
});

Handlebars.registerHelper('lte', function(a, b) {
  return Number(a) <= Number(b);
});

Handlebars.registerHelper('eq', function(a, b) {
  return a === b;
});

Handlebars.registerHelper('ne', function(a, b) {
  return a !== b;
});

// Helper para formatear números como dinero
Handlebars.registerHelper('formatMoney', function(amount) {
  if (!amount) return '0.00';
  return parseFloat(amount).toFixed(2);
});

// Helper para formatear números con separadores de miles
Handlebars.registerHelper('formatNumber', function(number) {
  if (!number) return '0';
  
  return new Intl.NumberFormat('es-EC').format(number);
});

// Helpers de comparación
Handlebars.registerHelper('eq', function(a, b) {
  return a === b;
});

Handlebars.registerHelper('ne', function(a, b) {
  return a !== b;
});

Handlebars.registerHelper('gt', function(a, b) {
  return a > b;
});

Handlebars.registerHelper('gte', function(a, b) {
  return a >= b;
});

Handlebars.registerHelper('lt', function(a, b) {
  return a < b;
});

Handlebars.registerHelper('lte', function(a, b) {
  return a <= b;
});

// Helpers matemáticos
Handlebars.registerHelper('add', function(a, b) {
  return (parseInt(a) || 0) + (parseInt(b) || 0);
});

Handlebars.registerHelper('subtract', function(a, b) {
  return (parseInt(a) || 0) - (parseInt(b) || 0);
});

// Helpers de paginación
Handlebars.registerHelper('generatePageNumbers', function(currentPage, totalPages) {
  const pages = [];
  const maxPages = 5;
  
  let startPage = Math.max(1, currentPage - Math.floor(maxPages / 2));
  let endPage = Math.min(totalPages, startPage + maxPages - 1);
  
  if (endPage - startPage + 1 < maxPages) {
    startPage = Math.max(1, endPage - maxPages + 1);
  }
  
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }
  
  return pages;
});

Handlebars.registerHelper('buildQueryString', function(filtros) {
  if (!filtros || typeof filtros !== 'object') return '';
  
  const params = [];
  Object.keys(filtros).forEach(key => {
    if (filtros[key] && filtros[key] !== '') {
      params.push(`${key}=${encodeURIComponent(filtros[key])}`);
    }
  });
  
  return params.length > 0 ? '&' + params.join('&') : '';
});

// Helper para capitalizar
Handlebars.registerHelper('capitalize', function(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
});

// Helper de debug
Handlebars.registerHelper('debug', function(value) {
  console.log('🐛 Handlebars Debug:', value);
  return JSON.stringify(value, null, 2);
});

// ✨ NUEVOS HELPERS PARA TABLA OPTIMIZADA
// CORREGIDO: Usa función unificada para evitar problemas de timezone
Handlebars.registerHelper('formatFechaCorta', function(date) {
  const fechaCompleta = formatearFecha(date);
  if (!fechaCompleta || fechaCompleta === 'Sin fecha') return '';
  
  // Convertir DD/MM/YYYY a DD/MM/YY
  const partes = fechaCompleta.split('/');
  if (partes.length === 3) {
    return `${partes[0]}/${partes[1]}/${partes[2].substr(-2)}`;
  }
  
  return fechaCompleta;
});

Handlebars.registerHelper('getTipoLetra', function(codigoBarras) {
  if (!codigoBarras) return '';
  const matches = codigoBarras.match(/([A-Z])(\d+)$/);
  return matches ? matches[1] : '';
});

Handlebars.registerHelper('getIniciales', function(nombreCompleto) {
  if (!nombreCompleto) return 'NN';
  const palabras = nombreCompleto.split(' ').filter(p => p.length > 0);
  if (palabras.length === 1) {
    // Si solo hay una palabra, tomar las primeras 3 letras
    return palabras[0].substring(0, 3).toUpperCase();
  }
  // Si hay múltiples palabras, tomar primera letra de cada una (máximo 3)
  return palabras
    .slice(0, 3)
    .map(palabra => palabra.charAt(0))
    .join('')
    .toUpperCase();
});

Handlebars.registerHelper('getEstadoIcono', function(estado) {
  const iconos = {
    'en_proceso': '⏳',
    'listo_para_entrega': '✅',
    'entregado': '📦',
    'nota_credito': '📋',
    'cancelado': '❌'
  };
  return iconos[estado] || '❓';
});

Handlebars.registerHelper('getPagoIcono', function(estadoPago) {
  const iconos = {
    'pendiente': '❌',
    'pagado_completo': '💚',
    'pagado_con_retencion': '💙',
    'pago_parcial': '🟡'
  };
  return iconos[estadoPago] || '❓';
});

Handlebars.registerHelper('ucfirst', function(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
});

Handlebars.registerHelper('truncate', function(texto, limite) {
  if (!texto) return '';
  if (texto.length <= limite) return texto;
  return texto.substring(0, limite) + '...';
});

Handlebars.registerHelper('ifCond', function(v1, operator, v2, options) {
  switch (operator) {
    case '==':
      return (v1 == v2) ? options.fn(this) : options.inverse(this);
    case '===':
      return (v1 === v2) ? options.fn(this) : options.inverse(this);
    case '!=':
      return (v1 != v2) ? options.fn(this) : options.inverse(this);
    case '!==':
      return (v1 !== v2) ? options.fn(this) : options.inverse(this);
    case '<':
      return (v1 < v2) ? options.fn(this) : options.inverse(this);
    case '<=':
      return (v1 <= v2) ? options.fn(this) : options.inverse(this);
    case '>':
      return (v1 > v2) ? options.fn(this) : options.inverse(this);
    case '>=':
      return (v1 >= v2) ? options.fn(this) : options.inverse(this);
    case '&&':
      return (v1 && v2) ? options.fn(this) : options.inverse(this);
    case '||':
      return (v1 || v2) ? options.fn(this) : options.inverse(this);
    default:
      return options.inverse(this);
  }
});

Handlebars.registerHelper('getPriorityClass', function(priority) {
  const classes = {
    'alta': 'text-danger',
    'media': 'text-warning',
    'baja': 'text-success'
  };
  return classes[priority] || 'text-muted';
});

Handlebars.registerHelper('getPriorityText', function(priority) {
  const texts = {
    'alta': 'Alta',
    'media': 'Media',
    'baja': 'Baja'
  };
  return texts[priority] || 'Normal';
});

Handlebars.registerHelper('getPriorityIcon', function(priority) {
  const icons = {
    'alta': 'fas fa-exclamation-triangle',
    'media': 'fas fa-exclamation-circle',
    'baja': 'fas fa-info-circle'
  };
  return icons[priority] || 'fas fa-circle';
});