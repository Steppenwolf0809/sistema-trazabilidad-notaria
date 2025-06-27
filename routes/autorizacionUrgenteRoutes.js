const express = require('express');
const router = express.Router();
const { 
  solicitarAutorizacion,
  obtenerPendientes,
  obtenerDatos,
  autorizar,
  rechazar,
  marcarVerbal,
  ratificarVerbal
} = require('../controllers/autorizacionUrgenteController');
const { verificarToken } = require('../middlewares/auth');

// ============== RUTAS PARA AUTORIZACIONES URGENTES ==============

/**
 * SOLICITAR AUTORIZACIÓN URGENTE
 * POST /api/autorizaciones-urgentes/solicitar
 * Acceso: Todos los roles (principalmente recepción)
 */
router.post('/solicitar', verificarToken, solicitarAutorizacion);

/**
 * OBTENER AUTORIZACIONES PENDIENTES (PARA ALERTAS EN DASHBOARD)
 * GET /api/autorizaciones-urgentes/pendientes
 * Acceso: Matrizador (sus asignadas), Admin/Caja (todas)
 */
router.get('/pendientes', verificarToken, obtenerPendientes);

/**
 * OBTENER DATOS DE AUTORIZACIÓN ESPECÍFICA
 * GET /api/autorizaciones-urgentes/:id/datos
 * Acceso: Usuarios que pueden autorizar esa solicitud
 */
router.get('/:id/datos', verificarToken, obtenerDatos);

/**
 * AUTORIZAR DIGITALMENTE (FLUJO PREFERIDO)
 * POST /api/autorizaciones-urgentes/:id/autorizar
 * Acceso: Matrizador responsable, Admin, Caja
 */
router.post('/:id/autorizar', verificarToken, autorizar);

/**
 * RECHAZAR AUTORIZACIÓN
 * POST /api/autorizaciones-urgentes/:id/rechazar
 * Acceso: Matrizador responsable, Admin, Caja
 */
router.post('/:id/rechazar', verificarToken, rechazar);

/**
 * MARCAR COMO AUTORIZACIÓN VERBAL (BACKUP)
 * POST /api/autorizaciones-urgentes/:id/verbal
 * Acceso: Recepción cuando no hay respuesta digital
 */
router.post('/:id/verbal', verificarToken, marcarVerbal);

/**
 * RATIFICAR AUTORIZACIÓN VERBAL
 * POST /api/autorizaciones-urgentes/:id/ratificar
 * Acceso: Matrizador responsable (debe ratificar en 24h)
 */
router.post('/:id/ratificar', verificarToken, ratificarVerbal);

module.exports = router; 