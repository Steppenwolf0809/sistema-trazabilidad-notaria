/**
 * Rutas administrativas del sistema
 * SEGREGACIÓN DE FUNCIONES - Solo supervisión y reportes
 * ❌ ELIMINADO: Creación, registro y entrega de documentos
 * ✅ MANTIENE: Dashboard, reportes, auditoría y gestión de usuarios
 */

const express = require('express');
const router = express.Router();

// Controladores
const adminController = require('../controllers/adminController');
const matrizadorController = require('../controllers/matrizadorController');

// Importar modelo Matrizador
const Matrizador = require('../models/Matrizador');

// Middleware de autenticación
const { verificarToken, validarAccesoConAuditoria } = require('../middlewares/auth');

// Activar la verificación de token para todas las rutas
router.use(verificarToken);

// Aplicar control de acceso por rol para todas las rutas - Solo admin tiene acceso
router.use(validarAccesoConAuditoria(['admin']));

// =============== FUNCIONES AUTORIZADAS PARA ADMIN ===============

// Panel principal (Dashboard) - SUPERVISIÓN ÚNICAMENTE
router.get('/', adminController.dashboard);
router.get('/dashboard/:periodo?', adminController.dashboard);
router.get('/dashboard-util', adminController.dashboard);

// Página de alertas - SUPERVISIÓN
router.get('/alertas', adminController.mostrarAlertas);

// =============== REPORTES Y ANÁLISIS - FUNCIÓN PRINCIPAL DE ADMIN ===============
router.get('/reportes/documentos', adminController.reporteDocumentos);
router.get('/reportes/pendientes', adminController.reportePendientesAdmin);
router.get('/reportes/matrizadores', adminController.reporteMatrizadores);
router.get('/reportes/financiero', adminController.reporteFinanciero);
router.get('/reportes/registros-auditoria', adminController.reporteRegistrosAuditoria);
router.get('/reportes/cobros-matrizador', adminController.reporteCobrosMatrizador);
router.get('/reportes/productividad-matrizadores', adminController.reporteProductividadMatrizadores);
router.get('/reportes/documentos-sin-pago', adminController.reporteDocumentosSinPago);

// RUTA GENERAL DE REPORTES - Debe ir DESPUÉS de las rutas específicas
router.get('/reportes/:tipo?', adminController.reportes);

// =============== AUDITORÍA Y CONTROL - FUNCIÓN CLAVE DE ADMIN ===============
router.get('/auditoria', adminController.verRegistrosAuditoria);

// Auditoría de eliminaciones - Control de integridad
router.get('/auditoria-eliminaciones', (req, res) => {
  res.render('admin/auditoria-eliminaciones', {
    layout: 'admin',
    title: 'Auditoría de Eliminaciones',
    activeAuditoriaEliminaciones: true,
    userRole: req.matrizador?.rol,
    userName: req.matrizador?.nombre
  });
});

// =============== GESTIÓN DE USUARIOS - FUNCIÓN ADMINISTRATIVA ===============
router.get('/matrizadores', matrizadorController.obtenerTodos);
router.post('/matrizadores/registro', matrizadorController.crear);
router.post('/matrizadores/actualizar', matrizadorController.actualizar);
router.post('/matrizadores/eliminar', matrizadorController.eliminar);

// =============== CONSULTA DE DOCUMENTOS - SOLO LECTURA ===============
// NOTA: Admin puede VER documentos para supervisión, pero NO crear, editar o entregar
router.get('/documentos/listado', adminController.listarDocumentosAdmin);
router.get('/documentos/detalle/:id', adminController.verDetalleDocumentoAdmin);

// =============== NOTIFICACIONES - SUPERVISIÓN ===============
router.get('/notificaciones/historial', adminController.historialNotificaciones);
router.get('/notificaciones/detalle/:id', adminController.obtenerDetalleNotificacion);

// =============== ❌ FUNCIONES ELIMINADAS POR SEGREGACIÓN ===============
// 
// Las siguientes funciones han sido ELIMINADAS para fortalecer controles de auditoría:
//
// ❌ ELIMINADO: router.get('/documentos/registro', documentoController.mostrarFormularioRegistro);
// ❌ ELIMINADO: router.post('/documentos/registrar', documentoController.registrarDocumento);
// ❌ ELIMINADO: router.post('/documentos/marcar-listo', documentoController.marcarComoListo);
// ❌ ELIMINADO: router.get('/documentos/editar/:id', documentoController.mostrarFormularioEdicionAdmin);
// ❌ ELIMINADO: router.post('/documentos/editar/:id', documentoController.actualizarDocumento);
// ❌ ELIMINADO: router.get('/documentos/cliente', documentoController.buscarDocumentosCliente);
// ❌ ELIMINADO: router.post('/documentos/relacionar', documentoController.relacionarDocumentos);
// ❌ ELIMINADO: router.post('/documentos/eliminar-relacion', documentoController.eliminarRelacion);
// ❌ ELIMINADO: router.get('/documentos/entrega', adminController.mostrarEntregaAdmin);
// ❌ ELIMINADO: router.get('/documentos/entrega/:id?', adminController.mostrarEntregaAdmin);
// ❌ ELIMINADO: router.post('/documentos/entrega/:id', adminController.completarEntregaAdmin);
// ❌ ELIMINADO: router.get('/api/documentos/grupales/:identificacion/:documentoId', adminController.detectarDocumentosGrupalesAdmin);
// ❌ ELIMINADO: router.post('/api/documentos/entrega-grupal/:id', adminController.procesarEntregaGrupalAdmin);
//
// JUSTIFICACIÓN: 
// - Admin supervisa, no opera directamente en la cadena de custodia
// - Separación clara entre supervisión y operación
// - Cumplimiento de principios de auditoría y control interno
// - Reducción de riesgo de fraude interno
// - Mejor trazabilidad de responsabilidades

module.exports = router; 