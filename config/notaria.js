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
      // ✅ NUEVO: Plantilla para documentos PAGADOS
      whatsappPagado: "🏛️ *NOTARÍA 18*\n\n¡Su documento está listo para retirar!\n\n📄 *Trámite:* {{tipoDocumento}}{{contextoTramite}}\n📋 *Documento:* {{codigoBarras}}\n👤 *Cliente:* {{nombreCliente}}\n\n✅ *PAGO CONFIRMADO*\n🔢 *Código de retiro:* {{codigoVerificacion}}\n\n📋 *PARA RETIRAR:*\n• Presentar código de retiro\n• Presentar identificación\n\n📍 *Ubicación:* Notaría Décima Octava\n🕒 *Horario:* Lunes a Viernes 8:00-17:00\n\nGracias por confiar en nosotros.",

      // ✅ NUEVO: Plantilla para documentos NO PAGADOS
      whatsappNoPagado: "🏛️ *NOTARÍA 18*\n\n¡Su documento está listo para retirar!\n\n📄 *Trámite:* {{tipoDocumento}}{{contextoTramite}}\n📋 *Documento:* {{codigoBarras}}\n👤 *Cliente:* {{nombreCliente}}\n\n⚠️ *IMPORTANTE: PAGO PENDIENTE*\n💰 *Valor a pagar:* ${{valorFactura}}\n🔢 *Código de retiro:* {{codigoVerificacion}}\n\n📋 *PASOS PARA RETIRAR:*\n1️⃣ Realizar el pago en caja\n2️⃣ Presentar código de retiro\n3️⃣ Retirar documento\n\n📍 *Ubicación:* Notaría Décima Octava\n🕒 *Horario:* Lunes a Viernes 8:00-17:00\n\nGracias por confiar en nosotros.",

      // ✅ NUEVO: Plantilla para documentos con PAGO PARCIAL
      whatsappPagoParcial: "🏛️ *NOTARÍA 18*\n\n¡Su documento está listo para retirar!\n\n📄 *Trámite:* {{tipoDocumento}}{{contextoTramite}}\n📋 *Documento:* {{codigoBarras}}\n👤 *Cliente:* {{nombreCliente}}\n\n⚠️ *PAGO PARCIAL REALIZADO*\n💰 *Saldo pendiente:* ${{valorPendiente}}\n🔢 *Código de retiro:* {{codigoVerificacion}}\n\n📋 *PASOS PARA RETIRAR:*\n1️⃣ Completar el pago del saldo\n2️⃣ Presentar código de retiro\n3️⃣ Retirar documento\n\n📍 *Ubicación:* Notaría Décima Octava\n🕒 *Horario:* Lunes a Viernes 8:00-17:00\n\nGracias por confiar en nosotros.",

      // ✅ PLANTILLA GENÉRICA DE RESPALDO (sin información de pago)
      whatsapp: "🏛️ *NOTARÍA 18*\n\n¡Su documento está listo para retirar!\n\n📄 *Trámite:* {{tipoDocumento}}{{contextoTramite}}\n📋 *Documento:* {{codigoBarras}}\n🔢 *Código de verificación:* {{codigoVerificacion}}\n👤 *Cliente:* {{nombreCliente}}\n\n📍 Retírelo en: Notaría Décima Octava\n🕒 Horario: Lunes a Viernes 8:00-17:00\n\n⚠️ *IMPORTANTE:* Presente el código de verificación y su cédula para el retiro.",

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

⭐ *¿Quedó satisfecho con nuestro servicio?*
Comparta su experiencia en Google:
https://g.page/r/CYfAY05X_ylIEBM/review?utm_source=gbp&utm_medium=reviews&utm_campaign=qr

Su opinión nos ayuda a mejorar cada día.

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

⭐ *¿Quedó satisfecho con nuestro servicio?*
Comparta su experiencia en Google:
https://g.page/r/CYfAY05X_ylIEBM/review?utm_source=gbp&utm_medium=reviews&utm_campaign=qr

Su opinión nos ayuda a mejorar cada día.

_Guarde este mensaje como comprobante de entrega grupal._`,

      email: {
        subject: "Entrega Grupal Completada - {{totalDocumentos}} documentos - Notaría 18",
        template: "confirmacion-entrega-grupal"
      }
    }
  }
};

module.exports = configNotaria; 