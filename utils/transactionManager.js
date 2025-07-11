/**
 * GESTOR DE TRANSACCIONES ROBUSTO
 * Maneja transacciones de base de datos con rollback automático y logging detallado
 */

const { sequelize } = require('../config/database');

/**
 * Ejecuta una operación en una transacción robusta
 * @param {Function} operacion - Función async que recibe la transacción
 * @param {Object} opciones - Opciones de configuración
 * @returns {Promise} - Resultado de la operación
 */
async function ejecutarEnTransaccion(operacion, opciones = {}) {
  const {
    nombre = 'Operación',
    timeout = 30000, // 30 segundos por defecto
    isolationLevel = 'READ_COMMITTED',
    logging = true,
    retries = 3,
    retryDelay = 1000
  } = opciones;

  let intento = 0;
  let ultimoError = null;

  while (intento < retries) {
    intento++;
      const transaction = await sequelize.transaction({
    logging: logging ? console.log : false
  });

    try {
      if (logging) {
        console.log(`🔄 [TRANSACCIÓN] Iniciando: ${nombre} (intento ${intento}/${retries})`);
        console.log(`   📊 Configuración: timeout=${timeout}ms, isolation=${isolationLevel}`);
      }

      // Configurar timeout para la transacción
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Timeout de transacción: ${nombre} excedió ${timeout}ms`));
        }, timeout);
      });

      // Ejecutar la operación con timeout
      const resultado = await Promise.race([
        operacion(transaction),
        timeoutPromise
      ]);

      // Commit exitoso
      await transaction.commit();
      
      if (logging) {
        console.log(`✅ [TRANSACCIÓN] Completada exitosamente: ${nombre}`);
      }

      return resultado;

    } catch (error) {
      ultimoError = error;
      
      try {
        await transaction.rollback();
        if (logging) {
          console.log(`🔄 [TRANSACCIÓN] Rollback ejecutado para: ${nombre}`);
        }
      } catch (rollbackError) {
        console.error(`❌ [TRANSACCIÓN] Error en rollback: ${rollbackError.message}`);
      }

      // Verificar si es un error que vale la pena reintentar
      const esReintentable = esErrorReintentable(error);
      
      if (logging) {
        console.error(`❌ [TRANSACCIÓN] Error en intento ${intento}/${retries}: ${error.message}`);
        console.error(`   🔄 Reintentable: ${esReintentable ? 'SÍ' : 'NO'}`);
      }

      // Si no es reintentable o es el último intento, lanzar error
      if (!esReintentable || intento >= retries) {
        break;
      }

      // Esperar antes del siguiente intento
      if (intento < retries) {
        const delay = retryDelay * intento; // Backoff exponencial
        if (logging) {
          console.log(`⏳ [TRANSACCIÓN] Esperando ${delay}ms antes del siguiente intento...`);
        }
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Si llegamos aquí, todos los intentos fallaron
  if (logging) {
    console.error(`💥 [TRANSACCIÓN] Falló después de ${retries} intentos: ${nombre}`);
    console.error(`   📋 Error final: ${ultimoError.message}`);
  }

  throw new Error(`Transacción falló después de ${retries} intentos: ${ultimoError.message}`);
}

/**
 * Determina si un error es reintentable
 * @param {Error} error - Error a evaluar
 * @returns {boolean} - True si es reintentable
 */
function esErrorReintentable(error) {
  const mensajeError = error.message.toLowerCase();
  
  // Errores de conexión/red (reintentables)
  const erroresReintentables = [
    'connection',
    'timeout',
    'network',
    'lost connection',
    'connection refused',
    'deadlock',
    'lock wait timeout',
    'temporary failure'
  ];

  // Errores de validación/lógica (NO reintentables)
  const erroresNoReintentables = [
    'validation',
    'constraint',
    'unique',
    'foreign key',
    'not null',
    'check constraint',
    'duplicate entry',
    'invalid',
    'permission denied'
  ];

  // Verificar errores NO reintentables primero
  if (erroresNoReintentables.some(pattern => mensajeError.includes(pattern))) {
    return false;
  }

  // Verificar errores reintentables
  if (erroresReintentables.some(pattern => mensajeError.includes(pattern))) {
    return true;
  }

  // Por defecto, no reintentar errores desconocidos
  return false;
}

/**
 * Ejecuta múltiples operaciones en una sola transacción
 * @param {Array} operaciones - Array de funciones async
 * @param {Object} opciones - Opciones de configuración
 * @returns {Promise<Array>} - Resultados de todas las operaciones
 */
async function ejecutarOperacionesEnLote(operaciones, opciones = {}) {
  const {
    nombre = 'Operaciones en lote',
    continueOnError = false,
    ...opcionesTransaccion
  } = opciones;

  return ejecutarEnTransaccion(async (transaction) => {
    const resultados = [];
    
    for (let i = 0; i < operaciones.length; i++) {
      const operacion = operaciones[i];
      
      try {
        console.log(`🔄 [LOTE] Ejecutando operación ${i + 1}/${operaciones.length}`);
        const resultado = await operacion(transaction);
        resultados.push({ exito: true, resultado });
      } catch (error) {
        console.error(`❌ [LOTE] Error en operación ${i + 1}: ${error.message}`);
        
        if (continueOnError) {
          resultados.push({ exito: false, error: error.message });
        } else {
          throw error; // Esto causará rollback de toda la transacción
        }
      }
    }
    
    return resultados;
  }, { nombre, ...opcionesTransaccion });
}

/**
 * Wrapper para operaciones de reversión con logging especializado
 * @param {Function} operacion - Función de reversión
 * @param {Object} contexto - Contexto de la reversión
 * @returns {Promise} - Resultado de la reversión
 */
async function ejecutarReversion(operacion, contexto = {}) {
  const {
    tipo = 'reversión',
    documentoId = 'N/A',
    usuarioId = 'N/A',
    motivo = 'No especificado'
  } = contexto;

  const nombre = `${tipo} - Doc:${documentoId} - Usuario:${usuarioId}`;
  
  return ejecutarEnTransaccion(async (transaction) => {
    console.log(`🔄 [REVERSIÓN] Iniciando: ${tipo}`);
    console.log(`   📋 Documento: ${documentoId}`);
    console.log(`   👤 Usuario: ${usuarioId}`);
    console.log(`   📝 Motivo: ${motivo}`);
    
    const resultado = await operacion(transaction);
    
    console.log(`✅ [REVERSIÓN] Completada exitosamente: ${tipo}`);
    
    return resultado;
  }, {
    nombre,
    timeout: 60000, // 1 minuto para reversiones
    retries: 1, // Solo un intento para reversiones
    logging: true
  });
}

/**
 * Maneja transacciones con checkpoint para operaciones complejas
 * @param {Function} operacion - Función que recibe transaction y savepoint
 * @param {Object} opciones - Opciones de configuración
 * @returns {Promise} - Resultado de la operación
 */
async function ejecutarConCheckpoint(operacion, opciones = {}) {
  const { nombre = 'Operación con checkpoint' } = opciones;

  return ejecutarEnTransaccion(async (transaction) => {
    console.log(`🔄 [CHECKPOINT] Iniciando: ${nombre}`);
    
    // Crear savepoint
    const savepoint = await transaction.createSavepoint();
    console.log(`💾 [CHECKPOINT] Savepoint creado`);
    
    try {
      const resultado = await operacion(transaction, savepoint);
      console.log(`✅ [CHECKPOINT] Operación completada exitosamente`);
      return resultado;
    } catch (error) {
      console.error(`❌ [CHECKPOINT] Error en operación: ${error.message}`);
      
      // Rollback al savepoint
      await transaction.rollbackToSavepoint(savepoint);
      console.log(`🔄 [CHECKPOINT] Rollback al savepoint ejecutado`);
      
      throw error;
    }
  }, opciones);
}

/**
 * Estadísticas de transacciones
 */
const estadisticas = {
  exitosas: 0,
  fallidas: 0,
  rollbacks: 0,
  reintentos: 0,
  
  incrementarExitosa() {
    this.exitosas++;
  },
  
  incrementarFallida() {
    this.fallidas++;
  },
  
  incrementarRollback() {
    this.rollbacks++;
  },
  
  incrementarReintento() {
    this.reintentos++;
  },
  
  obtenerResumen() {
    const total = this.exitosas + this.fallidas;
    return {
      total,
      exitosas: this.exitosas,
      fallidas: this.fallidas,
      rollbacks: this.rollbacks,
      reintentos: this.reintentos,
      tasaExito: total > 0 ? ((this.exitosas / total) * 100).toFixed(2) : 0
    };
  }
};

module.exports = {
  ejecutarEnTransaccion,
  ejecutarOperacionesEnLote,
  ejecutarReversion,
  ejecutarConCheckpoint,
  esErrorReintentable,
  estadisticas
}; 