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
      order: [['created_at', 'DESC']]
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
      if (typeof eventoDB.detalles === 'string' && eventoDB.detalles.trim()) {
        detalles = JSON.parse(eventoDB.detalles);
      } else if (typeof eventoDB.detalles === 'object' && eventoDB.detalles) {
        detalles = eventoDB.detalles;
      }
    } catch (e) {
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
  const mapeoTipos = {
    'pago': 'pago_registrado',
    'entrega': 'documento_entregado',
    'asignacion': 'matrizador_asignado',
    'notificacion_enviada': 'notificacion_enviada',
    'documento_listo': 'marcado_listo',
    'creacion': 'documento_creado',
    'registro': 'documento_creado'
  };
  
  return mapeoTipos[eventoDB.tipo] || eventoDB.tipo;
}

function construirDescripcionEspecifica(tipoEvento, eventoDB, documento, detalles) {
  switch (tipoEvento) {
    case 'pago_registrado':
      const monto = detalles.monto || documento.valorPagado || documento.valorFactura;
      const metodo = detalles.metodoPago || documento.metodoPago || 'método no especificado';
      return `Pago de $${monto} procesado mediante ${metodo}`;
    
    case 'documento_entregado':
      const receptor = detalles.receptor || documento.nombreReceptor || 'receptor no especificado';
      return `Documento entregado a ${receptor}`;
    
    case 'matrizador_asignado':
      const matrizador = detalles.matrizadorNuevo || eventoDB.matrizador?.nombre || 'matrizador';
      return `Documento asignado a ${matrizador} para procesamiento`;
    
    case 'notificacion_enviada':
      const canal = detalles.canal || 'canal no especificado';
      return `Notificación enviada vía ${canal}`;
    
    case 'marcado_listo':
      return `Documento marcado como listo para entrega por el matrizador`;
    
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
  const tiposVagos = ['otro', 'actualizacion', 'evento', 'tipoEvento', 'vista'];
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

module.exports = {
  obtenerHistorialUniversal,
  TIPOS_EVENTO_UNIVERSAL
};

