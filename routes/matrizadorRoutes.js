/**
 * Rutas para la gestión de matrizadores
 * Configura los endpoints para el acceso a las funciones del controlador
 */

const express = require('express');
const router = express.Router();
const matrizadorController = require('../controllers/matrizadorController');
const { verificarToken, esAdmin } = require('../middlewares/auth');

// Rutas públicas
router.post('/login', matrizadorController.login);
router.get('/verificar/:codigo', matrizadorController.verificarQR);

// Rutas protegidas (requieren autenticación)
router.get('/', verificarToken, esAdmin, matrizadorController.obtenerTodos);
router.get('/:id', verificarToken, matrizadorController.obtenerPorId);
router.post('/', verificarToken, esAdmin, matrizadorController.crear);
router.put('/:id', verificarToken, esAdmin, matrizadorController.actualizar);
router.delete('/:id', verificarToken, esAdmin, matrizadorController.eliminar);
router.get('/:id/qr', verificarToken, matrizadorController.generarQR);
router.get('/logout', verificarToken, matrizadorController.logout);

// Rutas de vistas
router.get('/admin', verificarToken, esAdmin, matrizadorController.adminMatrizadores);

module.exports = router; 