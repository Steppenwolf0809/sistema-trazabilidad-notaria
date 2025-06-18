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

// Importar servicios de notificación
const notificationService = require('../services/notificationService');

const archivoController = {

  /**
   * Dashboard principal del archivo
   * Muestra documentos atrasados de TODOS los matrizadores (función supervisora)
   */
  dashboard: async (req, res) => {
    try {
      console.log('🗂️ Acceso al dashboard de archivo:', req.matrizador?.nombre);
      
      // 1. OBTENER ESTADÍSTICAS GLOBALES DEL SISTEMA (para rol archivo)
      const estadisticas = await obtenerEstadisticasGlobalesArchivo();
      
      // 2. CONSULTA PRINCIPAL: Documentos atrasados (más de 15 días en proceso)
      // Archivo puede ver TODOS los documentos del sistema como supervisor
      const fechaLimite = new Date();
      fechaLimite.setDate(fechaLimite.getDate() - 15);
      
      const documentosAtrasados = await Documento.findAll({
        where: {
          estado: 'en_proceso', // Solo documentos en proceso
          created_at: {
            [Op.lt]: fechaLimite  // Más de 15 días desde creación
          }
        },
        include: [
          {
            model: Matrizador,
            as: 'matrizador',
            attributes: ['id', 'nombre'],
            required: false // LEFT JOIN para incluir documentos sin matrizador
          }
        ],
        order: [['created_at', 'ASC']], // Más antiguos primero
        limit: 50, // Límite para rendimiento
        attributes: [
          'id', 'codigoBarras', 'tipoDocumento', 'nombreCliente', 
          'created_at', 'idMatrizador', 'fechaFactura'
        ]
      });

      // 3. PROCESAR DATOS PARA VISTA
      const documentosConDias = documentosAtrasados.map(doc => {
        const fechaCreacion = new Date(doc.created_at);
        const hoy = new Date();
        const diasTranscurridos = Math.floor((hoy - fechaCreacion) / (1000 * 60 * 60 * 24));
        
        // Extraer número de libro del código de barras
        // Formato ejemplo: 20251701018D00531
        // Año: 2025, Libro: 701018 (posiciones 4-10)
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
          matrizador: {
            nombre: doc.matrizador ? doc.matrizador.nombre : 'Sin asignar',
            id: doc.matrizador ? doc.matrizador.id : null
          },
          // Clasificación de prioridad según días
          prioridad: diasTranscurridos > 30 ? 'Crítica' : 
                    diasTranscurridos > 20 ? 'Alta' : 'Media',
          clasePrioridad: diasTranscurridos > 30 ? 'danger' : 
                         diasTranscurridos > 20 ? 'warning' : 'info'
        };
      });

      // 4. ESTADÍSTICAS ADICIONALES PARA ARCHIVO
      const estadisticasAdicionales = await calcularEstadisticasAdicionales(documentosConDias);

      res.render('archivo/dashboard', {
        layout: 'archivo',
        title: 'Dashboard de Archivo',
        estadisticas,
        alertasDocumentos: documentosConDias, // Cambiar nombre para compatibilidad
        documentosAtrasados: documentosConDias,
        totalAtrasados: documentosConDias.length,
        estadisticasAdicionales,
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre,
        userId: req.matrizador?.id
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

      // Obtener documentos con paginación
      const { count, rows: documentos } = await Documento.findAndCountAll({
        where: whereConditions,
        include: [
          {
            model: Matrizador,
            as: 'matrizador',
            attributes: ['id', 'nombre']
          }
        ],
        order: [['updated_at', 'DESC']],
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
      const limit = parseInt(req.query.limit) || 25;
      const offset = (page - 1) * limit;

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

      const { count, rows: documentos } = await Documento.findAndCountAll({
        where: whereConditions,
        include: [
          {
            model: Matrizador,
            as: 'matrizador',
            attributes: ['id', 'nombre']
          }
        ],
        order: [['updated_at', 'DESC']],
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
   * Ver detalle de cualquier documento
   * Solo lectura para documentos ajenos, edición para propios
   */
  verDetalleDocumento: async (req, res) => {
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

      // Obtener eventos del documento con información completa
      const eventos = await EventoDocumento.findAll({
        where: { documentoId },
        include: [
          {
            model: Matrizador,
            as: 'matrizador',
            attributes: ['id', 'nombre']
          }
        ],
        order: [['created_at', 'DESC']],
        attributes: ['id', 'tipo', 'descripcion', 'detalles', 'created_at', 'usuarioId']
      });

      // Verificar si es documento propio (puede editar) o ajeno (solo lectura)
      const esDocumentoPropio = documento.idMatrizador === req.matrizador.id;

      res.render('archivo/documentos/detalle', {
        layout: 'archivo',
        title: `Documento ${documento.codigoBarras || documento.id}`,
        documento,
        eventos,
        esDocumentoPropio,
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

      // Crear el documento asignado al usuario archivo actual
      const nuevoDocumento = await Documento.create({
        tipoDocumento,
        nombreCliente: clienteNombre,
        identificacionCliente: clienteIdentificacion,
        telefonoCliente: clienteTelefono,
        emailCliente: clienteEmail,
        valorFactura: parseFloat(valorFactura) || 0,
        valorPendiente: parseFloat(valorFactura) || 0,
        notas: observaciones,
        estado: 'en_proceso',
        estadoPago: 'pendiente',
        idMatrizador: req.matrizador.id,
        idUsuarioCreador: req.matrizador.id,
        rolUsuarioCreador: 'archivo',
        codigoBarras: `ARC-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`
      }, { transaction });

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
   * Marcar documento como listo (solo documentos propios)
   */
  marcarComoListo: async (req, res) => {
    const transaction = await sequelize.transaction();
    
    try {
      const documentoId = req.params.id;
      
      // Verificar que el documento existe y es del usuario
      const documento = await Documento.findOne({
        where: {
          id: documentoId,
          idMatrizador: req.matrizador.id // Solo documentos propios
        },
        transaction
      });

      if (!documento) {
        await transaction.rollback();
        return res.status(404).json({
          exito: false,
          mensaje: 'Documento no encontrado o no tienes permisos para modificarlo'
        });
      }

      // Verificar que el documento está en estado 'en_proceso'
      if (documento.estado !== 'en_proceso') {
        await transaction.rollback();
        return res.status(400).json({
          exito: false,
          mensaje: 'Solo se pueden marcar como listos los documentos en proceso'
        });
      }

      // ============== GENERACIÓN CONDICIONAL DE CÓDIGO DE VERIFICACIÓN - SOLO WHATSAPP ==============
      
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
        console.log(`✅ [ARCHIVO] Generando código de verificación: ${codigoVerificacion} para documento ${documento.codigoBarras}`);
      } else {
        // No generar código en estos casos:
        // - Omitir notificación activado
        // - Sin número de teléfono del cliente
        // - Entrega inmediata
        codigoVerificacion = null;
        
        if (documento.omitirNotificacion) {
          mensajeNotificacion = 'Sin código - notificación omitida por configuración';
          console.log(`⏭️ [ARCHIVO] No se generará código para documento ${documento.codigoBarras}: notificación omitida`);
        } else if (esEntregaInmediata) {
          mensajeNotificacion = 'Sin código - entrega inmediata configurada';
          console.log(`⚡ [ARCHIVO] No se generará código para documento ${documento.codigoBarras}: entrega inmediata`);
        } else {
          mensajeNotificacion = 'Sin código - falta número de teléfono del cliente';
          console.log(`⚠️ [ARCHIVO] No se generará código para documento ${documento.codigoBarras}: sin teléfono`);
        }
      }
      
      // Actualizar el estado y código
      await documento.update({
        estado: 'listo_para_entrega',
        codigoVerificacion: codigoVerificacion // Puede ser null
      }, { transaction });

      // Crear evento de cambio de estado
      await EventoDocumento.create({
        documentoId: documento.id,
        tipo: 'estado',
        descripcion: `Documento marcado como listo para entrega por ${req.matrizador.nombre} - Código: ${codigoVerificacion}`,
        usuarioId: req.matrizador.id,
        detalles: {
          estadoAnterior: 'en_proceso',
          estadoNuevo: 'listo_para_entrega',
          usuario: req.matrizador.nombre,
          codigoVerificacion: codigoVerificacion
        }
      }, { transaction });

      await transaction.commit();

      console.log(`✅ Documento ${documento.codigoBarras} marcado como listo por ${req.matrizador.nombre}`);

      // Enviar notificación después de confirmar la transacción
      try {
        // Solo enviar notificación si se generó código
        if (codigoVerificacion) {
          console.log(`🔔 [ARCHIVO] Enviando notificación para documento ${documento.codigoBarras}`);
          
          // Recargar documento con datos actualizados para notificación
          const documentoActualizado = await Documento.findByPk(documentoId);
          
          const resultadoNotificacion = await notificationService.enviarNotificacionDocumentoListo(documentoActualizado.id);
          
          console.log('✅ [ARCHIVO] Notificación procesada para documento', documentoActualizado.codigoBarras);
          console.log('   Canales enviados:', resultadoNotificacion.canalesEnviados || 'ninguno');
          console.log('   Errores:', resultadoNotificacion.errores?.length || 0);
          
          if (resultadoNotificacion.canalesEnviados && resultadoNotificacion.canalesEnviados.length > 0) {
            console.log(`📱 [ARCHIVO] NOTIFICACIÓN ENVIADA: Código ${codigoVerificacion} enviado por ${resultadoNotificacion.canalesEnviados.join(' y ')} al cliente ${documentoActualizado.nombreCliente}`);
          } else {
            console.log(`❌ [ARCHIVO] NOTIFICACIÓN FALLÓ: No se pudo enviar por ningún canal configurado`);
            if (resultadoNotificacion.errores && resultadoNotificacion.errores.length > 0) {
              resultadoNotificacion.errores.forEach(error => {
                console.log(`   - Error en ${error.canal}: ${error.error}`);
              });
            }
          }
        } else {
          console.log(`⏭️ [ARCHIVO] NO SE ENVIÓ NOTIFICACIÓN: ${mensajeNotificacion} para documento ${documento.codigoBarras}`);
        }
      } catch (notificationError) {
        console.error('❌ [ARCHIVO] Error al enviar notificación de documento listo:', notificationError);
        // No afectar el flujo principal si falla la notificación
      }

      // Mensaje de respuesta personalizado según la configuración del documento
      let mensajeRespuesta = '';
      
      if (codigoVerificacion) {
        mensajeRespuesta = 'Documento marcado como listo y notificación enviada por WhatsApp';
      } else {
        if (documento.omitirNotificacion) {
          mensajeRespuesta = 'Documento marcado como listo. No se envió notificación según configuración';
        } else if (esEntregaInmediata) {
          mensajeRespuesta = 'Documento marcado como listo para entrega inmediata';
        } else {
          mensajeRespuesta = 'Documento marcado como listo. No se pudo enviar notificación por falta de teléfono';
        }
      }

      res.json({
        exito: true,
        mensaje: mensajeRespuesta,
        codigoVerificacion: codigoVerificacion
      });

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error al marcar documento como listo:', error);
      res.status(500).json({
        exito: false,
        mensaje: 'Error interno del servidor'
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

      const {
        nombreReceptor,
        identificacionReceptor,
        relacionReceptor,
        observacionesEntrega,
        codigoVerificacion
      } = req.body;

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
        await notificationService.enviarNotificacionEntregaConfirmada(documento, {
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
      if (tipo) whereClause.tipoEvento = tipo;
      if (canal && canal !== '') {
        whereClause.canal = canal;
      }
      
      // Búsqueda por texto
      if (busqueda && busqueda.trim() !== '') {
        const textoBusqueda = busqueda.trim();
        documentoWhereClause[Op.or] = [
          { codigoBarras: { [Op.iLike]: `%${textoBusqueda}%` } },
          { nombreCliente: { [Op.iLike]: `%${textoBusqueda}%` } },
          { numeroFactura: { [Op.iLike]: `%${textoBusqueda}%` } },
          { identificacionCliente: { [Op.iLike]: `%${textoBusqueda}%` } }
        ];
      }

      // Solo notificaciones de documentos propios
      const notificaciones = await NotificacionEnviada.findAll({
        where: {
          tipoEvento: {
            [Op.in]: ['documento_listo', 'entrega_confirmada', 'entrega_grupal', 'recordatorio', 'alerta_sin_recoger']
          },
          ...whereClause
        },
        include: [{
          model: Documento,
          as: 'documento',
          where: documentoWhereClause,
          attributes: [
            'id', 
            'codigoBarras', 
            'nombreCliente', 
            'tipoDocumento',
            'emailCliente',
            'telefonoCliente',
            'numeroFactura',
            'identificacionCliente',
            'idMatrizador',
            'estado'
          ],
          include: [{
            model: Matrizador,
            as: 'matrizador',
            attributes: ['id', 'nombre', 'email'],
            required: false
          }],
          required: false
        }],
        order: [['created_at', 'DESC']],
        limit: 50
      });

      // Procesar notificaciones para vista
      const notificacionesProcesadas = notificaciones.map(notif => {
        const notifData = notif.toJSON ? notif.toJSON() : notif;
        
        // Asegurar fechas en formato ISO
        if (notifData.created_at) {
          notifData.created_at = new Date(notifData.created_at).toISOString();
        }
        
        // Asegurar metadatos
        if (!notifData.metadatos) {
          notifData.metadatos = {};
        }
        
        // Mapear campos para compatibilidad con vista
        notifData.tipo = notifData.tipoEvento;
        notifData.detalles = notifData.mensajeEnviado || 'Notificación enviada';
        notifData.usuario = notifData.metadatos?.entregadoPor || req.matrizador?.nombre || 'Sistema';
        
        // Agregar información de canal al metadatos
        if (!notifData.metadatos.canal) {
          notifData.metadatos.canal = notifData.canal;
        }
        if (!notifData.metadatos.estado) {
          notifData.metadatos.estado = notifData.estado;
        }
        
        // Corregir información del matrizador
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
        
        return notifData;
      });

      // Calcular estadísticas
      const stats = {
        total: notificaciones.length,
        enviadas: notificaciones.filter(n => n.estado === 'enviado').length,
        fallidas: notificaciones.filter(n => n.estado === 'fallido').length,
        pendientes: notificaciones.filter(n => n.estado === 'pendiente').length
      };

      res.render('archivo/notificaciones/historial', {
        layout: 'archivo',
        title: 'Historial de Notificaciones',
        notificaciones: notificacionesProcesadas,
        stats,
        filtros: { fechaDesde, fechaHasta, tipo, canal, busqueda },
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre,
        userId: req.matrizador?.id
      });

    } catch (error) {
      console.error('❌ Error al obtener historial de notificaciones:', error);
      res.status(500).render('error', {
        layout: 'archivo',
        title: 'Error',
        message: 'Error al cargar el historial de notificaciones',
        error
      });
    }
  },

  /**
   * Obtener detalle completo de una notificación
   */
  obtenerDetalleNotificacion: async (req, res) => {
    try {
      const notificacionId = req.params.id;
      
      // Primero obtener la notificación
      const notificacion = await NotificacionEnviada.findByPk(notificacionId);
      
      if (!notificacion || !notificacion.documentoId) {
        return res.status(404).json({
          error: 'Notificación no encontrada'
        });
      }
      
      // Luego verificar que el documento pertenece al usuario
      const documento = await Documento.findOne({
        where: {
          id: notificacion.documentoId,
          idMatrizador: req.matrizador.id // Solo documentos propios
        },
        attributes: ['id', 'codigoBarras', 'nombreCliente', 'tipoDocumento', 'codigoVerificacion']
      });

      if (!documento) {
        return res.status(404).json({
          error: 'Notificación no encontrada o no autorizada'
        });
      }

      res.json({
        id: notificacion.id,
        documentoId: notificacion.documentoId,
        documento: {
          codigoBarras: documento.codigoBarras,
          nombreCliente: documento.nombreCliente,
          tipoDocumento: documento.tipoDocumento,
          codigoVerificacion: documento.codigoVerificacion
        },
        tipoEvento: notificacion.tipoEvento,
        canal: notificacion.canal,
        destinatario: notificacion.destinatario,
        estado: notificacion.estado,
        mensajeEnviado: notificacion.mensajeEnviado,
        intentos: notificacion.intentos,
        ultimoError: notificacion.ultimoError,
        metadatos: notificacion.metadatos,
        fechaEnvio: notificacion.created_at,
        proximoIntento: notificacion.proximoIntento
      });

    } catch (error) {
      console.error('❌ Error al obtener detalle de notificación:', error);
      res.status(500).json({
        error: 'Error al obtener el detalle de la notificación'
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