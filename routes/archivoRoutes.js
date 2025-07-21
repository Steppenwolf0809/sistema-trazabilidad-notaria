/**
 * Rutas para el módulo de Archivo
 * Define las rutas para usuarios con rol de Archivo
 */

const express = require('express');
const router = express.Router();
const archivoController = require('../controllers/archivoController');
const { verificarToken, validarAccesoConAuditoria } = require('../middlewares/auth');
const { esArchivo } = require('../middlewares/roleAuth');

// Aplicar verificación de token a todas las rutas
router.use(verificarToken);

// Aplicar middleware específico para rol archivo
router.use(esArchivo);

// ============== RUTAS PRINCIPALES ==============

// Dashboard del archivo
router.get('/', archivoController.dashboard);

// ============== RUTAS DE DOCUMENTOS ==============

// Ruta por defecto para documentos - redirige a todos los documentos
router.get('/documentos', (req, res) => {
  res.redirect('/archivo/documentos/todos');
});

// Listar TODOS los documentos del sistema (solo lectura para ajenos)
router.get('/documentos/todos', archivoController.listarTodosDocumentos);

// Listar MIS documentos (solo los asignados al usuario archivo)
router.get('/documentos/mis-documentos', archivoController.listarMisDocumentos);

// Ver detalle de cualquier documento
router.get('/documentos/detalle/:id', archivoController.verDetalleDocumento);

// 🆕 NUEVO: Editar sección específica del documento (solo notas para documentos propios)
router.patch('/documentos/:id/seccion/:seccion', archivoController.editarSeccionDocumento);

// Ruta para buscar documentos del mismo cliente (para documentos habilitantes)
router.get('/api/documentos/mismo-cliente', esArchivo, archivoController.buscarDocumentosMismoCliente);

// ============== RUTAS DE NOTIFICACIONES ==============

// Historial de notificaciones (solo de documentos propios)
router.get('/notificaciones/historial', archivoController.historialNotificaciones);

// Detalle de notificación específica
router.get('/notificaciones/detalle/:id', archivoController.obtenerDetalleNotificacion);

// ============== RUTAS DE NOTIFICACIONES GRUPALES ==============

// API: Detectar documentos del mismo cliente para agrupar en notificación
router.get('/api/documentos/:documentoId/detectar-notificacion', archivoController.detectarDocumentosParaNotificacion);

// API: Crear grupo de notificación con documentos seleccionados
router.post('/api/grupos-notificacion/crear', archivoController.crearGrupoNotificacion);

// API: Separar documento de su grupo de notificación
router.post('/api/grupos-notificacion/:documentoId/separar', archivoController.separarDeGrupoNotificacion);

// API: Detectar documentos grupales del mismo cliente
router.get('/api/documentos-grupales/:identificacion/:documentoId', archivoController.detectarDocumentosGrupales);

// API: Procesar entrega grupal (solo documentos propios del archivo)
router.post('/api/documentos/:id/entrega-grupal', archivoController.procesarEntregaGrupal);

// API: Marcar documento como listo con detección de grupo
router.post('/api/documentos/:id/marcar-listo-grupo', archivoController.marcarComoListo);

// ============== RUTAS DE GESTIÓN DE DOCUMENTOS PROPIOS ==============

// REGISTRO ELIMINADO - Los documentos se crean desde caja

// Formulario de edición (solo para documentos propios)
router.get('/documentos/editar/:id', archivoController.mostrarFormularioEdicion);
router.post('/documentos/editar/:id', archivoController.actualizarDocumento);

// Marcar documento como listo (solo documentos propios)
router.post('/documentos/marcar-listo/:id', archivoController.marcarComoListo);

// NUEVA RUTA: Marcar documento como listo con sistema de autorizaciones
router.post('/documentos/:id/marcar-listo', archivoController.marcarComoListo);

// Entrega de documentos (solo documentos propios)
router.get('/documentos/entrega/:id', archivoController.mostrarFormularioEntrega);
router.post('/documentos/entrega/:id', archivoController.entregarDocumento);

module.exports = router; 