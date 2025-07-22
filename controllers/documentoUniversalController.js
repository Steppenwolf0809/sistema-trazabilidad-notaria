/**
 * CONTROLADOR UNIVERSAL DE DOCUMENTOS
 * Sistema modular de permisos y configuración por rol
 * Basado en la vista exitosa de matrizador, extendida para todos los roles
 */

const Documento = require('../models/Documento');
const Matrizador = require('../models/Matrizador');
const EventoDocumento = require('../models/EventoDocumento');
const NotificacionGrupal = require('../models/NotificacionGrupal');
const { obtenerHistorialUniversal } = require('../utils/historialUniversal');
const { Op } = require('sequelize');

// ============== CONFIGURACIÓN DE ROLES Y PERMISOS ==============

/**
 * Configuración de permisos y funcionalidades por rol
 */
const configRoles = {
  admin: {
    // Secciones visibles
    mostrarHeader: true,
    mostrarAlertas: true,
    mostrarInfoGeneral: true,
    mostrarCliente: true,
    mostrarFinanciero: true,
    mostrarNotificaciones: false,          // ❌ Admin NO debe ver configuración de notificaciones
    mostrarNotas: true,
    mostrarNotificacionesGrupales: false,  // ❌ Admin no gestiona grupos
    mostrarAcciones: true,
    mostrarHistorial: true,
    mostrarModalMarcarListo: true,
    
    // Layout específico admin
    layoutFinanciero: "dos_columnas",       // ✅ Layout 2 columnas
    ordenSecciones: ["general", "cliente", "financiero", "notas", "administracion", "historial"],
    
    // Configuraciones específicas
    mostrarInfoMatrizador: true,
    mostrarIndicadorContacto: true,
    mostrarCamposExtendidos: true,
    mostrarInfoEmail: true,
    esAdmin: true,
    
    // Permisos específicos - SIMPLIFICADOS PARA SUPERVISIÓN
    permisos: {
      // Edición de secciones (LIMITADO - no duplicar funciones de otros roles)
      editarGeneral: false,              // ❌ Solo lectura
      editarCliente: true,               // ✅ Puede corregir datos cliente
      editarFinanciero: false,           // ❌ Solo caja maneja finanzas
      editarNotificaciones: false,       // ❌ Admin no configura notificaciones individuales
      editarNotas: true,                 // ✅ Puede agregar notas administrativas
      editarGlobal: false,
      
      // Permisos de gestión (DELEGADOS A OTROS ROLES)
      cambiarMatrizador: false,          // ❌ Lo hace CAJA al recibir documento
      generarNotaCredito: false,         // ❌ Lo hace CAJA
      separarGrupos: false,              // ❌ Lo hace MATRIZADOR
      
      // Acciones principales ADMIN (SOLO SUPERVISIÓN)
      cambiarEstado: true,               // ✅ ÚNICA función admin específica
      marcarListo: false,                // ❌ Lo hace MATRIZADOR
      eliminarDocumento: false,          // ❌ Usar sistema de reversiones
      
      // Supervisión y auditoría
      verReversiones: true,              // ✅ Panel de reversiones
      auditoria: true,                   // ✅ Ver auditoría completa
      
      // Acciones comunes
      imprimirDocumento: true,
      descargarPDF: true,
      compartirDocumento: true
    },
    
    // URL de retorno
    urlVolver: '/admin/documentos',
    puedeEditar: true
  },
  
  matrizador: {
    // Secciones visibles
    mostrarHeader: true,
    mostrarAlertas: true,
    mostrarInfoGeneral: true,
    mostrarCliente: true,
    mostrarFinanciero: true,
    mostrarNotificaciones: true,
    mostrarNotas: true,
    mostrarNotificacionesGrupales: true,
    mostrarAcciones: true,
    mostrarHistorial: true,
    mostrarModalMarcarListo: true,
    
    // Configuraciones específicas
    mostrarInfoMatrizador: false,
    mostrarIndicadorContacto: true,
    mostrarCamposExtendidos: false,
    mostrarInfoEmail: true,
    esAdmin: false,
    
    // Permisos específicos
    permisos: {
      // Edición de secciones (solo sus documentos asignados)
      editarGeneral: false,
      editarCliente: true, // Función que verifica asignación
      editarFinanciero: false,
      editarNotificaciones: true, // Función que verifica asignación
      editarNotas: true, // Función que verifica asignación
      editarGlobal: false,
      
      // Acciones principales
      marcarListo: true, // Función que verifica asignación
      crearGrupo: true,
      separarMiDocumento: true,
      
      // Acciones comunes
      imprimirDocumento: true,
      descargarPDF: true,
      compartirDocumento: false
    },
    
    urlVolver: '/matrizador/documentos',
    puedeEditar: true
  },
  
  caja: {
    // Secciones visibles
    mostrarHeader: true,
    mostrarAlertas: false,
    mostrarInfoGeneral: true,
    mostrarCliente: true,
    mostrarFinanciero: true,
    mostrarNotificaciones: false,
    mostrarNotas: true,
    mostrarNotificacionesGrupales: false,
    mostrarAcciones: true,
    mostrarHistorial: true,
    mostrarModalMarcarListo: false,
    
    // Configuraciones específicas
    mostrarInfoMatrizador: true,
    mostrarIndicadorContacto: false,
    mostrarCamposExtendidos: true,
    mostrarInfoEmail: false,
    esAdmin: false,
    
    // Permisos específicos
    permisos: {
      // Edición de secciones
      editarGeneral: false,
      editarCliente: true,
      editarFinanciero: true, // Solo caja puede editar datos financieros
      editarNotificaciones: false,
      editarNotas: true,
      editarGlobal: false,
      
      // Acciones principales
      registrarPago: true,
      generarFactura: true,
      entregarDocumento: true,
      
      // Acciones comunes
      imprimirDocumento: true,
      descargarPDF: true,
      compartirDocumento: false
    },
    
    urlVolver: '/caja/documentos',
    puedeEditar: true
  },
  
  archivo: {
    // Secciones visibles (IGUAL QUE MATRIZADOR PERO SIN FINANCIERO/NOTIFICACIONES)
    mostrarHeader: true,
    mostrarAlertas: false,
    mostrarInfoGeneral: true,
    mostrarCliente: true,                  // ✅ Mostrar pero solo lectura
    mostrarFinanciero: false,              // ❌ Archivo no maneja pagos
    mostrarNotificaciones: false,          // ❌ Archivo no gestiona notificaciones
    mostrarNotas: true,
    mostrarNotificacionesGrupales: true,   // ✅ Solo si es documento propio
    mostrarAcciones: false,                // ❌ NO mostrar sección separada "Acciones Disponibles"
    mostrarHistorial: true,
    mostrarModalMarcarListo: false,
    
    // Configuraciones específicas
    mostrarInfoMatrizador: true,
    mostrarIndicadorContacto: true,
    mostrarCamposExtendidos: false,
    mostrarInfoEmail: false,
    esAdmin: false,
    
    // Permisos específicos (SOLO LECTURA + NOTAS)
    permisos: {
      // Edición de secciones (solo lectura para archivo)
      editarGeneral: false,
      editarCliente: false,              // ❌ Solo lectura
      editarFinanciero: false,
      editarNotificaciones: false,
      editarNotas: true,                 // ✅ Solo pueden editar notas
      editarGlobal: false,
      
      // Acciones principales (van en header, NO en sección separada)
      entregarDocumento: true,
      verificarDocumento: true,
      devolverArchivo: false,
      
      // Acciones comunes
      imprimirDocumento: true,
      descargarPDF: true,
      compartirDocumento: false
    },
    
    urlVolver: '/archivo/documentos',
    puedeEditar: false
  },
  
  recepcion: {
    // Secciones visibles
    mostrarHeader: true,
    mostrarAlertas: false,
    mostrarInfoGeneral: true,
    mostrarCliente: true,
    mostrarFinanciero: false,
    mostrarNotificaciones: false,
    mostrarNotas: true,
    mostrarNotificacionesGrupales: false,
    mostrarAcciones: true,
    mostrarHistorial: true,
    mostrarModalMarcarListo: false,
    
    // Configuraciones específicas
    mostrarInfoMatrizador: true,
    mostrarIndicadorContacto: true,
    mostrarCamposExtendidos: false,
    mostrarInfoEmail: false,
    esAdmin: false,
    
    // Permisos específicos
    permisos: {
      // Edición de secciones
      editarGeneral: false,
      editarCliente: true,
      editarFinanciero: false,
      editarNotificaciones: false,
      editarNotas: true,
      editarGlobal: false,
      
      // Acciones principales
      asignarMatrizador: true,
      entregarDocumento: true,
      
      // Acciones comunes
      imprimirDocumento: true,
      descargarPDF: true,
      compartirDocumento: false
    },
    
    urlVolver: '/recepcion/documentos',
    puedeEditar: true
  }
};

