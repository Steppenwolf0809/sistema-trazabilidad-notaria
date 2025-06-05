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
const { verificarToken, esMatrizador, esRecepcion, validarAccesoConAuditoria } = require('../middlewares/auth');

// Activar la verificación de token para todas las rutas
router.use(verificarToken);

// Aplicar control de acceso por rol para todas las rutas - Solo admin tiene acceso
router.use(validarAccesoConAuditoria(['admin']));

// Panel principal (Dashboard) - Accesible solo por administradores
router.get('/', adminController.dashboard);

// NUEVO: Dashboard útil (predeterminado)
// CORREGIDO: Aceptar parámetro opcional de período
router.get('/dashboard/:periodo?', adminController.dashboard);
router.get('/dashboard-util', adminController.dashboard);

// Página de alertas
router.get('/alertas', adminController.mostrarAlertas);

// Reportes - Solo para administradores
// RUTAS INDIVIDUALES DE REPORTES - Deben ir ANTES de la ruta general
router.get('/reportes/documentos', adminController.reporteDocumentos);
router.get('/reportes/pendientes', adminController.reportePendientesAdmin);
router.get('/reportes/matrizadores', adminController.reporteMatrizadores);
router.get('/reportes/financiero', adminController.reporteFinanciero);
router.get('/reportes/registros-auditoria', adminController.reporteRegistrosAuditoria);
// NUEVAS RUTAS AÑADIDAS:
router.get('/reportes/cobros-matrizador', adminController.reporteCobrosMatrizador);
router.get('/reportes/productividad-matrizadores', adminController.reporteProductividadMatrizadores);
router.get('/reportes/documentos-sin-pago', adminController.reporteDocumentosSinPago);

// RUTA GENERAL - Debe ir DESPUÉS de las rutas específicas
router.get('/reportes/:tipo?', adminController.reportes);

router.get('/auditoria', adminController.verRegistrosAuditoria);

// Auditoría de eliminaciones - Solo para administradores
router.get('/auditoria-eliminaciones', (req, res) => {
  res.render('admin/auditoria-eliminaciones', {
    layout: 'admin',
    title: 'Auditoría de Eliminaciones',
    activeAuditoriaEliminaciones: true,
    userRole: req.matrizador?.rol,
    userName: req.matrizador?.nombre
  });
});

// Rutas de gestión de documentos - Solo para administradores
router.get('/documentos/registro', documentoController.mostrarFormularioRegistro);
router.post('/documentos/registrar', documentoController.registrarDocumento);
router.get('/documentos/listado', documentoController.listarDocumentos);
router.post('/documentos/marcar-listo', documentoController.marcarComoListo);
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
router.get('/documentos/entrega/:id?', documentoController.mostrarEntrega);
router.post('/documentos/entrega/:id', documentoController.completarEntrega);

// Rutas de gestión de matrizadores - Solo para administradores
router.get('/matrizadores', matrizadorController.obtenerTodos);
router.post('/matrizadores/registro', matrizadorController.crear);
router.post('/matrizadores/actualizar', matrizadorController.actualizar);
router.post('/matrizadores/eliminar', matrizadorController.eliminar);

// NUEVAS RUTAS DE NOTIFICACIONES (copiadas de recepción):
router.get('/notificaciones/historial', adminController.historialNotificaciones);
router.get('/notificaciones/detalle/:id', adminController.obtenerDetalleNotificacion);

module.exports = router; 