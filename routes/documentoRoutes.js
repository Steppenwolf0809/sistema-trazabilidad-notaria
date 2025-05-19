/**
 * Rutas para la gestión de documentos notariales
 * Configura los endpoints para el acceso a las funciones del controlador
 */

const express = require('express');
const router = express.Router();
const { verificarToken, esMatrizador, esRecepcion, esConsulta } = require('../middlewares/auth');
const RegistroAuditoria = require('../models/RegistroAuditoria');
const documentoController = require('../controllers/documentoController');

// Middleware para verificar roles específicos (admin y matrizador)
const esAdminOMatrizador = (req, res, next) => {
  if (req.matrizador && (req.matrizador.rol === 'admin' || req.matrizador.rol === 'matrizador')) {
    next();
  } else {
    return res.status(403).json({
      exito: false,
      mensaje: 'Acceso denegado. Se requieren permisos de administrador o matrizador.'
    });
  }
};

// Simulación de controlador para demo
/* const documentoController = {
  obtenerTodos: (req, res) => {
    res.status(200).json({
      exito: true,
      mensaje: 'Lista de documentos obtenida correctamente',
      datos: [
        {
          id: 1,
          codigoBarras: 'DOC-2023-001',
          tipoDocumento: 'Escritura',
          estado: 'listo_para_entrega'
        },
        {
          id: 2,
          codigoBarras: 'DOC-2023-002',
          tipoDocumento: 'Poder',
          estado: 'en_proceso'
        }
      ]
    });
  },
  
  obtenerPorId: (req, res) => {
    res.status(200).json({
      exito: true,
      mensaje: 'Documento obtenido correctamente',
      datos: {
        id: 1,
        codigoBarras: 'DOC-2023-001',
        tipoDocumento: 'Escritura',
        estado: 'listo_para_entrega',
        nombreCliente: 'Juan Pérez',
        emailCliente: 'juan@example.com'
      }
    });
  },
  
  buscarPorCodigoBarras: (req, res) => {
    res.status(200).json({
      exito: true,
      mensaje: 'Documento encontrado',
      datos: {
        id: 1,
        codigoBarras: 'DOC-2023-001',
        tipoDocumento: 'Escritura',
        estado: 'listo_para_entrega'
      }
    });
  },
  
  verificarCodigo: (req, res) => {
    // Simulación de verificación de código
    const { codigo } = req.body;
    const codigoValido = codigo === '1234'; // Para demo, el código válido es 1234
    
    return res.status(200).json({
      exito: true,
      valido: codigoValido,
      mensaje: codigoValido ? 
        'Código de verificación válido. Puede proceder con la entrega del documento.' : 
        'Código de verificación inválido. No puede entregar el documento.',
      datos: codigoValido ? {
        documento: {
          id: 1,
          tipoDocumento: "Escritura",
          numeroProtocolo: "2023/1234",
          estado: "listo_para_entrega",
          nombreCliente: "Juan Pérez"
        }
      } : null
    });
  },
  
  crear: (req, res) => {
    res.status(201).json({
      exito: true,
      mensaje: 'Documento creado correctamente',
      datos: {
        id: 3,
        codigoBarras: 'DOC-2023-003',
        ...req.body
      }
    });
  },
  
  actualizar: (req, res) => {
    res.status(200).json({
      exito: true,
      mensaje: 'Documento actualizado correctamente',
      datos: {
        id: req.params.id,
        ...req.body
      }
    });
  },
  
  eliminar: (req, res) => {
    res.status(200).json({
      exito: true,
      mensaje: 'Documento eliminado correctamente'
    });
  },
  
  registrarEntrega: (req, res) => {
    res.status(200).json({
      exito: true,
      mensaje: 'Entrega registrada correctamente',
      datos: {
        id: req.params.codigoBarras,
        fechaEntrega: new Date(),
        ...req.body
      }
    });
  },
  
  obtenerHistorial: (req, res) => {
    res.status(200).json({
      exito: true,
      mensaje: 'Historial obtenido correctamente',
      datos: {
        documento: {
          id: req.params.id,
          codigoBarras: 'DOC-2023-001',
          tipoDocumento: 'Escritura'
        },
        eventos: [
          {
            id: 1,
            tipoEvento: 'creacion',
            descripcion: 'Documento creado',
            fecha: '2023-05-01T10:00:00Z'
          },
          {
            id: 2,
            tipoEvento: 'generacion_codigo',
            descripcion: 'Código de verificación generado',
            fecha: '2023-05-10T15:30:00Z'
          }
        ]
      }
    });
  },
  
  obtenerCodigoVerificacion: async (req, res) => {
    try {
      const { id } = req.params;
      
      // Buscar documento en la BD 
      const Documento = require('../models/Documento');
      const documento = await Documento.findByPk(id);
      
      if (!documento) {
        // Registrar intento fallido en auditoría
        await RegistroAuditoria.create({
          idDocumento: parseInt(id),
          idMatrizador: req.matrizador.id,
          accion: 'consulta_codigo',
          resultado: 'fallido',
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          detalles: `Documento no encontrado: ID ${id}`
        });
        
        return res.status(404).json({
          exito: false,
          mensaje: 'Documento no encontrado'
        });
      }
      
      // Registrar consulta exitosa en auditoría
      await RegistroAuditoria.create({
        idDocumento: documento.id,
        idMatrizador: req.matrizador.id,
        accion: 'consulta_codigo',
        resultado: 'exitoso',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        detalles: `Consulta de código de verificación para documento ${documento.tipoDocumento}`
      });
      
      // Devolver el código
      res.status(200).json({
        exito: true,
        mensaje: 'Código de verificación obtenido',
        datos: {
          id: documento.id,
          codigoVerificacion: documento.codigoVerificacion
        }
      });
    } catch (error) {
      console.error('Error al obtener código de verificación:', error);
      res.status(500).json({
        exito: false,
        mensaje: 'Error al obtener código de verificación',
        error: error.message
      });
    }
  },
  
  obtenerDocumentoConRelaciones: (req, res) => {
    // Implementación de la nueva ruta
    res.status(501).json({
      exito: false,
      mensaje: 'Esta ruta no está implementada'
    });
  },
  
  actualizarEstadoConPropagacion: (req, res) => {
    // Implementación de la nueva ruta
    res.status(501).json({
      exito: false,
      mensaje: 'Esta ruta no está implementada'
    });
  },
  
  registrarEntregaConComponentes: (req, res) => {
    // Implementación de la nueva ruta
    res.status(501).json({
      exito: false,
      mensaje: 'Esta ruta no está implementada'
    });
  },
  
  buscarDocumentos: (req, res) => {
    // Implementación de la nueva ruta
    res.status(501).json({
      exito: false,
      mensaje: 'Esta ruta no está implementada'
    });
  },
  
  relacionarDocumentos: (req, res) => {
    // Implementación de la nueva ruta
    res.status(501).json({
      exito: false,
      mensaje: 'Esta ruta no está implementada'
    });
  },
  
  eliminarRelacion: (req, res) => {
    // Implementación de la nueva ruta
    res.status(501).json({
      exito: false,
      mensaje: 'Esta ruta no está implementada'
    });
  },
  
  obtenerPendientesPorMatrizador: (req, res) => {
    // Implementación de la nueva ruta
    res.status(501).json({
      exito: false,
      mensaje: 'Esta ruta no está implementada'
    });
  }
}; */

