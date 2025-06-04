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

// RESTAURADO: Registro de pagos
router.get('/documentos/detalle/:id/pago', cajaController.mostrarFormularioRegistrarPago);
router.post('/registrar-pago', upload.none(), cajaController.registrarPago);

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

// Documentos asignados como matrizador
router.get('/mis-documentos', cajaController.misDocumentosMatrizador);
router.get('/mis-documentos/editar/:id', cajaController.editarDocumentoMatrizador);
router.post('/mis-documentos/actualizar/:id', cajaController.actualizarDocumentoMatrizador);
router.post('/mis-documentos/marcar-listo/:id', cajaController.marcarDocumentoListoMatrizador);

// Entrega de documentos desde interfaz de caja
router.get('/entrega-documentos', cajaController.entregaDocumentos);
router.post('/buscar-documento-entrega', cajaController.buscarDocumentoEntrega);
router.post('/procesar-entrega/:id', cajaController.procesarEntregaDocumento);
*/

module.exports = router; 