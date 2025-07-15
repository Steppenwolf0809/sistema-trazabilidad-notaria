/**
 * Rutas para el módulo de Caja
 * Define las rutas para usuarios con rol de Caja
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const cajaController = require('../controllers/cajaController');
const { verificarToken } = require('../middlewares/auth');
const roleAuth = require('../middlewares/roleAuth');

// Configurar multer para subir archivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../temp')); // Directorio temporal para archivos
  },
  filename: function (req, file, cb) {
    cb(null, 'temp_' + Date.now() + path.extname(file.originalname)); // Nombre temporal único
  }
});

// Filtro para aceptar solo archivos XML
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'text/xml' || file.mimetype === 'application/xml' || file.originalname.toLowerCase().endsWith('.xml')) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos XML'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB máximo
  }
});

// SIMPLIFICADO: Solo middlewares esenciales
router.use(verificarToken);
router.use(roleAuth(['caja', 'caja_archivo']));

// ============== RUTAS ACTIVAS (FUNCIONES IMPLEMENTADAS) ==============

// Dashboard de caja
router.get('/', cajaController.dashboard);

// RESTAURADO: Gestión de documentos
router.get('/documentos', cajaController.listarDocumentos);
router.get('/documentos/detalle/:id', cajaController.verDocumento);

// ELIMINADO: Caja no tiene permisos para editar documentos completos
// Solo puede manejar aspectos financieros a través de las funciones de reversión

// RESTAURADO: Registro de pagos
router.get('/documentos/detalle/:id/pago', cajaController.mostrarFormularioRegistrarPago);
router.post('/registrar-pago', upload.none(), cajaController.registrarPago);

// 🆕 NUEVO: Rutas para corrección de pagos
router.post('/documentos/:id/corregir-pago', cajaController.corregirDatosPago);
router.post('/documentos/:id/revertir-pago', cajaController.revertirPago);

// NUEVO: Procesamiento de XML de retención (ÚNICO método soportado)
router.post('/procesar-xml-retencion', upload.single('xmlRetencion'), cajaController.procesarXMLRetencion);

// RESTAURADO: Filtros AJAX
router.post('/dashboard/filtrar', cajaController.filtrarDashboard);

// ============== RUTAS RESTAURADAS PARA EVITAR 404 ==============

// Carga de documentos desde XML (RESTAURADA)
router.get('/documentos/nuevo-xml', (req, res) => {
  res.render('caja/documentos/nuevo-xml', {
    layout: 'caja',
    title: 'Cargar Documento XML',
    userRole: req.matrizador?.rol,
    userName: req.matrizador?.nombre
  });
});

// CRÍTICO: Procesamiento de XML de documentos
router.post('/documentos/procesar-xml', upload.single('xmlFile'), cajaController.procesarXMLDocumento);

// NUEVO: Registrar documento después de vista previa
router.post('/documentos/registrar-desde-xml', cajaController.registrarDocumentoDesdeXML);

// Gestión de pagos (RESTAURADA)
router.get('/pagos', cajaController.listarPagos);

// ✅ NUEVO: Pago en lote
router.post('/documentos/pago-lote', cajaController.registrarPagoLote);

// Reportes (RESTAURADA)
router.get('/reportes', (req, res) => {
  res.render('caja/reportes/index', {
    layout: 'caja',
    title: 'Reportes de Caja',
    userRole: req.matrizador?.rol,
    userName: req.matrizador?.nombre
  });
});

// RESTAURADO: Reportes específicos
router.get('/reportes/financiero', cajaController.reporteFinanciero);
router.get('/reportes/documentos', cajaController.reporteDocumentos);
router.get('/reportes/pendientes', cajaController.reportePendientes);
router.get('/reportes/cobros-matrizador', cajaController.reporteCobrosMatrizador);

// ============== NUEVAS RUTAS: SISTEMA DE ELIMINACIÓN ==============

// Eliminar documento con justificación (solo POST - operación crítica)
router.post('/documentos/eliminar/:id', cajaController.eliminarDocumento);

// NUEVO: Ruta DELETE para AJAX (misma función, diferente método HTTP)
router.delete('/documentos/:id/eliminar', cajaController.eliminarDocumento);

// Vista de documentos eliminados para auditoría
router.get('/documentos/eliminados', cajaController.listarDocumentosEliminados);

// ============== SISTEMA DE REVERSIÓN DISTRIBUIDA - CAJA ==============
// Solo Caja puede realizar reversiones financieras

// Deshacer pago específico
router.post('/pagos/:id/deshacer', cajaController.deshacerPago);

// Corregir pago (método o monto)
router.post('/pagos/:id/corregir', cajaController.corregirPago);

// Deshacer retención
router.post('/retenciones/:id/deshacer', cajaController.deshacerRetencion);

// ============== REVERSIONES PARA PAGOS VIRTUALES ==============
// Pagos registrados directamente en el documento al momento de creación

// Corregir pago virtual (actualiza campos del documento)
router.post('/documentos/:id/corregir-pago-virtual', cajaController.corregirPagoVirtual);

// Deshacer pago virtual (resetea campos de pago del documento)
router.post('/documentos/:id/deshacer-pago-virtual', cajaController.deshacerPagoVirtual);

// ============== RUTAS TEMPORALMENTE DESHABILITADAS ==============
// TODO: Implementar estas funciones en el controlador cuando sea necesario

/*
// Gestión de pagos avanzada
router.post('/pagos/confirmar/:id', cajaController.confirmarPago);

// Cambio de matrizador
router.get('/documentos/cambiar-matrizador/:id', cajaController.mostrarFormularioCambioMatrizador);
router.post('/documentos/cambiar-matrizador', cajaController.cambiarMatrizador);

// Carga de documentos desde XML (funcionalidad completa)
router.post('/documentos/procesar-xml', upload.single('xmlFile'), cajaController.procesarXML);
router.post('/documentos/registrar-xml', cajaController.registrarDocumentoXML);

// Reportes adicionales
router.get('/reportes/matrizadores', cajaController.reporteMatrizadores);
router.get('/reportes/cobros-matrizador', cajaController.reporteCobrosMatrizador);

// Registro manual de documentos
router.get('/documentos/registro', cajaController.mostrarFormularioRegistro);
router.post('/documentos/registrar', cajaController.registrarDocumento);

// Entrega de documentos
router.get('/documentos/entrega', cajaController.mostrarFormularioEntrega);
router.post('/documentos/entregar/:id', cajaController.entregarDocumento);

// Recordatorios de pago
router.post('/recordar-pago/:id', cajaController.recordarPagoIndividual);
router.post('/recordar-pago-masivo', cajaController.recordarPagoMasivo);

// Exportaciones
router.get('/exportar-pendientes', cajaController.exportarPendientes);
router.get('/generar-pdf-pendientes', cajaController.generarPdfPendientes);

// Marcar como pagado
router.post('/marcar-pagado/:id', cajaController.marcarComoPagado);

// ============== RUTAS PARA ROL HÍBRIDO CAJA_ARCHIVO ==============

// Documentos asignados como matrizador (solo para caja_archivo híbrido)
router.get('/mis-documentos', cajaController.misDocumentosMatrizador);
// ELIMINADO: Edición - Caja no puede editar documentos completos
router.post('/mis-documentos/marcar-listo/:id', cajaController.marcarDocumentoListoMatrizador);

// Entrega de documentos desde interfaz de caja
router.get('/entrega-documentos', cajaController.entregaDocumentos);
router.post('/buscar-documento-entrega', cajaController.buscarDocumentoEntrega);
router.post('/procesar-entrega/:id', cajaController.procesarEntregaDocumento);
*/

module.exports = router; 