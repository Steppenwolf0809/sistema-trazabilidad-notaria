/**
 * Controlador para la gestión de documentos notariales
 * Implementa la lógica de negocio para las operaciones CRUD y de estados
 */

const Documento = require('../models/Documento');
const Matrizador = require('../models/Matrizador');
const EventoDocumento = require('../models/EventoDocumento');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');

/**
 * Muestra el formulario para registrar un nuevo documento
 */
exports.mostrarFormularioRegistro = async (req, res) => {
  try {
    // Obtener lista de matrizadores para el formulario
    const matrizadores = await Matrizador.findAll({
      order: [['nombre', 'ASC']]
    });
    
    res.render('admin/documentos/registro', {
      layout: 'admin',
      title: 'Registro de Documento',
      activeRegistro: true,
      matrizadores
    });
  } catch (error) {
    console.error('Error al mostrar formulario de registro:', error);
    res.status(500).render('error', {
      layout: 'admin',
      title: 'Error',
      message: 'Ha ocurrido un error al cargar el formulario de registro',
      error
    });
  }
};

/**
 * Procesa el registro de un nuevo documento
 */
exports.registrarDocumento = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const {
      codigoBarras,
      tipoDocumento,
      numeroProtocolo,
      nombreCliente,
      identificacionCliente,
      emailCliente,
      telefonoCliente,
      notas,
      idMatrizador,
      comparecientes
    } = req.body;
    
    // Crear el nuevo documento
    const nuevoDocumento = await Documento.create({
      codigoBarras,
      tipoDocumento,
      numeroProtocolo,
      nombreCliente,
      identificacionCliente,
      emailCliente,
      telefonoCliente,
      notas,
      estado: 'en_proceso',
      idMatrizador,
      comparecientes: comparecientes || []
    }, { transaction });
    
    // Registrar evento de creación
    await EventoDocumento.create({
      idDocumento: nuevoDocumento.id,
      tipo: 'creacion',
      detalles: 'Documento registrado en el sistema',
      usuario: 'Sistema' // Aquí se podría usar el usuario autenticado
    }, { transaction });
    
    await transaction.commit();
    
    req.flash('success', `Documento ${tipoDocumento} registrado exitosamente con código ${codigoBarras}`);
    res.redirect('/admin/documentos/listado');
  } catch (error) {
    await transaction.rollback();
    console.error('Error al registrar documento:', error);
    
    // Obtener matrizadores para re-renderizar el formulario con errores
    const matrizadores = await Matrizador.findAll({
      order: [['nombre', 'ASC']]
    });
    
    res.status(400).render('admin/documentos/registro', {
      layout: 'admin',
      title: 'Registro de Documento',
      activeRegistro: true,
      matrizadores,
      error: error.message,
      formData: req.body // Mantener los datos ingresados
    });
  }
};

/**
 * Muestra el listado de documentos con filtros
 */
exports.listarDocumentos = async (req, res) => {
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
      where.tipoDocumento = tipoDocumento;
    }
    
    if (idMatrizador) {
      where.idMatrizador = idMatrizador;
    }
    
    if (busqueda) {
      where[Op.or] = [
        { codigoBarras: { [Op.iLike]: `%${busqueda}%` } },
        { nombreCliente: { [Op.iLike]: `%${busqueda}%` } },
        { numeroProtocolo: { [Op.iLike]: `%${busqueda}%` } }
      ];
    }
    
    // Obtener documentos con paginación
    const { count, rows: documentos } = await Documento.findAndCountAll({
      where,
      include: [
        {
          model: Matrizador,
          as: 'matrizador'
        }
      ],
      order: [['updatedAt', 'DESC']],
      limit,
      offset
    });
    
    // Preparar datos para la paginación
    const totalPages = Math.ceil(count / limit);
    const pagination = {
      pages: []
    };
    
    // Generar URLs para la paginación
    const baseUrl = '/admin/documentos/listado?';
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
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('tipoDocumento')), 'tipo']],
      raw: true
    });
    
    const tiposDocumento = tiposDocumentoQuery.map(t => t.tipo).filter(Boolean);
    
    // Obtener matrizadores para filtros
    const matrizadores = await Matrizador.findAll({
      order: [['nombre', 'ASC']]
    });
    
    res.render('admin/documentos/listado', {
      layout: 'admin',
      title: 'Listado de Documentos',
      activeListado: true,
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
      }
    });
  } catch (error) {
    console.error('Error al listar documentos:', error);
    res.status(500).render('error', {
      layout: 'admin',
      title: 'Error',
      message: 'Ha ocurrido un error al cargar el listado de documentos',
      error
    });
  }
};

