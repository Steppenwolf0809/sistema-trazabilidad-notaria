/**
 * Rutas para la gestión de documentos notariales
 * Configura los endpoints para el acceso a las funciones del controlador
 */

const express = require('express');
const router = express.Router();

// Simulación de controlador para demo
const documentoController = {
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
  }
};

// Rutas básicas CRUD
router.get('/', documentoController.obtenerTodos);
router.get('/:id', documentoController.obtenerPorId);
router.post('/', documentoController.crear);
router.put('/:id', documentoController.actualizar);
router.delete('/:id', documentoController.eliminar);

// Rutas de búsqueda
router.get('/buscar/codigo/:codigo', documentoController.buscarPorCodigoBarras);

// Rutas para trazabilidad
router.get('/:id/historial', documentoController.obtenerHistorial);
router.post('/codigo/:codigoBarras/verificar', documentoController.verificarCodigo);
router.post('/entrega/:codigoBarras', documentoController.registrarEntrega);

module.exports = router; 