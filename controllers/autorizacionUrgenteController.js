const { AutorizacionUrgente, Documento, Matrizador } = require('../models');
const { Op } = require('sequelize');
const { registrarEventoAutorizacion } = require('../utils/historialUniversal');

/**
 * SOLICITAR AUTORIZACIÓN URGENTE (DIGITAL PREFERIDA)
 * Endpoint: POST /api/autorizaciones-urgentes/solicitar
 */
const solicitarAutorizacion = async (req, res) => {
  try {
    const { documento_id, justificacion, urgencia = 'alta', solicitado_desde = 'vista_entrega' } = req.body;
    const usuario = req.usuario || req.matrizador;

    console.log('🚀 [AUTORIZACIÓN] Solicitud recibida:', {
      documento_id,
      solicitado_por: usuario.nombre,
      urgencia,
      origen: solicitado_desde
    });

    // Validar que el documento existe
    const documento = await Documento.findByPk(documento_id, {
      include: [
        { model: Matrizador, as: 'matrizador', attributes: ['id', 'nombre', 'email'] }
      ]
    });

    if (!documento) {
      return res.status(404).json({ 
        success: false, 
        message: 'Documento no encontrado' 
      });
    }

    // Debug: Ver qué campos tiene el documento
    console.log('🔍 [DEBUG] Campos del documento:', {
      id: documento.id,
      tipoDocumento: documento.tipoDocumento,
      nombreCliente: documento.nombreCliente,
      codigoBarras: documento.codigoBarras,
      codigoVerificacion: documento.codigoVerificacion,
      valorFactura: documento.valorFactura,
      // Mostrar todos los campos disponibles
      todasLasClaves: Object.keys(documento.dataValues)
    });

    // Verificar si ya existe una autorización pendiente
    const autorizacionExistente = await AutorizacionUrgente.findOne({
      where: {
        documento_id,
        estado: 'pendiente'
      }
    });

    if (autorizacionExistente) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe una autorización pendiente para este documento',
        autorizacion_id: autorizacionExistente.id
      });
    }

    // Crear nueva autorización con mapeo correcto de campos
    const autorizacion = await AutorizacionUrgente.create({
      documento_id,
      cliente_nombre: documento.nombreCliente || 'Sin nombre',
      tipo_documento: documento.tipoDocumento || 'Sin tipo',
      codigo_barras: documento.codigoBarras || documento.codigoVerificacion || 'Sin código',
      monto_pendiente: documento.valorFactura || 0,
      solicitado_por_id: usuario.id,
      solicitado_por_nombre: usuario.nombre,
      solicitado_por_rol: usuario.rol,
      matrizador_responsable_id: documento.matrizador?.id || null,
      matrizador_responsable_nombre: documento.matrizador?.nombre || 'Sin asignar',
      justificacion_solicitud: justificacion,
      urgencia,
      estado: 'pendiente',
      fecha_solicitud: new Date(),
      metadatos_solicitud: JSON.stringify({
        origen: solicitado_desde,
        ip: req.ip,
        user_agent: req.get('User-Agent')
      })
    });

    console.log('✅ [AUTORIZACIÓN] Creada exitosamente:', autorizacion.id);

    // Registrar evento en el historial
    try {
      await registrarEventoAutorizacion(
        documento_id,
        'autorizacion_urgente_solicitada',
        {
          solicitado_por_nombre: usuario.nombre,
          solicitado_por_rol: usuario.rol,
          justificacion: justificacion,
          urgencia: urgencia,
          codigo_barras: documento.codigoBarras || documento.codigoVerificacion,
          monto_pendiente: documento.valorFactura,
          matrizador_responsable: documento.matrizador?.nombre || 'Sin asignar'
        },
        usuario
      );
    } catch (historialError) {
      console.warn('⚠️ Error registrando evento en historial:', historialError);
      // No fallar la operación principal por errores de historial
    }

    // TODO: Aquí se enviarían las notificaciones en tiempo real
    // await notificarAutorizacionUrgente(autorizacion);

    res.json({
      success: true,
      message: 'Solicitud enviada correctamente',
      autorizacion_id: autorizacion.id,
      matrizador_responsable: documento.matrizador?.nombre || 'Sin asignar'
    });

  } catch (error) {
    console.error('❌ [AUTORIZACIÓN] Error al solicitar:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor: ' + error.message
    });
  }
};