// ============== FUNCIONES PRINCIPALES ==============

/**
 * Obtiene la configuración base para un rol específico
 * @param {string} rol - Rol del usuario (admin, matrizador, caja, archivo, recepcion)
 * @returns {Object} Configuración base del rol
 */
function obtenerConfiguracionBase(rol) {
  const config = configRoles[rol];
  if (!config) {
    throw new Error(`Rol '${rol}' no reconocido`);
  }
  
  return JSON.parse(JSON.stringify(config)); // Deep clone
}

/**
 * Calcula permisos dinámicos basados en el rol, documento y usuario
 * @param {string} rol - Rol del usuario
 * @param {Object} documento - Datos del documento
 * @param {number} userId - ID del usuario
 * @param {Object} usuario - Datos completos del usuario (opcional)
 * @returns {Object} Configuración con permisos calculados
 */
function calcularPermisosDinamicos(rol, documento, userId, usuario = null) {
  const config = obtenerConfiguracionBase(rol);
  
  // Aplicar lógica específica según rol
  switch (rol) {
    case 'matrizador':
      const esDocumentoAsignado = documento.idMatrizador === userId;
      
      // Solo puede editar sus documentos asignados
      config.permisos.editarCliente = esDocumentoAsignado;
      config.permisos.editarNotificaciones = esDocumentoAsignado;
      config.permisos.editarNotas = esDocumentoAsignado;
      config.permisos.marcarListo = esDocumentoAsignado && documento.estado === 'en_proceso';
      
      // Solo puede crear grupos si el documento está en proceso y asignado
      config.permisos.crearGrupo = esDocumentoAsignado && documento.estado === 'en_proceso';
      
      break;
      
    case 'admin':
      // Admin: SOLO supervisión y cambio de estados
      // Todas las demás funciones son responsabilidad de otros roles
      config.permisos.cambiarEstado = true;
      config.permisos.marcarListo = false;
      config.permisos.cambiarMatrizador = false;
      config.permisos.eliminarDocumento = false;
      break;
      
    case 'caja':
      // Caja puede editar datos financieros independientemente de asignación
      config.permisos.editarFinanciero = true;
      break;
      
    case 'archivo':
      // Archivo: verificar si es documento propio (asignado a él)
      const esDocumentoPropio = parseInt(documento.idMatrizador) === parseInt(userId);
      
      console.log(`🔍 [DEBUG] Verificando documento propio:`, {
        documentoMatrizadorId: documento.idMatrizador,
        userId,
        esDocumentoPropio
      });
      
      if (esDocumentoPropio) {
        // Para documentos propios, habilitar permisos específicos
        config.permisos.editarCliente = true;
        config.permisos.editarNotificaciones = true;
        config.permisos.editarNotas = true;
        config.permisos.marcarComoListo = documento.estado === 'en_proceso';
        config.permisos.devolverAProceso = documento.estado === 'listo_para_entrega';
      } else {
        // Para documentos de otros, solo lectura y entrega
        config.permisos.editarCliente = false;
        config.permisos.editarNotificaciones = false;
        config.permisos.editarNotas = false;
        config.permisos.marcarComoListo = false;
        config.permisos.devolverAProceso = false;
      }
      
      // Archivo puede entregar cualquier documento que esté listo
      config.permisos.entregarDocumento = documento.estado === 'listo_para_entrega';
      break;
      
    case 'recepcion':
      // Recepción puede asignar matrizador solo si no está asignado
      config.permisos.asignarMatrizador = !documento.idMatrizador;
      break;
  }
  
  return config;
}

