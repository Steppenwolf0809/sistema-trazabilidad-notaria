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
  
  /**
   * Operador OR para plantillas
   */
  or: (a, b) => {
    return a || b;
  },
  
  /**
   * Operador AND para plantillas
   */
  and: (a, b) => {
    return a && b;
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
  }
}; 