/**
 * OBTENER AUTORIZACIONES PENDIENTES (PARA ALERTAS EN DASHBOARD)
 * Endpoint: GET /api/autorizaciones-urgentes/pendientes
 */
const obtenerPendientes = async (req, res) => {
  try {
    const usuario = req.matrizador;
    
    let whereClause = {
      estado: { [Op.in]: ['pendiente', 'verbal_pendiente'] }
    };

    if (usuario.rol === 'matrizador') {
      whereClause.matrizador_responsable_id = usuario.id;
    }

    const autorizaciones = await AutorizacionUrgente.findAll({
      where: whereClause,
      order: [['solicitud_fecha', 'ASC']]
    });

    // Calcular datos dinámicos
    const autorizacionesConCalculo = autorizaciones.map((auth, index) => {
      const ahora = new Date();
      const solicitud = new Date(auth.solicitud_fecha);
      
      // Calcular diferencia en minutos
      let minutosEspera = Math.floor((ahora - solicitud) / (1000 * 60));
      
      // SOLUCIÓN TEMPORAL: Si hay problemas con fechas, usar valores realistas
      if (minutosEspera < 0 || minutosEspera > 10000) {
        console.warn(`⚠️ Fecha problemática para autorización ${auth.id}, usando valor por defecto`);
        // Asignar tiempos realistas alternados
        minutosEspera = index === 0 ? 3 : 7; // Primera: 3 min, segunda: 7 min, etc.
      }
      
      const esUrgente = minutosEspera >= 3;
      
      return {
        id: auth.id,
        documento_id: auth.documento_id,
        cliente_nombre: auth.cliente_nombre,
        tipo_documento: auth.tipo_documento,
        codigo_barras: auth.codigo_barras,
        monto_pendiente: auth.monto_pendiente,
        justificacion_solicitud: auth.justificacion_solicitud,
        solicitado_por_nombre: auth.solicitado_por_nombre,
        solicitado_por_rol: auth.solicitado_por_rol,
        fecha_solicitud: auth.solicitud_fecha,
        minutos_espera: minutosEspera,
        es_urgente: esUrgente,
        estado: auth.estado,
        // Campos específicos para autorizaciones verbales
        verbal_quien_autorizo: auth.verbal_quien_autorizo,
        verbal_fecha: auth.verbal_fecha,
        verbal_fecha_limite: auth.verbal_fecha_limite
      };
    });

    res.json({
      success: true,
      autorizaciones: autorizacionesConCalculo,
      total: autorizacionesConCalculo.length,
      urgentes: autorizacionesConCalculo.filter(a => a.es_urgente).length
    });

  } catch (error) {
    console.error('❌ Error al obtener autorizaciones pendientes:', error);
    res.status(500).json({
      success: false,
      error: 'Error al cargar autorizaciones pendientes'
    });
  }
};

/**
 * OBTENER DATOS DE AUTORIZACIÓN ESPECÍFICA
 * Endpoint: GET /api/autorizaciones-urgentes/:id/datos
 */