// Rutas públicas (sin verificación de token)
router.post('/codigo/:codigoBarras/verificar', documentoController.verificarCodigo);
router.get('/buscar/codigo/:codigo', documentoController.buscarPorCodigoBarras);

// Rutas protegidas - Requieren al menos permisos de consulta
router.get('/', verificarToken, esConsulta, documentoController.obtenerTodos);
router.get('/:id', verificarToken, esConsulta, documentoController.obtenerPorId);
router.get('/:id/historial', verificarToken, esConsulta, documentoController.obtenerHistorial);

// Rutas para modificación - Requieren permisos de matrizador
router.post('/', verificarToken, esMatrizador, documentoController.crear);
router.put('/:id', verificarToken, esMatrizador, documentoController.actualizar);
router.delete('/:id', verificarToken, esMatrizador, documentoController.eliminar);

// Rutas para entrega - Requieren permisos de recepción
router.post('/entrega/:codigoBarras', verificarToken, esRecepcion, documentoController.registrarEntrega);

// Rutas para matrizadores y administradores exclusivamente
router.get('/:id/codigo-verificacion', verificarToken, esAdminOMatrizador, documentoController.obtenerCodigoVerificacion);

// Rutas para relaciones entre documentos
router.get('/:id/relaciones', verificarToken, esConsulta, documentoController.obtenerDocumentoConRelaciones);
router.put('/:id/estado-grupo', verificarToken, esMatrizador, documentoController.actualizarEstadoConPropagacion);
router.post('/entrega-grupo/:codigoBarras', verificarToken, esRecepcion, documentoController.registrarEntregaConComponentes);

// Rutas para búsqueda y relaciones de documentos
router.get('/buscar', verificarToken, esConsulta, documentoController.buscarDocumentos);
router.post('/relacionar', verificarToken, esMatrizador, documentoController.relacionarDocumentos);
router.delete('/relacionar', verificarToken, esMatrizador, documentoController.eliminarRelacion);

// Ruta para obtener documentos pendientes del matrizador autenticado
router.get('/pendientes/mios', verificarToken, esMatrizador, documentoController.obtenerPendientesPorMatrizador);

module.exports = router; 