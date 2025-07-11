/**
 * Analizador Inteligente de Contactos
 * Compara números de XML vs base de datos local
 * Determina el mejor contacto a usar para notificaciones
 */

const ContactoLocal = require('../models/ContactoLocal');

/**
 * Analiza el contacto de un cliente y determina el mejor número a usar
 * @param {string} tipoId - Tipo de identificación (cedula, ruc, pasaporte)
 * @param {string} numeroId - Número de identificación del cliente
 * @param {string} nombreCompleto - Nombre completo del cliente
 * @param {string} numeroXML - Número extraído del XML (campo CELULAR)
 * @param {string} matrizador - Nombre del matrizador que procesa
 * @returns {Object} - Resultado del análisis con recomendación
 */
async function analizarContactoCliente(tipoId, numeroId, nombreCompleto, numeroXML, matrizador) {
  try {
    console.log('🔍 Analizando contacto del cliente:', {
      tipoId,
      numeroId,
      nombreCompleto,
      numeroXML,
      matrizador
    });

    // Normalizar y validar datos de entrada
    const datosNormalizados = normalizarDatosEntrada(tipoId, numeroId, nombreCompleto, numeroXML, matrizador);
    
    if (!datosNormalizados.esValido) {
      return {
        numeroUsar: null,
        confianza: 0,
        accion: 'error',
        mensaje: datosNormalizados.error,
        datos_adicionales: null
      };
    }

    // Buscar contacto existente en base de datos local
    const contactoLocal = await ContactoLocal.buscarPorIdentificacion(datosNormalizados.numeroId);

    if (!contactoLocal) {
      // CASO 1: Cliente nuevo - usar número del XML automáticamente
      console.log('✅ Cliente nuevo - usando número del XML automáticamente');
      
      return {
        numeroUsar: datosNormalizados.numeroXML,
        confianza: 100,
        accion: 'usar_xml_automatico',
        mensaje: 'Cliente nuevo - número del XML se usará automáticamente',
        datos_adicionales: {
          esClienteNuevo: true,
          numeroXML: datosNormalizados.numeroXML,
          accionRecomendada: 'crear_contacto_local'
        }
      };
    }

    // CASO 2: Cliente existente - comparar números
    console.log('🔍 Cliente existente encontrado:', {
      contactoPrincipal: contactoLocal.contactoPrincipal,
      vecesUsado: contactoLocal.vecesUsadoPrincipal,
      ultimoContacto: contactoLocal.ultimoContactoUsado
    });

    // Comparar número XML vs contacto principal
    if (datosNormalizados.numeroXML === contactoLocal.contactoPrincipal) {
      // CASO 2A: Números coinciden - usar automáticamente
      console.log('✅ Números coinciden - usando automáticamente');
      
      return {
        numeroUsar: contactoLocal.contactoPrincipal,
        confianza: 100,
        accion: 'usar_principal_automatico',
        mensaje: 'Número del XML coincide con contacto principal',
        datos_adicionales: {
          esClienteExistente: true,
          numeroXML: datosNormalizados.numeroXML,
          contactoPrincipal: contactoLocal.contactoPrincipal,
          vecesUsadoPrincipal: contactoLocal.vecesUsadoPrincipal,
          accionRecomendada: 'actualizar_uso'
        }
      };
    }

    // CASO 2B: Números diferentes - mostrar conflicto
    console.log('⚠️ Conflicto de números detectado');
    
    // Buscar si el número XML existe en el histórico
    const historicos = contactoLocal.contactosHistoricos || [];
    const numeroEnHistorico = historicos.find(h => h.numero === datosNormalizados.numeroXML);
    
    // Calcular estadísticas para la decisión
    const estadisticas = contactoLocal.obtenerEstadisticas();
    
    // Determinar nivel de confianza del contacto principal
    let confianzaPrincipal = 75; // Base
    if (contactoLocal.vecesUsadoPrincipal >= 5) confianzaPrincipal = 90;
    if (contactoLocal.vecesUsadoPrincipal >= 10) confianzaPrincipal = 95;
    
    // Determinar confianza del número XML
    let confianzaXML = 50; // Base para número nuevo
    if (numeroEnHistorico) {
      confianzaXML = 60 + (numeroEnHistorico.veces_usado * 5); // Incrementar por uso histórico
      if (confianzaXML > 85) confianzaXML = 85; // Máximo 85 para números no principales
    }

    return {
      numeroUsar: null, // Requiere decisión manual
      confianza: 0,
      accion: 'mostrar_conflicto',
      mensaje: 'Conflicto de números - requiere decisión manual',
      datos_adicionales: {
        esClienteExistente: true,
        conflicto: true,
        numeroXML: datosNormalizados.numeroXML,
        contactoPrincipal: contactoLocal.contactoPrincipal,
        vecesUsadoPrincipal: contactoLocal.vecesUsadoPrincipal,
        confianzaPrincipal,
        confianzaXML,
        numeroEnHistorico: numeroEnHistorico ? {
          numero: numeroEnHistorico.numero,
          vecesUsado: numeroEnHistorico.veces_usado,
          fechaUltimoUso: numeroEnHistorico.fecha_ultimo_uso
        } : null,
        estadisticas,
        recomendacion: determinarRecomendacion(contactoLocal, datosNormalizados.numeroXML, numeroEnHistorico),
        accionRecomendada: 'mostrar_indicador_conflicto'
      }
    };

  } catch (error) {
    console.error('❌ Error analizando contacto:', error);
    
    return {
      numeroUsar: numeroXML, // Fallback al XML en caso de error
      confianza: 25,
      accion: 'error_fallback',
      mensaje: 'Error en análisis - usando número del XML como fallback',
      datos_adicionales: {
        error: error.message,
        numeroXML,
        accionRecomendada: 'revisar_manualmente'
      }
    };
  }
}

