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

// Importar modelo Matrizador
const Matrizador = require('../models/Matrizador');

// Middleware de autenticación
const { verificarToken, esAdmin, esMatrizador, esRecepcion } = require('../middlewares/auth');

// Activar la verificación de token para todas las rutas
router.use(verificarToken);

// Panel principal (Dashboard) - Accesible por todos los usuarios autenticados
router.get('/', adminController.dashboard);

// Reportes - Solo para administradores
router.get('/reportes', esAdmin, adminController.reportes);

// Rutas de gestión de documentos - Para admin y matrizadores
router.get('/documentos/registro', esMatrizador, documentoController.mostrarFormularioRegistro);
router.post('/documentos/registrar', esMatrizador, documentoController.registrarDocumento);
router.get('/documentos/listado', documentoController.listarDocumentos); // Todos pueden ver el listado
router.post('/documentos/marcar-listo', esMatrizador, documentoController.marcarComoListo);
router.post('/documentos/cancelar', esMatrizador, documentoController.cancelarDocumento);
router.get('/documentos/detalle/:id', documentoController.mostrarDetalle); // Todos pueden ver detalles

// Rutas para el proceso de entrega - Para admin, matrizadores y recepción
router.get('/documentos/entrega', esRecepcion, documentoController.mostrarEntrega);
router.get('/documentos/entrega/:id', esRecepcion, documentoController.mostrarEntrega);
router.post('/documentos/completar-entrega/:id', esRecepcion, documentoController.completarEntrega);

// Rutas de gestión de matrizadores - Solo para administradores
router.get('/matrizadores', verificarToken, async (req, res, next) => {
  try {
    console.log("Ruta /admin/matrizadores - Usuario:", req.matrizador ? req.matrizador.email : 'No autenticado');
    
    // Verificar si el usuario es admin (pero permitir acceso para pruebas)
    if (req.matrizador && req.matrizador.rol === 'admin') {
      return matrizadorController.obtenerTodos(req, res);
    } else {
      console.log("El usuario no tiene permiso de administrador:", req.matrizador?.rol);
      return res.render('error', {
        layout: 'admin',
        title: 'Acceso denegado',
        message: 'No tiene permisos para acceder a esta página. Se requieren privilegios de administrador.'
      });
    }
  } catch (error) {
    console.error('Error al procesar ruta /admin/matrizadores:', error);
    return res.render('error', {
      layout: 'admin',
      title: 'Error',
      message: 'Error al cargar la lista de matrizadores: ' + error.message
    });
  }
});

router.post('/matrizadores/registro', esAdmin, matrizadorController.crear);
router.post('/matrizadores/actualizar', esAdmin, matrizadorController.actualizar);
router.post('/matrizadores/eliminar', esAdmin, matrizadorController.eliminar);

module.exports = router; 