/**
 * Marca un documento como listo para entrega y genera código de verificación
 */
exports.marcarComoListo = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { documentoId } = req.body;
    
    // Buscar el documento
    const documento = await Documento.findByPk(documentoId, { transaction });
    
    if (!documento) {
      throw new Error('Documento no encontrado');
    }
    
    if (documento.estado !== 'en_proceso') {
      throw new Error('El documento no está en estado "En Proceso" y no puede ser marcado como listo');
    }
    
    // Generar código de verificación de 4 dígitos
    const codigoVerificacion = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Actualizar estado y código
    documento.estado = 'listo_para_entrega';
    documento.codigoVerificacion = codigoVerificacion;
    await documento.save({ transaction });
    
    // Registrar evento
    await EventoDocumento.create({
      idDocumento: documento.id,
      tipo: 'cambio_estado',
      detalles: 'Documento marcado como listo para entrega',
      usuario: 'Sistema' // Aquí se podría usar el usuario autenticado
    }, { transaction });
    
    await transaction.commit();
    
    // Simular envío de notificación
    console.log(`NOTIFICACIÓN: Se ha enviado el código ${codigoVerificacion} al cliente ${documento.nombreCliente} (${documento.emailCliente || documento.telefonoCliente})`);
    
    req.flash('success', `El documento ha sido marcado como listo para entrega y se ha enviado el código de verificación al cliente.`);
    res.redirect('/admin/documentos/listado');
  } catch (error) {
    await transaction.rollback();
    console.error('Error al marcar documento como listo:', error);
    req.flash('error', error.message);
    res.redirect('/admin/documentos/listado');
  }
};

/**
 * Muestra la interfaz de entrega de documentos
 */
exports.mostrarEntrega = async (req, res) => {
  try {
    const documentoId = req.params.id;
    const codigo = req.query.codigo;
    
    // Si hay un ID, mostrar formulario de entrega para ese documento
    if (documentoId) {
      const documento = await Documento.findByPk(documentoId, {
        include: [{
          model: Matrizador,
          as: 'matrizador'
        }]
      });
      
      if (!documento) {
        req.flash('error', 'Documento no encontrado');
        return res.redirect('/admin/documentos/entrega');
      }
      
      if (documento.estado !== 'listo_para_entrega') {
        req.flash('error', 'Este documento no está listo para entrega');
        return res.redirect('/admin/documentos/entrega');
      }
      
      return res.render('admin/documentos/entrega', {
        layout: 'admin',
        title: 'Entrega de Documento',
        activeEntrega: true,
        documento,
        error: req.flash('error')[0]
      });
    }
    
    // Si hay un código de barras, buscar por código de barras
    if (codigo) {
      const documento = await Documento.findOne({
        where: {
          codigoBarras: codigo,
          estado: 'listo_para_entrega'
        }
      });
      
      if (documento) {
        return res.redirect(`/admin/documentos/entrega/${documento.id}`);
      }
      
      req.flash('error', 'No se encontró un documento listo para entrega con ese código');
    }
    
    // Si no hay ID ni código válido, mostrar lista de documentos listos
    const documentosListos = await Documento.findAll({
      where: {
        estado: 'listo_para_entrega'
      },
      order: [['updatedAt', 'DESC']],
      limit: 10
    });
    
    res.render('admin/documentos/entrega', {
      layout: 'admin',
      title: 'Entrega de Documentos',
      activeEntrega: true,
      documentosListos,
      error: req.flash('error')[0]
    });
  } catch (error) {
    console.error('Error al mostrar formulario de entrega:', error);
    res.status(500).render('error', {
      layout: 'admin',
      title: 'Error',
      message: 'Ha ocurrido un error al cargar la interfaz de entrega',
      error
    });
  }
};