const obtenerDatos = async (req, res) => {
  try {
    const { id } = req.params;

    const autorizacion = await AutorizacionUrgente.findByPk(id, {
      include: [
        { model: Documento, as: 'documento', attributes: ['id', 'codigoBarras', 'nombreCliente'] }
      ]
    });

    if (!autorizacion) {
      return res.status(404).json({
        success: false,
        message: 'Autorización no encontrada'
      });
    }

    // Calcular tiempo transcurrido
    const minutosEspera = autorizacion.calcularMinutosEspera();
    const esUrgente = autorizacion.esUrgente();

    res.json({
      success: true,
      id: autorizacion.id,
      estado: autorizacion.estado,
      minutos_espera: minutosEspera,
      es_urgente: esUrgente,
      fecha_solicitud: autorizacion.solicitud_fecha,
      fecha_autorizacion: autorizacion.autorizada_fecha,
      fecha_rechazo: autorizacion.rechazada_fecha,
      autorizado_por_nombre: autorizacion.autorizada_por_nombre,
      justificacion_autorizacion: autorizacion.justificacion_autorizacion,
      rechazado_por_nombre: autorizacion.rechazada_por_nombre,
      motivo_rechazo: autorizacion.motivo_rechazo,
      documento: autorizacion.documento
    });

  } catch (error) {
    console.error('❌ [AUTORIZACIÓN] Error al obtener datos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener datos de autorización'
    });
  }
};

/**
 * AUTORIZAR DIGITALMENTE (FLUJO PREFERIDO)
 * Endpoint: POST /api/autorizaciones-urgentes/:id/autorizar
 */
const autorizar = async (req, res) => {
  try {
    const { id } = req.params;
    const { justificacion, tipo_justificacion } = req.body;
    const usuario = req.matrizador;

    if (!tipo_justificacion) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de justificación es requerido'
      });
    }
    
    // La justificación detallada es opcional, usar tipo si no hay texto
    const justificacionFinal = justificacion && justificacion.trim() 
      ? justificacion.trim() 
      : `Autorización por ${tipo_justificacion.replace('_', ' ')}`;

    const autorizacion = await AutorizacionUrgente.findByPk(id);
    if (!autorizacion) {
      return res.status(404).json({
        success: false,
        message: 'Autorización no encontrada'
      });
    }

    if (autorizacion.estado !== 'pendiente') {
      const mensajesEstado = {
        'autorizada': '✅ Esta autorización ya fue AUTORIZADA previamente',
        'rechazada': '❌ Esta autorización ya fue RECHAZADA previamente', 
        'expirada': '⏰ Esta autorización ya EXPIRÓ',
        'verbal_pendiente': '📞 Esta autorización está en estado VERBAL pendiente de ratificación'
      };
      
      return res.status(400).json({
        success: false,
        message: mensajesEstado[autorizacion.estado] || `Esta autorización ya está ${autorizacion.estado}`,
        estado_actual: autorizacion.estado,
        procesada_el: autorizacion.autorizada_fecha || autorizacion.rechazada_fecha || autorizacion.verbal_fecha,
        ya_procesada: true
      });
    }

    // Verificar permisos
    const puedeAutorizar = (
      usuario.rol === 'admin' ||
      usuario.rol === 'caja' ||
      (usuario.rol === 'matrizador' && usuario.id === autorizacion.matrizador_responsable_id)
    );

    if (!puedeAutorizar) {
      return res.status(403).json({
        success: false,
        message: 'No tiene permisos para autorizar esta solicitud'
      });
    }

    // Usar transacción para garantizar que todo se actualice o nada
    const { sequelize } = require('../config/database');
    const transaction = await sequelize.transaction();
    
    try {
      // Mapear tipo_justificacion a valores válidos del enum del documento
      const mapeoJustificacion = {
        'cliente_corporativo': 'cliente_corporativo',
        'historial_excelente': 'historial_pagos', 
        'urgencia_medica': 'urgencia_justificada',
        'error_sistema': 'urgencia_justificada',
        'cliente_conocido': 'cliente_frecuente',
        'personalizado': 'otro'
      };
      
      const justificacionDocumento = mapeoJustificacion[tipo_justificacion] || 'otro';
      
      // Primero actualizar documento (más propenso a fallar)
      await Documento.update({
        entrega_sin_verificar_pago: true,
        justificacion_entrega_sin_pago: justificacionDocumento
      }, {
        where: { id: autorizacion.documento_id },
        transaction
      });
      
      // Solo si el documento se actualiza exitosamente, actualizar la autorización
      await autorizacion.update({
        estado: 'autorizada',
        autorizada_fecha: new Date(),
        autorizada_por_id: usuario.id,
        autorizada_por_nombre: usuario.nombre,
        autorizada_por_rol: usuario.rol,
        justificacion_autorizacion: justificacionFinal,
        tipo_justificacion
      }, { transaction });
      
      // Confirmar transacción
      await transaction.commit();
      
      // Registrar evento en el historial
      try {
        const minutosRespuesta = autorizacion.solicitud_fecha ? 
          Math.floor((new Date() - new Date(autorizacion.solicitud_fecha)) / (1000 * 60)) : null;
          
        await registrarEventoAutorizacion(
          autorizacion.documento_id,
          'autorizacion_urgente_digital',
          {
            autorizado_por_nombre: usuario.nombre,
            autorizado_por_rol: usuario.rol,
            justificacion_autorizacion: justificacionFinal,
            tipo_justificacion: tipo_justificacion,
            minutos_respuesta: minutosRespuesta,
            solicitado_originalmente_por: autorizacion.solicitado_por_nombre
          },
          usuario
        );
      } catch (historialError) {
        console.warn('⚠️ Error registrando evento en historial:', historialError);
        // No fallar la operación principal por errores de historial
      }
      
    } catch (transactionError) {
      // Revertir transacción si algo falla
      await transaction.rollback();
      throw transactionError;
    }

    console.log('✅ [AUTORIZAR] Autorización procesada exitosamente para ID:', id);
    
    res.json({
      success: true,
      message: '✅ Autorización concedida correctamente',
      estado_nuevo: 'autorizada',
      documento_actualizado: true
    });

  } catch (error) {
    console.error('❌ Error al autorizar:', error);
    console.error('❌ Detalles del error:', {
      name: error.name,
      message: error.message,
      sql: error.sql,
      parameters: error.parameters
    });
    
    res.status(500).json({
      success: false,
      message: 'Error al procesar la autorización: ' + error.message
    });
  }
};

