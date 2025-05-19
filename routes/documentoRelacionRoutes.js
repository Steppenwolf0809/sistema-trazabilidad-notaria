const express = require('express');
const router = express.Router();
const { verificarToken, esMatrizador } = require('../middlewares/auth');
const documentoRelacionController = require('../controllers/documentoRelacionController');

// Rutas para gestión de relaciones entre documentos
router.post('/', verificarToken, esMatrizador, documentoRelacionController.crearRelacion);
router.get('/documento/:idDocumento', verificarToken, esMatrizador, documentoRelacionController.obtenerRelaciones);
router.put('/grupo/estado', verificarToken, esMatrizador, documentoRelacionController.actualizarEstadoGrupo);
router.post('/grupo/:grupoEntrega/codigo', verificarToken, esMatrizador, documentoRelacionController.generarCodigoGrupo);

module.exports = router; 