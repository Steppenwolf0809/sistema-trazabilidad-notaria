/**
 * SERVICIO UNIVERSAL DE HISTORIAL DE DOCUMENTOS
 * ✅ Obtención unificada de eventos para todos los roles
 * ✅ Formateo consistente de eventos específicos
 * ✅ Eliminación de eventos vagos como "actualización" y "otro"
 */

const { sequelize, Op } = require('sequelize');
const EventoDocumento = require('../models/EventoDocumento');
const RegistroAuditoria = require('../models/RegistroAuditoria');
const Matrizador = require('../models/Matrizador');
const Documento = require('../models/Documento');
const moment = require('moment');


/**
 * TIPOS DE EVENTOS ESPECÍFICOS CON ICONOS Y COLORES
 */
  const TIPOS_EVENTO_UNIVERSAL = {
       'documento_creado': {
     icono: '<i class="fas fa-file-plus"></i>',
     titulo: 'Documento creado',
     color: 'primary',
     categoria: 'creacion',
     categoriaTexto: 'Creación',
     mostrarEn: ['admin', 'caja', 'archivo', 'matrizador', 'recepcion'],
     prioridad: 'alta'
   },
  'pago_registrado': {
    icono: '<i class="fas fa-credit-card"></i>',
    titulo: 'Pago registrado',
    color: 'success',
    categoria: 'financiero',
    categoriaTexto: 'Financiero',
    mostrarEn: ['admin', 'caja', 'archivo'],
    prioridad: 'alta'
  },
  'pago_revertido': {
    icono: '<i class="fas fa-undo"></i>',
    titulo: 'Pago revertido',
    color: 'warning',
    categoria: 'financiero',
    categoriaTexto: 'Financiero',
    mostrarEn: ['admin', 'caja', 'archivo'],
    prioridad: 'alta'
  },
  'documento_entregado': {
    icono: '<i class="fas fa-handshake"></i>',
    titulo: 'Documento entregado',
    color: 'success',
    categoria: 'entrega',
    categoriaTexto: 'Entrega',
         mostrarEn: ['admin', 'caja', 'archivo', 'matrizador', 'recepcion'],
    prioridad: 'alta'
  },
  'matrizador_asignado': {
    icono: '<i class="fas fa-user-plus"></i>',
    titulo: 'Asignado a matrizador',
    color: 'primary',
    categoria: 'asignacion',
    categoriaTexto: 'Asignación',
    mostrarEn: ['admin', 'caja', 'archivo', 'matrizador'],
    prioridad: 'media'
  },
     'notificacion_enviada': {
     icono: '<i class="fas fa-paper-plane"></i>',
     titulo: 'Notificación enviada',
     color: 'info',
     categoria: 'comunicacion',
     categoriaTexto: 'Comunicación',
     mostrarEn: ['admin', 'caja', 'archivo', 'matrizador', 'recepcion'],
     prioridad: 'media'
   },
   'marcado_listo': {
     icono: '<i class="fas fa-check"></i>',
     titulo: 'Documento listo para entrega',
     color: 'success',
     categoria: 'estado',
     categoriaTexto: 'Estado',
     mostrarEn: ['admin', 'caja', 'archivo', 'matrizador', 'recepcion'],
     prioridad: 'alta'
   },
   'autorizacion_credito': {
     icono: '<i class="fas fa-shield-check"></i>',
     titulo: 'Autorización de crédito',
     color: 'warning',
     categoria: 'financiero',
     categoriaTexto: 'Financiero',
     mostrarEn: ['admin', 'caja', 'archivo', 'matrizador', 'recepcion'],
     prioridad: 'alta'
   },
   'autorizacion_urgente_solicitada': {
     icono: '<i class="fas fa-exclamation-triangle"></i>',
     titulo: 'Autorización urgente solicitada',
     color: 'warning',
     categoria: 'autorizacion',
     categoriaTexto: 'Autorización',
     mostrarEn: ['admin', 'caja', 'archivo', 'matrizador', 'recepcion'],
     prioridad: 'alta'
   },
   'autorizacion_urgente_digital': {
     icono: '<i class="fas fa-computer"></i>',
     titulo: 'Autorización urgente concedida (digital)',
     color: 'success',
     categoria: 'autorizacion',
     categoriaTexto: 'Autorización',
     mostrarEn: ['admin', 'caja', 'archivo', 'matrizador', 'recepcion'],
     prioridad: 'alta'
   },
   'autorizacion_urgente_rechazada': {
     icono: '<i class="fas fa-times-circle"></i>',
     titulo: 'Autorización urgente rechazada',
     color: 'danger',
     categoria: 'autorizacion',
     categoriaTexto: 'Autorización',
     mostrarEn: ['admin', 'caja', 'archivo', 'matrizador', 'recepcion'],
     prioridad: 'alta'
   },
   'autorizacion_verbal_registrada': {
     icono: '<i class="fas fa-phone"></i>',
     titulo: 'Autorización verbal registrada',
     color: 'info',
     categoria: 'autorizacion',
     categoriaTexto: 'Autorización',
     mostrarEn: ['admin', 'caja', 'archivo', 'matrizador', 'recepcion'],
     prioridad: 'alta'
   },
   'autorizacion_verbal_ratificada': {
     icono: '<i class="fas fa-phone-check"></i>',
     titulo: 'Autorización verbal ratificada',
     color: 'success',
     categoria: 'autorizacion',
     categoriaTexto: 'Autorización',
     mostrarEn: ['admin', 'caja', 'archivo', 'matrizador', 'recepcion'],
     prioridad: 'alta'
   },
   'autorizacion_verbal_rechazada': {
     icono: '<i class="fas fa-phone-times"></i>',
     titulo: 'Autorización verbal rechazada',
     color: 'danger',
     categoria: 'autorizacion',
     categoriaTexto: 'Autorización',
     mostrarEn: ['admin', 'caja', 'archivo', 'matrizador', 'recepcion'],
     prioridad: 'alta'
   },
   'documento_eliminado': {
     icono: '<i class="fas fa-trash"></i>',
     titulo: 'Documento eliminado',
     color: 'danger',
     categoria: 'eliminacion',
     categoriaTexto: 'Eliminación',
     mostrarEn: ['admin', 'caja', 'archivo'],
     prioridad: 'muy_alta'
   },
   'reversion_admin': {
     icono: '<i class="fas fa-shield-alt"></i>',
     titulo: 'Reversión administrativa',
     color: 'warning',
     categoria: 'administracion',
     categoriaTexto: 'Administración',
     mostrarEn: ['admin', 'caja', 'archivo', 'matrizador', 'recepcion'],
     prioridad: 'alta'
   }
};