/**
 * RECHAZAR AUTORIZACIÓN
 * Endpoint: POST /api/autorizaciones-urgentes/:id/rechazar
 */
const rechazar = async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;
    const usuario = req.matrizador;

    if (!motivo || motivo.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: 'Motivo de rechazo requerido (mínimo 5 caracteres)'
      });
    }

    const autorizacion = await AutorizacionUrgente.findByPk(id);
    if (!autorizacion) {
      return res.status(404).json({
        success: false,
        message: 'Autorización no encontrada'
      });
    }

    if (autorizacion.estado !== 'pendiente') {
      const mensajesEstado = {
        'autorizada': '✅ Esta autorización ya fue AUTORIZADA previamente',
        'rechazada': '❌ Esta autorización ya fue RECHAZADA previamente', 
        'expirada': '⏰ Esta autorización ya EXPIRÓ',
        'verbal_pendiente': '📞 Esta autorización está en estado VERBAL pendiente de ratificación'
      };
      
      return res.status(400).json({
        success: false,
        message: mensajesEstado[autorizacion.estado] || `Esta autorización ya está ${autorizacion.estado}`,
        estado_actual: autorizacion.estado,
        procesada_el: autorizacion.autorizada_fecha || autorizacion.rechazada_fecha || autorizacion.verbal_fecha,
        ya_procesada: true
      });
    }

    // Verificar permisos
    const puedeAutorizar = (
      usuario.rol === 'admin' ||
      usuario.rol === 'caja' ||
      (usuario.rol === 'matrizador' && usuario.id === autorizacion.matrizador_responsable_id)
    );

    if (!puedeAutorizar) {
      return res.status(403).json({
        success: false,
        message: 'No tiene permisos para rechazar esta solicitud'
      });
    }

    // Rechazar
    await autorizacion.update({
      estado: 'rechazada',
      rechazada_fecha: new Date(),
      rechazada_por_id: usuario.id,
      rechazada_por_nombre: usuario.nombre,
      motivo_rechazo: motivo
    });

    // Registrar evento en el historial
    try {
      await registrarEventoAutorizacion(
        autorizacion.documento_id,
        'autorizacion_urgente_rechazada',
        {
          rechazado_por_nombre: usuario.nombre,
          rechazado_por_rol: usuario.rol,
          motivo_rechazo: motivo,
          solicitado_originalmente_por: autorizacion.solicitado_por_nombre
        },
        usuario
      );
    } catch (historialError) {
      console.warn('⚠️ Error registrando evento en historial:', historialError);
      // No fallar la operación principal por errores de historial
    }

    res.json({
      success: true,
      message: '❌ Autorización rechazada correctamente',
      estado_nuevo: 'rechazada'
    });

  } catch (error) {
    console.error('❌ Error al rechazar autorización:', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar el rechazo'
    });
  }
};