/**
 * Normaliza y valida los datos de entrada
 * @param {string} tipoId - Tipo de identificación
 * @param {string} numeroId - Número de identificación
 * @param {string} nombreCompleto - Nombre completo
 * @param {string} numeroXML - Número del XML
 * @param {string} matrizador - Matrizador
 * @returns {Object} - Datos normalizados y validación
 */
function normalizarDatosEntrada(tipoId, numeroId, nombreCompleto, numeroXML, matrizador) {
  const resultado = {
    esValido: true,
    error: null,
    tipoId: null,
    numeroId: null,
    nombreCompleto: null,
    numeroXML: null,
    matrizador: null
  };

  // Validar número de identificación
  if (!numeroId || typeof numeroId !== 'string') {
    resultado.esValido = false;
    resultado.error = 'Número de identificación requerido';
    return resultado;
  }
  resultado.numeroId = numeroId.toString().trim();

  // Validar nombre completo
  if (!nombreCompleto || typeof nombreCompleto !== 'string') {
    resultado.esValido = false;
    resultado.error = 'Nombre completo requerido';
    return resultado;
  }
  resultado.nombreCompleto = nombreCompleto.trim();

  // Validar y normalizar número XML
  if (!numeroXML || typeof numeroXML !== 'string') {
    resultado.esValido = false;
    resultado.error = 'Número de contacto del XML requerido';
    return resultado;
  }
  
  // Normalizar número XML (remover espacios, guiones, paréntesis)
  const numeroLimpio = numeroXML.replace(/[\s\-\(\)]/g, '');
  
  // Validar formato de teléfono ecuatoriano
  if (!/^[0-9]{10}$/.test(numeroLimpio)) {
    resultado.esValido = false;
    resultado.error = 'Número de contacto debe tener 10 dígitos';
    return resultado;
  }
  resultado.numeroXML = numeroLimpio;

  // Determinar tipo de identificación automáticamente si no se proporciona
  if (!tipoId) {
    if (resultado.numeroId.length === 10 && /^\d{10}$/.test(resultado.numeroId)) {
      resultado.tipoId = 'cedula';
    } else if (resultado.numeroId.length === 13 && /^\d{13}$/.test(resultado.numeroId)) {
      resultado.tipoId = 'ruc';
    } else {
      resultado.tipoId = 'pasaporte';
    }
  } else {
    resultado.tipoId = tipoId;
  }

  // Normalizar matrizador
  resultado.matrizador = matrizador ? matrizador.trim() : null;

  return resultado;
}

