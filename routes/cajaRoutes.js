/**
 * Rutas para el módulo de Caja
 * Define las rutas para usuarios con rol de Caja
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const cajaController = require('../controllers/cajaController');
const { verificarToken, validarAccesoConAuditoria } = require('../middlewares/auth');
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
  if (file.mimetype === 'application/xml' || path.extname(file.originalname).toLowerCase() === '.xml') {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos XML'), false);
  }
};

// Inicializar middleware de multer
const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB max
});

// Middleware global para validar token 
router.use(verificarToken);

// Middleware ESTRICTO - Solo usuarios con rol 'caja' o 'caja_archivo' pueden acceder
router.use(validarAccesoConAuditoria(['caja', 'caja_archivo']));

// Dashboard de Caja
router.get('/', cajaController.dashboard);
router.post('/dashboard/filtrar', cajaController.filtrarDashboard);

// Rutas para gestión de documentos
router.get('/documentos', cajaController.listarDocumentos);
router.get('/documentos/detalle/:id', cajaController.verDocumento);
router.get('/documentos/registro', cajaController.mostrarFormularioRegistro);
router.post('/documentos/registro', cajaController.registrarDocumento);

// ============== NUEVAS RUTAS PARA FUNCIONALIDAD HÍBRIDA CAJA_ARCHIVO ==============

// Nueva ruta para "Mis Documentos" que mantenga interfaz de caja
router.get('/mis-documentos', 
  roleAuth.esCajaArchivo,  // Solo para usuarios caja_archivo
  cajaController.misDocumentosMatrizador
);

// Rutas para editar documentos desde interfaz de caja
router.get('/documentos/editar/:id', 
  roleAuth.esCajaArchivo, 
  cajaController.editarDocumentoMatrizador
);

router.post('/documentos/editar/:id', 
  roleAuth.esCajaArchivo, 
  cajaController.actualizarDocumentoMatrizador
);

// Ruta para marcar documento como listo desde interfaz de caja
router.post('/documentos/marcar-listo/:id', 
  roleAuth.esCajaArchivo, 
  cajaController.marcarDocumentoListoMatrizador
);

// Rutas para registro de documentos vía XML
router.get('/documentos/nuevo-xml', cajaController.mostrarFormularioXML);
router.post('/documentos/procesar-xml', upload.single('xmlFile'), cajaController.procesarXML);
router.post('/documentos/registrar-xml', cajaController.registrarDocumentoXML);

// Rutas para gestión de pagos
router.get('/pagos', cajaController.listarPagos);
router.post('/pagos/registrar', cajaController.registrarPago);
router.post('/pagos/confirmar/:id', cajaController.confirmarPago);

// Ruta para cambiar matrizador - Ahora desde modal en el listado
router.post('/documentos/cambiar-matrizador', cajaController.cambiarMatrizador);

// Rutas para reportes
router.get('/reportes', cajaController.reportes);
router.get('/reportes/financiero', cajaController.reporteFinanciero);
router.get('/reportes/matrizadores', cajaController.reporteMatrizadores);
router.get('/reportes/documentos', cajaController.reporteDocumentos);
router.get('/reportes/pendientes', cajaController.reportePendientes);
router.get('/reportes/cobros-matrizador', cajaController.reporteCobrosMatrizador);

// Rutas para funcionalidades adicionales de reportes
router.post('/reportes/recordar-pago/:id', cajaController.recordarPagoIndividual);
router.post('/reportes/recordar-masivo', cajaController.recordarPagoMasivo);
router.get('/reportes/exportar-pendientes', cajaController.exportarPendientes);
router.get('/reportes/pendientes-pdf', cajaController.generarPdfPendientes);
router.post('/documentos/marcar-pagado/:id', cajaController.marcarComoPagado);

// ============== NUEVAS RUTAS PARA ENTREGA DE DOCUMENTOS EN INTERFAZ CAJA ==============

// Entrega de documentos para caja_archivo (mantiene interfaz caja)
router.get('/entrega-documentos', 
  roleAuth.esCajaArchivo, 
  cajaController.entregaDocumentos
);

router.post('/entrega-documentos/buscar', 
  roleAuth.esCajaArchivo, 
  cajaController.buscarDocumentoEntrega
);

router.post('/entrega-documentos/procesar/:id', 
  roleAuth.esCajaArchivo, 
  cajaController.procesarEntregaDocumento
);

// Exportar router
module.exports = router; 