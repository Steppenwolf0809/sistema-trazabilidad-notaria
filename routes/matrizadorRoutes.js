/**
 * Rutas para la gestión de matrizadores
 * Configura los endpoints para el acceso a las funciones del controlador
 */

const express = require('express');
const router = express.Router();
const matrizadorController = require('../controllers/matrizadorController');
const { verificarToken, validarAccesoConAuditoria } = require('../middlewares/auth');
const roleAuth = require('../middlewares/roleAuth');
const documentoController = require('../controllers/documentoController');

// Rutas públicas
router.post('/login', matrizadorController.login);
router.get('/verificar/:codigo', matrizadorController.verificarQR);

// Middleware global para validar token 
router.use(verificarToken);

// Dashboard del matrizador - ESTRICTO: solo matrizadores
router.get('/', validarAccesoConAuditoria(['matrizador']), matrizadorController.dashboard);

// Rutas de matrizador - ESTRICTO: solo matrizadores
// Listado de documentos
router.get('/documentos', validarAccesoConAuditoria(['matrizador']), matrizadorController.listarDocumentos);
router.get('/documentos/buscar', validarAccesoConAuditoria(['matrizador']), matrizadorController.mostrarBuscarDocumentos);

// Detalle de documento
router.get('/documentos/detalle/:id', validarAccesoConAuditoria(['matrizador']), matrizadorController.detalleDocumento);

// Registro de documento
router.get('/documentos/registro', validarAccesoConAuditoria(['matrizador']), matrizadorController.mostrarFormularioRegistro);
router.post('/documentos/registro', validarAccesoConAuditoria(['matrizador']), matrizadorController.registrarDocumento);

// Rutas para edición de documentos - Solo para matrizadores
router.get('/documentos/editar/:id', validarAccesoConAuditoria(['matrizador']), documentoController.mostrarFormularioEdicionMatrizador);
router.post('/documentos/editar/:id', validarAccesoConAuditoria(['matrizador']), documentoController.actualizarDocumento);

// Entrega de documento
router.get('/documentos/entrega', validarAccesoConAuditoria(['matrizador']), matrizadorController.mostrarEntrega);
router.get('/documentos/entrega/:id', validarAccesoConAuditoria(['matrizador']), matrizadorController.mostrarEntrega);
router.post('/documentos/completar-entrega/:id', validarAccesoConAuditoria(['matrizador']), matrizadorController.completarEntrega);

// Marcar documento como listo para entrega
router.post('/documentos/marcar-listo', validarAccesoConAuditoria(['matrizador']), matrizadorController.marcarDocumentoListo);

// Marcar documento como visto
router.post('/documentos/marcar-visto/:id', validarAccesoConAuditoria(['matrizador']), matrizadorController.marcarDocumentoVisto);

// Rutas de logout - Disponible para todos los usuarios
router.get('/logout', matrizadorController.logout);

// Rutas API - Solo para administradores (deben definirse al final para no interferir con las rutas anteriores)
router.get('/api', roleAuth(['admin']), matrizadorController.obtenerTodos);
router.get('/api/:id', roleAuth(['admin']), matrizadorController.obtenerPorId);
router.post('/api', roleAuth(['admin']), matrizadorController.crear);
router.put('/api/:id', roleAuth(['admin']), matrizadorController.actualizar);
router.delete('/api/:id', roleAuth(['admin']), matrizadorController.eliminar);
router.get('/api/:id/qr', roleAuth(['admin']), matrizadorController.generarQR);

// Rutas de administración - Solo para administradores
router.get('/admin', roleAuth(['admin']), matrizadorController.adminMatrizadores);

module.exports = router; 