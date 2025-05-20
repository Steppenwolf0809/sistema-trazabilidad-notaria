const Documento = require('../models/Documento');
const Matrizador = require('../models/Matrizador');
const EventoDocumento = require('../models/EventoDocumento');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');
const moment = require('moment');

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
        order: [['updated_at', 'DESC']],
        limit: 10
      });
      
      // Obtener últimos documentos entregados
      const ultimasEntregas = await Documento.findAll({
        where: {
          estado: 'entregado'
        },
        order: [['fecha_entrega', 'DESC']],
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
      const tipoDocumento = req.query.tipoDocumento || '';
      const idMatrizador = req.query.idMatrizador || '';
      const busqueda = req.query.busqueda || '';
      
      // Construir condiciones de filtrado
      const where = {};
      
      if (estado) {
        where.estado = estado;
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
        order: [['updated_at', 'DESC']],
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
      
      // Buscar el documento sin restricción de matrizador
      const documento = await Documento.findOne({
        where: { id },
        include: [
          {
            model: Matrizador,
            as: 'matrizador',
            attributes: ['id', 'nombre']
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
      
      console.log("Documento encontrado:", documento.id, documento.codigoBarras);
      
      // Obtener historial del documento
      const historial = await EventoDocumento.findAll({
        where: { idDocumento: documento.id },
        order: [['createdAt', 'DESC']]
      });
      
      res.render('recepcion/documentos/detalle', {
        layout: 'recepcion',
        title: 'Detalle de Documento',
        documento,
        historial,
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
        
        return res.render('recepcion/documentos/entrega', {
          layout: 'recepcion',
          title: 'Entrega de Documento',
          documento,
          userRole: req.matrizador?.rol,
          userName: req.matrizador?.nombre
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
        whereClause.fechaCreacion = {};
        
        if (fechaDesde) {
          whereClause.fechaCreacion[Op.gte] = new Date(fechaDesde);
        }
        
        if (fechaHasta) {
          // Sumar un día a la fecha hasta para incluir todo el día seleccionado
          const fechaHastaObj = new Date(fechaHasta);
          fechaHastaObj.setDate(fechaHastaObj.getDate() + 1);
          whereClause.fechaCreacion[Op.lt] = fechaHastaObj;
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
        order: [['updated_at', 'DESC']],
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
      const { codigoVerificacion, nombreReceptor, identificacionReceptor, relacionReceptor, tipoVerificacion, observaciones } = req.body;
      
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
      
      // Verificar código a menos que sea verificación por llamada
      if (tipoVerificacion !== 'llamada' && documento.codigoVerificacion !== codigoVerificacion) {
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
          idDocumento: documento.id,
          tipo: 'entrega',
          detalles,
          usuario: req.matrizador.nombre
        }, { transaction });
      } catch (eventError) {
        console.error('Error al registrar evento de entrega:', eventError);
        // Continuar con la transacción aunque el registro de eventos falle
      }
      
      await transaction.commit();
      
      req.flash('success', `El documento ha sido entregado exitosamente a ${nombreReceptor}.`);
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
      const { idDocumento } = req.body;
      const usuario = req.matrizador || req.usuario; // Usuario autenticado (debe ser recepcion)

      if (!idDocumento) {
        await transaction.rollback();
        req.flash('error', 'ID de documento no proporcionado.');
        return res.redirect('/recepcion/documentos');
      }

      const documento = await Documento.findByPk(idDocumento, { transaction });

      if (!documento) {
        await transaction.rollback();
        req.flash('error', 'Documento no encontrado.');
        return res.redirect('/recepcion/documentos');
      }

      if (documento.estado !== 'en_proceso') {
        await transaction.rollback();
        req.flash('error', 'Solo se pueden marcar como listos documentos en estado \'En Proceso\'.');
        return res.redirect('/recepcion/documentos/detalle/' + idDocumento);
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

      await EventoDocumento.create({
        idDocumento: documento.id,
        tipo: 'cambio_estado',
        detalles: `Documento marcado como LISTO PARA ENTREGA por ${usuario.nombre || 'Recepción'} (${usuario.rol}). Código generado: ${codigoVerificacion}.`,
        usuario: usuario.nombre || 'Recepción',
        metadatos: {
          idUsuario: usuario.id,
          rolUsuario: usuario.rol,
          codigoGenerado: codigoVerificacion
        }
      }, { transaction });

      await transaction.commit();

      // Simular envío de notificación al cliente (si aplica desde recepción)
      console.log(`NOTIFICACIÓN (RECEPCIÓN): Código ${codigoVerificacion} para cliente ${documento.nombreCliente} del doc ${documento.codigoBarras}`);

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
        idDocumento: documento.id,
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
};

module.exports = recepcionController; 