/**
 * FUNCIÓN PRINCIPAL: Obtener historial universal de un documento
 */
async function obtenerHistorialUniversal(documentoId, userRole, options = {}) {
  try {
    console.log(`��� [HISTORIAL-UNIVERSAL] Obteniendo historial para documento ${documentoId}, rol: ${userRole}`);
    
    // 1. Obtener documento base
    const documento = await Documento.findByPk(documentoId);
    
    if (!documento) {
      throw new Error('Documento no encontrado');
    }
    
    // 2. Obtener eventos de la base de datos
    const eventosDB = await EventoDocumento.findAll({
      where: { documentoId: documentoId },
      order: [['created_at', 'DESC']],
      raw: true  // Obtener datos raw para evitar problemas de Sequelize con JSON
    });
    
    // 3. Formatear eventos
    let historialCompleto = [];
    
         // Agregar evento de creación si no existe
     const tieneEventoCreacion = eventosDB.some(e => 
       e.tipo === 'creacion' || e.tipo === 'documento_creado' || e.tipo === 'registro'
     );
    
    if (!tieneEventoCreacion && documento.created_at) {
      historialCompleto.push(crearEventoCreacion(documento));
    }
    
    // Procesar eventos existentes
    for (const eventoDB of eventosDB) {
      const eventoFormateado = formatearEventoEspecifico(eventoDB, documento);
      if (eventoFormateado && !esEventoVago(eventoFormateado.tipo)) {
        historialCompleto.push(eventoFormateado);
      }
    }
    
    // 4. Filtrar por rol y ordenar
    const eventosFiltrados = filtrarEventosPorRol(historialCompleto, userRole);
    const eventosOrdenados = ordenarEventos(eventosFiltrados);
    
    console.log(`✅ [HISTORIAL-UNIVERSAL] ${eventosOrdenados.length} eventos procesados para rol ${userRole}`);
    
    return eventosOrdenados;
    
  } catch (error) {
    console.error('❌ [HISTORIAL-UNIVERSAL] Error obteniendo historial:', error);
    return [];
  }
}


