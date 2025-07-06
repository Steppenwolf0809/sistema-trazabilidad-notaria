/**
 * CONTROLADOR CENTRALIZADO DE COMPONENTES REUTILIZABLES
 * Sistema Notarial - Componentes universales para todos los roles
 * 
 * PRINCIPIO: "CONSERVADOR ANTES QUE INNOVADOR"
 * - Mantiene compatibilidad con sistema existente
 * - Reutiliza lógica probada del adminController
 * - Configuración centralizada para fácil mantenimiento
 */

const Documento = require('../models/Documento');
const Matrizador = require('../models/Matrizador');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');
const moment = require('moment');

/**
 * CONFIGURACIONES POR ROL
 * Cada rol tiene configuraciones específicas para mostrar datos relevantes
 */
const CONFIGURACIONES_ROL = {
  admin: {
    columnas: [
      { campo: 'codigo_barras', titulo: 'Código', tipo: 'texto', ancho: 'w-32' },
      { campo: 'nombre_cliente', titulo: 'Cliente', tipo: 'texto', ancho: 'w-48' },
      { campo: 'estado', titulo: 'Estado', tipo: 'badge', ancho: 'w-32' },
      { campo: 'matrizador_nombre', titulo: 'Matrizador', tipo: 'texto', ancho: 'w-36' },
      { campo: 'valor_factura', titulo: 'Valor', tipo: 'moneda', ancho: 'w-24' },
      { campo: 'created_at', titulo: 'Fecha', tipo: 'fecha', ancho: 'w-28' }
    ],
    metricas: [
      { key: 'totalDocumentos', titulo: 'Total Documentos', icono: 'fas fa-file-alt', color: 'blue' },
      { key: 'totalFacturado', titulo: 'Total Facturado', icono: 'fas fa-dollar-sign', color: 'green' },
      { key: 'pagosPendientes', titulo: 'Pagos Pendientes', icono: 'fas fa-clock', color: 'orange' },
      { key: 'totalRetenido', titulo: 'Retenciones', icono: 'fas fa-receipt', color: 'purple' }
    ],
    alertas: [
      { tipo: 'documentos_atrasados', titulo: 'Documentos Atrasados', color: 'red' },
      { tipo: 'pagos_vencidos', titulo: 'Pagos Vencidos', color: 'orange' },
      { tipo: 'sin_entregar', titulo: 'Sin Entregar', color: 'yellow' },
      { tipo: 'problemas_sistema', titulo: 'Problemas Sistema', color: 'red' }
    ]
  },
  
  caja: {
    columnas: [
      { campo: 'codigo_barras', titulo: 'Código', tipo: 'texto', ancho: 'w-32' },
      { campo: 'nombre_cliente', titulo: 'Cliente', tipo: 'texto', ancho: 'w-48' },
      { campo: 'estado_pago', titulo: 'Estado Pago', tipo: 'badge', ancho: 'w-32' },
      { campo: 'valor_factura', titulo: 'Valor', tipo: 'moneda', ancho: 'w-24' },
      { campo: 'metodo_pago', titulo: 'Método', tipo: 'texto', ancho: 'w-28' }
    ],
    metricas: [
      { key: 'documentosHoy', titulo: 'Docs Hoy', icono: 'fas fa-file-alt', color: 'blue' },
      { key: 'cobradoHoy', titulo: 'Cobrado Hoy', icono: 'fas fa-dollar-sign', color: 'green' },
      { key: 'pendientesCobro', titulo: 'Pendientes Cobro', icono: 'fas fa-clock', color: 'orange' },
      { key: 'retencionesHoy', titulo: 'Retenciones Hoy', icono: 'fas fa-receipt', color: 'purple' }
    ],
    alertas: [
      { tipo: 'pagos_urgentes', titulo: 'Pagos Urgentes', color: 'red' },
      { tipo: 'retenciones_pendientes', titulo: 'Retenciones Pendientes', color: 'orange' },
      { tipo: 'facturas_sin_procesar', titulo: 'Facturas Sin Procesar', color: 'yellow' }
    ]
  },
  
  matrizador: {
    columnas: [
      { campo: 'codigo_barras', titulo: 'Código', tipo: 'texto', ancho: 'w-32' },
      { campo: 'nombre_cliente', titulo: 'Cliente', tipo: 'texto', ancho: 'w-48' },
      { campo: 'estado', titulo: 'Estado', tipo: 'badge', ancho: 'w-32' },
      { campo: 'fecha_limite', titulo: 'Fecha Límite', tipo: 'fecha', ancho: 'w-28' },
      { campo: 'prioridad', titulo: 'Prioridad', tipo: 'badge', ancho: 'w-24' }
    ],
    metricas: [
      { key: 'docsAsignados', titulo: 'Docs Asignados', icono: 'fas fa-file-alt', color: 'blue' },
      { key: 'docsCompletados', titulo: 'Docs Completados', icono: 'fas fa-check-circle', color: 'green' },
      { key: 'docsPendientes', titulo: 'Docs Pendientes', icono: 'fas fa-clock', color: 'orange' },
      { key: 'promedioTiempo', titulo: 'Promedio Tiempo', icono: 'fas fa-hourglass-half', color: 'purple' }
    ],
    alertas: [
      { tipo: 'docs_vencidos', titulo: 'Docs Vencidos', color: 'red' },
      { tipo: 'prioridades_altas', titulo: 'Prioridades Altas', color: 'orange' }
    ]
  },
  
  recepcion: {
    columnas: [
      { campo: 'codigo_barras', titulo: 'Código', tipo: 'texto', ancho: 'w-32' },
      { campo: 'nombre_cliente', titulo: 'Cliente', tipo: 'texto', ancho: 'w-48' },
      { campo: 'estado', titulo: 'Estado', tipo: 'badge', ancho: 'w-32' },
      { campo: 'codigo_verificacion', titulo: 'Código Verificación', tipo: 'texto', ancho: 'w-32' }
    ],
    metricas: [
      { key: 'docsListos', titulo: 'Docs Listos', icono: 'fas fa-file-alt', color: 'blue' },
      { key: 'docsEntregadosHoy', titulo: 'Entregados Hoy', icono: 'fas fa-handshake', color: 'green' },
      { key: 'codigosPendientes', titulo: 'Códigos Pendientes', icono: 'fas fa-key', color: 'orange' }
    ],
    alertas: [
      { tipo: 'docs_listos_esperando', titulo: 'Docs Listos Esperando', color: 'yellow' },
      { tipo: 'codigos_expirados', titulo: 'Códigos Expirados', color: 'red' }
    ]
  }
};

/**
 * COLORES PARA ESTADOS Y BADGES
 */
const COLORES_ESTADO = {
  'en_proceso': { color: 'blue', texto: 'En Proceso' },
  'listo_para_entrega': { color: 'green', texto: 'Listo' },
  'entregado': { color: 'gray', texto: 'Entregado' },
  'cancelado': { color: 'red', texto: 'Cancelado' },
  'pagado_completo': { color: 'green', texto: 'Pagado' },
  'pendiente_pago': { color: 'orange', texto: 'Pendiente' },
  'pagado_con_retencion': { color: 'purple', texto: 'Con Retención' },
  'alta': { color: 'red', texto: 'Alta' },
  'media': { color: 'orange', texto: 'Media' },
  'baja': { color: 'green', texto: 'Baja' }
};

/**
 * UTILIDADES PARA FILTROS TEMPORALES
 */
const FILTROS_TEMPORALES = {
  hoy: () => ({
    inicio: moment().startOf('day'),
    fin: moment().endOf('day'),
    texto: `Hoy ${moment().format('DD/MM/YYYY')}`
  }),
  
  semana: () => ({
    inicio: moment().startOf('week'),
    fin: moment().endOf('day'),
    texto: `Esta semana (${moment().startOf('week').format('DD/MM')} - ${moment().format('DD/MM')})`
  }),
  
  mes: () => ({
    inicio: moment().startOf('month'),
    fin: moment().endOf('day'),
    texto: `Este mes (${moment().format('MMMM YYYY')})`
  }),
  
  mes_anterior: () => ({
    inicio: moment().subtract(1, 'month').startOf('month'),
    fin: moment().subtract(1, 'month').endOf('month'),
    texto: `Mes anterior (${moment().subtract(1, 'month').format('MMMM YYYY')})`
  }),
  
  año: () => ({
    inicio: moment().startOf('year'),
    fin: moment().endOf('day'),
    texto: `Este año (${moment().year()})`
  }),
  
  personalizado: (fechaInicio, fechaFin) => ({
    inicio: moment(fechaInicio).startOf('day'),
    fin: moment(fechaFin).endOf('day'),
    texto: `${moment(fechaInicio).format('DD/MM/YYYY')} - ${moment(fechaFin).format('DD/MM/YYYY')}`
  })
};

/**
 * CLASE PRINCIPAL DEL CONTROLADOR
 */
class ComponentesController {
  
