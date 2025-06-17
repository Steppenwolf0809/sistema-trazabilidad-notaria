/**
 * Helpers personalizados para las plantillas Handlebars
 * SISTEMATIZADOS: Solo helpers realmente necesarios y optimizados
 */

const moment = require('moment');
moment.locale('es'); // Configurar moment en español

module.exports = {
  // ============== HELPERS DE FECHA Y TIEMPO ==============
  
  /**
   * Formatear fecha completa con hora
   */
  formatDateTime: (date) => {
    if (!date) return 'No registrada';
    return moment(date).format('DD/MM/YYYY HH:mm');
  },
  
  /**
   * Formatear solo fecha
   */
  formatDate: (date) => {
    if (!date) return 'No registrada';
    return moment(date).format('DD/MM/YYYY');
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
   */
  formatTimestamp: (timestamp) => {
    if (!timestamp) return 'No registrado';
    return moment(timestamp).utcOffset(-5).format('DD/MM/YYYY HH:mm:ss');
  },
  
  // ============== HELPERS DE FORMATO MONETARIO ==============
  
  /**
   * Formatear valores monetarios
   */
  formatMoney: (value) => {
    if (value == null || isNaN(value)) return '0.00';
    return parseFloat(value).toFixed(2);
  },
  
  /**
   * Formatear valores monetarios con símbolo $
   */
  formatCurrency: (value) => {
    if (value == null || isNaN(value)) return '$0.00';
    return '$' + parseFloat(value).toFixed(2);
  },
  
  // ============== HELPERS DE COMPARACIÓN ==============
  
  /**
   * Comparar dos valores para igualdad
   */
  eq: (a, b) => {
    return a === b;
  },
  
  /**
   * Comparar si un valor es mayor que otro
   */
  gt: (a, b) => {
    return a > b;
  },
  
  /**
   * Comparar si un valor es menor que otro
   */
  lt: (a, b) => {
    return a < b;
  },
  
  /**
   * Comparar si un valor es mayor o igual que otro
   */
  gte: (a, b) => {
    return a >= b;
  },
  
  /**
   * Comparar si un valor es menor o igual que otro
   */
  lte: (a, b) => {
    return a <= b;
  },
  
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
   * Suma de dos números
   */
  add: (a, b) => {
    return (parseInt(a) || 0) + (parseInt(b) || 0);
  },
  
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
   * Sumar array de números
   */
  sum: (arr) => {
    if (!Array.isArray(arr)) return 0;
    return arr.reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
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
  getDirectionIcon: (value) => {
    if (value > 0) return 'fas fa-arrow-up';
    if (value < 0) return 'fas fa-arrow-down';
    return 'fas fa-minus';
  },
  
  /**
   * Obtener color según dirección del cambio
   */
  getChangeColor: (value) => {
    if (value > 0) return 'success';
    if (value < 0) return 'danger';
    return 'secondary';
  },
  
  /**
   * Formatear valor según tipo
   */
  formatByType: (value, type) => {
    if (value == null) return '0';
    
    switch (type) {
      case 'moneda':
        return `$${parseFloat(value).toFixed(2)}`;
      case 'porcentaje':
        return `${parseFloat(value).toFixed(1)}%`;
      case 'numero':
        return String(Math.round(parseFloat(value)));
      default:
        return String(value);
    }
  },
  
  /**
   * Verificar si un cambio es significativo (>= 10%)
   */
  isSignificantChange: (percentage) => {
    return Math.abs(parseFloat(percentage)) >= 10;
  },
  
  /**
   * Operador NOT lógico
   */
  not: (a) => {
    return !a;
  },
  
  // ============== HELPERS DE FORMATO ESPECÍFICOS ==============
  
  /**
   * Formatear código de barras para mostrar
   */
  formatCodigoBarras: (codigo) => {
    if (!codigo) return 'Sin código';
    // Insertar guiones cada 4 caracteres para legibilidad
    return codigo.replace(/(.{4})/g, '$1-').slice(0, -1);
  },
  
  /**
   * Formatear teléfono
   */
  formatTelefono: (telefono) => {
    if (!telefono) return 'No registrado';
    // Formato: (099) 123-4567
    const cleaned = telefono.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return telefono;
  },
  
  /**
   * Formatear cédula
   */
  formatCedula: (cedula) => {
    if (!cedula) return 'No registrada';
    const cleaned = cedula.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 9)}-${cleaned.slice(9)}`;
    }
    return cedula;
  },
  
  // ============== HELPERS DE ICONOS ==============
  
  /**
   * Obtener icono FontAwesome según tipo de documento
   */
  getTipoDocumentoIcon: (tipo) => {
    const iconos = {
      'escritura': 'fas fa-file-contract',
      'poder': 'fas fa-handshake',
      'testamento': 'fas fa-scroll',
      'compraventa': 'fas fa-exchange-alt',
      'hipoteca': 'fas fa-home',
      'protesto': 'fas fa-exclamation-triangle'
    };
    return iconos[tipo?.toLowerCase()] || 'fas fa-file-alt';
  },
  
  /**
   * Obtener icono para estado de pago
   */
  getEstadoPagoIcon: (estado) => {
    const iconos = {
      'pagado': 'fas fa-check-circle text-success',
      'pendiente': 'fas fa-clock text-warning'
    };
    return iconos[estado] || 'fas fa-question-circle text-muted';
  },
  
  // Helper para formatear fechas
  formatDate: function(date) {
    if (!date) return 'N/A';
    return moment(date).format('DD/MM/YYYY HH:mm');
  },
  
  // Helper para formatear fechas sin hora
  formatDateOnly: function(date) {
    if (!date) return 'N/A';
    return moment(date).format('DD/MM/YYYY');
  },
  
  // Helper para formatear tiempo relativo
  formatTimeAgo: function(date) {
    if (!date) return 'N/A';
    return moment(date).fromNow();
  },
  
  // Helper para calcular días desde una fecha
  daysSince: function(date) {
    if (!date) return 0;
    return moment().diff(moment(date), 'days');
  },
  
  // Helper para truncar texto
  truncate: function(str, length) {
    if (!str || typeof str !== 'string') return '';
    if (str.length <= length) return str;
    return str.substring(0, length) + '...';
  },
  
  // Helper para substring
  substring: function(str, start, end) {
    if (!str || typeof str !== 'string') return '';
    return str.substring(start, end || str.length);
  },
  
  // Helper para formatear números como moneda
  currency: function(amount) {
    if (!amount) return '$0.00';
    return '$' + parseFloat(amount).toFixed(2);
  },
  
  // Helper para pluralizar
  pluralize: function(count, singular, plural) {
    return count === 1 ? singular : plural;
  },
  
  // Helper para obtener el primer elemento de un array
  first: function(array) {
    return Array.isArray(array) && array.length > 0 ? array[0] : null;
  },
  
  // Helper para obtener el último elemento de un array
  last: function(array) {
    return Array.isArray(array) && array.length > 0 ? array[array.length - 1] : null;
  },
  
  // Helper para verificar si es el primer elemento en un loop
  isFirst: function(index) {
    return index === 0;
  },
  
  // Helper para verificar si es el último elemento en un loop
  isLast: function(index, array) {
    return index === array.length - 1;
  },
  
  // Helper para formatear porcentajes
  percentage: function(value, total) {
    if (!total || total === 0) return '0%';
    return Math.round((value / total) * 100) + '%';
  },
  
  // Helper para capitalizar primera letra
  capitalize: function(str) {
    if (!str || typeof str !== 'string') return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  },
  
  // Helper para convertir a mayúsculas
  uppercase: function(str) {
    if (!str || typeof str !== 'string') return '';
    return str.toUpperCase();
  },
  
  // Helper para convertir a minúsculas
  lowercase: function(str) {
    if (!str || typeof str !== 'string') return '';
    return str.toLowerCase();
  },
  
  // ============== HELPERS ESPECÍFICOS DASHBOARD EJECUTIVO ==============
  
  /**
   * Formatear fecha con timezone Ecuador (crítico para auditoría)
   */
  formatDateEcuador: function(date) {
    if (!date) return 'N/A';
    return moment(date).utcOffset(-5).format('DD/MM/YYYY HH:mm:ss');
  },
  
  /**
   * Formatear solo fecha con timezone Ecuador
   */
  formatDateOnlyEcuador: function(date) {
    if (!date) return 'N/A';
    return moment(date).utcOffset(-5).format('DD/MM/YYYY');
  },
  
  /**
   * Obtener clase CSS para métricas según valor
   */
  getMetricClass: function(value, type) {
    if (type === 'money') {
      if (value > 10000) return 'text-success';
      if (value > 5000) return 'text-info';
      if (value > 1000) return 'text-warning';
      return 'text-danger';
    }
    if (type === 'count') {
      if (value > 50) return 'text-success';
      if (value > 20) return 'text-info';
      if (value > 10) return 'text-warning';
      return 'text-danger';
    }
    return 'text-primary';
  },
  
  /**
   * Formatear números grandes con K, M
   */
  formatLargeNumber: function(num) {
    if (!num || isNaN(num)) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  },
  
  /**
   * Obtener icono para tendencia
   */
  getTrendIcon: function(current, previous) {
    if (!previous || previous === 0) return 'fas fa-minus text-muted';
    if (current > previous) return 'fas fa-arrow-up text-success';
    if (current < previous) return 'fas fa-arrow-down text-danger';
    return 'fas fa-minus text-muted';
  },
  
  /**
   * Calcular porcentaje de cambio
   */
  calculateChange: function(current, previous) {
    if (!previous || previous === 0) return '0';
    const change = ((current - previous) / previous) * 100;
    return Math.abs(change).toFixed(1);
  },
  
  /**
   * Obtener clase CSS para prioridad
   */
  getPriorityClass: function(priority) {
    const classes = {
      'alta': 'text-danger',
      'media': 'text-warning',
      'baja': 'text-success',
      'critica': 'text-danger fw-bold'
    };
    return classes[priority?.toLowerCase()] || 'text-muted';
  },
  
  /**
   * Obtener badge para estado de documento
   */
  getDocumentStatusBadge: function(estado) {
    const badges = {
      'en_proceso': 'badge bg-warning',
      'listo_para_entrega': 'badge bg-success',
      'entregado': 'badge bg-info',
      'cancelado': 'badge bg-secondary',
      'eliminado': 'badge bg-danger',
      'pendiente': 'badge bg-warning',
      'pagado': 'badge bg-success'
    };
    return badges[estado] || 'badge bg-secondary';
  },
  
  /**
   * Formatear tiempo de actividad reciente
   */
  formatActivityTime: function(date) {
    if (!date) return 'Nunca';
    const now = moment();
    const activityDate = moment(date);
    const diffMinutes = now.diff(activityDate, 'minutes');
    
    if (diffMinutes < 1) return 'Ahora mismo';
    if (diffMinutes < 60) return `Hace ${diffMinutes} min`;
    if (diffMinutes < 1440) return `Hace ${Math.floor(diffMinutes / 60)} h`;
    return activityDate.format('DD/MM HH:mm');
  },
  
  /**
   * Obtener iniciales para avatar
   */
  getInitials: function(name) {
    if (!name) return '??';
    const words = name.split(' ');
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  },
  
  /**
   * Obtener color de avatar basado en nombre
   */
  getAvatarColor: function(name) {
    if (!name) return 'bg-secondary';
    const colors = ['bg-primary', 'bg-success', 'bg-info', 'bg-warning', 'bg-danger'];
    const index = name.length % colors.length;
    return colors[index];
  },
  
  /**
   * Formatear duración en días/horas/minutos
   */
  formatDuration: function(minutes) {
    if (!minutes || minutes < 1) return '0 min';
    if (minutes < 60) return `${Math.round(minutes)} min`;
    if (minutes < 1440) return `${Math.round(minutes / 60)} h`;
    return `${Math.round(minutes / 1440)} días`;
  },
  
  /**
   * Verificar si una fecha es hoy
   */
  isToday: function(date) {
    if (!date) return false;
    return moment(date).isSame(moment(), 'day');
  },
  
  /**
   * Verificar si una fecha es esta semana
   */
  isThisWeek: function(date) {
    if (!date) return false;
    return moment(date).isSame(moment(), 'week');
  },
  
  /**
   * Obtener clase CSS para urgencia de documento
   */
  getUrgencyClass: function(fechaCreacion, estado) {
    if (estado === 'entregado' || estado === 'cancelado') return 'text-muted';
    
    const dias = moment().diff(moment(fechaCreacion), 'days');
    if (dias > 30) return 'text-danger fw-bold';
    if (dias > 15) return 'text-warning';
    if (dias > 7) return 'text-info';
    return 'text-success';
  },
  
  /**
   * Formatear período de tiempo
   */
  formatPeriod: function(fechaInicio, fechaFin) {
    if (!fechaInicio || !fechaFin) return 'Período no definido';
    const inicio = moment(fechaInicio).format('DD/MM/YYYY');
    const fin = moment(fechaFin).format('DD/MM/YYYY');
    return `${inicio} - ${fin}`;
  },
  
  // ============== NUEVOS HELPERS PARA ESTADO DE PAGO ==============
  
  /**
   * Obtener clase CSS para badge de estado de pago (CRÍTICO PARA CORRECCIÓN)
   */
  estadoPagoClass: (estadoPago) => {
    switch (estadoPago) {
      case 'pendiente':
      case 'sin_pagar':
        return 'bg-danger text-white';
      case 'pago_parcial':
        return 'bg-warning text-dark';
      case 'pagado_completo':
      case 'pagado_con_retencion':
        return 'bg-success text-white';
      default:
        return 'bg-secondary text-white';
    }
  },

  /**
   * Obtener texto legible para estado de pago (CRÍTICO PARA CORRECCIÓN)
   */
  estadoPagoTexto: (estadoPago) => {
    switch (estadoPago) {
      case 'pendiente':
      case 'sin_pagar':
        return 'Pendiente';
      case 'pago_parcial':
        return 'Pago Parcial';
      case 'pagado_completo':
        return 'Pagado Completo';
      case 'pagado_con_retencion':
        return 'Pagado con Retención';
      default:
        return 'Desconocido';
    }
  },

  /**
   * Verificar si un documento está pagado completamente
   */
  estaPagadoCompleto: (estadoPago) => {
    return ['pagado_completo', 'pagado_con_retencion'].includes(estadoPago);
  },

  /**
   * Verificar si un documento tiene pago pendiente
   */
  tienePagoPendiente: (estadoPago) => {
    return ['pendiente', 'sin_pagar', 'pago_parcial'].includes(estadoPago);
  },

  // ============== NUEVOS HELPERS PARA FUNCIONALIDAD JERÁRQUICA ==============

  /**
   * Helper para unir arrays con separador
   */
  join: function(array, separator) {
    if (!Array.isArray(array)) return '';
    return array.join(separator || ', ');
  },

  /**
   * Helper para verificar si hay elementos en un array
   */
  hasElements: function(array) {
    return Array.isArray(array) && array.length > 0;
  },

  /**
   * Helper para verificar si un valor está en un array
   */
  includes: function(array, value) {
    if (!Array.isArray(array)) return false;
    return array.includes(value);
  },

  /**
   * Helper para obtener la longitud de un array
   */
  length: function(array) {
    if (!Array.isArray(array)) return 0;
    return array.length;
  },

  /**
   * Helper para formatear números con separadores de miles
   */
  formatNumber: function(number) {
    if (typeof number !== 'number') return '0';
    return number.toLocaleString('es-EC');
  },

  /**
   * Helper para verificar si un documento es principal
   */
  esDocumentoPrincipal: function(documento) {
    return documento && documento.esDocumentoPrincipal === true;
  },

  /**
   * Helper para verificar si un documento es habilitante
   */
  esDocumentoHabilitante: function(documento) {
    return documento && documento.esDocumentoPrincipal === false && documento.documentoPrincipalId;
  },

  /**
   * Helper para obtener el tipo de documento con formato
   */
  tipoDocumentoFormateado: function(tipo) {
    const tipos = {
      'Protocolo': '📜 Protocolo',
      'Diligencias': '📋 Diligencias', 
      'Certificaciones': '🏆 Certificaciones',
      'Arrendamientos': '🏠 Arrendamientos',
      'Otros': '📄 Otros'
    };
    return tipos[tipo] || `📄 ${tipo}`;
  },

  /**
   * Helper para formatear estado de pago con emoji
   */
  estadoPagoConEmoji: function(estado) {
    const estados = {
      'pendiente': '⏳ Pendiente',
      'pago_parcial': '🔄 Parcial',
      'pagado_completo': '✅ Pagado',
      'pagado_con_retencion': '✅ Pagado (Ret.)'
    };
    return estados[estado] || `❓ ${estado}`;
  },

  /**
   * Helper para verificar si un array está vacío
   */
  isEmpty: function(array) {
    return !Array.isArray(array) || array.length === 0;
  },

  /**
   * Helper para verificar si un array no está vacío
   */
  isNotEmpty: function(array) {
    return Array.isArray(array) && array.length > 0;
  },

  /**
   * Helper para obtener el primer elemento de un array
   */
  first: function(array) {
    if (!Array.isArray(array) || array.length === 0) return null;
    return array[0];
  },

  /**
   * Helper para obtener el último elemento de un array
   */
  last: function(array) {
    if (!Array.isArray(array) || array.length === 0) return null;
    return array[array.length - 1];
  },

  /**
   * Helper para sumar valores de un array
   */
  sum: function(array, property) {
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
   * Helper para contar elementos que cumplen una condición
   */
  count: function(array, property, value) {
    if (!Array.isArray(array)) return 0;
    
    if (property && value !== undefined) {
      return array.filter(item => item[property] === value).length;
    } else {
      return array.length;
    }
  },

  /**
   * Helper para filtrar array por propiedad
   */
  filter: function(array, property, value) {
    if (!Array.isArray(array)) return [];
    
    if (property && value !== undefined) {
      return array.filter(item => item[property] === value);
    } else {
      return array;
    }
  },

  /**
   * Helper para mapear array a una propiedad específica
   */
  map: function(array, property) {
    if (!Array.isArray(array)) return [];
    
    if (property) {
      return array.map(item => item[property]);
    } else {
      return array;
    }
  },

  /**
   * Helper para verificar si un número es mayor que otro
   */
  gt: function(a, b) {
    return parseFloat(a) > parseFloat(b);
  },

  /**
   * Helper para verificar si un número es menor que otro
   */
  lt: function(a, b) {
    return parseFloat(a) < parseFloat(b);
  },

  /**
   * Helper para verificar si un número es mayor o igual que otro
   */
  gte: function(a, b) {
    return parseFloat(a) >= parseFloat(b);
  },

  /**
   * Helper para verificar si un número es menor o igual que otro
   */
  lte: function(a, b) {
    return parseFloat(a) <= parseFloat(b);
  },

  /**
   * Helper para verificar igualdad estricta
   */
  eq: function(a, b) {
    return a === b;
  },

  /**
   * Helper para verificar desigualdad
   */
  ne: function(a, b) {
    return a !== b;
  },

  /**
   * Helper para operador NOT lógico
   */
  not: function(value) {
    return !value;
  },

  /**
   * Helper para convertir a JSON string
   */
  json: function(obj) {
    return JSON.stringify(obj);
  },

  /**
   * Helper para formatear fecha relativa (hace X tiempo)
   */
  timeAgo: function(date) {
    if (!date) return '';
    
    const now = new Date();
    const past = new Date(date);
    const diffMs = now - past;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Hace menos de un minuto';
    if (diffMins < 60) return `Hace ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
    if (diffHours < 24) return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    if (diffDays < 30) return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
    
    return moment(date).format('DD/MM/YYYY');
  },

}; 