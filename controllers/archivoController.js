/**
 * Controlador para el módulo de Archivo
 * Define las funciones para usuarios con rol de Archivo
 * 
 * FUNCIONALIDADES:
 * - Ver TODOS los documentos del sistema (solo lectura para documentos ajenos)
 * - Crear/editar/entregar SUS PROPIOS documentos de archivo
 * - Dashboard con estado de todos los documentos
 * - Sistema de notificaciones completo para documentos propios
 */

const { Op, Sequelize } = require('sequelize');
const { sequelize } = require('../config/database');
const Documento = require('../models/Documento');
const Matrizador = require('../models/Matrizador');
const EventoDocumento = require('../models/EventoDocumento');
const NotificacionEnviada = require('../models/NotificacionEnviada');
const NotificacionGrupal = require('../models/NotificacionGrupal');

// Importar servicios de notificación
const NotificationService = require('../services/notificationService');
const { obtenerHistorialUniversal } = require('../utils/historialUniversal');
const notificacionController = require('./notificacionController');

const archivoController = {

  /**
   * Dashboard principal del archivo - SIMPLIFICADO
   * Vista general del estado de documentos (sin supervisión)
   */
  dashboard: async (req, res) => {
    try {
      console.log('🗂️ Acceso al dashboard de archivo:', req.matrizador?.nombre);
      
      const moment = require('moment');
      
      // DATOS SIMPLIFICADOS PARA DASHBOARD LIMPIO
      const dashboardData = {
        // ESTADO GENERAL DE DOCUMENTOS (información, no supervisión)
        documentos_en_proceso: await Documento.count({
          where: {
            estado: 'en_proceso',
            motivoEliminacion: null
          }
        }),
        
        documentos_listos: await Documento.count({
          where: {
            estado: 'listo_para_entrega',
            motivoEliminacion: null
          }
        }),
        
        documentos_entregados_hoy: await Documento.count({
          where: {
            estado: 'entregado',
            fechaEntrega: {
              [Op.gte]: moment().startOf('day').toDate()
            }
          }
        }),
        
        documentos_entregados_mes: await Documento.count({
          where: {
            estado: 'entregado',
            fechaEntrega: {
              [Op.gte]: moment().startOf('month').toDate()
            }
          }
        })
      };



      // DOCUMENTOS ATRASADOS (conservar funcionalidad existente)
      const fechaLimite15 = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
      
      const documentosAtrasados = await Documento.findAll({
        where: {
          estado: {
            [Op.in]: ['en_proceso', 'listo_para_entrega']
          },
          created_at: {
            [Op.lt]: fechaLimite15
          },
          motivoEliminacion: null
        },
        include: [
          {
            model: Matrizador,
            as: 'matrizador',
            attributes: ['id', 'nombre'],
            required: false
          }
        ],
        order: [['created_at', 'ASC']],
        limit: 50
      });

      // Procesar documentos atrasados
      const documentosConDias = documentosAtrasados.map(doc => {
        const fechaCreacion = new Date(doc.created_at);
        const hoy = new Date();
        const diasTranscurridos = Math.floor((hoy - fechaCreacion) / (1000 * 60 * 60 * 24));
        
        let numeroLibro = 'N/A';
        if (doc.codigoBarras && doc.codigoBarras.length >= 10) {
          numeroLibro = doc.codigoBarras.substring(4, 10);
        }
        
        return {
          id: doc.id,
          codigoBarras: doc.codigoBarras,
          nombreCliente: doc.nombreCliente,
          tipoDocumento: doc.tipoDocumento,
          fechaCreacion: doc.created_at,
          diasTranscurridos,
          numeroLibro,
          estado: doc.estado,
          matrizador: {
            nombre: doc.matrizador ? doc.matrizador.nombre : 'Sin asignar',
            id: doc.matrizador ? doc.matrizador.id : null
          },
          prioridad: diasTranscurridos > 30 ? 'Crítica' : 
                    diasTranscurridos > 20 ? 'Alta' : 'Media',
          clasePrioridad: diasTranscurridos > 30 ? 'danger' : 
                         diasTranscurridos > 20 ? 'warning' : 'info'
        };
      });

      console.log('📊 [ARCHIVO] Dashboard simplificado calculado:', {
        enProceso: dashboardData.documentos_en_proceso,
        listos: dashboardData.documentos_listos,
        entregadosHoy: dashboardData.documentos_entregados_hoy,
        entregadosMes: dashboardData.documentos_entregados_mes,
        atrasados: documentosConDias.length
      });

      res.render('archivo/dashboard', {
        layout: 'archivo',
        title: 'Dashboard de Archivo - Vista General',
        // Datos simplificados
        documentos_en_proceso: dashboardData.documentos_en_proceso,
        documentos_listos: dashboardData.documentos_listos,
        documentos_entregados_hoy: dashboardData.documentos_entregados_hoy,
        documentos_entregados_mes: dashboardData.documentos_entregados_mes,
        // Documentos atrasados (conservado)
        documentosAtrasados: documentosConDias,
        totalAtrasados: documentosConDias.length,
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre,
        userId: req.matrizador?.id,
        // Fecha actual para el header
        now: new Date()
      });

    } catch (error) {
      console.error('❌ Error en dashboard de archivo:', error);
      res.status(500).render('error', {
        layout: 'archivo',
        title: 'Error',
        message: 'Error al cargar el dashboard de archivo',
        error
      });
    }
  },

  /**
   * Listar TODOS los documentos del sistema
   * Permite filtros pero solo lectura para documentos ajenos
   */
  listarTodosDocumentos: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 25;
      const offset = (page - 1) * limit;

      // ✨ NUEVO: Parámetros de ordenamiento
      const ordenarPor = req.query.ordenarPor || 'updated_at';
      const ordenDireccion = req.query.ordenDireccion || 'desc';

      console.log('📊 [ARCHIVO] Parámetros de ordenamiento:', { ordenarPor, ordenDireccion });

      // Construir filtros con mapeo correcto de valores
      const whereConditions = {};
      
      if (req.query.estado) {
        // Mapear valores del formulario a valores correctos del enum
        const estadoMapeado = mapearEstadoFormulario(req.query.estado);
        if (estadoMapeado) {
          whereConditions.estado = estadoMapeado;
        }
      }
      
      if (req.query.estadoPago) {
        // Mapear valores del formulario a valores correctos del enum
        const estadoPagoMapeado = mapearEstadoPagoFormulario(req.query.estadoPago);
        if (estadoPagoMapeado) {
          whereConditions.estadoPago = estadoPagoMapeado;
        }
      }
      
      if (req.query.tipoDocumento) {
        whereConditions.tipoDocumento = req.query.tipoDocumento;
      }
      
      if (req.query.matrizador) {
        whereConditions.idMatrizador = req.query.matrizador;
      }
      
      if (req.query.buscar) {
        whereConditions[Op.or] = [
          { codigoBarras: { [Op.iLike]: `%${req.query.buscar}%` } },
          { nombreCliente: { [Op.iLike]: `%${req.query.buscar}%` } },
          { identificacionCliente: { [Op.iLike]: `%${req.query.buscar}%` } }
        ];
      }

      // ✨ NUEVO: Configurar ordenamiento dinámico
      let orderClause = [];
      
      // Mapear columnas de frontend a campos de base de datos
      const mapeoColumnas = {
        'codigoBarras': 'codigoBarras',
        'nombreCliente': 'nombreCliente', 
        'tipoDocumento': 'tipoDocumento',
        'valorFactura': 'valorFactura',
        'estado': 'estado',
        'estadoPago': 'estadoPago',
        'updated_at': 'updated_at',
        'created_at': 'created_at',
        'fechaFactura': 'fechaFactura'
      };
      
      // Ordenamiento especial para matrizador (requiere JOIN)
      if (ordenarPor === 'matrizador') {
        orderClause = [[{ model: Matrizador, as: 'matrizador' }, 'nombre', ordenDireccion.toUpperCase()]];
      } else if (mapeoColumnas[ordenarPor]) {
        orderClause = [[mapeoColumnas[ordenarPor], ordenDireccion.toUpperCase()]];
      } else {
        // Fallback a ordenamiento por defecto
        orderClause = [['updated_at', 'DESC']];
        console.warn('⚠️ [ARCHIVO] Columna de ordenamiento no reconocida:', ordenarPor);
      }

      console.log('📊 [ARCHIVO] Orden SQL aplicado:', orderClause);

      // Obtener documentos con paginación y ordenamiento
      const { count, rows: documentos } = await Documento.findAndCountAll({
        where: whereConditions,
        include: [
          {
            model: Matrizador,
            as: 'matrizador',
            attributes: ['id', 'nombre']
          }
        ],
        order: orderClause,
        limit,
        offset
      });

      // Obtener lista de matrizadores para filtros
      const matrizadores = await Matrizador.findAll({
        where: {
          rol: { [Op.in]: ['matrizador', 'caja_archivo', 'archivo'] },
          activo: true
        },
        attributes: ['id', 'nombre'],
        order: [['nombre', 'ASC']]
      });

      const totalPages = Math.ceil(count / limit);

      res.render('archivo/documentos/listado-todos', {
        layout: 'archivo',
        title: 'Todos los Documentos',
        documentos,
        matrizadores,
        filtros: req.query,
        paginacion: {
          currentPage: page,
          totalPages,
          totalDocuments: count,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
          nextPage: page + 1,
          prevPage: page - 1
        },
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre,
        userId: req.matrizador?.id
      });

    } catch (error) {
      console.error('❌ Error al listar todos los documentos:', error);
      res.status(500).render('error', {
        layout: 'archivo',
        title: 'Error',
        message: 'Error al cargar la lista de documentos',
        error
      });
    }
  },

  /**
   * Listar MIS documentos (solo los asignados al usuario archivo)
   */
  listarMisDocumentos: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;  // ← CORREGIDO: 20 documentos por página
      const offset = (page - 1) * limit;

      // ✨ NUEVO: Parámetros de ordenamiento
      const ordenarPor = req.query.ordenarPor || 'updated_at';
      const ordenDireccion = req.query.ordenDireccion || 'desc';

      console.log('📊 [ARCHIVO-MIS] Parámetros de ordenamiento:', { ordenarPor, ordenDireccion });

      // Solo documentos asignados al usuario archivo actual
      const whereConditions = {
        idMatrizador: req.matrizador.id
      };
      
      if (req.query.estado) {
        // Mapear valores del formulario a valores correctos del enum
        const estadoMapeado = mapearEstadoFormulario(req.query.estado);
        if (estadoMapeado) {
          whereConditions.estado = estadoMapeado;
        }
      }
      
      if (req.query.estadoPago) {
        // Mapear valores del formulario a valores correctos del enum
        const estadoPagoMapeado = mapearEstadoPagoFormulario(req.query.estadoPago);
        if (estadoPagoMapeado) {
          whereConditions.estadoPago = estadoPagoMapeado;
        }
      }
      
      if (req.query.tipoDocumento) {
        whereConditions.tipoDocumento = req.query.tipoDocumento;
      }
      
      if (req.query.buscar) {
        whereConditions[Op.or] = [
          { codigoBarras: { [Op.iLike]: `%${req.query.buscar}%` } },
          { nombreCliente: { [Op.iLike]: `%${req.query.buscar}%` } },
          { identificacionCliente: { [Op.iLike]: `%${req.query.buscar}%` } }
        ];
      }

      // ✨ NUEVO: Configurar ordenamiento dinámico (mismo mapeo que listarTodosDocumentos)
      let orderClause = [];
      
      const mapeoColumnas = {
        'codigoBarras': 'codigoBarras',
        'nombreCliente': 'nombreCliente', 
        'tipoDocumento': 'tipoDocumento',
        'valorFactura': 'valorFactura',
        'estado': 'estado',
        'estadoPago': 'estadoPago',
        'updated_at': 'updated_at',
        'created_at': 'created_at',
        'fechaFactura': 'fechaFactura'
      };
      
      if (ordenarPor === 'matrizador') {
        orderClause = [[{ model: Matrizador, as: 'matrizador' }, 'nombre', ordenDireccion.toUpperCase()]];
      } else if (mapeoColumnas[ordenarPor]) {
        orderClause = [[mapeoColumnas[ordenarPor], ordenDireccion.toUpperCase()]];
      } else {
        orderClause = [['updated_at', 'DESC']];
        console.warn('⚠️ [ARCHIVO-MIS] Columna de ordenamiento no reconocida:', ordenarPor);
      }

      console.log('📊 [ARCHIVO-MIS] Orden SQL aplicado:', orderClause);

      const { count, rows: documentos } = await Documento.findAndCountAll({
        where: whereConditions,
        include: [
          {
            model: Matrizador,
            as: 'matrizador',
            attributes: ['id', 'nombre']
          }
        ],
        order: orderClause,
        limit,
        offset
      });

      const totalPages = Math.ceil(count / limit);

      res.render('archivo/documentos/mis-documentos', {
        layout: 'archivo',
        title: 'Mis Documentos de Archivo',
        documentos,
        filtros: req.query,
        paginacion: {
          currentPage: page,
          totalPages,
          totalDocuments: count,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
          nextPage: page + 1,
          prevPage: page - 1
        },
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre,
        userId: req.matrizador?.id
      });

    } catch (error) {
      console.error('❌ Error al listar mis documentos:', error);
      res.status(500).render('error', {
        layout: 'archivo',
        title: 'Error',
        message: 'Error al cargar mis documentos',
        error
      });
    }
  },

  /**
   * Ver detalle de cualquier documento - IDÉNTICO A MATRIZADOR
   * Solo lectura para documentos ajenos, edición completa para propios
   */
  verDetalleDocumento: async (req, res) => {
    try {
      const documentoId = req.params.id;
      const userId = req.matrizador?.id;
      const userRole = 'archivo';
      
      console.log(`📋 [ARCHIVO] Accediendo a detalle documento ${documentoId} para usuario ${userId}`);
      
      // Buscar documento con sus relaciones incluyendo notificación grupal
      const documento = await Documento.findByPk(documentoId, {
        include: [
          {
            model: Matrizador,
            as: 'matrizador',
            attributes: ['id', 'nombre', 'email']
          },
          {
            model: NotificacionGrupal,
            as: 'notificacionGrupal',
            required: false,
            attributes: ['id', 'codigoVerificacion', 'estado', 'totalDocumentos', 'fechaEnvio']
          }
        ]
      });
      
      if (!documento) {
        return res.status(404).render('error', { 
          layout: 'archivo',
          title: 'Documento no encontrado',
          message: 'El documento solicitado no existe o no tienes permisos para verlo'
        });
      }
      
      console.log(`📋 [ARCHIVO] Documento encontrado: ${documento.id} ${documento.codigoBarras}`);
      
      // 🆕 NUEVO: Usar historial universal
      const historialEventos = await obtenerHistorialUniversal(documentoId, 'archivo', {
        incluirInformacionTecnica: false,
        mostrarEventosInternos: false
      });
      
      console.log(`📋 [ARCHIVO] Encontrados ${historialEventos.length} eventos para el documento`);
      
      // Verificar si es documento propio (puede editar) o ajeno (solo lectura)
      const esDocumentoPropio = parseInt(documento.idMatrizador) === parseInt(userId);
      
              console.log(`🔍 [ARCHIVO] Debug esDocumentoPropio:`, {
          documentoMatrizadorId: documento.idMatrizador,
          userId,
          esDocumentoPropio
        });
      
      // ============== INFORMACIÓN DE NOTIFICACIÓN GRUPAL (IDÉNTICA A MATRIZADOR) ==============
      let informacionGrupal = null;
      
      // Solo procesar notificaciones grupales para documentos propios
      if (esDocumentoPropio) {
        // Si el documento está en un grupo, obtener información adicional
        if (documento.notificacionGrupalId) {
          // Obtener todos los documentos del mismo grupo
          const documentosDelGrupo = await Documento.findAll({
            where: {
              notificacionGrupalId: documento.notificacionGrupalId,
              id: { [Op.ne]: documento.id } // Excluir el documento actual
            },
            attributes: ['id', 'codigoBarras', 'tipoDocumento', 'estado', 'esLiderGrupo'],
            order: [['created_at', 'ASC']]
          });
          
          informacionGrupal = {
            grupo: documento.notificacionGrupal,
            documentosDelGrupo: documentosDelGrupo,
            esLiderDelGrupo: documento.esLiderGrupo,
            totalDocumentosGrupo: documento.notificacionGrupal?.totalDocumentos || 0,
            puedeModificarGrupo: documento.notificacionGrupal?.puedeModificarse() || false
          };
          
          console.log(`📱 [ARCHIVO] Documento está en grupo ${documento.notificacionGrupalId} con ${documentosDelGrupo.length} documentos adicionales`);
        } else {
          // Si no está en grupo, detectar documentos agrupables (solo si es documento propio)
          const { detectarDocumentosParaNotificacionGrupal } = require('./matrizadorController');
          const deteccionGrupal = await detectarDocumentosParaNotificacionGrupal(
            documento.identificacionCliente,
            documento.id,
            userId
          );
          
          informacionGrupal = {
            grupo: null,
            documentosAgrupables: deteccionGrupal.documentosDisponibles || [],
            puedeCrearGrupo: deteccionGrupal.puedeCrearGrupo || false,
            totalAgrupables: deteccionGrupal.totalDisponibles || 0
          };
          
          console.log(`📱 [ARCHIVO] Documento no está en grupo, ${deteccionGrupal.totalDisponibles || 0} documentos agrupables encontrados`);
        }
      }

      res.render('archivo/documentos/detalle', {
        layout: 'archivo',
        title: `Documento ${documento.codigoBarras || documento.id}`,
        documento,
        eventos: historialEventos, // 🆕 Historial universal
        informacionGrupal, // 🆕 Información de notificación grupal
        esDocumentoPropio, // 🆕 CRÍTICO: Indicar si es documento propio
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre,
        userId: req.matrizador?.id
      });

    } catch (error) {
      console.error('❌ Error al ver detalle del documento:', error);
      res.status(500).render('error', {
        layout: 'archivo',
        title: 'Error',
        message: 'Error al cargar el detalle del documento',
        error
      });
    }
  },

  /**
   * FUNCIÓN DESHABILITADA - Los documentos se crean desde caja
   */
  mostrarFormularioRegistro: async (req, res) => {
    return res.status(404).render('error', {
      layout: 'archivo',
      title: 'Función no disponible',
      message: 'Los documentos se crean desde el módulo de caja'
    });
  },

  /**
   * FUNCIÓN DESHABILITADA - Los documentos se crean desde caja
   */
  mostrarFormularioRegistroOLD: async (req, res) => {
    try {
      res.render('archivo/documentos/registro', {
        layout: 'archivo',
        title: 'Registrar Documento de Archivo',
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre,
        userId: req.matrizador?.id
      });
    } catch (error) {
      console.error('❌ Error al mostrar formulario de registro:', error);
      res.status(500).render('error', {
        layout: 'archivo',
        title: 'Error',
        message: 'Error al cargar el formulario de registro',
        error
      });
    }
  },

  /**
   * FUNCIÓN DESHABILITADA - Los documentos se crean desde caja
   */
  registrarDocumento: async (req, res) => {
    return res.status(404).render('error', {
      layout: 'archivo',
      title: 'Función no disponible',
      message: 'Los documentos se crean desde el módulo de caja'
    });
  },

  /**
   * FUNCIÓN DESHABILITADA - Los documentos se crean desde caja
   */
  registrarDocumentoOLD: async (req, res) => {
    const transaction = await sequelize.transaction();
    
    try {
      const {
        tipoDocumento,
        clienteNombre,
        clienteIdentificacion,
        clienteTelefono,
        clienteEmail,
        valorFactura,
        observaciones
      } = req.body;

      // DEBUGGING: Log detallado de creación de documento
      const fechaFacturaGenerada = new Date().toISOString().split('T')[0];
      console.log('🔍 [ARCHIVO] CREANDO DOCUMENTO CON LOGS DETALLADOS:');
      console.log('   📅 fechaFactura generada:', fechaFacturaGenerada);
      console.log('   👤 Usuario:', req.matrizador.nombre);
      console.log('   📋 Datos del documento:', {
        tipoDocumento,
        clienteNombre,
        valorFactura: parseFloat(valorFactura) || 0
      });

      // Crear el documento asignado al usuario archivo actual
      const nuevoDocumento = await Documento.create({
        tipoDocumento,
        nombreCliente: clienteNombre,
        identificacionCliente: clienteIdentificacion,
        telefonoCliente: clienteTelefono,
        emailCliente: clienteEmail,
        valorFactura: parseFloat(valorFactura) || 0,
        valorPendiente: parseFloat(valorFactura) || 0,
        fechaFactura: fechaFacturaGenerada, // CORREGIDO: Usar variable con log
        notas: observaciones,
        estado: 'en_proceso',
        estadoPago: 'pendiente',
        idMatrizador: req.matrizador.id,
        idUsuarioCreador: req.matrizador.id,
        rolUsuarioCreador: 'archivo',
        codigoBarras: `ARC-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`
      }, { transaction });

      console.log('✅ [ARCHIVO] DOCUMENTO CREADO:');
      console.log('   🆔 ID:', nuevoDocumento.id);
      console.log('   📋 Código:', nuevoDocumento.codigoBarras);
      console.log('   📅 fechaFactura guardada:', nuevoDocumento.fechaFactura);
      console.log('   📅 fechaFactura tipo:', typeof nuevoDocumento.fechaFactura);

      // Registrar evento de creación
      await EventoDocumento.create({
        documentoId: nuevoDocumento.id,
        tipo: 'creacion',
        descripcion: `Documento de archivo creado por ${req.matrizador.nombre}`,
        usuarioId: req.matrizador.id,
        detalles: {
          tipoDocumento,
          valorFactura,
          cliente: clienteNombre
        }
      }, { transaction });

      await transaction.commit();

      req.flash('success', 'Documento de archivo registrado exitosamente');
      res.redirect('/archivo/documentos/mis-documentos');

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error al registrar documento:', error);
      req.flash('error', 'Error al registrar el documento de archivo');
      res.redirect('/archivo/documentos/registro');
    }
  },

  /**
   * Mostrar formulario de edición (solo para documentos propios)
   */
  mostrarFormularioEdicion: async (req, res) => {
    try {
      const documentoId = req.params.id;
      
      const documento = await Documento.findByPk(documentoId);

      if (!documento) {
        return res.status(404).render('error', {
          layout: 'archivo',
          title: 'Documento no encontrado',
          message: 'El documento solicitado no existe'
        });
      }

      // Verificar que sea documento propio
      if (documento.idMatrizador !== req.matrizador.id) {
        return res.status(403).render('error', {
          layout: 'archivo',
          title: 'Acceso denegado',
          message: 'Solo puede editar sus propios documentos de archivo'
        });
      }

      res.render('archivo/documentos/editar', {
        layout: 'archivo',
        title: `Editar Documento ${documento.codigoBarras || documento.id}`,
        documento,
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre,
        userId: req.matrizador?.id
      });

    } catch (error) {
      console.error('❌ Error al mostrar formulario de edición:', error);
      res.status(500).render('error', {
        layout: 'archivo',
        title: 'Error',
        message: 'Error al cargar el formulario de edición',
        error
      });
    }
  },

  /**
   * Actualizar documento (solo documentos propios)
   */
  actualizarDocumento: async (req, res) => {
    const transaction = await sequelize.transaction();
    
    try {
      const documentoId = req.params.id;
      const documento = await Documento.findByPk(documentoId);

      if (!documento) {
        await transaction.rollback();
        return res.status(404).render('error', {
          layout: 'archivo',
          title: 'Documento no encontrado',
          message: 'El documento solicitado no existe'
        });
      }

      // Verificar que sea documento propio
      if (documento.idMatrizador !== req.matrizador.id) {
        await transaction.rollback();
        return res.status(403).render('error', {
          layout: 'archivo',
          title: 'Acceso denegado',
          message: 'Solo puede editar sus propios documentos de archivo'
        });
      }

      const {
        tipoDocumento,
        nombreCliente,
        identificacionCliente,
        telefonoCliente,
        emailCliente,
        valorFactura,
        notas
      } = req.body;

      // Procesar datos de notificaciones
      const datosActualizacion = {
        tipoDocumento,
        nombreCliente,
        identificacionCliente,
        telefonoCliente,
        emailCliente,
        valorFactura: parseFloat(valorFactura) || 0,
        notas
      };
      
      // Procesar configuración de notificaciones - SIMPLIFICADO A SOLO WHATSAPP
      if (req.body.politicaNotificacion) {
        if (req.body.politicaNotificacion === 'automatico') {
          datosActualizacion.notificarAutomatico = true;
          datosActualizacion.metodoNotificacion = 'whatsapp'; // Solo WhatsApp
          datosActualizacion.razonSinNotificar = null;
        } else if (req.body.politicaNotificacion === 'no_notificar') {
          datosActualizacion.notificarAutomatico = false;
          datosActualizacion.metodoNotificacion = 'ninguno';
          datosActualizacion.razonSinNotificar = req.body.razonSinNotificar;
        }
      }
      
      // Procesar documento habilitante
      if (req.body.esHabilitante === 'true') {
        datosActualizacion.documentoPrincipalId = req.body.documentoPrincipalId || null;
      } else {
        datosActualizacion.documentoPrincipalId = null;
      }
      
      // Procesar entrega inmediata
      datosActualizacion.entregadoInmediatamente = req.body.entregaInmediata === 'true';

      // Actualizar documento
      await documento.update(datosActualizacion, { transaction });

      // Recalcular valor pendiente si cambió el valor de factura
      if (parseFloat(valorFactura) !== documento.valorFactura) {
        const nuevoValorPendiente = parseFloat(valorFactura) - (documento.valorPagado || 0) - (documento.valorRetenido || 0);
        await documento.update({
          valorPendiente: Math.max(0, nuevoValorPendiente)
        }, { transaction });
      }

      // Registrar evento de actualización
      await EventoDocumento.create({
        documentoId: documento.id,
        tipo: 'actualizacion',
        descripcion: `Documento actualizado por ${req.matrizador.nombre}`,
        usuarioId: req.matrizador.id,
        detalles: {
          cambios: {
            tipoDocumento,
            valorFactura
          }
        }
      }, { transaction });

      await transaction.commit();

      req.flash('success', 'Documento actualizado exitosamente');
      res.redirect(`/archivo/documentos/detalle/${documento.id}`);

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error al actualizar documento:', error);
      req.flash('error', 'Error al actualizar el documento');
      res.redirect(`/archivo/documentos/editar/${req.params.id}`);
    }
  },

  // FUNCIÓN ELIMINADA: marcarDocumentoListo era duplicada
  // Se mantiene solo marcarComoListo que es la función correcta

  /**
   * Mostrar formulario de entrega (solo documentos propios)
   */
  mostrarFormularioEntrega: async (req, res) => {
    try {
      const documentoId = req.params.id;
      
      const documento = await Documento.findByPk(documentoId, {
        include: [
          {
            model: Matrizador,
            as: 'matrizador',
            attributes: ['id', 'nombre']
          }
        ]
      });

      if (!documento) {
        return res.status(404).render('error', {
          layout: 'archivo',
          title: 'Documento no encontrado',
          message: 'El documento solicitado no existe'
        });
      }

      // Verificar que sea documento propio
      if (documento.idMatrizador !== req.matrizador.id) {
        return res.status(403).render('error', {
          layout: 'archivo',
          title: 'Acceso denegado',
          message: 'Solo puede entregar sus propios documentos'
        });
      }

      // Verificar que esté listo para entrega
      if (documento.estado !== 'listo_para_entrega') {
        return res.status(400).render('error', {
          layout: 'archivo',
          title: 'Estado incorrecto',
          message: 'El documento debe estar en estado "Listo para Entrega" para poder ser entregado'
        });
      }

      res.render('archivo/documentos/entrega', {
        layout: 'archivo',
        title: `Entregar Documento ${documento.codigoBarras}`,
        documento,
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre,
        userId: req.matrizador?.id
      });

    } catch (error) {
      console.error('❌ Error al mostrar formulario de entrega:', error);
      res.status(500).render('error', {
        layout: 'archivo',
        title: 'Error',
        message: 'Error al cargar el formulario de entrega',
        error
      });
    }
  },

  /**
   * Marcar documento como listo (solo documentos propios) - IDÉNTICO A MATRIZADOR
   */
  marcarComoListo: async (req, res) => {
    const transaction = await sequelize.transaction();
    
    try {
      const { id } = req.params;
      const { 
        entrega_sin_verificar_pago, 
        justificacion_entrega_sin_pago,
        accion_autorizacion,
        marcarTodoElGrupo // 🆕 NUEVO: Para detectar marcado grupal
      } = req.body;
      
      const usuarioId = req.matrizador?.id;
      const usuarioNombre = req.matrizador?.nombre || 'Sistema';
      
      console.log(`🎯 [ARCHIVO - MARCAR LISTO] Procesando documento ${id}:`, {
        entrega_sin_verificar_pago,
        justificacion_entrega_sin_pago,
        accion_autorizacion,
        marcarTodoElGrupo,
        usuario: usuarioNombre
      });
      
      // Buscar el documento con información de grupo
      const documento = await Documento.findByPk(id, { 
        include: [
          { model: Matrizador, as: 'matrizador', attributes: ['id', 'nombre'] },
          { model: NotificacionGrupal, as: 'notificacionGrupal', required: false }
        ],
        transaction 
      });
      
      if (!documento) {
        await transaction.rollback();
        return res.status(404).json({ 
          success: false, 
          message: 'Documento no encontrado' 
        });
      }
      
      // Verificar que es documento propio
      if (documento.idMatrizador !== usuarioId) {
        await transaction.rollback();
        return res.status(403).json({ 
          success: false, 
          message: 'Solo puede marcar como listos sus propios documentos' 
        });
      }
      
      // Verificar que el documento esté en proceso
      if (documento.estado !== 'en_proceso') {
        await transaction.rollback();
        return res.status(400).json({ 
          success: false, 
          message: `El documento está en estado "${documento.estado}" y no puede marcarse como listo` 
        });
      }

      // ============== NUEVA LÓGICA: DETECCIÓN Y MANEJO DE GRUPOS ==============
      
      const documentoEstaEnGrupo = documento.notificacionGrupalId !== null;
      
      if (documentoEstaEnGrupo && marcarTodoElGrupo === true) {
        // CASO 1: Marcar todo el grupo como listo (solo documentos propios del archivo)
        console.log(`📋 [ARCHIVO - GRUPO] Marcando documentos propios del grupo ${documento.notificacionGrupalId} como listo`);
        
        // Obtener todos los documentos del grupo que pertenezcan al archivo actual
        const documentosDelGrupo = await Documento.findAll({
          where: {
            notificacionGrupalId: documento.notificacionGrupalId,
            idMatrizador: usuarioId, // Solo documentos propios del archivo
            estado: 'en_proceso'
          },
          transaction
        });
        
        console.log(`📋 [ARCHIVO - GRUPO] Encontrados ${documentosDelGrupo.length} documentos propios en el grupo para marcar`);
        
        // Generar UN SOLO código de verificación para todo el grupo
        const codigoVerificacionGrupal = Math.floor(1000 + Math.random() * 9000).toString();
        
        // Preparar datos de actualización
        const tieneAutorizacionCredito = entrega_sin_verificar_pago === true || entrega_sin_verificar_pago === 'true';
        
        const datosActualizacionGrupo = {
          estado: 'listo_para_entrega',
          entrega_sin_verificar_pago: tieneAutorizacionCredito,
          justificacion_entrega_sin_pago: tieneAutorizacionCredito ? justificacion_entrega_sin_pago : null,
          fecha_autorizacion_entrega: tieneAutorizacionCredito ? new Date() : null,
          autorizado_por_matrizador_id: tieneAutorizacionCredito ? usuarioId : null,
          codigoVerificacion: codigoVerificacionGrupal // MISMO CÓDIGO PARA TODOS
        };
        
        // Actualizar todos los documentos del grupo
        const documentosActualizados = [];
        
        for (const docGrupo of documentosDelGrupo) {
          await docGrupo.update(datosActualizacionGrupo, { transaction });
          
          // Crear evento para cada documento
          const detalleEventoGrupo = tieneAutorizacionCredito 
            ? `Documento marcado como listo en grupo ${documento.notificacionGrupalId}. ✅ CRÉDITO AUTORIZADO. Código grupal: ${codigoVerificacionGrupal}`
            : `Documento marcado como listo en grupo ${documento.notificacionGrupalId}. ⚠️ VERIFICAR PAGO. Código grupal: ${codigoVerificacionGrupal}`;
          
          await EventoDocumento.create({
            documentoId: docGrupo.id,
            tipo: 'documento_listo',
            detalles: detalleEventoGrupo,
            usuario: usuarioNombre,
            metadatos: {
              idUsuario: usuarioId,
              rolUsuario: 'archivo',
              procesamiento: 'grupal',
              grupoId: documento.notificacionGrupalId,
              codigoVerificacionGrupal: codigoVerificacionGrupal,
              totalDocumentosGrupo: documentosDelGrupo.length,
              entrega_sin_verificar_pago: tieneAutorizacionCredito,
              tipo_marcado: tieneAutorizacionCredito ? 'grupo_con_credito' : 'grupo_verificar_pago'
            }
          }, { transaction });
          
          documentosActualizados.push({
            id: docGrupo.id,
            codigoBarras: docGrupo.codigoBarras,
            esLider: docGrupo.esLiderGrupo
          });
        }
        
        await transaction.commit();
        
        console.log(`✅ [ARCHIVO - GRUPO] Documentos propios del grupo marcados como listos: ${documentosActualizados.length}`);
        
        // Enviar notificación grupal solo si hay documentos propios
        if (documentosActualizados.length > 0) {
          try {
            const documentoPrincipal = documentosDelGrupo[0];
            
            if (documentoPrincipal.telefonoCliente && !documentoPrincipal.omitirNotificacion) {
              const whatsappService = require('../services/whatsappService');
              
              const resultado = await whatsappService.enviarNotificacionGrupal(
                documentoPrincipal.telefonoCliente,
                documentosDelGrupo,
                codigoVerificacionGrupal
              );
              
              if (resultado.exito) {
                console.log(`📱 [ARCHIVO - GRUPO] Notificación grupal enviada para ${documentosDelGrupo.length} documentos propios`);
              } else {
                console.error(`❌ [ARCHIVO - GRUPO] Error en notificación grupal:`, resultado.error);
              }
            } else {
              console.log(`⏭️ [ARCHIVO - GRUPO] No se envió notificación: sin teléfono o notificación omitida`);
            }
          } catch (notificationError) {
            console.error('❌ [ARCHIVO - GRUPO] Error enviando notificación grupal:', notificationError);
          }
        }
        
        return res.json({
          success: true,
          message: `Documentos propios del grupo marcados como listos: ${documentosActualizados.length} documentos procesados`,
          tipoOperacion: 'grupo_propios',
          documento: {
            id: documento.id,
            codigoBarras: documento.codigoBarras,
            estado: 'listo_para_entrega',
            codigoVerificacionGrupal: codigoVerificacionGrupal,
            documentosEnGrupo: documentosActualizados.length
          }
        });
        
      } else if (documentoEstaEnGrupo && marcarTodoElGrupo !== true) {
        // CASO 2: Separar del grupo y marcar solo este documento
        console.log(`🔗 [ARCHIVO - SEPARAR] Separando documento ${id} del grupo antes de marcar como listo`);
        
        // Importar función de separación del matrizador
        const { separarDeGrupoNotificacion } = require('./matrizadorController');
        await separarDeGrupoNotificacion(parseInt(id), usuarioId);
        
        // Recargar documento después de separar
        await documento.reload({ transaction });
      }

      // CASO 3: Documento individual (o ya separado) - Proceder normalmente
      
      // Generar código de verificación de 4 dígitos ANTES de usarlo
      const codigoVerificacion = Math.floor(1000 + Math.random() * 9000).toString();
      
      // Preparar datos de actualización
      const tieneAutorizacionCredito = entrega_sin_verificar_pago === true || entrega_sin_verificar_pago === 'true';
      
      const datosActualizacion = {
        estado: 'listo_para_entrega',
        entrega_sin_verificar_pago: tieneAutorizacionCredito,
        justificacion_entrega_sin_pago: tieneAutorizacionCredito ? justificacion_entrega_sin_pago : null,
        fecha_autorizacion_entrega: tieneAutorizacionCredito ? new Date() : null,
        autorizado_por_matrizador_id: tieneAutorizacionCredito ? usuarioId : null,
        codigoVerificacion: codigoVerificacion // CRÍTICO: Guardar código en el documento
      };
      
      console.log(`✅ [ARCHIVO - MARCAR LISTO] Actualizando documento ${id}:`, datosActualizacion);
      
      // Actualizar documento
      await documento.update(datosActualizacion, { transaction });
      
      // Crear evento en historial
      const detalleEvento = tieneAutorizacionCredito 
        ? `Documento marcado como listo para entrega. ✅ CRÉDITO AUTORIZADO: Cliente puede retirar sin pago previo. Justificación: ${justificacion_entrega_sin_pago || 'No especificada'}. Código: ${codigoVerificacion}`
        : `Documento marcado como listo para entrega. ⚠️ VERIFICAR PAGO: Cliente debe completar pago antes de retirar. Código: ${codigoVerificacion}`;
      
      await EventoDocumento.create({
        documentoId: documento.id,
        tipo: 'documento_listo', // USAR TIPO VÁLIDO DEL ENUM
        detalles: detalleEvento,
        usuario: usuarioNombre,
        metadatos: {
          idUsuario: usuarioId,
          rolUsuario: req.matrizador?.rol || 'archivo',
          accion_autorizacion: accion_autorizacion,
          estado_anterior: 'en_proceso',
          estado_nuevo: 'listo_para_entrega',
          entrega_sin_verificar_pago: tieneAutorizacionCredito,
          justificacion_entrega_sin_pago: justificacion_entrega_sin_pago,
          tipo_marcado: tieneAutorizacionCredito ? 'con_credito' : 'verificar_pago',
          codigoVerificacion: codigoVerificacion,
          separadoDeGrupo: documentoEstaEnGrupo && marcarTodoElGrupo !== true
        }
      }, { transaction });
      
      await transaction.commit();
      
      // 📱 ENVIAR NOTIFICACIÓN WHATSAPP DESPUÉS DEL COMMIT
      let notificacionEnviada = false;
      try {
        if (documento.telefonoCliente && !documento.omitirNotificacion) {
          console.log(`📱 [ARCHIVO] Enviando notificación WhatsApp a ${documento.telefonoCliente}`);
          
          // Enviar notificación usando el servicio (que ya maneja todo internamente)
          const resultadoNotificacion = await NotificationService.enviarNotificacionDocumentoListo(documento.id);
          
          if (resultadoNotificacion.exito) {
            notificacionEnviada = true;
            console.log(`✅ [ARCHIVO] Notificación enviada exitosamente`);
          } else {
            console.error(`❌ [ARCHIVO] Error al enviar notificación:`, resultadoNotificacion.error);
          }
        } else {
          console.log(`⚠️ [ARCHIVO] No se envía notificación - Sin teléfono o notificaciones omitidas`);
        }
      } catch (errorNotificacion) {
        console.error('❌ [ARCHIVO] Error al enviar notificación:', errorNotificacion);
      }
      
      console.log(`🎉 [ARCHIVO] Documento ${id} marcado como listo exitosamente`);
      
      // Mensaje de respuesta personalizado según la configuración del documento
      let mensajeRespuesta = '';
      
      if (notificacionEnviada) {
        const estadoCredito = tieneAutorizacionCredito ? ' - CRÉDITO AUTORIZADO' : ' - VERIFICAR PAGO';
        mensajeRespuesta = `Documento marcado como listo y notificación enviada por WhatsApp${estadoCredito}`;
      } else {
        const estadoCredito = tieneAutorizacionCredito ? ' (CRÉDITO AUTORIZADO)' : ' (VERIFICAR PAGO)';
        if (documento.omitirNotificacion) {
          mensajeRespuesta = `Documento marcado como listo${estadoCredito}. No se envió notificación según configuración`;
        } else {
          mensajeRespuesta = `Documento marcado como listo${estadoCredito}. No se pudo enviar notificación por falta de teléfono`;
        }
      }
      
      res.json({
        success: true,
        message: mensajeRespuesta,
        tipoOperacion: 'individual',
        documento: {
          id: documento.id,
          codigoBarras: documento.codigoBarras,
          estado: 'listo_para_entrega',
          entrega_sin_verificar_pago: tieneAutorizacionCredito,
          justificacion_entrega_sin_pago: justificacion_entrega_sin_pago,
          codigoVerificacion: codigoVerificacion,
          notificacionEnviada: notificacionEnviada
        }
      });

    } catch (error) {
      await transaction.rollback();
      console.error('❌ [ARCHIVO] Error al marcar documento como listo:', error);
      res.status(500).json({
        success: false,
        message: `Error al marcar documento como listo: ${error.message}`
      });
    }
  },

  /**
   * Procesar entrega de documento (solo documentos propios)
   */
  entregarDocumento: async (req, res) => {
    const transaction = await sequelize.transaction();
    
    try {
      const documentoId = req.params.id;
      const documento = await Documento.findByPk(documentoId, {
        include: [
          {
            model: Matrizador,
            as: 'matrizador',
            attributes: ['id', 'nombre']
          }
        ]
      });

      if (!documento) {
        await transaction.rollback();
        return res.status(404).json({
          exito: false,
          mensaje: 'Documento no encontrado'
        });
      }

      // Verificar que sea documento propio
      if (documento.idMatrizador !== req.matrizador.id) {
        await transaction.rollback();
        return res.status(403).json({
          exito: false,
          mensaje: 'Solo puede entregar sus propios documentos'
        });
      }

      // Verificar que esté listo para entrega
      if (documento.estado !== 'listo_para_entrega') {
        await transaction.rollback();
        return res.status(400).json({
          exito: false,
          mensaje: 'El documento debe estar listo para entrega'
        });
      }

      // ✅ CORREGIDO: Primero extraer datos del body, luego validar
      const {
        nombreReceptor,
        identificacionReceptor,
        relacionReceptor,
        observacionesEntrega,
        codigoVerificacion
      } = req.body;

      // VALIDACIÓN CRÍTICA: Verificar código de verificación
      if (!codigoVerificacion) {
        await transaction.rollback();
        return res.status(400).json({
          exito: false,
          mensaje: 'El código de verificación es obligatorio'
        });
      }

      if (codigoVerificacion !== documento.codigoVerificacion) {
        await transaction.rollback();
        console.log(`❌ Código de verificación incorrecto para documento ${documento.codigoBarras}:`, {
          codigoRecibido: codigoVerificacion,
          codigoEsperado: documento.codigoVerificacion,
          usuario: req.matrizador.nombre
        });
        return res.status(400).json({
          exito: false,
          mensaje: 'El código de verificación no es correcto. Verifique con el cliente.'
        });
      }

      console.log(`✅ Código de verificación correcto para documento ${documento.codigoBarras}: ${codigoVerificacion}`);

      // Actualizar documento como entregado
      await documento.update({
        estado: 'entregado',
        fechaEntrega: new Date(),
        nombreReceptor,
        identificacionReceptor,
        relacionReceptor,
        notas: observacionesEntrega
      }, { transaction });

      // Registrar evento de entrega
      await EventoDocumento.create({
        documentoId: documento.id,
        tipo: 'entrega',
        descripcion: `Documento entregado a ${nombreReceptor} por ${req.matrizador.nombre}`,
        usuarioId: req.matrizador.id,
        detalles: {
          nombreReceptor,
          identificacionReceptor,
          relacionReceptor,
          fechaEntrega: new Date(),
          entregadoPor: req.matrizador.nombre
        }
      }, { transaction });

      await transaction.commit();

      // Enviar notificación de entrega (fuera de la transacción)
      try {
        // ✅ CORRECCIÓN: Usar función correcta del servicio centralizado
        await NotificationService.enviarNotificacionEntrega(documento.id, {
          nombreReceptor,
          identificacionReceptor,
          relacionReceptor,
          fechaEntrega: new Date(),
          entregadoPor: req.matrizador.nombre
        });
      } catch (notificationError) {
        console.error('❌ Error al enviar notificación de entrega:', notificationError);
        // No fallar la operación principal por error de notificación
      }

      if (req.headers.accept && req.headers.accept.includes('application/json')) {
        res.json({
          exito: true,
          mensaje: 'Documento entregado exitosamente'
        });
      } else {
        req.flash('success', 'Documento entregado exitosamente');
        res.redirect('/archivo/documentos/mis-documentos');
      }

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error al entregar documento:', error);
      
      if (req.headers.accept && req.headers.accept.includes('application/json')) {
        res.status(500).json({
          exito: false,
          mensaje: 'Error al entregar el documento'
        });
      } else {
        req.flash('error', 'Error al entregar el documento');
        res.redirect(`/archivo/documentos/entrega/${documentoId}`);
      }
    }
  },

  /**
   * Historial de notificaciones (solo de documentos propios)
   */
  historialNotificaciones: notificacionController.mostrarHistorial,

  /**
   * Obtener detalle completo de una notificación
   * Delega al notificacionController universal
   */
  obtenerDetalleNotificacion: require('./notificacionController').obtenerDetalleNotificacion,

  /**
   * 🆕 NUEVO: Editar sección específica del documento - INTEGRADO CON SISTEMA UNIVERSAL
   * Solo permite editar notas para documentos propios (según configuración de archivo)
   */
  editarSeccionDocumento: async (req, res) => {
    try {
      const { id } = req.params;
      const { seccion } = req.params;
      const userId = req.matrizador?.id;
      const userRole = 'archivo';
      
      console.log(`📝 [ARCHIVO] Editando sección ${seccion} del documento ${id} por usuario ${userId}`);
      
      // Verificar que sea documento propio
      const documento = await Documento.findByPk(id);
      if (!documento) {
        return res.status(404).json({
          success: false,
          message: 'Documento no encontrado'
        });
      }
      
      if (documento.idMatrizador !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Solo puede editar sus propios documentos'
        });
      }
      
      // Usar el controlador universal para la edición
      const DocumentoUniversalController = require('./documentoUniversalController');
      
      const resultado = await DocumentoUniversalController.editarSeccionPorRol(
        userRole,
        id,
        seccion,
        req.body,
        userId
      );
      
      res.json(resultado);
      
    } catch (error) {
      console.error(`❌ Error editando sección ${req.params.seccion}:`, error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  },

  /**
   * Buscar documentos del mismo cliente para documentos habilitantes
   */
  buscarDocumentosMismoCliente: async (req, res) => {
    try {
      const { identificacionCliente, documentoActualId } = req.query;
      
      if (!identificacionCliente) {
        return res.json({ error: 'Identificación del cliente requerida' });
      }

      // Buscar documentos del mismo cliente que sean del usuario archivo actual
      // Excluir el documento actual
      const whereConditions = {
        identificacionCliente: identificacionCliente,
        idMatrizador: req.matrizador.id // Solo mis documentos
      };

      if (documentoActualId) {
        whereConditions.id = { [Op.ne]: parseInt(documentoActualId) };
      }

      const documentos = await Documento.findAll({
        where: whereConditions,
        attributes: ['id', 'codigoBarras', 'tipoDocumento', 'estado', 'nombreCliente'],
        order: [['created_at', 'DESC']],
        limit: 10
      });

      res.json({ documentos });

    } catch (error) {
      console.error('❌ Error al buscar documentos del mismo cliente:', error);
      res.status(500).json({ error: 'Error al buscar documentos' });
    }
  },

  // ============== NUEVAS FUNCIONES PARA NOTIFICACIONES GRUPALES - ARCHIVO ==============

  /**
   * API: Detectar documentos del mismo cliente para agrupar en notificación
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  detectarDocumentosParaNotificacion: async (req, res) => {
    try {
      const { documentoId } = req.params;
      const archivoId = req.matrizador?.id;

      if (!documentoId) {
        return res.status(400).json({
          exito: false,
          mensaje: 'ID de documento requerido'
        });
      }

      // Obtener el documento actual y verificar que sea propio
      const documento = await Documento.findOne({
        where: {
          id: documentoId,
          idMatrizador: archivoId // Solo documentos propios
        }
      });

      if (!documento) {
        return res.status(404).json({
          exito: false,
          mensaje: 'Documento no encontrado o no tiene permisos'
        });
      }

      // Reutilizar la función del matrizador para archivo
      const { detectarDocumentosParaNotificacionGrupal } = require('./matrizadorController');
      const deteccion = await detectarDocumentosParaNotificacionGrupal(
        documento.identificacionCliente,
        parseInt(documentoId),
        archivoId
      );

      return res.status(200).json({
        exito: true,
        datos: deteccion,
        mensaje: deteccion.tieneDocumentosAdicionales 
          ? `Se encontraron ${deteccion.totalDisponibles || deteccion.documentosEnGrupo?.length || 0} documentos adicionales propios`
          : 'No se encontraron documentos adicionales para agrupar'
      });

    } catch (error) {
      console.error('Error detectando documentos para notificación grupal (archivo):', error);
      return res.status(500).json({
        exito: false,
        mensaje: 'Error interno del servidor',
        error: error.message
      });
    }
  },

  /**
   * API: Crear grupo de notificación con documentos seleccionados (solo documentos propios)
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  crearGrupoNotificacion: async (req, res) => {
    try {
      const { documentoLiderId, documentosIds } = req.body;
      const archivoId = req.matrizador?.id;

      if (!documentoLiderId || !Array.isArray(documentosIds)) {
        return res.status(400).json({
          exito: false,
          mensaje: 'Parámetros requeridos: documentoLiderId y array documentosIds'
        });
      }

      // Verificar que el documento líder sea propio
      const documentoLider = await Documento.findOne({
        where: {
          id: documentoLiderId,
          idMatrizador: archivoId
        }
      });

      if (!documentoLider) {
        return res.status(403).json({
          exito: false,
          mensaje: 'El documento líder no pertenece al archivo'
        });
      }

      // Reutilizar la función del matrizador
      const { crearGrupoNotificacion } = require('./matrizadorController');
      const resultado = await crearGrupoNotificacion(
        parseInt(documentoLiderId),
        documentosIds.map(id => parseInt(id)),
        archivoId
      );

      return res.status(200).json({
        exito: true,
        datos: resultado,
        mensaje: `Grupo de notificación creado exitosamente con ${resultado.documentosAgrupados} documentos propios`
      });

    } catch (error) {
      console.error('Error creando grupo de notificación (archivo):', error);
      return res.status(500).json({
        exito: false,
        mensaje: 'Error creando grupo de notificación',
        error: error.message
      });
    }
  },

  /**
   * API: Separar documento de su grupo de notificación (solo documentos propios)
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  separarDeGrupoNotificacion: async (req, res) => {
    try {
      const { documentoId } = req.params;
      const archivoId = req.matrizador?.id;

      if (!documentoId) {
        return res.status(400).json({
          exito: false,
          mensaje: 'ID de documento requerido'
        });
      }

      // Verificar que el documento sea propio
      const documento = await Documento.findOne({
        where: {
          id: documentoId,
          idMatrizador: archivoId
        }
      });

      if (!documento) {
        return res.status(403).json({
          exito: false,
          mensaje: 'El documento no pertenece al archivo'
        });
      }

      // Reutilizar la función del matrizador
      const { separarDeGrupoNotificacion } = require('./matrizadorController');
      const resultado = await separarDeGrupoNotificacion(
        parseInt(documentoId),
        archivoId
      );

      return res.status(200).json({
        exito: true,
        datos: resultado,
        mensaje: 'Documento separado del grupo exitosamente'
      });

    } catch (error) {
      console.error('Error separando documento del grupo (archivo):', error);
      return res.status(500).json({
        exito: false,
        mensaje: 'Error separando documento del grupo',
        error: error.message
      });
    }
  },

  /**
   * API para detectar documentos grupales del mismo cliente (ARCHIVO - CON RESTRICCIONES SIMILARES A MATRIZADOR)
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
      
      // Reutilizar la función del matrizador (archivo funciona igual que matrizador)
      const { detectarDocumentosGrupalesMatrizador } = require('./matrizadorController');
      const documentosGrupales = await detectarDocumentosGrupalesMatrizador(
        identificacion, 
        parseInt(documentoId),
        req.matrizador.id
      );
      
      return res.status(200).json({
        exito: true,
        datos: documentosGrupales,
        mensaje: `Detectados ${documentosGrupales.documentosPropios.length} documentos propios`
      });
      
    } catch (error) {
      console.error('Error en API detectar documentos grupales archivo:', error);
      return res.status(500).json({
        exito: false,
        mensaje: 'Error al detectar documentos grupales',
        error: error.message
      });
    }
  },

  /**
   * Procesa entrega grupal específica (ARCHIVO - SOLO DOCUMENTOS PROPIOS)
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
          mensaje: 'Documento principal no encontrado o no pertenece al archivo'
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
      
      // Reutilizar la función del matrizador (archivo funciona igual)
      const { procesarEntregaGrupalMatrizador } = require('./matrizadorController');
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
          tipoEntrega: 'archivo_limitada',
          soloDocumentosPropiios: true
        }
      });
      
    } catch (error) {
      await transaction.rollback();
      console.error('Error en procesamiento entrega grupal archivo:', error);
      return res.status(500).json({
        exito: false,
        mensaje: 'Error al procesar entrega grupal',
        error: error.message
      });
    }
  }
};

/**
 * Mapea valores del formulario a valores correctos del enum de estado
 */
function mapearEstadoFormulario(estadoFormulario) {
  const mapeoEstados = {
    // Valores del formulario → Valores del enum en BD
    'borrador': 'en_proceso',      // Borrador se considera en proceso
    'proceso': 'en_proceso',       // En proceso
    'en_proceso': 'en_proceso',    // Ya correcto
    'listo': 'listo_para_entrega', // Listo para entrega
    'listo_para_entrega': 'listo_para_entrega', // Ya correcto
    'entregado': 'entregado',      // Entregado
    'cancelado': 'cancelado',      // Cancelado
    'eliminado': 'eliminado',      // Eliminado
    'nota_credito': 'nota_credito' // Nota de crédito
  };
  
  const estadoMapeado = mapeoEstados[estadoFormulario];
  
  if (estadoMapeado) {
    console.log(`🔄 Mapeo de estado: '${estadoFormulario}' → '${estadoMapeado}'`);
    return estadoMapeado;
  } else {
    console.warn(`⚠️ Estado no reconocido: '${estadoFormulario}', valores válidos:`, Object.keys(mapeoEstados));
    return null;
  }
}

/**
 * Mapea valores del formulario a valores correctos del enum de estado de pago
 */
function mapearEstadoPagoFormulario(estadoPagoFormulario) {
  const mapeoEstadosPago = {
    'pendiente': 'pendiente',
    'pago_parcial': 'pago_parcial',
    'parcial': 'pago_parcial',
    'pagado_completo': 'pagado_completo',
    'pagado': 'pagado_completo',
    'completo': 'pagado_completo',
    'pagado_con_retencion': 'pagado_con_retencion',
    'retencion': 'pagado_con_retencion'
  };
  
  const estadoPagoMapeado = mapeoEstadosPago[estadoPagoFormulario];
  
  if (estadoPagoMapeado) {
    console.log(`🔄 Mapeo de estado de pago: '${estadoPagoFormulario}' → '${estadoPagoMapeado}'`);
    return estadoPagoMapeado;
  } else {
    console.warn(`⚠️ Estado de pago no reconocido: '${estadoPagoFormulario}', valores válidos:`, Object.keys(mapeoEstadosPago));
    return null;
  }
}

/**
 * Función auxiliar para obtener estadísticas solo de documentos del archivo
 */
async function obtenerEstadisticasArchivo(matrizadorId) {
  try {
    const whereCondition = { idMatrizador: matrizadorId };
    
    const [
      totalDocumentos,
      documentosPendientes,
      documentosListos,
      documentosEntregados,
      documentosCancelados
    ] = await Promise.all([
      Documento.count({ where: whereCondition }),
      Documento.count({ where: { ...whereCondition, estado: 'en_proceso' } }),
      Documento.count({ where: { ...whereCondition, estado: 'listo_para_entrega' } }),
      Documento.count({ where: { ...whereCondition, estado: 'entregado' } }),
      Documento.count({ where: { ...whereCondition, estado: 'cancelado' } })
    ]);

    return {
      totalDocumentos,
      documentosPendientes,
      documentosListos,
      documentosEntregados,
      documentosCancelados
    };
  } catch (error) {
    console.error('❌ Error al obtener estadísticas de archivo:', error);
    return {
      totalDocumentos: 0,
      documentosPendientes: 0,
      documentosListos: 0,
      documentosEntregados: 0,
      documentosCancelados: 0
    };
  }
}

/**
 * Función auxiliar para obtener estadísticas globales del sistema (para rol archivo)
 */
async function obtenerEstadisticasGlobalesArchivo() {
  try {
    console.log('📊 Calculando estadísticas globales para archivo...');
    
    const [
      totalDocumentos,
      documentosPendientes,
      documentosListos,
      documentosEntregados,
      documentosCancelados
    ] = await Promise.all([
      Documento.count(),
      Documento.count({ where: { estado: 'en_proceso' } }),
      Documento.count({ where: { estado: 'listo_para_entrega' } }),
      Documento.count({ where: { estado: 'entregado' } }),
      Documento.count({ where: { estado: 'cancelado' } })
    ]);

    console.log('📊 Estadísticas globales calculadas:', {
      totalDocumentos,
      documentosPendientes,
      documentosListos,
      documentosEntregados,
      documentosCancelados
    });

    return {
      totalDocumentos,
      documentosPendientes,
      documentosListos,
      documentosEntregados,
      documentosCancelados
    };
  } catch (error) {
    console.error('❌ Error al obtener estadísticas globales de archivo:', error);
    return {
      totalDocumentos: 0,
      documentosPendientes: 0,
      documentosListos: 0,
      documentosEntregados: 0,
      documentosCancelados: 0
    };
  }
}

/**
 * Calcula estadísticas adicionales para archivo basadas en documentos atrasados
 */
async function calcularEstadisticasAdicionales(documentosAtrasados) {
  try {
    console.log('📈 Calculando estadísticas adicionales para archivo...');
    
    // 1. Calcular tiempo promedio de procesamiento de documentos completados en últimos 30 días
    const fechaTreintaDiasAtras = new Date();
    fechaTreintaDiasAtras.setDate(fechaTreintaDiasAtras.getDate() - 30);
    
    const documentosCompletados = await Documento.findAll({
      where: {
        estado: {
          [Op.in]: ['listo_para_entrega', 'entregado']
        },
        updated_at: {
          [Op.gte]: fechaTreintaDiasAtras
        }
      },
      attributes: ['created_at', 'updated_at']
    });
    
    let promedioTiempos = 0;
    if (documentosCompletados.length > 0) {
      const totalDias = documentosCompletados.reduce((sum, doc) => {
        const inicio = new Date(doc.created_at);
        const fin = new Date(doc.updated_at);
        const dias = Math.floor((fin - inicio) / (1000 * 60 * 60 * 24));
        return sum + dias;
      }, 0);
      promedioTiempos = Math.round(totalDias / documentosCompletados.length);
    }
    
    // 2. Encontrar matrizador con más atrasos
    let matrizadorMasAtrasos = null;
    if (documentosAtrasados.length > 0) {
      const conteoMatrizadores = {};
      documentosAtrasados.forEach(doc => {
        const matrizador = doc.matrizador.nombre;
        conteoMatrizadores[matrizador] = (conteoMatrizadores[matrizador] || 0) + 1;
      });
      
      const matrizadorTop = Object.entries(conteoMatrizadores)
        .sort(([,a], [,b]) => b - a)[0];
      
      if (matrizadorTop) {
        matrizadorMasAtrasos = {
          nombre: matrizadorTop[0],
          cantidad: matrizadorTop[1]
        };
      }
    }
    
    // 3. Estadísticas por prioridad
    const estadisticasPrioridad = {
      critica: documentosAtrasados.filter(doc => doc.prioridad === 'Crítica').length,
      alta: documentosAtrasados.filter(doc => doc.prioridad === 'Alta').length,
      media: documentosAtrasados.filter(doc => doc.prioridad === 'Media').length
    };
    
    const estadisticas = {
      promedioTiempos,
      matrizadorMasAtrasos,
      estadisticasPrioridad,
      documentosCompletadosUltimos30Dias: documentosCompletados.length
    };
    
    console.log('📈 Estadísticas adicionales calculadas:', estadisticas);
    
    return estadisticas;
  } catch (error) {
    console.error('❌ Error al calcular estadísticas adicionales:', error);
    return {
      promedioTiempos: 0,
      matrizadorMasAtrasos: null,
      estadisticasPrioridad: { critica: 0, alta: 0, media: 0 },
      documentosCompletadosUltimos30Dias: 0
    };
  }
}

module.exports = archivoController; 