  /**
   * OBTENER DOCUMENTOS PARA TABLA SEGÚN ROL
   * @param {string} rol - admin, caja, matrizador, recepcion
   * @param {object} filtros - Filtros de búsqueda
   * @param {number} pagina - Página actual
   * @param {number} limite - Documentos por página
   */
  static async obtenerDocumentosParaTabla(rol, filtros = {}, pagina = 1, limite = 10) {
    try {
      const config = CONFIGURACIONES_ROL[rol];
      if (!config) {
        throw new Error(`Rol no válido: ${rol}`);
      }

      // Construir condiciones WHERE según filtros
      const whereConditions = {
        estado: { [Op.notIn]: ['eliminado', 'nota_credito'] }
      };

      // Aplicar filtros específicos según rol
      if (rol === 'matrizador' && filtros.matrizadorId) {
        whereConditions.id_matrizador = filtros.matrizadorId;
      }

      if (filtros.fechaInicio && filtros.fechaFin) {
        whereConditions.created_at = {
          [Op.between]: [
            moment(filtros.fechaInicio).startOf('day').toDate(),
            moment(filtros.fechaFin).endOf('day').toDate()
          ]
        };
      }

      if (filtros.estado) {
        whereConditions.estado = filtros.estado;
      }

      // Incluir asociaciones necesarias
      const include = [];
      if (rol === 'admin' || rol === 'matrizador') {
        include.push({
          model: Matrizador,
          as: 'matrizador',
          attributes: ['nombre'],
          required: false
        });
      }

      // Ejecutar consulta con paginación
      const offset = (pagina - 1) * limite;
      const { count, rows } = await Documento.findAndCountAll({
        where: whereConditions,
        include: include,
        limit: limite,
        offset: offset,
        order: [['created_at', 'DESC']]
      });

      // Formatear datos para la tabla
      const documentosFormateados = rows.map(doc => {
        const docData = {
          id: doc.id,
          codigo_barras: doc.codigoBarras,
          nombre_cliente: doc.nombreCliente,
          estado: doc.estado,
          valor_factura: doc.valorFactura,
          created_at: doc.created_at,
          estado_pago: doc.estadoPago,
          codigo_verificacion: doc.codigoVerificacion
        };

        // Agregar datos específicos según rol
        if (doc.matrizador) {
          docData.matrizador_nombre = doc.matrizador.nombre;
        }

        // Calcular fecha límite para matrizadores (ejemplo: 15 días)
        if (rol === 'matrizador') {
          docData.fecha_limite = moment(doc.created_at).add(15, 'days').format('YYYY-MM-DD');
          docData.prioridad = this.calcularPrioridad(doc.created_at);
        }

        return docData;
      });

      return {
        columnas: config.columnas,
        documentos: documentosFormateados,
        paginacion: {
          actual: pagina,
          total: Math.ceil(count / limite),
          items: count,
          limite: limite
        }
      };

    } catch (error) {
      console.error('Error al obtener documentos para tabla:', error);
      throw error;
    }
  }

  /**
   * OBTENER MÉTRICAS CON FILTRO TEMPORAL DINÁMICO
   * @param {string} rol - admin, caja, matrizador, recepcion
   * @param {string} filtroTemporal - hoy, semana, mes, mes_anterior, año, personalizado
   * @param {string} fechaInicio - Para filtro personalizado
   * @param {string} fechaFin - Para filtro personalizado
   */
  static async obtenerMetricasConFiltroTemporal(rol, filtroTemporal = 'mes', fechaInicio = null, fechaFin = null) {
    try {
      // Obtener rango de fechas según filtro
      let rango;
      if (filtroTemporal === 'personalizado' && fechaInicio && fechaFin) {
        rango = FILTROS_TEMPORALES.personalizado(fechaInicio, fechaFin);
      } else if (FILTROS_TEMPORALES[filtroTemporal]) {
        rango = FILTROS_TEMPORALES[filtroTemporal]();
      } else {
        rango = FILTROS_TEMPORALES.mes(); // Por defecto
      }

      const fechaInicioSQL = rango.inicio.format('YYYY-MM-DD HH:mm:ss');
      const fechaFinSQL = rango.fin.format('YYYY-MM-DD HH:mm:ss');

      // Condiciones base para el período
      const whereBasePeriodo = {
        created_at: {
          [Op.between]: [rango.inicio.toDate(), rango.fin.toDate()]
        },
        estado: { [Op.notIn]: ['eliminado', 'nota_credito'] }
      };

      const metricas = [];
      
      if (rol === 'admin') {
        // Métricas administrativas con filtro temporal
        const totalDocumentos = await Documento.count({ where: whereBasePeriodo });
        
        const [facturadoResult] = await sequelize.query(`
          SELECT COALESCE(SUM(valor_factura), 0) as total
          FROM documentos
          WHERE created_at BETWEEN :fechaInicio AND :fechaFin
          AND numero_factura IS NOT NULL
          AND estado NOT IN ('eliminado', 'nota_credito')
        `, {
          replacements: { fechaInicio: fechaInicioSQL, fechaFin: fechaFinSQL },
          type: sequelize.QueryTypes.SELECT
        });
        
        const [cobradoResult] = await sequelize.query(`
          SELECT COALESCE(SUM(CASE WHEN estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial') THEN valor_pagado ELSE 0 END), 0) as total
          FROM documentos
          WHERE created_at BETWEEN :fechaInicio AND :fechaFin
          AND estado NOT IN ('eliminado', 'nota_credito')
        `, {
          replacements: { fechaInicio: fechaInicioSQL, fechaFin: fechaFinSQL },
          type: sequelize.QueryTypes.SELECT
        });
        
        // Pagos pendientes (total acumulado, no del período)
        const pagosPendientes = await Documento.count({
          where: {
            estadoPago: 'pendiente',
            estado: { [Op.notIn]: ['eliminado', 'nota_credito'] }
          }
        });
        
        const [retenidoResult] = await sequelize.query(`
          SELECT COALESCE(SUM(valor_retenido), 0) as total
          FROM documentos
          WHERE created_at BETWEEN :fechaInicio AND :fechaFin
          AND numero_factura IS NOT NULL
          AND estado NOT IN ('eliminado', 'nota_credito')
        `, {
          replacements: { fechaInicio: fechaInicioSQL, fechaFin: fechaFinSQL },
          type: sequelize.QueryTypes.SELECT
        });

        metricas.push({
          key: 'totalDocumentos',
          titulo: 'Documentos Procesados',
          valor: totalDocumentos.toString(),
          valorRaw: totalDocumentos,
          icono: 'fas fa-file-alt',
          color: 'blue'
        });
        
        metricas.push({
          key: 'ingresosCobrados',
          titulo: 'Ingresos Cobrados',
          valor: `$${parseFloat(cobradoResult.total).toFixed(2)}`,
          valorRaw: parseFloat(cobradoResult.total),
          icono: 'fas fa-cash-register',
          color: 'green'
        });
        
        metricas.push({
          key: 'pagosPendientes',
          titulo: 'Pagos Pendientes',
          valor: pagosPendientes.toString(),
          valorRaw: pagosPendientes,
          icono: 'fas fa-clock',
          color: 'orange'
        });
        
        metricas.push({
          key: 'totalRetenido',
          titulo: 'Retenciones',
          valor: `$${parseFloat(retenidoResult.total).toFixed(2)}`,
          valorRaw: parseFloat(retenidoResult.total),
          icono: 'fas fa-receipt',
          color: 'purple'
        });

      } else if (rol === 'caja') {
        // Métricas de caja con filtro temporal
        const documentosHoy = await Documento.count({ where: whereBasePeriodo });
        
        const [cobradoHoyResult] = await sequelize.query(`
          SELECT COALESCE(SUM(valor_pagado), 0) as total
          FROM documentos
          WHERE DATE(fecha_ultimo_pago) BETWEEN :fechaInicio AND :fechaFin
          AND estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial')
        `, {
          replacements: { 
            fechaInicio: rango.inicio.format('YYYY-MM-DD'),
            fechaFin: rango.fin.format('YYYY-MM-DD')
          },
          type: sequelize.QueryTypes.SELECT
        });
        
        const pendientesCobro = await Documento.count({
          where: {
            estadoPago: 'pendiente',
            estado: { [Op.notIn]: ['eliminado', 'nota_credito'] }
          }
        });

        metricas.push({
          key: 'documentosHoy',
          titulo: 'Documentos Creados',
          valor: documentosHoy.toString(),
          valorRaw: documentosHoy,
          icono: 'fas fa-file-alt',
          color: 'blue'
        });
        
        metricas.push({
          key: 'cobradoHoy',
          titulo: 'Dinero Cobrado',
          valor: `$${parseFloat(cobradoHoyResult.total).toFixed(2)}`,
          valorRaw: parseFloat(cobradoHoyResult.total),
          icono: 'fas fa-dollar-sign',
          color: 'green'
        });
        
        metricas.push({
          key: 'pendientesCobro',
          titulo: 'Pendientes Cobro',
          valor: pendientesCobro.toString(),
          valorRaw: pendientesCobro,
          icono: 'fas fa-clock',
          color: 'orange'
        });
      }

      // Agregar información del período a cada métrica
      return {
        metricas: metricas,
        periodo: {
          filtro: filtroTemporal,
          texto: rango.texto,
          fechaInicio: rango.inicio.format('YYYY-MM-DD'),
          fechaFin: rango.fin.format('YYYY-MM-DD')
        }
      };

    } catch (error) {
      console.error('Error al obtener métricas con filtro temporal:', error);
      throw error;
    }
  }