/**
 * FUNCIONES AUXILIARES
 */

function crearEventoCreacion(documento) {
  const esImportadoXML = documento.observaciones?.includes('XML') || 
                        documento.codigoBarras?.includes('TEMP-');
  
  return {
    tipo: 'documento_creado',
    tipoEvento: 'documento_creado',
    titulo: 'Documento creado',
    descripcion: esImportadoXML ? 
      'Documento importado desde XML del sistema notarial' :
      `Documento ${documento.tipoDocumento} registrado en el sistema`,
    icono: '<i class="fas fa-file-plus"></i>',
    color: 'primary',
    categoria: 'creacion',
    categoriaTexto: 'Creación',
    usuario: 'Sistema',
    rolUsuario: 'sistema',
    fecha: documento.created_at,
    timestamp: documento.created_at,
    prioridad: 'alta',
    detalles: {
      tipoDocumento: documento.tipoDocumento,
      codigoBarras: documento.codigoBarras,
      valorFactura: documento.valorFactura,
      origen: esImportadoXML ? 'Importación XML' : 'Registro manual'
    }
  };
}

function formatearEventoEspecifico(eventoDB, documento) {
  try {
    const tipoEspecifico = determinarTipoEspecifico(eventoDB, documento);
    const configuracion = TIPOS_EVENTO_UNIVERSAL[tipoEspecifico];
    
    if (!configuracion) {
      return null;
    }
    
    let detalles = {};
    try {
      if (typeof eventoDB.detalles === 'string') {
        // Verificar si es un string vacío o solo comillas
        if (eventoDB.detalles === '""' || eventoDB.detalles === "''" || eventoDB.detalles.trim() === '') {
          detalles = {};
        } else {
          // Simple parseado directo
          detalles = JSON.parse(eventoDB.detalles);
        }
      } else if (typeof eventoDB.detalles === 'object' && eventoDB.detalles !== null) {
        detalles = eventoDB.detalles;
      }
    } catch (e) {
      console.warn(`⚠️ Error parseando detalles del evento ${eventoDB.id}: ${e.message}`);
      detalles = {};
    }
    
    const descripcion = construirDescripcionEspecifica(tipoEspecifico, eventoDB, documento, detalles);
    const usuarioInfo = obtenerInformacionUsuario(eventoDB);
    
    return {
      tipo: eventoDB.tipo,
      tipoEvento: tipoEspecifico,
      titulo: configuracion.titulo,
      descripcion: descripcion,
      icono: configuracion.icono,
      color: configuracion.color,
      categoria: configuracion.categoria,
      categoriaTexto: configuracion.categoriaTexto,
      usuario: usuarioInfo.nombre,
      rolUsuario: usuarioInfo.rol,
      fecha: eventoDB.created_at,
      timestamp: eventoDB.created_at,
      prioridad: configuracion.prioridad,
      detalles: detalles,
      eventoId: eventoDB.id
    };
    
  } catch (error) {
    console.error(`❌ Error formateando evento ${eventoDB.id}:`, error);
    return null;
  }
}