/**
 * Determina la recomendación basada en el análisis
 * @param {Object} contactoLocal - Contacto local existente
 * @param {string} numeroXML - Número del XML
 * @param {Object} numeroEnHistorico - Número en histórico si existe
 * @returns {string} - Recomendación
 */
function determinarRecomendacion(contactoLocal, numeroXML, numeroEnHistorico) {
  // Si el número XML está en el histórico y se ha usado recientemente
  if (numeroEnHistorico) {
    const diasDesdeUltimoUso = Math.floor((new Date() - new Date(numeroEnHistorico.fecha_ultimo_uso)) / (1000 * 60 * 60 * 24));
    
    if (diasDesdeUltimoUso <= 30) {
      return 'considerar_xml'; // Usado recientemente
    } else if (numeroEnHistorico.veces_usado >= 3) {
      return 'considerar_xml'; // Usado frecuentemente
    }
  }

  // Si el contacto principal se ha usado muchas veces
  if (contactoLocal.vecesUsadoPrincipal >= 5) {
    return 'mantener_principal'; // Contacto principal bien establecido
  }

  // Si el contacto principal es reciente (menos de 3 usos)
  if (contactoLocal.vecesUsadoPrincipal <= 2) {
    return 'considerar_xml'; // Contacto principal no está bien establecido
  }

  // Por defecto, mantener el principal
  return 'mantener_principal';
}

/**
 * Registra el uso de un contacto después de la resolución
 * @param {string} numeroId - Número de identificación
 * @param {string} nombreCompleto - Nombre completo
 * @param {string} numeroUsado - Número que se decidió usar
 * @param {string} matrizador - Matrizador que procesó
 * @returns {Promise<Object>} - Resultado del registro
 */
async function registrarUsoContacto(numeroId, nombreCompleto, numeroUsado, matrizador) {
  try {
    console.log('📝 Registrando uso de contacto:', {
      numeroId,
      nombreCompleto,
      numeroUsado,
      matrizador
    });

    // Crear o actualizar contacto local
    const contacto = await ContactoLocal.crearOActualizar({
      numeroIdentificacion: numeroId,
      nombreCompleto: nombreCompleto,
      numeroContacto: numeroUsado,
      matrizador: matrizador
    });

    console.log('✅ Uso de contacto registrado correctamente');

    return {
      exito: true,
      contacto: contacto,
      mensaje: 'Uso de contacto registrado correctamente'
    };

  } catch (error) {
    console.error('❌ Error registrando uso de contacto:', error);
    
    return {
      exito: false,
      error: error.message,
      mensaje: 'Error al registrar uso de contacto'
    };
  }
}

/**
 * Obtiene estadísticas de un cliente
 * @param {string} numeroId - Número de identificación
 * @returns {Promise<Object>} - Estadísticas del cliente
 */
async function obtenerEstadisticasCliente(numeroId) {
  try {
    const contactoLocal = await ContactoLocal.buscarPorIdentificacion(numeroId);
    
    if (!contactoLocal) {
      return {
        existe: false,
        mensaje: 'Cliente no encontrado en base de datos local'
      };
    }

    const estadisticas = contactoLocal.obtenerEstadisticas();
    
    return {
      existe: true,
      estadisticas: estadisticas,
      contactoLocal: {
        id: contactoLocal.id,
        tipoIdentificacion: contactoLocal.tipoIdentificacion,
        numeroIdentificacion: contactoLocal.numeroIdentificacion,
        nombreCompleto: contactoLocal.nombreCompleto,
        contactoPrincipal: contactoLocal.contactoPrincipal,
        matrizadorFrecuente: contactoLocal.matrizadorFrecuente,
        fechaUltimoUso: contactoLocal.fechaUltimoUso,
        activo: contactoLocal.activo
      }
    };

  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    
    return {
      existe: false,
      error: error.message,
      mensaje: 'Error al obtener estadísticas del cliente'
    };
  }
}

module.exports = {
  analizarContactoCliente,
  registrarUsoContacto,
  obtenerEstadisticasCliente,
  normalizarDatosEntrada,
  determinarRecomendacion
}; 