  /**
   * OBTENER MÉTRICAS SEGÚN ROL (FUNCIÓN ORIGINAL)
   * @param {string} rol - admin, caja, matrizador, recepcion
   * @param {object} filtros - Filtros de fecha
   */
  static async obtenerMetricasSegunRol(rol, filtros = {}) {
    try {
      const config = CONFIGURACIONES_ROL[rol];
      if (!config) {
        throw new Error(`Rol no válido: ${rol}`);
      }

      const fechaInicio = filtros.fechaInicio ? moment(filtros.fechaInicio) : moment().startOf('day');
      const fechaFin = filtros.fechaFin ? moment(filtros.fechaFin) : moment().endOf('day');

      const whereBasePeriodo = {
        created_at: {
          [Op.between]: [fechaInicio.toDate(), fechaFin.toDate()]
        },
        estado: { [Op.notIn]: ['eliminado', 'nota_credito'] }
      };

      const metricas = {};

      // Calcular métricas según rol
      switch (rol) {
        case 'admin':
          metricas.totalDocumentos = await Documento.count({ where: whereBasePeriodo });
          
          const [facturacionResult] = await sequelize.query(`
            SELECT COALESCE(SUM(valor_factura), 0) as total
            FROM documentos
            WHERE created_at BETWEEN :fechaInicio AND :fechaFin
            AND numero_factura IS NOT NULL
            AND estado NOT IN ('eliminado', 'nota_credito')
          `, {
            replacements: { 
              fechaInicio: fechaInicio.format('YYYY-MM-DD HH:mm:ss'),
              fechaFin: fechaFin.format('YYYY-MM-DD HH:mm:ss')
            },
            type: sequelize.QueryTypes.SELECT
          });

          const [pendientesResult] = await sequelize.query(`
            SELECT COALESCE(SUM(valor_pendiente), 0) as total
            FROM documentos
            WHERE created_at BETWEEN :fechaInicio AND :fechaFin
            AND estado_pago IN ('pendiente_pago', 'pago_parcial')
            AND estado NOT IN ('eliminado', 'nota_credito')
          `, {
            replacements: { 
              fechaInicio: fechaInicio.format('YYYY-MM-DD HH:mm:ss'),
              fechaFin: fechaFin.format('YYYY-MM-DD HH:mm:ss')
            },
            type: sequelize.QueryTypes.SELECT
          });

          const [retencionesResult] = await sequelize.query(`
            SELECT COALESCE(SUM(valor_retenido), 0) as total
            FROM documentos
            WHERE created_at BETWEEN :fechaInicio AND :fechaFin
            AND valor_retenido > 0
            AND estado NOT IN ('eliminado', 'nota_credito')
          `, {
            replacements: { 
              fechaInicio: fechaInicio.format('YYYY-MM-DD HH:mm:ss'),
              fechaFin: fechaFin.format('YYYY-MM-DD HH:mm:ss')
            },
            type: sequelize.QueryTypes.SELECT
          });

          metricas.totalFacturado = parseFloat(facturacionResult.total);
          metricas.pagosPendientes = parseFloat(pendientesResult.total);
          metricas.totalRetenido = parseFloat(retencionesResult.total);
          break;

        case 'caja':
          metricas.documentosHoy = await Documento.count({ where: whereBasePeriodo });
          
          const [cobradoHoyResult] = await sequelize.query(`
            SELECT COALESCE(SUM(valor_pagado), 0) as total
            FROM documentos
            WHERE DATE(fecha_pago) = CURDATE()
            AND estado_pago IN ('pagado_completo', 'pagado_con_retencion')
            AND estado NOT IN ('eliminado', 'nota_credito')
          `, {
            type: sequelize.QueryTypes.SELECT
          });

          metricas.cobradoHoy = parseFloat(cobradoHoyResult.total);
          metricas.pendientesCobro = await Documento.count({
            where: {
              estado_pago: 'pendiente_pago',
              estado: { [Op.notIn]: ['eliminado', 'nota_credito'] }
            }
          });

          const [retencionesHoyResult] = await sequelize.query(`
            SELECT COALESCE(SUM(valor_retenido), 0) as total
            FROM documentos
            WHERE DATE(created_at) = CURDATE()
            AND valor_retenido > 0
            AND estado NOT IN ('eliminado', 'nota_credito')
          `, {
            type: sequelize.QueryTypes.SELECT
          });

          metricas.retencionesHoy = parseFloat(retencionesHoyResult.total);
          break;

        case 'matrizador':
          if (filtros.matrizadorId) {
            const whereMatrizador = { ...whereBasePeriodo, id_matrizador: filtros.matrizadorId };
            metricas.docsAsignados = await Documento.count({ where: whereMatrizador });
            metricas.docsCompletados = await Documento.count({ 
              where: { ...whereMatrizador, estado: 'listo_para_entrega' }
            });
            metricas.docsPendientes = await Documento.count({ 
              where: { ...whereMatrizador, estado: 'en_proceso' }
            });
            metricas.promedioTiempo = '2.5 días'; // Placeholder - calcular real
          }
          break;

        case 'recepcion':
          metricas.docsListos = await Documento.count({
            where: { estado: 'listo_para_entrega' }
          });
          metricas.docsEntregadosHoy = await Documento.count({
            where: {
              estado: 'entregado',
              fecha_entrega: {
                [Op.between]: [
                  moment().startOf('day').toDate(),
                  moment().endOf('day').toDate()
                ]
              }
            }
          });
          metricas.codigosPendientes = await Documento.count({
            where: {
              estado: 'listo_para_entrega',
              codigo_verificacion: { [Op.not]: null }
            }
          });
          break;
      }

      // Formatear métricas con configuración
      const metricasFormateadas = config.metricas.map(metricaConfig => {
        const valor = metricas[metricaConfig.key] || 0;
        return {
          ...metricaConfig,
          valor: this.formatearValor(valor, metricaConfig.key),
          valorRaw: valor
        };
      });

      return metricasFormateadas;

    } catch (error) {
      console.error('Error al obtener métricas:', error);
      throw error;
    }
  }

  /**
   * OBTENER ALERTAS CRÍTICAS NOTARIALES ESPECÍFICAS
   * @param {string} rol - admin, caja, matrizador, recepcion
   */
  static async obtenerAlertasCriticasNotariales(rol) {
    try {
      const alertas = [];
      
      if (rol === 'admin') {
        // ALERTA 1: Documentos >7 días en proceso
        const docsAtrasados7Dias = await Documento.count({
          where: {
            estado: 'en_proceso',
            created_at: { [Op.lt]: moment().subtract(7, 'days').toDate() }
          }
        });
        
        if (docsAtrasados7Dias > 0) {
          alertas.push({
            tipo: 'documentos_atrasados_7d',
            titulo: `${docsAtrasados7Dias} documentos >7 días en proceso`,
            cantidad: docsAtrasados7Dias,
            descripcion: 'Documentos que llevan más de 7 días sin completar - Requieren supervisión urgente',
            enlace: '/admin/documentos?estado=en_proceso&antiguedad=7',
            color: 'danger',
            urgencia: 'alta'
          });
        }
        
        // ALERTA 2: Pagos atrasados >15 días
        const pagosAtrasados15Dias = await Documento.count({
          where: {
            estadoPago: 'pendiente',
            numeroFactura: { [Op.not]: null },
            estado: { [Op.notIn]: ['eliminado', 'nota_credito'] },
            created_at: { [Op.lt]: moment().subtract(15, 'days').toDate() }
          }
        });
        
        if (pagosAtrasados15Dias > 0) {
          const [montoResult] = await sequelize.query(`
            SELECT COALESCE(SUM(valor_factura), 0) as total
            FROM documentos
            WHERE estado_pago = 'pendiente'
            AND numero_factura IS NOT NULL
            AND estado NOT IN ('eliminado', 'nota_credito')
            AND created_at < :fecha
          `, {
            replacements: { fecha: moment().subtract(15, 'days').format('YYYY-MM-DD') },
            type: sequelize.QueryTypes.SELECT
          });
          
          alertas.push({
            tipo: 'pagos_atrasados_15d',
            titulo: `${pagosAtrasados15Dias} pagos atrasados >15 días`,
            cantidad: pagosAtrasados15Dias,
            descripcion: `$${parseFloat(montoResult.total).toFixed(2)} en pagos vencidos - Gestión de cobranza urgente`,
            enlace: '/admin/documentos?estadoPago=pendiente&antiguedad=15',
            color: 'danger',
            urgencia: 'alta'
          });
        }
        
        // ALERTA 3: Documentos listos >5 días sin entregar
        const listosViejos5Dias = await Documento.count({
          where: {
            estado: 'listo_para_entrega',
            updated_at: { [Op.lt]: moment().subtract(5, 'days').toDate() }
          }
        });
        
        if (listosViejos5Dias > 0) {
          alertas.push({
            tipo: 'listos_sin_entregar_5d',
            titulo: `${listosViejos5Dias} documentos listos >5 días sin entregar`,
            cantidad: listosViejos5Dias,
            descripcion: 'Documentos completados pero no entregados - Contactar clientes urgente',
            enlace: '/admin/documentos?estado=listo_para_entrega&antiguedad=5',
            color: 'warning',
            urgencia: 'media'
          });
        }
        
        // ALERTA 4: Matrizadores sobrecargados
        const [matrizadoresSobrecargados] = await sequelize.query(`
          SELECT 
            m.nombre,
            COUNT(d.id) as docs_asignados
          FROM matrizadores m
          INNER JOIN documentos d ON m.id = d.id_matrizador
          WHERE d.estado IN ('en_proceso', 'listo_para_entrega')
          AND d.estado NOT IN ('eliminado', 'nota_credito')
          GROUP BY m.id, m.nombre
          HAVING COUNT(d.id) > 10
        `, {
          type: sequelize.QueryTypes.SELECT
        });
        
        if (matrizadoresSobrecargados.length > 0) {
          const totalSobrecargados = matrizadoresSobrecargados.length;
          const nombres = matrizadoresSobrecargados.map(m => `${m.nombre} (${m.docs_asignados})`).join(', ');
          
          alertas.push({
            tipo: 'matrizadores_sobrecargados',
            titulo: `${totalSobrecargados} matrizadores sobrecargados`,
            cantidad: totalSobrecargados,
            descripcion: `Más de 10 docs asignados: ${nombres}`,
            enlace: '/admin/matrizadores?vista=carga_trabajo',
            color: 'warning',
            urgencia: 'media'
          });
        }
        
      } else if (rol === 'caja') {
        // Alertas específicas de caja
        const pagosPendientesHoy = await Documento.count({
          where: {
            estadoPago: 'pendiente',
            created_at: {
              [Op.between]: [moment().startOf('day').toDate(), moment().endOf('day').toDate()]
            }
          }
        });
        
        if (pagosPendientesHoy > 0) {
          alertas.push({
            tipo: 'pagos_pendientes_hoy',
            titulo: `${pagosPendientesHoy} pagos pendientes de hoy`,
            cantidad: pagosPendientesHoy,
            descripcion: 'Documentos creados hoy que aún no han sido pagados',
            enlace: '/caja/documentos?estadoPago=pendiente&fecha=hoy',
            color: 'warning',
            urgencia: 'media'
          });
        }
      }
      
      return alertas;
      
    } catch (error) {
      console.error('Error al obtener alertas críticas notariales:', error);
      throw error;
    }
  }

