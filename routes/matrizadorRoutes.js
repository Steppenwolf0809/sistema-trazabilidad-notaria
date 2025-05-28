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

// Dashboard del matrizador - Permitir matrizadores y caja_archivo
router.get('/', validarAccesoConAuditoria(['matrizador', 'caja_archivo']), matrizadorController.dashboard);

// Rutas de matrizador - Permitir matrizadores y caja_archivo
// Listado de documentos
router.get('/documentos', validarAccesoConAuditoria(['matrizador', 'caja_archivo']), matrizadorController.listarDocumentos);
router.get('/documentos/buscar', validarAccesoConAuditoria(['matrizador', 'caja_archivo']), matrizadorController.mostrarBuscarDocumentos);

// Detalle de documento
router.get('/documentos/detalle/:id', validarAccesoConAuditoria(['matrizador', 'caja_archivo']), matrizadorController.detalleDocumento);

// Registro de documento
router.get('/documentos/registro', validarAccesoConAuditoria(['matrizador', 'caja_archivo']), matrizadorController.mostrarFormularioRegistro);
router.post('/documentos/registro', validarAccesoConAuditoria(['matrizador', 'caja_archivo']), matrizadorController.registrarDocumento);

// Rutas para edición de documentos - Permitir matrizadores y caja_archivo
router.get('/documentos/editar/:id', validarAccesoConAuditoria(['matrizador', 'caja_archivo']), documentoController.mostrarFormularioEdicionMatrizador);
router.post('/documentos/editar/:id', validarAccesoConAuditoria(['matrizador', 'caja_archivo']), documentoController.actualizarDocumento);

// Entrega de documento
router.get('/documentos/entrega', validarAccesoConAuditoria(['matrizador', 'caja_archivo']), matrizadorController.mostrarEntrega);
router.get('/documentos/entrega/:id', validarAccesoConAuditoria(['matrizador', 'caja_archivo']), matrizadorController.mostrarEntrega);
router.post('/documentos/completar-entrega/:id', validarAccesoConAuditoria(['matrizador', 'caja_archivo']), matrizadorController.completarEntrega);

// Marcar documento como listo para entrega
router.post('/documentos/marcar-listo', validarAccesoConAuditoria(['matrizador', 'caja_archivo']), matrizadorController.marcarDocumentoListo);

// Marcar documento como visto
router.post('/documentos/marcar-visto/:id', validarAccesoConAuditoria(['matrizador', 'caja_archivo']), matrizadorController.marcarDocumentoVisto);

// Buscar documentos principales para vincular como habilitantes
router.get('/documentos/buscar-principales', validarAccesoConAuditoria(['matrizador', 'caja_archivo']), matrizadorController.buscarDocumentosPrincipales);

// API para obtener documentos principales (para selección de documento habilitante)
router.get('/api/documentos/principales', validarAccesoConAuditoria(['matrizador', 'caja_archivo']), documentoController.obtenerDocumentosPrincipales);

// Rutas de notificaciones
const notificacionController = require('../controllers/notificacionController');
router.get('/notificaciones/historial', validarAccesoConAuditoria(['matrizador', 'caja_archivo']), notificacionController.mostrarHistorial);

// APIs de notificaciones
router.get('/api/notificaciones/:id', validarAccesoConAuditoria(['matrizador', 'caja_archivo']), notificacionController.obtenerDetalleNotificacion);
router.post('/api/notificaciones/:id/reintentar', validarAccesoConAuditoria(['admin']), notificacionController.reintentarNotificacion);

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