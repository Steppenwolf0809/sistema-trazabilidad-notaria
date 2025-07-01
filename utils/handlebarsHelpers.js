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
  
  daysSince: (date) => {
    if (!date) return 0;
    return moment().diff(moment(date), 'days');
  },
  
  // Helper para sumar valores de un array
  sum: (array, property) => {
    if (!Array.isArray(array)) return 0;
    return array.reduce((total, item) => {
      const value = parseFloat(item[property]) || 0;
      return total + value;
    }, 0).toFixed(2);
  },
  
  // Helper para contar elementos que cumplen una condición
  count: (array, property, threshold) => {
    if (!Array.isArray(array)) return 0;
    if (threshold === undefined) {
      // Contar elementos que tienen la propiedad
      return array.filter(item => item[property]).length;
    } else {
      // Contar elementos que superan el threshold
      return array.filter(item => {
        const value = parseInt(item[property]) || 0;
        return value >= threshold;
      }).length;
    }
  },
  
  // Helper para restar dos números
  subtract: (a, b) => {
    const numA = parseInt(a) || 0;
    const numB = parseInt(b) || 0;
    return numA - numB;
  },

  // ============== HELPERS DE DOCUMENTOS ==============
  
  // Helper para abreviar tipos de documento
  abreviarTipoDocumento: (tipoDocumento) => {
    const abreviaciones = {
      'Protocolo': 'PROT',
      'Diligencias': 'DILI', 
      'Certificaciones': 'CERT',
      'Arrendamientos': 'ARRE',
      'Otros': 'OTRO'
    };
    return abreviaciones[tipoDocumento] || 'N/A';
  },
  
  // ============== HELPERS DE COMPARACIÓN ==============
  
  eq: (a, b) => a === b,
  ne: (a, b) => a !== b,
  gt: (a, b) => a > b,
  gte: (a, b) => a >= b,
  lt: (a, b) => a < b,
  lte: (a, b) => a <= b,

  // ============== HELPERS DE TEXTO ==============
  
  capitalizar: (texto) => {
    if (!texto) return '';
    if (typeof texto !== 'string') return texto;
    
    // Capitalizar primera letra de cada palabra
    return texto.toLowerCase().split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  },

  mayuscula: (texto) => {
    if (!texto) return '';
    if (typeof texto !== 'string') return texto;
    return texto.toUpperCase();
  },

  minuscula: (texto) => {
    if (!texto) return '';
    if (typeof texto !== 'string') return texto;
    return texto.toLowerCase();
  },

  // ============== HELPERS DE PAGINACIÓN ==============
  
  getPaginationItems: (currentPage, totalPages) => {
    if (!currentPage || !totalPages || totalPages <= 1) return [];
    
    currentPage = parseInt(currentPage);
    totalPages = parseInt(totalPages);
    
    const items = [];
    const maxVisiblePages = 7; // Número máximo de páginas visibles
    
    if (totalPages <= maxVisiblePages) {
      // Si hay pocas páginas, mostrar todas
      for (let i = 1; i <= totalPages; i++) {
        items.push({
          pageNumber: i,
          isActive: i === currentPage,
          isEllipsis: false
        });
      }
    } else {
      // Para muchas páginas, usar lógica de elipsis
      
      // Siempre mostrar la primera página
      items.push({
        pageNumber: 1,
        isActive: currentPage === 1,
        isEllipsis: false
      });
      
      // Calcular rango alrededor de la página actual
      let startPage = Math.max(2, currentPage - 2);
      let endPage = Math.min(totalPages - 1, currentPage + 2);
      
      // Ajustar si estamos cerca del inicio
      if (currentPage <= 4) {
        startPage = 2;
        endPage = Math.min(6, totalPages - 1);
      }
      
      // Ajustar si estamos cerca del final
      if (currentPage >= totalPages - 3) {
        startPage = Math.max(totalPages - 5, 2);
        endPage = totalPages - 1;
      }
      
      // Agregar elipsis al inicio si es necesario
      if (startPage > 2) {
        items.push({
          pageNumber: null,
          isActive: false,
          isEllipsis: true
        });
      }
      
      // Agregar páginas del rango
      for (let i = startPage; i <= endPage; i++) {
        items.push({
          pageNumber: i,
          isActive: i === currentPage,
          isEllipsis: false
        });
      }
      
      // Agregar elipsis al final si es necesario
      if (endPage < totalPages - 1) {
        items.push({
          pageNumber: null,
          isActive: false,
          isEllipsis: true
        });
      }
      
      // Siempre mostrar la última página
      items.push({
        pageNumber: totalPages,
        isActive: currentPage === totalPages,
        isEllipsis: false
      });
    }
    
    return items;
  },

  buildPaginationUrl: (userRole, page, filtros = {}) => {
    if (!userRole || !page) return '#';
    
    // Construir URL base según el rol
    let baseUrl = '';
    switch (userRole) {
      case 'admin':
        baseUrl = '/admin/notificaciones/historial';
        break;
      case 'archivo':
        baseUrl = '/archivo/notificaciones/historial';
        break;
      case 'recepcion':
        baseUrl = '/recepcion/notificaciones/historial';
        break;
      case 'matrizador':
        baseUrl = '/matrizadores/notificaciones/historial';
        break;
      default:
        baseUrl = '/notificaciones/historial';
    }
    
    // Construir parámetros de consulta
    const params = new URLSearchParams();
    params.set('page', page);
    
    // Agregar filtros si existen
    if (filtros) {
      Object.keys(filtros).forEach(key => {
        if (filtros[key] && filtros[key] !== '') {
          params.set(key, filtros[key]);
        }
      });
    }
    
    return `${baseUrl}?${params.toString()}`;
  },
  
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
      if (!estadoEntrega) return '<span class="badge bg-secondary text-white"><i class="fas fa-question-circle me-1"></i>Desconocido</span>';
      const estado = estadoEntrega.toLowerCase();
      let clase = '';
      let icono = '';
      let texto = '';
      
      if (estado.includes('entregado')) {
          clase = 'bg-success text-white';
          icono = 'fas fa-check-circle';
          texto = 'ENTREGADO';
      } else if (estado.includes('listo')) {
          clase = 'bg-primary text-white';
          icono = 'fas fa-file-check';
          texto = 'LISTO';
      } else if (estado.includes('proceso')) {
          clase = 'bg-warning text-dark';
          icono = 'fas fa-clock';
          texto = 'EN PROCESO';
      } else {
          clase = 'bg-secondary text-white';
          icono = 'fas fa-question-circle';
          texto = estado.toUpperCase();
      }
      
      return `<span class="badge ${clase} px-2 py-1"><i class="${icono} me-1"></i>${texto}</span>`;
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
      if (!estadoPago) return '<span class="badge bg-secondary text-white"><i class="fas fa-question-circle me-1"></i>Desconocido</span>';
      const estado = estadoPago.toLowerCase();
      let clase = '';
      let icono = '';
      let texto = '';
      
      if (estado.includes('pendiente') || estado.includes('no_pagado')) {
          clase = 'bg-danger text-white';
          icono = 'fas fa-times-circle';
          texto = 'NO PAGADO';
      } else if (estado.includes('parcial')) {
          clase = 'bg-warning text-dark';
          icono = 'fas fa-circle-half-stroke';
          texto = 'PARCIAL';
      } else if (estado.includes('completo')) {
          clase = 'bg-success text-white';
          icono = 'fas fa-dollar-sign';
          texto = 'PAGADO';
      } else if (estado.includes('retencion')) {
          clase = 'bg-success text-white';
          icono = 'fas fa-university';
          texto = 'CON RETENCIÓN';
      } else {
          clase = 'bg-secondary text-white';
          icono = 'fas fa-question-circle';
          texto = estado.toUpperCase();
      }
      
      return `<span class="badge ${clase} px-2 py-1"><i class="${icono} me-1"></i>${texto}</span>`;
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
  },

  // CRÍTICO: Helper tipoDocumentoClass que estaba faltando
  tipoDocumentoClass: (tipo) => {
    const clases = {
      'Diligencias': 'tipo-D',
      'Certificaciones': 'tipo-C',
      'Copias': 'tipo-P',
      'Autenticaciones': 'tipo-A',
      'Otros': 'tipo-O'
    };
    return clases[tipo] || 'tipo-O';
  },

  // Helper adicional para icono de tipo de documento
  iconoTipoDocumento: (tipo) => {
    const iconos = {
      'Escritura': 'fas fa-file-contract',
      'Certificación': 'fas fa-certificate',
      'Copia': 'fas fa-copy',
      'Autenticación': 'fas fa-stamp',
      'Diligencia': 'fas fa-file-alt',
      'Diligencias': 'fas fa-file-alt',
      'Certificaciones': 'fas fa-certificate',
      'Copias': 'fas fa-copy',
      'Autenticaciones': 'fas fa-stamp'
    };
    return iconos[tipo] || 'fas fa-file';
  },

  // Helper para abreviación de tipo de documento
  tipoDocumentoAbrev: (tipo) => {
    const tipos = {
      'Diligencias': 'D',
      'Certificaciones': 'C',
      'Copias': 'CP',
      'Autenticaciones': 'A',
      'Otros': 'O'
    };
    return tipos[tipo] || tipo.charAt(0).toUpperCase();
  },

  // CRÍTICO: Helper formatMatrizadorNombre que estaba faltando
  formatMatrizadorNombre: (matrizador) => {
    if (!matrizador || !matrizador.nombre) {
      return 'Sin asignar';
    }
    
    const nombre = matrizador.nombre.trim();
    
    // Si el nombre es corto, mostrar completo
    if (nombre.length <= 20) {
      return nombre;
    }
    
    // Si el nombre es largo, mostrar primer nombre + primer apellido
    const partes = nombre.split(' ').filter(parte => parte.length > 0);
    if (partes.length >= 2) {
      // Mostrar primer nombre + primer apellido (no el último)
      return `${partes[0]} ${partes[1]}`;
    }
    
    // Si es una sola palabra muy larga, truncar
    return nombre.substring(0, 18) + '...';
  },

  // CRÍTICO: Helper estadoPagoClass que estaba faltando
  estadoPagoClass: (estado) => {
    const clases = {
      'pendiente': 'bg-warning text-dark',
      'pago_parcial': 'bg-info text-white',
      'pagado_completo': 'bg-success text-white',
      'pagado_con_retencion': 'bg-success text-white'
    };
    return clases[estado] || 'bg-secondary text-white';
  },

  // CRÍTICO: Helper estadoPagoTexto que estaba faltando
  estadoPagoTexto: (estado) => {
    const textos = {
      'pendiente': 'Pendiente',
      'pago_parcial': 'Pago Parcial',
      'pagado_completo': 'Pagado Completo',
      'pagado_con_retencion': 'Pagado con Retención'
    };
    return textos[estado] || estado;
  },

  // CRÍTICO: Helper formatearCodigoCompacto que estaba faltando
  formatearCodigoCompacto: (codigo) => {
    if (!codigo) return 'N/A';
    const codigoStr = codigo.toString();
    if (codigoStr.length <= 8) return codigoStr;
    return codigoStr.substring(0, 4) + '...' + codigoStr.substring(codigoStr.length - 4);
  },

  // CRÍTICO: Helper estadoPagoSimple que estaba faltando
  estadoPagoSimple: (estado) => {
    const estados = {
      'pagado_completo': 'Pagado',
      'pendiente': 'Pendiente',
      'pagado_con_retencion': 'Con Ret.',
      'pago_parcial': 'Parcial',
      'sin_factura': 'S/F'
    };
    return estados[estado] || estado;
  },

  // CRÍTICO: Helper formatDateShort que estaba faltando
  formatDateShort: (date) => {
    const fechaCompleta = formatearFecha(date);
    if (!fechaCompleta || fechaCompleta === 'Sin fecha') return 'Sin fecha';
    
    const partes = fechaCompleta.split('/');
    if (partes.length === 3) {
      return `${partes[0]}/${partes[1]}/${partes[2].substr(-2)}`;
    }
    
    return fechaCompleta;
  },

  // ✨ NUEVO: Helper para truncar nombres con tooltip
  truncateWithTooltip: (texto, maxLength = 25) => {
    if (!texto || typeof texto !== 'string') return '';
    if (texto.length <= maxLength) return texto;
    
    const truncated = texto.substring(0, maxLength) + '...';
    return `<span title="${texto}" data-bs-toggle="tooltip" data-bs-placement="top">${truncated}</span>`;
  },

  // ✨ NUEVO: Helper para códigos destacados
  highlightCode: (codigo) => {
    if (!codigo) return 'N/A';
    return `<span class="codigo-destacado">${codigo}</span>`;
  },

  // ===============================================
  // == HELPERS PARA SISTEMA DE AUTORIZACIONES ==
  // ===============================================

  // Helper para verificar si un documento tiene autorización de crédito
  tieneAutorizacionCredito: (documentoId) => {
    // Este helper consulta localStorage en el frontend
    return `<script>
      if (window.sistemaAutorizaciones && window.sistemaAutorizaciones.preAutorizaciones && window.sistemaAutorizaciones.preAutorizaciones['${documentoId}']) {
        document.write('<span class="badge bg-info me-1"><i class="fas fa-university me-1"></i>CRÉDITO AUTORIZADO</span>');
      }
    </script>`;
  },

  // Helper para verificar si el usuario actual puede autorizar
  puedeAutorizar: (usuarioRol) => {
    const rolesAutorizan = ['admin', 'caja'];
    return rolesAutorizan.includes(usuarioRol);
  },

  // Helper para verificar si el usuario actual puede solicitar autorizaciones
  puedeSolicitar: (usuarioRol) => {
    const rolesSolicitan = ['recepcion', 'matrizador'];
    return rolesSolicitan.includes(usuarioRol);
  },

  // Helper para verificar si un documento es del mismo cliente que otros
  esMismoCliente: (cliente1, cliente2) => {
    if (!cliente1 || !cliente2) return false;
    return cliente1.toLowerCase().trim() === cliente2.toLowerCase().trim();
  },

  // Helper para mostrar estado de autorización
  estadoAutorizacion: (estado) => {
    const estados = {
      'pendiente': '<span class="badge bg-warning text-dark"><i class="fas fa-clock me-1"></i>PENDIENTE</span>',
      'autorizada': '<span class="badge bg-success"><i class="fas fa-check-circle me-1"></i>AUTORIZADA</span>',
      'rechazada': '<span class="badge bg-danger"><i class="fas fa-times-circle me-1"></i>RECHAZADA</span>',
      'expirada': '<span class="badge bg-secondary"><i class="fas fa-clock me-1"></i>EXPIRADA</span>'
    };
    return estados[estado] || estado;
  },

  // Helper para determinar si un documento está sin pago
  esSinPago: (estadoPago) => {
    if (!estadoPago) return true;
    const estadoBajo = estadoPago.toLowerCase();
    return estadoBajo.includes('pendiente') || estadoBajo.includes('no_pagado') || estadoBajo.includes('sin pago');
  },

  // Helper para obtener el rol desde la URL actual
  obtenerRolActual: () => {
    return `<script>
      (function() {
        const path = window.location.pathname;
        let rol = 'anonimo';
        if (path.includes('/admin')) rol = 'admin';
        else if (path.includes('/caja')) rol = 'caja';
        else if (path.includes('/recepcion')) rol = 'recepcion';
        else if (path.includes('/matrizador')) rol = 'matrizador';
        else if (path.includes('/archivo')) rol = 'archivo';
        window.rolActual = rol;
      })();
    </script>`;
  },

  // CRÍTICO: Helper getPriorityIcon que estaba faltando
  getPriorityIcon: (prioridad) => {
    const iconos = {
      'alta': '<i class="fas fa-exclamation-circle text-danger"></i>',
      'media': '<i class="fas fa-exclamation-triangle text-warning"></i>',
      'baja': '<i class="fas fa-info-circle text-info"></i>',
      'urgente': '<i class="fas fa-fire text-danger"></i>',
      'normal': '<i class="fas fa-circle text-secondary"></i>'
    };
    return iconos[prioridad] || iconos['normal'];
  },

  // Helper adicional para clase de prioridad
  getPriorityClass: (prioridad) => {
    const clases = {
      'alta': 'text-danger',
      'media': 'text-warning', 
      'baja': 'text-info',
      'urgente': 'text-danger fw-bold',
      'normal': 'text-secondary'
    };
    return clases[prioridad] || clases['normal'];
  },

  // Helper para texto de prioridad
  getPriorityText: (prioridad) => {
    const textos = {
      'alta': 'Alta',
      'media': 'Media',
      'baja': 'Baja', 
      'urgente': 'Urgente',
      'normal': 'Normal'
    };
    return textos[prioridad] || textos['normal'];
  },

  // ===============================================
  // == HELPER SECTION PARA HANDLEBARS ==
  // ===============================================
  
  // Helper section para inyectar contenido en layouts
  section: function(name, options) {
    if (!this._sections) this._sections = {};
    this._sections[name] = options.fn(this);
    return '';
  },

  // ===============================================
  // == HELPER PARA SISTEMA DE ARCHIVO ==
  // ===============================================

  /**
   * ✨ CRÍTICO: Verificar si un documento es ajeno al usuario actual (para vista archivo)
   * Usado en vistas de archivo para identificar documentos de otros matrizadores
   */
  esDocumentoAjeno: (usuario, documento) => {
    if (!usuario || !documento) return false;
    
    // Si el usuario es admin, ningún documento es ajeno
    if (usuario.rol === 'admin') return false;
    
    // Si el documento no tiene matrizador asignado, no es ajeno
    if (!documento.idMatrizador) return false;
    
    // Es ajeno si el documento pertenece a otro matrizador
    return documento.idMatrizador !== usuario.id;
  },

  // ===============================================
  // == HELPERS PARA SISTEMA DE ELIMINACIÓN ==
  // ===============================================

  /**
   * ✨ NUEVO: Helper para traducir motivos de eliminación
   * Usado en vista de documentos eliminados
   */
  getTextoMotivo: (motivo) => {
    if (!motivo) return 'Sin motivo';
    
    const textos = {
      'error_xml_importado': '🔍 Error en XML importado',
      'error_creacion_documento': '✏️ Error al crear documento',
      'solicitud_nota_credito': '📄 Solicitud de nota de crédito',
      'documento_duplicado': '📋 Documento duplicado',
      'datos_incorrectos': '🔧 Datos incorrectos',
      'cliente_cancelo_tramite': '❌ Cliente canceló trámite',
      'error_sistema': '⚙️ Error del sistema',
      'otro': '📝 Otro motivo'
    };
    
    return textos[motivo] || motivo;
  },

  /**
   * ✨ NUEVO: Helper para traducir manejo de pagos en eliminación
   * Usado en vista de documentos eliminados
   */
  getTextoManejosPago: (manejo) => {
    if (!manejo) return '';
    
    const textos = {
      'sin_pago_registrado': 'Sin pago',
      'nota_credito_automatica': '📄 Nota de crédito automática',
      'reembolso_manual_procesado': '💳 Reembolso manual procesado',
      'pago_revertido': '↩️ Pago revertido'
    };
    
    return textos[manejo] || manejo;
  },

  /**
   * ✨ NUEVO: Helper para operaciones matemáticas - suma
   */
  add: (a, b) => {
    return (parseFloat(a) || 0) + (parseFloat(b) || 0);
  },

  /**
   * ✨ NUEVO: Helper para operaciones matemáticas - resta
   */
  sub: (a, b) => {
    return (parseFloat(a) || 0) - (parseFloat(b) || 0);
  },

  /**
   * ✨ NUEVO: Helper para generar rango de números para paginación
   */
  range: (start, end) => {
    const result = [];
    for (let i = start; i <= end; i++) {
      result.push(i);
    }
    return result;
  },

  /**
   * ✨ CRÍTICO: Helper esReciente para verificar si una fecha es reciente
   * Usado en vista admin para determinar si se puede reactivar un documento eliminado
   * ACTUALIZADO: Permite reactivación sin límite de tiempo para flexibilidad operativa
   */
  esReciente: (fecha) => {
    if (!fecha) return false;
    
    const fechaEvento = new Date(fecha);
    
    // Verificar que la fecha sea válida
    if (isNaN(fechaEvento.getTime())) return false;
    
    // CAMBIO: Siempre retorna true para permitir reactivación en cualquier momento
    // En la práctica, los errores pueden descubrirse días o semanas después
    return true;
  },

  /**
   * ✨ CRÍTICO: Helper para verificar si hay pagos no revertidos
   * Usado en vista de Caja para mostrar/ocultar la sección de correcciones de pagos
   */
  hayPagosNoRevertidos: (pagos) => {
    if (!pagos || !Array.isArray(pagos)) return false;
    return pagos.some(pago => !pago.revertido);
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