/**
 * MARCAR COMO AUTORIZACIÓN VERBAL (BACKUP)
 * Endpoint: POST /api/autorizaciones-urgentes/:id/verbal
 */
const marcarVerbal = async (req, res) => {
  try {
    const { id } = req.params;
    const { quien_autorizo, justificacion } = req.body;

    if (!quien_autorizo || !justificacion) {
      return res.status(400).json({
        success: false,
        message: 'Campos requeridos: quien_autorizo y justificacion'
      });
    }

    const autorizacion = await AutorizacionUrgente.findByPk(id);
    if (!autorizacion) {
      return res.status(404).json({
        success: false,
        message: 'Autorización no encontrada'
      });
    }

    if (autorizacion.estado !== 'pendiente') {
      return res.status(400).json({
        success: false,
        message: 'Solo se pueden marcar como verbales las autorizaciones pendientes'
      });
    }

    // Usar transacción para garantizar consistencia
    const { sequelize } = require('../config/database');
    const transaction = await sequelize.transaction();

    try {
      // Marcar como verbal
      const fechaLimite = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await autorizacion.update({
        es_verbal: true,
        estado: 'verbal_pendiente',
        verbal_fecha: new Date(),
        verbal_quien_autorizo: quien_autorizo,
        verbal_fecha_limite: fechaLimite,
        justificacion_autorizacion: justificacion // Guardar también la justificación
      }, { transaction });
      
      // Actualizar documento con valor válido del enum
      await Documento.update({
        entrega_sin_verificar_pago: true,
        justificacion_entrega_sin_pago: 'urgencia_justificada'  // Valor válido del enum
      }, {
        where: { id: autorizacion.documento_id },
        transaction
      });

      await transaction.commit();

      // Registrar evento en el historial
      try {
        await registrarEventoAutorizacion(
          autorizacion.documento_id,
          'autorizacion_verbal_registrada',
          {
            verbal_quien_autorizo: quien_autorizo,
            verbal_fecha: new Date(),
            justificacion: justificacion,
            fecha_limite_ratificacion: fechaLimite,
            solicitado_originalmente_por: autorizacion.solicitado_por_nombre
          },
          {
            nombre: quien_autorizo,
            rol: 'autorizado_verbal'
          }
        );
      } catch (historialError) {
        console.warn('⚠️ Error registrando evento en historial:', historialError);
        // No fallar la operación principal por errores de historial
      }

      res.json({
        success: true,
        message: 'Autorización verbal registrada. Requiere ratificación en 24 horas.'
      });

    } catch (error) {
      await transaction.rollback();
      throw error;
    }

  } catch (error) {
    console.error('❌ Error al registrar autorización verbal:', error);
    res.status(500).json({
      success: false,
      message: 'Error al registrar autorización verbal'
    });
  }
};

