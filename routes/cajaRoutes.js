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

// Middleware para verificar que el usuario tiene rol de caja o admin
router.use(roleAuth(['caja', 'admin']));

// Dashboard de Caja
router.get('/', cajaController.dashboard);
router.post('/dashboard/filtrar', cajaController.filtrarDashboard);

// Rutas para gestión de documentos
router.get('/documentos', cajaController.listarDocumentos);
router.get('/documentos/detalle/:id', cajaController.verDocumento);
router.get('/documentos/registro', cajaController.mostrarFormularioRegistro);
router.post('/documentos/registro', cajaController.registrarDocumento);

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

// Rutas para funcionalidades adicionales de reportes
router.post('/reportes/recordar-pago/:id', cajaController.recordarPagoIndividual);
router.post('/reportes/recordar-masivo', cajaController.recordarPagoMasivo);
router.get('/reportes/exportar-pendientes', cajaController.exportarPendientes);
router.get('/reportes/pendientes-pdf', cajaController.generarPdfPendientes);
router.post('/documentos/marcar-pagado/:id', cajaController.marcarComoPagado);

// Exportar router
module.exports = router; 