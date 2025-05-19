const Documento = require('../models/Documento');
const Matrizador = require('../models/Matrizador');
const EventoDocumento = require('../models/EventoDocumento');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');

const recepcionController = {
  dashboard: (req, res) => {
    console.log("Accediendo al dashboard de recepción");
    console.log("Usuario:", req.matrizador?.nombre, "Rol:", req.matrizador?.rol);
    console.log("Ruta solicitada:", req.originalUrl);
    res.render('recepcion/dashboard', { layout: 'recepcion', title: 'Panel de Recepción', userRole: req.matrizador?.rol, userName: req.matrizador?.nombre });
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
        userName: req.matrizador?.nombre
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
          userName: req.matrizador?.nombre
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
        userName: req.matrizador?.nombre
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
      
      // Obtener documentos listos para entrega
      const documentosListos = await Documento.findAll({
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
      
      console.log(`Documentos listos para entrega: ${documentosListos.length}`);
      
      return res.render('recepcion/documentos/entrega', {
        layout: 'recepcion',
        title: 'Entrega de Documentos',
        documentosListos,
        userRole: req.matrizador?.rol,
        userName: req.matrizador?.nombre
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
  }
};

module.exports = recepcionController; 