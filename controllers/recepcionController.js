const Documento = require('../models/Documento');
const Matrizador = require('../models/Matrizador');
const EventoDocumento = require('../models/EventoDocumento');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');
const moment = require('moment');
const NotificationService = require('../services/notificationService');
const NotificacionEnviada = require('../models/NotificacionEnviada');
const configNotaria = require('../config/notaria');

// ============== FUNCIONES PARA CONSTRUCCIÓN DE MENSAJES PROFESIONALES ==============

/**
 * Construye mensajes profesionales para notificación de documento entregado
 * @param {Object} documento - Datos del documento
 * @param {Object} datosEntrega - Datos de la entrega
 * @returns {Object} Mensajes para WhatsApp y Email
 */
function construirMensajeDocumentoEntregado(documento, datosEntrega) {
  let contextoTramite = '';
  if (documento.detallesAdicionales && 
      typeof documento.detallesAdicionales === 'string' && 
      documento.detallesAdicionales.trim().length > 0) {
    contextoTramite = ` - ${documento.detallesAdicionales.trim()}`;
  }

  const fechaEntrega = new Date().toLocaleDateString('es-EC', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
  
  const horaEntrega = new Date().toLocaleTimeString('es-EC', {
    hour: '2-digit', minute: '2-digit', hour12: false
  });

  // Mensaje WhatsApp usando plantilla centralizada
  const mensajeWhatsApp = configNotaria.plantillas.documentoEntregado.whatsapp
    .replace('{{tipoDocumento}}', documento.tipoDocumento)
    .replace('{{contextoTramite}}', contextoTramite)
    .replace('{{codigoBarras}}', documento.codigoBarras)
    .replace('{{nombreCliente}}', documento.nombreCliente)
    .replace('{{nombreReceptor}}', datosEntrega.nombreReceptor)
    .replace('{{identificacionReceptor}}', datosEntrega.identificacionReceptor)
    .replace('{{relacionReceptor}}', datosEntrega.relacionReceptor)
    .replace('{{fechaEntrega}}', fechaEntrega)
    .replace('{{horaEntrega}}', horaEntrega);

  // Datos para email de confirmación
  const datosEmail = {
    nombreCliente: documento.nombreCliente,
    tipoDocumento: documento.tipoDocumento,
    codigoDocumento: documento.codigoBarras,
    detallesAdicionales: documento.detallesAdicionales?.trim() || null,
    nombreReceptor: datosEntrega.nombreReceptor,
    identificacionReceptor: datosEntrega.identificacionReceptor,
    relacionReceptor: datosEntrega.relacionReceptor,
    fechaEntrega: fechaEntrega,
    horaEntrega: horaEntrega,
    usuarioEntrega: datosEntrega.usuarioEntrega || 'Personal de Recepción',
    fechaGeneracion: new Date().toLocaleString('es-EC')
  };

  return {
    whatsapp: mensajeWhatsApp,
    email: {
      subject: configNotaria.plantillas.documentoEntregado.email.subject.replace('{{codigoBarras}}', documento.codigoBarras),
      template: configNotaria.plantillas.documentoEntregado.email.template,
      data: datosEmail
    },
    tipo: 'documento_entregado'
  };
}

/**
 * Envía notificación de entrega de documento individual
 * @param {Object} documento - Datos del documento
 * @param {Object} datosEntrega - Datos de la entrega
 * @param {Object} usuarioEntrega - Usuario que realizó la entrega
 */
async function enviarNotificacionEntrega(documento, datosEntrega, usuarioEntrega) {
  try {
    const mensajes = construirMensajeDocumentoEntregado(documento, {
      ...datosEntrega,
      usuarioEntrega: usuarioEntrega.nombre
    });

    const metodoNotificacion = documento.metodoNotificacion || 'email';
    
    // Enviar según configuración
    if (metodoNotificacion === 'whatsapp' || metodoNotificacion === 'ambos') {
      if (documento.telefonoCliente) {
        // Aquí se integraría con el servicio de WhatsApp
        console.log(`📱 Confirmación entrega enviada por WhatsApp a ${documento.telefonoCliente}`);
        console.log(`Mensaje: ${mensajes.whatsapp}`);
      }
    }

    if (metodoNotificacion === 'email' || metodoNotificacion === 'ambos') {
      if (documento.emailCliente) {
        // Aquí se integraría con el servicio de Email
        console.log(`📧 Confirmación entrega enviada por email a ${documento.emailCliente}`);
        console.log(`Asunto: ${mensajes.email.subject}`);
      }
    }

    // Registrar en auditoría
    await RegistroAuditoria.create({
      accion: 'notificacion_entrega_enviada',
      tabla: 'documentos',
      registroId: documento.id,
      detalles: {
        tipo: 'documento_entregado',
        metodo: metodoNotificacion,
        receptor: datosEntrega.nombreReceptor
      },
      usuarioId: usuarioEntrega.id
    });

  } catch (error) {
    console.error('Error enviando notificación de entrega:', error);
  }
}

/**
 * Construye mensaje de entrega grupal para notificación
 * @param {Array} documentos - Array de documentos entregados
 * @param {Object} datosEntrega - Datos de la entrega
 * @returns {Object} Mensajes para WhatsApp y Email
 */
function construirMensajeEntregaGrupal(documentos, datosEntrega) {
  const fechaEntrega = new Date().toLocaleDateString('es-EC', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
  
  const horaEntrega = new Date().toLocaleTimeString('es-EC', {
    hour: '2-digit', minute: '2-digit', hour12: false
  });

  // Construir lista de documentos
  let listaDocumentos = '';
  documentos.forEach((doc, index) => {
    let contextoTramite = '';
    if (doc.detallesAdicionales && 
        typeof doc.detallesAdicionales === 'string' && 
        doc.detallesAdicionales.trim().length > 0) {
      contextoTramite = ` - ${doc.detallesAdicionales.trim()}`;
    }
    
    listaDocumentos += `${index + 1}. ${doc.tipoDocumento}${contextoTramite}\n   📋 Código: ${doc.codigoBarras}\n`;
  });

  // Mensaje WhatsApp usando plantilla centralizada
  const mensajeWhatsApp = configNotaria.plantillas.entregaGrupal.whatsapp
    .replace('{{nombreCliente}}', documentos[0].nombreCliente)
    .replace('{{totalDocumentos}}', documentos.length)
    .replace('{{listaDocumentos}}', listaDocumentos)
    .replace('{{nombreReceptor}}', datosEntrega.nombreReceptor)
    .replace('{{identificacionReceptor}}', datosEntrega.identificacionReceptor)
    .replace('{{relacionReceptor}}', datosEntrega.relacionReceptor)
    .replace('{{fechaEntrega}}', fechaEntrega)
    .replace('{{horaEntrega}}', horaEntrega);

  // Datos para email de confirmación grupal
  const datosEmail = {
    nombreCliente: documentos[0].nombreCliente,
    totalDocumentos: documentos.length,
    documentos: documentos.map(doc => ({
      tipoDocumento: doc.tipoDocumento,
      codigoBarras: doc.codigoBarras,
      detallesAdicionales: doc.detallesAdicionales?.trim() || null
    })),
    nombreReceptor: datosEntrega.nombreReceptor,
    identificacionReceptor: datosEntrega.identificacionReceptor,
    relacionReceptor: datosEntrega.relacionReceptor,
    fechaEntrega: fechaEntrega,
    horaEntrega: horaEntrega,
    usuarioEntrega: datosEntrega.usuarioEntrega || 'Personal de Recepción',
    fechaGeneracion: new Date().toLocaleString('es-EC')
  };

  return {
    whatsapp: mensajeWhatsApp,
    email: {
      subject: configNotaria.plantillas.entregaGrupal.email.subject.replace('{{totalDocumentos}}', documentos.length),
      template: configNotaria.plantillas.entregaGrupal.email.template,
      data: datosEmail
    },
    tipo: 'entrega_grupal'
  };
}

/**
 * Guarda notificación grupal en el historial de la base de datos
 * @param {Array} documentos - Array de documentos entregados
 * @param {Object} datosEntrega - Datos de la entrega
 * @param {Object} usuarioEntrega - Usuario que realizó la entrega
 * @param {string} metodoNotificacion - Método de notificación usado
 * @param {string} mensajeEnviado - Mensaje que se envió
 * @returns {Object} Notificación guardada
 */
async function guardarNotificacionGrupalEnHistorial(documentos, datosEntrega, usuarioEntrega, metodoNotificacion, mensajeEnviado) {
  try {
    const documentoPrincipal = documentos[0];
    
    // Detectar documentos con pago pendiente
    const documentosPendientes = documentos.filter(doc => 
      !['pagado_completo', 'pagado_con_retencion'].includes(doc.estadoPago)
    );
    
    const notificacion = await NotificacionEnviada.create({
      // Para entrega grupal, documento_id es null y usamos documentos_ids
      documentoId: null,
      documentosIds: documentos.map(doc => doc.id),
      tipoEvento: 'entrega_grupal',
      tipoEntrega: 'grupal',
      canal: metodoNotificacion === 'ambos' ? 'whatsapp' : metodoNotificacion,
      destinatario: metodoNotificacion.includes('email') ? 
        documentoPrincipal.emailCliente : documentoPrincipal.telefonoCliente,
      estado: 'enviado',
      mensajeEnviado: mensajeEnviado,
      respuestaApi: null,
      intentos: 1,
      metadatos: {
        // Información básica de la entrega
        totalDocumentos: documentos.length,
        nombreCliente: documentoPrincipal.nombreCliente,
        identificacionCliente: documentoPrincipal.identificacionCliente,
        // Información del receptor
        nombreReceptor: datosEntrega.nombreReceptor,
        identificacionReceptor: datosEntrega.identificacionReceptor,
        relacionReceptor: datosEntrega.relacionReceptor,
        // Información del usuario que procesó
        entregadoPor: usuarioEntrega.nombre,
        rolEntregador: usuarioEntrega.rol,
        idUsuarioEntregador: usuarioEntrega.id,
        // Lista de documentos incluidos
        documentosIncluidos: documentos.map(doc => ({
          id: doc.id,
          codigo: doc.codigoBarras,
          tipo: doc.tipoDocumento,
          valor: doc.valorFactura,
          estadoPago: doc.estadoPago,
          matrizador: doc.matrizador?.nombre || 'Sin asignar'
        })),
        // Información especial de validaciones
        documentosPendientes: documentosPendientes.length,
        requirioAutorizacion: documentosPendientes.length > 0,
        entregaConPendientes: documentosPendientes.length > 0,
        // Códigos de los documentos
        codigosDocumentos: documentos.map(doc => doc.codigoBarras),
        tiposDocumentos: documentos.map(doc => doc.tipoDocumento),
        // Metadatos de auditoría
        fechaEntrega: new Date().toISOString(),
        tipoEntregaGrupal: 'recepcion_completa',
        metodoVerificacion: datosEntrega.tipoVerificacion || 'codigo',
        observaciones: datosEntrega.observaciones
      }
    });

    console.log(`📝 [HISTORIAL] Notificación grupal guardada en historial: ID ${notificacion.id}`);
    
    return notificacion;
  } catch (error) {
    console.error('❌ Error guardando notificación grupal en historial:', error);
    throw error;
  }
}

/**
 * Envía notificación de entrega grupal (UNA SOLA NOTIFICACIÓN PARA TODOS LOS DOCUMENTOS)
 * @param {Array} documentos - Array de documentos entregados
 * @param {Object} datosEntrega - Datos de la entrega
 * @param {Object} usuarioEntrega - Usuario que realizó la entrega
 */
async function enviarNotificacionEntregaGrupal(documentos, datosEntrega, usuarioEntrega) {
  try {
    if (!documentos || documentos.length === 0) {
      console.log('⚠️ No hay documentos para notificar en entrega grupal');
      return;
    }

    console.log(`📧 [ENTREGA GRUPAL] Enviando notificación única para ${documentos.length} documentos`);

    const mensajes = construirMensajeEntregaGrupal(documentos, {
      ...datosEntrega,
      usuarioEntrega: usuarioEntrega.nombre
    });

    // Usar la configuración de notificación del primer documento (todos del mismo cliente)
    const documentoPrincipal = documentos[0];
    const metodoNotificacion = documentoPrincipal.metodoNotificacion || 'email';
    
    // Enviar según configuración
    if (metodoNotificacion === 'whatsapp' || metodoNotificacion === 'ambos') {
      if (documentoPrincipal.telefonoCliente) {
        // Aquí se integraría con el servicio de WhatsApp
        console.log(`📱 Confirmación entrega grupal enviada por WhatsApp a ${documentoPrincipal.telefonoCliente}`);
        console.log(`Mensaje: ${mensajes.whatsapp}`);
      }
    }

    if (metodoNotificacion === 'email' || metodoNotificacion === 'ambos') {
      if (documentoPrincipal.emailCliente) {
        // Aquí se integraría con el servicio de Email
        console.log(`📧 Confirmación entrega grupal enviada por email a ${documentoPrincipal.emailCliente}`);
        console.log(`Asunto: ${mensajes.email.subject}`);
      }
    }

    // ============== NUEVO: GUARDAR EN HISTORIAL DE NOTIFICACIONES ==============
    try {
      await guardarNotificacionGrupalEnHistorial(
        documentos, 
        datosEntrega, 
        usuarioEntrega, 
        metodoNotificacion, 
        mensajes.whatsapp
      );
    } catch (historialError) {
      console.error('❌ Error guardando en historial (continuando):', historialError);
      // No detener el flujo si falla el historial
    }

    // Registrar evento de notificación grupal para cada documento
    for (const documento of documentos) {
      try {
        await EventoDocumento.create({
          documentoId: documento.id,
          tipo: 'notificacion_grupal',
          categoria: 'notificacion',
          titulo: 'Notificación Entrega Grupal',
          descripcion: `Notificación de entrega grupal enviada para ${documentos.length} documentos`,
          detalles: {
            tipoNotificacion: 'entrega_grupal',
            totalDocumentos: documentos.length,
            metodoNotificacion: metodoNotificacion,
            receptor: datosEntrega.nombreReceptor,
            documentosIncluidos: documentos.map(d => ({
              id: d.id,
              codigo: d.codigoBarras,
              tipo: d.tipoDocumento
            }))
          },
          usuario: usuarioEntrega.nombre,
          metadatos: {
            canal: metodoNotificacion,
            estado: 'enviada',
            tipo: 'notificacion_grupal',
            idUsuario: usuarioEntrega.id,
            rolUsuario: usuarioEntrega.rol,
            timestamp: new Date().toISOString()
          }
        });
      } catch (eventError) {
        console.error(`Error registrando evento de notificación para documento ${documento.id}:`, eventError);
      }
    }

    console.log(`✅ [ENTREGA GRUPAL] Notificación única enviada exitosamente para ${documentos.length} documentos`);

  } catch (error) {
    console.error('Error enviando notificación de entrega grupal:', error);
  }
}

// ============== FUNCIONES PARA ENTREGA GRUPAL - RECEPCIÓN ==============

/**
 * Valida documentos para entrega y genera alertas específicas
 * @param {Array} documentos - Array de documentos a validar
 * @returns {Object} Validación con alertas específicas
 */
function validarDocumentosParaEntrega(documentos) {
  const documentosValidos = [];
  const documentosPendientes = [];
  const alertas = [];
  
  for (const documento of documentos) {
    // Verificar estado de pago
    const tienePagoPendiente = !['pagado_completo', 'pagado_con_retencion'].includes(documento.estadoPago);
    
    if (tienePagoPendiente) {
      documentosPendientes.push(documento);
      alertas.push({
        tipo: 'pago_pendiente',
        codigo: documento.codigoBarras,
        tipoDocumento: documento.tipoDocumento,
        valor: documento.valorFactura,
        estadoPago: documento.estadoPago,
        matrizador: documento.matrizador?.nombre || 'Sin asignar',
        mensaje: `${documento.codigoBarras} - ${documento.tipoDocumento} tiene pago pendiente (${documento.estadoPago})`
      });
    }
    
    documentosValidos.push(documento);
  }

  return {
    puedeEntregar: true, // Recepción siempre puede entregar pero con confirmación
    requiereAutorizacion: documentosPendientes.length > 0,
    documentosPendientes: documentosPendientes,
    documentosValidos: documentosValidos,
    alertas: alertas,
    totalDocumentos: documentos.length,
    documentosPagados: documentos.length - documentosPendientes.length,
    advertencias: documentosPendientes.length > 0 ? [
      {
        tipo: 'autorizacion_requerida',
        mensaje: `Se requiere confirmación para entregar ${documentosPendientes.length} documento(s) con pago pendiente`
      }
    ] : []
  };
}

/**
 * Detecta documentos adicionales del mismo cliente para entrega grupal (RECEPCIÓN - SIN RESTRICCIONES)
 * @param {string} identificacionCliente - Identificación del cliente
 * @param {number} documentoActualId - ID del documento actual para excluir
 * @returns {Object} Información sobre documentos adicionales
 */
async function detectarDocumentosGrupalesRecepcion(identificacionCliente, documentoActualId) {
  try {
    console.log(`🔍 [RECEPCIÓN] Detectando documentos grupales para cliente: ${identificacionCliente}`);
    
    // NUEVA LÓGICA: Detectar TODOS los documentos listos, independientemente del pago
    const documentosListos = await Documento.findAll({
      where: {
        identificacionCliente: identificacionCliente,
        estado: 'listo_para_entrega',
        fechaEntrega: null,
        id: { [Op.ne]: documentoActualId },
        motivoEliminacion: null
        // REMOVIDO: Validación de estadoPago
      },
      include: [{ 
        model: Matrizador, 
        as: 'matrizador',
        attributes: ['id', 'nombre'] 
      }],
      order: [['created_at', 'ASC']]
    });
    
    // SEPARAR documentos por estado de pago
    const documentosPagados = documentosListos.filter(doc => 
      ['pagado_completo', 'pagado_con_retencion'].includes(doc.estadoPago)
    );
    
    const documentosPendientes = documentosListos.filter(doc => 
      !['pagado_completo', 'pagado_con_retencion'].includes(doc.estadoPago)
    );
    
    console.log(`📄 [RECEPCIÓN] Encontrados ${documentosListos.length} documentos adicionales (${documentosPagados.length} pagados, ${documentosPendientes.length} pendientes)`);
    
    // ============== NUEVA FUNCIONALIDAD: VALIDACIÓN Y ALERTAS ==============
    const validacion = validarDocumentosParaEntrega(documentosListos);
    
    return {
      tieneDocumentosAdicionales: documentosListos.length > 0,
      cantidad: documentosListos.length,
      documentos: documentosListos,
      documentosPagados: documentosPagados,
      documentosPendientes: documentosPendientes,
      tipoDeteccion: 'recepcion_completa',
      // Nueva información de validación
      validacion: validacion,
      requiereAutorizacion: validacion.requiereAutorizacion,
      alertas: validacion.alertas,
      advertencias: validacion.advertencias
    };
  } catch (error) {
    console.error('❌ Error detectando documentos grupales para recepción:', error);
    return { 
      tieneDocumentosAdicionales: false, 
      cantidad: 0, 
      documentos: [],
      documentosPagados: [],
      documentosPendientes: [],
      tipoDeteccion: 'recepcion_completa',
      validacion: { puedeEntregar: false, requiereAutorizacion: false, alertas: [] },
      requiereAutorizacion: false,
      alertas: [],
      advertencias: []
    };
  }
}

/**
 * Procesa entrega grupal para recepción (sin restricciones de matrizador)
 * @param {Array} documentosIds - IDs de documentos a entregar
 * @param {Object} datosEntrega - Datos del receptor
 * @param {Object} usuario - Usuario que procesa la entrega
 * @param {Object} transaction - Transacción de base de datos
 * @returns {Object} Resultado del procesamiento
 */
async function procesarEntregaGrupalRecepcion(documentosIds, datosEntrega, usuario, transaction) {
  try {
    console.log(`🏢 [RECEPCIÓN] Procesando entrega grupal de ${documentosIds.length} documentos`);
    
    const documentosActualizados = [];
    const erroresValidacion = [];
    
    for (const docId of documentosIds) {
      try {
        const documento = await Documento.findByPk(docId, { transaction });
        
        if (!documento) {
          erroresValidacion.push(`Documento ${docId} no encontrado`);
          continue;
        }
        
        // VALIDACIONES DE SEGURIDAD BÁSICAS (SIN VALIDACIÓN ESTRICTA DE PAGO)
        if (documento.estado !== 'listo_para_entrega') {
          erroresValidacion.push(`Documento ${documento.codigoBarras} no está listo para entrega`);
          continue;
        }
        
        if (documento.fechaEntrega !== null) {
          erroresValidacion.push(`Documento ${documento.codigoBarras} ya fue entregado`);
          continue;
        }
        
        if (documento.identificacionCliente !== datosEntrega.identificacionCliente) {
          erroresValidacion.push(`Documento ${documento.codigoBarras} no pertenece al cliente`);
          continue;
        }
        
        // NUEVA LÓGICA: Registrar estado de pago pero no bloquear entrega
        const tienePagoPendiente = !['pagado_completo', 'pagado_con_retencion'].includes(documento.estadoPago);
        if (tienePagoPendiente) {
          console.log(`⚠️ [RECEPCIÓN] Documento ${documento.codigoBarras} tiene pago pendiente: ${documento.estadoPago}`);
        }
        
        // ACTUALIZAR DOCUMENTO
        await documento.update({
          estado: 'entregado',
          fechaEntrega: new Date(),
          nombreReceptor: datosEntrega.nombreReceptor,
          identificacionReceptor: datosEntrega.identificacionReceptor,
          relacionReceptor: datosEntrega.relacionReceptor
        }, { transaction });
        
        // REGISTRAR EVENTO DE ENTREGA GRUPAL CON ESTADO DE PAGO
        await EventoDocumento.create({
          documentoId: documento.id,
          tipo: 'entrega_grupal',
          categoria: 'entrega',
          titulo: 'Entrega Grupal - Recepción',
          descripcion: `Documento entregado en entrega grupal por recepción a ${datosEntrega.nombreReceptor}`,
          detalles: {
            entregaGrupal: true,
            totalDocumentosGrupo: documentosIds.length,
            tipoEntregaGrupal: 'recepcion_completa',
            rolProcesador: 'recepcion',
            nombreReceptor: datosEntrega.nombreReceptor,
            identificacionReceptor: datosEntrega.identificacionReceptor,
            relacionReceptor: datosEntrega.relacionReceptor,
            // NUEVA INFORMACIÓN: Estado de pago al momento de entrega
            estadoPagoAlEntrega: documento.estadoPago,
            tienePagoPendiente: tienePagoPendiente,
            entregaConPendientes: datosEntrega.confirmarEntregaPendiente === 'true',
            validacionesAplicadas: [
              'estado_verificado',
              'no_entregado_previamente',
              'pertenencia_cliente_confirmada'
              // REMOVIDO: 'pago_validado' (ya no es obligatorio)
            ],
            metodoVerificacion: datosEntrega.tipoVerificacion,
            observaciones: datosEntrega.observaciones
          },
          usuario: usuario.nombre,
          metadatos: {
            canal: 'sistema',
            estado: 'procesada',
            tipo: 'entrega_grupal',
            idUsuario: usuario.id,
            rolUsuario: usuario.rol,
            timestamp: new Date().toISOString()
          }
        }, { transaction });
        
        documentosActualizados.push(documento);
        console.log(`✅ [RECEPCIÓN] Documento ${documento.codigoBarras} entregado grupalmente`);
        
      } catch (docError) {
        console.error(`❌ Error procesando documento ${docId}:`, docError);
        erroresValidacion.push(`Error en documento ${docId}: ${docError.message}`);
      }
    }
    
    if (erroresValidacion.length > 0) {
      throw new Error(`Errores de validación: ${erroresValidacion.join('; ')}`);
    }
    
    return {
      exito: true,
      documentosActualizados: documentosActualizados.length,
      documentos: documentosActualizados
    };
    
  } catch (error) {
    console.error('❌ Error en procesamiento grupal recepción:', error);
    throw error;
  }
}

const recepcionController = {
  /**
   * Muestra el dashboard de recepción con estadísticas y documentos pendientes
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  dashboard: async (req, res) => {
    console.log("Accediendo al dashboard de recepción");
    console.log("Usuario:", req.matrizador?.nombre, "Rol:", req.matrizador?.rol);
    console.log("Ruta solicitada:", req.originalUrl);
    
    try {
      // Procesar parámetros de período
      const tipoPeriodo = req.query.tipoPeriodo || 'mes';
      let fechaInicio, fechaFin;
      const hoy = moment().startOf('day');
      
      // Establecer fechas según el período seleccionado
      switch (tipoPeriodo) {
        case 'hoy':
          fechaInicio = hoy.clone();
          fechaFin = moment().endOf('day');
          break;
        case 'semana':
          fechaInicio = hoy.clone().startOf('week');
          fechaFin = moment().endOf('day');
          break;
        case 'mes':
          fechaInicio = hoy.clone().startOf('month');
          fechaFin = moment().endOf('day');
          break;
        case 'ultimo_mes':
          fechaInicio = hoy.clone().subtract(30, 'days');
          fechaFin = moment().endOf('day');
          break;
        case 'personalizado':
          fechaInicio = req.query.fechaInicio ? moment(req.query.fechaInicio) : hoy.clone().startOf('month');
          fechaFin = req.query.fechaFin ? moment(req.query.fechaFin).endOf('day') : moment().endOf('day');
          break;
        default:
          fechaInicio = hoy.clone().startOf('month');
          fechaFin = moment().endOf('day');
      }
      
      // Formatear fechas para las consultas
      const fechaInicioSQL = fechaInicio.format('YYYY-MM-DD HH:mm:ss');
      const fechaFinSQL = fechaFin.format('YYYY-MM-DD HH:mm:ss');
      
      // Número total de documentos listos para entrega
      const [documentosListos] = await sequelize.query(`
        SELECT COUNT(*) as total
        FROM documentos
        WHERE estado = 'listo_para_entrega'
      `, {
        type: sequelize.QueryTypes.SELECT
      });
      
      // Número de documentos entregados hoy
      const [entregadosHoy] = await sequelize.query(`
        SELECT COUNT(*) as total
        FROM documentos
        WHERE estado = 'entregado'
        AND DATE(fecha_entrega) = CURRENT_DATE
      `, {
        type: sequelize.QueryTypes.SELECT
      });
      
      // Total de documentos entregados en el período
      const [entregadosPeriodo] = await sequelize.query(`
        SELECT COUNT(*) as total
        FROM documentos
        WHERE estado = 'entregado'
        AND fecha_entrega BETWEEN :fechaInicio AND :fechaFin
      `, {
        replacements: {
          fechaInicio: fechaInicioSQL,
          fechaFin: fechaFinSQL
        },
        type: sequelize.QueryTypes.SELECT
      });
      
      // Tiempo promedio que tarda un documento en ser retirado desde que está listo
      const [tiempoRetiro] = await sequelize.query(`
        SELECT AVG(EXTRACT(EPOCH FROM (fecha_entrega - updated_at))/86400) as promedio
        FROM documentos
        WHERE estado = 'entregado'
        AND fecha_entrega BETWEEN :fechaInicio AND :fechaFin
      `, {
        replacements: {
          fechaInicio: fechaInicioSQL,
          fechaFin: fechaFinSQL
        },
        type: sequelize.QueryTypes.SELECT
      });
      
      // Documentos pendientes de retiro con más de 7 días
      const [pendientesUrgentes] = await sequelize.query(`
        SELECT COUNT(*) as total
        FROM documentos
        WHERE estado = 'listo_para_entrega'
        AND EXTRACT(EPOCH FROM (NOW() - updated_at))/86400 > 7
      `, {
        type: sequelize.QueryTypes.SELECT
      });
      
      // Obtener documentos pendientes de retiro con detalles
      const docsSinRetirar = await Documento.findAll({
        where: {
          estado: 'listo_para_entrega',
          [Op.and]: [
            sequelize.literal(`EXTRACT(EPOCH FROM (NOW() - "Documento"."updated_at"))/86400 >= 5`)
          ]
        },
        include: [
          {
            model: Matrizador,
            as: 'matrizador',
            attributes: ['id', 'nombre']
          }
        ],
        order: [
          [sequelize.literal(`EXTRACT(EPOCH FROM (NOW() - "Documento"."updated_at"))/86400`), 'DESC']
        ],
        limit: 10
      });
      
      // Procesar documentos sin retirar para añadir métricas
      const documentosSinRetirar = docsSinRetirar.map(doc => {
        const diasPendiente = moment().diff(moment(doc.updated_at), 'days');
        return {
          ...doc.toJSON(),
          diasPendiente,
          porcentajeDemora: Math.min(diasPendiente * 5, 100) // Escala de 0-100 para barra de progreso
        };
      });
      
      // Obtener documentos listos para entrega
      const docsListos = await Documento.findAll({
        where: {
          estado: 'listo_para_entrega'
        },
        include: [
          {
            model: Matrizador,
            as: 'matrizador',
            attributes: ['id', 'nombre']
          }
        ],
        order: [['created_at', 'DESC']],
        limit: 10
      });
      
      // Obtener últimos documentos entregados
      const ultimasEntregas = await Documento.findAll({
        where: {
          estado: 'entregado'
        },
        order: [['created_at', 'DESC']],
        limit: 10
      });
      
      // Datos para gráfico de entregas por día
      const datosEntregas = await sequelize.query(`
        SELECT 
          TO_CHAR(fecha_entrega, 'YYYY-MM-DD') as fecha,
          COUNT(*) as total
        FROM documentos
        WHERE estado = 'entregado'
        AND fecha_entrega BETWEEN :fechaInicio AND :fechaFin
        GROUP BY TO_CHAR(fecha_entrega, 'YYYY-MM-DD')
        ORDER BY fecha
      `, {
        replacements: {
          fechaInicio: fechaInicioSQL,
          fechaFin: fechaFinSQL
        },
        type: sequelize.QueryTypes.SELECT
      });
      
      // Datos para gráfico de tiempo promedio de retiro por tipo de documento
      const datosTiempos = await sequelize.query(`
        SELECT 
          tipo_documento,
          AVG(EXTRACT(EPOCH FROM (fecha_entrega - updated_at))/86400) as promedio
        FROM documentos
        WHERE estado = 'entregado'
        AND fecha_entrega BETWEEN :fechaInicio AND :fechaFin
        GROUP BY tipo_documento
        ORDER BY promedio DESC
      `, {
        replacements: {
          fechaInicio: fechaInicioSQL,
          fechaFin: fechaFinSQL
        },
        type: sequelize.QueryTypes.SELECT
      });
      
      // Datos para gráfico de documentos entregados por matrizador
      const datosMatrizadores = await sequelize.query(`
        SELECT 
          m.nombre as matrizador,
          COUNT(d.id) as total
        FROM documentos d
        JOIN matrizadores m ON d.id_matrizador = m.id
        WHERE d.estado = 'entregado'
        AND d.fecha_entrega BETWEEN :fechaInicio AND :fechaFin
        GROUP BY m.id, m.nombre
        ORDER BY total DESC
        LIMIT 10
      `, {
        replacements: {
          fechaInicio: fechaInicioSQL,
          fechaFin: fechaFinSQL
        },
        type: sequelize.QueryTypes.SELECT
      });
      
      // Preparar datos para los gráficos
      const datosGraficos = {
        entregas: {
          labels: datosEntregas.map(d => d.fecha),
          datos: datosEntregas.map(d => d.total)
        },
        tiempos: {
          labels: datosTiempos.map(d => d.tipo_documento),
          datos: datosTiempos.map(d => parseFloat(d.promedio).toFixed(1))
        },
        matrizadores: {
          labels: datosMatrizadores.map(d => d.matrizador),
          datos: datosMatrizadores.map(d => d.total)
        }
      };
      
      // Preparar datos de período para la plantilla
      const periodoData = {
        esHoy: tipoPeriodo === 'hoy',
        esSemana: tipoPeriodo === 'semana',
        esMes: tipoPeriodo === 'mes',
        esUltimoMes: tipoPeriodo === 'ultimo_mes',
        esPersonalizado: tipoPeriodo === 'personalizado',
        fechaInicio: fechaInicio.format('YYYY-MM-DD'),
        fechaFin: fechaFin.format('YYYY-MM-DD')
      };
      
      // Preparar estadísticas para la plantilla
      const stats = {
        listos: documentosListos.total || 0,
        entregadosHoy: entregadosHoy.total || 0,
        totalEntregados: entregadosPeriodo.total || 0,
        tiempoRetiro: tiempoRetiro.promedio ? parseFloat(tiempoRetiro.promedio).toFixed(1) : "0.0",
        pendientesUrgentes: pendientesUrgentes.total || 0,
        docsSinRetirar: documentosSinRetirar
      };
      
      res.render('recepcion/dashboard', { 
        layout: 'recepcion', 
        title: 'Panel de Recepción', 
        userRole: req.matrizador?.rol, 
        userName: req.matrizador?.nombre,
        usuario: {
          id: req.matrizador?.id,
          rol: req.matrizador?.rol,
          nombre: req.matrizador?.nombre
        },
        stats,
        periodo: periodoData,
        documentosListos: docsListos,
        ultimasEntregas,
        datosGraficos
      });
    } catch (error) {
      console.error("Error al cargar el dashboard de recepción:", error);
      res.status(500).render('error', {
        layout: 'recepcion',
        title: 'Error',
        message: 'Ha ocurrido un error al cargar el dashboard',
        error
      });
    }
  },
  
  listarDocumentos: async (req, res) => {
    console.log("Accediendo al listado de documentos de recepción");
    console.log("Usuario:", req.matrizador?.nombre, "Rol:", req.matrizador?.rol);
    console.log("Ruta solicitada:", req.originalUrl);
    
    try {
      // Parámetros de paginación
      const page = parseInt(req.query.page) || 1;
      const limit = 10;
      const offset = (page - 1) * limit;
      
      // Parámetros de filtrado
      const estado = req.query.estado || '';
      const estadoPago = req.query.estadoPago || '';
      const tipoDocumento = req.query.tipoDocumento || '';
      const idMatrizador = req.query.idMatrizador || '';
      const busqueda = req.query.busqueda || '';
      
      // Construir condiciones de filtrado
      const where = {};
      
      if (estado) {
        where.estado = estado;
      }
      
      if (estadoPago) {
        where.estadoPago = estadoPago;
      }
      
      if (tipoDocumento) {
        where.tipo_documento = tipoDocumento;
      }
      
      if (idMatrizador) {
        where.id_matrizador = idMatrizador;
      }
      
      if (busqueda) {
        where[Op.or] = [
          { codigo_barras: { [Op.iLike]: `%${busqueda}%` } },
          { nombre_cliente: { [Op.iLike]: `%${busqueda}%` } }
        ];
      }
      
      console.log("Buscando documentos con filtros:", where);
      
      // Obtener documentos con paginación y datos del matrizador
      const { count, rows: documentos } = await Documento.findAndCountAll({
        where,
        include: [
          {
            model: Matrizador,
            as: 'matrizador',
            attributes: ['id', 'nombre']
          }
        ],
        order: [['created_at', 'DESC']],
        limit,
        offset
      });
      
      console.log("Documentos encontrados para recepción:", documentos ? documentos.length : 'ninguno');
      if (documentos && documentos.length > 0) {
        console.log("Primer documento:", documentos[0].dataValues);
      }
      
      // Preparar datos para la paginación
      const totalPages = Math.ceil(count / limit);
      const pagination = {
        pages: []
      };
      
      // Generar URLs para la paginación
      const baseUrl = '/recepcion/documentos?';
      const queryParams = new URLSearchParams();
      
      if (estado) queryParams.append('estado', estado);
      if (estadoPago) queryParams.append('estadoPago', estadoPago);
      if (tipoDocumento) queryParams.append('tipoDocumento', tipoDocumento);
      if (idMatrizador) queryParams.append('idMatrizador', idMatrizador);
      if (busqueda) queryParams.append('busqueda', busqueda);
      
      // Generar enlaces de paginación
      for (let i = 1; i <= totalPages; i++) {
        const params = new URLSearchParams(queryParams);
        params.set('page', i);
        
        pagination.pages.push({
          num: i,
          url: baseUrl + params.toString(),
          active: i === page
        });
      }
      
      // Enlaces de anterior y siguiente
      if (page > 1) {
        const params = new URLSearchParams(queryParams);
        params.set('page', page - 1);
        pagination.prev = baseUrl + params.toString();
      }
      
      if (page < totalPages) {
        const params = new URLSearchParams(queryParams);
        params.set('page', page + 1);
        pagination.next = baseUrl + params.toString();
      }
      
      // Obtener tipos de documento para filtros
      const tiposDocumentoQuery = await Documento.findAll({
        attributes: [[sequelize.fn('DISTINCT', sequelize.col('tipo_documento')), 'tipo']],
        raw: true
      });
      
      const tiposDocumento = tiposDocumentoQuery.map(t => t.tipo).filter(Boolean);
      
      // Obtener matrizadores para el filtro
      const matrizadores = await Matrizador.findAll({
        attributes: ['id', 'nombre'],
        order: [['nombre', 'ASC']],
        raw: true
      });
      
      res.render('recepcion/documentos/listado', {
        layout: 'recepcion',
        title: 'Listado de Documentos',
        documentos,
        pagination,
        tiposDocumento,
        matrizadores,
        filtros: {
          estado: {
            [estado]: true
          },
          estadoPago,
          tipoDocumento,
          idMatrizador,
          busqueda
        },
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre,
        usuario: {
          id: req.matrizador?.id,
          rol: req.matrizador?.rol,
          nombre: req.matrizador?.nombre
        }
      });
    } catch (error) {
      console.error('Error al listar documentos para recepción:', error);
      res.status(500).render('error', {
        layout: 'recepcion',
        title: 'Error',
        message: 'Ha ocurrido un error al cargar el listado de documentos',
        error
      });
    }
  },
  
  detalleDocumento: async (req, res) => {
    console.log("Accediendo al detalle de documento de recepción");
    console.log("Usuario:", req.matrizador?.nombre, "Rol:", req.matrizador?.rol);
    console.log("Ruta solicitada:", req.originalUrl);
    
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).render('error', {
          layout: 'recepcion',
          title: 'Error',
          message: 'ID de documento no proporcionado'
        });
      }
      
      // Buscar el documento con relaciones
      const documento = await Documento.findOne({
        where: { id },
        include: [
          {
            model: Matrizador,
            as: 'matrizador',
            attributes: ['id', 'nombre', 'email']
          }
        ]
      });
      
      if (!documento) {
        return res.render('recepcion/documentos/detalle', {
          layout: 'recepcion',
          title: 'Detalle de Documento',
          documento: null,
          error: 'El documento solicitado no existe',
          userRole: req.matrizador?.rol,
          userName: req.matrizador?.nombre,
          usuario: {
            id: req.matrizador?.id,
            rol: req.matrizador?.rol,
            nombre: req.matrizador?.nombre
          }
        });
      }

      // Obtener información del usuario que registró el pago
      let usuarioPago = null;
      if (documento.registradoPor) {
        usuarioPago = await Matrizador.findByPk(documento.registradoPor, {
          attributes: ['id', 'nombre', 'rol']
        });
      }

      // Obtener eventos del historial
      const eventos = await EventoDocumento.findAll({
        where: { documentoId: id },
        order: [['created_at', 'DESC']]
      });

      // Procesar eventos para mostrar en el historial
      const eventosFormateados = eventos.map(evento => {
        const eventoData = {
          id: evento.id,
          tipo: evento.tipo,
          categoria: evento.categoria,
          titulo: evento.titulo,
          descripcion: evento.descripcion,
          fecha: evento.created_at,
          usuario: evento.usuario || 'Sistema',
          detalles: evento.detalles || {},
          color: 'secondary'
        };

        // Asignar colores según el tipo de evento
        switch (evento.tipo) {
          case 'pago':
            eventoData.color = 'success';
            break;
          case 'entrega':
            eventoData.color = 'info';
            break;
          case 'estado':
            eventoData.color = 'warning';
            break;
          case 'asignacion':
            eventoData.color = 'primary';
            break;
          default:
            eventoData.color = 'secondary';
        }

        // Calcular tiempo transcurrido
        const ahora = new Date();
        const fechaEvento = new Date(evento.created_at);
        const diffMs = ahora - fechaEvento;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);

        if (diffDays > 0) {
          eventoData.tiempoTranscurrido = `${diffDays} día${diffDays > 1 ? 's' : ''}`;
        } else if (diffHours > 0) {
          eventoData.tiempoTranscurrido = `${diffHours} hora${diffHours > 1 ? 's' : ''}`;
        } else {
          const diffMinutes = Math.floor(diffMs / (1000 * 60));
          eventoData.tiempoTranscurrido = diffMinutes > 0 ? `${diffMinutes} min` : 'Ahora';
        }

        return eventoData;
      });

      // Obtener lista de matrizadores para el modal de cambio
      const matrizadores = await Matrizador.findAll({
        where: {
          rol: { [Op.in]: ['matrizador', 'caja_archivo'] },
          activo: true
        },
        attributes: ['id', 'nombre'],
        order: [['nombre', 'ASC']]
      });
      
      console.log("Documento encontrado:", documento.id, documento.codigoBarras);
      
      res.render('recepcion/documentos/detalle', {
        layout: 'recepcion',
        title: 'Detalle de Documento',
        documento,
        eventos: eventosFormateados,
        usuarioPago,
        matrizadores,
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre,
        usuario: {
          id: req.matrizador?.id,
          rol: req.matrizador?.rol,
          nombre: req.matrizador?.nombre
        }
      });
    } catch (error) {
      console.error('Error al obtener detalle de documento:', error);
      res.status(500).render('error', {
        layout: 'recepcion',
        title: 'Error',
        message: 'Ha ocurrido un error al cargar el detalle del documento',
        error
      });
    }
  },
  
  mostrarEntrega: async (req, res) => {
    console.log("Accediendo a la entrega de documento de recepción");
    console.log("Usuario:", req.matrizador?.nombre, "Rol:", req.matrizador?.rol);
    console.log("Ruta solicitada:", req.originalUrl);
    
    try {
      const documentoId = req.params.id;
      const codigo = req.query.codigo;
      const nombre = req.query.nombre;
      const identificacion = req.query.identificacion;
      const fechaDesde = req.query.fechaDesde;
      const fechaHasta = req.query.fechaHasta;
      const matrizador = req.query.matrizador;
      
      // Si hay un ID, mostrar formulario de entrega para ese documento
      if (documentoId) {
        const documento = await Documento.findOne({
          where: {
            id: documentoId,
            estado: 'listo_para_entrega'
          },
          include: [
            {
              model: Matrizador,
              as: 'matrizador',
              attributes: ['id', 'nombre']
            }
          ]
        });
        
        if (!documento) {
          req.flash('error', 'El documento no existe o no está listo para entrega');
          return res.redirect('/recepcion/documentos/entrega');
        }
        
        // ============== NUEVA FUNCIONALIDAD: DETECTAR DOCUMENTOS GRUPALES ==============
        let documentosGrupales = null;
        if (documento.estado === 'listo_para_entrega' && 
            documento.fechaEntrega === null &&
            ['pagado_completo', 'pagado_con_retencion'].includes(documento.estadoPago) &&
            documento.identificacionCliente) {
          
          console.log(`🔍 [RECEPCIÓN] Verificando documentos grupales para cliente: ${documento.identificacionCliente}`);
          documentosGrupales = await detectarDocumentosGrupalesRecepcion(
            documento.identificacionCliente, 
            documento.id
          );
          
          // ============== NUEVA FUNCIONALIDAD: VALIDACIÓN COMPLETA INCLUYENDO DOCUMENTO PRINCIPAL ==============
          if (documentosGrupales.tieneDocumentosAdicionales) {
            const todosLosDocumentos = [documento, ...documentosGrupales.documentos];
            const validacionCompleta = validarDocumentosParaEntrega(todosLosDocumentos);
            
            // Actualizar información de validación
            documentosGrupales.validacionCompleta = validacionCompleta;
            documentosGrupales.requiereAutorizacion = validacionCompleta.requiereAutorizacion;
            documentosGrupales.alertas = validacionCompleta.alertas;
            documentosGrupales.advertencias = validacionCompleta.advertencias;
            documentosGrupales.documentosPendientes = validacionCompleta.documentosPendientes;
            
            console.log(`📋 [VALIDACIÓN] Documentos pendientes detectados: ${validacionCompleta.documentosPendientes.length}`);
          }
        }
        
        return res.render('recepcion/documentos/entrega', {
          layout: 'recepcion',
          title: 'Entrega de Documento',
          documento,
          documentosGrupales,
          tipoEntrega: 'recepcion_completa',
          userRole: req.matrizador?.rol,
          userName: req.matrizador?.nombre,
          usuario: {
            id: req.matrizador?.id,
            rol: req.matrizador?.rol,
            nombre: req.matrizador?.nombre
          }
        });
      }
      
      // Si hay un código de barras, buscar por código
      if (codigo) {
        const documento = await Documento.findOne({
          where: {
            codigo_barras: codigo,
            estado: 'listo_para_entrega'
          }
        });
        
        if (documento) {
          return res.redirect(`/recepcion/documentos/entrega/${documento.id}`);
        }
        
        req.flash('error', 'No se encontró un documento listo para entrega con ese código');
      }
      
      // Construir filtros para la búsqueda
      const whereClause = {
        estado: 'listo_para_entrega'
      };
      
      // Aplicar filtros si hay parámetros
      if (nombre) {
        whereClause.nombreCliente = { [Op.like]: `%${nombre}%` };
      }
      
      if (identificacion) {
        whereClause.identificacionCliente = { [Op.like]: `%${identificacion}%` };
      }
      
      // Filtro por fecha
      if (fechaDesde || fechaHasta) {
        whereClause.created_at = {};
        if (fechaDesde) {
          whereClause.created_at[Op.gte] = new Date(fechaDesde + 'T00:00:00');
        }
        if (fechaHasta) {
          whereClause.created_at[Op.lte] = new Date(fechaHasta + 'T23:59:59');
        }
      }
      
      // Incluir filtro por matrizador si está presente
      let matrizadorInclude = {
        model: Matrizador,
        as: 'matrizador',
        attributes: ['id', 'nombre']
      };
      
      if (matrizador) {
        matrizadorInclude.where = {
          nombre: { [Op.like]: `%${matrizador}%` }
        };
      }
      
      // Obtener documentos listos para entrega con filtros aplicados
      const documentosListos = await Documento.findAll({
        where: whereClause,
        include: [
          matrizadorInclude
        ],
        order: [['created_at', 'DESC']],
        limit: 50
      });
      
      console.log(`Documentos listos para entrega encontrados: ${documentosListos.length}`);
      
      return res.render('recepcion/documentos/entrega', {
        layout: 'recepcion',
        title: 'Entrega de Documentos',
        documentosListos,
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre,
        filtros: {
          codigo,
          nombre,
          identificacion,
          fechaDesde,
          fechaHasta,
          matrizador
        }
      });
    } catch (error) {
      console.error('Error al mostrar la página de entrega:', error);
      res.status(500).render('error', {
        layout: 'recepcion',
        title: 'Error',
        message: 'Ha ocurrido un error al cargar la página de entrega de documentos',
        error
      });
    }
  },
  
  completarEntrega: async (req, res) => {
    console.log("Completando entrega de documento como recepción");
    console.log("Usuario:", req.matrizador?.nombre, "Rol:", req.matrizador?.rol);
    console.log("Ruta solicitada:", req.originalUrl);
    console.log("Datos recibidos:", req.body);
    
    const transaction = await sequelize.transaction();
    
    try {
      const { id } = req.params;
      const { 
        codigoVerificacion, 
        nombreReceptor, 
        identificacionReceptor, 
        relacionReceptor, 
        tipoVerificacion, 
        observaciones,
        // ============== NUEVOS CAMPOS PARA ENTREGA GRUPAL ==============
        entregaGrupal,
        documentosAdicionales,
        tipoEntregaGrupal,
        // ============== NUEVOS CAMPOS PARA VALIDACIÓN DE PAGOS ==============
        confirmarEntregaPendiente,
        autorizacionMatrizador
      } = req.body;
      
      if (!id) {
        await transaction.rollback();
        req.flash('error', 'ID de documento no proporcionado');
        return res.redirect('/recepcion/documentos/entrega');
      }
      
      // Buscar el documento
      const documento = await Documento.findOne({
        where: {
          id,
          estado: 'listo_para_entrega'
        },
        include: [
          {
            model: Matrizador,
            as: 'matrizador',
            attributes: ['id', 'nombre']
          }
        ],
        transaction
      });
      
      if (!documento) {
        await transaction.rollback();
        req.flash('error', 'El documento no existe o no está listo para entrega');
        return res.redirect('/recepcion/documentos/entrega');
      }
      
      // ============== VALIDACIÓN: PREVENIR ENTREGA INDIVIDUAL DE DOCUMENTOS HABILITANTES ==============
      
      // Si es un documento habilitante, verificar si se debe entregar junto con el principal
      if (!documento.esDocumentoPrincipal && documento.documentoPrincipalId) {
        console.log(`⚠️ Intento de entregar documento habilitante ID: ${documento.id} individualmente`);
        
        // Buscar el documento principal para verificar su estado
        const documentoPrincipal = await Documento.findByPk(documento.documentoPrincipalId, { transaction });
        
        if (documentoPrincipal && documentoPrincipal.estado === 'listo_para_entrega') {
          await transaction.rollback();
          req.flash('error', `Este documento habilitante se debe entregar junto con el documento principal "${documentoPrincipal.codigoBarras}". Por favor, procese la entrega del documento principal.`);
          return res.redirect(`/recepcion/documentos/entrega/${documentoPrincipal.id}`);
        } else if (documentoPrincipal && documentoPrincipal.estado === 'entregado') {
          // Si el principal ya fue entregado, permitir entrega individual del habilitante
          console.log(`ℹ️ El documento principal ya fue entregado, permitiendo entrega individual del habilitante`);
        } else {
          await transaction.rollback();
          req.flash('error', `No se puede entregar este documento habilitante porque el documento principal no está disponible o no está listo para entrega.`);
          return res.redirect('/recepcion/documentos/entrega');
        }
      }
      
      // ============== VALIDACIÓN ACTUALIZADA: CÓDIGO DE VERIFICACIÓN CONDICIONAL ==============
      
      // Verificar si el documento tiene código de verificación
      const tieneCodigoVerificacion = documento.codigoVerificacion && documento.codigoVerificacion !== 'sin_codigo';
      
      if (tieneCodigoVerificacion) {
        // Documento CON código de verificación - validación tradicional
        if (tipoVerificacion === 'codigo') {
          if (!codigoVerificacion || documento.codigoVerificacion !== codigoVerificacion) {
            await transaction.rollback();
            return res.render('recepcion/documentos/entrega', {
              layout: 'recepcion',
              title: 'Entrega de Documento',
              documento,
              error: 'El código de verificación es incorrecto, por favor verifique e intente nuevamente',
              userRole: req.matrizador?.rol,
              userName: req.matrizador?.nombre
            });
          }
        } else if (tipoVerificacion === 'llamada') {
          if (!observaciones || observaciones.trim().length < 10) {
            await transaction.rollback();
            return res.render('recepcion/documentos/entrega', {
              layout: 'recepcion',
              title: 'Entrega de Documento',
              documento,
              error: 'Debe proporcionar observaciones detalladas de la verificación por llamada (mínimo 10 caracteres)',
              userRole: req.matrizador?.rol,
              userName: req.matrizador?.nombre
            });
          }
        }
      } else {
        // Documento SIN código de verificación - validación alternativa
        console.log(`📋 Validando entrega sin código para documento ${documento.codigoBarras} con método: ${tipoVerificacion}`);
        
        if (!tipoVerificacion || !['identidad', 'factura', 'llamada'].includes(tipoVerificacion)) {
          await transaction.rollback();
          return res.render('recepcion/documentos/entrega', {
            layout: 'recepcion',
            title: 'Entrega de Documento',
            documento,
            error: 'Debe seleccionar un método de verificación válido para documentos sin código',
            userRole: req.matrizador?.rol,
            userName: req.matrizador?.nombre
          });
        }
        
        if (!observaciones || observaciones.trim().length < 15) {
          await transaction.rollback();
          return res.render('recepcion/documentos/entrega', {
            layout: 'recepcion',
            title: 'Entrega de Documento',
            documento,
            error: 'Debe proporcionar detalles específicos del método de verificación utilizado (mínimo 15 caracteres)',
            userRole: req.matrizador?.rol,
            userName: req.matrizador?.nombre
          });
        }
        
        // Validaciones específicas por tipo de verificación
        if (tipoVerificacion === 'identidad') {
          if (!observaciones.toLowerCase().includes('cédula') && !observaciones.toLowerCase().includes('cedula')) {
            await transaction.rollback();
            return res.render('recepcion/documentos/entrega', {
              layout: 'recepcion',
              title: 'Entrega de Documento',
              documento,
              error: 'Para verificación por identidad, debe mencionar la cédula en las observaciones',
              userRole: req.matrizador?.rol,
              userName: req.matrizador?.nombre
            });
          }
        } else if (tipoVerificacion === 'factura') {
          if (!observaciones.toLowerCase().includes('factura')) {
            await transaction.rollback();
            return res.render('recepcion/documentos/entrega', {
              layout: 'recepcion',
              title: 'Entrega de Documento',
              documento,
              error: 'Para verificación por factura, debe mencionar el número de factura en las observaciones',
              userRole: req.matrizador?.rol,
              userName: req.matrizador?.nombre
            });
          }
        } else if (tipoVerificacion === 'llamada') {
          if (!observaciones.toLowerCase().includes('llé') && !observaciones.toLowerCase().includes('llame') && !observaciones.toLowerCase().includes('teléfono') && !observaciones.toLowerCase().includes('telefono')) {
            await transaction.rollback();
            return res.render('recepcion/documentos/entrega', {
              layout: 'recepcion',
              title: 'Entrega de Documento',
              documento,
              error: 'Para verificación por llamada, debe describir los detalles de la llamada telefónica',
              userRole: req.matrizador?.rol,
              userName: req.matrizador?.nombre
            });
          }
        }
      }
      
      // Actualizar el documento principal
      documento.estado = 'entregado';
      documento.fechaEntrega = new Date();
      documento.nombreReceptor = nombreReceptor;
      documento.identificacionReceptor = identificacionReceptor;
      documento.relacionReceptor = relacionReceptor;
      
      await documento.save({ transaction });
      
      // ============== NUEVA LÓGICA: ACTUALIZAR DOCUMENTOS HABILITANTES RELACIONADOS ==============
      
      let documentosHabilitantesActualizados = 0;
      
      // Solo buscar documentos habilitantes si este es un documento principal
      if (documento.esDocumentoPrincipal) {
        console.log(`🔍 Buscando documentos habilitantes para el documento principal ID: ${documento.id}`);
        
        // Buscar todos los documentos habilitantes que dependen de este documento principal
        const documentosHabilitantes = await Documento.findAll({
          where: {
            documentoPrincipalId: documento.id,
            esDocumentoPrincipal: false,
            estado: 'listo_para_entrega' // Solo actualizar los que están listos
          },
          transaction
        });
        
        if (documentosHabilitantes.length > 0) {
          console.log(`📄 Encontrados ${documentosHabilitantes.length} documentos habilitantes para actualizar`);
          
          // Actualizar todos los documentos habilitantes con los mismos datos de entrega
          await Documento.update({
            estado: 'entregado',
            fechaEntrega: documento.fechaEntrega,
            nombreReceptor: nombreReceptor,
            identificacionReceptor: identificacionReceptor,
            relacionReceptor: relacionReceptor
          }, {
            where: {
              documentoPrincipalId: documento.id,
              esDocumentoPrincipal: false,
              estado: 'listo_para_entrega'
            },
            transaction
          });
          
          documentosHabilitantesActualizados = documentosHabilitantes.length;
          
          // Registrar eventos de entrega para cada documento habilitante
          for (const docHabilitante of documentosHabilitantes) {
            try {
              let detallesHabilitante = '';
              
              if (tieneCodigoVerificacion) {
                // Documento principal con código de verificación
                if (tipoVerificacion === 'codigo') {
                  detallesHabilitante = `Entregado junto con documento principal a ${nombreReceptor} con código de verificación`;
                } else if (tipoVerificacion === 'llamada') {
                  detallesHabilitante = `Entregado junto con documento principal a ${nombreReceptor} con verificación por llamada: ${observaciones}`;
                }
              } else {
                // Documento principal sin código de verificación
                if (tipoVerificacion === 'identidad') {
                  detallesHabilitante = `Entregado junto con documento principal a ${nombreReceptor} con verificación por cédula de identidad`;
                } else if (tipoVerificacion === 'factura') {
                  detallesHabilitante = `Entregado junto con documento principal a ${nombreReceptor} con verificación por número de factura`;
                } else if (tipoVerificacion === 'llamada') {
                  detallesHabilitante = `Entregado junto con documento principal a ${nombreReceptor} con verificación por llamada telefónica`;
                }
              }
                
              await EventoDocumento.create({
                documentoId: docHabilitante.id,
                tipo: 'entrega',
                detalles: detallesHabilitante,
                usuario: req.matrizador.nombre
              }, { transaction });
              
              console.log(`✅ Evento de entrega registrado para documento habilitante: ${docHabilitante.codigoBarras}`);
            } catch (eventError) {
              console.error(`Error al registrar evento para documento habilitante ${docHabilitante.id}:`, eventError);
              // Continuar con otros documentos aunque falle el registro de eventos
            }
          }
          
          console.log(`✅ Actualizados ${documentosHabilitantesActualizados} documentos habilitantes junto con el principal`);
        } else {
          console.log(`ℹ️ No se encontraron documentos habilitantes para el documento principal ID: ${documento.id}`);
        }
      } else {
        console.log(`ℹ️ El documento ID: ${documento.id} es un documento habilitante, no se buscan documentos relacionados`);
      }
      
      // Registrar el evento de entrega con detalles específicos del tipo de verificación
      try {
        let detalles = '';
        
        if (tieneCodigoVerificacion) {
          // Documento con código de verificación
          if (tipoVerificacion === 'codigo') {
            detalles = `Entregado a ${nombreReceptor} con código de verificación ${documento.codigoVerificacion}`;
          } else if (tipoVerificacion === 'llamada') {
            detalles = `Entregado a ${nombreReceptor} con verificación por llamada: ${observaciones}`;
          }
        } else {
          // Documento sin código de verificación
          if (tipoVerificacion === 'identidad') {
            detalles = `Entregado a ${nombreReceptor} con verificación por cédula de identidad: ${observaciones}`;
          } else if (tipoVerificacion === 'factura') {
            detalles = `Entregado a ${nombreReceptor} con verificación por número de factura: ${observaciones}`;
          } else if (tipoVerificacion === 'llamada') {
            detalles = `Entregado a ${nombreReceptor} con verificación por llamada telefónica: ${observaciones}`;
          }
        }
          
        await EventoDocumento.create({
          documentoId: documento.id,
          tipo: 'entrega',
          detalles,
          usuario: req.matrizador.nombre
        }, { transaction });
      } catch (eventError) {
        console.error('Error al registrar evento de entrega:', eventError);
        // Continuar con la transacción aunque el registro de eventos falle
      }
      
      // ============== NUEVA FUNCIONALIDAD: VALIDACIÓN DE DOCUMENTOS PENDIENTES ==============
      let todosLosDocumentos = [documento];
      let documentosConPagoPendiente = [];
      
      if (entregaGrupal === 'true' && documentosAdicionales && tipoEntregaGrupal === 'recepcion_completa') {
        const documentosIds = documentosAdicionales.split(',')
          .map(id => parseInt(id.trim()))
          .filter(id => !isNaN(id) && id > 0);
        
        if (documentosIds.length > 0) {
          const documentosAdicionalesToEntrega = await Documento.findAll({
            where: {
              id: { [Op.in]: documentosIds }
            },
            include: [{ 
              model: Matrizador, 
              as: 'matrizador',
              attributes: ['id', 'nombre'] 
            }],
            transaction
          });
          
          todosLosDocumentos = [...todosLosDocumentos, ...documentosAdicionalesToEntrega];
        }
      }
      
      // Validar todos los documentos
      const validacionPagos = validarDocumentosParaEntrega(todosLosDocumentos);
      documentosConPagoPendiente = validacionPagos.documentosPendientes;
      
      // Si hay documentos pendientes, verificar autorización
      if (documentosConPagoPendiente.length > 0) {
        console.log(`⚠️ [VALIDACIÓN] ${documentosConPagoPendiente.length} documento(s) con pago pendiente detectado(s)`);
        
        if (confirmarEntregaPendiente !== 'true') {
          await transaction.rollback();
          
          // Construir mensaje de error con detalles específicos
          let mensajeError = `Se detectaron ${documentosConPagoPendiente.length} documento(s) con pago pendiente. Para continuar, debe confirmar que ha consultado con el matrizador responsable.\\n\\n`;
          mensajeError += 'Documentos pendientes:\\n';
          
          documentosConPagoPendiente.forEach(doc => {
            mensajeError += `- ${doc.codigoBarras} (${doc.tipoDocumento}) - Matrizador: ${doc.matrizador?.nombre || 'Sin asignar'}\\n`;
          });
          
          req.flash('error', mensajeError);
          return res.redirect(`/recepcion/documentos/entrega/${id}`);
        } else {
          console.log(`✅ [AUTORIZACIÓN] Usuario confirmó consulta con matrizador para documentos pendientes`);
        }
      }
      
      // ============== NUEVA FUNCIONALIDAD: PROCESAMIENTO DE ENTREGA GRUPAL ==============
      let documentosGrupalesActualizados = 0;
      
      if (entregaGrupal === 'true' && documentosAdicionales && tipoEntregaGrupal === 'recepcion_completa') {
        console.log(`🏢 [RECEPCIÓN] Iniciando entrega grupal para ${documentosAdicionales}`);
        
        try {
          const documentosIds = documentosAdicionales.split(',')
            .map(id => parseInt(id.trim()))
            .filter(id => !isNaN(id) && id > 0);
          
          if (documentosIds.length > 0) {
            const datosEntrega = {
              nombreReceptor,
              identificacionReceptor,
              relacionReceptor,
              tipoVerificacion,
              observaciones,
              identificacionCliente: documento.identificacionCliente,
              // Nueva información para auditoría
              confirmarEntregaPendiente: confirmarEntregaPendiente,
              documentosConPagoPendiente: documentosConPagoPendiente.length
            };
            
            const resultadoGrupal = await procesarEntregaGrupalRecepcion(
              documentosIds, 
              datosEntrega, 
              req.matrizador, 
              transaction
            );
            
            documentosGrupalesActualizados = resultadoGrupal.documentosActualizados;
            console.log(`✅ [RECEPCIÓN] Entrega grupal completada: ${documentosGrupalesActualizados} documentos adicionales`);
          }
        } catch (grupalError) {
          console.error('❌ Error en entrega grupal:', grupalError);
          await transaction.rollback();
          req.flash('error', `Error en entrega grupal: ${grupalError.message}`);
          return res.redirect(`/recepcion/documentos/entrega/${id}`);
        }
      }
      
      await transaction.commit();
      
      // ============== NUEVA LÓGICA: NOTIFICACIÓN GRUPAL O INDIVIDUAL ==============
      try {
        if (entregaGrupal === 'true' && documentosGrupalesActualizados > 0) {
          // ENTREGA GRUPAL: Enviar UNA SOLA notificación para todos los documentos
          console.log(`📧 [ENTREGA GRUPAL] Preparando notificación única para ${documentosGrupalesActualizados + 1} documentos`);
          
          // Obtener todos los documentos entregados (principal + adicionales)
          const todosLosDocumentosEntregados = [documento];
          
          // Obtener documentos adicionales entregados
          if (documentosAdicionales) {
            const documentosIds = documentosAdicionales.split(',')
              .map(id => parseInt(id.trim()))
              .filter(id => !isNaN(id) && id > 0);
            
            const documentosAdicionalesEntregados = await Documento.findAll({
              where: {
                id: { [Op.in]: documentosIds },
                estado: 'entregado',
                fechaEntrega: { [Op.not]: null }
              }
            });
            
            todosLosDocumentosEntregados.push(...documentosAdicionalesEntregados);
          }
          
          // Enviar notificación grupal única
          await enviarNotificacionEntregaGrupal(todosLosDocumentosEntregados, {
            nombreReceptor,
            identificacionReceptor, 
            relacionReceptor
          }, req.matrizador);
          
        } else {
          // ENTREGA INDIVIDUAL: Enviar notificación tradicional
          await enviarNotificacionEntrega(documento, {
            nombreReceptor,
            identificacionReceptor, 
            relacionReceptor
          }, req.matrizador);
        }
      } catch (notificationError) {
        console.error('Error al enviar confirmación de entrega:', notificationError);
        // No afectar el flujo principal si falla la notificación
      }
      
      // Mensaje de éxito personalizado según documentos procesados
      let mensajeExito = `El documento ha sido entregado exitosamente a ${nombreReceptor}.`;
      
      if (documentosHabilitantesActualizados > 0) {
        mensajeExito += ` También se entregaron ${documentosHabilitantesActualizados} documento(s) habilitante(s) relacionado(s).`;
      }
      
      if (documentosGrupalesActualizados > 0) {
        mensajeExito += ` Adicionalmente se procesaron ${documentosGrupalesActualizados} documento(s) más del mismo cliente en entrega grupal.`;
      }
      
      if (documentosConPagoPendiente.length > 0) {
        mensajeExito += ` Se entregaron ${documentosConPagoPendiente.length} documento(s) con pago pendiente bajo autorización manual.`;
      }
      
      req.flash('success', mensajeExito);
      res.redirect('/recepcion/documentos');
    } catch (error) {
      await transaction.rollback();
      console.error('Error al completar la entrega del documento:', error);
      req.flash('error', `Error al completar la entrega: ${error.message}`);
      res.redirect('/recepcion/documentos/entrega');
    }
  },

  marcarDocumentoListoParaEntrega: async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
      const { documentoId } = req.body;
      const usuario = req.matrizador || req.usuario; // Usuario autenticado (debe ser recepcion)

      if (!documentoId) {
        await transaction.rollback();
        req.flash('error', 'ID de documento no proporcionado.');
        return res.redirect('/recepcion/documentos');
      }

      const documento = await Documento.findByPk(documentoId, { transaction });

      if (!documento) {
        await transaction.rollback();
        req.flash('error', 'Documento no encontrado.');
        return res.redirect('/recepcion/documentos');
      }

      if (documento.estado !== 'en_proceso') {
        await transaction.rollback();
        req.flash('error', 'Solo se pueden marcar como listos documentos en estado \'En Proceso\'.');
        return res.redirect('/recepcion/documentos/detalle/' + documentoId);
      }

      // Generar código de verificación de 4 dígitos (si es necesario según flujo)
      // Si el código ya se genera cuando el matrizador lo crea o lo edita, este paso puede ser opcional
      // o se puede decidir si recepción lo regenera o usa uno existente.
      // Por ahora, asumimos que es parte del proceso de "listo para entrega".
      const codigoVerificacion = Math.floor(1000 + Math.random() * 9000).toString();

      documento.estado = 'listo_para_entrega';
      documento.codigoVerificacion = codigoVerificacion; // Guardar si se genera aquí
      // Quién marcó como listo (opcional, si se quiere guardar explícitamente)
      // documento.idUsuarioMarcoListo = usuario.id;
      // documento.fechaMarcoListo = new Date();

      await documento.save({ transaction });

      // ============== CORRECCIÓN: REGISTRO MEJORADO DE EVENTO ==============
      // Determinar canal según configuración del documento
      let canalPrincipal = 'ninguno';
      const tieneEmail = documento.emailCliente && documento.emailCliente.trim() !== '';
      const tieneTelefono = documento.telefonoCliente && documento.telefonoCliente.trim() !== '';
      
      switch (documento.metodoNotificacion) {
        case 'email':
          canalPrincipal = tieneEmail ? 'email' : 'ninguno';
          break;
        case 'whatsapp':
          canalPrincipal = tieneTelefono ? 'whatsapp' : 'ninguno';
          break;
        case 'ambos':
          if (tieneEmail && tieneTelefono) {
            canalPrincipal = 'ambos';
          } else if (tieneEmail) {
            canalPrincipal = 'email';
          } else if (tieneTelefono) {
            canalPrincipal = 'whatsapp';
          } else {
            canalPrincipal = 'ninguno';
          }
          break;
        default:
          canalPrincipal = 'ninguno';
      }

      await EventoDocumento.create({
        documentoId: documento.id,
        tipo: 'cambio_estado',
        detalles: `Documento marcado como LISTO PARA ENTREGA por ${usuario.nombre || 'Recepción'} (${usuario.rol}). Código generado: ${codigoVerificacion}.`,
        usuario: usuario.nombre || 'Recepción',
        metadatos: {
          // ✅ CAMPOS CORREGIDOS PARA HISTORIAL
          canal: canalPrincipal,                    // ✅ Para mostrar en columna "Canal"
          estado: 'procesada',                      // ✅ Para mostrar en columna "Estado"
          tipo: 'cambio_estado',                    // ✅ Para filtros y etiquetas
          idUsuario: usuario.id,
          rolUsuario: usuario.rol,
          codigoGenerado: codigoVerificacion,
          timestamp: new Date().toISOString(),
          // Información adicional para auditoría
          documentoId: documento.id,
          codigoDocumento: documento.codigoBarras,
          estadoAnterior: 'en_proceso',
          estadoNuevo: 'listo_para_entrega',
          metodoNotificacion: documento.metodoNotificacion,
          clienteEmail: documento.emailCliente,
          clienteTelefono: documento.telefonoCliente
        }
      }, { transaction });

      await transaction.commit();

      // Enviar notificación después de confirmar la transacción
      try {
        await NotificationService.enviarNotificacionDocumentoListo(documento.id);
      } catch (notificationError) {
        console.error('Error al enviar notificación de documento listo:', notificationError);
        // No afectar el flujo principal si falla la notificación
      }

      req.flash('success', `Documento ${documento.codigoBarras} marcado como LISTO PARA ENTREGA.`);
      res.redirect('/recepcion/documentos');

    } catch (error) {
      await transaction.rollback();
      console.error('Error al marcar documento como listo para entrega por recepción:', error);
      req.flash('error', 'Error al procesar la solicitud: ' + error.message);
      res.redirect('/recepcion/documentos');
    }
  },

  /**
   * Registra una notificación al cliente sobre un documento listo para entrega
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  notificarCliente: async (req, res) => {
    try {
      const { documentoId, metodoNotificacion, observaciones } = req.body;
      
      if (!documentoId) {
        return res.status(400).json({
          exito: false,
          mensaje: 'ID de documento no proporcionado'
        });
      }
      
      // Obtener el documento
      const documento = await Documento.findOne({
        where: { 
          id: documentoId,
          estado: 'listo_para_entrega'
        }
      });
      
      if (!documento) {
        return res.status(404).json({
          exito: false,
          mensaje: 'Documento no encontrado o no está listo para entrega'
        });
      }
      
      // Registrar el evento de notificación
      await EventoDocumento.create({
        documentoId: documento.id,
        tipo: 'otro',
        detalles: `Notificación al cliente via ${metodoNotificacion}`,
        usuario: req.matrizador.nombre,
        metadatos: {
          metodoNotificacion,
          observaciones,
          fechaNotificacion: new Date()
        }
      });
      
      // Aquí se podría integrar con sistemas de envío de notificaciones reales
      // como servicios de WhatsApp, Email, etc.
      
      console.log(`Notificación registrada para documento ${documento.codigoBarras} via ${metodoNotificacion}`);
      
      return res.status(200).json({
        exito: true,
        mensaje: 'Notificación registrada correctamente'
      });
    } catch (error) {
      console.error('Error al notificar cliente:', error);
      return res.status(500).json({
        exito: false,
        mensaje: 'Error al registrar la notificación',
        error: error.message
      });
    }
  },

  // ============== NUEVAS FUNCIONES: CONTROL DE NOTIFICACIONES ==============

  /**
   * Muestra el historial completo de notificaciones con filtros avanzados para recepción
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  historialNotificaciones: async (req, res) => {
    try {
      const { 
        fechaDesde, 
        fechaHasta, 
        tipo, 
        canal, 
        matrizador, 
        codigoDocumento,
        cliente,
        numeroFactura,
        busqueda
      } = req.query;
      
      let whereClause = {};
      let documentoWhere = {};
      
      // Filtro por fechas
      if (fechaDesde || fechaHasta) {
        whereClause.created_at = {};
        if (fechaDesde) {
          whereClause.created_at[Op.gte] = new Date(fechaDesde + 'T00:00:00');
        }
        if (fechaHasta) {
          whereClause.created_at[Op.lte] = new Date(fechaHasta + 'T23:59:59');
        }
      }
      
      // Filtros de tipo y canal
      if (tipo) whereClause.tipo = tipo;
      if (canal && canal !== '') {
        // Buscar en metadatos.canal
        whereClause['metadatos.canal'] = canal;
      }
      
      // ============== BÚSQUEDA POR TEXTO ==============
      if (busqueda && busqueda.trim() !== '') {
        const textoBusqueda = busqueda.trim();
        documentoWhere[Op.or] = [
          // Buscar por código de barras
          { codigoBarras: { [Op.iLike]: `%${textoBusqueda}%` } },
          // Buscar por nombre del cliente
          { nombreCliente: { [Op.iLike]: `%${textoBusqueda}%` } },
          // Buscar por número de factura
          { numeroFactura: { [Op.iLike]: `%${textoBusqueda}%` } },
          // Buscar por identificación del cliente
          { identificacionCliente: { [Op.iLike]: `%${textoBusqueda}%` } }
        ];
      }
      
      // Filtros específicos de documento
      if (codigoDocumento) {
        documentoWhere.codigoBarras = {
          [Op.iLike]: `%${codigoDocumento}%`
        };
      }
      
      if (cliente) {
        documentoWhere.nombreCliente = {
          [Op.iLike]: `%${cliente}%`
        };
      }
      
      if (numeroFactura) {
        documentoWhere.numeroFactura = {
          [Op.iLike]: `%${numeroFactura}%`
        };
      }
      
      // Filtro por matrizador
      if (matrizador) {
        documentoWhere.idMatrizador = matrizador;
      }
      
      const notificaciones = await EventoDocumento.findAll({
        where: {
          tipo: {
            [Op.in]: ['documento_listo', 'documento_entregado', 'otro', 'cambio_estado']
          },
          // Filtrar solo eventos relacionados con notificaciones
          [Op.or]: [
            { tipo: 'documento_listo' },
            { tipo: 'documento_entregado' },
            { 
              tipo: 'otro',
              detalles: {
                [Op.iLike]: '%notificación%'
              }
            },
            {
              tipo: 'cambio_estado',
              detalles: {
                [Op.iLike]: '%listo para entrega%'
              }
            }
          ],
          ...whereClause
        },
        include: [
          {
            model: Documento,
            as: 'documento',
            where: documentoWhere,
            attributes: [
              'id',
              'codigoBarras', 
              'tipoDocumento', 
              'nombreCliente',
              'emailCliente',
              'telefonoCliente',
              'numeroFactura',
              'estado',
              'identificacionCliente',
              'notas'
            ],
            include: [
              {
                model: Matrizador,
                as: 'matrizador',
                attributes: ['nombre'],
                required: false
              }
            ],
            required: true
          }
        ],
        order: [['created_at', 'DESC']],
        limit: 100, // Más resultados para recepción
        raw: false // ✅ IMPORTANTE: Asegurar que devuelva objetos Sequelize completos
      });
      
      // ============== PROCESAR NOTIFICACIONES PARA VISTA ==============
      const notificacionesProcesadas = notificaciones.map(notif => {
        const notifData = notif.toJSON ? notif.toJSON() : notif;
        
        // Asegurar que las fechas estén en formato ISO string
        if (notifData.created_at) {
          notifData.created_at = new Date(notifData.created_at).toISOString();
        }
        if (notifData.updated_at) {
          notifData.updated_at = new Date(notifData.updated_at).toISOString();
        }
        
        // Asegurar que metadatos existan
        if (!notifData.metadatos) {
          notifData.metadatos = {};
        }
        
        console.log(`📅 Notificación ID ${notifData.id}: fecha = ${notifData.created_at}`);
        
        return notifData;
      });
      
      // Obtener lista de matrizadores para filtro
      const matrizadores = await Matrizador.findAll({
        attributes: ['id', 'nombre'],
        where: { activo: true },
        order: [['nombre', 'ASC']]
      });
      
      // ============== CALCULAR ESTADÍSTICAS ==============
      const stats = {
        total: notificaciones.length,
        enviadas: notificaciones.filter(n => n.metadatos?.estado === 'enviado').length || 0,
        fallidas: notificaciones.filter(n => n.metadatos?.estado === 'error').length || 0,
        pendientes: notificaciones.filter(n => n.metadatos?.estado === 'pendiente').length || 0
      };
      
      res.render('recepcion/notificaciones/historial', {
        layout: 'recepcion',
        title: 'Control de Notificaciones',
        notificaciones: notificacionesProcesadas,
        matrizadores,
        stats,
        filtros: { 
          fechaDesde, 
          fechaHasta, 
          tipo, 
          canal, 
          matrizador, 
          codigoDocumento,
          cliente,
          numeroFactura,
          busqueda
        },
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre,
        usuario: {
          id: req.matrizador?.id,
          rol: req.matrizador?.rol,
          nombre: req.matrizador?.nombre
        }
      });
      
    } catch (error) {
      console.error('Error en historial notificaciones recepción:', error);
      res.status(500).render('error', { 
        layout: 'recepcion',
        title: 'Error',
        message: 'Error al cargar historial de notificaciones' 
      });
    }
  },

  /**
   * Obtiene los detalles de una notificación específica (API) para recepción
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  obtenerDetalleNotificacion: async (req, res) => {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          exito: false,
          mensaje: 'ID de notificación no proporcionado'
        });
      }
      
      // Buscar el evento de notificación
      const evento = await EventoDocumento.findOne({
        where: {
          id: id,
          [Op.or]: [
            { tipo: 'documento_listo' },
            { tipo: 'documento_entregado' },
            { 
              tipo: 'otro',
              detalles: {
                [Op.iLike]: '%notificación%'
              }
            },
            {
              tipo: 'cambio_estado',
              detalles: {
                [Op.iLike]: '%listo para entrega%'
              }
            }
          ]
        },
        include: [{
          model: Documento,
          as: 'documento',
          attributes: ['codigoBarras', 'tipoDocumento', 'nombreCliente', 'emailCliente', 'telefonoCliente', 'notas', 'numeroFactura', 'estado'],
          include: [{
            model: Matrizador,
            as: 'matrizador',
            attributes: ['nombre'],
            required: false
          }],
          required: true
        }]
      });
      
      if (!evento) {
        return res.status(404).json({
          exito: false,
          mensaje: 'Notificación no encontrada'
        });
      }
      
      // ============== RECONSTRUIR MENSAJE ENVIADO ==============
      let mensajeEnviado = '';
      
      if (evento.tipo === 'documento_listo') {
        // Reconstruir mensaje de documento listo
        const codigoVerificacion = evento.metadatos?.codigoVerificacion || 'N/A';
        let contextoTramite = '';
        if (evento.documento.notas && 
            typeof evento.documento.notas === 'string' && 
            evento.documento.notas.trim().length > 0) {
          contextoTramite = ` - ${evento.documento.notas.trim()}`;
        }
        
        mensajeEnviado = `🏛️ *NOTARÍA 18*

¡Su documento está listo para retirar!

📄 *Trámite:* ${evento.documento.tipoDocumento}${contextoTramite}
📋 *Documento:* ${evento.documento.codigoBarras}
🔢 *Código de verificación:* ${codigoVerificacion}
👤 *Cliente:* ${evento.documento.nombreCliente}

📍 Retírelo en: Notaría Décima Octava
🕒 Horario: Lunes a Viernes 8:00-17:00

⚠️ *IMPORTANTE:* Presente el código de verificación y su cédula para el retiro.`;
        
      } else if (evento.tipo === 'documento_entregado') {
        // Reconstruir mensaje de documento entregado
        const fechaEntrega = new Date(evento.createdAt).toLocaleDateString('es-EC', {
          day: '2-digit', month: '2-digit', year: 'numeric'
        });
        
        const horaEntrega = new Date(evento.createdAt).toLocaleTimeString('es-EC', {
          hour: '2-digit', minute: '2-digit', hour12: false
        });
        
        let contextoTramite = '';
        if (evento.documento.notas && 
            typeof evento.documento.notas === 'string' && 
            evento.documento.notas.trim().length > 0) {
          contextoTramite = ` - ${evento.documento.notas.trim()}`;
        }
        
        const nombreReceptor = evento.metadatos?.nombreReceptor || 'Receptor no especificado';
        const identificacionReceptor = evento.metadatos?.identificacionReceptor || 'N/A';
        const relacionReceptor = evento.metadatos?.relacionReceptor || 'N/A';
        
        mensajeEnviado = `🏛️ *NOTARÍA 18*

✅ *DOCUMENTO ENTREGADO EXITOSAMENTE*

📄 *Documento:* ${evento.documento.tipoDocumento}${contextoTramite}
📋 *Código:* ${evento.documento.codigoBarras}
👤 *Cliente:* ${evento.documento.nombreCliente}

📦 *DETALLES DE LA ENTREGA:*
👨‍💼 *Retirado por:* ${nombreReceptor}
🆔 *Identificación:* ${identificacionReceptor}
👥 *Relación:* ${relacionReceptor}

📅 *Fecha:* ${fechaEntrega}
🕒 *Hora:* ${horaEntrega}
📍 *Lugar:* Notaría Décima Octava, Quito

✅ *Su trámite ha sido completado exitosamente.*

_Guarde este mensaje como comprobante de entrega._`;
      } else if (evento.tipo === 'otro' && evento.detalles && evento.detalles.includes('Notificación')) {
        // Evento de notificación del NotificationService
        const canalesEnviados = evento.metadatos?.canalesEnviados || [];
        const codigoVerificacion = evento.documento.codigoVerificacion || 'N/A';
        
        let contextoTramite = '';
        if (evento.documento.notas && 
            typeof evento.documento.notas === 'string' && 
            evento.documento.notas.trim().length > 0) {
          contextoTramite = ` - ${evento.documento.notas.trim()}`;
        }
        
        mensajeEnviado = `🏛️ *NOTARÍA 18*

¡Su documento está listo para retirar!

📄 *Trámite:* ${evento.documento.tipoDocumento}${contextoTramite}
📋 *Documento:* ${evento.documento.codigoBarras}
🔢 *Código de verificación:* ${codigoVerificacion}
👤 *Cliente:* ${evento.documento.nombreCliente}

📍 Retírelo en: Notaría Décima Octava
🕒 Horario: Lunes a Viernes 8:00-17:00

⚠️ *IMPORTANTE:* Presente el código de verificación y su cédula para el retiro.

_Mensaje enviado por: ${canalesEnviados.join(' y ')}_`;
        
      } else if (evento.tipo === 'cambio_estado' && evento.detalles && evento.detalles.includes('listo para entrega')) {
        // Evento de cambio de estado a "listo para entrega"
        const codigoVerificacion = evento.metadatos?.codigoGenerado || evento.documento.codigoVerificacion || 'N/A';
        
        let contextoTramite = '';
        if (evento.documento.notas && 
            typeof evento.documento.notas === 'string' && 
            evento.documento.notas.trim().length > 0) {
          contextoTramite = ` - ${evento.documento.notas.trim()}`;
        }
        
        mensajeEnviado = `📋 *DOCUMENTO MARCADO COMO LISTO*

📄 *Trámite:* ${evento.documento.tipoDocumento}${contextoTramite}
📋 *Código:* ${evento.documento.codigoBarras}
🔢 *Código de verificación:* ${codigoVerificacion}
👤 *Cliente:* ${evento.documento.nombreCliente}
👨‍💼 *Marcado por:* ${evento.usuario}

📅 *Fecha:* ${new Date(evento.created_at).toLocaleDateString('es-EC')}
🕒 *Hora:* ${new Date(evento.created_at).toLocaleTimeString('es-EC')}

✅ *El documento está listo para ser retirado por el cliente.*`;
      }
      
      // Preparar datos detallados
      const detalles = {
        id: evento.id,
        tipo: evento.tipo,
        fecha: evento.created_at ? new Date(evento.created_at).toISOString() : null,
        detalles: evento.detalles,
        usuario: evento.usuario || 'Sistema',
        documento: {
          id: evento.documento.id,
          codigo: evento.documento.codigoBarras,
          tipo: evento.documento.tipoDocumento,
          cliente: evento.documento.nombreCliente,
          numeroFactura: evento.documento.numeroFactura,
          estado: evento.documento.estado,
          matrizador: evento.documento.matrizador?.nombre || 'No asignado'
        },
        metadatos: evento.metadatos || {},
        canales: {
          email: evento.documento.emailCliente,
          telefono: evento.documento.telefonoCliente
        },
        mensajeEnviado: mensajeEnviado
      };
      
      return res.status(200).json({
        exito: true,
        datos: detalles,
        mensaje: 'Detalles de notificación obtenidos correctamente'
      });
    } catch (error) {
      console.error('Error al obtener detalles de notificación:', error);
      return res.status(500).json({
        exito: false,
        mensaje: 'Error al obtener los detalles de la notificación',
        error: error.message
      });
    }
  },

  // ============== NUEVOS MÉTODOS: ENTREGA GRUPAL API ==============

  /**
   * API para detectar documentos grupales del mismo cliente (RECEPCIÓN)
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  detectarDocumentosGrupales: async (req, res) => {
    try {
      const { identificacion, documentoId } = req.params;
      
      if (!identificacion || !documentoId) {
        return res.status(400).json({
          exito: false,
          mensaje: 'Parámetros requeridos: identificación y documentoId'
        });
      }
      
      const documentosGrupales = await detectarDocumentosGrupalesRecepcion(
        identificacion, 
        parseInt(documentoId)
      );
      
      return res.status(200).json({
        exito: true,
        datos: documentosGrupales,
        mensaje: `Detectados ${documentosGrupales.cantidad} documentos adicionales`
      });
      
    } catch (error) {
      console.error('Error en API detectar documentos grupales:', error);
      return res.status(500).json({
        exito: false,
        mensaje: 'Error al detectar documentos grupales',
        error: error.message
      });
    }
  },

  /**
   * Procesa entrega grupal específica (RECEPCIÓN)
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  procesarEntregaGrupal: async (req, res) => {
    const transaction = await sequelize.transaction();
    
    try {
      const { id } = req.params;
      const { 
        documentosIds, 
        nombreReceptor, 
        identificacionReceptor, 
        relacionReceptor,
        tipoVerificacion,
        observaciones
      } = req.body;
      
      if (!id || !documentosIds || !Array.isArray(documentosIds)) {
        await transaction.rollback();
        return res.status(400).json({
          exito: false,
          mensaje: 'Parámetros requeridos: id del documento principal y array de documentosIds'
        });
      }
      
      // Obtener documento principal
      const documentoPrincipal = await Documento.findByPk(id, { transaction });
      if (!documentoPrincipal) {
        await transaction.rollback();
        return res.status(404).json({
          exito: false,
          mensaje: 'Documento principal no encontrado'
        });
      }
      
      // Preparar datos de entrega
      const datosEntrega = {
        nombreReceptor,
        identificacionReceptor,
        relacionReceptor,
        tipoVerificacion,
        observaciones,
        identificacionCliente: documentoPrincipal.identificacionCliente
      };
      
      // Procesar entrega grupal
      const resultado = await procesarEntregaGrupalRecepcion(
        documentosIds, 
        datosEntrega, 
        req.matrizador, 
        transaction
      );
      
      await transaction.commit();
      
      return res.status(200).json({
        exito: true,
        mensaje: `Entrega grupal procesada exitosamente: ${resultado.documentosActualizados} documentos`,
        datos: {
          documentosActualizados: resultado.documentosActualizados,
          tipoEntrega: 'recepcion_completa'
        }
      });
      
    } catch (error) {
      await transaction.rollback();
      console.error('Error en procesamiento entrega grupal:', error);
      return res.status(500).json({
        exito: false,
        mensaje: 'Error al procesar entrega grupal',
        error: error.message
      });
    }
  },
};

module.exports = recepcionController; 