/**
 * Servicio principal de notificaciones
 * Coordina el envío de notificaciones por diferentes canales (WhatsApp, Email)
 * y maneja la lógica de evaluación de condiciones
 */

const Documento = require('../models/Documento');
const NotificacionEnviada = require('../models/NotificacionEnviada');
const EventoDocumento = require('../models/EventoDocumento');
const whatsappService = require('./whatsappService');
const emailService = require('./emailService');
const { sequelize } = require('../config/database');

// Configuración del servicio
let configuracion = {
  modoDesarrollo: true,
  logsDetallados: true,
  whatsapp: {
    habilitado: false,
    maxIntentos: 3
  },
  email: {
    habilitado: false,
    maxIntentos: 3,
    delayReintentos: 60000
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
    
    // Inicializar servicios de comunicación
    whatsappService.inicializar(configuracion.whatsapp);
    
    if (configuracion.modoDesarrollo) {
      console.log('🔔 Servicio de notificaciones inicializado en MODO DESARROLLO');
      console.log('   - Las notificaciones se simularán sin envío real');
    } else {
      console.log('✅ Servicio de notificaciones inicializado correctamente');
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
  if (documento.documentoPrincipalId !== null) {
    condiciones.debeNotificar = false;
    condiciones.razones.push('Es un documento habilitante (no principal)');
  }
  
  // Condición 5: Verificar información de contacto
  const tieneEmail = documento.emailCliente && documento.emailCliente.trim() !== '';
  const tieneTelefono = documento.telefonoCliente && documento.telefonoCliente.trim() !== '';
  
  if (!tieneEmail && !tieneTelefono) {
    condiciones.debeNotificar = false;
    condiciones.razones.push('Falta información de contacto (email y teléfono)');
  }
  
  // Determinar canales permitidos si debe notificar
  if (condiciones.debeNotificar) {
    switch (documento.metodoNotificacion) {
      case 'whatsapp':
        if (tieneTelefono) {
          condiciones.canalesPermitidos.push('whatsapp');
        } else {
          condiciones.debeNotificar = false;
          condiciones.razones.push('Método WhatsApp seleccionado pero falta teléfono');
        }
        break;
      case 'email':
        if (tieneEmail) {
          condiciones.canalesPermitidos.push('email');
        } else {
          condiciones.debeNotificar = false;
          condiciones.razones.push('Método Email seleccionado pero falta email');
        }
        break;
      case 'ambos':
        if (tieneEmail) condiciones.canalesPermitidos.push('email');
        if (tieneTelefono) condiciones.canalesPermitidos.push('whatsapp');
        
        if (condiciones.canalesPermitidos.length === 0) {
          condiciones.debeNotificar = false;
          condiciones.razones.push('Método "ambos" seleccionado pero falta email y teléfono');
        }
        break;
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
 * Prepara los mensajes para un documento según el tipo de evento
 * @param {Object} documento - Documento para el cual preparar mensajes
 * @param {string} tipoEvento - Tipo de evento ('documento_listo', 'entrega_confirmada')
 * @param {Object} datosAdicionales - Datos adicionales según el tipo de evento
 * @returns {Object} Mensajes preparados para cada canal
 */
const prepararMensajes = (documento, tipoEvento, datosAdicionales = {}) => {
  const mensajes = {
    whatsapp: null,
    email: null
  };
  
  switch (tipoEvento) {
    case 'documento_listo':
      mensajes.whatsapp = {
        destinatario: documento.telefonoCliente,
        asunto: 'Documento listo para retirar',
        plantilla: 'documento_listo_whatsapp'
      };
      
      mensajes.email = {
        destinatario: documento.emailCliente,
        asunto: `Documento listo para retirar - ${documento.tipoDocumento}`,
        plantilla: 'documento_listo_email'
      };
      break;
      
    case 'entrega_confirmada':
      mensajes.whatsapp = {
        destinatario: documento.telefonoCliente,
        asunto: 'Confirmación de entrega',
        plantilla: 'entrega_confirmada_whatsapp'
      };
      
      mensajes.email = {
        destinatario: documento.emailCliente,
        asunto: `Confirmación de entrega - ${documento.tipoDocumento}`,
        plantilla: 'entrega_confirmada_email'
      };
      break;
  }
  
  return mensajes;
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
    const registro = await NotificacionEnviada.create({
      documentoId,
      tipoEvento,
      canal,
      destinatario: resultado.destinatario,
      estado: resultado.exito ? (resultado.simulado ? 'simulado' : 'enviado') : 'fallido',
      mensajeEnviado: resultado.mensaje,
      respuestaApi: resultado.respuestaApi || null,
      intentos: 1,
      ultimoError: resultado.error || null,
      metadatos: {
        simulado: resultado.simulado || false,
        timestamp: resultado.timestamp,
        configuracion: configuracion.modoDesarrollo ? 'desarrollo' : 'produccion'
      }
    });
    
    if (configuracion.logsDetallados) {
      console.log(`📝 Intento registrado: ${tipoEvento} via ${canal} para documento ${documentoId}`);
    }
    
    return registro;
  } catch (error) {
    console.error('Error al registrar intento de notificación:', error);
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
    
    // Enviar por cada canal permitido
    for (const canal of evaluacion.canalesPermitidos) {
      try {
        let resultado;
        
        switch (canal) {
          case 'whatsapp':
            resultado = await whatsappService.enviarNotificacionDocumentoListo(
              documento.telefonoCliente,
              documento
            );
            break;
            
          case 'email':
            resultado = await emailService.enviarNotificacionDocumentoListo(
              documento,
              {
                email: documento.emailCliente,
                nombre: documento.nombreCliente
              }
            );
            break;
            
          default:
            throw new Error(`Canal no soportado: ${canal}`);
        }
        
        // Registrar el intento
        await registrarIntento(documentoId, 'documento_listo', canal, resultado);
        
        if (resultado.exito) {
          resultados.canalesEnviados.push(canal);
        } else {
          resultados.errores.push({
            canal,
            error: resultado.error
          });
        }
      } catch (error) {
        console.error(`Error al enviar por ${canal}:`, error);
        resultados.errores.push({
          canal,
          error: error.message
        });
      }
    }
    
    // Registrar evento en el documento
    await EventoDocumento.create({
      idDocumento: documentoId,
      tipo: 'otro',
      detalles: `Notificación de documento listo enviada por: ${resultados.canalesEnviados.join(', ')}`,
      usuario: 'Sistema de Notificaciones',
      metadatos: {
        canalesEnviados: resultados.canalesEnviados,
        errores: resultados.errores,
        modoDesarrollo: configuracion.modoDesarrollo
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
    
    // Para confirmación de entrega, evaluamos condiciones más flexibles
    const tieneEmail = documento.emailCliente && documento.emailCliente.trim() !== '';
    const tieneTelefono = documento.telefonoCliente && documento.telefonoCliente.trim() !== '';
    
    if (!tieneEmail && !tieneTelefono) {
      if (configuracion.logsDetallados) {
        console.log(`⏭️ No se enviará confirmación: falta información de contacto`);
      }
      
      await transaction.commit();
      return {
        exito: true,
        notificacionEnviada: false,
        razones: ['Falta información de contacto'],
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
    
    // Determinar canales según método de notificación
    const canales = [];
    switch (documento.metodoNotificacion) {
      case 'whatsapp':
        if (tieneTelefono) canales.push('whatsapp');
        break;
      case 'email':
        if (tieneEmail) canales.push('email');
        break;
      case 'ambos':
        if (tieneEmail) canales.push('email');
        if (tieneTelefono) canales.push('whatsapp');
        break;
      case 'ninguno':
        // Para confirmación de entrega, enviamos aunque esté en "ninguno"
        if (tieneEmail) canales.push('email');
        break;
    }
    
    // Enviar por cada canal
    for (const canal of canales) {
      try {
        let resultado;
        
        switch (canal) {
          case 'whatsapp':
            resultado = await whatsappService.enviarConfirmacionEntrega(
              documento.telefonoCliente,
              documento,
              datosEntrega
            );
            break;
            
          case 'email':
            resultado = await emailService.enviarConfirmacionEntrega(
              documento,
              {
                email: documento.emailCliente,
                nombre: documento.nombreCliente
              },
              datosEntrega
            );
            break;
        }
        
        // Registrar el intento
        await registrarIntento(documentoId, 'entrega_confirmada', canal, resultado);
        
        if (resultado.exito) {
          resultados.canalesEnviados.push(canal);
        } else {
          resultados.errores.push({
            canal,
            error: resultado.error
          });
        }
      } catch (error) {
        console.error(`Error al enviar confirmación por ${canal}:`, error);
        resultados.errores.push({
          canal,
          error: error.message
        });
      }
    }
    
    // Registrar evento en el documento
    await EventoDocumento.create({
      idDocumento: documentoId,
      tipo: 'otro',
      detalles: `Confirmación de entrega enviada por: ${resultados.canalesEnviados.join(', ')}`,
      usuario: 'Sistema de Notificaciones',
      metadatos: {
        canalesEnviados: resultados.canalesEnviados,
        errores: resultados.errores,
        datosEntrega,
        modoDesarrollo: configuracion.modoDesarrollo
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
  return { ...configuracion };
};

/**
 * Actualiza la configuración del servicio
 * @param {Object} nuevaConfig - Nueva configuración
 */
const actualizarConfiguracion = (nuevaConfig) => {
  configuracion = {
    ...configuracion,
    ...nuevaConfig
  };
  
  // Actualizar configuración de servicios dependientes
  whatsappService.actualizarConfiguracion(configuracion.whatsapp);
};

module.exports = {
  inicializar,
  evaluarCondicionesNotificacion,
  prepararMensajes,
  registrarIntento,
  enviarNotificacionDocumentoListo,
  enviarNotificacionEntrega,
  obtenerHistorialNotificaciones,
  obtenerConfiguracion,
  actualizarConfiguracion
}; 