  /**
   * OBTENER ALERTAS SEGÚN ROL (FUNCIÓN ORIGINAL)
   * @param {string} rol - admin, caja, matrizador, recepcion
   * @param {object} filtros - Filtros específicos
   */
  static async obtenerAlertasSegunRol(rol, filtros = {}) {
    try {
      const config = CONFIGURACIONES_ROL[rol];
      if (!config) {
        throw new Error(`Rol no válido: ${rol}`);
      }

      const alertas = [];

      for (const alertaConfig of config.alertas) {
        const alerta = await this.calcularAlerta(alertaConfig.tipo, rol, filtros);
        if (alerta && alerta.cantidad > 0) {
          alertas.push({
            ...alertaConfig,
            ...alerta
          });
        }
      }

      return alertas;

    } catch (error) {
      console.error('Error al obtener alertas:', error);
      throw error;
    }
  }

  /**
   * CALCULAR ALERTA ESPECÍFICA
   * @param {string} tipo - Tipo de alerta
   * @param {string} rol - Rol del usuario
   * @param {object} filtros - Filtros específicos
   */
  static async calcularAlerta(tipo, rol, filtros = {}) {
    try {
      let cantidad = 0;
      let descripcion = '';
      let enlace = '';
      let urgencia = 'media';

      switch (tipo) {
        case 'documentos_atrasados':
          cantidad = await Documento.count({
            where: {
              estado: 'en_proceso',
              created_at: {
                [Op.lt]: moment().subtract(15, 'days').toDate()
              }
            }
          });
          descripcion = 'Más de 15 días en proceso';
          enlace = '/admin/documentos?filtro=atrasados';
          urgencia = 'alta';
          break;

        case 'pagos_vencidos':
          cantidad = await Documento.count({
            where: {
              estado_pago: 'pendiente_pago',
              created_at: {
                [Op.lt]: moment().subtract(30, 'days').toDate()
              }
            }
          });
          descripcion = 'Más de 30 días sin pagar';
          enlace = '/admin/documentos?filtro=pagos_vencidos';
          urgencia = 'alta';
          break;

        case 'sin_entregar':
          cantidad = await Documento.count({
            where: {
              estado: 'listo_para_entrega',
              created_at: {
                [Op.lt]: moment().subtract(7, 'days').toDate()
              }
            }
          });
          descripcion = 'Más de 7 días sin entregar';
          enlace = '/admin/documentos?filtro=sin_entregar';
          urgencia = 'media';
          break;

        case 'pagos_urgentes':
          cantidad = await Documento.count({
            where: {
              estado_pago: 'pendiente_pago',
              created_at: {
                [Op.lt]: moment().subtract(7, 'days').toDate()
              }
            }
          });
          descripcion = 'Pagos pendientes urgentes';
          enlace = '/caja/documentos?filtro=urgentes';
          urgencia = 'alta';
          break;

        case 'docs_listos_esperando':
          cantidad = await Documento.count({
            where: { estado: 'listo_para_entrega' }
          });
          descripcion = 'Documentos listos para entregar';
          enlace = '/recepcion/documentos?filtro=listos';
          urgencia = 'media';
          break;

        default:
          return null;
      }

      return {
        cantidad,
        descripcion,
        enlace,
        urgencia
      };

    } catch (error) {
      console.error('Error al calcular alerta:', error);
      return null;
    }
  }

  /**
   * CALCULAR PRIORIDAD SEGÚN FECHA
   * @param {Date} fechaCreacion - Fecha de creación del documento
   */
  static calcularPrioridad(fechaCreacion) {
    const diasPasados = moment().diff(moment(fechaCreacion), 'days');
    
    if (diasPasados > 10) return 'alta';
    if (diasPasados > 5) return 'media';
    return 'baja';
  }

  /**
   * FORMATEAR VALOR SEGÚN TIPO
   * @param {*} valor - Valor a formatear
   * @param {string} tipo - Tipo de valor
   */
  static formatearValor(valor, tipo) {
    if (tipo.includes('facturado') || tipo.includes('cobrado') || tipo.includes('retenido') || tipo.includes('pendiente')) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(valor);
    }
    
    if (tipo.includes('tiempo')) {
      return valor; // Ya viene formateado
    }
    