function determinarTipoEspecifico(eventoDB, documento) {
  // Verificar si es una autorización de crédito específica
  if (eventoDB.tipo === 'modificacion' && 
      eventoDB.metadatos?.accion_especial === 'autorizacion_credito') {
    return 'autorizacion_credito';
  }
  
  // Verificar eventos de autorización urgente
  if (eventoDB.tipo === 'autorizacion_urgente_solicitada') {
    return 'autorizacion_urgente_solicitada';
  }
  
  if (eventoDB.tipo === 'autorizacion_urgente_autorizada') {
    return 'autorizacion_urgente_digital';
  }
  
  if (eventoDB.tipo === 'autorizacion_urgente_rechazada') {
    return 'autorizacion_urgente_rechazada';
  }
  
  if (eventoDB.tipo === 'autorizacion_verbal_registrada') {
    return 'autorizacion_verbal_registrada';
  }
  
  if (eventoDB.tipo === 'autorizacion_verbal_ratificada') {
    return 'autorizacion_verbal_ratificada';
  }
  
  if (eventoDB.tipo === 'autorizacion_verbal_rechazada') {
    return 'autorizacion_verbal_rechazada';
  }
  
  const mapeoTipos = {
    'pago': 'pago_registrado',
    'reversion_pago': 'pago_revertido',
    'reversion_admin': 'reversion_admin',
    'entrega': 'documento_entregado',
    'asignacion': 'matrizador_asignado',
    'notificacion_enviada': 'notificacion_enviada',
    'documento_listo': 'marcado_listo',
    'creacion': 'documento_creado',
    'registro': 'documento_creado',
    'eliminacion': 'documento_eliminado'
  };
  
  return mapeoTipos[eventoDB.tipo] || eventoDB.tipo;
}