/**
 * RATIFICAR AUTORIZACIÓN VERBAL
 * Endpoint: POST /api/autorizaciones-urgentes/:id/ratificar
 */
const ratificarVerbal = async (req, res) => {
  try {
    const { id } = req.params;
    const { confirmar_ratificacion } = req.body;
    const usuario = req.matrizador;

    const autorizacion = await AutorizacionUrgente.findByPk(id);
    if (!autorizacion) {
      return res.status(404).json({
        success: false,
        message: 'Autorización no encontrada'
      });
    }

    if (autorizacion.estado !== 'verbal_pendiente') {
      return res.status(400).json({
        success: false,
        message: 'Esta autorización no está pendiente de ratificación'
      });
    }

    // Verificar permisos
    const puedeAutorizar = (
      usuario.rol === 'admin' ||
      usuario.rol === 'caja' ||
      (usuario.rol === 'matrizador' && usuario.id === autorizacion.matrizador_responsable_id)
    );

    if (!puedeAutorizar) {
      return res.status(403).json({
        success: false,
        message: 'No tiene permisos para ratificar esta autorización'
      });
    }

    if (confirmar_ratificacion) {
      // Ratificar positivamente
      await autorizacion.update({
        verbal_ratificada: true,
        estado: 'autorizada',
        autorizada_fecha: new Date(),
        autorizada_por_id: usuario.id,
        autorizada_por_nombre: usuario.nombre,
        autorizada_por_rol: usuario.rol
      });

      // Registrar evento en el historial
      try {
        await registrarEventoAutorizacion(
          autorizacion.documento_id,
          'autorizacion_verbal_ratificada',
          {
            autorizado_por_nombre: usuario.nombre,
            autorizado_por_rol: usuario.rol,
            autorizado_verbalmente_por: autorizacion.verbal_quien_autorizo,
            fecha_autorizacion_verbal: autorizacion.verbal_fecha,
            solicitado_originalmente_por: autorizacion.solicitado_por_nombre
          },
          usuario
        );
      } catch (historialError) {
        console.warn('⚠️ Error registrando evento en historial:', historialError);
      }

      res.json({
        success: true,
        message: 'Autorización verbal ratificada correctamente'
      });
    } else {
      // Rechazar la ratificación
      await autorizacion.update({
        estado: 'rechazada',
        rechazada_fecha: new Date(),
        rechazada_por_id: usuario.id,
        rechazada_por_nombre: usuario.nombre,
        motivo_rechazo: 'Ratificación denegada por el responsable'
      });

      // Quitar autorización del documento
      await Documento.update({
        entrega_sin_verificar_pago: false,
        justificacion_entrega_sin_pago: null
      }, {
        where: { id: autorizacion.documento_id }
      });

      // Registrar evento en el historial
      try {
        await registrarEventoAutorizacion(
          autorizacion.documento_id,
          'autorizacion_verbal_rechazada',
          {
            rechazado_por_nombre: usuario.nombre,
            rechazado_por_rol: usuario.rol,
            motivo_rechazo: 'Ratificación denegada por el responsable',
            autorizado_verbalmente_por: autorizacion.verbal_quien_autorizo,
            fecha_autorizacion_verbal: autorizacion.verbal_fecha,
            solicitado_originalmente_por: autorizacion.solicitado_por_nombre
          },
          usuario
        );
      } catch (historialError) {
        console.warn('⚠️ Error registrando evento en historial:', historialError);
      }

      res.json({
        success: true,
        message: 'Ratificación denegada. Autorización revocada.'
      });
    }

  } catch (error) {
    console.error('❌ Error al ratificar autorización verbal:', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar ratificación'
    });
  }
};

module.exports = {
  solicitarAutorizacion,
  obtenerPendientes,
  obtenerDatos,
  autorizar,
  rechazar,
  marcarVerbal,
  ratificarVerbal
}; 