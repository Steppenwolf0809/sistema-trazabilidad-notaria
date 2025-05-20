const express = require('express');
const router = express.Router();
const { verificarToken } = require('../middlewares/auth');
const roleAuth = require('../middlewares/roleAuth');
const recepcionController = require('../controllers/recepcionController');

// Aplicar middleware de verificación de token para todas las rutas
router.use(verificarToken);

// Dashboard de recepción - Solo para recepción y admin
router.get('/', roleAuth(['recepcion', 'admin']), recepcionController.dashboard);

// Listado de documentos - Solo para recepción y admin
router.get('/documentos', roleAuth(['recepcion', 'admin']), recepcionController.listarDocumentos);

// Detalle de documento - Solo para recepción y admin
router.get('/documentos/detalle/:id', roleAuth(['recepcion', 'admin']), recepcionController.detalleDocumento);

// Entrega de documento - Solo para recepción y admin
router.get('/documentos/entrega', roleAuth(['recepcion', 'admin']), recepcionController.mostrarEntrega);
router.get('/documentos/entrega/:id', roleAuth(['recepcion', 'admin']), recepcionController.mostrarEntrega);
router.post('/documentos/entrega/:id', roleAuth(['recepcion', 'admin']), recepcionController.completarEntrega);

// Nueva ruta para marcar documento como listo para entrega - Solo para recepción y admin
router.post('/documentos/marcar-listo', roleAuth(['recepcion', 'admin']), recepcionController.marcarDocumentoListoParaEntrega);

// Ruta para notificar a clientes sobre documentos listos para entrega
router.post('/documentos/notificar', roleAuth(['recepcion', 'admin']), recepcionController.notificarCliente);

module.exports = router; 