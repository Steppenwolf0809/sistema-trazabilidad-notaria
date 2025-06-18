/**
 * Controlador para gestionar los matrizadores
 * Contiene las funciones para crear, listar, actualizar y eliminar matrizadores,
 * así como para generar y verificar códigos QR
 */

const Matrizador = require('../models/Matrizador');
const { sequelize, Sequelize } = require('../config/database');
const QRCode = require('qrcode');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { redirigirSegunRol } = require('../middlewares/auth');
const Documento = require('../models/Documento');
const EventoDocumento = require('../models/EventoDocumento');
const RegistroAuditoria = require('../models/RegistroAuditoria');
const { Op } = require('sequelize');
const moment = require('moment');
const { 
  inferirTipoDocumentoPorCodigo, 
  procesarFechaDocumento,
  formatearValorMonetario,
  obtenerTimestampEcuador,
  formatearTimestamp,
  formatearFechaSinHora,
  construirListaDocumentosDetallada,
  construirInformacionEntregaCensurada
} = require('../utils/documentoUtils');
const NotificationService = require('../services/notificationService');
const configNotaria = require('../config/notaria');
const NotificacionEnviada = require('../models/NotificacionEnviada');

// ============== FUNCIONES PARA CONSTRUCCIÓN DE MENSAJES PROFESIONALES ==============

/**
 * Construye mensajes profesionales para notificación de documento listo
 * @param {Object} documento - Datos del documento
 * @param {string} codigoVerificacion - Código de verificación generado
 * @returns {Object} Mensajes para WhatsApp y Email
 */
function construirMensajeDocumentoListo(documento, codigoVerificacion) {
  let contextoTramite = '';
  if (documento.notas && 
      typeof documento.notas === 'string' && 
      documento.notas.trim().length > 0) {
    contextoTramite = ` - ${documento.notas.trim()}`;
  }

  // Mensaje WhatsApp optimizado usando plantilla centralizada
  const mensajeWhatsApp = configNotaria.plantillas.documentoListo.whatsapp
    .replace('{{tipoDocumento}}', documento.tipoDocumento)
    .replace('{{contextoTramite}}', contextoTramite)
    .replace('{{codigoBarras}}', documento.codigoBarras)
    .replace('{{codigoVerificacion}}', codigoVerificacion)
    .replace('{{nombreCliente}}', documento.nombreCliente);

  // Datos para email profesional
  const datosEmail = {
    nombreCliente: documento.nombreCliente,
    tipoDocumento: documento.tipoDocumento,
    codigoDocumento: documento.codigoBarras,
    detallesAdicionales: documento.notas?.trim() || null,
    codigoVerificacion: codigoVerificacion,
    fechaFormateada: new Date().toLocaleDateString('es-EC')
  };

  return {
    whatsapp: mensajeWhatsApp,
    email: {
      subject: configNotaria.plantillas.documentoListo.email.subject,
      template: configNotaria.plantillas.documentoListo.email.template,
      data: datosEmail
    },
    tipo: 'documento_listo'
  };
}

/**
 * Construye mensajes profesionales para notificación de documento entregado
 * @param {Object} documento - Datos del documento
 * @param {Object} datosEntrega - Datos de la entrega
 * @returns {Object} Mensajes para WhatsApp y Email
 */
function construirMensajeDocumentoEntregado(documento, datosEntrega) {
  let contextoTramite = '';
  if (documento.notas && 
      typeof documento.notas === 'string' && 
      documento.notas.trim().length > 0) {
    contextoTramite = ` - ${documento.notas.trim()}`;
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
    detallesAdicionales: documento.notas?.trim() || null,
    nombreReceptor: datosEntrega.nombreReceptor,
    identificacionReceptor: datosEntrega.identificacionReceptor,
    relacionReceptor: datosEntrega.relacionReceptor,
    fechaEntrega: fechaEntrega,
    horaEntrega: horaEntrega,
    usuarioEntrega: datosEntrega.usuarioEntrega || 'Personal de Notaría',
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
 * Construye mensaje de entrega grupal para notificación
 * @param {Array} documentos - Array de documentos entregados
 * @param {Object} datosEntrega - Datos de la entrega
 * @returns {Object} Mensajes para WhatsApp y Email
 */
function construirMensajeEntregaGrupalMatrizador(documentos, datosEntrega) {
  // Construir lista detallada de documentos usando función utilitaria
  const listaDocumentos = construirListaDocumentosDetallada(documentos);
  
  // Construir información de entrega con datos censurados
  const infoEntrega = construirInformacionEntregaCensurada(datosEntrega);

  // Mensaje WhatsApp usando plantilla centralizada
  const mensajeWhatsApp = configNotaria.plantillas.entregaGrupal.whatsapp
    .replace('{{nombreCliente}}', documentos[0].nombreCliente)
    .replace('{{totalDocumentos}}', documentos.length)
    .replace('{{listaDocumentos}}', listaDocumentos)
    .replace('{{nombreReceptor}}', infoEntrega.nombreReceptor)
    .replace('{{identificacionCensurada}}', infoEntrega.identificacionCensurada)
    .replace('{{relacionReceptor}}', infoEntrega.relacionReceptor)
    .replace('{{fechaEntrega}}', infoEntrega.fechaEntrega)
    .replace('{{horaEntrega}}', infoEntrega.horaEntrega);

  // Datos para email de confirmación grupal
  const datosEmail = {
    nombreCliente: documentos[0].nombreCliente,
    totalDocumentos: documentos.length,
    documentos: documentos.map(doc => ({
      tipoDocumento: doc.tipoDocumento,
      codigoBarras: doc.codigoBarras,
      detallesAdicionales: doc.detallesAdicionales?.trim() || null
    })),
    nombreReceptor: infoEntrega.nombreReceptor,
    identificacionCensurada: infoEntrega.identificacionCensurada,
    identificacionReceptor: infoEntrega.identificacionCompleta, // Para uso interno del email si es necesario
    relacionReceptor: infoEntrega.relacionReceptor,
    fechaEntrega: infoEntrega.fechaEntrega,
    horaEntrega: infoEntrega.horaEntrega,
    usuarioEntrega: datosEntrega.usuarioEntrega || 'Matrizador',
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

// ============== FUNCIONES PARA NOTIFICACIONES GRUPALES - MATRIZADOR ==============

/**
 * Guarda notificación grupal en el historial de la base de datos
 * @param {Array} documentos - Array de documentos entregados
 * @param {Object} datosEntrega - Datos de la entrega
 * @param {Object} usuarioEntrega - Usuario que realizó la entrega
 * @param {string} metodoNotificacion - Método de notificación usado
 * @param {string} mensajeEnviado - Mensaje que se envió
 * @returns {Object} Notificación guardada
 */
async function guardarNotificacionGrupalEnHistorialMatrizador(documentos, datosEntrega, usuarioEntrega, metodoNotificacion, mensajeEnviado) {
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
        requirioAutorizacion: false, // Matrizador no requiere autorización para propios
        entregaConPendientes: documentosPendientes.length > 0,
        // Códigos de los documentos
        codigosDocumentos: documentos.map(doc => doc.codigoBarras),
        tiposDocumentos: documentos.map(doc => doc.tipoDocumento),
        // Metadatos de auditoría
        fechaEntrega: new Date().toISOString(),
        tipoEntregaGrupal: 'matrizador_propios',
        metodoVerificacion: datosEntrega.tipoVerificacion || 'codigo',
        observaciones: datosEntrega.observaciones
      }
    });

    console.log(`📝 [HISTORIAL MATRIZADOR] Notificación grupal guardada en historial: ID ${notificacion.id}`);
    
    return notificacion;
  } catch (error) {
    console.error('❌ Error guardando notificación grupal en historial matrizador:', error);
    throw error;
  }
}

/**
 * Envía notificación de entrega individual para matrizadores
 * @param {Object} documento - Documento entregado
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
        console.log(`📱 [MATRIZADOR] Confirmación entrega enviada por WhatsApp a ${documento.telefonoCliente}`);
        console.log(`Mensaje: ${mensajes.whatsapp}`);
      }
    }

    if (metodoNotificacion === 'email' || metodoNotificacion === 'ambos') {
      if (documento.emailCliente) {
        // Aquí se integraría con el servicio de Email
        console.log(`📧 [MATRIZADOR] Confirmación entrega enviada por email a ${documento.emailCliente}`);
        console.log(`Asunto: ${mensajes.email.subject}`);
      }
    }

    // ============== GUARDAR EN HISTORIAL DE NOTIFICACIONES ==============
    try {
      const notificacion = await NotificacionEnviada.create({
        documentoId: documento.id,
        documentosIds: null, // Solo para entregas grupales
        tipoEvento: 'entrega_confirmada',
        tipoEntrega: 'individual',
        canal: metodoNotificacion === 'ambos' ? 'whatsapp' : metodoNotificacion,
        destinatario: metodoNotificacion.includes('email') ? 
          documento.emailCliente : documento.telefonoCliente,
        estado: 'enviado',
        mensajeEnviado: mensajes.whatsapp || mensajes.email?.subject || 'Notificación de entrega',
        respuestaApi: null,
        intentos: 1,
        metadatos: {
          // Información del documento
          codigoBarras: documento.codigoBarras,
          tipoDocumento: documento.tipoDocumento,
          nombreCliente: documento.nombreCliente,
          identificacionCliente: documento.identificacionCliente,
          valorFactura: documento.valorFactura,
          estadoPago: documento.estadoPago,
          // Información del receptor
          nombreReceptor: datosEntrega.nombreReceptor,
          identificacionReceptor: datosEntrega.identificacionReceptor,
          relacionReceptor: datosEntrega.relacionReceptor,
          // Información del matrizador
          entregadoPor: usuarioEntrega.nombre,
          rolEntregador: 'matrizador',
          idMatrizador: usuarioEntrega.id,
          // Metadatos de auditoría
          fechaEntrega: new Date().toISOString(),
          metodoVerificacion: datosEntrega.tipoVerificacion || 'codigo',
          observaciones: datosEntrega.observaciones
        }
      });

      console.log(`📝 [MATRIZADOR] Notificación individual guardada en historial: ID ${notificacion.id}`);
    } catch (historialError) {
      console.error('❌ Error guardando notificación en historial:', historialError);
      // No interrumpir el flujo principal
    }

    // Registrar en auditoría
    await RegistroAuditoria.create({
      idDocumento: documento.id,
      idMatrizador: usuarioEntrega.id,
      accion: 'verificacion_codigo',
      resultado: 'exitoso',
      detalles: `Entrega confirmada - Receptor: ${datosEntrega.nombreReceptor} (${datosEntrega.identificacionReceptor}) - Método: ${metodoNotificacion} - Matrizador: ${usuarioEntrega.nombre}`
    });

    console.log(`✅ [MATRIZADOR] Notificación de entrega individual procesada correctamente`);

  } catch (error) {
    console.error('❌ [MATRIZADOR] Error enviando notificación de entrega:', error);
  }
}

/**
 * Envía notificación de entrega grupal (UNA SOLA NOTIFICACIÓN PARA TODOS LOS DOCUMENTOS)
 * @param {Array} documentos - Array de documentos entregados
 * @param {Object} datosEntrega - Datos de la entrega
 * @param {Object} usuarioEntrega - Usuario que realizó la entrega
 */
