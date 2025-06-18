/**
 * Servicio principal de notificaciones
 * Coordina el envío de notificaciones solo por WhatsApp usando Twilio
 * Integrado con whatsappService funcional
 */

const Documento = require('../models/Documento');
const NotificacionEnviada = require('../models/NotificacionEnviada');
const EventoDocumento = require('../models/EventoDocumento');
const whatsappService = require('./whatsappService');
const { sequelize } = require('../config/database');

// Configuración del servicio - SOLO WHATSAPP
let configuracion = {
  modoDesarrollo: process.env.NODE_ENV === 'development',
  logsDetallados: true,
  whatsapp: {
    habilitado: process.env.WHATSAPP_ENABLED === 'true',
    testMode: process.env.TEST_MODE === 'true',
    maxIntentos: 3
  }
};

/**
 * Inicializa el servicio de notificaciones
 * @param {Object} config - Configuración del servicio
 */
const inicializar = async (config = {}) => {
  try {
    configuracion = {
      ...configuracion,
      ...config
    };
    
    // Inicializar solo el servicio de WhatsApp
    const whatsappInicializado = whatsappService.inicializar(configuracion.whatsapp);
    
    if (!whatsappInicializado) {
      console.warn('⚠️ WhatsApp no se pudo inicializar, funcionará en modo simulado');
    }
    
    if (configuracion.modoDesarrollo) {
      console.log('🔔 Servicio de notificaciones inicializado en MODO DESARROLLO (SOLO WHATSAPP)');
      console.log('   - Las notificaciones se simularán sin envío real');
      if (configuracion.whatsapp.testMode) {
        console.log('   - TEST_MODE activado: solo envíos al número de prueba');
      }
    } else {
      console.log('✅ Servicio de notificaciones inicializado en PRODUCCIÓN (SOLO WHATSAPP)');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error al inicializar servicio de notificaciones:', error);
    return false;
  }
};

/**
 * Evalúa las condiciones para determinar si se debe notificar un documento
 * @param {Object} documento - Documento a evaluar
 * @returns {Object} Resultado de la evaluación
 */
const evaluarCondicionesNotificacion = (documento) => {
  const condiciones = {
    debeNotificar: true,
    razones: [],
    canalesPermitidos: []
  };
  
  // Condición 1: Verificar si la notificación automática está habilitada
  if (!documento.notificarAutomatico) {
    condiciones.debeNotificar = false;
    condiciones.razones.push('Notificación automática deshabilitada');
  }
  
  // Condición 2: Verificar si fue entregado inmediatamente
  if (documento.entregadoInmediatamente) {
    condiciones.debeNotificar = false;
    condiciones.razones.push('Documento entregado inmediatamente');
  }
  
  // Condición 3: Verificar método de notificación
  if (documento.metodoNotificacion === 'ninguno') {
    condiciones.debeNotificar = false;
    condiciones.razones.push('Método de notificación configurado como "ninguno"');
  }
  
  // Condición 4: Verificar si es documento habilitante
  // NOTA: Para documentos de archivo, permitimos notificaciones incluso si son habilitantes
  if (documento.documentoPrincipalId !== null && documento.rolUsuarioCreador !== 'archivo') {
    condiciones.debeNotificar = false;
    condiciones.razones.push('Es un documento habilitante (no principal)');
  }
  
  // Condición 5: Verificar información de contacto - SOLO WHATSAPP
  const tieneTelefono = documento.telefonoCliente && documento.telefonoCliente.trim() !== '';
  
  if (!tieneTelefono) {
    condiciones.debeNotificar = false;
    condiciones.razones.push('Falta número de teléfono para WhatsApp');
  }
  
  // Determinar canales permitidos si debe notificar - SOLO WHATSAPP
  if (condiciones.debeNotificar) {
    // Todas las configuraciones de método se tratan como WhatsApp
    if (tieneTelefono) {
      condiciones.canalesPermitidos.push('whatsapp');
    } else {
      condiciones.debeNotificar = false;
      condiciones.razones.push('WhatsApp seleccionado pero falta teléfono');
    }
  }
  
  // Agregar razón específica si existe
  if (documento.razonSinNotificar) {
    condiciones.debeNotificar = false;
    condiciones.razones.push(`Razón específica: ${documento.razonSinNotificar}`);
  }
  
  return condiciones;
};

/**
 * Registra un intento de notificación en la base de datos
 * @param {number} documentoId - ID del documento
 * @param {string} tipoEvento - Tipo de evento
 * @param {string} canal - Canal utilizado
 * @param {Object} resultado - Resultado del envío
 * @returns {Promise<Object>} Registro creado
 */
const registrarIntento = async (documentoId, tipoEvento, canal, resultado) => {
  try {
    // Obtener destinatario del resultado o usar valor por defecto
    let destinatario = resultado.destinatario || 'no-disponible';
    
    // Si no hay destinatario en el resultado, intentar obtenerlo del documento
    if (!destinatario || destinatario === 'no-disponible') {
      try {
        const documento = await Documento.findByPk(documentoId);
        if (documento) {
          // Solo WhatsApp, siempre usar teléfono
          destinatario = documento.telefonoCliente || 'telefono-no-disponible';
        }
      } catch (docError) {
        console.warn('No se pudo obtener documento para destinatario:', docError.message);
        destinatario = `${canal}-no-disponible`;
      }
    }
    
    const registro = await NotificacionEnviada.create({
      documentoId,
      tipoEvento,
      canal,
      destinatario: destinatario,
      estado: resultado.exito ? (resultado.simulado ? 'simulado' : 'enviado') : 'fallido',
      mensajeEnviado: resultado.mensaje || resultado.error || 'Sin mensaje',
      respuestaApi: resultado.respuestaApi || null,
      intentos: 1,
      ultimoError: resultado.error || null,
      metadatos: {
        simulado: resultado.simulado || false,
        timestamp: resultado.timestamp || new Date().toISOString(),
        configuracion: configuracion.modoDesarrollo ? 'desarrollo' : 'produccion',
        whatsappServiceVersion: 'v2-twilio'
      }
    });
    
    if (configuracion.logsDetallados) {
      console.log(`📝 Intento registrado: ${tipoEvento} via ${canal} para documento ${documentoId} (${resultado.simulado ? 'SIMULADO' : 'REAL'})`);
    }
    
    return registro;
  } catch (error) {
    console.error('❌ Error al registrar intento de notificación:', error.message);
    
    // En desarrollo, no fallar por errores de base de datos
    if (configuracion.modoDesarrollo) {
      console.log('📝 [DESARROLLO] Continuando sin registrar en BD...');
      return {
        id: `dev-${Date.now()}`,
        documentoId,
        tipoEvento,
        canal,
        estado: 'simulado',
        simulado: true
      };
    }
    
    // En producción, re-lanzar el error
    throw error;
  }
};

/**
 * Envía notificación cuando un documento está listo para entrega
 * @param {number} documentoId - ID del documento
 * @returns {Promise<Object>} Resultado del envío
 */
const enviarNotificacionDocumentoListo = async (documentoId) => {
  const transaction = await sequelize.transaction();
  
  try {
    // Obtener el documento con todos sus datos
    const documento = await Documento.findByPk(documentoId, { transaction });
    
    if (!documento) {
      throw new Error(`Documento con ID ${documentoId} no encontrado`);
    }
    
    if (configuracion.logsDetallados) {
      console.log(`🔔 Evaluando notificación para documento ${documento.codigoBarras}`);
    }
    
    // Evaluar condiciones de notificación
    const evaluacion = evaluarCondicionesNotificacion(documento);
    
    if (!evaluacion.debeNotificar) {
      if (configuracion.logsDetallados) {
        console.log(`⏭️ No se enviará notificación para documento ${documento.codigoBarras}:`);
        evaluacion.razones.forEach(razon => console.log(`   - ${razon}`));
      }
      
      await transaction.commit();
      return {
        exito: true,
        notificacionEnviada: false,
        razones: evaluacion.razones,
        documento: documento.codigoBarras
      };
    }
    
    const resultados = {
      exito: true,
      notificacionEnviada: true,
      canalesEnviados: [],
      errores: [],
      documento: documento.codigoBarras
    };
    
    // Enviar solo por WhatsApp - SIMPLIFICADO
    try {
      console.log(`📱 Enviando notificación WhatsApp para documento ${documento.codigoBarras}`);
      
      const resultado = await whatsappService.enviarNotificacionDocumentoListo(
        documento.telefonoCliente,
        documento
      );
      
      // Registrar el intento
      await registrarIntento(documentoId, 'documento_listo', 'whatsapp', resultado);
      
      if (resultado.exito) {
        resultados.canalesEnviados.push('whatsapp');
        console.log(`✅ WhatsApp enviado correctamente a ${documento.telefonoCliente}`);
      } else {
        resultados.errores.push({
          canal: 'whatsapp',
          error: resultado.error
        });
        console.log(`❌ Error al enviar WhatsApp: ${resultado.error}`);
      }
    } catch (error) {
      console.error(`❌ Error al enviar por WhatsApp:`, error);
      resultados.errores.push({
        canal: 'whatsapp',
        error: error.message
      });
    }
    
    // Determinar el canal principal para el registro
    let canalPrincipal = 'whatsapp';
    
    // Determinar el estado principal
    let estadoPrincipal = 'enviada';
    if (resultados.canalesEnviados.length === 0) {
      estadoPrincipal = 'fallida';
    } else if (configuracion.modoDesarrollo) {
      estadoPrincipal = 'simulada';
    }
    
    // Registrar evento en el documento con metadatos corregidos
    await EventoDocumento.create({
      documentoId: documentoId,
      tipo: 'otro',
      detalles: `Notificación de documento listo enviada por WhatsApp${resultados.canalesEnviados.length > 0 ? ' ✓' : ' ✗'}`,
      usuario: 'Sistema de Notificaciones',
      metadatos: {
        // ✅ CAMPOS CORREGIDOS PARA HISTORIAL
        canal: canalPrincipal,                    // ✅ Para mostrar en columna "Canal"
        estado: estadoPrincipal,                  // ✅ Para mostrar en columna "Estado"
        tipo: 'documento_listo',                  // ✅ Para filtros y etiquetas
        canalesEnviados: resultados.canalesEnviados,
        errores: resultados.errores,
        modoDesarrollo: configuracion.modoDesarrollo,
        timestamp: new Date().toISOString(),
        configuracion: configuracion.modoDesarrollo ? 'desarrollo' : 'produccion',
        // Información adicional para auditoría
        documentoId: documentoId,
        codigoDocumento: documento.codigoBarras,
        clienteTelefono: documento.telefonoCliente,
        metodoNotificacion: documento.metodoNotificacion,
        whatsappServiceVersion: 'v2-twilio'
      }
    }, { transaction });
    
    await transaction.commit();
    
    if (configuracion.logsDetallados) {
      console.log(`✅ Notificación procesada para documento ${documento.codigoBarras}`);
      console.log(`   Canales enviados: ${resultados.canalesEnviados.join(', ') || 'ninguno'}`);
      if (resultados.errores.length > 0) {
        console.log(`   Errores: ${resultados.errores.length}`);
      }
    }
    
    return resultados;
  } catch (error) {
    await transaction.rollback();
    console.error('Error al enviar notificación de documento listo:', error);
    throw error;
  }
};

/**
 * Envía notificación de confirmación de entrega
 * @param {number} documentoId - ID del documento
 * @param {Object} datosEntrega - Datos de la entrega
 * @returns {Promise<Object>} Resultado del envío
 */
const enviarNotificacionEntrega = async (documentoId, datosEntrega) => {
  const transaction = await sequelize.transaction();
  
  try {
    // Obtener el documento
    const documento = await Documento.findByPk(documentoId, { transaction });
    
    if (!documento) {
      throw new Error(`Documento con ID ${documentoId} no encontrado`);
    }
    
    if (configuracion.logsDetallados) {
      console.log(`🔔 Enviando confirmación de entrega para documento ${documento.codigoBarras}`);
    }
    
    // Para confirmación de entrega, evaluar solo WhatsApp
    const tieneTelefono = documento.telefonoCliente && documento.telefonoCliente.trim() !== '';
    
    if (!tieneTelefono) {
      if (configuracion.logsDetallados) {
        console.log(`⏭️ No se enviará confirmación: falta número de teléfono`);
      }
      
      await transaction.commit();
      return {
        exito: true,
        notificacionEnviada: false,
        razones: ['Falta número de teléfono'],
        documento: documento.codigoBarras
      };
    }
    
    const resultados = {
      exito: true,
      notificacionEnviada: true,
      canalesEnviados: [],
      errores: [],
      documento: documento.codigoBarras
    };
    
    // Enviar solo por WhatsApp
    try {
      console.log(`📱 Enviando confirmación de entrega WhatsApp para documento ${documento.codigoBarras}`);
      
      const resultado = await whatsappService.enviarConfirmacionEntrega(
        documento.telefonoCliente,
        documento,
        datosEntrega
      );
      
      // Registrar el intento
      await registrarIntento(documentoId, 'entrega_confirmada', 'whatsapp', resultado);
      
      if (resultado.exito) {
        resultados.canalesEnviados.push('whatsapp');
      } else {
        resultados.errores.push({
          canal: 'whatsapp',
          error: resultado.error
        });
      }
    } catch (error) {
      console.error(`Error al enviar confirmación por WhatsApp:`, error);
      resultados.errores.push({
        canal: 'whatsapp',
        error: error.message
      });
    }
    
    // Registrar evento en el documento
    await EventoDocumento.create({
      documentoId: documentoId,
      tipo: 'otro',
      detalles: `Confirmación de entrega enviada por WhatsApp${resultados.canalesEnviados.length > 0 ? ' ✓' : ' ✗'}`,
      usuario: 'Sistema de Notificaciones',
      metadatos: {
        canalesEnviados: resultados.canalesEnviados,
        errores: resultados.errores,
        datosEntrega,
        modoDesarrollo: configuracion.modoDesarrollo,
        whatsappServiceVersion: 'v2-twilio'
      }
    }, { transaction });
    
    await transaction.commit();
    
    if (configuracion.logsDetallados) {
      console.log(`✅ Confirmación de entrega procesada para documento ${documento.codigoBarras}`);
      console.log(`   Canales enviados: ${resultados.canalesEnviados.join(', ') || 'ninguno'}`);
    }
    
    return resultados;
  } catch (error) {
    await transaction.rollback();
    console.error('Error al enviar confirmación de entrega:', error);
    throw error;
  }
};

/**
 * Obtiene el historial de notificaciones de un documento
 * @param {number} documentoId - ID del documento
 * @returns {Promise<Array>} Historial de notificaciones
 */
const obtenerHistorialNotificaciones = async (documentoId) => {
  try {
    const notificaciones = await NotificacionEnviada.findAll({
      where: { documentoId },
      order: [['created_at', 'DESC']]
    });
    
    return notificaciones;
  } catch (error) {
    console.error('Error al obtener historial de notificaciones:', error);
    throw error;
  }
};

/**
 * Obtiene la configuración actual del servicio
 * @returns {Object} Configuración actual
 */
const obtenerConfiguracion = () => {
  return { 
    ...configuracion,
    whatsappStatus: whatsappService.obtenerConfiguracion()
  };
};

/**
 * Actualiza la configuración del servicio - SOLO WHATSAPP
 * @param {Object} nuevaConfig - Nueva configuración
 */
const actualizarConfiguracion = (nuevaConfig) => {
  configuracion = {
    ...configuracion,
    ...nuevaConfig
  };
  
  // Actualizar configuración solo de WhatsApp
  if (configuracion.whatsapp) {
    whatsappService.actualizarConfiguracion(configuracion.whatsapp);
  }
  
  console.log('🔧 Configuración del servicio de notificaciones actualizada (SOLO WHATSAPP)');
};

module.exports = {
  inicializar,
  evaluarCondicionesNotificacion,
  registrarIntento,
  enviarNotificacionDocumentoListo,
  enviarNotificacionEntrega,
  obtenerHistorialNotificaciones,
  obtenerConfiguracion,
  actualizarConfiguracion
}; 