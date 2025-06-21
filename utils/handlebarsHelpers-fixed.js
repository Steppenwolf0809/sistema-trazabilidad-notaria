/**
 * Helpers personalizados para las plantillas Handlebars
 * CORREGIDO: Estructura limpia con registro global
 */

const moment = require('moment');
moment.locale('es'); // Configurar moment en español

const Handlebars = require('handlebars');
const { formatearFecha } = require('./fechaUtils');

// DEFINIR TODOS LOS HELPERS EN UN OBJETO
const helpers = {
  // ============== HELPERS DE FECHA Y TIEMPO ==============
  
  /**
   * Formatear fecha completa con hora
   */
  formatDateTime: (date) => {
    if (!date) return 'No registrada';
    if (date === 'now') return moment().format('DD/MM/YYYY HH:mm');
    return moment(date).format('DD/MM/YYYY HH:mm');
  },

  /**
   * Formatear solo fecha (sin hora) - CRÍTICO: Este es el helper que faltaba
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
   */
  formatDate: (date) => {
    return formatearFecha(date);
  },
  
  /**
   * Formatear fecha específicamente para Ecuador
   */
  formatDateEcuador: (date) => {
    return formatearFecha(date);
  },
  
  /**
   * Formatear fecha para documentos (formato compacto)
   */
  formatDateDocument: (date) => {
    return formatearFecha(date);
  },
  
  /**
   * Formatear fecha corta para tabla optimizada (DD/MM/YY)
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
   */
  formatTimestamp: (timestamp) => {
    if (!timestamp) return 'No registrado';
    return moment(timestamp).format('DD/MM/YYYY HH:mm:ss');
  },
  
  /**
   * Formatear fecha de factura XML
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
    const args = Array.prototype.slice.call(arguments, 0, -1);
    return args.every(Boolean);
  },
  
  /**
   * Operador lógico OR
   */
  or: function() {
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
   * Helper para verificar si está vacío
   */
  isEmpty: (value) => {
    if (!value) return true;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
  },
  
  /**
   * Helper para verificar si NO está vacío
   */
  isNotEmpty: (value) => {
    return !helpers.isEmpty(value);
  },

  // ============== HELPERS ESPECÍFICOS PARA NOTIFICACIONES ==============
  
  /**
   * Censurar destinatario para privacidad
   */
  destinatarioCensurado: (telefono) => {
    if (!telefono) return 'N/A';
    const tel = telefono.toString();
    if (tel.length <= 4) return tel;
    return tel.substring(0, 4) + '***' + tel.substring(tel.length - 4);
  },
  
  /**
   * Convertir estado a texto legible
   */
  estadoTexto: (estado) => {
    const estados = {
      'enviado': 'Enviado',
      'entregado': 'Entregado',
      'fallido': 'Fallido',
      'pendiente': 'Pendiente'
    };
    return estados[estado] || estado;
  },
  
  /**
   * Clase CSS para badge de estado
   */
  estadoBadgeClass: (estado) => {
    const clases = {
      'enviado': 'badge-success',
      'entregado': 'badge-primary',
      'fallido': 'badge-danger',
      'pendiente': 'badge-warning'
    };
    return clases[estado] || 'badge-secondary';
  },
  
  /**
   * Calcular tiempo transcurrido entre fechas
   */
  tiempoTranscurrido: (fechaInicio, fechaFin) => {
    if (!fechaInicio || !fechaFin) return 'N/A';
    
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);
    const diffMs = fin - inicio;
    
    if (isNaN(diffMs) || diffMs < 0) return 'N/A';
    
    const segundos = Math.floor(diffMs / 1000);
    const minutos = Math.floor(segundos / 60);
    const horas = Math.floor(minutos / 60);
    const dias = Math.floor(horas / 24);
    
    if (dias > 0) return `${dias}d ${horas % 24}h`;
    if (horas > 0) return `${horas}h ${minutos % 60}m`;
    if (minutos > 0) return `${minutos}m`;
    return `${segundos}s`;
  },
  
  /**
   * Formatear código de forma compacta
   */
  formatearCodigoCompacto: (codigo) => {
    if (!codigo) return 'N/A';
    const codigoStr = codigo.toString();
    if (codigoStr.length <= 8) return codigoStr;
    return codigoStr.substring(0, 4) + '...' + codigoStr.substring(codigoStr.length - 4);
  },
  
  /**
   * Icono para tipo de documento
   */
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
  
  /**
   * Obtener código de verificación de metadatos
   */
  obtenerCodigoVerificacion: (metadatos) => {
    if (!metadatos) return 'N/A';
    if (typeof metadatos === 'string') {
      try {
        const parsed = JSON.parse(metadatos);
        return parsed.codigoVerificacion || 'N/A';
      } catch (e) {
        return 'N/A';
      }
    }
    return metadatos.codigoVerificacion || 'N/A';
  },
  
  /**
   * Verificar si se puede reenviar notificación
   */
  puedeReenviar: (fechaEnvio) => {
    if (!fechaEnvio) return false;
    const ahora = new Date();
    const envio = new Date(fechaEnvio);
    const diffMinutos = (ahora - envio) / (1000 * 60);
    return diffMinutos >= 5; // Permitir reenvío después de 5 minutos
  },

  // ============== HELPERS ADICIONALES ==============
  
  /**
   * Formatear fecha corta para tablas
   */
  formatDateShort: (date) => {
    const fechaCompleta = formatearFecha(date);
    if (!fechaCompleta || fechaCompleta === 'Sin fecha') return 'Sin fecha';
    
    const partes = fechaCompleta.split('/');
    if (partes.length === 3) {
      return `${partes[0]}/${partes[1]}/${partes[2].substr(-2)}`;
    }
    
    return fechaCompleta;
  },
  
  /**
   * Estado de pago simplificado
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

  // ============== HELPERS MATEMÁTICOS ==============
  
  /**
   * Longitud de array o string
   */
  length: (value) => {
    if (!value) return 0;
    return value.length || 0;
  },
  
  /**
   * Generar rango de números
   */
  range: (start, end) => {
    const result = [];
    for (let i = start; i <= end; i++) {
      result.push(i);
    }
    return result;
  },
  
  /**
   * Verificar si incluye valor
   */
  includes: (array, value) => {
    if (!Array.isArray(array)) return false;
    return array.includes(value);
  },
  
  /**
   * Sumar valores
   */
  sum: (...args) => {
    const numbers = Array.prototype.slice.call(args, 0, -1);
    return numbers.reduce((sum, num) => sum + (parseFloat(num) || 0), 0);
  },
  
  /**
   * Sumar dos números
   */
  add: (a, b) => {
    return parseInt(a) + parseInt(b);
  },
  
  /**
   * Restar dos números
   */
  subtract: (a, b) => {
    return parseInt(a) - parseInt(b);
  },
  
  /**
   * Convertir a string
   */
  stringifyNumber: (num) => {
    return num ? num.toString() : '';
  },
  
  /**
   * Convertir a JSON
   */
  json: (context) => {
    return JSON.stringify(context);
  }
};

// REGISTRAR TODOS LOS HELPERS GLOBALMENTE EN HANDLEBARS
Object.keys(helpers).forEach(helperName => {
  Handlebars.registerHelper(helperName, helpers[helperName]);
});

console.log('✅ Helpers registrados globalmente en Handlebars:', Object.keys(helpers).length, 'helpers');
console.log('🔑 Helpers críticos incluidos: formatearFechaSolo, formatearHoraSolo, destinatarioCensurado');

// EXPORTAR HELPERS PARA USO EN EXPRESS-HANDLEBARS
module.exports = helpers; 