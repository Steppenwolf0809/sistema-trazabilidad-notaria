/**
 * Rutas para la gestión de matrizadores
 * Configura los endpoints para el acceso a las funciones del controlador
 */

const express = require('express');
const router = express.Router();
const matrizadorController = require('../controllers/matrizadorController');
const { verificarToken } = require('../middlewares/auth');
const roleAuth = require('../middlewares/roleAuth');

// Rutas públicas
router.post('/login', matrizadorController.login);
router.get('/verificar/:codigo', matrizadorController.verificarQR);

// Middleware global para validar token 
router.use(verificarToken);

// Dashboard del matrizador - Importante: debe definirse antes que las rutas API para evitar conflictos
router.get('/', roleAuth(['matrizador', 'admin']), matrizadorController.dashboard);

// Rutas de matrizador - Solo para matrizadores y admin
// Listado de documentos
router.get('/documentos', roleAuth(['matrizador', 'admin']), matrizadorController.listarDocumentos);

// Detalle de documento
router.get('/documentos/detalle/:id', roleAuth(['matrizador', 'admin']), matrizadorController.detalleDocumento);

// Registro de documento
router.get('/documentos/registro', roleAuth(['matrizador', 'admin']), matrizadorController.mostrarFormularioRegistro);
router.post('/documentos/registro', roleAuth(['matrizador', 'admin']), matrizadorController.registrarDocumento);

// Entrega de documento
router.get('/documentos/entrega', roleAuth(['matrizador', 'admin']), matrizadorController.mostrarEntrega);
router.get('/documentos/entrega/:id', roleAuth(['matrizador', 'admin']), matrizadorController.mostrarEntrega);
router.post('/documentos/entrega/:id', roleAuth(['matrizador', 'admin']), matrizadorController.completarEntrega);

// Marcar documento como listo para entrega
router.post('/documentos/marcar-listo', roleAuth(['matrizador', 'admin']), matrizadorController.marcarDocumentoListo);

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