async function enviarNotificacionEntregaGrupalMatrizador(documentos, datosEntrega, usuarioEntrega) {
  try {
    if (!documentos || documentos.length === 0) {
      console.log('⚠️ No hay documentos para notificar en entrega grupal');
      return;
    }

    console.log(`📧 [ENTREGA GRUPAL MATRIZADOR] Enviando notificación única para ${documentos.length} documentos`);

    const mensajes = construirMensajeEntregaGrupalMatrizador(documentos, {
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

    // Registrar evento de notificación grupal para cada documento
    for (const documento of documentos) {
      try {
        await EventoDocumento.create({
          documentoId: documento.id,
          tipo: 'notificacion_grupal',
          categoria: 'notificacion',
          titulo: 'Notificación Entrega Grupal - Matrizador',
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

    console.log(`✅ [ENTREGA GRUPAL MATRIZADOR] Notificación única enviada exitosamente para ${documentos.length} documentos`);

    // ============== NUEVO: GUARDAR EN HISTORIAL DE NOTIFICACIONES ==============
    try {
      await guardarNotificacionGrupalEnHistorialMatrizador(
        documentos, 
        datosEntrega, 
        usuarioEntrega, 
        metodoNotificacion, 
        mensajes.whatsapp
      );
    } catch (historialError) {
      console.error('❌ Error guardando en historial matrizador (continuando):', historialError);
      // No detener el flujo si falla el historial
    }

  } catch (error) {
    console.error('Error enviando notificación de entrega grupal matrizador:', error);
  }
}

// ============== FUNCIONES PARA ENTREGA GRUPAL - MATRIZADORES ==============

/**
 * FUNCIÓN MEJORADA: Detectar documentos grupales del mismo cliente para MATRIZADOR
 * @param {string} identificacionCliente - Identificación del cliente
 * @param {number} documentoActualId - ID del documento actual para excluir
 * @param {number} matrizadorId - ID del matrizador actual
 * @returns {Object} Información sobre documentos adicionales
 */
async function detectarDocumentosGrupalesMatrizador(identificacionCliente, documentoActualId, matrizadorId) {
  try {
    console.log(`🔍 [MATRIZADOR] Detectando documentos grupales para cliente: ${identificacionCliente}`);
    
    // MATRIZADOR: Detectar TODOS los documentos listos del cliente
    const todosLosDocumentos = await Documento.findAll({
      where: {
        identificacionCliente: identificacionCliente,
        estado: 'listo_para_entrega',
        fechaEntrega: null,
        id: { [Op.ne]: documentoActualId },
        motivoEliminacion: null
      },
      order: [['created_at', 'ASC']]
    });
    
    // Separar documentos propios vs de otros matrizadores
    const documentosPropios = todosLosDocumentos.filter(doc => doc.idMatrizador == matrizadorId);
    const documentosOtros = todosLosDocumentos.filter(doc => doc.idMatrizador != matrizadorId);
    
    console.log(`📄 [MATRIZADOR] Encontrados ${documentosPropios.length} propios, ${documentosOtros.length} de otros`);
    console.log(`📄 [MATRIZADOR] Documentos propios:`, documentosPropios.map(d => ({ id: d.id, codigo: d.codigoBarras, matrizador: d.idMatrizador })));
    console.log(`📄 [MATRIZADOR] Documentos otros:`, documentosOtros.map(d => ({ id: d.id, codigo: d.codigoBarras, matrizador: d.idMatrizador })));
    
    // ============== NUEVA FUNCIONALIDAD: ESTRUCTURACIÓN JERÁRQUICA CORREGIDA ==============
    // CORRECCIÓN CRÍTICA: Incluir el documento actual en la estructuración
    // para que se puedan formar grupos correctamente (solo con documentos propios)
    
    // Obtener el documento actual para incluirlo en la estructuración
    const documentoActual = await Documento.findByPk(documentoActualId);
    
    // Crear lista completa incluyendo el documento actual (solo si es del matrizador)
    let documentosParaEstructurar = documentosPropios;
    if (documentoActual && documentoActual.idMatrizador == matrizadorId) {
      documentosParaEstructurar = [documentoActual, ...documentosPropios];
      console.log(`🔧 [MATRIZADOR] Incluyendo documento actual en estructuración (es propio)`);
    } else if (documentoActual) {
      console.log(`⚠️ [MATRIZADOR] Documento actual no es del matrizador, no se incluye en estructuración`);
    }
    
    console.log(`🔧 [MATRIZADOR] Estructurando ${documentosParaEstructurar.length} documentos propios (incluyendo actual si aplica)`);
    documentosParaEstructurar.forEach(doc => {
      console.log(`   - ${doc.codigoBarras} (ID: ${doc.id}, Principal: ${doc.esDocumentoPrincipal}, PrincipalID: ${doc.documentoPrincipalId || 'null'})`);
    });
    
    // Importar la función de estructuración desde recepcionController
    const { estructurarDocumentosJerarquicamente } = require('./recepcionController');
    const documentosEstructurados = estructurarDocumentosJerarquicamente(documentosParaEstructurar);
    
    return {
      tieneDocumentosAdicionales: documentosPropios.length > 0 || documentosOtros.length > 0,
      cantidad: documentosPropios.length,
      documentos: documentosPropios, // Solo puede entregar los suyos
      documentosPropios: documentosPropios,
      documentosOtrosMatrizadores: documentosOtros,
      tipoDeteccion: 'matrizador_limitada',
      permisoTotal: false,
      // ============== NUEVA ESTRUCTURA JERÁRQUICA (SOLO DOCUMENTOS PROPIOS) ==============
      gruposRelacionados: documentosEstructurados.gruposRelacionados,
      documentosIndependientes: documentosEstructurados.documentosIndependientes,
      tieneGruposRelacionados: documentosEstructurados.gruposRelacionados.length > 0,
      tieneDocumentosIndependientes: documentosEstructurados.documentosIndependientes.length > 0
    };
  } catch (error) {
    console.error('❌ Error detectando documentos grupales para matrizador:', error);
    return { 
      tieneDocumentosAdicionales: false, 
      cantidad: 0, 
      documentos: [],
      documentosPropios: [],
      documentosOtrosMatrizadores: [],
      tipoDeteccion: 'matrizador_limitada',
      permisoTotal: false,
      gruposRelacionados: [],
      documentosIndependientes: [],
      tieneGruposRelacionados: false,
      tieneDocumentosIndependientes: false
    };
  }
}

/**
 * Procesa entrega grupal para matrizador (solo documentos propios)
 * @param {Array} documentosIds - IDs de documentos a entregar
 * @param {Object} datosEntrega - Datos del receptor
 * @param {Object} usuario - Usuario que procesa la entrega
 * @param {Object} transaction - Transacción de base de datos
 * @returns {Object} Resultado del procesamiento
 */
async function procesarEntregaGrupalMatrizador(documentosIds, datosEntrega, usuario, transaction) {
  try {
    console.log(`👤 [MATRIZADOR] Procesando entrega grupal de ${documentosIds.length} documentos para matrizador: ${usuario.id}`);
    
    const documentosActualizados = [];
    const erroresValidacion = [];
    
    for (const docId of documentosIds) {
      try {
        const documento = await Documento.findByPk(docId, { transaction });
        
        if (!documento) {
          erroresValidacion.push(`Documento ${docId} no encontrado`);
          continue;
        }
        
        // VALIDACIÓN CRÍTICA: Solo documentos del matrizador
        if (documento.idMatrizador !== usuario.id) {
          erroresValidacion.push(`Documento ${documento.codigoBarras} no pertenece al matrizador ${usuario.nombre}`);
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
          console.log(`⚠️ [MATRIZADOR] Documento ${documento.codigoBarras} tiene pago pendiente: ${documento.estadoPago}`);
        }
        
        // ACTUALIZAR DOCUMENTO
        await documento.update({
          estado: 'entregado',
          fechaEntrega: new Date(),
          nombreReceptor: datosEntrega.nombreReceptor,
          identificacionReceptor: datosEntrega.identificacionReceptor,
          relacionReceptor: datosEntrega.relacionReceptor
        }, { transaction });
        
        // REGISTRAR EVENTO DE ENTREGA GRUPAL
        await EventoDocumento.create({
          documentoId: documento.id,
          tipo: 'entrega_grupal',
          categoria: 'entrega',
          titulo: 'Entrega Grupal - Matrizador',
          descripcion: `Documento entregado en entrega grupal por matrizador ${usuario.nombre} a ${datosEntrega.nombreReceptor}`,
          detalles: {
            entregaGrupal: true,
            totalDocumentosGrupo: documentosIds.length,
            tipoEntregaGrupal: 'matrizador_limitada',
            rolProcesador: 'matrizador',
            matrizadorId: usuario.id,
            soloDocumentosPropiios: true,
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
              'pertenencia_cliente_confirmada',
              'pertenencia_matrizador_validada'
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
        console.log(`✅ [MATRIZADOR] Documento ${documento.codigoBarras} entregado grupalmente`);
        
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
    console.error('❌ Error en procesamiento grupal matrizador:', error);
    throw error;
  }
}

// Objeto que contendrá todas las funciones del controlador
const matrizadorController = {
  
  /**
   * Obtiene todos los matrizadores
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  obtenerTodos: async (req, res) => {
    try {
      console.log('Obteniendo todos los matrizadores...');
      const matrizadores = await Matrizador.findAll({
        raw: true // Obtener resultados como objetos planos JS en lugar de instancias de Sequelize
      });
      
      console.log(`Se encontraron ${matrizadores.length} matrizadores:`, 
        matrizadores.map(m => ({ id: m.id, nombre: m.nombre, email: m.email })));
      
      // Si es una solicitud de vista, renderizar la página de matrizadores
      if (!req.path.startsWith('/api/')) {
        console.log('Renderizando vista de matrizadores con:', matrizadores);
        return res.render('admin/matrizadores', {
          layout: 'admin',
          title: 'Gestión de Matrizadores',
          activeMatrizadores: true,
          matrizadores: matrizadores || [],
          userRole: req.matrizador?.rol || 'guest'
        });
      }
      
      return res.status(200).json({
        exito: true,
        datos: matrizadores,
        mensaje: 'Matrizadores obtenidos correctamente'
      });
    } catch (error) {
      console.error('Error al obtener matrizadores:', error);
      return res.status(500).json({
        exito: false,
        mensaje: 'Error al obtener los matrizadores',
        error: error.message
      });
    }
  },

  /**
   * Obtiene un matrizador por su ID
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  obtenerPorId: async (req, res) => {
    try {
      const { id } = req.params;
      const matrizador = await Matrizador.findByPk(id);
      
      if (!matrizador) {
        return res.status(404).json({
          exito: false,
          mensaje: `No se encontró matrizador con ID ${id}`
        });
      }

      return res.status(200).json({
        exito: true,
        datos: matrizador,
        mensaje: 'Matrizador obtenido correctamente'
      });
    } catch (error) {
      console.error('Error al obtener matrizador por ID:', error);
      return res.status(500).json({
        exito: false,
        mensaje: 'Error al obtener el matrizador',
        error: error.message
      });
    }
  },

  /**
   * Crea un nuevo matrizador
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  crear: async (req, res) => {
    try {
      const { nombre, email, identificacion, cargo, password, rol } = req.body;
      
      // Determinar la ruta de redirección según el contexto
      const esAdmin = req.originalUrl.includes('/admin/') || req.baseUrl.includes('/admin/');
      const rutaRedireccion = esAdmin ? '/admin/matrizadores' : '/matrizador';
      
      // Verificar campos obligatorios
      if (!nombre || !email || !identificacion || !cargo) {
        if (req.path.startsWith('/api/')) {
          return res.status(400).json({
            exito: false,
            mensaje: 'Faltan campos obligatorios'
          });
        }
        
        req.flash('error', 'Todos los campos son obligatorios');
        return res.redirect(rutaRedireccion);
      }
      
      // Verificar si ya existe un matrizador con el mismo email o identificación
      const matrizadorExistente = await Matrizador.findOne({
        where: {
          [Sequelize.Op.or]: [
            { email },
            { identificacion }
          ]
        }
      });
      
      if (matrizadorExistente) {
        if (req.path.startsWith('/api/')) {
          return res.status(400).json({
            exito: false,
            mensaje: 'Ya existe un matrizador con ese email o identificación'
          });
        }
        
        req.flash('error', 'Ya existe un matrizador con ese email o identificación');
        return res.redirect(rutaRedireccion);
      }
      
      // Preparar datos para crear el matrizador
      const datosMatrizador = {
        nombre,
        email,
        identificacion,
        cargo,
        rol: rol || 'matrizador', // Usar el rol proporcionado o el valor predeterminado
        activo: true
      };
      
      // Validar que el rol sea válido
      const rolesValidos = ['admin', 'matrizador', 'recepcion', 'consulta', 'caja', 'caja_archivo', 'archivo'];
      if (rol && !rolesValidos.includes(rol)) {
        datosMatrizador.rol = 'matrizador'; // Rol por defecto si no es válido
      }
      
      // Si se proporcionó contraseña, hashearla
      if (password) {
        const salt = await bcrypt.genSalt(10);
        datosMatrizador.password = await bcrypt.hash(password, salt);
      }
      
      const nuevoMatrizador = await Matrizador.create(datosMatrizador);
      
      // Si es una solicitud de vista, redirigir con mensaje de éxito
      if (!req.path.startsWith('/api/')) {
        req.flash('success', 'Matrizador creado correctamente');
        return res.redirect(rutaRedireccion);
      }
      
      // Para API, eliminar la contraseña de la respuesta
      const matrizadorRespuesta = nuevoMatrizador.toJSON();
      delete matrizadorRespuesta.password;
      
      return res.status(201).json({
        exito: true,
        datos: matrizadorRespuesta,
        mensaje: 'Matrizador creado correctamente'
      });
    } catch (error) {
      console.error('Error al crear matrizador:', error);
      
      if (req.path.startsWith('/api/')) {
        return res.status(500).json({
          exito: false,
          mensaje: 'Error al crear el matrizador',
          error: error.message
        });
      }
      
      req.flash('error', `Error al crear el matrizador: ${error.message}`);
      return res.redirect(rutaRedireccion);
    }
  },

  /**
   * Actualiza un matrizador existente
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  actualizar: async (req, res) => {
    try {
      // 🔍 DEBUG ESPECÍFICO PARA IDENTIFICAR EL PROBLEMA
      console.log('=== DEBUG ACTUALIZAR MATRIZADOR ===');
      console.log('URL original:', req.originalUrl);
      console.log('Path:', req.path);
      console.log('Método:', req.method);
      console.log('Usuario rol:', req.matrizador?.rol);
      console.log('Usuario nombre:', req.matrizador?.nombre);
      console.log('Body ID:', req.body.id);
      console.log('Params ID:', req.params.id);
      console.log('¿Es admin?:', req.originalUrl.includes('/admin/') || req.baseUrl.includes('/admin/'));
      console.log('=====================================');
      
      // Obtener ID de la ruta o del cuerpo de la solicitud
      const id = req.params.id || req.body.id;
      
      // Determinar la ruta de redirección según el contexto
      const esAdmin = req.originalUrl.includes('/admin/') || req.baseUrl.includes('/admin/');
      const rutaRedireccion = esAdmin ? '/admin/matrizadores' : '/matrizador';
      
      console.log(`🎯 Ruta de redirección determinada: ${rutaRedireccion}`);
      console.log(`Intentando actualizar matrizador con ID: ${id}`);
      
      // Validar que el ID exista
      if (!id) {
        console.error('Error: ID de matrizador no proporcionado');
        if (req.path.startsWith('/api/')) {
          return res.status(400).json({
            exito: false,
            mensaje: 'Debe proporcionar un ID de matrizador para actualizarlo'
          });
        }
        
        req.flash('error', 'Debe proporcionar un ID de matrizador para actualizarlo');
        console.log(`🔄 Redirigiendo por falta de ID a: ${rutaRedireccion}`);
        return res.redirect(rutaRedireccion);
      }
      
      const { nombre, email, identificacion, cargo, password, rol, activo } = req.body;
      
      // Buscar el matrizador
      const matrizador = await Matrizador.findByPk(id);
      
      if (!matrizador) {
        console.error(`No se encontró matrizador con ID ${id}`);
        if (req.path.startsWith('/api/')) {
          return res.status(404).json({
            exito: false,
            mensaje: `No se encontró matrizador con ID ${id}`
          });
        }
        
        req.flash('error', `No se encontró matrizador con ID ${id}`);
        return res.redirect(rutaRedireccion);
      }

      // Preparar datos para actualizar
      const datosActualizar = {};
      
      if (nombre) datosActualizar.nombre = nombre;
      if (email) datosActualizar.email = email;
      if (identificacion) datosActualizar.identificacion = identificacion;
      if (cargo) datosActualizar.cargo = cargo;
      if (rol) datosActualizar.rol = rol;
      if (activo !== undefined) datosActualizar.activo = activo === '1' || activo === true;
      
      // Si se proporcionó contraseña, hashearla
      if (password) {
        const salt = await bcrypt.genSalt(10);
        datosActualizar.password = await bcrypt.hash(password, salt);
      }
      
      console.log(`Actualizando matrizador ${matrizador.nombre} con datos:`, datosActualizar);
      await matrizador.update(datosActualizar);
      
      // Si es una solicitud de vista, redirigir con mensaje de éxito
      if (!req.path.startsWith('/api/')) {
        console.log(`✅ ÉXITO: Matrizador actualizado correctamente. Redirigiendo a: ${rutaRedireccion}`);
        req.flash('success', 'Matrizador actualizado correctamente');
        return res.redirect(rutaRedireccion);
      }
      
      // Eliminar la contraseña de la respuesta
      const matrizadorRespuesta = matrizador.toJSON();
      delete matrizadorRespuesta.password;
      
      return res.status(200).json({
        exito: true,
        datos: matrizadorRespuesta,
        mensaje: 'Matrizador actualizado correctamente'
      });
    } catch (error) {
      console.error('Error al actualizar matrizador:', error);
      
      if (req.path.startsWith('/api/')) {
        return res.status(500).json({
          exito: false,
          mensaje: 'Error al actualizar el matrizador',
          error: error.message
        });
      }
      
      req.flash('error', `Error al actualizar el matrizador: ${error.message}`);
      return res.redirect(rutaRedireccion);
    }
  },

  /**
   * Elimina un matrizador del sistema
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  eliminar: async (req, res) => {
    try {
      // Obtener ID de la ruta o del cuerpo de la solicitud
      const id = req.params.id || req.body.id;
      
      console.log(`Intentando eliminar matrizador con ID: ${id}`);
      
      // Validar que el ID exista
      if (!id) {
        console.error('Error: ID de matrizador no proporcionado para eliminar');
        if (req.path.startsWith('/api/')) {
          return res.status(400).json({
            exito: false,
            mensaje: 'Debe proporcionar un ID de matrizador para eliminarlo'
          });
        }
        
        req.flash('error', 'Debe proporcionar un ID de matrizador para eliminarlo');
        // CORREGIDO: Redirigir según el contexto de la ruta
        const redirectUrl = req.originalUrl.startsWith('/admin/') ? '/admin/matrizadores' : '/matrizador';
        return res.redirect(redirectUrl);
      }
      
      const matrizador = await Matrizador.findByPk(id);
      
      if (!matrizador) {
        console.error(`No se encontró matrizador con ID ${id} para eliminar`);
        if (req.path.startsWith('/api/')) {
          return res.status(404).json({
            exito: false,
            mensaje: `No se encontró matrizador con ID ${id}`
          });
        }
        
        req.flash('error', `No se encontró matrizador con ID ${id}`);
        // CORREGIDO: Redirigir según el contexto de la ruta
        const redirectUrl = req.originalUrl.startsWith('/admin/') ? '/admin/matrizadores' : '/matrizador';
        return res.redirect(redirectUrl);
      }

      console.log(`Eliminando matrizador: ${matrizador.nombre} (ID: ${matrizador.id})`);
      await matrizador.destroy();
      
      // Si es una solicitud de vista, redirigir con mensaje de éxito
      if (!req.path.startsWith('/api/')) {
        req.flash('success', 'Matrizador eliminado correctamente');
        // CORREGIDO: Redirigir según el contexto de la ruta
        const redirectUrl = req.originalUrl.startsWith('/admin/') ? '/admin/matrizadores' : '/matrizador';
        return res.redirect(redirectUrl);
      }
      
      return res.status(200).json({
        exito: true,
        mensaje: 'Matrizador eliminado correctamente'
      });
    } catch (error) {
      console.error('Error al eliminar matrizador:', error);
      
      if (req.path.startsWith('/api/')) {
        return res.status(500).json({
          exito: false,
          mensaje: 'Error al eliminar el matrizador',
          error: error.message
        });
      }
      
      req.flash('error', `Error al eliminar el matrizador: ${error.message}`);
      // CORREGIDO: Redirigir según el contexto de la ruta
      const redirectUrl = req.originalUrl.startsWith('/admin/') ? '/admin/matrizadores' : '/matrizador';
      return res.redirect(redirectUrl);
    }
  },
  
  /**
   * Genera y devuelve un código QR para un matrizador
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  generarQR: async (req, res) => {
    try {
      const { id } = req.params;
      const matrizador = await Matrizador.findByPk(id);
      
      if (!matrizador) {
        return res.status(404).json({
          exito: false,
          mensaje: `No se encontró matrizador con ID ${id}`
        });
      }
      
      // Obtener la URL que debe contener el QR
      const urlQR = matrizador.obtenerUrlQR();
      
      // Generar la imagen QR
      const qrCode = await QRCode.toDataURL(urlQR);
      
      // Si es una API, devolvemos el QR como datos
      if (req.path.startsWith('/api/')) {
        return res.status(200).json({
          exito: true,
          datos: {
            matrizador: {
              id: matrizador.id,
              nombre: matrizador.nombre,
              usuario: matrizador.usuario,
              codigoQR: matrizador.codigoQR
            },
            qrCode: qrCode,
            url: urlQR
          },
          mensaje: 'Código QR generado correctamente'
        });
      }
      
      // Si es una vista, renderizamos la página con el QR
      return res.render('matrizadores/qr', {
        title: 'Código QR de Matrizador',
        matrizador: {
          id: matrizador.id,
          nombre: matrizador.nombre,
          usuario: matrizador.usuario,
          codigoQR: matrizador.codigoQR
        },
        qrCode: qrCode,
        url: urlQR
      });
    } catch (error) {
      console.error('Error al generar QR:', error);
      return res.status(500).json({
        exito: false,
        mensaje: 'Error al generar el código QR',
        error: error.message
      });
    }
  },
  
  /**
   * Verifica un código QR y devuelve el matrizador asociado
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  verificarQR: async (req, res) => {
    try {
      const { codigo } = req.params;
      
      if (!codigo) {
        return res.status(400).json({
          exito: false,
          mensaje: 'Se requiere un código QR para verificar'
        });
      }
      
      // Buscar el matrizador por el código QR
      const matrizador = await Matrizador.findOne({
        where: { codigoQR: codigo, activo: true }
      });
      
      if (!matrizador) {
        return res.status(404).json({
          exito: false,
          mensaje: 'Código QR inválido o matrizador inactivo'
        });
      }
      
      // Generar token JWT para sesión
      const token = jwt.sign(
        { 
          id: matrizador.id,
          email: matrizador.email,
          nombre: matrizador.nombre,
          rol: matrizador.rol
        },
        process.env.JWT_SECRET || 'clave_secreta_notaria_2024',
        { expiresIn: process.env.JWT_EXPIRATION || '24h' }
      );
      
      // Actualizar fecha de último acceso
      await matrizador.update({ ultimoAcceso: new Date() });
      
      return res.status(200).json({
        exito: true,
        datos: {
          token,
          matrizador: {
            id: matrizador.id,
            nombre: matrizador.nombre,
            email: matrizador.email,
            rol: matrizador.rol
          }
        },
        mensaje: 'Código QR verificado correctamente'
      });
    } catch (error) {
      console.error('Error al verificar QR:', error);
      return res.status(500).json({
        exito: false,
        mensaje: 'Error al verificar el código QR',
        error: error.message
      });
    }
  },
  
  /**
   * Inicia sesión de un matrizador con email y contraseña
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  login: async (req, res) => {
    try {
      const { email, password } = req.body;
      
      // Validar que se hayan proporcionado credenciales
      if (!email || !password) {
        if (req.path.startsWith('/api/')) {
          return res.status(400).json({
            exito: false,
            mensaje: 'Se requiere email y contraseña'
          });
        }
        
        req.flash('error', 'Se requiere email y contraseña');
        return res.redirect('/login');
      }
      
      // Buscar el matrizador por email
      const matrizador = await Matrizador.findOne({
        where: { email, activo: true }
      });
      
      if (!matrizador) {
        if (req.path.startsWith('/api/')) {
          return res.status(401).json({
            exito: false,
            mensaje: 'Credenciales inválidas o usuario inactivo'
          });
        }
        
        req.flash('error', 'Credenciales inválidas o usuario inactivo');
        return res.redirect('/login');
      }
      
      // Verificar la contraseña
      const passwordValido = await bcrypt.compare(password, matrizador.password);
      
      if (!passwordValido) {
        if (req.path.startsWith('/api/')) {
          return res.status(401).json({
            exito: false,
            mensaje: 'Credenciales inválidas'
          });
        }
        
        req.flash('error', 'Credenciales inválidas');
        return res.redirect('/login');
      }
      
      // Generar token JWT para sesión
      const token = jwt.sign(
        { 
          id: matrizador.id,
          email: matrizador.email,
          nombre: matrizador.nombre,
          rol: matrizador.rol  // Incluir el rol en el token
        },
        process.env.JWT_SECRET || 'clave_secreta_notaria_2024',
        { expiresIn: process.env.JWT_EXPIRATION || '24h' }
      );
      
      // Actualizar fecha de último acceso
      await matrizador.update({ ultimoAcceso: new Date() });
      
      // Si es una vista, establecer cookies y redirigir
      if (!req.path.startsWith('/api/')) {
        // Establecer cookie con el token
        res.cookie('token', token, { 
          httpOnly: true, 
          secure: process.env.NODE_ENV === 'production',
          maxAge: 24 * 60 * 60 * 1000 // 24 horas
        });
        // Obtener datos del matrizador para redirigir según rol
        req.matrizador = {
          id: matrizador.id,
          nombre: matrizador.nombre,
          email: matrizador.email,
          cargo: matrizador.cargo,
          rol: matrizador.rol
        };
        return redirigirSegunRol(req, res);
      }
      
      // Si es una API, devolver el token
      return res.status(200).json({
        exito: true,
        datos: {
          token,
          matrizador: {
            id: matrizador.id,
            nombre: matrizador.nombre,
            email: matrizador.email,
            rol: matrizador.rol
          }
        },
        mensaje: 'Inicio de sesión exitoso'
      });
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      
      if (req.path.startsWith('/api/')) {
        return res.status(500).json({
          exito: false,
          mensaje: 'Error al iniciar sesión',
          error: error.message
        });
      }
      
      req.flash('error', `Error al iniciar sesión: ${error.message}`);
      return res.redirect('/login');
    }
  },
  
  /**
   * Cierra la sesión del matrizador
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  logout: (req, res) => {
    // Eliminar la cookie del token
    res.clearCookie('token');
    
    // Redirigir a la página de inicio
    return res.redirect('/login');
  },
  
  /**
   * Renderiza la página de administración de matrizadores
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  adminMatrizadores: async (req, res) => {
    try {
      const matrizadores = await Matrizador.findAll();
      
      return res.render('admin/matrizadores', {
        layout: 'admin',
        title: 'Gestión de Matrizadores',
        activeMatrizadores: true,
        matrizadores
      });
    } catch (error) {
      console.error('Error al cargar la página de administración:', error);
      return res.render('error', {
        layout: 'admin',
        title: 'Error',
        message: 'Error al cargar la página de administración de matrizadores'
      });
    }
  },

  /**
   * Muestra el dashboard del matrizador con estadísticas y documentos relevantes
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  dashboard: async (req, res) => {
    console.log("Accediendo al dashboard de matrizador");
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
      
      // Consulta de documentos activos del matrizador actual
      const [documentosActivos] = await sequelize.query(`
        SELECT COUNT(*) as total 
        FROM documentos 
        WHERE id_matrizador = :idMatrizador 
        AND estado != 'cancelado'
      `, {
        replacements: { idMatrizador: req.matrizador.id },
        type: sequelize.QueryTypes.SELECT
      });
      
      // Documentos en proceso en el período seleccionado
      const [documentosEnProceso] = await sequelize.query(`
        SELECT COUNT(*) as total 
        FROM documentos 
        WHERE id_matrizador = :idMatrizador 
        AND estado = 'en_proceso'
        AND created_at BETWEEN :fechaInicio AND :fechaFin
      `, {
        replacements: { 
          idMatrizador: req.matrizador.id,
          fechaInicio: fechaInicioSQL,
          fechaFin: fechaFinSQL
        },
        type: sequelize.QueryTypes.SELECT
      });
      
      // Documentos completados en el período seleccionado
      const [documentosCompletados] = await sequelize.query(`
        SELECT COUNT(*) as total 
        FROM documentos 
        WHERE id_matrizador = :idMatrizador 
        AND estado = 'listo_para_entrega'
      `, {
        replacements: { idMatrizador: req.matrizador.id },
        type: sequelize.QueryTypes.SELECT
      });
      
      // Documentos entregados en el período seleccionado
      const [documentosEntregados] = await sequelize.query(`
        SELECT COUNT(*) as total 
        FROM documentos 
        WHERE id_matrizador = :idMatrizador 
        AND estado = 'entregado'
        AND fecha_entrega BETWEEN :fechaInicio AND :fechaFin
      `, {
        replacements: { 
          idMatrizador: req.matrizador.id,
          fechaInicio: fechaInicioSQL,
          fechaFin: fechaFinSQL
        },
        type: sequelize.QueryTypes.SELECT
      });
      
      // Tiempo promedio de procesamiento
      const [tiempoPromedio] = await sequelize.query(`
        SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/86400) as promedio
        FROM documentos
        WHERE id_matrizador = :idMatrizador
        AND estado IN ('listo_para_entrega', 'entregado')
        AND updated_at BETWEEN :fechaInicio AND :fechaFin
      `, {
        replacements: { 
          idMatrizador: req.matrizador.id,
          fechaInicio: fechaInicioSQL,
          fechaFin: fechaFinSQL
        },
        type: sequelize.QueryTypes.SELECT
      });
      
      // Eficiencia de procesamiento (% completados en menos de 7 días)
      const [eficiencia] = await sequelize.query(`
        SELECT 
          CASE 
            WHEN COUNT(*) = 0 THEN 0
            ELSE COUNT(CASE WHEN EXTRACT(EPOCH FROM (updated_at - created_at))/86400 <= 7 THEN 1 END) * 100.0 / COUNT(*)
          END as porcentaje
        FROM documentos
        WHERE id_matrizador = :idMatrizador
        AND estado IN ('listo_para_entrega', 'entregado')
        AND updated_at BETWEEN :fechaInicio AND :fechaFin
      `, {
        replacements: { 
          idMatrizador: req.matrizador.id,
          fechaInicio: fechaInicioSQL,
          fechaFin: fechaFinSQL
        },
        type: sequelize.QueryTypes.SELECT
      });
      
      // Total Facturado por el matrizador en el período
      const [totalFacturadoMatrizador] = await sequelize.query(`
        SELECT SUM(valor_factura) as total
        FROM documentos
        WHERE id_matrizador = :idMatrizador
        AND fecha_factura BETWEEN :fechaInicio AND :fechaFin
        AND valor_factura IS NOT NULL
      `, {
        replacements: {
          idMatrizador: req.matrizador.id,
          fechaInicio: fechaInicioSQL,
          fechaFin: fechaFinSQL
        },
        type: sequelize.QueryTypes.SELECT
      });
      
      // Obtener documentos con alertas (más de 7 días en proceso)
      const documentosAlerta = await Documento.findAll({
        where: {
          idMatrizador: req.matrizador.id,
          estado: 'en_proceso',
          [Op.and]: [
            sequelize.literal(`EXTRACT(EPOCH FROM (NOW() - created_at))/86400 >= 7`)
          ]
        },
        order: [['created_at', 'DESC']],
        limit: 10
      });
      
      // Procesar documentos de alerta para añadir métricas
      const alertas = documentosAlerta.map(doc => {
        const diasEnSistema = moment().diff(moment(doc.created_at), 'days');
        return {
          ...doc.toJSON(),
          diasEnSistema,
          porcentajeDemora: Math.min(diasEnSistema * 10, 100) // Escala de 0-100 para barra de progreso
        };
      });
      
      // Obtener documentos en proceso recientes
      const docsEnProceso = await Documento.findAll({
        where: {
          idMatrizador: req.matrizador.id,
          estado: 'en_proceso'
        },
        order: [['created_at', 'DESC']],
        limit: 10
      });
      
      // Añadir días en proceso a cada documento
      const documentosEnProcesoData = docsEnProceso.map(doc => {
        const diasEnProceso = moment().diff(moment(doc.created_at), 'days');
        return {
          ...doc.toJSON(),
          diasEnProceso
        };
      });
      
      // Obtener documentos listos sin retirar
      const docsListos = await Documento.findAll({
        where: {
          idMatrizador: req.matrizador.id,
          estado: 'listo_para_entrega'
        },
        order: [['created_at', 'DESC']],
        limit: 10
      });
      
      // Añadir días sin retirar a cada documento
      const documentosListos = docsListos.map(doc => {
        const fechaListo = doc.created_at; // La fecha en que se actualizó al estado 'listo_para_entrega'
        const diasSinRetirar = moment().diff(moment(fechaListo), 'days');
        return {
          ...doc.toJSON(),
          fechaListo,
          diasSinRetirar
        };
      });
      
      // Datos para gráficos de productividad
      const datosProductividad = await sequelize.query(`
        SELECT 
          TO_CHAR(created_at, 'YYYY-MM-DD') as fecha,
          COUNT(*) as total
        FROM documentos
        WHERE id_matrizador = :idMatrizador
        AND created_at BETWEEN :fechaInicio AND :fechaFin
        AND (
          (estado = 'listo_para_entrega') OR
          (estado = 'entregado' AND created_at BETWEEN :fechaInicio AND :fechaFin)
        )
        GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
        ORDER BY fecha
      `, {
        replacements: { 
          idMatrizador: req.matrizador.id,
          fechaInicio: fechaInicioSQL,
          fechaFin: fechaFinSQL
        },
        type: sequelize.QueryTypes.SELECT
      });
      
      // Datos para gráficos de tiempo promedio por tipo de documento
      const datosTiempos = await sequelize.query(`
        SELECT 
          tipo_documento,
          AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/86400) as promedio
        FROM documentos
        WHERE id_matrizador = :idMatrizador
        AND estado IN ('listo_para_entrega', 'entregado')
        GROUP BY tipo_documento
        ORDER BY promedio DESC
      `, {
        replacements: { idMatrizador: req.matrizador.id },
        type: sequelize.QueryTypes.SELECT
      });
      
      // Datos para gráficos por tipo de documento
      const datosTipos = await sequelize.query(`
        SELECT 
          tipo_documento,
          COUNT(*) as total
        FROM documentos
        WHERE id_matrizador = :idMatrizador
        AND created_at BETWEEN :fechaInicio AND :fechaFin
        GROUP BY tipo_documento
        ORDER BY total DESC
      `, {
        replacements: { 
          idMatrizador: req.matrizador.id,
          fechaInicio: fechaInicioSQL,
          fechaFin: fechaFinSQL
        },
        type: sequelize.QueryTypes.SELECT
      });

      // Preparar datos para los gráficos
      const datosGraficos = {
        productividad: {
          labels: datosProductividad.map(d => d.fecha),
          datos: datosProductividad.map(d => d.total)
        },
        tiempos: {
          labels: datosTiempos.map(d => d.tipo_documento),
          datos: datosTiempos.map(d => {
            const promedio = d.promedio ? parseFloat(d.promedio) : 0;
            return promedio.toFixed(1);
          })
        },
        tipos: {
          labels: datosTipos.map(d => d.tipo_documento),
          datos: datosTipos.map(d => d.total)
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
        activos: documentosActivos.total || 0,
        enProceso: documentosEnProceso.total || 0,
        completados: documentosCompletados.total || 0,
        entregados: documentosEntregados.total || 0,
        totalFacturado: totalFacturadoMatrizador.total || 0,
        tiempoPromedio: tiempoPromedio.promedio ? parseFloat(tiempoPromedio.promedio).toFixed(1) : "0.0",
        eficiencia: eficiencia.porcentaje ? parseFloat(eficiencia.porcentaje).toFixed(1) : "0.0",
        alertas
      };
      
      // Renderizar el dashboard con los datos obtenidos
      res.render('matrizadores/dashboard', {
        layout: 'matrizador',
        title: 'Panel de Matrizador',
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre,
        stats,
        periodo: periodoData,
        documentosEnProceso: documentosEnProcesoData,
        documentosListos,
        datosGraficos
      });
    } catch (error) {
      console.error("Error al cargar el dashboard del matrizador:", error);
      res.status(500).render('error', {
        layout: 'matrizador',
        title: 'Error',
        message: 'Ha ocurrido un error al cargar el dashboard',
        error
      });
    }
  },
  
  listarDocumentos: async (req, res) => {
    console.log("Accediendo al listado de documentos de matrizador");
    console.log("Usuario:", req.matrizador?.nombre, "Rol:", req.matrizador?.rol, "ID:", req.matrizador?.id);
    console.log("Ruta solicitada:", req.originalUrl);
    
    try {
      // Parámetros de paginación
      const page = parseInt(req.query.page) || 1;
      const limit = 10;
      const offset = (page - 1) * limit;
      
      // Parámetros de filtrado
      const estado = req.query.estado || '';
      const tipoDocumento = req.query.tipoDocumento || '';
      const busqueda = req.query.busqueda || '';
      
      // Construir condiciones de filtrado
      const where = {
        // Importante: Filtrar por el ID del matrizador actual
        idMatrizador: req.matrizador.id
      };
      
      if (estado) {
        where.estado = estado;
      }
      
      if (tipoDocumento) {
        where.tipo_documento = tipoDocumento;
      }
      
      if (busqueda) {
        where[Op.or] = [
          { codigo_barras: { [Op.iLike]: `%${busqueda}%` } },
          { nombre_cliente: { [Op.iLike]: `%${busqueda}%` } }
        ];
      }
      
      console.log("Buscando documentos con filtros:", where);
      
      // Obtener documentos con paginación
      const { count, rows: documentos } = await Documento.findAndCountAll({
        where,
        order: [['created_at', 'DESC']],
        limit,
        offset
      });
      
      console.log("Documentos encontrados para matrizador:", documentos ? documentos.length : 'ninguno');
      if (documentos && documentos.length > 0) {
        console.log("Primer documento:", documentos[0].dataValues);
      }
      
      // Preparar datos para la paginación
      const totalPages = Math.ceil(count / limit);
      const pagination = {
        pages: []
      };
      
      // Generar URLs para la paginación
      const baseUrl = '/matrizador/documentos?';
      const queryParams = new URLSearchParams();
      
      if (estado) queryParams.append('estado', estado);
      if (tipoDocumento) queryParams.append('tipoDocumento', tipoDocumento);
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
      
      res.render('matrizadores/documentos/listado', {
        layout: 'matrizador',
        title: 'Mis Documentos',
        documentos,
        pagination,
        tiposDocumento,
        filtros: {
          estado: {
            [estado]: true
          },
          tipoDocumento,
          busqueda
        },
        usuario: req.matrizador
      });
    } catch (error) {
      console.error('Error al listar documentos del matrizador:', error);
      res.status(500).render('error', {
        layout: 'matrizador',
        title: 'Error',
        message: 'Ha ocurrido un error al cargar el listado de documentos',
        error
      });
    }
  },
  
  detalleDocumento: async (req, res) => {
    try {
      const { id } = req.params;
      const usuarioId = req.matrizador?.id || req.user?.id;
      const usuarioNombre = req.matrizador?.nombre || req.user?.nombre;
      
      console.log(`Obteniendo detalle de documento ID: ${id} para matrizador: ${usuarioNombre}`);
      
      // Buscar documento con sus relaciones
      const documento = await Documento.findByPk(id, {
        include: [
          {
            model: Matrizador,
            as: 'matrizador',
            attributes: ['id', 'nombre', 'email']
          }
        ]
      });
      
      if (!documento) {
        return res.status(404).render('error', { 
          message: 'Documento no encontrado',
          layout: 'matrizador' // CORREGIDO: quitar 'layouts/'
        });
      }
      
      console.log(`Documento encontrado: ${documento.id} ${documento.codigoBarras}`);
      
      // Buscar eventos del documento con información mejorada - CORREGIDO: ordenar por fecha DESC
      const eventos = await EventoDocumento.findAll({
        where: { 
          documentoId: id,
          // NUEVO: Filtrar tipos de eventos que no aportan valor al historial para matrizadores
          tipo: {
            [Op.notIn]: ['pago', 'vista', 'revision'] // Pagos se muestran arriba, vista/revision son spam
          }
        },
        order: [['created_at', 'DESC']] // Más recientes primero
      });
      
      console.log(`Encontrados ${eventos.length} eventos para el documento`);
      
      // Construir historial mejorado con la nueva información
      const historialEventos = eventos.map(evento => {
        // Usar la información mejorada o construir información útil
        const titulo = evento.titulo || traducirTipoEvento(evento.tipo);
        let descripcion = evento.descripcion || evento.detalles || 'Sin descripción disponible';
        const categoria = evento.categoria || determinarCategoriaEvento(evento.tipo);
        
        // Procesar detalles específicos por tipo de evento
        let detallesProcessed = {};
        try {
          // Si detalles es string JSON, parsearlo
          if (typeof evento.detalles === 'string') {
            // Verificar si es JSON válido
            if (evento.detalles.trim().startsWith('{') || evento.detalles.trim().startsWith('[')) {
              detallesProcessed = JSON.parse(evento.detalles);
            } else {
              // Si es texto plano, crear un objeto simple
              detallesProcessed = { descripcion: evento.detalles };
            }
          } else if (evento.detalles && typeof evento.detalles === 'object') {
            detallesProcessed = evento.detalles;
          } else {
            // Si no hay detalles válidos, usar objeto vacío
            detallesProcessed = {};
          }
        } catch (e) {
          console.log(`⚠️ Error parsing detalles para evento ${evento.id}: ${e.message}`);
          // En caso de error, tratar como texto plano
          detallesProcessed = { 
            descripcion: typeof evento.detalles === 'string' ? evento.detalles : 'Sin detalles' 
          };
        }
        
        // Mejorar información del usuario
        let usuarioInfo = evento.usuario;
        if (evento.matrizador) {
          usuarioInfo = `${evento.matrizador.nombre} (${evento.matrizador.rol})`;
        } else if (!usuarioInfo) {
          usuarioInfo = 'Sistema';
        }
        
        // Construir información específica para eventos de entrega
        if (evento.tipo === 'entrega' && documento.nombreReceptor) {
          detallesProcessed = {
            ...detallesProcessed,
            receptor: documento.nombreReceptor,
            identificacionReceptor: documento.identificacionReceptor,
            relacion: documento.relacionReceptor || 'titular'
          };
          
          // Mejorar descripción de entrega
          descripcion = `Documento entregado a ${documento.nombreReceptor} (${documento.identificacionReceptor}) - Relación: ${documento.relacionReceptor || 'titular'}`;
        }
        
        // Construir información específica para eventos de pago
        if (evento.tipo === 'pago') {
          if (!detallesProcessed.valor && documento.valorPagado) {
            detallesProcessed.valor = documento.valorPagado;
          }
          if (!detallesProcessed.metodoPago && documento.metodoPago) {
            detallesProcessed.metodoPago = documento.metodoPago;
          }
          if (!detallesProcessed.numeroFactura && documento.numeroFactura) {
            detallesProcessed.numeroFactura = documento.numeroFactura;
          }
          if (!detallesProcessed.usuarioCaja) {
            detallesProcessed.usuarioCaja = usuarioInfo;
          }
        }
        
        return {
          id: evento.id,
          tipo: evento.tipo,
          categoria: categoria,
          titulo: titulo,
          descripcion: descripcion,
          detalles: detallesProcessed,
          usuario: usuarioInfo,
          fecha: evento.created_at,
          // ELIMINADO: tiempoTranscurrido - ya no mostraremos "Menos de un minuto"
          icono: obtenerIconoEvento(evento.tipo),
          color: obtenerColorEvento(evento.tipo)
        };
      });
      
      // Marcar documento como visto por el matrizador (sin crear evento)
      if (documento.idMatrizador === usuarioId && !documento.visto_por_matrizador) {
        await documento.update({ visto_por_matrizador: true });
        console.log(`📖 Documento ${documento.codigoBarras} marcado como visto por primera vez por ${usuarioNombre}`);
        
        // NO crear evento de vista - estos eventos contaminan el historial
        // Solo actualizamos el campo para control interno
      }
      
      // Obtener lista de matrizadores para posibles reasignaciones
      const matrizadores = await Matrizador.findAll({
        where: { activo: true },
        attributes: ['id', 'nombre'],
        order: [['nombre', 'ASC']]
      });
      
      res.render('matrizadores/documentos/detalle', {
        documento,
        eventos: historialEventos, // Eventos ya ordenados por fecha DESC
        matrizadores,
        usuario: req.matrizador || req.user,
        layout: 'matrizador' // CORREGIDO: quitar 'layouts/'
      });
      
    } catch (error) {
      console.error('Error al obtener detalle de documento:', error);
      res.status(500).render('error', { 
        message: 'Error interno del servidor al cargar detalle',
        layout: 'matrizador' // CORREGIDO: quitar 'layouts/'
      });
    }
  },
  
  mostrarFormularioRegistro: (req, res) => {
    console.log("Accediendo al formulario de registro de matrizador");
    console.log("Usuario:", req.matrizador?.nombre, "Rol:", req.matrizador?.rol);
    console.log("Ruta solicitada:", req.originalUrl);
    res.render('matrizadores/documentos/registro', { 
      layout: 'matrizador', 
      title: 'Registrar Documento', 
      userRole: req.matrizador?.rol, 
      userName: req.matrizador?.nombre,
      usuario: req.matrizador // Pasar el usuario completo para el campo id_matrizador
    });
  },

  registrarDocumento: async (req, res) => {
    console.log("Registrando documento como matrizador");
    console.log("Usuario:", req.matrizador?.nombre, "Rol:", req.matrizador?.rol);
    console.log("Datos recibidos:", req.body);
    
    const transaction = await sequelize.transaction();
    
    try {
      // Extraer los datos del formulario
      const {
        codigoBarras,
        tipoDocumento,
        nombreCliente,
        identificacionCliente,
        emailCliente,
        telefonoCliente,
        idMatrizador,
        notas,
        // Nuevos campos de facturación y pago
        numeroFactura,
        valorFactura,
        fechaFactura,
        estadoPago,
        metodoPago,
        // Campos de omisión de notificaciones
        omitirNotificacion,
        motivoOmision,
        detalleOmision,
        comparecientesJSON
      } = req.body;
      
      // Verificar campos obligatorios
      if (!codigoBarras || !tipoDocumento || !nombreCliente || !identificacionCliente) {
        await transaction.rollback();
        req.flash('error', 'Faltan campos obligatorios');
        return res.render('matrizadores/documentos/registro', {
          layout: 'matrizador',
          title: 'Registrar Documento',
          userRole: req.matrizador?.rol,
          userName: req.matrizador?.nombre,
          usuario: req.matrizador,
          formData: req.body // Mantener los datos ingresados
        });
      }
      
      // Verificar si ya existe un documento con ese código de barras
      const documentoExistente = await Documento.findOne({
        where: { codigoBarras },
        transaction
      });
      
      if (documentoExistente) {
        await transaction.rollback();
        req.flash('error', 'Ya existe un documento con ese código de barras');
        return res.render('matrizadores/documentos/registro', {
          layout: 'matrizador',
          title: 'Registrar Documento',
          userRole: req.matrizador?.rol,
          userName: req.matrizador?.nombre,
          usuario: req.matrizador,
          formData: req.body
        });
      }
      
      // Procesar comparecientes
      let comparecientesJson = [];
      try {
        if (comparecientesJSON) {
          comparecientesJson = JSON.parse(comparecientesJSON);
        }
      } catch (e) {
        console.error('Error al procesar comparecientes:', e);
        comparecientesJson = [];
      }
      
      // Crear el documento
      const nuevoDocumento = await Documento.create({
        codigoBarras,
        tipoDocumento,
        nombreCliente,
        identificacionCliente,
        emailCliente,
        telefonoCliente,
        idMatrizador: req.matrizador.id,
        notas,
        numeroFactura,
        valorFactura: valorFactura ? parseFloat(valorFactura) : null,
        fechaFactura,
        estadoPago: estadoPago || 'pendiente',
        metodoPago: metodoPago || 'pendiente',
        omitirNotificacion: omitirNotificacion === 'true',
        motivoOmision,
        detalleOmision,
        comparecientes: comparecientesJson,
        estado: 'en_proceso',
        idUsuarioCreador: req.matrizador.id,
        rolUsuarioCreador: req.matrizador.rol
      }, { transaction });
      
      // Registrar el evento de creación
      try {
        await EventoDocumento.create({
          documentoId: nuevoDocumento.id,
          tipo: 'registro',
          descripcion: 'Documento registrado por matrizador',
          usuario: req.matrizador.nombre
        }, { transaction });
      } catch (eventError) {
        console.error('Error al registrar evento de documento:', eventError);
        // Continuar con la transacción aunque el registro de eventos falle
      }
      
      await transaction.commit();
      
      req.flash('success', 'Documento registrado exitosamente');
      res.redirect('/matrizador/documentos');
    } catch (error) {
      await transaction.rollback();
      console.error('Error al registrar documento:', error);

      let errorMessage = error.message;
      let errorCodeDuplicado = false;

      if (error.name === 'SequelizeUniqueConstraintError') {
        const esErrorCodigoBarras = error.errors && error.errors.some(e => e.path === 'codigo_barras' || e.path === 'codigoBarras');
        if (esErrorCodigoBarras) {
          errorMessage = `El código de barras '${req.body.codigoBarras}' ya existe. Por favor, ingrese uno diferente.`;
          errorCodeDuplicado = true;
        } else {
          errorMessage = 'Ya existe un registro con uno de los valores únicos ingresados.';
        }
      }

      if (!errorCodeDuplicado) {
        req.flash('error', errorMessage);
      }

      res.render('matrizadores/documentos/registro', {
        layout: 'matrizador',
        title: 'Registrar Documento',
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre,
        usuario: req.matrizador,
        formData: req.body,
        error: errorCodeDuplicado ? null : errorMessage,
        errorCodeDuplicado: errorCodeDuplicado,
        modalErrorMessage: errorCodeDuplicado ? errorMessage : null
      });
    }
  },

  /**
   * Marcar un documento como visto por el matrizador
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  marcarDocumentoVisto: async (req, res) => {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          exito: false,
          mensaje: 'ID de documento no proporcionado'
        });
      }
      
      // Buscar el documento
      const documento = await Documento.findByPk(id);
      
      if (!documento) {
        return res.status(404).json({
          exito: false,
          mensaje: `No se encontró documento con ID ${id}`
        });
      }
      
      // Solo actualizar si no había sido visto antes (evitar eventos repetitivos)
      if (!documento.visto_por_matrizador) {
        await documento.update({ visto_por_matrizador: true });
        
        console.log(`📖 Documento ${documento.codigoBarras} marcado como visto por primera vez por ${req.matrizador?.nombre}`);
        
        // NO crear evento - estos eventos contaminan el historial y no aportan valor
        // Los eventos importantes son: creación, pagos, entregas, cambios de estado
      } else {
        console.log(`📖 Documento ${documento.codigoBarras} ya había sido visto por ${req.matrizador?.nombre} - sin cambios`);
      }
      
      return res.status(200).json({
        exito: true,
        mensaje: 'Documento procesado correctamente'
      });
    } catch (error) {
      console.error('Error al marcar documento como visto:', error);
      return res.status(500).json({
        exito: false,
        mensaje: 'Error al marcar el documento como visto',
        error: error.message
      });
    }
  },

  /**
   * Mostrar página de búsqueda de documentos para matrizadores
   */
  mostrarBuscarDocumentos: async (req, res) => {
    try {
      res.render('matrizadores/documentos/buscar', {
        layout: 'matrizador',
        title: 'Buscar Documentos',
        activeBuscar: true,
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre
      });
    } catch (error) {
      console.error('Error al mostrar página de búsqueda:', error);
      req.flash('error', 'Error al cargar la página de búsqueda');
      res.redirect('/matrizador');
    }
  },

  /**
   * Buscar documentos principales para vincular como habilitantes
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  buscarDocumentosPrincipales: async (req, res) => {
    try {
      const { clienteId, excludeId } = req.query;
      
      if (!clienteId) {
        return res.status(400).json({
          exito: false,
          mensaje: 'ID de cliente no proporcionado'
        });
      }
      
      // Construir condiciones de búsqueda
      const whereClause = {
        identificacionCliente: clienteId,
        estado: ['listo_para_entrega', 'en_proceso'],
        idMatrizador: req.matrizador.id // Solo documentos del mismo matrizador
      };
      
      // Excluir el documento actual si se proporciona
      if (excludeId) {
        whereClause.id = { [Op.ne]: excludeId };
      }
      
      const documentos = await Documento.findAll({
        where: whereClause,
        attributes: ['id', 'codigoBarras', 'tipoDocumento', 'nombreCliente'],
        order: [['created_at', 'DESC']],
        limit: 20
      });
      
      return res.status(200).json({
        exito: true,
        datos: documentos,
        mensaje: `Se encontraron ${documentos.length} documentos principales disponibles`
      });
    } catch (error) {
      console.error('Error al buscar documentos principales:', error);
      return res.status(500).json({
        exito: false,
        mensaje: 'Error interno del servidor',
        error: error.message
      });
    }
  },
  
  /**
   * Muestra el historial de notificaciones con filtros mejorados
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  historialNotificaciones: async (req, res) => {
    try {
      const { fechaDesde, fechaHasta, tipo, canal, busqueda } = req.query;
      
      let whereClause = {};
      let documentoWhereClause = {
        idMatrizador: req.matrizador.id
      };
      
      // Filtros de fecha
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
      if (tipo) whereClause.tipoEvento = tipo; // CORREGIDO: usar tipoEvento
      if (canal && canal !== '') {
        whereClause.canal = canal; // CORREGIDO: usar campo directo
      }
      
      // ============== BÚSQUEDA POR TEXTO ==============
      if (busqueda && busqueda.trim() !== '') {
        const textoBusqueda = busqueda.trim();
        documentoWhereClause[Op.or] = [
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
      
      // ============== CORRECCIÓN: CONSULTAR CON RELACIONES CORRECTAS ==============
      const notificaciones = await NotificacionEnviada.findAll({
        where: {
          // Filtrar por tipos de evento de notificación
          tipoEvento: {
            [Op.in]: ['documento_listo', 'entrega_confirmada', 'entrega_grupal', 'recordatorio', 'alerta_sin_recoger']
          },
          ...whereClause
        },
        include: [{
          model: Documento,
          as: 'documento',
          attributes: [
            'id',
            'codigoBarras', 
            'tipoDocumento', 
            'nombreCliente', 
            'emailCliente', 
            'telefonoCliente',
            'numeroFactura', 
            'identificacionCliente',
            'idMatrizador', // AÑADIDO: incluir idMatrizador
            'estado'
          ],
          include: [{
            model: Matrizador,
            as: 'matrizador',
            attributes: ['id', 'nombre', 'email'],
            required: false
          }],
          where: documentoWhereClause,
          required: false // Permitir notificaciones grupales sin documento específico
        }],
        order: [['created_at', 'DESC']],
        limit: 50
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
        
        // ============== CORREGIR MAPEO DE CAMPOS ==============
        notifData.tipo = notifData.tipoEvento; // Mapear tipoEvento -> tipo para la vista
        notifData.detalles = notifData.mensajeEnviado || 'Notificación enviada';
        notifData.usuario = notifData.metadatos?.entregadoPor || req.matrizador?.nombre || 'Sistema';
        
        // Agregar información de canal al metadatos para la vista
        if (!notifData.metadatos.canal) {
          notifData.metadatos.canal = notifData.canal;
        }
        if (!notifData.metadatos.estado) {
          notifData.metadatos.estado = notifData.estado;
        }
        
        // ============== CORREGIR INFORMACIÓN DEL MATRIZADOR ==============
        // Si no hay documento (notificaciones grupales), usar metadatos
        if (!notifData.documento && notifData.metadatos) {
          // Crear documento virtual para notificaciones grupales
          notifData.documento = {
            codigoBarras: 'ENTREGA GRUPAL',
            tipoDocumento: 'Múltiples tipos',
            nombreCliente: notifData.metadatos.nombreCliente || 'Cliente no especificado',
            emailCliente: notifData.metadatos.emailCliente || null,
            telefonoCliente: notifData.metadatos.telefonoCliente || null,
            numeroFactura: null,
            identificacionCliente: notifData.metadatos.identificacionCliente || null,
            matrizador: {
              id: req.matrizador.id,
              nombre: req.matrizador.nombre,
              email: req.matrizador.email
            }
          };
        } else if (notifData.documento && !notifData.documento.matrizador) {
          // Si el documento no tiene matrizador cargado, usar el matrizador actual
          notifData.documento.matrizador = {
            id: req.matrizador.id,
            nombre: req.matrizador.nombre,
            email: req.matrizador.email
          };
        }
        
        console.log(`📅 [MATRIZADOR] Notificación ID ${notifData.id}: fecha = ${notifData.created_at}, tipo = ${notifData.tipo}, matrizador = ${notifData.documento?.matrizador?.nombre || 'No disponible'}`);
        
        return notifData;
      });
      
      // ============== CALCULAR ESTADÍSTICAS ==============
      const stats = {
        total: notificaciones.length,
        enviadas: notificaciones.filter(n => n.estado === 'enviado').length,
        fallidas: notificaciones.filter(n => n.estado === 'fallido').length,
        pendientes: notificaciones.filter(n => n.estado === 'pendiente').length
      };
      
      res.render('matrizadores/notificaciones/historial', {
        layout: 'matrizador',
        title: 'Historial de Notificaciones',
        notificaciones: notificacionesProcesadas,
        stats,
        filtros: { fechaDesde, fechaHasta, tipo, canal, busqueda },
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre
      });
      
    } catch (error) {
      console.error('Error en historial notificaciones:', error);
      res.status(500).render('error', { 
        layout: 'matrizador',
        title: 'Error',
        message: 'Error al cargar historial de notificaciones' 
      });
    }
  },

  /**
   * Obtiene los detalles de una notificación específica (API)
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
      
      // ============== CORRECCIÓN: BUSCAR EN TABLA CORRECTA ==============
      // Cambiar de EventoDocumento a NotificacionEnviada
      const notificacion = await NotificacionEnviada.findOne({
        where: {
          id: id
        },
        include: [{
          model: Documento,
          as: 'documento',
          attributes: ['codigoBarras', 'tipoDocumento', 'nombreCliente', 'emailCliente', 'telefonoCliente', 'notas'],
          where: {
            idMatrizador: req.matrizador.id
          },
          required: false // Para notificaciones grupales
        }]
      });
      
      if (!notificacion) {
        return res.status(404).json({
          exito: false,
          mensaje: 'Notificación no encontrada o no tienes permisos para verla'
        });
      }
      
      // ============== OBTENER MENSAJE ENVIADO ==============
      // En NotificacionEnviada ya tenemos el mensaje guardado
      let mensajeEnviado = notificacion.mensajeEnviado || 'Mensaje no disponible';
      
      // Si no hay mensaje guardado, usar el tipo de evento para mostrar información básica
      if (!mensajeEnviado || mensajeEnviado === 'Notificación enviada') {
        if (notificacion.tipoEvento === 'documento_listo') {
          mensajeEnviado = `📋 Notificación de documento listo para entrega`;
        } else if (notificacion.tipoEvento === 'entrega_confirmada') {
          mensajeEnviado = `✅ Confirmación de entrega de documento`;
        } else if (notificacion.tipoEvento === 'entrega_grupal') {
          const totalDocs = notificacion.metadatos?.totalDocumentos || 'varios';
          mensajeEnviado = `📦 Confirmación de entrega grupal (${totalDocs} documentos)`;
        } else {
          mensajeEnviado = `📱 Notificación de ${notificacion.tipoEvento}`;
        }
      }
      
      // Preparar datos detallados
      const detalles = {
        id: notificacion.id,
        tipo: notificacion.tipoEvento,
        fecha: notificacion.created_at ? new Date(notificacion.created_at).toISOString() : null,
        detalles: notificacion.mensajeEnviado || 'Notificación enviada',
        usuario: notificacion.metadatos?.entregadoPor || 'Sistema',
        documento: notificacion.documento ? {
          codigo: notificacion.documento.codigoBarras,
          tipo: notificacion.documento.tipoDocumento,
          cliente: notificacion.documento.nombreCliente
        } : {
          // Para notificaciones grupales sin documento específico
          codigo: 'Entrega Grupal',
          tipo: 'Múltiples documentos',
          cliente: notificacion.metadatos?.nombreCliente || 'Cliente no especificado'
        },
        metadatos: notificacion.metadatos || {},
        canales: {
          email: notificacion.documento?.emailCliente || notificacion.metadatos?.emailCliente,
          telefono: notificacion.documento?.telefonoCliente || notificacion.metadatos?.telefonoCliente
        },
        canal: notificacion.canal,
        estado: notificacion.estado,
        destinatario: notificacion.destinatario,
        mensajeEnviado: mensajeEnviado // ← NUEVO: Mensaje completo enviado
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

  // Nueva función para marcar documentos como listos para entrega
  marcarDocumentoListo: async (req, res) => {
    console.log("Marcando documento como listo para entrega");
    console.log("Usuario:", req.matrizador?.nombre, "Rol:", req.matrizador?.rol);
    console.log("Datos recibidos:", req.body);
    
    const transaction = await sequelize.transaction();
    
    try {
      const { documentoId } = req.body;
      
      if (!documentoId) {
        await transaction.rollback();
        req.flash('error', 'ID de documento no proporcionado');
        return res.redirect('/matrizador/documentos');
      }
      
      // Buscar el documento y verificar que pertenezca al matrizador actual
      const documento = await Documento.findOne({
        where: {
          id: documentoId,
          idMatrizador: req.matrizador.id
        },
        transaction
      });
      
      if (!documento) {
        await transaction.rollback();
        req.flash('error', 'El documento no existe o no tienes permisos para modificarlo');
        return res.redirect('/matrizador/documentos');
      }
      
      // Verificar que el documento esté en estado "en_proceso"
      if (documento.estado !== 'en_proceso') {
        await transaction.rollback();
        req.flash('error', 'Solo se pueden marcar como listos los documentos en proceso');
        return res.redirect('/matrizador/documentos');
      }
      
      // ============== VALIDACIÓN: PREVENIR MARCAR HABILITANTES INDIVIDUALMENTE ==============
      
      // Si es un documento habilitante, verificar si se debe marcar junto con el principal
      if (!documento.esDocumentoPrincipal && documento.documentoPrincipalId) {
        console.log(`⚠️ Intento de marcar documento habilitante ID: ${documento.id} como listo individualmente`);
        
        // Buscar el documento principal para verificar su estado
        const documentoPrincipal = await Documento.findByPk(documento.documentoPrincipalId, { transaction });
        
        if (documentoPrincipal && documentoPrincipal.estado === 'en_proceso') {
          await transaction.rollback();
          req.flash('warning', `Este documento habilitante se marcará como listo automáticamente cuando se marque el documento principal "${documentoPrincipal.codigoBarras}" como listo. Por favor, marque el documento principal en su lugar.`);
          return res.redirect('/matrizador/documentos');
        } else if (documentoPrincipal && documentoPrincipal.estado === 'listo_para_entrega') {
          // Si el principal ya está listo, permitir marcar el habilitante individualmente
          console.log(`ℹ️ Permitiendo marcar habilitante individualmente porque el principal ya está listo`);
        } else {
          await transaction.rollback();
          req.flash('error', 'No se puede determinar el estado del documento principal. Verifique la configuración del documento.');
          return res.redirect('/matrizador/documentos');
        }
      }
      
      // ============== CORRECCIÓN: GENERACIÓN CONDICIONAL DE CÓDIGO DE VERIFICACIÓN ==============
      
      // Verificar si debe generar código de verificación - SOLO WHATSAPP
      const debeNotificar = !documento.omitirNotificacion && 
                           documento.telefonoCliente;
      
      const esEntregaInmediata = documento.entregadoInmediatamente || false;
      
      let codigoVerificacion = null;
      let mensajeNotificacion = '';
      
      if (debeNotificar && !esEntregaInmediata) {
        // Solo generar código si se va a notificar Y no es entrega inmediata
        codigoVerificacion = Math.floor(1000 + Math.random() * 9000).toString();
        mensajeNotificacion = 'Se enviará código de verificación al cliente';
        console.log(`✅ Generando código de verificación: ${codigoVerificacion} para documento ${documento.codigoBarras}`);
      } else {
        // No generar código en estos casos:
        // - Omitir notificación activado
        // - Sin datos de contacto del cliente
        // - Entrega inmediata
        codigoVerificacion = null;
        
        if (documento.omitirNotificacion) {
          mensajeNotificacion = 'Sin código - notificación omitida por configuración';
          console.log(`⏭️ No se generará código para documento ${documento.codigoBarras}: notificación omitida`);
        } else if (esEntregaInmediata) {
          mensajeNotificacion = 'Sin código - entrega inmediata configurada';
          console.log(`⚡ No se generará código para documento ${documento.codigoBarras}: entrega inmediata`);
        } else {
          mensajeNotificacion = 'Sin código - falta número de teléfono del cliente';
          console.log(`⚠️ No se generará código para documento ${documento.codigoBarras}: sin teléfono`);
        }
      }
      
      // Actualizar estado y código de verificación del documento principal
      documento.estado = 'listo_para_entrega';
      documento.codigoVerificacion = codigoVerificacion; // Puede ser null
      await documento.save({ transaction });
      
      // ============== NUEVA LÓGICA: ACTUALIZAR DOCUMENTOS HABILITANTES RELACIONADOS ==============
      
      let documentosHabilitantesActualizados = 0;
      
      // Solo buscar documentos habilitantes si este es un documento principal
      if (documento.esDocumentoPrincipal) {
        console.log(`🔍 Verificando si el documento principal ${documento.id} tiene documentos habilitantes...`);
        
        // Buscar todos los documentos habilitantes relacionados
        const documentosHabilitantes = await Documento.findAll({
          where: {
            documentoPrincipalId: documento.id,
            esDocumentoPrincipal: false,
            estado: 'en_proceso' // Solo actualizar los que están en proceso
          },
          transaction
        });
        
        if (documentosHabilitantes.length > 0) {
          console.log(`📄 Encontrados ${documentosHabilitantes.length} documentos habilitantes para actualizar`);
          
          // Actualizar todos los documentos habilitantes al mismo estado
          for (const habilitante of documentosHabilitantes) {
            // ============== APLICAR MISMA LÓGICA CONDICIONAL A HABILITANTES ==============
            
            // Verificar si el habilitante debe tener código - SOLO WHATSAPP
            const debeNotificarHabilitante = !habilitante.omitirNotificacion && 
                                           habilitante.telefonoCliente;
            
            const esEntregaInmediataHabilitante = habilitante.entregadoInmediatamente || false;
            
            let codigoHabilitante = null;
            
            if (debeNotificarHabilitante && !esEntregaInmediataHabilitante) {
              // Solo generar código si se va a notificar
              codigoHabilitante = Math.floor(1000 + Math.random() * 9000).toString();
              console.log(`✅ Generando código para habilitante: ${codigoHabilitante}`);
            } else {
              // No generar código para habilitantes con notificación omitida
              codigoHabilitante = null;
              console.log(`⏭️ Sin código para habilitante ${habilitante.codigoBarras}: notificación omitida o entrega inmediata`);
            }
            
            habilitante.estado = 'listo_para_entrega';
            habilitante.codigoVerificacion = codigoHabilitante; // Puede ser null
            await habilitante.save({ transaction });
            
            // Registrar evento para cada documento habilitante
            try {
              const detalleEvento = codigoHabilitante 
                ? `Documento habilitante marcado como listo automáticamente junto con el principal ${documento.codigoBarras} (con código de verificación)`
                : `Documento habilitante marcado como listo automáticamente junto con el principal ${documento.codigoBarras} (sin código - notificación omitida)`;
                
              await EventoDocumento.create({
                documentoId: habilitante.id,
                tipo: 'cambio_estado',
                detalles: detalleEvento,
                usuario: req.matrizador.nombre
              }, { transaction });
            } catch (eventError) {
              console.error(`Error al registrar evento para documento habilitante ${habilitante.id}:`, eventError);
            }
            
            documentosHabilitantesActualizados++;
            console.log(`✅ Documento habilitante ${habilitante.codigoBarras} marcado como listo`);
          }
          
          console.log(`📊 Total de documentos habilitantes actualizados: ${documentosHabilitantesActualizados}`);
        } else {
          console.log(`ℹ️ El documento principal ${documento.codigoBarras} no tiene documentos habilitantes en proceso`);
        }
      } else {
        console.log(`ℹ️ El documento ${documento.codigoBarras} no es un documento principal`);
      }
      
      // Registrar el evento de cambio de estado para el documento principal
      try {
        let detallesEvento = 'Documento marcado como listo para entrega por matrizador';
        if (documentosHabilitantesActualizados > 0) {
          detallesEvento += ` (incluyendo ${documentosHabilitantesActualizados} documento(s) habilitante(s))`;
        }
        
        await EventoDocumento.create({
          documentoId: documento.id,
          tipo: 'cambio_estado',
          detalles: detallesEvento,
          usuario: req.matrizador.nombre
        }, { transaction });
      } catch (eventError) {
        console.error('Error al registrar evento de documento:', eventError);
        // Continuar con la transacción aunque el registro de eventos falle
      }
      
      await transaction.commit();
      
      // Enviar notificación después de confirmar la transacción
      try {
        // Solo enviar notificación si se generó código
        if (codigoVerificacion) {
          console.log(`🔔 Enviando notificación para documento ${documento.codigoBarras}`);
          console.log(`📋 Configuración: método=${documento.metodoNotificacion}, auto=${documento.notificarAutomatico}`);
          console.log(`📞 Teléfono: ${documento.telefonoCliente || 'no disponible'}`);
          console.log(`📧 Email: ${documento.emailCliente || 'no disponible'}`);
          
          // Construir mensajes profesionales
          const mensajes = construirMensajeDocumentoListo(documento, codigoVerificacion);
          
          // Registrar evento de notificación en el historial
          await EventoDocumento.create({
            documentoId: documento.id,
            tipo: mensajes.tipo,
            detalles: `Notificación de documento listo enviada - Código: ${codigoVerificacion}`,
            usuario: req.matrizador.nombre,
            metadatos: {
              codigoVerificacion: codigoVerificacion,
              metodoNotificacion: documento.metodoNotificacion || 'ambos',
              canal: documento.metodoNotificacion || 'ambos',
              estado: 'enviado'
            }
          });
          
          // Enviar por NotificationService (mantener compatibilidad)
          const resultadoNotificacion = await NotificationService.enviarNotificacionDocumentoListo(documento.id);
          
          // Log detallado de resultados
          console.log('✅ Notificación procesada para documento', documento.codigoBarras);
          console.log('   Método configurado:', documento.metodoNotificacion);
          console.log('   Canales enviados:', resultadoNotificacion.canalesEnviados || 'ninguno');
          console.log('   Errores:', resultadoNotificacion.errores?.length || 0);
          
          if (resultadoNotificacion.canalesEnviados && resultadoNotificacion.canalesEnviados.length > 0) {
            console.log(`📱 NOTIFICACIÓN ENVIADA: Código ${codigoVerificacion} enviado por ${resultadoNotificacion.canalesEnviados.join(' y ')} al cliente ${documento.nombreCliente}`);
          } else {
            console.log(`❌ NOTIFICACIÓN FALLÓ: No se pudo enviar por ningún canal configurado (${documento.metodoNotificacion})`);
            if (resultadoNotificacion.errores && resultadoNotificacion.errores.length > 0) {
              resultadoNotificacion.errores.forEach(error => {
                console.log(`   - Error en ${error.canal}: ${error.error}`);
              });
            }
          }
        } else {
          console.log(`⏭️ NO SE ENVIÓ NOTIFICACIÓN: ${mensajeNotificacion} para documento ${documento.codigoBarras}`);
        }
      } catch (notificationError) {
        console.error('Error al enviar notificación de documento listo:', notificationError);
        // No afectar el flujo principal si falla la notificación
      }
      
      // Mensaje de éxito personalizado según la configuración del documento
      let mensajeExito = '';
      
      if (codigoVerificacion) {
        mensajeExito = `El documento ha sido marcado como listo para entrega y se ha enviado el código de verificación al cliente.`;
      } else {
        if (documento.omitirNotificacion) {
          mensajeExito = `El documento ha sido marcado como listo para entrega. No se envió notificación según la configuración del documento.`;
        } else if (esEntregaInmediata) {
          mensajeExito = `El documento ha sido marcado como listo para entrega inmediata. No se requiere código de verificación.`;
        } else {
          mensajeExito = `El documento ha sido marcado como listo para entrega. No se pudo enviar notificación por falta de número de teléfono.`;
        }
      }
      
      if (documentosHabilitantesActualizados > 0) {
        mensajeExito += ` También se marcaron como listos ${documentosHabilitantesActualizados} documento(s) habilitante(s) relacionado(s).`;
      }
      
      req.flash('success', mensajeExito);
      res.redirect('/matrizador/documentos');
    } catch (error) {
      await transaction.rollback();
      console.error('Error al marcar documento como listo:', error);
      req.flash('error', `Error al marcar el documento como listo: ${error.message}`);
      res.redirect('/matrizador/documentos');
    }
  },

  mostrarEntrega: async (req, res) => {
    console.log("Accediendo a la entrega de documento de matrizador");
    console.log("Usuario:", req.matrizador?.nombre, "Rol:", req.matrizador?.rol);
    console.log("Ruta solicitada:", req.originalUrl);
    
    try {
      const documentoId = req.params.id;
      const codigo = req.query.codigo;
      
      // Si hay un ID, mostrar formulario de entrega para ese documento
      if (documentoId) {
        const documento = await Documento.findOne({
          where: {
            id: documentoId,
            idMatrizador: req.matrizador.id,
            estado: 'listo_para_entrega'
          }
        });
        
        if (!documento) {
          req.flash('error', 'El documento no existe, no está listo para entrega o no tienes permisos para verlo');
          return res.redirect('/matrizador/documentos/entrega');
        }
        
        // ============== NUEVA FUNCIONALIDAD: DETECTAR DOCUMENTOS GRUPALES MEJORADA ==============
        let documentosGrupales = null;
        if (documento.estado === 'listo_para_entrega' && 
            documento.fechaEntrega === null &&
            documento.identificacionCliente) {
          
          console.log(`🔍 [MATRIZADOR] Verificando documentos grupales para cliente: ${documento.identificacionCliente}`);
          documentosGrupales = await detectarDocumentosGrupalesMatrizador(
            documento.identificacionCliente, 
            documento.id,
            req.matrizador.id
          );
        }
        
        return res.render('matrizadores/documentos/entrega', {
          layout: 'matrizador',
          title: 'Entrega de Documento',
          documento,
          documentosGrupales,
          tipoEntrega: 'matrizador_limitada',
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
            codigoBarras: codigo,
            idMatrizador: req.matrizador.id,
            estado: 'listo_para_entrega'
          }
        });
        
        if (documento) {
          return res.redirect(`/matrizador/documentos/entrega/${documento.id}`);
        }
        
        req.flash('error', 'No se encontró un documento listo para entrega con ese código');
      }
      
      // Obtener documentos listos para entrega de este matrizador
      const documentosListos = await Documento.findAll({
        where: {
          idMatrizador: req.matrizador.id,
          estado: 'listo_para_entrega'
        },
        order: [['created_at', 'DESC']],
        limit: 10
      });
      
      console.log(`Documentos listos para entrega: ${documentosListos.length}`);
      
      return res.render('matrizadores/documentos/entrega', {
        layout: 'matrizador',
        title: 'Entrega de Documentos',
        documentosListos,
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre
      });
    } catch (error) {
      console.error('Error al mostrar la página de entrega:', error);
      res.status(500).render('error', {
        layout: 'matrizador',
        title: 'Error',
        message: 'Ha ocurrido un error al cargar la página de entrega de documentos',
        error
      });
    }
  },
  
  completarEntrega: async (req, res) => {
    console.log("Completando entrega de documento como matrizador");
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
        tipoEntregaGrupal
      } = req.body;
      
      if (!id) {
        await transaction.rollback();
        req.flash('error', 'ID de documento no proporcionado');
        return res.redirect('/matrizador/documentos/entrega');
      }
      
      // Buscar el documento y verificar que pertenezca al matrizador actual
      const documento = await Documento.findOne({
        where: {
          id,
          idMatrizador: req.matrizador.id,
          estado: 'listo_para_entrega'
        },
        transaction
      });
      
      if (!documento) {
        await transaction.rollback();
        req.flash('error', 'El documento no existe, no está listo para entrega o no tienes permisos para modificarlo');
        return res.redirect('/matrizador/documentos/entrega');
      }
      
      // ============== VERIFICACIÓN DE CÓDIGO MEJORADA PARA ENTREGA GRUPAL ==============
      if (tipoVerificacion !== 'llamada') {
        let codigoValido = false;
        
        // Verificar código del documento principal
        if (documento.codigoVerificacion === codigoVerificacion) {
          codigoValido = true;
          console.log(`✅ [MATRIZADOR] Código válido: documento principal ${documento.codigoBarras}`);
        }
        
        // Si hay entrega grupal, verificar códigos de documentos adicionales también
        if (!codigoValido && entregaGrupal === 'true' && documentosAdicionales) {
          const documentosIds = documentosAdicionales.split(',')
            .map(id => parseInt(id.trim()))
            .filter(id => !isNaN(id) && id > 0);
          
          if (documentosIds.length > 0) {
            const documentosAdicionalesToValidar = await Documento.findAll({
              where: {
                id: { [Op.in]: documentosIds },
                idMatrizador: req.matrizador.id, // Solo documentos del matrizador
                estado: 'listo_para_entrega'
              },
              transaction
            });
            
            // Verificar si el código coincide con algún documento adicional
            for (const docAdicional of documentosAdicionalesToValidar) {
              if (docAdicional.codigoVerificacion === codigoVerificacion) {
                codigoValido = true;
                console.log(`✅ [MATRIZADOR] Código válido: documento adicional ${docAdicional.codigoBarras}`);
                break;
              }
            }
          }
        }
        
        // Si ningún código coincide, error
        if (!codigoValido) {
          await transaction.rollback();
          
          // Regenerar detección de documentos grupales para mostrar interfaz completa
          let documentosGrupales = null;
          if (documento.estado === 'listo_para_entrega' && 
              documento.fechaEntrega === null &&
              documento.identificacionCliente) {
            documentosGrupales = await detectarDocumentosGrupalesMatrizador(
              documento.identificacionCliente, 
              documento.id,
              req.matrizador.id
            );
          }
          
          return res.render('matrizadores/documentos/entrega', {
            layout: 'matrizador',
            title: 'Entrega de Documento',
            documento,
            documentosGrupales,
            error: 'El código de verificación es incorrecto. Use el código del documento principal o de cualquier documento adicional que vaya a entregar.',
            userRole: req.matrizador?.rol,
            userName: req.matrizador?.nombre,
            usuario: {
              id: req.matrizador?.id,
              rol: req.matrizador?.rol,
              nombre: req.matrizador?.nombre
            }
          });
        }
      }
      
      // Actualizar el documento
      documento.estado = 'entregado';
      documento.fechaEntrega = new Date();
      documento.nombreReceptor = nombreReceptor;
      documento.identificacionReceptor = identificacionReceptor;
      documento.relacionReceptor = relacionReceptor;
      
      await documento.save({ transaction });
      
      // Registrar el evento de entrega
      try {
        const detalles = tipoVerificacion === 'llamada'
          ? `Entregado a ${nombreReceptor} con verificación por llamada: ${observaciones}`
          : `Entregado a ${nombreReceptor} con código de verificación`;
          
        await EventoDocumento.create({
          documentoId: documento.id,
          tipo: 'entrega',
          descripcion: detalles,
          usuario: req.matrizador.nombre
        }, { transaction });
      } catch (eventError) {
        console.error('Error al registrar evento de entrega:', eventError);
        // Continuar con la transacción aunque el registro de eventos falle
      }
      
      // ============== NUEVA FUNCIONALIDAD: PROCESAMIENTO DE ENTREGA GRUPAL ==============
      let documentosGrupalesActualizados = 0;
      
      if (entregaGrupal === 'true' && documentosAdicionales && tipoEntregaGrupal === 'matrizador_limitada') {
        console.log(`👤 [MATRIZADOR] Iniciando entrega grupal para ${documentosAdicionales}`);
        
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
              identificacionCliente: documento.identificacionCliente
            };
            
            const resultadoGrupal = await procesarEntregaGrupalMatrizador(
              documentosIds, 
              datosEntrega, 
              req.matrizador, 
              transaction
            );
            
            documentosGrupalesActualizados = resultadoGrupal.documentosActualizados;
            console.log(`✅ [MATRIZADOR] Entrega grupal completada: ${documentosGrupalesActualizados} documentos adicionales`);
          }
        } catch (grupalError) {
          console.error('❌ Error en entrega grupal:', grupalError);
          await transaction.rollback();
          req.flash('error', `Error en entrega grupal: ${grupalError.message}`);
          return res.redirect(`/matrizador/documentos/entrega/${id}`);
        }
      }
      
      await transaction.commit();
      
      // ============== NUEVA LÓGICA: NOTIFICACIÓN GRUPAL O INDIVIDUAL ==============
      try {
        if (entregaGrupal === 'true' && documentosGrupalesActualizados > 0) {
          // ENTREGA GRUPAL: Enviar UNA SOLA notificación para todos los documentos
          console.log(`📧 [ENTREGA GRUPAL MATRIZADOR] Preparando notificación única para ${documentosGrupalesActualizados + 1} documentos`);
          
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
                fechaEntrega: { [Op.not]: null },
                idMatrizador: req.matrizador.id // Solo documentos del matrizador
              }
            });
            
            todosLosDocumentosEntregados.push(...documentosAdicionalesEntregados);
          }
          
          // Enviar notificación grupal única
          await enviarNotificacionEntregaGrupalMatrizador(todosLosDocumentosEntregados, {
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
      let mensajeExito = `Documento entregado exitosamente a ${nombreReceptor}`;
      
      if (documentosGrupalesActualizados > 0) {
        mensajeExito += `. También se procesaron ${documentosGrupalesActualizados} documento(s) más de su asignación en entrega grupal.`;
      }
      
      req.flash('success', mensajeExito);
      res.redirect('/matrizador/documentos');
    } catch (error) {
      await transaction.rollback();
      console.error('Error al completar entrega:', error);
      req.flash('error', `Error al completar la entrega: ${error.message}`);
      res.redirect('/matrizador/documentos/entrega');
    }
  },

  // ============== NUEVOS MÉTODOS: ENTREGA GRUPAL API ==============

  /**
   * API para detectar documentos grupales del mismo cliente (MATRIZADORES - CON RESTRICCIONES)
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
      
      const documentosGrupales = await detectarDocumentosGrupalesMatrizador(
        identificacion, 
        parseInt(documentoId),
        req.matrizador.id
      );
      
      return res.status(200).json({
        exito: true,
        datos: documentosGrupales,
        mensaje: `Detectados ${documentosGrupales.documentosPropiios.cantidad} documentos propios y ${documentosGrupales.documentosOtros.cantidad} de otros matrizadores`
      });
      
    } catch (error) {
      console.error('Error en API detectar documentos grupales matrizador:', error);
      return res.status(500).json({
        exito: false,
        mensaje: 'Error al detectar documentos grupales',
        error: error.message
      });
    }
  },

  /**
   * Procesa entrega grupal específica (MATRIZADORES - SOLO DOCUMENTOS PROPIOS)
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
      
      // Obtener documento principal y verificar pertenencia
      const documentoPrincipal = await Documento.findOne({
        where: {
          id: id,
          idMatrizador: req.matrizador.id
        },
        transaction
      });
      
      if (!documentoPrincipal) {
        await transaction.rollback();
        return res.status(404).json({
          exito: false,
          mensaje: 'Documento principal no encontrado o no pertenece al matrizador'
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
      
      // Procesar entrega grupal (solo documentos del matrizador)
      const resultado = await procesarEntregaGrupalMatrizador(
        documentosIds, 
        datosEntrega, 
        req.matrizador, 
        transaction
      );
      
      await transaction.commit();
      
      return res.status(200).json({
        exito: true,
        mensaje: `Entrega grupal procesada exitosamente: ${resultado.documentosActualizados} documentos propios`,
        datos: {
          documentosActualizados: resultado.documentosActualizados,
          tipoEntrega: 'matrizador_limitada',
          soloDocumentosPropiios: true
        }
      });
      
    } catch (error) {
      await transaction.rollback();
      console.error('Error en procesamiento entrega grupal matrizador:', error);
      return res.status(500).json({
        exito: false,
        mensaje: 'Error al procesar entrega grupal',
        error: error.message
      });
    }
  },
};

// Funciones auxiliares para el historial de eventos
function determinarCategoriaEvento(tipoEvento) {
  const categorias = {
    'pago': 'pago',
    'confirmacion_pago': 'pago',
    'entrega': 'entrega',
    'documento_entregado': 'entrega',
    'cambio_estado': 'estado',
    'documento_listo': 'estado',
    'asignacion': 'asignacion',
    'notificacion_enviada': 'notificacion',
    'registro': 'creacion',
    'vista': 'vista'
  };
  return categorias[tipoEvento] || 'general';
}

function obtenerIconoEvento(tipoEvento) {
  const iconos = {
    'pago': 'fas fa-dollar-sign',
    'confirmacion_pago': 'fas fa-check-circle',
    'entrega': 'fas fa-handshake',
    'documento_entregado': 'fas fa-hand-holding',
    'cambio_estado': 'fas fa-edit',
    'documento_listo': 'fas fa-check',
    'asignacion': 'fas fa-user-tag',
    'notificacion_enviada': 'fas fa-bell',
    'registro': 'fas fa-file-plus',
    'vista': 'fas fa-eye'
  };
  return iconos[tipoEvento] || 'fas fa-info-circle';
}

function obtenerColorEvento(tipoEvento) {
  const colores = {
    'pago': 'success',
    'confirmacion_pago': 'success',
    'entrega': 'info',
    'documento_entregado': 'info',
    'cambio_estado': 'warning',
    'documento_listo': 'success',
    'asignacion': 'primary',
    'notificacion_enviada': 'info',
    'registro': 'primary',
    'vista': 'secondary'
  };
  return colores[tipoEvento] || 'secondary';
}

function traducirTipoEvento(tipoEvento) {
  const traducciones = {
    'pago': 'Pago Registrado',
    'confirmacion_pago': 'Pago Confirmado',
    'entrega': 'Documento Entregado',
    'documento_entregado': 'Documento Entregado',
    'cambio_estado': 'Cambio de Estado',
    'documento_listo': 'Documento Listo',
    'asignacion': 'Asignación',
    'notificacion_enviada': 'Notificación Enviada',
    'registro': 'Registro',
    'vista': 'Vista'
  };
  return traducciones[tipoEvento] || 'General';
}

module.exports = matrizadorController;