/**
 * Obtiene el detalle completo del documento con datos específicos según el rol
 * @param {string} rol - Rol del usuario
 * @param {number} documentoId - ID del documento
 * @param {number} userId - ID del usuario
 * @param {Object} options - Opciones adicionales
 * @returns {Object} Datos completos para la vista
 */
async function obtenerDetallePorRol(rol, documentoId, userId, options = {}) {
  try {
    console.log(`🔍 Obteniendo detalle documento ${documentoId} para rol ${rol} usuario ${userId}`);
    
    // Buscar documento con asociaciones necesarias
    const documento = await Documento.findByPk(documentoId, {
      include: [
        {
          model: Matrizador,
          as: 'matrizador',
          attributes: ['id', 'nombre', 'email']
        }
      ]
    });
    
    if (!documento) {
      throw new Error('Documento no encontrado');
    }
    
    // Verificar permisos de acceso según rol
    const tieneAcceso = verificarAccesoDocumento(rol, documento, userId);
    if (!tieneAcceso) {
      throw new Error('No tiene permisos para ver este documento');
    }
    
    // Calcular configuración y permisos dinámicos
    const config = calcularPermisosDinamicos(rol, documento, userId);
    
    // Obtener datos adicionales según necesidad
    const datosAdicionales = await obtenerDatosAdicionales(rol, documento, config);
    
    // Obtener historial si es necesario
    let eventos = [];
    if (config.mostrarHistorial) {
      eventos = await obtenerHistorialUniversal(documentoId, rol, {
        incluirDetalles: config.esAdmin,
        limitarEventos: config.esAdmin ? false : true
      });
    }
    
    // Obtener información de notificaciones grupales
    let informacionGrupal = null;
    if (config.mostrarNotificacionesGrupales && ['matrizador', 'archivo'].includes(rol)) {
      // Para archivo, solo si es documento propio
      if (rol === 'archivo') {
        const esDocumentoPropio = parseInt(documento.idMatrizador) === parseInt(userId);
        if (esDocumentoPropio) {
          informacionGrupal = await obtenerInformacionGrupal(documento);
        }
      } else {
        // Para matrizador, siempre obtener info grupal
        informacionGrupal = await obtenerInformacionGrupal(documento);
      }
    }
    
    console.log(`✅ Detalle obtenido exitosamente para rol ${rol}`);
    
    return {
      documento,
      config,
      eventos,
      informacionGrupal,
      userRole: rol,
      ...datosAdicionales
    };
    
  } catch (error) {
    console.error(`❌ Error obteniendo detalle documento ${documentoId}:`, error);
    throw error;
  }
}

