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

module.exports = router; 