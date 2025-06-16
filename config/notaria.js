/**
 * Configuración centralizada de datos de la notaría
 * Este archivo contiene todos los datos públicos de la notaría que se usan en mensajes y notificaciones
 */

const configNotaria = {
  nombre: "NOTARÍA 18",
  nombreCompleto: "Notaría Décima Octava",
  direccion: "Quito, Ecuador",
  horario: "Lunes a Viernes 8:00-17:00",
  telefono: null, // No se muestra en mensajes por seguridad
  website: null,  // No se muestra en mensajes por seguridad
  
  // Plantillas de mensajes
  plantillas: {
    documentoListo: {
      whatsapp: `🏛️ *NOTARÍA 18*

¡Su documento está listo para retirar!

📄 *Trámite:* {{tipoDocumento}}{{contextoTramite}}
📋 *Documento:* {{codigoBarras}}
🔢 *Código de verificación:* {{codigoVerificacion}}
👤 *Cliente:* {{nombreCliente}}

📍 Retírelo en: Notaría Décima Octava
🕒 Horario: Lunes a Viernes 8:00-17:00

⚠️ *IMPORTANTE:* Presente el código de verificación y su cédula para el retiro.`,

      email: {
        subject: "Documento listo para retiro - Notaría 18",
        template: "documento-listo"
      }
    },
    
    documentoEntregado: {
      whatsapp: `🏛️ *NOTARÍA 18*

✅ *DOCUMENTO ENTREGADO EXITOSAMENTE*

📄 *Documento:* {{tipoDocumento}}{{contextoTramite}}
📋 *Código:* {{codigoBarras}}
👤 *Cliente:* {{nombreCliente}}

📦 *DETALLES DE LA ENTREGA:*
👨‍💼 *Retirado por:* {{nombreReceptor}}
🆔 *Identificación:* {{identificacionCensurada}}
👥 *Relación:* {{relacionReceptor}}

📅 *Fecha:* {{fechaEntrega}}
🕒 *Hora:* {{horaEntrega}}
📍 *Lugar:* Notaría Décima Octava, Quito

✅ *Su trámite ha sido completado exitosamente.*

_Guarde este mensaje como comprobante de entrega._`,

      email: {
        subject: "Documento entregado - {{codigoBarras}} - Notaría 18",
        template: "confirmacion-entrega"
      }
    },
    
    entregaGrupal: {
      whatsapp: `🏛️ *NOTARÍA 18*

✅ *ENTREGA GRUPAL COMPLETADA EXITOSAMENTE*

👤 *Cliente:* {{nombreCliente}}
📦 *Total de documentos:* {{totalDocumentos}}

📄 *DOCUMENTOS ENTREGADOS:*
{{listaDocumentos}}

📦 *DETALLES DE LA ENTREGA:*
👨‍💼 *Retirado por:* {{nombreReceptor}}
🆔 *Identificación:* {{identificacionCensurada}}
👥 *Relación:* {{relacionReceptor}}

📅 *Fecha:* {{fechaEntrega}}
🕒 *Hora:* {{horaEntrega}}
📍 *Lugar:* Notaría Décima Octava, Quito

✅ *Todos sus trámites han sido completados exitosamente.*

_Guarde este mensaje como comprobante de entrega grupal._`,

      email: {
        subject: "Entrega Grupal Completada - {{totalDocumentos}} documentos - Notaría 18",
        template: "confirmacion-entrega-grupal"
      }
    }
  }
};

module.exports = configNotaria; 