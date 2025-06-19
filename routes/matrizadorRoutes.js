/**
 * Rutas para la gestión de matrizadores
 * SEGREGACIÓN DE FUNCIONES - Solo procesamiento de documentos asignados
 * ❌ ELIMINADO: Creación de documentos desde cero
 * ✅ MANTIENE: Procesamiento de documentos asignados por Caja
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

// =============== FUNCIONES AUTORIZADAS PARA MATRIZADOR ===============

// Dashboard del matrizador - Permitir matrizadores y caja_archivo
router.get('/', validarAccesoConAuditoria(['matrizador', 'caja_archivo']), matrizadorController.dashboard);

// =============== PROCESAMIENTO DE DOCUMENTOS ASIGNADOS ===============
// NOTA: Matrizador solo puede procesar documentos que le hayan sido asignados por Caja
// NO puede crear documentos desde cero

// Listado de documentos asignados
router.get('/documentos', validarAccesoConAuditoria(['matrizador', 'caja_archivo']), matrizadorController.listarDocumentos);
router.get('/documentos/buscar', validarAccesoConAuditoria(['matrizador', 'caja_archivo']), matrizadorController.mostrarBuscarDocumentos);

// Detalle de documento asignado
router.get('/documentos/detalle/:id', validarAccesoConAuditoria(['matrizador', 'caja_archivo']), matrizadorController.detalleDocumento);

// =============== EDICIÓN DE DOCUMENTOS ASIGNADOS ===============
// Solo puede editar documentos que le han sido asignados
router.get('/documentos/editar/:id', validarAccesoConAuditoria(['matrizador', 'caja_archivo']), documentoController.mostrarFormularioEdicionMatrizador);
router.post('/documentos/editar/:id', validarAccesoConAuditoria(['matrizador', 'caja_archivo']), documentoController.actualizarDocumento);

// =============== MARCADO COMO LISTO Y PROCESAMIENTO ===============
// Función principal del matrizador: procesar y marcar como listo
router.post('/documentos/marcar-listo', validarAccesoConAuditoria(['matrizador', 'caja_archivo']), matrizadorController.marcarDocumentoListo);

// Marcar documento como visto
router.post('/documentos/marcar-visto/:id', validarAccesoConAuditoria(['matrizador', 'caja_archivo']), matrizadorController.marcarDocumentoVisto);

// =============== ENTREGA EXCEPCIONAL (SOLO DOCUMENTOS PROPIOS) ===============
// NOTA: Solo en casos excepcionales, el matrizador puede entregar sus propios documentos
router.get('/documentos/entrega', validarAccesoConAuditoria(['matrizador', 'caja_archivo']), matrizadorController.mostrarEntrega);
router.get('/documentos/entrega/:id', validarAccesoConAuditoria(['matrizador', 'caja_archivo']), matrizadorController.mostrarEntrega);
router.post('/documentos/completar-entrega/:id', validarAccesoConAuditoria(['matrizador', 'caja_archivo']), matrizadorController.completarEntrega);

// API para detectar documentos grupales - LIMITADO: solo sus propios documentos
router.get('/api/documentos/grupales/:identificacion/:documentoId', validarAccesoConAuditoria(['matrizador', 'caja_archivo']), matrizadorController.detectarDocumentosGrupales);

// Endpoint para procesar entrega grupal - LIMITADO: solo sus propios documentos
router.post('/documentos/entrega-grupal/:id', validarAccesoConAuditoria(['matrizador', 'caja_archivo']), matrizadorController.procesarEntregaGrupal);

// =============== FUNCIONES DE BÚSQUEDA Y CONSULTA ===============
// Buscar documentos principales para vincular como habilitantes
router.get('/documentos/buscar-principales', validarAccesoConAuditoria(['matrizador', 'caja_archivo']), matrizadorController.buscarDocumentosPrincipales);

// API para obtener documentos principales (para selección de documento habilitante)
router.get('/api/documentos/principales', validarAccesoConAuditoria(['matrizador', 'caja_archivo']), documentoController.obtenerDocumentosPrincipales);

// =============== NOTIFICACIONES Y HISTORIAL ===============
router.get('/notificaciones/historial', validarAccesoConAuditoria(['matrizador', 'caja_archivo']), matrizadorController.historialNotificaciones);

// API para obtener detalles de notificación
router.get('/api/notificaciones/:id', validarAccesoConAuditoria(['matrizador', 'caja_archivo']), matrizadorController.obtenerDetalleNotificacion);

// =============== LOGOUT ===============
router.get('/logout', matrizadorController.logout);

// =============== ❌ FUNCIONES ELIMINADAS POR SEGREGACIÓN ===============
//
// Las siguientes rutas han sido ELIMINADAS para cumplir con segregación de funciones:
//
// ❌ ELIMINADO: router.get('/documentos/registro', matrizadorController.mostrarFormularioRegistro);
// ❌ ELIMINADO: router.post('/documentos/registro', matrizadorController.registrarDocumento);
//
// JUSTIFICACIÓN:
// - Matrizador NO debe crear documentos desde cero
// - Solo Caja debe controlar el ingreso inicial de documentos
// - Matrizador debe procesar únicamente documentos que le asigne Caja
// - Separación clara entre ingreso (Caja) y procesamiento (Matrizador)
// - Mejor control de la cadena de custodia
// - Cumplimiento de principios de segregación de funciones

// =============== RUTAS ADMINISTRATIVAS (SOLO ADMIN) ===============
// Estas rutas solo están disponibles para administradores
router.get('/api', roleAuth(['admin']), matrizadorController.obtenerTodos);
router.get('/api/:id', roleAuth(['admin']), matrizadorController.obtenerPorId);
router.post('/api', roleAuth(['admin']), matrizadorController.crear);
router.put('/api/:id', roleAuth(['admin']), matrizadorController.actualizar);
router.delete('/api/:id', roleAuth(['admin']), matrizadorController.eliminar);
router.get('/api/:id/qr', roleAuth(['admin']), matrizadorController.generarQR);

// Rutas de administración de matrizadores
router.get('/admin', roleAuth(['admin']), matrizadorController.adminMatrizadores);

module.exports = router; 