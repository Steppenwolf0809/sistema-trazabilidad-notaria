/**
 * Rutas administrativas del sistema
 * Define las rutas para la interfaz administrativa interna
 */

const express = require('express');
const router = express.Router();

// Controladores
const adminController = require('../controllers/adminController');
const documentoController = require('../controllers/documentoController');
const matrizadorController = require('../controllers/matrizadorController');

// Importar modelo Matrizador
const Matrizador = require('../models/Matrizador');

// Middleware de autenticación
const { verificarToken, esMatrizador, esRecepcion } = require('../middlewares/auth');
const roleAuth = require('../middlewares/roleAuth');

// Activar la verificación de token para todas las rutas
router.use(verificarToken);

// Aplicar control de acceso por rol para todas las rutas - Solo admin tiene acceso
router.use(roleAuth(['admin']));

// Panel principal (Dashboard) - Accesible solo por administradores
router.get('/', adminController.dashboard);

// Reportes - Solo para administradores
router.get('/reportes', adminController.reportes);
router.get('/auditoria', adminController.verRegistrosAuditoria);

// Rutas de gestión de documentos - Solo para administradores
router.get('/documentos/registro', documentoController.mostrarFormularioRegistro);
router.post('/documentos/registrar', documentoController.registrarDocumento);
router.get('/documentos/listado', documentoController.listarDocumentos);
router.post('/documentos/marcar-listo', documentoController.marcarComoListo);
router.post('/documentos/cancelar', documentoController.cancelarDocumento);
router.get('/documentos/detalle/:id', documentoController.mostrarDetalle);

// Rutas para edición de documentos - Solo para administradores
router.get('/documentos/editar/:id', documentoController.mostrarFormularioEdicionAdmin);
router.post('/documentos/editar/:id', documentoController.actualizarDocumento);

// Rutas para relaciones entre documentos - Solo para administradores
router.get('/documentos/cliente', documentoController.buscarDocumentosCliente);
router.post('/documentos/relacionar', documentoController.relacionarDocumentos);
router.post('/documentos/eliminar-relacion', documentoController.eliminarRelacion);

// Rutas para el proceso de entrega - Solo para administradores
router.get('/documentos/entrega', documentoController.mostrarEntrega);
router.get('/documentos/entrega/:id', documentoController.mostrarEntrega);
router.post('/documentos/completar-entrega/:id', documentoController.completarEntrega);

// Rutas de gestión de matrizadores - Solo para administradores
router.get('/matrizadores', matrizadorController.obtenerTodos);
router.post('/matrizadores/registro', matrizadorController.crear);
router.post('/matrizadores/actualizar', matrizadorController.actualizar);
router.post('/matrizadores/eliminar', matrizadorController.eliminar);

module.exports = router; 