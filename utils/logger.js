/**
 * Sistema de Logging Centralizado
 * Para debugging sistemático del sistema notarial
 */

const moment = require('moment-timezone');
const TIMEZONE_ECUADOR = 'America/Guayaquil';

// Niveles de logging
const LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARNING: 2,
  ERROR: 3
};

// Configuración del logger
const config = {
  level: process.env.LOG_LEVEL || 'INFO',
  enableConsole: true,
  enableFile: false, // Para futuras implementaciones
  timezone: TIMEZONE_ECUADOR
};

/**
 * Formatea timestamp en zona horaria de Ecuador
 */
function formatTimestamp() {
  return moment().tz(TIMEZONE_ECUADOR).format('YYYY-MM-DD HH:mm:ss');
}

/**
 * Formatea mensaje de log con contexto
 */
function formatMessage(level, context, message, data = null) {
  const timestamp = formatTimestamp();
  let logMessage = `[${timestamp}] [${level}] [${context}] ${message}`;
  
  if (data && typeof data === 'object') {
    logMessage += ` | Data: ${JSON.stringify(data, null, 2)}`;
  } else if (data) {
    logMessage += ` | ${data}`;
  }
  
  return logMessage;
}

/**
 * Verifica si el nivel de log debe ser mostrado
 */
function shouldLog(level) {
  const currentLevel = LEVELS[config.level] || LEVELS.INFO;
  const messageLevel = LEVELS[level] || LEVELS.INFO;
  return messageLevel >= currentLevel;
}

/**
 * Logger principal
 */
const logger = {
  /**
   * Log de debug (desarrollo)
   */
  debug: (context, message, data = null) => {
    if (!shouldLog('DEBUG')) return;
    const logMessage = formatMessage('DEBUG', context, message, data);
    if (config.enableConsole) {
      console.log('🔍', logMessage);
    }
  },

  /**
   * Log de información general
   */
  info: (context, message, data = null) => {
    if (!shouldLog('INFO')) return;
    const logMessage = formatMessage('INFO', context, message, data);
    if (config.enableConsole) {
      console.log('ℹ️', logMessage);
    }
  },

  /**
   * Log de advertencias
   */
  warning: (context, message, data = null) => {
    if (!shouldLog('WARNING')) return;
    const logMessage = formatMessage('WARNING', context, message, data);
    if (config.enableConsole) {
      console.warn('⚠️', logMessage);
    }
  },

  /**
   * Log de errores
   */
  error: (context, message, error = null) => {
    if (!shouldLog('ERROR')) return;
    let data = null;
    if (error) {
      data = {
        message: error.message,
        stack: error.stack,
        name: error.name
      };
    }
    const logMessage = formatMessage('ERROR', context, message, data);
    if (config.enableConsole) {
      console.error('❌', logMessage);
    }
  },

  /**
   * Log específico para operaciones de fechas
   */
  timestamp: (context, operation, timestamp, details = null) => {
    const data = {
      operation,
      timestamp: timestamp ? moment(timestamp).tz(TIMEZONE_ECUADOR).format('YYYY-MM-DD HH:mm:ss') : 'null',
      timezone: TIMEZONE_ECUADOR,
      details
    };
    logger.info(context, `Operación de timestamp: ${operation}`, data);
  },

  /**
   * Log específico para operaciones de pago
   */
  payment: (context, operation, documentId, paymentData = null) => {
    const data = {
      operation,
      documentId,
      timestamp: formatTimestamp(),
      paymentData
    };
    logger.info(context, `Operación de pago: ${operation}`, data);
  },

  /**
   * Log específico para consultas de base de datos
   */
  query: (context, queryType, parameters = null, results = null) => {
    const data = {
      queryType,
      parameters,
      resultCount: results ? (Array.isArray(results) ? results.length : 'object') : 'null',
      timestamp: formatTimestamp()
    };
    logger.debug(context, `Query ejecutado: ${queryType}`, data);
  },

  /**
   * Log específico para dashboard
   */
  dashboard: (context, operation, period = null, stats = null) => {
    const data = {
      operation,
      period,
      stats,
      timestamp: formatTimestamp()
    };
    logger.info(context, `Dashboard: ${operation}`, data);
  },

  /**
   * Log de inicio de operación
   */
  start: (context, operation, params = null) => {
    logger.info(context, `🚀 INICIO: ${operation}`, params);
  },

  /**
   * Log de fin de operación
   */
  end: (context, operation, result = null) => {
    logger.info(context, `✅ FIN: ${operation}`, result);
  },

  /**
   * Log de separador para legibilidad
   */
  separator: (context, title) => {
    const separator = '='.repeat(50);
    logger.info(context, `${separator} ${title} ${separator}`);
  }
};

// Exportar logger y utilidades
module.exports = {
  logger,
  LEVELS,
  formatTimestamp,
  
  // Métodos de conveniencia para contextos específicos
  logPayment: (operation, documentId, data) => logger.payment('PAYMENT', operation, documentId, data),
  logQuery: (queryType, params, results) => logger.query('DATABASE', queryType, params, results),
  logDashboard: (operation, period, stats) => logger.dashboard('DASHBOARD', operation, period, stats),
  logTimestamp: (operation, timestamp, details) => logger.timestamp('TIMESTAMP', operation, timestamp, details),
  
  // Configuración
  setLevel: (level) => { config.level = level; },
  getConfig: () => ({ ...config })
}; 