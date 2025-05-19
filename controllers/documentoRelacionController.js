const DocumentoRelacion = require('../models/DocumentoRelacion');
const Documento = require('../models/Documento');
const { Op } = require('sequelize');
const RegistroAuditoria = require('../models/RegistroAuditoria');

const documentoRelacionController = {
  // Crear una nueva relación entre documentos
  crearRelacion: async (req, res) => {
    try {
      const { idDocumentoPrincipal, idDocumentoRelacionado, tipoRelacion, esPrincipal, grupoEntrega, descripcion } = req.body;

      // Verificar que ambos documentos existan
      const [documentoPrincipal, documentoRelacionado] = await Promise.all([
        Documento.findByPk(idDocumentoPrincipal),
        Documento.findByPk(idDocumentoRelacionado)
      ]);

      if (!documentoPrincipal || !documentoRelacionado) {
        return res.status(404).json({
          exito: false,
          mensaje: 'Uno o ambos documentos no existen'
        });
      }

      // Crear la relación
      const relacion = await DocumentoRelacion.create({
        idDocumentoPrincipal,
        idDocumentoRelacionado,
        tipoRelacion,
        esPrincipal,
        grupoEntrega,
        descripcion,
        creadoPor: req.matrizador.id
      });

      // Registrar en auditoría
      await RegistroAuditoria.create({
        idDocumento: idDocumentoPrincipal,
        idMatrizador: req.matrizador.id,
        accion: 'crear_relacion',
        resultado: 'exitoso',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        detalles: `Relación creada con documento ${idDocumentoRelacionado}`
      });

      res.status(201).json({
        exito: true,
        mensaje: 'Relación creada correctamente',
        datos: relacion
      });
    } catch (error) {
      console.error('Error al crear relación:', error);
      res.status(500).json({
        exito: false,
        mensaje: 'Error al crear la relación',
        error: error.message
      });
    }
  },

  // Obtener todas las relaciones de un documento
  obtenerRelaciones: async (req, res) => {
    try {
      const { idDocumento } = req.params;

      // Obtener el documento con sus relaciones
      const documento = await Documento.findByPk(idDocumento, {
        include: [
          {
            model: Documento,
            as: 'componentes',
            through: {
              attributes: ['tipoRelacion', 'esPrincipal', 'grupoEntrega', 'descripcion']
            }
          },
          {
            model: Documento,
            as: 'documentosPrincipales',
            through: {
              attributes: ['tipoRelacion', 'esPrincipal', 'grupoEntrega', 'descripcion']
            }
          }
        ]
      });

      if (!documento) {
        return res.status(404).json({
          exito: false,
          mensaje: 'Documento no encontrado'
        });
      }

      res.status(200).json({
        exito: true,
        mensaje: 'Relaciones obtenidas correctamente',
        datos: {
          componentes: documento.componentes,
          documentosPrincipales: documento.documentosPrincipales
        }
      });
    } catch (error) {
      console.error('Error al obtener relaciones:', error);
      res.status(500).json({
        exito: false,
        mensaje: 'Error al obtener las relaciones',
        error: error.message
      });
    }
  },

  // Actualizar el estado de todos los documentos en un grupo
  actualizarEstadoGrupo: async (req, res) => {
    try {
      const { grupoEntrega, nuevoEstado } = req.body;

      // Obtener el documento principal del grupo
      const documentoPrincipal = await Documento.findOne({
        include: [{
          model: DocumentoRelacion,
          as: 'relacionesComoPrincipal',
          where: { 
            grupoEntrega,
            esPrincipal: true
          }
        }]
      });

      if (!documentoPrincipal) {
        return res.status(404).json({
          exito: false,
          mensaje: 'No se encontró un documento principal para este grupo'
        });
      }

      // Obtener todos los documentos del grupo
      const documentosGrupo = await Documento.findAll({
        include: [{
          model: DocumentoRelacion,
          where: { grupoEntrega }
        }]
      });

      // Actualizar el estado de todos los documentos
      await Promise.all(documentosGrupo.map(doc => 
        doc.update({ estado: nuevoEstado })
      ));

      // Registrar en auditoría
      await RegistroAuditoria.create({
        idDocumento: documentoPrincipal.id,
        idMatrizador: req.matrizador.id,
        accion: 'actualizar_estado_grupo',
        resultado: 'exitoso',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        detalles: `Estado actualizado a ${nuevoEstado} para grupo ${grupoEntrega}`
      });

      res.status(200).json({
        exito: true,
        mensaje: 'Estado actualizado correctamente para todo el grupo',
        datos: { documentosActualizados: documentosGrupo.length }
      });
    } catch (error) {
      console.error('Error al actualizar estado del grupo:', error);
      res.status(500).json({
        exito: false,
        mensaje: 'Error al actualizar el estado del grupo',
        error: error.message
      });
    }
  },

  // Generar código de verificación para un grupo
  generarCodigoGrupo: async (req, res) => {
    try {
      const { grupoEntrega } = req.params;

      // Obtener el documento principal del grupo
      const documentoPrincipal = await Documento.findOne({
        include: [{
          model: DocumentoRelacion,
          as: 'relacionesComoPrincipal',
          where: { 
            grupoEntrega,
            esPrincipal: true
          }
        }]
      });

      if (!documentoPrincipal) {
        return res.status(404).json({
          exito: false,
          mensaje: 'No se encontró un documento principal para este grupo'
        });
      }

      // Generar código único para el grupo
      const codigoVerificacion = Math.random().toString(36).substring(2, 8).toUpperCase();

      // Actualizar el código en el documento principal
      await documentoPrincipal.update({ codigoVerificacion });

      // Registrar en auditoría
      await RegistroAuditoria.create({
        idDocumento: documentoPrincipal.id,
        idMatrizador: req.matrizador.id,
        accion: 'generar_codigo_grupo',
        resultado: 'exitoso',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        detalles: `Código generado para grupo ${grupoEntrega}`
      });

      res.status(200).json({
        exito: true,
        mensaje: 'Código de verificación generado correctamente',
        datos: {
          codigoVerificacion,
          grupoEntrega
        }
      });
    } catch (error) {
      console.error('Error al generar código de grupo:', error);
      res.status(500).json({
        exito: false,
        mensaje: 'Error al generar el código de verificación',
        error: error.message
      });
    }
  }
};

module.exports = documentoRelacionController; 