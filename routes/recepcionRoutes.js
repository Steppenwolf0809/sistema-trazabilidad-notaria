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
// Ruta adicional para compatibilidad con el formulario de entrega
router.post('/documentos/entrega/:id', validarAccesoConAuditoria(['recepcion']), recepcionController.completarEntrega);

// Nueva ruta para marcar documento como listo para entrega - ESTRICTO: solo recepción
router.post('/documentos/marcar-listo', validarAccesoConAuditoria(['recepcion']), recepcionController.marcarDocumentoListoParaEntrega);

// Ruta para notificar a clientes sobre documentos listos para entrega - ESTRICTO: solo recepción
router.post('/documentos/notificar', validarAccesoConAuditoria(['recepcion']), recepcionController.notificarCliente);

// ============== NUEVAS RUTAS: CONTROL DE NOTIFICACIONES ==============

// Ruta para historial de notificaciones (control global) - ESTRICTO: solo recepción
router.get('/notificaciones/historial', validarAccesoConAuditoria(['recepcion']), recepcionController.historialNotificaciones);

// Ruta para detalle de notificación específica - ESTRICTO: solo recepción
router.get('/notificaciones/detalle/:id', validarAccesoConAuditoria(['recepcion']), recepcionController.obtenerDetalleNotificacion);

module.exports = router; 