/**
 * Verifica si el usuario tiene acceso al documento según su rol
 * @param {string} rol - Rol del usuario
 * @param {Object} documento - Datos del documento
 * @param {number} userId - ID del usuario
 * @returns {boolean} True si tiene acceso
 */
function verificarAccesoDocumento(rol, documento, userId) {
  switch (rol) {
    case 'admin':
      return true; // Admin puede ver todo
      
    case 'matrizador':
      // Matrizador solo puede ver documentos asignados a él
      return documento.matrizador_id === userId;
      
    case 'caja':
    case 'archivo':
    case 'recepcion':
      return true; // Estos roles pueden ver todos los documentos
      
    default:
      return false;
  }
}

/**
 * Obtiene datos adicionales necesarios según el rol
 * @param {string} rol - Rol del usuario
 * @param {Object} documento - Datos del documento
 * @param {Object} config - Configuración del rol
 * @returns {Object} Datos adicionales
 */
async function obtenerDatosAdicionales(rol, documento, config) {
  const datos = {};
  
  // Obtener lista de matrizadores disponibles si se necesita
  if (config.permisos.cambiarMatrizador || config.permisos.asignarMatrizador) {
    datos.matrizadoresDisponibles = await Matrizador.findAll({
      where: { activo: true },
      attributes: ['id', 'nombre'],
      order: [['nombre', 'ASC']]
    });
  }
  
  return datos;
}

