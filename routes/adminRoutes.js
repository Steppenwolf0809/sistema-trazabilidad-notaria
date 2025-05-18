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

// Panel principal (Dashboard)
router.get('/', adminController.dashboard);
router.get('/reportes', adminController.reportes);

// Rutas de gestión de documentos
router.get('/documentos/registro', documentoController.mostrarFormularioRegistro);
router.post('/documentos/registrar', documentoController.registrarDocumento);
router.get('/documentos/listado', documentoController.listarDocumentos);
router.post('/documentos/marcar-listo', documentoController.marcarComoListo);
router.post('/documentos/cancelar', documentoController.cancelarDocumento);
router.get('/documentos/detalle/:id', documentoController.mostrarDetalle);

// Rutas para el proceso de entrega
router.get('/documentos/entrega', documentoController.mostrarEntrega);
router.get('/documentos/entrega/:id', documentoController.mostrarEntrega);
router.post('/documentos/completar-entrega/:id', documentoController.completarEntrega);

// Rutas de gestión de matrizadores (pendientes de implementación)
router.get('/matrizadores', (req, res) => {
  res.render('admin/matrizadores', {
    layout: 'admin',
    title: 'Gestión de Matrizadores',
    activeMatrizadores: true
  });
});

module.exports = router; 