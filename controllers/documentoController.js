/**
 * Controlador para la gestión de documentos notariales
 * Implementa la lógica de negocio para las operaciones CRUD y de estados
 */

const Documento = require('../models/Documento');
const Matrizador = require('../models/Matrizador');
const EventoDocumento = require('../models/EventoDocumento');
const RegistroAuditoria = require('../models/RegistroAuditoria');
const DocumentoRelacion = require('../models/DocumentoRelacion');
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
    
    // Obtener posibles clientes para mostrar documentos existentes
    const clientes = await Documento.findAll({
      attributes: ['nombreCliente', 'identificacionCliente'],
      group: ['nombreCliente', 'identificacionCliente'],
      raw: true
    });
    
    const { layout, viewBase } = getLayoutAndViewBase(req);
    res.render(`${viewBase}/registro`, {
      layout,
      title: 'Registro de Documento',
      activeRegistro: true,
      matrizadores,
      clientes
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

function validarTelefono(telefono) {
  if (!telefono) return true; // Permitir campo vacío si no es obligatorio por el modelo
  // Eliminar todos los caracteres no numéricos
  const telefonoLimpio = telefono.replace(/\D/g, '');
  // Verificar que la longitud sea exactamente 10 dígitos
  return telefonoLimpio.length === 10;
}

function validarEmail(email) {
  if (!email) return true; // Permitir campo vacío si no es obligatorio
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  // Explicación Regex:
  // ^[^\s@]+     => Comienza con uno o más caracteres que no son espacio ni @ (nombre de usuario)
  // @            => Seguido del símbolo @
  // [^\s@]+     => Seguido de uno o más caracteres que no son espacio ni @ (dominio)
  // \.           => Seguido de un punto literal
  // [^\s@]+$     => Termina con uno o más caracteres que no son espacio ni @ (extensión .com, .ec, etc.)
  return regex.test(email);
}

/**
 * Procesa el registro de un nuevo documento
 */
exports.registrarDocumento = async (req, res) => {
  const transaction = await sequelize.transaction();
  const { layout, viewBase } = getLayoutAndViewBase(req);
  let matrizadores = []; 
  
  try {
    matrizadores = await Matrizador.findAll({ order: [['nombre', 'ASC']] });
    const {
      codigoBarras,
      tipoDocumento,
      nombreCliente,
      identificacionCliente,
      emailCliente,
      telefonoCliente,
      notas,
      idMatrizador,
      comparecientes
    } = req.body;

    // Validación de teléfono
    if (telefonoCliente && !validarTelefono(telefonoCliente)) {
      req.flash('error', 'El número telefónico debe contener exactamente 10 dígitos. Se ignorarán espacios, guiones y otros caracteres no numéricos.');
      let matrizadoresList = [];
      if (usuario.rol === 'admin') {
          matrizadoresList = await Matrizador.findAll({ order: [['nombre', 'ASC']] });
      }
      return res.status(400).render(`${viewBase}/registro`, {
        layout,
        title: 'Registro de Documento',
        activeRegistro: true,
        matrizadores,
        error: req.flash('error'),
        formData: req.body
      });
    }

    // Validación de email
    if (emailCliente && !validarEmail(emailCliente)) {
      req.flash('error', 'Ingrese un correo electrónico válido (ejemplo@dominio.com).');
      return res.status(400).render(`${viewBase}/registro`, {
        layout,
        title: 'Registro de Documento',
        activeRegistro: true,
        matrizadores,
        error: req.flash('error'),
        formData: req.body
      });
    }
    
    // Asegurar que idMatrizador sea un entero válido
    let idMatrizadorNum = null;
    if (idMatrizador) {
      idMatrizadorNum = parseInt(idMatrizador, 10);
      if (isNaN(idMatrizadorNum)) {
        throw new Error('El ID del matrizador debe ser un número entero válido');
      }
    }
    
    // Crear el nuevo documento
    const nuevoDocumento = await Documento.create({
      codigoBarras,
      tipoDocumento,
      nombreCliente,
      identificacionCliente,
      emailCliente,
      telefonoCliente,
      notas,
      estado: 'en_proceso',
      idMatrizador: idMatrizadorNum,
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
    res.redirect(getBasePath(req) + '/listado');
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
        errorMessage = 'Ya existe un registro con uno de los valores únicos ingresados (ej. email, identificación).';
      }
    }
    
    // Asegurarse que matrizadores esté disponible incluso si la carga inicial falló antes de la validación
    if (matrizadores.length === 0) {
        try {
            matrizadores = await Matrizador.findAll({ order: [['nombre', 'ASC']] });
        } catch (fetchError) {
            console.error('Error al recargar matrizadores en catch:', fetchError);
        }
    }

    res.status(400).render(`${viewBase}/registro`, {
      layout,
      title: 'Registro de Documento',
      activeRegistro: true,
      matrizadores, // Usar la variable ya cargada o recargada
      error: errorMessage, 
      errorCodeDuplicado: errorCodeDuplicado, 
      formData: req.body
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
      where.tipo_documento = tipoDocumento;
    }
    
    if (idMatrizador) {
      where.idMatrizador = idMatrizador;
    }
    
    if (busqueda) {
      where[Op.or] = [
        { codigoBarras: { [Op.iLike]: `%${busqueda}%` } },
        { nombreCliente: { [Op.iLike]: `%${busqueda}%` } }
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
      order: [['updated_at', 'DESC']],
      limit,
      offset
    });
    
    // Preparar datos para la paginación
    const totalPages = Math.ceil(count / limit);
    const pagination = {
      pages: []
    };
    
    // Generar URLs para la paginación
    const baseUrl = getBasePath(req) + '/listado?';
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
    
    // Obtener matrizadores para filtros
    const matrizadores = await Matrizador.findAll({
      order: [['nombre', 'ASC']]
    });
    
    // DEBUG: Verificar datos antes de renderizar para Admin y Matrizador
    if (req.usuario) { // Si el usuario es admin, req.usuario estará poblado
        console.log("DEBUG Admin Listado - Usuario:", JSON.stringify(req.usuario));
    } else if (req.matrizador) { // Si es matrizador, req.matrizador estará poblado
        // Esta parte es más para el listado de matrizador, pero lo dejamos por si acaso
        console.log("DEBUG Matrizador Listado - Usuario (Matrizador):", JSON.stringify(req.matrizador));
    }
    if (documentos && documentos.length > 0) {
        console.log("DEBUG Listado - Primer Documento:", JSON.stringify(documentos[0]));
    }

    const { layout, viewBase } = getLayoutAndViewBase(req);
    res.render(`${viewBase}/listado`, {
      layout,
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
      },
      usuario: req.usuario || req.matrizador
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
    res.redirect(getBasePath(req) + '/listado');
  } catch (error) {
    await transaction.rollback();
    console.error('Error al marcar documento como listo:', error);
    req.flash('error', error.message);
    res.redirect(getBasePath(req) + '/listado');
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
        return res.redirect(getBasePath(req) + '/entrega');
      }
      
      if (documento.estado !== 'listo_para_entrega') {
        req.flash('error', 'Este documento no está listo para entrega');
        return res.redirect(getBasePath(req) + '/entrega');
      }
      
      const { layout, viewBase } = getLayoutAndViewBase(req);
      return res.render(`${viewBase}/entrega`, {
        layout,
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
        return res.redirect(getBasePath(req) + '/entrega/' + documento.id);
      }
      
      req.flash('error', 'No se encontró un documento listo para entrega con ese código');
    }
    
    // Si no hay ID ni código válido, mostrar lista de documentos listos
    const documentosListos = await Documento.findAll({
      where: {
        estado: 'listo_para_entrega'
      },
      order: [['updated_at', 'DESC']],
      limit: 10
    });
    
    const { layout, viewBase } = getLayoutAndViewBase(req);
    res.render(`${viewBase}/entrega`, {
      layout,
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
      relacionReceptor,
      tipoVerificacion,
      observaciones
    } = req.body;
    
    // Buscar el documento
    const documento = await Documento.findByPk(id, { transaction });
    
    if (!documento) {
      throw new Error('Documento no encontrado');
    }
    
    if (documento.estado !== 'listo_para_entrega') {
      throw new Error('Este documento no está listo para entrega');
    }
    
    // Determinar el tipo de verificación
    const verificacionPorLlamada = tipoVerificacion === 'llamada';
    let verificacionExitosa = verificacionPorLlamada || (documento.codigoVerificacion === codigoVerificacion);
    
    // Verificación del código (a menos que sea por llamada)
    if (!verificacionPorLlamada && !verificacionExitosa) {
      // Registrar intento fallido en auditoría
      await RegistroAuditoria.create({
        idDocumento: documento.id,
        idMatrizador: req.matrizador.id,
        accion: 'verificacion_codigo',
        resultado: 'fallido',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        detalles: `Intento fallido: código ingresado ${codigoVerificacion}, código correcto ${documento.codigoVerificacion}`
      }, { transaction });
      
      // No hacer commit de la transacción en caso de error
      await transaction.rollback();
      req.flash('error', 'El código de verificación no es válido');
      return res.redirect(getBasePath(req) + '/entrega/' + id);
    }
    
    // Actualizar datos de entrega
    documento.estado = 'entregado';
    documento.fechaEntrega = new Date();
    documento.nombreReceptor = nombreReceptor;
    documento.identificacionReceptor = identificacionReceptor;
    documento.relacionReceptor = relacionReceptor;
    
    await documento.save({ transaction });
    
    // Registrar evento de entrega
    await EventoDocumento.create({
      idDocumento: documento.id,
      tipo: 'entrega',
      detalles: `Entregado a ${nombreReceptor} (${relacionReceptor})`,
      usuario: req.matrizador?.nombre || 'Sistema'
    }, { transaction });
    
    // Registrar evento de verificación con el método utilizado
    const tipoEvento = verificacionPorLlamada ? 'verificacion_llamada' : 'verificacion_codigo';
    const detallesVerificacion = verificacionPorLlamada 
      ? `Verificación por llamada: ${observaciones || 'Sin observaciones'}`
      : `Verificación con código: ${codigoVerificacion}`;
    
    await EventoDocumento.create({
      idDocumento: documento.id,
      tipo: tipoEvento,
      detalles: detallesVerificacion,
      usuario: req.matrizador?.nombre || 'Sistema'
    }, { transaction });
    
    // Registrar en auditoría
    await RegistroAuditoria.create({
      idDocumento: documento.id,
      idMatrizador: req.matrizador.id,
      accion: verificacionPorLlamada ? 'verificacion_llamada' : 'verificacion_codigo',
      resultado: 'exitoso',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      detalles: verificacionPorLlamada 
        ? `Verificación por llamada exitosa: ${observaciones || 'Sin observaciones'}` 
        : `Verificación con código exitosa: ${codigoVerificacion}`
    }, { transaction });
    
    await transaction.commit();
    
    req.flash('success', `El documento ha sido entregado exitosamente a ${nombreReceptor}`);
    res.redirect(getBasePath(req) + '/listado');
  } catch (error) {
    await transaction.rollback();
    console.error('Error al completar entrega:', error);
    req.flash('error', error.message);
    res.redirect(getBasePath(req) + '/entrega/' + req.params.id);
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
    res.redirect(getBasePath(req) + '/listado');
  } catch (error) {
    await transaction.rollback();
    console.error('Error al cancelar documento:', error);
    req.flash('error', error.message);
    res.redirect(getBasePath(req) + '/listado');
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
      return res.redirect(getBasePath(req) + '/listado');
    }
    
    // Buscar eventos del documento
    const eventos = await EventoDocumento.findAll({
      where: { idDocumento: id },
      order: [['created_at', 'DESC']]
    });
    
    // Buscar documentos relacionados usando los nuevos alias
    const [componentes, documentosPrincipales] = await Promise.all([
      documento.getComponentes({
        include: [{
          model: DocumentoRelacion,
          as: 'DocumentoRelacion',
          include: [{
            model: Matrizador,
            as: 'creador'
          }]
        }]
      }),
      documento.getDocumentosPrincipales({
        include: [{
          model: DocumentoRelacion,
          as: 'DocumentoRelacion',
          include: [{
            model: Matrizador,
            as: 'creador'
          }]
        }]
      })
    ]);
    
    // Buscar otros documentos del mismo cliente que podrían relacionarse
    const documentosCliente = await Documento.findAll({
      where: {
        id: { [Op.ne]: id },
        [Op.or]: [
          { nombreCliente: documento.nombreCliente },
          { identificacionCliente: documento.identificacionCliente }
        ]
      },
      limit: 10
    });
    
    const { layout, viewBase } = getLayoutAndViewBase(req);
    res.render(`${viewBase}/detalle`, {
      layout,
      title: 'Detalle de Documento',
      documento,
      eventos,
      componentes,
      documentosPrincipales,
      documentosCliente
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

/**
 * Busca documentos del mismo cliente
 */
exports.buscarDocumentosCliente = async (req, res) => {
  try {
    const { cliente, identificacion } = req.query;
    
    const where = {};
    
    if (cliente) {
      where.nombreCliente = cliente;
    }
    
    if (identificacion) {
      where.identificacionCliente = identificacion;
    }
    
    // Si no hay filtros, devolver array vacío
    if (!cliente && !identificacion) {
      return res.json([]);
    }
    
    const documentos = await Documento.findAll({
      where,
      attributes: ['id', 'codigoBarras', 'tipo_documento', 'estado', 'nombreCliente'],
      limit: 10,
      order: [['created_at', 'DESC']]
    });
    
    res.json(documentos);
  } catch (error) {
    console.error('Error al buscar documentos del cliente:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Busca documentos
 */
exports.buscarDocumentos = async (req, res) => {
  try {
    const { query, tipoDocumento, estado } = req.query;
    const where = {};

    // Construir condiciones de búsqueda
    if (query) {
      where[Op.or] = [
        { codigoBarras: { [Op.iLike]: `%${query}%` } },
        { nombreCliente: { [Op.iLike]: `%${query}%` } },
        { tipoDocumento: { [Op.iLike]: `%${query}%` } }
      ];
    }

    if (tipoDocumento) {
      where.tipoDocumento = tipoDocumento;
    }

    if (estado) {
      where.estado = estado;
    }

    // Buscar documentos
    const documentos = await Documento.findAll({
      where,
      limit: 10,
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'codigoBarras', 'tipoDocumento', 'estado', 'nombreCliente', 'createdAt']
    });

    res.json({
      exito: true,
      mensaje: 'Documentos encontrados',
      datos: documentos
    });
  } catch (error) {
    console.error('Error al buscar documentos:', error);
    res.status(500).json({
      exito: false,
      mensaje: 'Error al buscar documentos',
      error: error.message
    });
  }
};

/**
 * Relaciona documentos entre sí
 */
exports.relacionarDocumentos = async (req, res) => {
  try {
    const { idDocumentoPrincipal, idDocumentoRelacionado, tipoRelacion, descripcion } = req.body;

    // Verificar que ambos documentos existan
    const [documentoPrincipal, documentoRelacionado] = await Promise.all([
      Documento.findByPk(idDocumentoPrincipal),
      Documento.findByPk(idDocumentoRelacionado)
    ]);

    if (!documentoPrincipal || !documentoRelacionado) {
      return res.status(404).json({
        exito: false,
        mensaje: 'Uno o ambos documentos no existen'
      });
    }

    // Verificar que no exista ya la relación
    const relacionExistente = await DocumentoRelacion.findOne({
      where: {
        idDocumentoPrincipal,
        idDocumentoRelacionado
      }
    });

    if (relacionExistente) {
      return res.status(400).json({
        exito: false,
        mensaje: 'Ya existe una relación entre estos documentos'
      });
    }

    // Crear la relación
    const relacion = await DocumentoRelacion.create({
      idDocumentoPrincipal,
      idDocumentoRelacionado,
      tipoRelacion,
      descripcion,
      creadoPor: req.matrizador.id
    });

    // Registrar en auditoría
    await RegistroAuditoria.create({
      idDocumento: idDocumentoPrincipal,
      idMatrizador: req.matrizador.id,
      accion: 'crear_relacion',
      resultado: 'exitoso',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      detalles: `Relación creada con documento ${documentoRelacionado.codigoBarras}`
    });

    res.status(201).json({
      exito: true,
      mensaje: 'Relación creada exitosamente',
      datos: relacion
    });
  } catch (error) {
    console.error('Error al relacionar documentos:', error);
    res.status(500).json({
      exito: false,
      mensaje: 'Error al relacionar documentos',
      error: error.message
    });
  }
};

/**
 * Elimina la relación entre documentos
 */
exports.eliminarRelacion = async (req, res) => {
  try {
    const { idDocumentoPrincipal, idDocumentoRelacionado } = req.query;

    // Buscar la relación
    const relacion = await DocumentoRelacion.findOne({
      where: {
        idDocumentoPrincipal,
        idDocumentoRelacionado
      }
    });

    if (!relacion) {
      return res.status(404).json({
        exito: false,
        mensaje: 'No se encontró la relación especificada'
      });
    }

    // Eliminar la relación
    await relacion.destroy();

    // Registrar en auditoría
    await RegistroAuditoria.create({
      idDocumento: idDocumentoPrincipal,
      idMatrizador: req.matrizador.id,
      accion: 'eliminar_relacion',
      resultado: 'exitoso',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      detalles: `Relación eliminada con documento ${idDocumentoRelacionado}`
    });

    res.json({
      exito: true,
      mensaje: 'Relación eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar relación:', error);
    res.status(500).json({
      exito: false,
      mensaje: 'Error al eliminar relación',
      error: error.message
    });
  }
};

/**
 * Obtiene un documento con sus relaciones
 */
exports.obtenerDocumentoConRelaciones = async (req, res) => {
  try {
    const { id } = req.params;

    const documento = await Documento.findByPk(id, {
      include: [
        {
          model: Matrizador,
          as: 'matrizador'
        },
        {
          model: Documento,
          as: 'documentosPrincipales',
          through: {
            model: DocumentoRelacion,
            as: 'relacionPrincipal',
            where: {
              tipoRelacion: 'componente'
            }
          },
          include: [
            {
              model: Matrizador,
              as: 'matrizador'
            }
          ]
        },
        {
          model: Documento,
          as: 'componentes',
          through: {
            model: DocumentoRelacion,
            as: 'relacionComponente',
            where: {
              tipoRelacion: 'componente'
            }
          },
          include: [
            {
              model: Matrizador,
              as: 'matrizador'
            }
          ]
        }
      ]
    });

    if (!documento) {
      return res.status(404).json({
        exito: false,
        mensaje: 'Documento no encontrado'
      });
    }

    // Obtener eventos del documento
    const eventos = await EventoDocumento.findAll({
      where: { idDocumento: id },
      order: [['createdAt', 'DESC']]
    });

    const { layout, viewBase } = getLayoutAndViewBase(req);
    res.render(`${viewBase}/detalle`, {
      layout,
      title: 'Detalle de Documento',
      documento,
      eventos,
      documentosPrincipales: documento.documentosPrincipales,
      componentes: documento.componentes,
      userRole: req.matrizador.rol
    });
  } catch (error) {
    console.error('Error al obtener documento con relaciones:', error);
    res.status(500).json({
      exito: false,
      mensaje: 'Error al obtener el documento',
      error: error.message
    });
  }
};

/**
 * Actualiza el estado de un documento y propaga el cambio a sus relaciones
 */
exports.actualizarEstadoConPropagacion = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { nuevoEstado, propagarAComponentes } = req.body;

    // Obtener el documento y sus relaciones
    const documento = await Documento.findByPk(id, {
      include: [
        {
          model: Documento,
          as: 'componentes',
          through: { attributes: ['tipoRelacion'] }
        }
      ],
      transaction
    });

    if (!documento) {
      await transaction.rollback();
      return res.status(404).json({
        exito: false,
        mensaje: 'Documento no encontrado'
      });
    }

    // Actualizar estado del documento principal
    await documento.update({ estado: nuevoEstado }, { transaction });

    // Registrar cambio de estado en auditoría
    await RegistroAuditoria.create({
      idDocumento: documento.id,
      idMatrizador: req.matrizador.id,
      accion: 'cambio_estado',
      resultado: 'exitoso',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      detalles: `Estado actualizado a ${nuevoEstado}`
    }, { transaction });

    // Si se debe propagar a componentes
    if (propagarAComponentes && documento.componentes.length > 0) {
      // Actualizar estado de todos los componentes
      await Promise.all(documento.componentes.map(async (componente) => {
        await componente.update({ estado: nuevoEstado }, { transaction });

        // Registrar cambio de estado en auditoría para cada componente
        await RegistroAuditoria.create({
          idDocumento: componente.id,
          idMatrizador: req.matrizador.id,
          accion: 'cambio_estado_propagado',
          resultado: 'exitoso',
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          detalles: `Estado actualizado a ${nuevoEstado} por propagación desde documento ${documento.codigoBarras}`
        }, { transaction });
      }));
    }

    await transaction.commit();

    res.json({
      exito: true,
      mensaje: 'Estado actualizado correctamente',
      datos: {
        documento: {
          id: documento.id,
          codigoBarras: documento.codigoBarras,
          estado: nuevoEstado
        },
        componentesActualizados: propagarAComponentes ? documento.componentes.length : 0
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error al actualizar estado:', error);
    res.status(500).json({
      exito: false,
      mensaje: 'Error al actualizar estado',
      error: error.message
    });
  }
};

/**
 * Registra la entrega de un documento y sus componentes
 */
exports.registrarEntregaConComponentes = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { codigoBarras } = req.params;
    const { nombreReceptor, identificacionReceptor, relacionReceptor } = req.body;

    // Obtener el documento principal
    const documento = await Documento.findOne({
      where: { codigoBarras },
      include: [{
        model: DocumentoRelacion,
        as: 'relacionesPrincipales',
        where: { esPrincipal: true },
        required: false
      }]
    });

    if (!documento) {
      await transaction.rollback();
      return res.status(404).json({
        exito: false,
        mensaje: 'Documento no encontrado'
      });
    }

    // Verificar código de verificación
    if (documento.codigoVerificacion !== req.body.codigoVerificacion) {
      await transaction.rollback();
      return res.status(400).json({
        exito: false,
        mensaje: 'Código de verificación inválido'
      });
    }

    // Actualizar el documento principal
    await documento.update({
      estado: 'entregado',
      fechaEntrega: new Date(),
      nombreReceptor,
      identificacionReceptor,
      relacionReceptor
    }, { transaction });

    // Si el documento es principal, actualizar sus componentes
    if (documento.relacionesPrincipales.length > 0) {
      const grupoEntrega = documento.relacionesPrincipales[0].grupoEntrega;

      // Obtener y actualizar todos los documentos del grupo
      const documentosGrupo = await Documento.findAll({
        include: [{
          model: DocumentoRelacion,
          where: { grupoEntrega }
        }]
      });

      await Promise.all(
        documentosGrupo.map(doc => 
          doc.update({
            estado: 'entregado',
            fechaEntrega: new Date(),
            nombreReceptor,
            identificacionReceptor,
            relacionReceptor
          }, { transaction })
        )
      );

      // Registrar en auditoría
      await RegistroAuditoria.create({
        idDocumento: documento.id,
        idMatrizador: req.matrizador.id,
        accion: 'entrega_grupo',
        resultado: 'exitoso',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        detalles: `Entrega registrada para grupo ${grupoEntrega}`
      }, { transaction });
    }

    await transaction.commit();

    res.status(200).json({
      exito: true,
      mensaje: 'Entrega registrada correctamente',
      datos: {
        documento,
        componentesEntregados: documento.relacionesPrincipales.length > 0
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error al registrar entrega:', error);
    res.status(500).json({
      exito: false,
      mensaje: 'Error al registrar la entrega',
      error: error.message
    });
  }
};

/**
 * Obtiene los documentos pendientes (en_proceso o listo_para_entrega) del matrizador autenticado
 */
exports.obtenerPendientesPorMatrizador = async (req, res) => {
  try {
    console.log('ID matrizador autenticado:', req.matrizador?.id, '| req.matrizador:', req.matrizador);
    const idMatrizador = req.matrizador.id;
    const documentos = await Documento.findAll({
      where: {
        idMatrizador,
        estado: { [Op.in]: ['en_proceso', 'listo_para_entrega'] }
      },
      order: [['created_at', 'DESC']],
      attributes: ['id', 'codigoBarras', 'tipoDocumento', 'estado', 'nombreCliente', 'created_at']
    });
    res.json({
      exito: true,
      datos: documentos
    });
  } catch (error) {
    console.error('Error al obtener documentos pendientes por matrizador:', error);
    res.status(500).json({
      exito: false,
      mensaje: 'Error al obtener documentos pendientes',
      error: error.message
    });
  }
};

// Funciones proxy para compatibilidad de rutas antiguas
exports.obtenerTodos = async (req, res) => {
  res.status(501).json({ exito: false, mensaje: 'No implementado' });
};

exports.obtenerPorId = async (req, res) => {
  res.status(501).json({ exito: false, mensaje: 'No implementado' });
};

exports.buscarPorCodigoBarras = async (req, res) => {
  res.status(501).json({ exito: false, mensaje: 'No implementado' });
};

exports.verificarCodigo = async (req, res) => {
  res.status(501).json({ exito: false, mensaje: 'No implementado' });
};

exports.crear = async (req, res) => {
  res.status(501).json({ exito: false, mensaje: 'No implementado' });
};

exports.actualizar = async (req, res) => {
  res.status(501).json({ exito: false, mensaje: 'No implementado' });
};

exports.eliminar = async (req, res) => {
  res.status(501).json({ exito: false, mensaje: 'No implementado' });
};

exports.registrarEntrega = async (req, res) => {
  res.status(501).json({ exito: false, mensaje: 'No implementado' });
};

exports.obtenerHistorial = async (req, res) => {
  res.status(501).json({ exito: false, mensaje: 'No implementado' });
};

// Proxies para todas las funciones usadas en las rutas (si no existen)
if (!exports.obtenerDocumentoConRelaciones) {
  exports.obtenerDocumentoConRelaciones = async (req, res) => {
    res.status(501).json({ exito: false, mensaje: 'No implementado' });
  };
}
if (!exports.actualizarEstadoConPropagacion) {
  exports.actualizarEstadoConPropagacion = async (req, res) => {
    res.status(501).json({ exito: false, mensaje: 'No implementado' });
  };
}
if (!exports.registrarEntregaConComponentes) {
  exports.registrarEntregaConComponentes = async (req, res) => {
    res.status(501).json({ exito: false, mensaje: 'No implementado' });
  };
}
if (!exports.buscarDocumentos) {
  exports.buscarDocumentos = async (req, res) => {
    res.status(501).json({ exito: false, mensaje: 'No implementado' });
  };
}
if (!exports.relacionarDocumentos) {
  exports.relacionarDocumentos = async (req, res) => {
    res.status(501).json({ exito: false, mensaje: 'No implementado' });
  };
}
if (!exports.eliminarRelacion) {
  exports.eliminarRelacion = async (req, res) => {
    res.status(501).json({ exito: false, mensaje: 'No implementado' });
  };
}
if (!exports.obtenerCodigoVerificacion) {
  exports.obtenerCodigoVerificacion = async (req, res) => {
    res.status(501).json({ exito: false, mensaje: 'No implementado' });
  };
}

/**
 * Muestra el formulario para editar un documento para el rol ADMIN.
 */
exports.mostrarFormularioEdicionAdmin = async (req, res) => {
  try {
    const documentoId = req.params.id;
    const usuario = req.usuario; // Asumiendo que el middleware de auth carga req.usuario

    const documento = await Documento.findByPk(documentoId, {
      include: [{ model: Matrizador, as: 'matrizador' }]
    });

    if (!documento) {
      req.flash('error', 'Documento no encontrado.');
      return res.redirect('/admin/documentos/listado');
    }

    // Lógica de permisos para Admin
    if (documento.estado === 'entregado') {
      req.flash('error', 'Los documentos entregados no se pueden editar.');
      return res.redirect('/admin/documentos/detalle/' + documentoId);
    }
    
    const matrizadores = await Matrizador.findAll({ order: [['nombre', 'ASC']] });

    res.render('admin/documentos/editar', {
      layout: 'admin',
      title: 'Editar Documento (Admin)',
      documento,
      matrizadores,
      usuario,
      activeEdicion: true
    });

  } catch (error) {
    console.error('Error al mostrar formulario de edición ADMIN:', error);
    req.flash('error', 'Error al cargar el formulario de edición para Admin.');
    res.redirect('/admin/documentos/listado');
  }
};

/**
 * Muestra el formulario para editar un documento para el rol MATRIZADOR.
 */
exports.mostrarFormularioEdicionMatrizador = async (req, res) => {
  try {
    const documentoId = req.params.id;
    const usuario = req.matrizador || req.usuario; // req.matrizador es poblado por el token

    if (!usuario) {
        req.flash('error', 'Usuario no autenticado correctamente.');
        return res.redirect('/login');
    }

    const documento = await Documento.findByPk(documentoId, {
        include: [{ model: Matrizador, as: 'matrizador' }]
    });

    if (!documento) {
      req.flash('error', 'Documento no encontrado.');
      // Log para depuración
      console.log(`DEBUG: Documento no encontrado ID: ${documentoId} para Matrizador ID: ${usuario.id}`);
      return res.redirect('/matrizador/documentos');
    }

    // Log para depuración
    console.log(`DEBUG: Intentando editar doc ID ${documento.id} (Matrizador: ${documento.idMatrizador}, Estado: ${documento.estado}) por Usuario Matrizador ID: ${usuario.id}`);

    // Lógica de permisos para Matrizador
    if (documento.idMatrizador !== usuario.id) {
      req.flash('error', 'No tiene permisos para editar este documento (no le pertenece).');
      console.log(`DEBUG: Permiso denegado (propiedad) para Matrizador ID: ${usuario.id} en Doc ID: ${documento.id}`);
      return res.redirect('/matrizador/documentos/detalle/' + documentoId);
    }

    if (documento.estado !== 'en_proceso' && documento.estado !== 'registrado') { // 'registrado' como sinónimo de 'en_proceso'
      req.flash('error', 'Solo puede editar documentos en estado "En Proceso".');
      console.log(`DEBUG: Permiso denegado (estado ${documento.estado}) para Matrizador ID: ${usuario.id} en Doc ID: ${documento.id}`);
      return res.redirect('/matrizador/documentos/detalle/' + documentoId);
    }

    res.render('matrizadores/documentos/editar', {
      layout: 'matrizador',
      title: 'Editar Documento (Matrizador)',
      documento,
      usuario, // Pasar el objeto de usuario completo (req.matrizador)
      activeEdicion: true
    });

  } catch (error) {
    console.error('Error al mostrar formulario de edición MATRIZADOR:', error);
    req.flash('error', 'Error al cargar el formulario de edición para Matrizador.');
    // Log para depuración
    console.log(`DEBUG: Catch en mostrarFormularioEdicionMatrizador para Usuario Matrizador ID: ${(req.matrizador || req.usuario)?.id}. Error: ${error.message}`);
    res.redirect('/matrizador/documentos');
  }
};

/**
 * Procesa la actualización de un documento existente (método genérico).
 * La lógica de permisos específica por rol se maneja aquí.
 */
exports.actualizarDocumento = async (req, res) => {
  const transaction = await sequelize.transaction();
  const documentoId = req.params.id;
  const usuario = req.matrizador || req.usuario; 
  const baseRedirectPath = usuario.rol === 'admin' ? '/admin/documentos' : '/matrizador/documentos';
  const viewToRender = usuario.rol === 'admin' ? 'admin/documentos/editar' : 'matrizadores/documentos/editar';
  const layoutToRender = usuario.rol === 'admin' ? 'admin' : 'matrizador';

  if (!usuario) {
    req.flash('error', 'Usuario no autenticado correctamente.');
    await transaction.rollback();
    return res.redirect('/login');
  }

  try {
    const documento = await Documento.findByPk(documentoId, { transaction });

    if (!documento) {
      req.flash('error', 'Documento no encontrado.');
      await transaction.rollback();
      return res.redirect(baseRedirectPath + '/listado');
    }

    // Lógica de permisos para actualizar
    let puedeEditar = false;
    if (usuario.rol === 'admin') {
      if (documento.estado !== 'entregado') {
        puedeEditar = true;
      }
    } else if (usuario.rol === 'matrizador') {
      if (documento.idMatrizador === usuario.id &&
          (documento.estado === 'en_proceso' || documento.estado === 'registrado')) {
        puedeEditar = true;
      }
    }

    if (!puedeEditar) {
      req.flash('error', 'No tiene permisos para actualizar este documento o no es editable en su estado actual.');
      await transaction.rollback();
      return res.redirect(baseRedirectPath + '/detalle/' + documentoId);
    }
    
    const {
      tipoDocumento,
      nombreCliente,
      identificacionCliente,
      emailCliente,
      telefonoCliente,
      notas,
      estado, 
      idMatrizador,
      comparecientes
    } = req.body;

    // Validación de teléfono
    if (telefonoCliente && !validarTelefono(telefonoCliente)) {
      req.flash('error', 'El número telefónico debe contener exactamente 10 dígitos. Se ignorarán espacios, guiones y otros caracteres no numéricos.');
      let matrizadoresList = [];
      if (usuario.rol === 'admin') {
          matrizadoresList = await Matrizador.findAll({ order: [['nombre', 'ASC']] });
      }
      return res.status(400).render(viewToRender, {
          layout: layoutToRender,
          title: `Editar Documento (${usuario.rol})`,
          documento: { ...documento.get(), ...req.body },
          matrizadores: matrizadoresList,
          usuario,
          error: req.flash('error'),
      });
    }

    // Validación de email
    if (emailCliente && !validarEmail(emailCliente)) {
      req.flash('error', 'Ingrese un correo electrónico válido (ejemplo@dominio.com).');
      let matrizadoresList = [];
      if (usuario.rol === 'admin') {
          matrizadoresList = await Matrizador.findAll({ order: [['nombre', 'ASC']] });
      }
      return res.status(400).render(viewToRender, {
          layout: layoutToRender,
          title: `Editar Documento (${usuario.rol})`,
          documento: { ...documento.get(), ...req.body },
          matrizadores: matrizadoresList,
          usuario,
          error: req.flash('error'),
      });
    }

    const datosActualizar = {
      tipoDocumento: tipoDocumento || documento.tipoDocumento,
      nombreCliente: nombreCliente || documento.nombreCliente,
      identificacionCliente: identificacionCliente || documento.identificacionCliente,
      emailCliente: emailCliente === undefined ? documento.emailCliente : emailCliente, // Permitir string vacío
      telefonoCliente: telefonoCliente === undefined ? documento.telefonoCliente : telefonoCliente, // Permitir string vacío
      notas: notas === undefined ? documento.notas : notas, // Permitir string vacío
      // Asegurar que comparecientes sea un array; si no se envía, mantener el existente.
      comparecientes: Array.isArray(comparecientes) ? comparecientes : (comparecientes === undefined ? documento.comparecientes : []) 
    };

    if (usuario.rol === 'admin') {
      if (estado && documento.estado !== 'entregado') {
        datosActualizar.estado = estado;
      }
      if (idMatrizador) {
        const idMatrizadorNum = parseInt(idMatrizador, 10);
        if (isNaN(idMatrizadorNum) && idMatrizador !== '') { // Permitir desasignar con string vacío
            req.flash('error', 'El ID del matrizador no es válido.');
            await transaction.rollback();
            // Re-renderizar el formulario con el error
            const matrizadoresList = await Matrizador.findAll({ order: [['nombre', 'ASC']] });
            return res.status(400).render('admin/documentos/editar', { // Vista de admin
                layout: 'admin',
                title: 'Editar Documento (Admin)',
                documento: { ...documento.get(), ...req.body },
                matrizadores: matrizadoresList,
                usuario,
                error: 'El ID del matrizador no es válido.',
            });
        }
        datosActualizar.idMatrizador = idMatrizador === '' ? null : idMatrizadorNum; // Permitir desasignar
      } else if (idMatrizador === '') { // Si se envía explícitamente un idMatrizador vacío
         datosActualizar.idMatrizador = null;
      }
    } else if (usuario.rol === 'matrizador') {
      // Matrizador no puede cambiar estado ni idMatrizador aquí.
    }
    
    await documento.update(datosActualizar, { transaction });

    await EventoDocumento.create({
      idDocumento: documento.id,
      tipo: 'modificacion',
      detalles: `Documento modificado por ${usuario.nombre || 'sistema'} (${usuario.rol || 'N/A'}).`,
      usuario: usuario.nombre || 'sistema',
      metadatos: {
        idUsuario: usuario.id,
        rolUsuario: usuario.rol
      }
    }, { transaction });
    
    await RegistroAuditoria.create({
        accion: 'ACTUALIZACION_DOCUMENTO',
        idDocumento: documento.id,
        idMatrizador: usuario.id,
        detalles: `Documento ID ${documento.id} actualizado por ${usuario.nombre}.`,
        resultado: 'exitoso',
        ip: req.ip,
        userAgent: req.get('User-Agent')
    }, { transaction });

    await transaction.commit();
    req.flash('success', `Documento ${documento.codigoBarras} actualizado exitosamente.`);
    res.redirect(baseRedirectPath + '/detalle/' + documentoId);

  } catch (error) {
    await transaction.rollback();
    console.error('Error al procesar actualización de documento:', error);
    req.flash('error', 'Error al actualizar el documento: ' + error.message);
    
    const documentoOriginal = await Documento.findByPk(documentoId); // No usar transacción aquí
    const currentFormData = documentoOriginal ? { ...documentoOriginal.get(), ...req.body } : req.body;
    let matrizadoresList = [];
    if (usuario.rol === 'admin') {
        try {
            matrizadoresList = await Matrizador.findAll({ order: [['nombre', 'ASC']] });
        } catch (fetchError) {
            console.error('Error al recargar matrizadores en catch de actualizarDocumento:', fetchError);
        }
    }

    res.status(500).render(viewToRender, {
        layout: layoutToRender,
        title: `Editar Documento (${usuario.rol})`,
        documento: currentFormData,
        matrizadores: matrizadoresList,
        usuario,
        error: 'Error al actualizar el documento: ' + error.message, // Usar el error que ya tiene req.flash
    });
  }
};

// Utilidad para obtener el layout y la ruta base de la vista según el rol
function getLayoutAndViewBase(req) {
  if (req.matrizador && req.matrizador.rol === 'matrizador') {
    return { layout: 'matrizador', viewBase: 'matrizadores/documentos' };
  }
  return { layout: 'admin', viewBase: 'admin/documentos' };
}

// Utilidad para obtener la ruta base según el rol
function getBasePath(req) {
  if (req.matrizador && req.matrizador.rol === 'matrizador') {
    return '/matrizador/documentos';
  }
  return '/admin/documentos';
} 