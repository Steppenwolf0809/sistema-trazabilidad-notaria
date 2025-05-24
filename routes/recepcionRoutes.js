const express = require('express');
const router = express.Router();
const { verificarToken, validarAccesoConAuditoria } = require('../middlewares/auth');
const recepcionController = require('../controllers/recepcionController');

// Aplicar middleware de verificación de token para todas las rutas
router.use(verificarToken);

// Dashboard de recepción - ESTRICTO: solo recepción
router.get('/', validarAccesoConAuditoria(['recepcion']), recepcionController.dashboard);

// Listado de documentos - ESTRICTO: solo recepción
router.get('/documentos', validarAccesoConAuditoria(['recepcion']), recepcionController.listarDocumentos);

// Detalle de documento - ESTRICTO: solo recepción
router.get('/documentos/detalle/:id', validarAccesoConAuditoria(['recepcion']), recepcionController.detalleDocumento);

// Entrega de documentos - ESTRICTO: solo recepción
router.get('/documentos/entrega', validarAccesoConAuditoria(['recepcion']), recepcionController.mostrarEntrega);
router.get('/documentos/entrega/:id', validarAccesoConAuditoria(['recepcion']), recepcionController.mostrarEntrega);
router.post('/documentos/entrega/:id/confirmar', validarAccesoConAuditoria(['recepcion']), recepcionController.completarEntrega);

// Nueva ruta para marcar documento como listo para entrega - ESTRICTO: solo recepción
router.post('/documentos/marcar-listo', validarAccesoConAuditoria(['recepcion']), recepcionController.marcarDocumentoListoParaEntrega);

// Ruta para notificar a clientes sobre documentos listos para entrega - ESTRICTO: solo recepción
router.post('/documentos/notificar', validarAccesoConAuditoria(['recepcion']), recepcionController.notificarCliente);

module.exports = router; 