/**
 * Procesa la entrega de un documento verificando el código
 */
exports.completarEntrega = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const {
      codigoVerificacion,
      nombreReceptor,
      identificacionReceptor,
      relacionReceptor
    } = req.body;
    
    // Buscar el documento
    const documento = await Documento.findByPk(id, { transaction });
    
    if (!documento) {
      throw new Error('Documento no encontrado');
    }
    
    if (documento.estado !== 'listo_para_entrega') {
      throw new Error('Este documento no está listo para entrega');
    }
    
    // Verificar código
    if (documento.codigoVerificacion !== codigoVerificacion) {
      // No hacer commit de la transacción en caso de error
      await transaction.rollback();
      req.flash('error', 'El código de verificación no es válido');
      return res.redirect(`/admin/documentos/entrega/${id}`);
    }
    
    // Actualizar datos de entrega
    documento.estado = 'entregado';
    documento.fechaEntrega = new Date();
    documento.nombreReceptor = nombreReceptor;
    documento.identificacionReceptor = identificacionReceptor;
    documento.relacionReceptor = relacionReceptor;
    
    await documento.save({ transaction });
    
    // Registrar evento
    await EventoDocumento.create({
      idDocumento: documento.id,
      tipo: 'entrega',
      detalles: `Entregado a ${nombreReceptor} (${relacionReceptor})`,
      usuario: 'Sistema' // Aquí se podría usar el usuario autenticado
    }, { transaction });
    
    await transaction.commit();
    
    req.flash('success', `El documento ha sido entregado exitosamente a ${nombreReceptor}`);
    res.redirect('/admin/documentos/listado');
  } catch (error) {
    await transaction.rollback();
    console.error('Error al completar entrega:', error);
    req.flash('error', error.message);
    res.redirect(`/admin/documentos/entrega/${req.params.id}`);
  }
};

/**
 * Cancela un documento
 */
exports.cancelarDocumento = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { documentoId, motivo } = req.body;
    
    // Buscar el documento
    const documento = await Documento.findByPk(documentoId, { transaction });
    
    if (!documento) {
      throw new Error('Documento no encontrado');
    }
    
    if (documento.estado === 'entregado') {
      throw new Error('No se puede cancelar un documento ya entregado');
    }
    
    // Actualizar estado
    documento.estado = 'cancelado';
    await documento.save({ transaction });
    
    // Registrar evento
    await EventoDocumento.create({
      idDocumento: documento.id,
      tipo: 'cancelacion',
      detalles: `Cancelado: ${motivo}`,
      usuario: 'Sistema' // Aquí se podría usar el usuario autenticado
    }, { transaction });
    
    await transaction.commit();
    
    req.flash('success', 'El documento ha sido cancelado');
    res.redirect('/admin/documentos/listado');
  } catch (error) {
    await transaction.rollback();
    console.error('Error al cancelar documento:', error);
    req.flash('error', error.message);
    res.redirect('/admin/documentos/listado');
  }
};

/**
 * Muestra los detalles de un documento
 */
exports.mostrarDetalle = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Buscar el documento con su matrizador
    const documento = await Documento.findByPk(id, {
      include: [{
        model: Matrizador,
        as: 'matrizador'
      }]
    });
    
    if (!documento) {
      req.flash('error', 'Documento no encontrado');
      return res.redirect('/admin/documentos/listado');
    }
    
    // Buscar eventos del documento
    const eventos = await EventoDocumento.findAll({
      where: { idDocumento: id },
      order: [['createdAt', 'DESC']]
    });
    
    res.render('admin/documentos/detalle', {
      layout: 'admin',
      title: 'Detalle de Documento',
      documento,
      eventos
    });
  } catch (error) {
    console.error('Error al mostrar detalle del documento:', error);
    res.status(500).render('error', {
      layout: 'admin',
      title: 'Error',
      message: 'Ha ocurrido un error al cargar los detalles del documento',
      error
    });
  }
}; 