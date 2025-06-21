/**
 * Helpers personalizados para las plantillas Handlebars
 * SISTEMATIZADOS: Solo helpers realmente necesarios y optimizados
 */

const moment = require('moment');
moment.locale('es'); // Configurar moment en español

const Handlebars = require('handlebars');
const { formatearFecha } = require('./fechaUtils');

// CORRECCIÓN CRÍTICA: Definir helpers como objeto para exportar
const helpers = {
  // ============== HELPERS DE FECHA Y TIEMPO ==============
  
  /**
   * Formatear fecha completa con hora
   * CORREGIDO: Usa moment sin timezone para evitar conversiones incorrectas
   */
  formatDateTime: (date) => {
    if (!date) return 'No registrada';
    if (date === 'now') return moment().format('DD/MM/YYYY HH:mm');
    return moment(date).format('DD/MM/YYYY HH:mm');
  },

  /**
   * Formatear solo fecha (sin hora)
   */
  formatearFechaSolo: (fecha) => {
    if (!fecha) return 'Sin fecha';
    return moment(fecha).format('DD/MM/YYYY');
  },

  /**
   * Formatear solo hora (sin fecha)
   */
  formatearHoraSolo: (fecha) => {
    if (!fecha) return 'Sin hora';
    return moment(fecha).format('HH:mm');
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

  // ============== HELPERS PARA TABLA DE NOTIFICACIONES OPTIMIZADA ==============

  /**
   * Censurar destinatario de notificación (teléfono)
   * +593999266015 → +593***6015
   */
  destinatarioCensurado: (telefono) => {
    if (!telefono || telefono === 'no-disponible') return 'No especificado';
    
    // Si es un teléfono con formato WhatsApp
    if (telefono.includes('whatsapp:')) {
      telefono = telefono.replace('whatsapp:', '');
    }
    
    // Censurar teléfono ecuatoriano: +593999266015 → +593***6015
    if (telefono.match(/^\+593\d{9}$/)) {
      return telefono.replace(/(\+593)\d{6}(\d{3})/, '$1***$2');
    }
    
    // Censurar teléfono sin código país: 0999266015 → 099***6015
    if (telefono.match(/^0\d{9}$/)) {
      return telefono.replace(/(\d{3})\d{6}(\d{3})/, '$1***$2');
    }
    
    // Para otros formatos, censurar la parte media
    if (telefono.length > 6) {
      const inicio = telefono.substring(0, 3);
      const final = telefono.substring(telefono.length - 3);
      return `${inicio}***${final}`;
    }
    
    return telefono;
  },

  /**
   * Obtener texto legible del estado de notificación
   */
  estadoTexto: (estado) => {
    const estados = {
      'enviado': 'Enviado',
      'fallido': 'Error',
      'error': 'Error',
      'pendiente': 'Pendiente',
      'simulado': 'Simulado'
    };
    return estados[estado] || estado;
  },

  /**
   * Obtener clase CSS para badge de estado
   */
  estadoBadgeClass: (estado) => {
    const clases = {
      'enviado': 'bg-success',
      'fallido': 'bg-danger',
      'error': 'bg-danger',
      'pendiente': 'bg-warning text-dark',
      'simulado': 'bg-info'
    };
    return clases[estado] || 'bg-secondary';
  },

  /**
   * Calcular tiempo transcurrido desde una fecha
   */
  tiempoTranscurrido: (fecha) => {
    if (!fecha) return 'No disponible';
    
    const ahora = new Date();
    const fechaEvento = new Date(fecha);
    const diffMs = ahora - fechaEvento;
    const diffMinutos = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutos < 1) return 'Hace menos de 1 minuto';
    if (diffMinutos < 60) return `Hace ${diffMinutos} minutos`;
    
    const diffHoras = Math.floor(diffMinutos / 60);
    if (diffHoras < 24) return `Hace ${diffHoras} horas`;
    
    const diffDias = Math.floor(diffHoras / 24);
    return `Hace ${diffDias} días`;
  },

  /**
   * Formatear código de documento de forma compacta
   */
  formatearCodigoCompacto: (codigo) => {
    if (!codigo) return 'N/A';
    
    // Si es muy largo, mostrar solo los últimos 8 caracteres
    if (codigo.length > 12) {
      return '...' + codigo.slice(-8);
    }
    
    return codigo;
  },

  /**
   * Obtener icono para tipo de documento
   */
  iconoTipoDocumento: (tipo) => {
    const iconos = {
      'Escritura': 'fas fa-file-contract',
      'Poder': 'fas fa-handshake',
      'Certificado': 'fas fa-certificate',
      'Acta': 'fas fa-file-signature',
      'Minuta': 'fas fa-file-alt',
      'Testimonio': 'fas fa-file-invoice'
    };
    return iconos[tipo] || 'fas fa-file';
  },

  /**
   * Obtener código de verificación desde metadatos o generar uno visual
   */
  obtenerCodigoVerificacion: (notificacion) => {
    // Intentar obtener desde metadatos
    if (notificacion.metadatos && notificacion.metadatos.codigoVerificacion) {
      return notificacion.metadatos.codigoVerificacion;
    }
    
    // Intentar extraer del mensaje enviado
    if (notificacion.mensajeEnviado) {
      const match = notificacion.mensajeEnviado.match(/código[:\s]*(\d{4})/i);
      if (match) {
        return match[1];
      }
    }
    
    // Generar código visual basado en ID (para compatibilidad)
    if (notificacion.id) {
      return String(notificacion.id).padStart(4, '0');
    }
    
    return '****';
  },

  /**
   * Determinar si se puede reenviar una notificación
   */
  puedeReenviar: (estado, tipoEvento) => {
    return (estado === 'fallido' || estado === 'error') && 
           (tipoEvento === 'documento_listo' || tipoEvento === 'entrega_confirmada');
  },
  
  // ============== HELPERS PARA INTERFAZ SIMPLIFICADA ==============
  
  /**
   * Formatear fecha corta para tablas (DD/MM/YY)
   */
  formatDateShort: (date) => {
    const fechaCompleta = formatearFecha(date);
    if (!fechaCompleta || fechaCompleta === 'Sin fecha') return 'Sin fecha';
    
    // Convertir DD/MM/YYYY a DD/MM/YY
    const partes = fechaCompleta.split('/');
    if (partes.length === 3) {
      return `${partes[0]}/${partes[1]}/${partes[2].substr(-2)}`;
    }
    
    return fechaCompleta;
  },
  
  /**
   * Estado de pago simplificado para interfaz
   */
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
  
  /**
   * Abreviación de tipo de documento
   */
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
  
  /**
   * Clase CSS para tipo de documento
   */
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
   * Obtener icono para estado de documento - ACTUALIZADO v3.0
   */
  getEstadoIcono: (estado) => {
    const iconos = {
      'en_proceso': '<i class="fas fa-hourglass-half"></i>',
      'listo_para_entrega': '<i class="fas fa-clock"></i>',
      'entregado': '<i class="fas fa-check-circle"></i>',
      'nota_credito': '<i class="fas fa-file-alt"></i>',
      'cancelado': '<i class="fas fa-times-circle"></i>'
    };
    return iconos[estado] || '<i class="fas fa-question-circle"></i>';
  },

  /**
   * Obtener icono para estado de pago - ACTUALIZADO v3.1
   */
  getPagoIcono: (estadoPago) => {
    const iconos = {
      'pendiente': '<i class="fas fa-times-circle status-icon"></i>',
      'pagado_completo': '<i class="fas fa-dollar-sign status-icon"></i>',
      'pagado_con_retencion': '<i class="fas fa-check-circle status-icon"></i>',
      'pago_parcial': '<i class="fas fa-clock status-icon"></i>'
    };
    return iconos[estadoPago] || '<i class="fas fa-question-circle status-icon"></i>';
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
  },

  // ===== HELPERS UNIVERSALES ADICIONALES PARA EXPORTACIÓN =====
  
  /**
   * Formatear valor monetario con símbolo
   */
  formatDineroCompleto: (valor) => {
    if (!valor || isNaN(parseFloat(valor))) return '$0.00';
    return `$${parseFloat(valor).toFixed(2)}`;
  },

  /**
   * Generar título tooltip para pagos
   */
  getTituloPago: (estadoPago) => {
    const titulos = {
      'pendiente': 'Pago pendiente',
      'pagado_completo': 'Pago completado sin retenciones',
      'pagado_con_retencion': 'Pago completado con retenciones aplicadas',
      'pago_parcial': 'Pago parcial recibido'
    };
    return titulos[estadoPago] || 'Estado de pago desconocido';
  },

  /**
   * Generar título tooltip universal
   */
  getTituloEstado: (estado) => {
    const titulos = {
      'en_proceso': 'Documento en proceso de elaboración',
      'listo_para_entrega': 'Documento listo para ser entregado',
      'entregado': 'Documento ya fue entregado al cliente',
      'nota_credito': 'Documento convertido en nota de crédito',
      'cancelado': 'Documento cancelado'
    };
    return titulos[estado] || 'Estado desconocido';
  },

  /**
   * Generar clases CSS para estado de documento
   */
  getEstadoClase: (estado) => {
    const clases = {
      'en_proceso': 'estado-en_proceso',
      'listo_para_entrega': 'estado-listo_para_entrega',
      'entregado': 'estado-entregado',
      'nota_credito': 'estado-nota_credito',
      'cancelado': 'estado-cancelado'
    };
    return clases[estado] || 'estado-desconocido';
  },

  /**
   * Generar clases CSS para estado de pago - MEJORADO PARA CÍRCULOS
   */
  getPagoClase: (estadoPago) => {
    const clases = {
      'pendiente': 'pago-pendiente',
      'pagado_completo': 'pago-pagado_completo',
      'pagado_con_retencion': 'pago-pagado_con_retencion',
      'pago_parcial': 'pago-pago_parcial'
    };
    return clases[estadoPago] || 'pago-desconocido';
  },

  /**
   * Helper unless - Negación lógica
   */
  unless: (conditional, options) => {
    if (!conditional) {
      return options.fn(this);
    } else {
      return options.inverse(this);
    }
  },

  /**
   * ✨ NUEVO: Obtener color del círculo de pago
   */
  getCirculoPagoColor: (estadoPago) => {
    const colores = {
      'pendiente': '#dc3545',           // Rojo
      'pagado_completo': '#28a745',     // Verde
      'pagado_con_retencion': '#20c997', // Verde claro
      'pago_parcial': '#ffc107'         // Amarillo
    };
    return colores[estadoPago] || '#6c757d'; // Gris por defecto
  },

  /**
   * ✨ NUEVO: Verificar si el pago está completo
   */
  esPagoCompleto: (estadoPago) => {
    return estadoPago === 'pagado_completo' || estadoPago === 'pagado_con_retencion';
  },

  /**
   * ✨ NUEVO: Verificar si un documento es ajeno al usuario actual (para vista archivo)
   */
  esDocumentoAjeno: (usuario, documento) => {
    if (!usuario || !documento) return false;
    
    // Si el usuario es admin, ningún documento es ajeno
    if (usuario.rol === 'admin') return false;
    
    // Si el documento no tiene matrizador asignado, no es ajeno
    if (!documento.idMatrizador) return false;
    
    // Es ajeno si el documento pertenece a otro matrizador
    return documento.idMatrizador !== usuario.id;
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

// ===== HELPERS UNIVERSALES PARA SISTEMA DE TABLAS =====
// 🎯 Sistema Universal v1.0 - Helpers optimizados y reutilizables

/**
 * Formatear fecha corta para tablas (DD/MM/YY)
 * UNIVERSAL: Usado en todas las tablas del sistema
 */
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

/**
 * Obtener letra del tipo de documento
 * UNIVERSAL: Funciona con cualquier código de barras del sistema
 */
Handlebars.registerHelper('getTipoLetra', function(codigoBarras) {
  if (!codigoBarras) return '';
  const matches = codigoBarras.match(/([A-Z])(\d+)$/);
  return matches ? matches[1] : '';
});

/**
 * Generar iniciales de nombres - VERSIÓN MEJORADA
 * UNIVERSAL: Maneja todos los formatos de nombres del sistema
 */
Handlebars.registerHelper('getIniciales', function(nombreCompleto) {
  if (!nombreCompleto) return 'NN';
  
  const palabras = nombreCompleto.trim().split(/\s+/).filter(p => p.length > 0);
  
  if (palabras.length === 0) return 'NN';
  if (palabras.length === 1) {
    // Una palabra: primeras 2-3 letras
    return palabras[0].substring(0, 3).toUpperCase();
  }
  if (palabras.length === 2) {
    // Dos palabras: primera letra de cada una
    return `${palabras[0].charAt(0)}${palabras[1].charAt(0)}`.toUpperCase();
  }
  
  // Tres o más palabras: primera letra de las primeras 3
  return palabras
    .slice(0, 3)
    .map(palabra => palabra.charAt(0))
    .join('')
    .toUpperCase();
});

/**
 * Iconos universales para estados de documentos - ACTUALIZADO v3.0
 * UNIVERSAL: Consistente en todos los roles con iconos FontAwesome
 */
Handlebars.registerHelper('getEstadoIcono', function(estado) {
  const iconos = {
    'en_proceso': '<i class="fas fa-hourglass-half status-icon"></i>',
    'listo_para_entrega': '<i class="fas fa-clock status-icon"></i>',
    'entregado': '<i class="fas fa-check-circle status-icon"></i>',
    'nota_credito': '<i class="fas fa-file-alt status-icon"></i>',
    'cancelado': '<i class="fas fa-times-circle status-icon"></i>',
    'eliminado': '<i class="fas fa-trash status-icon"></i>'
  };
  return new Handlebars.SafeString(iconos[estado] || '<i class="fas fa-question-circle status-icon"></i>');
});

/**
 * Iconos universales para estados de pago - ACTUALIZADO v3.1
 * UNIVERSAL: Consistente en todos los roles con iconos FontAwesome
 */
Handlebars.registerHelper('getPagoIcono', function(estadoPago) {
  const iconos = {
    'pendiente': '<i class="fas fa-times-circle status-icon"></i>',
    'pagado_completo': '<i class="fas fa-dollar-sign status-icon"></i>',
    'pagado_con_retencion': '<i class="fas fa-check-circle status-icon"></i>',
    'pago_parcial': '<i class="fas fa-clock status-icon"></i>',
    'sin_factura': '<i class="fas fa-question-circle status-icon"></i>'
  };
  return new Handlebars.SafeString(iconos[estadoPago] || '<i class="fas fa-question-circle status-icon"></i>');
});

/**
 * Capitalizar primera letra
 * UNIVERSAL: Usado en toda la interfaz
 */
Handlebars.registerHelper('ucfirst', function(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
});

/**
 * Truncar texto - VERSIÓN MEJORADA
 * UNIVERSAL: Truncado inteligente para todas las tablas
 */
Handlebars.registerHelper('truncate', function(texto, limite = 50) {
  if (!texto) return '';
  if (typeof texto !== 'string') texto = String(texto);
  
  if (texto.length <= limite) return texto;
  
  // Truncar en espacio si es posible
  const truncado = texto.substring(0, limite);
  const ultimoEspacio = truncado.lastIndexOf(' ');
  
  if (ultimoEspacio > limite * 0.7) {
    return truncado.substring(0, ultimoEspacio) + '...';
  }
  
  return truncado + '...';
});

/**
 * ===== NUEVOS HELPERS UNIVERSALES =====
 */

/**
 * Generar clases CSS para estado de documento
 */
Handlebars.registerHelper('getEstadoClase', function(estado) {
  const clases = {
    'en_proceso': 'estado-en_proceso',
    'listo_para_entrega': 'estado-listo_para_entrega',
    'entregado': 'estado-entregado',
    'nota_credito': 'estado-nota_credito',
    'cancelado': 'estado-cancelado'
  };
  return clases[estado] || 'estado-desconocido';
});

/**
 * Generar clases CSS para estado de pago
 */
Handlebars.registerHelper('getPagoClase', function(estadoPago) {
  const clases = {
    'pendiente': 'pago-pendiente',
    'pagado_completo': 'pago-pagado_completo',
    'pagado_con_retencion': 'pago-pagado_con_retencion',
    'pago_parcial': 'pago-pago_parcial'
  };
  return clases[estadoPago] || 'pago-desconocido';
});

/**
 * Formatear código universal con tipo
 */
Handlebars.registerHelper('formatCodigoUniversal', function(codigoBarras) {
  if (!codigoBarras) return '';
  
  const tipo = this.getTipoLetra(codigoBarras);
  return {
    codigo: codigoBarras,
    tipo: tipo,
    clase: `tipo-${tipo}`
  };
});

/**
 * Generar título tooltip universal
 */
Handlebars.registerHelper('getTituloEstado', function(estado) {
  const titulos = {
    'en_proceso': 'Documento en proceso de elaboración',
    'listo_para_entrega': 'Documento listo para ser entregado',
    'entregado': 'Documento ya fue entregado al cliente',
    'nota_credito': 'Documento convertido en nota de crédito',
    'cancelado': 'Documento cancelado'
  };
  return titulos[estado] || 'Estado desconocido';
});

/**
 * Generar título tooltip para pagos
 */
Handlebars.registerHelper('getTituloPago', function(estadoPago) {
  const titulos = {
    'pendiente': 'Pago pendiente',
    'pagado_completo': 'Pago completado sin retenciones',
    'pagado_con_retencion': 'Pago completado con retenciones aplicadas',
    'pago_parcial': 'Pago parcial recibido'
  };
  return titulos[estadoPago] || 'Estado de pago desconocido';
});

/**
 * Verificar si un valor representa dinero válido
 */
Handlebars.registerHelper('esValorMonetario', function(valor) {
  return valor && !isNaN(parseFloat(valor)) && parseFloat(valor) > 0;
});

/**
 * Formatear valor monetario con símbolo - HELPER UNIVERSAL
 */
Handlebars.registerHelper('formatDineroCompleto', function(valor) {
  if (!valor || isNaN(parseFloat(valor))) return '$0.00';
  return `$${parseFloat(valor).toFixed(2)}`;
});

/**
 * Determinar prioridad visual del documento
 */
Handlebars.registerHelper('getPrioridadDocumento', function(estado, diasVencimiento) {
  if (estado === 'entregado') return 'baja';
  if (diasVencimiento && diasVencimiento > 7) return 'alta';
  if (diasVencimiento && diasVencimiento > 3) return 'media';
  return 'normal';
});

/**
 * Helper para debugging en desarrollo
 */
Handlebars.registerHelper('debugValue', function(value, label = 'Debug') {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Handlebars Debug] ${label}:`, value);
  }
  return '';
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

// CORRECCIÓN: Registrar helpers de fecha que faltaban
Handlebars.registerHelper('formatDate', function(date) {
    const moment = require('moment');
    moment.locale('es');
    const { formatearFecha } = require('./fechaUtils');
    return formatearFecha(date);
});

Handlebars.registerHelper('formatDateTime', function(date) {
    const moment = require('moment');
    moment.locale('es');
    if (!date) return 'No registrada';
    return moment(date).format('DD/MM/YYYY HH:mm');
});

// Helper unless para negación lógica
Handlebars.registerHelper('unless', function(conditional, options) {
  if (!conditional) {
    return options.fn(this);
  } else {
    return options.inverse(this);
  }
});

// Registrar el helper esDocumentoAjeno
Handlebars.registerHelper('esDocumentoAjeno', function(usuario, documento) {
  if (!usuario || !documento) return false;
  
  // Si el usuario es admin, ningún documento es ajeno
  if (usuario.rol === 'admin') return false;
  
  // Si el documento no tiene matrizador asignado, no es ajeno
  if (!documento.idMatrizador) return false;
  
  // Es ajeno si el documento pertenece a otro matrizador
  return documento.idMatrizador !== usuario.id;
});

// ============== REGISTRAR HELPERS PARA INTERFAZ SIMPLIFICADA ==============

/**
 * Formatear fecha corta para tablas (DD/MM/YY)
 */
Handlebars.registerHelper('formatDateShort', function(date) {
  const { formatearFecha } = require('./fechaUtils');
  const fechaCompleta = formatearFecha(date);
  if (!fechaCompleta || fechaCompleta === 'Sin fecha') return 'Sin fecha';
  
  // Convertir DD/MM/YYYY a DD/MM/YY
  const partes = fechaCompleta.split('/');
  if (partes.length === 3) {
    return `${partes[0]}/${partes[1]}/${partes[2].substr(-2)}`;
  }
  
  return fechaCompleta;
});

/**
 * Estado de pago simplificado para interfaz
 */
Handlebars.registerHelper('estadoPagoSimple', function(estado) {
  const estados = {
    'pagado_completo': 'Pagado',
    'pendiente': 'Pendiente',
    'pagado_con_retencion': 'Con Ret.',
    'pago_parcial': 'Parcial',
    'sin_factura': 'S/F'
  };
  return estados[estado] || estado;
});

/**
 * Abreviación de tipo de documento
 */
Handlebars.registerHelper('tipoDocumentoAbrev', function(tipo) {
  const tipos = {
    'Diligencias': 'D',
    'Certificaciones': 'C',
    'Copias': 'CP',
    'Autenticaciones': 'A',
    'Otros': 'O'
  };
  return tipos[tipo] || tipo.charAt(0).toUpperCase();
});

/**
 * Clase CSS para tipo de documento
 */
Handlebars.registerHelper('tipoDocumentoClass', function(tipo) {
  const clases = {
    'Diligencias': 'tipo-D',
    'Certificaciones': 'tipo-C',
    'Copias': 'tipo-P',
    'Autenticaciones': 'tipo-A',
    'Otros': 'tipo-O'
  };
  return clases[tipo] || 'tipo-O';
});

/**
 * Formatear nombre de matrizador para mostrar en tablas
 */
Handlebars.registerHelper('formatMatrizadorNombre', function(matrizador) {
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
});

/**
 * Helper para verificar si un evento es de entrega grupal
 */
Handlebars.registerHelper('esEntregaGrupal', function(tipoEvento) {
  return tipoEvento === 'entrega_grupal';
});

/**
 * Helper para capitalizar texto
 */
Handlebars.registerHelper('capitalizar', function(texto) {
  if (!texto) return '';
  return texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase();
});

/**
 * Helper para convertir a string (usado en comparaciones)
 */
Handlebars.registerHelper('toString', function(value) {
  return String(value);
});

/**
 * Helper para generar items de paginación
 */
Handlebars.registerHelper('getPaginationItems', function(currentPage, totalPages) {
  const items = [];
  const maxVisible = 5;
  
  if (totalPages <= maxVisible) {
    // Si hay pocas páginas, mostrar todas
    for (let i = 1; i <= totalPages; i++) {
      items.push({
        pageNumber: i,
        isActive: i === currentPage,
        isEllipsis: false
      });
    }
  } else {
    // Lógica compleja para páginas con elipsis
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, currentPage + 2);
    
    if (start > 1) {
      items.push({ pageNumber: 1, isActive: false, isEllipsis: false });
      if (start > 2) {
        items.push({ isEllipsis: true });
      }
    }
    
    for (let i = start; i <= end; i++) {
      items.push({
        pageNumber: i,
        isActive: i === currentPage,
        isEllipsis: false
      });
    }
    
    if (end < totalPages) {
      if (end < totalPages - 1) {
        items.push({ isEllipsis: true });
      }
      items.push({ pageNumber: totalPages, isActive: false, isEllipsis: false });
    }
  }
  
  return items;
});

/**
 * Helper para construir URLs de paginación
 */
Handlebars.registerHelper('buildPaginationUrl', function(role, page, filtros) {
  const params = new URLSearchParams();
  
  // Agregar filtros existentes
  if (filtros) {
    Object.keys(filtros).forEach(key => {
      if (filtros[key] && key !== 'page') {
        params.append(key, filtros[key]);
      }
    });
  }
  
  // Agregar número de página
  params.append('page', page);
  
  return `/${role}/notificaciones/historial?${params.toString()}`;
});

/**
 * Helpers matemáticos para paginación
 */
Handlebars.registerHelper('add', function(a, b) {
  return parseInt(a) + parseInt(b);
});

Handlebars.registerHelper('subtract', function(a, b) {
  return parseInt(a) - parseInt(b);
});

Handlebars.registerHelper('gt', function(a, b) {
  return parseInt(a) > parseInt(b);
});

Handlebars.registerHelper('lt', function(a, b) {
  return parseInt(a) < parseInt(b);
});

console.log('✅ Helpers de notificaciones registrados: esEntregaGrupal, getPaginationItems, buildPaginationUrl, matemáticos');

// CORRECCIÓN CRÍTICA: Cerrar el objeto helpers y registrar globalmente
};

// REGISTRAR TODOS LOS HELPERS GLOBALMENTE EN HANDLEBARS
Object.keys(helpers).forEach(helperName => {
  Handlebars.registerHelper(helperName, helpers[helperName]);
});

console.log('✅ Helpers registrados globalmente en Handlebars:', Object.keys(helpers).length, 'helpers');

// EXPORTAR HELPERS PARA USO EN EXPRESS-HANDLEBARS
module.exports = helpers;