    return valor.toLocaleString();
  }

  /**
   * OBTENER CONFIGURACIÓN DE COLUMNAS SEGÚN ROL
   * @param {string} rol - Rol del usuario
   */
  static obtenerColumnasSegunRol(rol) {
    const config = CONFIGURACIONES_ROL[rol];
    return config ? config.columnas : [];
  }

  /**
   * OBTENER COLORES DE ESTADO
   */
  static obtenerColoresEstado() {
    return COLORES_ESTADO;
  }

  /**
   * FUNCIÓN AUXILIAR: Calcular fechas según rango predefinido
   * @param {string} rango - Rango de tiempo (hoy, semana, mes, etc.)
   * @param {string} [fechaInicioCustom] - Fecha de inicio personalizada (YYYY-MM-DD)
   * @param {string} [fechaFinCustom] - Fecha de fin personalizada (YYYY-MM-DD)
   * @returns {object} Objeto con inicio, fin y texto del período
   */
  static calcularFechasPorRango(rango, fechaInicioCustom = null, fechaFinCustom = null) {
    const hoy = moment().startOf('day');

    switch (rango) {
      case 'hoy':
        return {
          inicio: hoy.clone(),
          fin: moment().endOf('day'),
          texto: 'Hoy'
        };
      case 'ayer':
        return {
          inicio: hoy.clone().subtract(1, 'days'),
          fin: hoy.clone().subtract(1, 'days').endOf('day'),
          texto: 'Ayer'
        };
      case 'semana':
        return {
          inicio: hoy.clone().startOf('week'),
          fin: moment().endOf('day'),
          texto: 'Esta semana'
        };
      case 'semana_anterior':
        return {
          inicio: hoy.clone().subtract(1, 'week').startOf('week'),
          fin: hoy.clone().subtract(1, 'week').endOf('week'),
          texto: 'Semana anterior'
        };
      case 'mes':
        return {
          inicio: hoy.clone().startOf('month'),
          fin: moment().endOf('day'),
          texto: 'Este mes'
        };
      case 'mes_anterior':
        return {
          inicio: hoy.clone().subtract(1, 'month').startOf('month'),
          fin: moment().subtract(1, 'month').endOf('month'),
          texto: 'Mes anterior'
        };
      case 'trimestre':
        return {
          inicio: hoy.clone().startOf('quarter'),
          fin: moment().endOf('day'),
          texto: 'Este trimestre'
        };
      case 'trimestre_anterior':
        return {
          inicio: hoy.clone().subtract(1, 'quarter').startOf('quarter'),
          fin: hoy.clone().subtract(1, 'quarter').endOf('quarter'),
          texto: 'Trimestre anterior'
        };
      case 'año':
        return {
          inicio: hoy.clone().startOf('year'),
          fin: moment().endOf('day'),
          texto: 'Este año'
        };
      case 'año_anterior':
        return {
          inicio: hoy.clone().subtract(1, 'year').startOf('year'),
          fin: hoy.clone().subtract(1, 'year').endOf('year'),
          texto: 'Año anterior'
        };
      case 'ultimos_30':
        return {
          inicio: hoy.clone().subtract(30, 'days'),
          fin: moment().endOf('day'),
          texto: 'Últimos 30 días'
        };
      case '30_dias_anteriores':
        return {
          inicio: hoy.clone().subtract(60, 'days'),
          fin: hoy.clone().subtract(30, 'days'),
          texto: '30 días anteriores'
        };
      case 'personalizado':
        return {
          inicio: moment(fechaInicioCustom).startOf('day'),
          fin: moment(fechaFinCustom).endOf('day'),
          texto: `Del ${moment(fechaInicioCustom).format('DD/MM/YYYY')} al ${moment(fechaFinCustom).format('DD/MM/YYYY')}`
        };
      case 'desde_inicio':
        return {
          inicio: moment('2020-01-01').startOf('day'), // Arbitrary early date
          fin: moment().endOf('day'),
          texto: 'Desde el Inicio (Todos los datos históricos)'
        };
      default:
        return {
          inicio: hoy.clone().startOf('month'),
          fin: moment().endOf('day'),
          texto: 'Este mes'
        };
    }
  }

  /**
   * OBTENER DATOS COMPLETOS DE UN DOCUMENTO PARA DETALLE
   * @param {string} rol - Rol del usuario
   * @param {string} documentoId - ID del documento
   * @returns {Object} - Datos del documento y configuración para el detalle
   */
  static async obtenerDetalleDocumento(rol, documentoId) {
    try {
      // Consulta base del documento con relaciones
      const documento = await Documento.findByPk(documentoId, {
        include: [
          {
            model: require('../models/Usuario'),
            as: 'matrizador',
            attributes: ['id', 'nombre', 'email', 'rol']
          },
          {
            model: require('../models/Compareciente'),
            as: 'comparecientes',
            attributes: ['nombre', 'identificacion', 'rol']
          }
        ]
      });

      if (!documento) {
        return { error: 'Documento no encontrado' };
      }

      // Configurar acciones disponibles según rol
      const accionesDisponibles = this.obtenerAccionesDisponibles(rol, documento);

      // Configurar permisos según rol
      const permisos = this.obtenerPermisosDetalle(rol);

      return {
        documento: documento.toJSON(),
        rol,
        accionesDisponibles,
        permisos,
        colores: this.obtenerColoresEstado()
      };

    } catch (error) {
      console.error('Error al obtener detalle del documento:', error);
      return { error: 'Error interno del servidor' };
    }
  }

  /**
   * OBTENER ACCIONES DISPONIBLES SEGÚN ROL Y ESTADO DEL DOCUMENTO
   * @param {string} rol - Rol del usuario
   * @param {Object} documento - Documento actual
   * @returns {Array} - Array de acciones disponibles
   */
  static obtenerAccionesDisponibles(rol, documento) {
    const acciones = [];

    switch (rol) {
      case 'admin':
        // Admin solo puede ver (supervisión)
        acciones.push({
          tipo: 'exportar',
          texto: 'Exportar',
          enlace: `/admin/documentos/${documento.id}/exportar`,
          icono: 'fas fa-download'
        });
        acciones.push({
          tipo: 'historial',
          texto: 'Historial Completo',
          enlace: `/admin/documentos/${documento.id}/historial`,
          icono: 'fas fa-history'
        });
        break;

      case 'caja':
        // Caja puede registrar pagos y cambiar matrizador
        if (documento.estadoPago !== 'pagado_completo' && documento.estado !== 'eliminado') {
          acciones.push({
            tipo: 'pagar',
            texto: 'Registrar Pago',
            modal: 'registrarPagoModal',
            icono: 'fas fa-dollar-sign'
          });
        }
        break;

      case 'matrizador':
        // Matrizador puede editar y marcar como listo
        if (documento.estado === 'en_proceso') {
          acciones.push({
            tipo: 'editar',
            texto: 'Editar',
            enlace: `/matrizador/documentos/${documento.id}/editar`,
            icono: 'fas fa-edit'
          });
          acciones.push({
            tipo: 'marcar_listo',
            texto: 'Marcar como Listo',
            icono: 'fas fa-check'
          });
        }
        break;

      case 'recepcion':
        // Recepción puede entregar documentos
        if (documento.estado === 'listo_para_entrega') {
          acciones.push({
            tipo: 'entregar',
            texto: 'Procesar Entrega',
            enlace: `/recepcion/documentos/${documento.id}/entrega`,
            icono: 'fas fa-handshake'
          });
        }
        break;
    }

    return acciones;
  }

  /**
   * OBTENER PERMISOS ESPECÍFICOS PARA EL DETALLE SEGÚN ROL
   * @param {string} rol - Rol del usuario
   * @returns {Object} - Objeto con permisos
   */
  static obtenerPermisosDetalle(rol) {
    const permisos = {
      admin: {
        verFinanciero: true,
        verReversiones: true,
        verHistorialCompleto: true,
        editarDocumento: false,
        registrarPago: false,
        procesarEntrega: false
      },
      caja: {
        verFinanciero: true,
        verReversiones: false,
        verHistorialCompleto: false,
        editarDocumento: false,
        registrarPago: true,
        procesarEntrega: false
      },
      matrizador: {
        verFinanciero: false,
        verReversiones: false,
        verHistorialCompleto: false,
        editarDocumento: true,
        registrarPago: false,
        procesarEntrega: false
      },
      recepcion: {
        verFinanciero: false,
        verReversiones: false,
        verHistorialCompleto: false,
        editarDocumento: false,
        registrarPago: false,
        procesarEntrega: true
      }
    };

    return permisos[rol] || {};
  }

  /**
   * OBTENER KPIs EJECUTIVOS CON TENDENCIAS
   * Función principal para el dashboard ejecutivo
   * @param {string} filtroTemporal - Filtro temporal (hoy, semana, mes, etc.)
   * @param {string} fechaInicio - Fecha inicio personalizada
   * @param {string} fechaFin - Fecha fin personalizada
   * @returns {Object} - KPIs ejecutivos con tendencias y comparaciones
   */
  static async obtenerKPIsEjecutivos(filtroTemporal = 'mes', fechaInicio = null, fechaFin = null) {
    try {
      // 1. Calcular período actual
      const periodoActual = this.calcularPeriodoTemporal(filtroTemporal, fechaInicio, fechaFin);
      
      // 2. Calcular período anterior para comparación
      const periodoAnterior = this.calcularPeriodoAnterior(filtroTemporal, fechaInicio, fechaFin);
      
      // 3. Obtener métricas del período actual
      const metricasActuales = await this.calcularMetricasPeriodo(
        periodoActual.inicio, 
        periodoActual.fin
      );
      
      // 4. Obtener métricas del período anterior
      const metricasAnteriores = await this.calcularMetricasPeriodo(
        periodoAnterior.inicio, 
        periodoAnterior.fin
      );
      
      // 5. Calcular tendencias
      const tendencias = this.calcularTendencias(metricasActuales, metricasAnteriores);
      
      // 6. Estructurar KPIs ejecutivos
      const kpisEjecutivos = {
        ingresos: {
          valor: metricasActuales.facturado,
          valorFormateado: this.formatearMoneda(metricasActuales.facturado),
          tendencia: tendencias.facturado,
          icono: 'fas fa-dollar-sign',
          color: 'success',
          descripcion: 'Ingresos del Período'
        },
        documentos: {
          valor: metricasActuales.totalDocumentos,
          valorFormateado: metricasActuales.totalDocumentos.toLocaleString(),
          tendencia: tendencias.totalDocumentos,
          icono: 'fas fa-file-alt',
          color: 'primary',
          descripcion: 'Documentos Procesados'
        },
        pagos: {
          valor: metricasActuales.pendiente,
          valorFormateado: this.formatearMoneda(metricasActuales.pendiente),
          tendencia: tendencias.pendiente,
          icono: 'fas fa-clock',
          color: 'warning',
          descripcion: 'Pagos Pendientes'
        },
        eficiencia: {
          valor: metricasActuales.eficiencia,
          valorFormateado: `${metricasActuales.eficiencia}%`,
          tendencia: tendencias.eficiencia,
          icono: 'fas fa-chart-line',
          color: 'info',
          descripcion: 'Eficiencia de Entrega'
        }
      };
      
      // 7. Obtener acciones prioritarias
      const accionesPrioritarias = await this.obtenerAccionesPrioritarias();
      
      // 8. Obtener datos para gráfico
      const datosGrafico = await this.obtenerDatosGrafico(filtroTemporal, periodoActual);
      
      return {
        kpis: kpisEjecutivos,
        periodo: {
          actual: periodoActual.texto,
          anterior: periodoAnterior.texto,
          filtro: filtroTemporal
        },
        acciones: accionesPrioritarias,
        grafico: datosGrafico,
        resumen: {
          totalFacturado: metricasActuales.facturado,
          totalDocumentos: metricasActuales.totalDocumentos,
          eficienciaGeneral: metricasActuales.eficiencia,
          cambioRespectoPeriodoAnterior: tendencias.facturado.porcentaje
        }
      };
      
    } catch (error) {
      console.error('Error al obtener KPIs ejecutivos:', error);
      throw error;
    }
  }

  /**
   * CALCULAR PERÍODO TEMPORAL
   * @param {string} filtroTemporal - Tipo de filtro
   * @param {string} fechaInicio - Fecha inicio personalizada
   * @param {string} fechaFin - Fecha fin personalizada
   * @returns {Object} - Período con fechas de inicio y fin
   */
  static calcularPeriodoTemporal(filtroTemporal, fechaInicio = null, fechaFin = null) {
    if (filtroTemporal === 'personalizado' && fechaInicio && fechaFin) {
      return {
        inicio: moment(fechaInicio).startOf('day'),
        fin: moment(fechaFin).endOf('day'),
        texto: `${moment(fechaInicio).format('DD/MM/YYYY')} - ${moment(fechaFin).format('DD/MM/YYYY')}`
      };
    }
    
    return FILTROS_TEMPORALES[filtroTemporal]();
  }

  /**
   * CALCULAR PERÍODO ANTERIOR PARA COMPARACIÓN
   * @param {string} filtroTemporal - Tipo de filtro
   * @param {string} fechaInicio - Fecha inicio personalizada
   * @param {string} fechaFin - Fecha fin personalizada
   * @returns {Object} - Período anterior
   */
  static calcularPeriodoAnterior(filtroTemporal, fechaInicio = null, fechaFin = null) {
    if (filtroTemporal === 'personalizado' && fechaInicio && fechaFin) {
      const duracionDias = moment(fechaFin).diff(moment(fechaInicio), 'days');
      const inicioAnterior = moment(fechaInicio).subtract(duracionDias + 1, 'days');
      const finAnterior = moment(fechaInicio).subtract(1, 'day');
      
      return {
        inicio: inicioAnterior.startOf('day'),
        fin: finAnterior.endOf('day'),
        texto: `${inicioAnterior.format('DD/MM/YYYY')} - ${finAnterior.format('DD/MM/YYYY')}`
      };
    }
    
    switch (filtroTemporal) {
      case 'hoy':
        return {
          inicio: moment().subtract(1, 'day').startOf('day'),
          fin: moment().subtract(1, 'day').endOf('day'),
          texto: `Ayer ${moment().subtract(1, 'day').format('DD/MM/YYYY')}`
        };
      case 'semana':
        return {
          inicio: moment().subtract(1, 'week').startOf('week'),
          fin: moment().subtract(1, 'week').endOf('week'),
          texto: `Semana anterior`
        };
      case 'mes':
        return {
          inicio: moment().subtract(1, 'month').startOf('month'),
          fin: moment().subtract(1, 'month').endOf('month'),
          texto: `${moment().subtract(1, 'month').format('MMMM YYYY')}`
        };
      case 'año':
        return {
          inicio: moment().subtract(1, 'year').startOf('year'),
          fin: moment().subtract(1, 'year').endOf('year'),
          texto: `Año ${moment().subtract(1, 'year').year()}`
        };
      default:
        return FILTROS_TEMPORALES['mes_anterior']();
    }
  }

  /**
   * CALCULAR MÉTRICAS DE UN PERÍODO ESPECÍFICO
   * @param {moment} fechaInicio - Fecha inicio
   * @param {moment} fechaFin - Fecha fin
   * @returns {Object} - Métricas del período
   */
  static async calcularMetricasPeriodo(fechaInicio, fechaFin) {
    const fechaInicioSQL = fechaInicio.format('YYYY-MM-DD HH:mm:ss');
    const fechaFinSQL = fechaFin.format('YYYY-MM-DD HH:mm:ss');
    
    try {
      // Consulta para métricas operativas
      const [metricasOperativas] = await sequelize.query(`
        SELECT 
          COUNT(*) as totalDocumentos,
          COUNT(CASE WHEN estado = 'en_proceso' THEN 1 END) as enProceso,
          COUNT(CASE WHEN estado = 'listo_para_entrega' THEN 1 END) as listoParaEntrega,
          COUNT(CASE WHEN estado = 'entregado' THEN 1 END) as entregados
        FROM documentos
        WHERE created_at BETWEEN :fechaInicio AND :fechaFin
        AND estado NOT IN ('eliminado', 'nota_credito')
      `, {
        replacements: { fechaInicio: fechaInicioSQL, fechaFin: fechaFinSQL },
        type: sequelize.QueryTypes.SELECT
      });
      
      // Consulta para métricas financieras
      const [metricasFinancieras] = await sequelize.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN numero_factura IS NOT NULL THEN valor_factura ELSE 0 END), 0) as facturado,
          COALESCE(SUM(CASE WHEN estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial') THEN valor_pagado ELSE 0 END), 0) as cobrado,
          COALESCE(SUM(CASE WHEN numero_factura IS NOT NULL THEN valor_retenido ELSE 0 END), 0) as retenido
        FROM documentos
        WHERE created_at BETWEEN :fechaInicio AND :fechaFin
        AND estado NOT IN ('eliminado', 'nota_credito')
      `, {
        replacements: { fechaInicio: fechaInicioSQL, fechaFin: fechaFinSQL },
        type: sequelize.QueryTypes.SELECT
      });
      
      const totalDocumentos = parseInt(metricasOperativas.totalDocumentos) || 0;
      const entregados = parseInt(metricasOperativas.entregados) || 0;
      const facturado = parseFloat(metricasFinancieras.facturado) || 0;
      const cobrado = parseFloat(metricasFinancieras.cobrado) || 0;
      const retenido = parseFloat(metricasFinancieras.retenido) || 0;
      const pendiente = facturado - cobrado - retenido;
      const eficiencia = totalDocumentos > 0 ? Math.round((entregados / totalDocumentos) * 100) : 0;
      
      return {
        totalDocumentos,
        enProceso: parseInt(metricasOperativas.enProceso) || 0,
        listoParaEntrega: parseInt(metricasOperativas.listoParaEntrega) || 0,
        entregados,
        facturado,
        cobrado,
        retenido,
        pendiente,
        eficiencia
      };
      
    } catch (error) {
      console.error('Error al calcular métricas del período:', error);
      return {
        totalDocumentos: 0,
        enProceso: 0,
        listoParaEntrega: 0,
        entregados: 0,
        facturado: 0,
        cobrado: 0,
        retenido: 0,
        pendiente: 0,
        eficiencia: 0
      };
    }
  }

  /**
   * CALCULAR TENDENCIAS ENTRE DOS PERÍODOS
   * @param {Object} metricasActuales - Métricas del período actual
   * @param {Object} metricasAnteriores - Métricas del período anterior
   * @returns {Object} - Tendencias calculadas
   */
  static calcularTendencias(metricasActuales, metricasAnteriores) {
    const calcularTendencia = (actual, anterior) => {
      if (anterior === 0) {
        return {
          direccion: actual > 0 ? 'up' : 'neutral',
          porcentaje: actual > 0 ? 100 : 0,
          diferencia: actual,
          texto: actual > 0 ? `+${actual}` : '0'
        };
      }
      
      const diferencia = actual - anterior;
      const porcentaje = Math.round((diferencia / anterior) * 100);
      
      return {
        direccion: diferencia > 0 ? 'up' : diferencia < 0 ? 'down' : 'neutral',
        porcentaje: Math.abs(porcentaje),
        diferencia,
        texto: diferencia > 0 ? `+${porcentaje}%` : diferencia < 0 ? `${porcentaje}%` : '0%'
      };
    };
    
    return {
      facturado: calcularTendencia(metricasActuales.facturado, metricasAnteriores.facturado),
      totalDocumentos: calcularTendencia(metricasActuales.totalDocumentos, metricasAnteriores.totalDocumentos),
      pendiente: calcularTendencia(metricasActuales.pendiente, metricasAnteriores.pendiente),
      eficiencia: calcularTendencia(metricasActuales.eficiencia, metricasAnteriores.eficiencia)
    };
  }

  /**
   * FORMATEAR MONEDA
   * @param {number} valor - Valor a formatear
   * @returns {string} - Valor formateado
   */
  static formatearMoneda(valor) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(valor || 0);
  }

  /**
   * OBTENER ACCIONES PRIORITARIAS PARA EL CENTRO DE ACCIONES
   * @returns {Array} - Array de acciones prioritarias
   */
  static async obtenerAccionesPrioritarias() {
    try {
      const acciones = [];
      
      // 1. Pagos Atrasados (más de 5 días)
      const [pagosAtrasados] = await sequelize.query(`
        SELECT COUNT(*) as cantidad
        FROM documentos
        WHERE estado_pago = 'pendiente'
        AND numero_factura IS NOT NULL
        AND created_at < NOW() - INTERVAL '5 days'
        AND estado NOT IN ('eliminado', 'nota_credito')
      `);
      
      if (pagosAtrasados.cantidad > 0) {
        acciones.push({
          id: 'pagos_atrasados',
          titulo: 'Pagos Atrasados',
          descripcion: `${pagosAtrasados.cantidad} pagos con más de 5 días de atraso`,
          cantidad: pagosAtrasados.cantidad,
          prioridad: 'URGENTE',
          color: 'danger',
          icono: 'fas fa-exclamation-triangle',
          enlace: '/admin/reportes/pagos-atrasados',
          accion: 'Gestionar Cobros'
        });
      }
      
      // 2. Documentos Sin Entregar (más de 3 días listos)
      const [documentosSinEntregar] = await sequelize.query(`
        SELECT COUNT(*) as cantidad
        FROM documentos
        WHERE estado = 'listo_para_entrega'
        AND updated_at < NOW() - INTERVAL '3 days'
        AND estado NOT IN ('eliminado', 'nota_credito')
      `);
      
      if (documentosSinEntregar.cantidad > 0) {
        acciones.push({
          id: 'documentos_sin_entregar',
          titulo: 'Documentos Sin Entregar',
          descripcion: `${documentosSinEntregar.cantidad} documentos listos hace más de 3 días`,
          cantidad: documentosSinEntregar.cantidad,
          prioridad: 'ATENCIÓN',
          color: 'warning',
          icono: 'fas fa-clock',
          enlace: '/admin/documentos/listos-para-entrega',
          accion: 'Revisar Documentos'
        });
      }
      
      // 3. Retenciones Pendientes de Cobro
      const [retencionesPendientes] = await sequelize.query(`
        SELECT COUNT(*) as cantidad, SUM(valor_retenido) as monto
        FROM documentos
        WHERE valor_retenido > 0
        AND estado_pago IN ('pagado_con_retencion', 'pago_parcial')
        AND estado NOT IN ('eliminado', 'nota_credito')
      `);
      
      if (retencionesPendientes.cantidad > 0) {
        acciones.push({
          id: 'retenciones_pendientes',
          titulo: 'Retenciones por Cobrar',
          descripcion: `${this.formatearMoneda(retencionesPendientes.monto)} en ${retencionesPendientes.cantidad} documentos`,
          cantidad: retencionesPendientes.cantidad,
          prioridad: 'OPORTUNIDAD',
          color: 'info',
          icono: 'fas fa-receipt',
          enlace: '/admin/reportes/retenciones-pendientes',
          accion: 'Gestionar Retenciones'
        });
      }
      
      // 4. Documentos Atrasados en Proceso
      const [documentosAtrasados] = await sequelize.query(`
        SELECT COUNT(*) as cantidad
        FROM documentos
        WHERE estado = 'en_proceso'
        AND created_at < NOW() - INTERVAL '7 days'
        AND estado NOT IN ('eliminado', 'nota_credito')
      `);
      
      if (documentosAtrasados.cantidad > 0) {
        acciones.push({
          id: 'documentos_atrasados',
          titulo: 'Documentos Atrasados',
          descripcion: `${documentosAtrasados.cantidad} documentos en proceso hace más de 7 días`,
          cantidad: documentosAtrasados.cantidad,
          prioridad: 'ATENCIÓN',
          color: 'warning',
          icono: 'fas fa-hourglass-half',
          enlace: '/admin/documentos/atrasados',
          accion: 'Revisar Proceso'
        });
      }
      
      // Ordenar por prioridad
      const ordenPrioridad = { 'URGENTE': 1, 'ATENCIÓN': 2, 'OPORTUNIDAD': 3 };
      acciones.sort((a, b) => ordenPrioridad[a.prioridad] - ordenPrioridad[b.prioridad]);
      
      return acciones;
      
    } catch (error) {
      console.error('Error al obtener acciones prioritarias:', error);
      return [];
    }
  }

  /**
   * OBTENER DATOS PARA GRÁFICO SEGÚN FILTRO TEMPORAL
   * @param {string} filtroTemporal - Tipo de filtro
   * @param {Object} periodo - Período actual
   * @returns {Object} - Datos para el gráfico
   */
  static async obtenerDatosGrafico(filtroTemporal, periodo) {
    try {
      let datosGrafico = {};
      
      switch (filtroTemporal) {
        case 'hoy':
          datosGrafico = await this.obtenerDatosGraficoHoy(periodo);
          break;
        case 'semana':
          datosGrafico = await this.obtenerDatosGraficoSemana(periodo);
          break;
        case 'mes':
          datosGrafico = await this.obtenerDatosGraficoMes(periodo);
          break;
        default:
          datosGrafico = await this.obtenerDatosGraficoMensual(periodo);
          break;
      }
      
      return {
        tipo: filtroTemporal,
        titulo: this.obtenerTituloGrafico(filtroTemporal),
        datos: datosGrafico,
        configuracion: this.obtenerConfiguracionGrafico(filtroTemporal)
      };
      
    } catch (error) {
      console.error('Error al obtener datos del gráfico:', error);
      return {
        tipo: filtroTemporal,
        titulo: 'Flujo de Ingresos',
        datos: { labels: [], datasets: [] },
        configuracion: {}
      };
    }
  }

  /**
   * OBTENER DATOS DEL GRÁFICO PARA HOY (POR HORAS)
   */
  static async obtenerDatosGraficoHoy(periodo) {
    const horas = [];
    const ingresos = [];
    
    // Generar horas de 8 AM a 6 PM
    for (let hora = 8; hora <= 18; hora++) {
      const horaFormateada = hora < 10 ? `0${hora}:00` : `${hora}:00`;
      horas.push(horaFormateada);
      
      // Consultar ingresos para esa hora
      const [resultado] = await sequelize.query(`
        SELECT COALESCE(SUM(valor_pagado), 0) as ingresos
        FROM documentos
        WHERE DATE(created_at) = CURRENT_DATE
        AND EXTRACT(HOUR FROM created_at) = :hora
        AND estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial')
        AND estado NOT IN ('eliminado', 'nota_credito')
      `, {
        replacements: { hora },
        type: sequelize.QueryTypes.SELECT
      });
      
      ingresos.push(parseFloat(resultado.ingresos) || 0);
    }
    
    return {
      labels: horas,
      datasets: [{
        label: 'Ingresos por Hora',
        data: ingresos,
        borderColor: '#4E7DA6',
        backgroundColor: 'rgba(78, 125, 166, 0.1)',
        fill: true
      }]
    };
  }

  /**
   * OBTENER DATOS DEL GRÁFICO PARA SEMANA (POR DÍAS)
   */
  static async obtenerDatosGraficoSemana(periodo) {
    const dias = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const ingresos = [];
    
    for (let i = 0; i < 7; i++) {
      const fecha = moment().startOf('week').add(i, 'days');
      
      const [resultado] = await sequelize.query(`
        SELECT COALESCE(SUM(valor_pagado), 0) as ingresos
        FROM documentos
        WHERE DATE(created_at) = :fecha
        AND estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial')
        AND estado NOT IN ('eliminado', 'nota_credito')
      `, {
        replacements: { fecha: fecha.format('YYYY-MM-DD') },
        type: sequelize.QueryTypes.SELECT
      });
      
      ingresos.push(parseFloat(resultado.ingresos) || 0);
    }
    
    return {
      labels: dias,
      datasets: [{
        label: 'Ingresos por Día',
        data: ingresos,
        borderColor: '#4E7DA6',
        backgroundColor: 'rgba(78, 125, 166, 0.1)',
        fill: true
      }]
    };
  }

  /**
   * OBTENER DATOS DEL GRÁFICO PARA MES (POR DÍAS)
   */
  static async obtenerDatosGraficoMes(periodo) {
    const diasDelMes = moment().daysInMonth();
    const labels = [];
    const ingresos = [];
    
    for (let dia = 1; dia <= diasDelMes; dia++) {
      labels.push(dia.toString());
      
      const fecha = moment().startOf('month').add(dia - 1, 'days');
      
      const [resultado] = await sequelize.query(`
        SELECT COALESCE(SUM(valor_pagado), 0) as ingresos
        FROM documentos
        WHERE DATE(created_at) = :fecha
        AND estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial')
        AND estado NOT IN ('eliminado', 'nota_credito')
      `, {
        replacements: { fecha: fecha.format('YYYY-MM-DD') },
        type: sequelize.QueryTypes.SELECT
      });
      
      ingresos.push(parseFloat(resultado.ingresos) || 0);
    }
    
    return {
      labels,
      datasets: [{
        label: 'Ingresos por Día',
        data: ingresos,
        borderColor: '#4E7DA6',
        backgroundColor: 'rgba(78, 125, 166, 0.1)',
        fill: true
      }]
    };
  }

  /**
   * OBTENER DATOS DEL GRÁFICO MENSUAL (POR MESES)
   */
  static async obtenerDatosGraficoMensual(periodo) {
    const meses = [];
    const ingresos = [];
    
    for (let i = 11; i >= 0; i--) {
      const fecha = moment().subtract(i, 'months');
      meses.push(fecha.format('MMM'));
      
      const [resultado] = await sequelize.query(`
        SELECT COALESCE(SUM(valor_pagado), 0) as ingresos
        FROM documentos
        WHERE EXTRACT(YEAR FROM created_at) = $1 AND EXTRACT(MONTH FROM created_at) = $2
        AND estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial')
        AND estado NOT IN ('eliminado', 'nota_credito')
      `, {
        bind: [fecha.year(), fecha.month() + 1],
        type: sequelize.QueryTypes.SELECT
      });
      
      ingresos.push(parseFloat(resultado.ingresos) || 0);
    }
    
    return {
      labels: meses,
      datasets: [{
        label: 'Ingresos por Mes',
        data: ingresos,
        borderColor: '#4E7DA6',
        backgroundColor: 'rgba(78, 125, 166, 0.1)',
        fill: true
      }]
    };
  }

  /**
   * OBTENER TÍTULO DEL GRÁFICO SEGÚN FILTRO
   */
  static obtenerTituloGrafico(filtroTemporal) {
    const titulos = {
      'hoy': 'Flujo de Ingresos (Esta Semana)',
      'semana': 'Ingresos por Día (Esta Semana)',
      'mes': 'Ingresos por Día (Este Mes)',
      'año': 'Ingresos por Mes (Este Año)',
      'personalizado': 'Ingresos (Período Personalizado)'
    };
    
    return titulos[filtroTemporal] || 'Flujo de Ingresos';
  }

  /**
   * OBTENER CONFIGURACIÓN DEL GRÁFICO
   */
  static obtenerConfiguracionGrafico(filtroTemporal) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `Ingresos: ${ComponentesController.formatearMoneda(context.parsed.y)}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return ComponentesController.formatearMoneda(value);
            }
          }
        }
      }
    };
  }

  /**
   * FUNCIONES DE VALIDACIÓN Y FORMATEO CENTRALIZADAS
   * Movidas desde adminController para eliminar duplicación
   */

  /**
   * Valida métricas financieras asegurando coherencia matemática
   * @param {Object} metricas - Objeto con métricas financieras
   * @returns {Object} Métricas validadas
   */
  static validarMetricas(metricas) {
    // Verificar que sean números válidos
    Object.keys(metricas).forEach(key => {
      if (isNaN(metricas[key]) || metricas[key] === null || metricas[key] === undefined) {
        console.warn(`Valor inválido en ${key}:`, metricas[key]);
        metricas[key] = 0;
      }
    });
    
    // Verificar fórmula matemática: Facturado = Cobrado + Retenido + Pendiente
    if (metricas.facturado !== undefined && metricas.cobrado !== undefined && 
        metricas.retenido !== undefined && metricas.pendiente !== undefined) {
      const suma = parseFloat(metricas.cobrado) + parseFloat(metricas.retenido) + parseFloat(metricas.pendiente);
      const diferencia = Math.abs(parseFloat(metricas.facturado) - suma);
      
      if (diferencia > 0.01) { // Tolerancia de 1 centavo
        console.warn('Posible error matemático detectado:', {
          facturado: metricas.facturado,
          suma: suma,
          diferencia: diferencia
        });
      }
    }
    
    return metricas;
  }

  /**
   * Formatea valor monetario con formato estadounidense
   * @param {number} valor - Valor a formatear
   * @returns {string} Valor formateado como moneda
   */
  static formatearDinero(valor) {
    if (!valor || isNaN(valor)) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(parseFloat(valor));
  }

  /**
   * Formatea porcentaje con 1 decimal máximo
   * @param {number} valor - Valor a formatear
   * @returns {string} Valor formateado como porcentaje
   */
  static formatearPorcentaje(valor) {
    if (!valor || isNaN(valor)) return '0.0%';
    return `${parseFloat(valor).toFixed(1)}%`;
  }

  /**
   * Formatea diferencias con signo para comparaciones
   * @param {number} valor - Valor de diferencia
   * @param {string} tipo - 'dinero' o 'porcentaje'
   * @returns {string} Diferencia formateada con signo
   */
  static formatearDiferencia(valor, tipo = 'dinero') {
    if (!valor || isNaN(valor)) return tipo === 'dinero' ? '$0.00' : '0.0%';
    
    const num = parseFloat(valor);
    const signo = num >= 0 ? '+' : '-';
    
    if (tipo === 'dinero') {
      return `${signo}$${Math.abs(num).toFixed(2)}`;
    } else if (tipo === 'porcentaje') {
      return `${signo}${Math.abs(num).toFixed(1)}%`;
    }
    
    return `${signo}${Math.abs(num).toFixed(2)}`;
  }

  /**
   * Genera análisis comparativo entre dos períodos
   * @param {Object} periodoA - Métricas del primer período
   * @param {Object} periodoB - Métricas del segundo período
   * @returns {Object} Análisis comparativo completo
   */
  static generarAnalisisComparativo(periodoA, periodoB) {
    const metricas = [
      { key: 'facturado', nombre: 'Facturado', formato: 'moneda', icono: 'fas fa-file-invoice' },
      { key: 'cobrado', nombre: 'Cobrado', formato: 'moneda', icono: 'fas fa-dollar-sign' },
      { key: 'retenido', nombre: 'Retenido', formato: 'moneda', icono: 'fas fa-receipt' },
      { key: 'pendiente', nombre: 'Pendiente', formato: 'moneda', icono: 'fas fa-clock' },
      { key: 'totalDocumentos', nombre: 'Documentos', formato: 'numero', icono: 'fas fa-file-alt' },
      { key: 'entregados', nombre: 'Entregados', formato: 'numero', icono: 'fas fa-handshake' },
      { key: 'eficiencia', nombre: 'Eficiencia', formato: 'porcentaje', icono: 'fas fa-chart-line' }
    ];
    
    const comparaciones = metricas.map(metrica => {
      const valorA = periodoA[metrica.key] || 0;
      const valorB = periodoB[metrica.key] || 0;
      const diferencia = valorA - valorB;
      const porcentaje = valorB !== 0 ? ((diferencia / valorB) * 100) : 0;
      
      // FORMATEO PROFESIONAL según el tipo de métrica
      let valorAFormateado, valorBFormateado, diferenciaFormateada;
      
      if (metrica.formato === 'moneda') {
        valorAFormateado = this.formatearDinero(valorA);
        valorBFormateado = this.formatearDinero(valorB);
        diferenciaFormateada = this.formatearDiferencia(diferencia, 'dinero');
      } else if (metrica.formato === 'porcentaje') {
        valorAFormateado = this.formatearPorcentaje(valorA);
        valorBFormateado = this.formatearPorcentaje(valorB);
        diferenciaFormateada = this.formatearDiferencia(diferencia, 'porcentaje');
      } else {
        valorAFormateado = Math.round(valorA).toString();
        valorBFormateado = Math.round(valorB).toString();
        diferenciaFormateada = diferencia >= 0 ? `+${Math.round(diferencia)}` : Math.round(diferencia).toString();
      }
      
      return {
        ...metrica,
        valorA,
        valorB,
        diferencia,
        // VALORES FORMATEADOS PARA LA VISTA
        valorAFormateado,
        valorBFormateado,
        diferenciaFormateada,
        porcentaje: Math.round(porcentaje * 10) / 10, // Redondear a 1 decimal
        porcentajeFormateado: this.formatearDiferencia(porcentaje, 'porcentaje'),
        direccion: diferencia > 0 ? 'up' : diferencia < 0 ? 'down' : 'equal',
        color: diferencia > 0 ? 'success' : diferencia < 0 ? 'danger' : 'secondary',
        significativo: Math.abs(porcentaje) >= 10 // Cambio significativo si >= 10%
      };
    });
    
    // Generar insights automáticos
    const cambiosSignificativos = comparaciones
      .filter(c => c.significativo)
      .sort((a, b) => Math.abs(b.porcentaje) - Math.abs(a.porcentaje))
      .slice(0, 3);
    
    const mejoras = comparaciones.filter(c => c.direccion === 'up' && c.significativo);
    const empeoramientos = comparaciones.filter(c => c.direccion === 'down' && c.significativo);
    
    // Generar recomendaciones
    const recomendaciones = [];
    if (mejoras.length > empeoramientos.length) {
      recomendaciones.push('Tendencia positiva general - mantener estrategias actuales');
    }
    if (empeoramientos.some(e => e.key === 'pendiente')) {
      recomendaciones.push('Revisar proceso de cobros - pendientes aumentaron');
    }
    if (mejoras.some(m => m.key === 'eficiencia')) {
      recomendaciones.push('Eficiencia operativa mejorando - continuar optimizaciones');
    }
    if (empeoramientos.some(e => e.key === 'totalDocumentos')) {
      recomendaciones.push('Volumen de documentos disminuyó - revisar captación');
    }
    
    return {
      comparaciones,
      insights: {
        cambiosSignificativos,
        mejoras,
        empeoramientos,
        recomendaciones
      },
      periodoA: periodoA.periodoTexto,
      periodoB: periodoB.periodoTexto
    };
  }
}

module.exports = ComponentesController;