/**
 * Obtiene información de notificaciones grupales
 * @param {Object} documento - Datos del documento
 * @returns {Object|null} Información grupal o null
 */
async function obtenerInformacionGrupal(documento) {
  // Implementación simplificada - se puede expandir según necesidades
  try {
    const grupo = await NotificacionGrupal.findOne({
      where: {
        id: documento.notificacion_grupal_id
      },
      include: [
        {
          model: Documento,
          as: 'documentos',
          attributes: ['id', 'codigoBarras', 'tipoDocumento', 'estado']
        }
      ]
    });
    
    if (grupo) {
      return {
        grupo,
        esLiderDelGrupo: grupo.documento_lider_id === documento.id,
        totalDocumentosGrupo: grupo.documentos.length,
        documentosDelGrupo: grupo.documentos,
        puedeModificarGrupo: true // Se puede ajustar según lógica específica
      };
    }
    
    // Si no está en grupo, buscar documentos agrupables
    const documentosAgrupables = await Documento.findAll({
      where: {
        nombreCliente: documento.nombreCliente,
        identificacionCliente: documento.identificacionCliente,
        estado: 'en_proceso',
        notificacion_grupal_id: null,
        id: { [Op.ne]: documento.id }
      },
      attributes: ['id', 'codigoBarras', 'tipoDocumento', 'estado', 'created_at'],
      limit: 10
    });
    
    return {
      grupo: null,
      puedeCrearGrupo: documentosAgrupables.length > 0,
      totalAgrupables: documentosAgrupables.length,
      documentosAgrupables
    };
    
  } catch (error) {
    console.error('Error obteniendo información grupal:', error);
    return null;
  }
}

/**
 * Edita una sección específica del documento con validación de permisos
 * @param {string} rol - Rol del usuario
 * @param {number} documentoId - ID del documento
 * @param {string} seccion - Nombre de la sección a editar
 * @param {Object} datos - Datos a actualizar
 * @param {number} userId - ID del usuario
 * @returns {Object} Resultado de la operación
 */
