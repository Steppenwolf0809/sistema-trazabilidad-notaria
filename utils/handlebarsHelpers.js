/**
 * Helpers personalizados para las plantillas Handlebars
 * CORREGIDO: Estructura limpia con registro global
 */

const moment = require('moment');
moment.locale('es');

const Handlebars = require('handlebars');
const { formatearFecha } = require('./fechaUtils');

// DEFINIR TODOS LOS HELPERS EN UN OBJETO
const helpers = {
  // ============== HELPERS DE FECHA Y TIEMPO ==============
  
  formatDateTime: (date) => {
    if (!date) return 'No registrada';
    if (date === 'now') return moment().format('DD/MM/YYYY HH:mm');
    return moment(date).format('DD/MM/YYYY HH:mm');
  },

  // CRÍTICO: Este es el helper que faltaba
  formatearFechaSolo: (fecha) => {
    if (!fecha) return 'Sin fecha';
    return moment(fecha).format('DD/MM/YYYY');
  },

  formatearHoraSolo: (fecha) => {
    if (!fecha) return 'Sin hora';
    return moment(fecha).format('HH:mm');
  },
  
  formatDate: (date) => {
    return formatearFecha(date);
  },
  
  // CRÍTICO: Helper formatDateEcuador que estaba faltando
  formatDateEcuador: (date) => {
    return formatearFecha(date);
  },
  
  // CRÍTICO: Helper formatDateDocument que estaba faltando
  formatDateDocument: (date) => {
    return formatearFecha(date);
  },
  
  // CRÍTICO: Helper formatFechaCorta que estaba faltando (DD/MM/YY)
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
  
  formatTime: (date) => {
    if (!date) return 'No registrada';
    return moment(date).format('HH:mm');
  },
  
  // ============== HELPERS DE COMPARACIÓN ==============
  
  eq: (a, b) => a === b,
  ne: (a, b) => a !== b,
  gt: (a, b) => a > b,
  gte: (a, b) => a >= b,
  lt: (a, b) => a < b,
  lte: (a, b) => a <= b,
  
  and: function() {
    const args = Array.prototype.slice.call(arguments, 0, -1);
    return args.every(Boolean);
  },
  
  or: function() {
    const args = Array.prototype.slice.call(arguments, 0, -1);
    return args.some(Boolean);
  },

  // ============== HELPERS ESPECÍFICOS PARA NOTIFICACIONES ==============
  
  destinatarioCensurado: (telefono) => {
    if (!telefono) return 'N/A';
    const tel = telefono.toString();
    if (tel.length <= 4) return tel;
    return tel.substring(0, 4) + '***' + tel.substring(tel.length - 4);
  },
  
  estadoTexto: (estado) => {
    const estados = {
      'enviado': 'Enviado',
      'entregado': 'Entregado',
      'fallido': 'Fallido',
      'pendiente': 'Pendiente'
    };
    return estados[estado] || estado;
  },
  
  estadoBadgeClass: (estado) => {
    const clases = {
      'enviado': 'badge-success',
      'entregado': 'badge-primary',
      'fallido': 'badge-danger',
      'pendiente': 'badge-warning'
    };
    return clases[estado] || 'badge-secondary';
  },

  // CORREGIDO: Helper ahora usa estilos en línea para garantizar la visibilidad del color.
  estadoConColor: (estado) => {
    if (!estado) return '';
    
    const estadoLower = estado.toLowerCase();
    let style = 'font-weight: 800 !important; text-transform: uppercase; font-size: 0.9rem !important;';
    let textoEstado = estado.toUpperCase();
    
    if (estadoLower.includes('enviado') || estadoLower.includes('entregado')) {
        style += ' color: #28a745 !important;'; // Verde fuerte
        textoEstado = estadoLower === 'entregado' ? 'ENTREGADO' : 'ENVIADO';
    } else if (estadoLower.includes('fallido') || estadoLower.includes('error')) {
        style += ' color: #dc3545 !important;'; // Rojo fuerte
        textoEstado = 'FALLIDO';
    } else if (estadoLower.includes('pendiente')) {
        style += ' color: #fd7e14 !important;'; // Naranja fuerte para contraste
        textoEstado = 'PENDIENTE';
    } else {
        style += ' color: #6c757d !important;'; // Gris para otros estados
    }
    
    return `<span style="${style}">${textoEstado}</span>`;
  },
  
  // ===============================================
  // == HELPERS MEJORADOS PARA ESTADOS (ENTREGA Y PAGO) ==
  // ===============================================

  // Helper para Estados de Entrega
  iconoEstadoEntrega: function(estadoEntrega) {
      if (!estadoEntrega) return '';
      const estado = estadoEntrega.toLowerCase();
      if (estado.includes('entregado')) {
          return '<i class="fas fa-check-circle"></i>';
      } else if (estado.includes('listo')) {
          return '<i class="fas fa-file-alt"></i>';
      } else if (estado.includes('proceso')) {
          return '<i class="fas fa-user-clock"></i>';
      }
      return '<i class="fas fa-question"></i>'; // Por defecto
  },

  badgeEstadoEntrega: function(estadoEntrega) {
      if (!estadoEntrega) return '<span class="badge badge-secondary"><i class="fas fa-question-circle"></i> Desconocido</span>';
      const estado = estadoEntrega.toLowerCase();
      let clase = '';
      let icono = '';
      let texto = '';
      
      if (estado.includes('entregado')) {
          clase = 'badge-entrega entregado';
          icono = 'fas fa-check-circle';
          texto = 'Entregado';
      } else if (estado.includes('listo')) {
          clase = 'badge-entrega listo';
          icono = 'fas fa-file-alt';
          texto = 'Listo para Entrega';
      } else if (estado.includes('proceso')) {
          clase = 'badge-entrega proceso';
          icono = 'fas fa-user-clock';
          texto = 'En Proceso';
      } else {
          clase = 'badge-secondary';
          icono = 'fas fa-question-circle';
          texto = estado;
      }
      
      return `<span class="badge ${clase}"><i class="${icono}"></i> ${texto}</span>`;
  },

  // Helper para Estados de Pago
  iconoEstadoPago: function(estadoPago) {
      if (!estadoPago) return '';
      const estado = estadoPago.toLowerCase();
      if (estado.includes('pendiente') || estado.includes('no_pagado')) {
          return '<i class="fas fa-times"></i>';
      } else if (estado.includes('parcial')) {
          return '<i class="fas fa-adjust"></i>';
      } else if (estado.includes('completo')) {
          return '<i class="fas fa-dollar-sign"></i>';
      } else if (estado.includes('retencion')) {
          return '<i class="fas fa-university"></i>';
      }
      return '<i class="fas fa-question"></i>'; // Por defecto
  },

  badgeEstadoPago: function(estadoPago) {
      if (!estadoPago) return '<span class="badge badge-secondary"><i class="fas fa-question-circle"></i> Desconocido</span>';
      const estado = estadoPago.toLowerCase();
      let clase = '';
      let icono = '';
      let texto = '';
      
      if (estado.includes('pendiente') || estado.includes('no_pagado')) {
          clase = 'badge-pago pendiente';
          icono = 'fas fa-times';
          texto = 'No Pagado';
      } else if (estado.includes('parcial')) {
          clase = 'badge-pago parcial';
          icono = 'fas fa-adjust';
          texto = 'Pago Parcial';
      } else if (estado.includes('completo')) {
          clase = 'badge-pago completo';
          icono = 'fas fa-dollar-sign';
          texto = 'Pagado';
      } else if (estado.includes('retencion')) {
          clase = 'badge-pago retencion';
          icono = 'fas fa-university';
          texto = 'Pagado c/Retención';
      } else {
          clase = 'badge-secondary';
          icono = 'fas fa-question-circle';
          texto = estado;
      }
      
      return `<span class="badge ${clase}"><i class="${icono}"></i> ${texto}</span>`;
  },
  
  // NUEVO: Helper "getTipoLetra" para compatibilidad con vistas antiguas
  getTipoLetra: (codigoBarras) => {
    if (!codigoBarras || typeof codigoBarras !== 'string') {
      return 'DOC'; // Valor por defecto
    }
    // Asume que el tipo es el prefijo antes del primer número. Ej: "P12345" -> "P"
    const match = codigoBarras.match(/^([A-Z]+)/);
    if (match && match[1]) {
      return match[1];
    }
    return 'DOC'; // Fallback
  },
  
  formatearCodigoCompacto: (codigo) => {
    if (!codigo) return 'N/A';
    // CORREGIDO: Mostrar código completo en lugar de truncado
    return codigo.toString();
  },
  
  iconoTipoDocumento: (tipo) => {
    const iconos = {
      'Escritura': 'fas fa-file-contract',
      'Certificación': 'fas fa-certificate',
      'Copia': 'fas fa-copy',
      'Autenticación': 'fas fa-stamp',
      'Diligencia': 'fas fa-file-alt'
    };
    return iconos[tipo] || 'fas fa-file';
  },
  
  // CRÍTICO: Helper esEntregaGrupal que estaba faltando
  esEntregaGrupal: (tipoEvento) => {
    return tipoEvento === 'entrega_grupal';
  },
  
  // CRÍTICO: Helper obtenerCodigoVerificacion que estaba faltando
  obtenerCodigoVerificacion: (notificacion) => {
    // Intentar obtener desde metadatos
    if (notificacion && notificacion.metadatos && notificacion.metadatos.codigoVerificacion) {
      return notificacion.metadatos.codigoVerificacion;
    }
    
    // Intentar extraer del mensaje enviado
    if (notificacion && notificacion.mensajeEnviado) {
      const match = notificacion.mensajeEnviado.match(/código[:\s]*(\d{4})/i);
      if (match) {
        return match[1];
      }
    }
    
    // Generar código visual basado en ID (para compatibilidad)
    if (notificacion && notificacion.id) {
      return String(notificacion.id).padStart(4, '0');
    }
    
    return '****';
  },

  // ============== HELPERS DE CÁLCULO MATEMÁTICO ==============
  
  // CRÍTICO: Helper percentage que estaba faltando
  percentage: (part, total) => {
    if (!total || total === 0) return '0.0';
    return ((part / total) * 100).toFixed(1);
  },
  
  // CRÍTICO: Helper sum para arrays
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
  
  // CRÍTICO: Helper map para mapear arrays
  map: function(array, property) {
    if (!Array.isArray(array)) return [];
    return array.map(item => {
      if (typeof property === 'string') {
        return item[property];
      }
      return item;
    });
  },
  
  // CRÍTICO: Helper average para promedios
  average: (arr) => {
    if (!Array.isArray(arr) || arr.length === 0) return 0;
    const sum = arr.reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
    return (sum / arr.length).toFixed(2);
  },

  // ============== HELPERS ADICIONALES ==============
  
  formatMoney: (amount) => {
    if (!amount) return '0.00';
    return parseFloat(amount).toFixed(2);
  },
  
  add: (a, b) => {
    return parseInt(a) + parseInt(b);
  },
  
  subtract: (a, b) => {
    return parseInt(a) - parseInt(b);
  },
  
  stringifyNumber: (num) => {
    return num ? num.toString() : '';
  },
  
  json: (context) => {
    return JSON.stringify(context);
  },
  
  // ============== HELPERS DE UTILIDADES ==============
  
  capitalize: (str) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  },
  
  truncate: (str, length = 50) => {
    if (!str) return '';
    if (typeof str !== 'string') str = String(str);
    return str.length > length ? str.substring(0, length) + '...' : str;
  },
  
  // CRÍTICO: Helper substring que estaba faltando
  substring: (str, start, length) => {
    if (!str) return '';
    if (typeof str !== 'string') str = String(str);
    return str.substring(start, start + length);
  },
  
  // Helpers adicionales de utilidad
  pluralize: (count, singular, plural) => {
    return count === 1 ? singular : plural;
  },
  
  hasItems: (arr) => {
    return Array.isArray(arr) && arr.length > 0;
  },
  
  notEmpty: (value) => {
    return value != null && value !== '' && value !== undefined;
  },
  
  isEmpty: (value) => {
    if (!value) return true;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
  },
  
  // Helpers de tiempo
  timeAgo: (date) => {
    if (!date) return 'Nunca';
    return moment(date).fromNow();
  },
  
  daysAgo: (date) => {
    if (!date) return 0;
    return moment().diff(moment(date), 'days');
  },
  
  formatTimestamp: (timestamp) => {
    if (!timestamp) return 'No registrado';
    return moment(timestamp).format('DD/MM/YYYY HH:mm:ss');
  },
  
  // CRÍTICO: Helper toString que estaba faltando
  toString: (value) => {
    return String(value);
  },
  
  // Helpers adicionales que pueden estar faltando
  length: (array) => {
    if (!Array.isArray(array)) return 0;
    return array.length;
  },
  
  range: (start, end) => {
    const result = [];
    for (let i = start; i <= end; i++) {
      result.push(i);
    }
    return result;
  },
  
  includes: (array, value) => {
    if (!Array.isArray(array)) return false;
    return array.includes(value);
  },
  
  join: (array, separator) => {
    if (!Array.isArray(array)) return '';
    return array.join(separator || ', ');
  },
  
  hasElements: (array) => {
    return Array.isArray(array) && array.length > 0;
  },
  
  isNotEmpty: (array) => {
    return Array.isArray(array) && array.length > 0;
  },

  // ===============================================
  // == HELPERS RESTAURADOS (CRÍTICOS) ==
  // ===============================================

  // CRÍTICO: Helper getIniciales que estaba faltando
  getIniciales: (nombre) => {
    if (!nombre || typeof nombre !== 'string' || nombre.trim() === '') return '??';
    const palabras = nombre.trim().split(/\s+/);
    if (palabras.length === 1) {
      // Si es una sola palabra, tomar las dos primeras letras
      return palabras[0].substring(0, 2).toUpperCase();
    }
    // Si son varias palabras, tomar la inicial de las dos primeras
    return palabras
      .slice(0, 2)
      .map(p => p[0])
      .join('')
      .toUpperCase();
  },

  // CRÍTICO: Helper formatDineroCompleto que estaba faltando
  formatDineroCompleto: (valor) => {
    if (valor === null || valor === undefined || isNaN(valor)) {
      return '$0.00';
    }
    const numero = parseFloat(valor);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numero);
  },

  // CRÍTICO: Helper buildQueryString que estaba faltando
  buildQueryString: (filtros) => {
    if (!filtros || typeof filtros !== 'object') {
      return '';
    }
    const params = new URLSearchParams();
    for (const key in filtros) {
      if (Object.prototype.hasOwnProperty.call(filtros, key) && filtros[key]) {
        params.append(key, filtros[key]);
      }
    }
    return params.toString();
  },

  // CRÍTICO: Helper generatePageNumbers que estaba faltando
  generatePageNumbers: (currentPage, totalPages, maxPagesToShow = 7) => {
    if (totalPages <= 1) return [];

    const pages = [];
    const half = Math.floor(maxPagesToShow / 2);

    let start = Math.max(1, currentPage - half);
    let end = Math.min(totalPages, currentPage + half);

    if (currentPage - half < 1) {
      end = Math.min(totalPages, maxPagesToShow);
    }

    if (currentPage + half > totalPages) {
      start = Math.max(1, totalPages - maxPagesToShow + 1);
    }
    
    // Puntos suspensivos al inicio
    if (start > 1) {
      pages.push({ num: 1, isLink: true });
      if (start > 2) {
        pages.push({ isEllipsis: true });
      }
    }

    // Números de página
    for (let i = start; i <= end; i++) {
      pages.push({ num: i, isCurrent: i === currentPage, isLink: true });
    }

    // Puntos suspensivos al final
    if (end < totalPages) {
      if (end < totalPages - 1) {
        pages.push({ isEllipsis: true });
      }
      pages.push({ num: totalPages, isLink: true });
    }

    return pages;
  }
};

// REGISTRAR TODOS LOS HELPERS GLOBALMENTE EN HANDLEBARS
Object.keys(helpers).forEach(helperName => {
  Handlebars.registerHelper(helperName, helpers[helperName]);
});

console.log('✅ Helpers registrados globalmente:', Object.keys(helpers).length, 'helpers');
console.log('🔑 Helpers críticos incluidos: formatearFechaSolo, formatDateEcuador, formatDateDocument, formatFechaCorta, percentage, sum, map, average, substring, esEntregaGrupal, obtenerCodigoVerificacion, toString');

// EXPORTAR HELPERS
module.exports = helpers;