function construirDescripcionEspecifica(tipoEvento, eventoDB, documento, detalles) {
  switch (tipoEvento) {
    case 'pago_registrado':
      const monto = detalles.monto || documento.valorPagado || documento.valorFactura;
      const metodo = detalles.metodoPago || documento.metodoPago || 'método no especificado';
      return `Pago de $${monto} procesado mediante ${metodo}`;
    
    case 'pago_revertido':
      const datosOriginales = detalles.datosOriginales || {};
      const valorRevertido = datosOriginales.valorPagado || detalles.valorRevertido || 'valor no especificado';
      const metodoRevertido = datosOriginales.metodoPago || detalles.metodoPago || 'método no especificado';
      const justificacionReversion = detalles.justificacion || 'No especificada';
      return `Pago de $${valorRevertido} (${metodoRevertido}) revertido. Motivo: ${justificacionReversion}`;
    
    case 'documento_entregado':
      // WORKAROUND: Parsear detalles directamente si no están parseados
      let detallesReales = detalles;
      if (typeof detalles === 'string' && eventoDB.detalles) {
        try {
          detallesReales = JSON.parse(eventoDB.detalles);
        } catch (e) {
          detallesReales = {};
        }
      }
      
      // Priorizar detalles del evento sobre datos del documento
      const receptor = detallesReales.receptor || eventoDB.descripcion?.match(/Entregado a ([^(]+)/)?.[1]?.trim() || documento.nombreReceptor || 'receptor no especificado';
      const identificacionReceptor = detallesReales.identificacion_receptor;
      const relacionReceptor = detallesReales.relacion_receptor;
      
      let descripcionEntrega = `Documento entregado a ${receptor}`;
      
      if (identificacionReceptor) {
        descripcionEntrega += ` (ID: ${identificacionReceptor})`;
      }
      
      if (relacionReceptor && relacionReceptor !== 'titular') {
        descripcionEntrega += ` como ${relacionReceptor}`;
      }
      
      return descripcionEntrega;
    
    case 'matrizador_asignado':
      const matrizador = detalles.matrizadorNuevo || eventoDB.matrizador?.nombre || 'matrizador';
      return `Documento asignado a ${matrizador} para procesamiento`;
    
    case 'notificacion_enviada':
      const canal = detalles.canal || 'canal no especificado';
      return `Notificación enviada vía ${canal}`;
    
    case 'marcado_listo':
      return `Documento marcado como listo para entrega por el matrizador`;
    
    case 'autorizacion_credito':
      const justificacion = detalles.justificacion_entrega_sin_pago || 
                           eventoDB.metadatos?.justificacion_entrega_sin_pago ||
                           'No especificada';
      const justificacionTexto = {
        'historial_pagos': 'Cliente con excelente historial de pagos',
        'cliente_corporativo': 'Cliente corporativo de confianza',
        'emergencia': 'Situación de emergencia autorizada',
        'director_notaria': 'Autorización directa del director'
      }[justificacion] || justificacion;
      
      return `Autorización de crédito: ${justificacionTexto}. Cliente puede retirar sin verificar pago`;
    
    case 'autorizacion_urgente_solicitada':
      const solicitadoPor = detalles.solicitado_por_nombre || eventoDB.usuario || 'Usuario';
      const justificacionSolicitud = detalles.justificacion || detalles.justificacion_solicitud || 'No especificada';
      return `${solicitadoPor} solicitó autorización urgente. Motivo: ${justificacionSolicitud}`;
    
    case 'autorizacion_urgente_digital':
      const autorizadoPor = detalles.autorizado_por_nombre || eventoDB.usuario || 'Matrizador';
      const justificacionAutorizacion = detalles.justificacion_autorizacion || 'Autorización concedida';
      const tiempoRespuesta = detalles.minutos_respuesta ? ` (Respuesta en ${detalles.minutos_respuesta} minutos)` : '';
      return `${autorizadoPor} autorizó digitalmente la entrega urgente. ${justificacionAutorizacion}${tiempoRespuesta}`;
    
    case 'autorizacion_urgente_rechazada':
      const rechazadoPor = detalles.rechazado_por_nombre || eventoDB.usuario || 'Matrizador';
      const motivoRechazo = detalles.motivo_rechazo || 'No especificado';
      return `${rechazadoPor} rechazó la autorización urgente. Motivo: ${motivoRechazo}`;
    
    case 'autorizacion_verbal_registrada':
      const quienAutorizo = detalles.verbal_quien_autorizo || 'Persona autorizada';
      const fechaVerbal = detalles.verbal_fecha ? new Date(detalles.verbal_fecha).toLocaleString('es-EC') : 'fecha no especificada';
      return `Autorización verbal registrada por ${quienAutorizo} el ${fechaVerbal}. Requiere ratificación en 24 horas`;
    
    case 'autorizacion_verbal_ratificada':
      const ratificadoPor = detalles.autorizado_por_nombre || eventoDB.usuario || 'Matrizador';
      return `${ratificadoPor} ratificó digitalmente la autorización verbal. Proceso completado correctamente`;
    
    case 'autorizacion_verbal_rechazada':
      const rechazadoVerbalPor = detalles.rechazado_por_nombre || eventoDB.usuario || 'Matrizador';
      const motivoRechazoVerbal = detalles.motivo_rechazo || 'Ratificación denegada';
      return `${rechazadoVerbalPor} rechazó la ratificación de la autorización verbal. ${motivoRechazoVerbal}`;
    
    case 'documento_eliminado':
      const eliminadoPor = eventoDB.usuario || 'Usuario';
      
      // Mapear motivos técnicos a texto legible
      const motivosMap = {
        'error_xml': 'Error en XML',
        'error_ingreso': 'Error de ingreso',
        'nota_credito': 'Requiere nota de crédito',
        'cliente_cancelo_tramite': 'Cliente canceló el trámite',
        'documento_duplicado': 'Documento duplicado',
        'error_sistema': 'Error del sistema',
        'orden_superior': 'Orden superior',
        'otro': 'Otro motivo'
      };
      
      const motivoEliminacion = motivosMap[detalles.motivoDetallado] || detalles.motivoDetallado || 'Motivo no especificado';
      const justificacionEliminacion = detalles.justificacion || '';
      
      let descripcionEliminacion = `Documento eliminado por ${eliminadoPor}. Motivo: ${motivoEliminacion}`;
      
      if (justificacionEliminacion && justificacionEliminacion.length > 0) {
        const justificacionCorta = justificacionEliminacion.length > 50 ? 
          justificacionEliminacion.substring(0, 50) + '...' : 
          justificacionEliminacion;
        descripcionEliminacion += ` - ${justificacionCorta}`;
      }
      
      // Agregar información sobre pago si había
      if (detalles.documentoSnapshot && detalles.documentoSnapshot.valorPagado > 0) {
        descripcionEliminacion += ` (Tenía pago de $${detalles.documentoSnapshot.valorPagado})`;
      }
      
      return descripcionEliminacion;
    
    case 'reversion_admin':
      const tipoReversionAdmin = detalles.tipoReversion || 'reversión no especificada';
      const motivoCategoriaAdmin = detalles.motivoCategoria || 'motivo no especificado';
      const estadoAnteriorAdmin = detalles.estadoAnterior || '';
      const estadoNuevoAdmin = detalles.estadoNuevo || '';
      
      // Mapear tipos técnicos a texto legible
      const tiposReversionMap = {
        'desmarcar_listo': 'Desmarcar como listo',
        'deshacer_entrega': 'Deshacer entrega',
        'separar_grupo': 'Separar de grupo',
        'reactivar_documento': 'Reactivar documento'
      };
      
      const tipoTexto = tiposReversionMap[tipoReversionAdmin] || tipoReversionAdmin;
      let descripcionAdmin = `${tipoTexto} ejecutada por administrador. Motivo: ${motivoCategoriaAdmin}`;
      
      if (estadoAnteriorAdmin && estadoNuevoAdmin && estadoAnteriorAdmin !== estadoNuevoAdmin) {
        descripcionAdmin += ` (${estadoAnteriorAdmin} → ${estadoNuevoAdmin})`;
      }
      
      return descripcionAdmin;
    
    default:
      return eventoDB.descripcion || eventoDB.titulo || 'Evento del sistema';
  }
}

function obtenerInformacionUsuario(eventoDB) {
  if (eventoDB.matrizador) {
    return {
      nombre: eventoDB.matrizador.nombre,
      rol: eventoDB.matrizador.rol
    };
  }
  
  if (eventoDB.usuario && eventoDB.usuario !== 'Sistema') {
    return {
      nombre: eventoDB.usuario,
      rol: 'usuario'
    };
  }
  
  return {
    nombre: 'Sistema',
    rol: 'sistema'
  };
}

function esEventoVago(tipo) {
  const tiposVagos = [
    'otro', 
    'actualizacion', 
    'evento', 
    'tipoEvento', 
    'vista',
    'edicion',           // Eventos genéricos de edición
    'actualizacion_general',
    'cambio_estado',     // Estados genéricos sin especificar
    'evento_generico'
  ];
  
  return tiposVagos.includes(tipo);
}

function filtrarEventosPorRol(eventos, userRole) {
  return eventos.filter(evento => {
    const configuracion = TIPOS_EVENTO_UNIVERSAL[evento.tipoEvento];
    if (!configuracion) return true;
    
    return configuracion.mostrarEn.includes(userRole);
  });
}

function ordenarEventos(eventos) {
  return eventos.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

/**
 * FUNCIÓN HELPER: Registrar evento de autorización urgente en el historial
 */
async function registrarEventoAutorizacion(documentoId, tipo, detalles, usuario = null) {
  try {
    console.log(`📝 [HISTORIAL] Registrando evento ${tipo} para documento ${documentoId}`);
    
    const EventoDocumento = require('../models/EventoDocumento');
    
    const eventoData = {
      documentoId: documentoId,
      tipo: tipo,
      titulo: TIPOS_EVENTO_UNIVERSAL[tipo]?.titulo || tipo,
      descripcion: `Evento de ${tipo}`,
      usuario: usuario?.nombre || usuario || 'Sistema',
      detalles: detalles,
      metadatos: {
        categoria: 'autorizacion',
        timestamp: new Date().toISOString(),
        usuario_id: usuario?.id || null,
        usuario_rol: usuario?.rol || null
      }
    };
    
    const evento = await EventoDocumento.create(eventoData);
    console.log(`✅ [HISTORIAL] Evento ${tipo} registrado con ID ${evento.id}`);
    
    return evento;
    
  } catch (error) {
    console.error(`❌ [HISTORIAL] Error registrando evento ${tipo}:`, error);
    throw error;
  }
}

module.exports = {
  obtenerHistorialUniversal,
  TIPOS_EVENTO_UNIVERSAL,
  registrarEventoAutorizacion
};