async function editarSeccionPorRol(rol, documentoId, seccion, datos, userId) {
  try {
    console.log(`📝 Editando sección ${seccion} del documento ${documentoId} por rol ${rol}`);
    
    // Obtener documento actual
    const documento = await Documento.findByPk(documentoId);
    if (!documento) {
      throw new Error('Documento no encontrado');
    }
    
    // Verificar permisos
    const config = calcularPermisosDinamicos(rol, documento, userId);
    const permiso = `editar${seccion.charAt(0).toUpperCase() + seccion.slice(1)}`;
    
    console.log(`🔐 [DEBUG] Verificando permisos:`, {
      rol,
      documentoId,
      seccion,
      permiso,
      userId,
      matrizadorId: documento.idMatrizador,
      permisos: config.permisos
    });
    
    if (!config.permisos[permiso]) {
      console.error(`❌ [ERROR] Permiso denegado: ${permiso} = ${config.permisos[permiso]}`);
      throw new Error('No tiene permisos para editar esta sección');
    }
    
    // Validar datos según la sección
    console.log(`📥 [DEBUG] Datos recibidos para sección ${seccion}:`, datos);
    const datosValidados = validarDatosSeccion(seccion, datos);
    console.log(`✅ [DEBUG] Datos validados para sección ${seccion}:`, datosValidados);
    
    // Actualizar documento
    await documento.update(datosValidados);
    
    // Registrar evento de auditoría (no crítico)
    try {
      const docId = parseInt(documentoId);
      const usrId = parseInt(userId);
      
      console.log(`📝 [DEBUG] Creando evento:`, {
        documentoId: docId,
        usuarioId: usrId,
        tipo: 'edicion',
        isValidDocId: !isNaN(docId),
        isValidUsrId: !isNaN(usrId)
      });
      
      if (!isNaN(docId) && !isNaN(usrId)) {
        await EventoDocumento.create({
          documentoId: docId,
          usuarioId: usrId,
          tipo: 'edicion',
          descripcion: `Sección ${seccion} editada por ${rol}`,
          detalles: JSON.stringify({
            seccion,
            cambios: datosValidados,
            rol
          })
        });
        console.log('✅ Evento de auditoría creado exitosamente');
      } else {
        console.warn(`⚠️ IDs inválidos para EventoDocumento, saltando auditoría:`, {
          documentoId, userId, docId, usrId
        });
      }
    } catch (eventoError) {
      console.error('❌ Error creando evento de auditoría (no crítico):', eventoError.message);
      // No lanzar error, el guardado principal ya fue exitoso
    }
    
    console.log(`✅ Sección ${seccion} editada exitosamente`);
    
    return {
      success: true,
      message: 'Sección actualizada correctamente',
      datos: datosValidados
    };
    
  } catch (error) {
    console.error(`❌ Error editando sección ${seccion}:`, error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Valida los datos de entrada según la sección
 * @param {string} seccion - Nombre de la sección
 * @param {Object} datos - Datos a validar
 * @returns {Object} Datos validados
 */
function validarDatosSeccion(seccion, datos) {
  switch (seccion) {
    case 'cliente':
      return {
        nombreCliente: datos.nombreCliente?.trim() || '',
        identificacionCliente: datos.identificacionCliente?.trim() || '',
        emailCliente: datos.emailCliente?.trim() || null,
        telefonoCliente: datos.telefonoCliente?.replace(/\D/g, '') || null
      };
      
    case 'notificaciones':
      const esEntregaInmediata = Boolean(datos.entregadoInmediatamente);
      const metodoNotif = datos.metodoNotificacion || 'whatsapp';
      
      return {
        metodoNotificacion: metodoNotif,
        notificarAutomatico: metodoNotif === 'whatsapp' && !esEntregaInmediata,
        razonSinNotificar: datos.razonSinNotificar?.trim() || null,
        entregadoInmediatamente: esEntregaInmediata
      };
      
    case 'notas':
      return {
        notas: datos.notas?.trim() || null
      };
      
    case 'general':
      return {
        tipoDocumento: datos.tipoDocumento?.trim() || '',
        matrizador_id: datos.matrizador_id || null
      };
      
    case 'financiero':
      return {
        numeroFactura: datos.numeroFactura?.trim() || null,
        valorFactura: parseFloat(datos.valorFactura) || 0,
        fechaFactura: datos.fechaFactura || null,
        estadoPago: datos.estadoPago || 'pendiente',
        metodoPago: datos.metodoPago?.trim() || null
      };
      
    default:
      throw new Error('Sección no reconocida');
  }
}

// ============== EXPORTAR FUNCIONES ==============

module.exports = {
  obtenerDetallePorRol,
  editarSeccionPorRol,
  calcularPermisosDinamicos,
  obtenerConfiguracionBase,
  verificarAccesoDocumento,
  configRoles
}; 