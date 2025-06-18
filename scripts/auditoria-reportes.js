/**
 * AUDITORÍA COMPLETA DEL SISTEMA DE REPORTES
 * 
 * Este script detecta inconsistencias matemáticas críticas en todos los reportes
 * del sistema, especialmente el problema donde "cobrado > facturado".
 * 
 * PROBLEMA DETECTADO: Reporte financiero con inconsistencias en cálculos
 * CAUSA PROBABLE: Diferentes métodos de cálculo en Admin vs Caja + rol archivo
 * 
 * AUTOR: Sistema de Auditoría Automatizada
 * FECHA: 2025-01-29
 */

const { Documento, Matrizador, Pago, EventoDocumento } = require('../models');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');
const moment = require('moment');

class AuditoriaReportes {
  constructor() {
    this.errores = [];
    this.advertencias = [];
    this.inconsistencias = [];
    this.resultados = {
      integridad: {},
      financiero: {},
      admin: {},
      caja: {},
      roles: {}
    };
  }

  async ejecutarAuditoria() {
    console.log('🔍 INICIANDO AUDITORÍA COMPLETA DE REPORTES');
    console.log('================================================');
    console.log(`Fecha: ${moment().format('DD/MM/YYYY HH:mm:ss')}`);
    console.log(`Usuario: Auditoría Automatizada`);
    console.log('');
    
    try {
      // 1. Auditar integridad básica de datos
      await this.auditarIntegridadDatos();
      
      // 2. Auditar reportes financieros (CRÍTICO)
      await this.auditarReportesFinancieros();
      
      // 3. Auditar métodos de cálculo
      await this.auditarMetodosCalculo();
      
      // 4. Auditar reportes de admin vs caja
      await this.auditarComparacionReportes();
      
      // 5. Auditar filtros por rol (problema archivo)
      await this.auditarFiltrosPorRol();
      
      // 6. Auditar queries SQL específicas
      await this.auditarQueriesSQL();
      
      // 7. Generar reporte final
      this.generarReporteFinal();
      
    } catch (error) {
      console.error('❌ Error durante auditoría:', error);
      throw error;
    }
  }

  async auditarIntegridadDatos() {
    console.log('\n📊 1. AUDITANDO INTEGRIDAD DE DATOS');
    console.log('-------------------------------------');
    
    try {
      // Verificar documentos sin matrizador
      const docsSinMatrizador = await Documento.count({
        where: { idMatrizador: null }
      });
      
      if (docsSinMatrizador > 0) {
        this.advertencias.push(`${docsSinMatrizador} documentos sin matrizador asignado`);
      }
      console.log(`📄 Documentos sin matrizador: ${docsSinMatrizador}`);

      // Verificar valores nulos en campos críticos
      const docsValorNulo = await Documento.count({
        where: { 
          [Op.or]: [
            { valorFactura: null },
            { valorFactura: 0 }
          ]
        }
      });
      
      if (docsValorNulo > 0) {
        this.advertencias.push(`${docsValorNulo} documentos con valor de factura nulo o cero`);
      }
      console.log(`💰 Documentos sin valor: ${docsValorNulo}`);

      // Verificar documentos con fechas inconsistentes
      const docsFechaInconsistente = await Documento.count({
        where: {
          updatedAt: { [Op.lt]: sequelize.col('created_at') }
        }
      });
      
      if (docsFechaInconsistente > 0) {
        this.errores.push(`${docsFechaInconsistente} documentos con fechas inconsistentes`);
      }
      console.log(`📅 Documentos con fechas inconsistentes: ${docsFechaInconsistente}`);

      // Verificar consistencia en campos de pago
      const docsValoresFaltantes = await Documento.count({
        where: {
          [Op.or]: [
            { valorPagado: null },
            { valorPendiente: null },
            { valorRetenido: null }
          ]
        }
      });
      
      if (docsValoresFaltantes > 0) {
        this.errores.push(`${docsValoresFaltantes} documentos con campos de pago nulos`);
      }
      console.log(`💳 Documentos con campos de pago nulos: ${docsValoresFaltantes}`);

      // Verificar integridad matemática básica
      const docsInconsistentesBasicos = await sequelize.query(`
        SELECT COUNT(*) as total
        FROM documentos 
        WHERE ABS(valor_factura - (valor_pagado + valor_pendiente + valor_retenido)) > 0.01
        AND valor_factura IS NOT NULL
        AND estado NOT IN ('eliminado', 'nota_credito')
      `, { type: sequelize.QueryTypes.SELECT });

      const totalInconsistentesBasicos = parseInt(docsInconsistentesBasicos[0].total);
      if (totalInconsistentesBasicos > 0) {
        this.errores.push(`${totalInconsistentesBasicos} documentos con inconsistencia matemática básica`);
      }
      console.log(`🧮 Documentos con matemática inconsistente: ${totalInconsistentesBasicos}`);

      this.resultados.integridad = {
        docsSinMatrizador,
        docsValorNulo,
        docsFechaInconsistente,
        docsValoresFaltantes,
        totalInconsistentesBasicos
      };

    } catch (error) {
      console.error('❌ Error en auditoría de integridad:', error);
      this.errores.push(`Error en auditoría de integridad: ${error.message}`);
    }
  }

  async auditarReportesFinancieros() {
    console.log('\n💰 2. AUDITANDO REPORTES FINANCIEROS (CRÍTICO)');
    console.log('-----------------------------------------------');
    
    try {
      // Obtener totales globales usando diferentes métodos
      const totalDocumentos = await Documento.count({
        where: { estado: { [Op.notIn]: ['eliminado', 'nota_credito'] } }
      });
      
      const totalFacturado = await Documento.sum('valorFactura', {
        where: { 
          valorFactura: { [Op.not]: null },
          estado: { [Op.notIn]: ['eliminado', 'nota_credito'] }
        }
      }) || 0;
      
      console.log(`📊 Total documentos: ${totalDocumentos}`);
      console.log(`💵 Total facturado global: $${totalFacturado.toFixed(2)}`);

      // Auditar diferentes métodos de cálculo de "cobrado"
      await this.auditarCalculoCobrado();
      
      // Auditar por períodos críticos
      await this.auditarReportesPorPeriodo();
      
      // Auditar por matrizador (especialmente archivo)
      await this.auditarReportesPorMatrizador();

      this.resultados.financiero = {
        totalDocumentos,
        totalFacturado
      };

    } catch (error) {
      console.error('❌ Error en auditoría financiera:', error);
      this.errores.push(`Error en auditoría financiera: ${error.message}`);
    }
  }

  async auditarCalculoCobrado() {
    console.log('\n🔍 Auditando métodos de cálculo de "Total Cobrado"...');
    
    try {
      // MÉTODO 1: Suma directa de valorPagado
      const cobradoMetodo1 = await Documento.sum('valorPagado', {
        where: { 
          estado: { [Op.notIn]: ['eliminado', 'nota_credito'] }
        }
      }) || 0;
      console.log(`💳 Método 1 - Suma directa valorPagado: $${cobradoMetodo1.toFixed(2)}`);

      // MÉTODO 2: Suma condicional por estadoPago (como en controllers)
      const [cobradoMetodo2Result] = await sequelize.query(`
        SELECT COALESCE(SUM(CASE WHEN estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial') THEN valor_pagado ELSE 0 END), 0) as total
        FROM documentos
        WHERE estado NOT IN ('eliminado', 'nota_credito')
      `, { type: sequelize.QueryTypes.SELECT });
      
      const cobradoMetodo2 = parseFloat(cobradoMetodo2Result.total);
      console.log(`💳 Método 2 - Condicional por estadoPago: $${cobradoMetodo2.toFixed(2)}`);

      // MÉTODO 3: Usando Sequelize ORM con filtro de estado (como en admin)
      const cobradoMetodo3 = await Documento.sum('valorPagado', {
        where: {
          estadoPago: { [Op.in]: ['pagado_completo', 'pagado_con_retencion', 'pago_parcial'] },
          estado: { [Op.notIn]: ['eliminado', 'nota_credito'] }
        }
      }) || 0;
      console.log(`💳 Método 3 - ORM con filtro estadoPago: $${cobradoMetodo3.toFixed(2)}`);

      // MÉTODO 4: Total facturado menos pendiente (validación cruzada)
      const totalFacturado = await Documento.sum('valorFactura', {
        where: { 
          valorFactura: { [Op.not]: null },
          estado: { [Op.notIn]: ['eliminado', 'nota_credito'] }
        }
      }) || 0;
      
      const totalPendiente = await Documento.sum('valorPendiente', {
        where: { estado: { [Op.notIn]: ['eliminado', 'nota_credito'] } }
      }) || 0;
      
      const totalRetenido = await Documento.sum('valorRetenido', {
        where: { estado: { [Op.notIn]: ['eliminado', 'nota_credito'] } }
      }) || 0;
      
      const cobradoMetodo4 = totalFacturado - totalPendiente - totalRetenido;
      console.log(`💳 Método 4 - Facturado - Pendiente - Retenido: $${cobradoMetodo4.toFixed(2)}`);

      // Detectar inconsistencias críticas
      const metodos = [
        { nombre: 'Suma directa', valor: cobradoMetodo1 },
        { nombre: 'Condicional estadoPago', valor: cobradoMetodo2 },
        { nombre: 'ORM filtrado', valor: cobradoMetodo3 },
        { nombre: 'Cálculo indirecto', valor: cobradoMetodo4 }
      ];

      console.log('\n📊 Comparación de métodos:');
      metodos.forEach((metodo, i) => {
        console.log(`   ${i + 1}. ${metodo.nombre}: $${metodo.valor.toFixed(2)}`);
      });

      // Detectar diferencias significativas (>1% o >$100)
      for (let i = 0; i < metodos.length; i++) {
        for (let j = i + 1; j < metodos.length; j++) {
          const diferencia = Math.abs(metodos[i].valor - metodos[j].valor);
          const porcentaje = metodos[i].valor > 0 ? (diferencia / metodos[i].valor) * 100 : 0;
          
          if (diferencia > 100 || porcentaje > 1) {
            this.inconsistencias.push(
              `CRÍTICO: ${metodos[i].nombre} vs ${metodos[j].nombre} - Diferencia: $${diferencia.toFixed(2)} (${porcentaje.toFixed(1)}%)`
            );
            console.log(`❌ INCONSISTENCIA CRÍTICA: ${metodos[i].nombre} vs ${metodos[j].nombre}`);
            console.log(`   Diferencia: $${diferencia.toFixed(2)} (${porcentaje.toFixed(1)}%)`);
          }
        }
      }

      // Verificar si algún cobrado > facturado (matemáticamente imposible)
      metodos.forEach(metodo => {
        if (metodo.valor > totalFacturado) {
          this.errores.push(`IMPOSIBLE: ${metodo.nombre} ($${metodo.valor.toFixed(2)}) > Total Facturado ($${totalFacturado.toFixed(2)})`);
          console.log(`❌ ERROR MATEMÁTICO: ${metodo.nombre} mayor que total facturado`);
        }
      });

    } catch (error) {
      console.error('❌ Error auditando cálculo cobrado:', error);
      this.errores.push(`Error en cálculo cobrado: ${error.message}`);
    }
  }

  async auditarReportesPorPeriodo() {
    console.log('\n📅 Auditando reportes por período...');
    
    const periodos = [
      { 
        nombre: 'Hoy', 
        inicio: moment().startOf('day').toDate(),
        fin: moment().endOf('day').toDate()
      },
      { 
        nombre: 'Esta semana', 
        inicio: moment().startOf('week').toDate(),
        fin: moment().endOf('day').toDate()
      },
      { 
        nombre: 'Este mes', 
        inicio: moment().startOf('month').toDate(),
        fin: moment().endOf('day').toDate()
      },
      { 
        nombre: 'Últimos 30 días', 
        inicio: moment().subtract(30, 'days').startOf('day').toDate(),
        fin: moment().endOf('day').toDate()
      }
    ];

    for (const periodo of periodos) {
      console.log(`\n📊 Período: ${periodo.nombre}`);
      
      try {
        const whereBasePeriodo = {
          created_at: {
            [Op.between]: [periodo.inicio, periodo.fin]
          },
          estado: { [Op.notIn]: ['eliminado', 'nota_credito'] }
        };

        const documentosPeriodo = await Documento.findAll({
          where: whereBasePeriodo,
          attributes: ['valorFactura', 'valorPagado', 'valorPendiente', 'valorRetenido', 'estadoPago']
        });

        const facturadoPeriodo = documentosPeriodo.reduce((sum, doc) => 
          sum + parseFloat(doc.valorFactura || 0), 0);
        
        const cobradoPeriodo = documentosPeriodo.reduce((sum, doc) => 
          sum + parseFloat(doc.valorPagado || 0), 0);

        const pendientePeriodo = documentosPeriodo.reduce((sum, doc) => 
          sum + parseFloat(doc.valorPendiente || 0), 0);

        const retenidoPeriodo = documentosPeriodo.reduce((sum, doc) => 
          sum + parseFloat(doc.valorRetenido || 0), 0);

        console.log(`  📄 Documentos: ${documentosPeriodo.length}`);
        console.log(`  💵 Facturado: $${facturadoPeriodo.toFixed(2)}`);
        console.log(`  💳 Cobrado: $${cobradoPeriodo.toFixed(2)}`);
        console.log(`  ⏰ Pendiente: $${pendientePeriodo.toFixed(2)}`);
        console.log(`  📋 Retenido: $${retenidoPeriodo.toFixed(2)}`);
        
        // Verificar ecuación básica: Facturado = Cobrado + Pendiente + Retenido
        const suma = cobradoPeriodo + pendientePeriodo + retenidoPeriodo;
        const diferencia = Math.abs(facturadoPeriodo - suma);
        
        console.log(`  🧮 Suma (C+P+R): $${suma.toFixed(2)}`);
        console.log(`  📐 Diferencia: $${diferencia.toFixed(2)}`);
        
        if (diferencia > 0.1) {
          this.errores.push(`${periodo.nombre}: Ecuación no balancea - Diferencia: $${diferencia.toFixed(2)}`);
          console.log(`  ❌ ERROR: Ecuación no balancea`);
        }
        
        if (cobradoPeriodo > facturadoPeriodo) {
          this.errores.push(`${periodo.nombre}: Cobrado > Facturado ($${cobradoPeriodo.toFixed(2)} > $${facturadoPeriodo.toFixed(2)})`);
          console.log(`  ❌ ERROR CRÍTICO: Cobrado mayor que facturado`);
        }

      } catch (error) {
        console.error(`❌ Error en período ${periodo.nombre}:`, error);
        this.errores.push(`Error en período ${periodo.nombre}: ${error.message}`);
      }
    }
  }

  async auditarReportesPorMatrizador() {
    console.log('\n👥 Auditando reportes por matrizador...');
    
    try {
      const matrizadores = await Matrizador.findAll({
        attributes: ['id', 'nombre', 'rol'],
        where: { activo: true }
      });

      for (const matrizador of matrizadores) {
        console.log(`\n👤 ${matrizador.nombre} (${matrizador.rol}) - ID: ${matrizador.id}`);
        
        const documentosMatrizador = await Documento.findAll({
          where: { 
            idMatrizador: matrizador.id,
            estado: { [Op.notIn]: ['eliminado', 'nota_credito'] }
          },
          attributes: ['valorFactura', 'valorPagado', 'valorPendiente', 'valorRetenido', 'estadoPago', 'estado']
        });

        const facturadoMatrizador = documentosMatrizador.reduce((sum, doc) => 
          sum + parseFloat(doc.valorFactura || 0), 0);
        
        const cobradoMatrizador = documentosMatrizador.reduce((sum, doc) => 
          sum + parseFloat(doc.valorPagado || 0), 0);

        const pendienteMatrizador = documentosMatrizador.reduce((sum, doc) => 
          sum + parseFloat(doc.valorPendiente || 0), 0);

        console.log(`  📄 Documentos: ${documentosMatrizador.length}`);
        console.log(`  💵 Facturado: $${facturadoMatrizador.toFixed(2)}`);
        console.log(`  💳 Cobrado: $${cobradoMatrizador.toFixed(2)}`);
        console.log(`  ⏰ Pendiente: $${pendienteMatrizador.toFixed(2)}`);

        if (cobradoMatrizador > facturadoMatrizador + 0.01) {
          this.errores.push(`Matrizador ${matrizador.nombre} (${matrizador.rol}): Cobrado > Facturado - $${cobradoMatrizador.toFixed(2)} > $${facturadoMatrizador.toFixed(2)}`);
          console.log(`  ❌ ERROR CRÍTICO: Cobrado mayor que facturado`);
          
          // Si es rol archivo, investigar más
          if (matrizador.rol === 'archivo') {
            console.log(`  🔍 INVESTIGANDO ROL ARCHIVO...`);
            await this.investigarUsuarioArchivo(matrizador);
          }
        }

        // Verificar si usuario archivo tiene documentos asignados
        if (matrizador.rol === 'archivo' && documentosMatrizador.length > 0) {
          this.advertencias.push(`Usuario archivo ${matrizador.nombre} tiene ${documentosMatrizador.length} documentos asignados directamente`);
          console.log(`  ⚠️ ATENCIÓN: Usuario archivo con documentos asignados`);
        }
      }

    } catch (error) {
      console.error('❌ Error en auditoría por matrizador:', error);
      this.errores.push(`Error en auditoría por matrizador: ${error.message}`);
    }
  }

  async investigarUsuarioArchivo(matrizadorArchivo) {
    console.log(`    🔬 Investigación detallada de ${matrizadorArchivo.nombre}:`);
    
    try {
      // Obtener documentos con detalles completos
      const documentosDetallados = await sequelize.query(`
        SELECT 
          id,
          codigo_barras,
          valor_factura,
          valor_pagado,
          valor_pendiente,
          valor_retenido,
          estado_pago,
          estado,
          created_at,
          rol_usuario_creador
        FROM documentos 
        WHERE id_matrizador = :matrizadorId
        AND estado NOT IN ('eliminado', 'nota_credito')
        ORDER BY created_at DESC
        LIMIT 10
      `, {
        replacements: { matrizadorId: matrizadorArchivo.id },
        type: sequelize.QueryTypes.SELECT
      });

      console.log(`    📋 Documentos encontrados: ${documentosDetallados.length}`);
      
      documentosDetallados.forEach((doc, i) => {
        const suma = parseFloat(doc.valor_pagado || 0) + parseFloat(doc.valor_pendiente || 0) + parseFloat(doc.valor_retenido || 0);
        const diferencia = Math.abs(parseFloat(doc.valor_factura || 0) - suma);
        
        console.log(`    ${i + 1}. Doc ${doc.codigo_barras || doc.id}:`);
        console.log(`       Factura: $${parseFloat(doc.valor_factura || 0).toFixed(2)}`);
        console.log(`       Pagado: $${parseFloat(doc.valor_pagado || 0).toFixed(2)}`);
        console.log(`       Pendiente: $${parseFloat(doc.valor_pendiente || 0).toFixed(2)}`);
        console.log(`       Retenido: $${parseFloat(doc.valor_retenido || 0).toFixed(2)}`);
        console.log(`       Estado Pago: ${doc.estado_pago}`);
        console.log(`       Creado por: ${doc.rol_usuario_creador}`);
        console.log(`       Diferencia: $${diferencia.toFixed(2)}`);
        
        if (diferencia > 0.01) {
          console.log(`       ❌ INCONSISTENTE`);
        }
      });

    } catch (error) {
      console.error('❌ Error investigando usuario archivo:', error);
    }
  }

  async auditarMetodosCalculo() {
    console.log('\n🧮 3. AUDITANDO MÉTODOS DE CÁLCULO');
    console.log('-----------------------------------');
    
    try {
      // Comparar funciones calcularMetricasPeriodo de admin vs caja
      console.log('Comparando funciones calcularMetricasPeriodo...');
      
      const fechaInicio = moment().startOf('month');
      const fechaFin = moment().endOf('day');
      
      // Simular cálculo como en admin
      const metricsAdmin = await this.calcularMetricasComoAdmin(fechaInicio, fechaFin);
      
      // Simular cálculo como en caja
      const metricsCaja = await this.calcularMetricasComoCaja(fechaInicio, fechaFin);
      
      console.log('\n📊 Comparación Admin vs Caja:');
      console.log(`Admin - Facturado: $${metricsAdmin.facturado.toFixed(2)}, Cobrado: $${metricsAdmin.cobrado.toFixed(2)}`);
      console.log(`Caja  - Facturado: $${metricsCaja.facturado.toFixed(2)}, Cobrado: $${metricsCaja.cobrado.toFixed(2)}`);
      
      const difFacturado = Math.abs(metricsAdmin.facturado - metricsCaja.facturado);
      const difCobrado = Math.abs(metricsAdmin.cobrado - metricsCaja.cobrado);
      
      if (difFacturado > 0.01) {
        this.inconsistencias.push(`Admin vs Caja - Diferencia Facturado: $${difFacturado.toFixed(2)}`);
      }
      
      if (difCobrado > 0.01) {
        this.inconsistencias.push(`Admin vs Caja - Diferencia Cobrado: $${difCobrado.toFixed(2)}`);
      }

    } catch (error) {
      console.error('❌ Error auditando métodos:', error);
      this.errores.push(`Error en métodos de cálculo: ${error.message}`);
    }
  }

  async calcularMetricasComoAdmin(fechaInicio, fechaFin) {
    const fechaInicioSQL = fechaInicio.format('YYYY-MM-DD HH:mm:ss');
    const fechaFinSQL = fechaFin.format('YYYY-MM-DD HH:mm:ss');
    
    // Replicar lógica de adminController
    const [facturacionResult] = await sequelize.query(`
      SELECT COALESCE(SUM(valor_factura), 0) as total
      FROM documentos
      WHERE created_at BETWEEN :fechaInicio AND :fechaFin
      AND numero_factura IS NOT NULL
      AND estado NOT IN ('eliminado', 'nota_credito')
    `, {
      replacements: { fechaInicio: fechaInicioSQL, fechaFin: fechaFinSQL },
      type: sequelize.QueryTypes.SELECT
    });
    
    const [ingresosResult] = await sequelize.query(`
      SELECT COALESCE(SUM(CASE WHEN estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial') THEN valor_pagado ELSE 0 END), 0) as total
      FROM documentos
      WHERE created_at BETWEEN :fechaInicio AND :fechaFin
      AND estado NOT IN ('eliminado', 'nota_credito')
    `, {
      replacements: { fechaInicio: fechaInicioSQL, fechaFin: fechaFinSQL },
      type: sequelize.QueryTypes.SELECT
    });
    
    return {
      facturado: parseFloat(facturacionResult.total),
      cobrado: parseFloat(ingresosResult.total)
    };
  }

  async calcularMetricasComoCaja(fechaInicio, fechaFin) {
    const fechaInicioSQL = fechaInicio.format('YYYY-MM-DD HH:mm:ss');
    const fechaFinSQL = fechaFin.format('YYYY-MM-DD HH:mm:ss');
    
    // Replicar lógica de cajaController
    const whereClause = {
      valor_factura: { [Op.not]: null },
      estado: { [Op.ne]: 'cancelado' },
      created_at: {
        [Op.between]: [fechaInicioSQL, fechaFinSQL]
      }
    };
    
    const totalFacturado = await Documento.sum('valor_factura', {
      where: whereClause
    }) || 0;
    
    const totalCobrado = await Documento.sum('valor_pagado', {
      where: {
        ...whereClause,
        estado_pago: { [Op.in]: ['pagado_completo', 'pagado_con_retencion', 'pago_parcial'] }
      }
    }) || 0;
    
    return {
      facturado: totalFacturado,
      cobrado: totalCobrado
    };
  }

  async auditarComparacionReportes() {
    console.log('\n🔄 4. AUDITANDO REPORTES ADMIN VS CAJA');
    console.log('--------------------------------------');
    
    // Esta función compara si admin y caja muestran los mismos totales
    // para los mismos períodos y filtros
    
    console.log('✅ Implementación pendiente - requiere análisis de vistas');
  }

  async auditarFiltrosPorRol() {
    console.log('\n🔐 5. AUDITANDO FILTROS POR ROL');
    console.log('-------------------------------');
    
    try {
      // Verificar que rol archivo no contamine cálculos
      const usuariosArchivo = await Matrizador.findAll({
        where: { rol: 'archivo', activo: true }
      });

      console.log(`📁 Usuarios con rol archivo: ${usuariosArchivo.length}`);

      for (const usuario of usuariosArchivo) {
        console.log(`📁 ${usuario.nombre} (ID: ${usuario.id})`);
        
        // Verificar si aparece en queries de reportes donde no debería
        const documentosAsignados = await Documento.count({
          where: { 
            idMatrizador: usuario.id,
            estado: { [Op.notIn]: ['eliminado', 'nota_credito'] }
          }
        });
        
        console.log(`  📄 Documentos asignados: ${documentosAsignados}`);
        
        if (documentosAsignados > 0) {
          this.advertencias.push(`Usuario archivo ${usuario.nombre} aparece en reportes con ${documentosAsignados} documentos`);
          
          // Verificar si estos documentos afectan totales
          const valorTotalArchivo = await Documento.sum('valorFactura', {
            where: { 
              idMatrizador: usuario.id,
              estado: { [Op.notIn]: ['eliminado', 'nota_credito'] }
            }
          }) || 0;
          
          if (valorTotalArchivo > 0) {
            this.advertencias.push(`Usuario archivo ${usuario.nombre} suma $${valorTotalArchivo.toFixed(2)} a los totales`);
            console.log(`  💰 Valor total en reportes: $${valorTotalArchivo.toFixed(2)}`);
          }
        }
      }

    } catch (error) {
      console.error('❌ Error auditando filtros por rol:', error);
      this.errores.push(`Error en filtros por rol: ${error.message}`);
    }
  }

  async auditarQueriesSQL() {
    console.log('\n🔍 6. AUDITANDO QUERIES SQL ESPECÍFICAS');
    console.log('---------------------------------------');
    
    try {
      // Probar queries problemáticas directamente
      console.log('Probando query de reporte financiero admin...');
      
      const [queryAdmin] = await sequelize.query(`
        SELECT 
          COUNT(*) as total_docs,
          COALESCE(SUM(valor_factura), 0) as total_facturado,
          COALESCE(SUM(CASE WHEN estado_pago IN ('pagado_completo', 'pagado_con_retencion', 'pago_parcial') THEN valor_pagado ELSE 0 END), 0) as total_cobrado
        FROM documentos
        WHERE estado NOT IN ('eliminado', 'nota_credito')
        AND valor_factura IS NOT NULL
      `, { type: sequelize.QueryTypes.SELECT });

      console.log(`📊 Query Admin - Docs: ${queryAdmin.total_docs}, Facturado: $${parseFloat(queryAdmin.total_facturado).toFixed(2)}, Cobrado: $${parseFloat(queryAdmin.total_cobrado).toFixed(2)}`);

      console.log('Probando query de reporte financiero caja...');
      
      const [queryCaja] = await sequelize.query(`
        SELECT 
          COUNT(*) as total_docs,
          COALESCE(SUM(valor_factura), 0) as total_facturado,
          COALESCE(SUM(valor_pagado), 0) as total_cobrado_directo
        FROM documentos
        WHERE estado != 'cancelado'
        AND valor_factura IS NOT NULL
      `, { type: sequelize.QueryTypes.SELECT });

      console.log(`📊 Query Caja - Docs: ${queryCaja.total_docs}, Facturado: $${parseFloat(queryCaja.total_facturado).toFixed(2)}, Cobrado: $${parseFloat(queryCaja.total_cobrado_directo).toFixed(2)}`);

      // Comparar resultados
      const difFacturado = Math.abs(parseFloat(queryAdmin.total_facturado) - parseFloat(queryCaja.total_facturado));
      const difCobrado = Math.abs(parseFloat(queryAdmin.total_cobrado) - parseFloat(queryCaja.total_cobrado_directo));

      if (difFacturado > 0.01) {
        this.inconsistencias.push(`Queries SQL - Diferencia Facturado: $${difFacturado.toFixed(2)}`);
      }

      if (difCobrado > 0.01) {
        this.inconsistencias.push(`Queries SQL - Diferencia Cobrado: $${difCobrado.toFixed(2)}`);
      }

      // Verificar query específica problemática
      console.log('Verificando casos donde cobrado > facturado...');
      
      const casos_problematicos = await sequelize.query(`
        SELECT 
          id,
          codigo_barras,
          valor_factura,
          valor_pagado,
          valor_pendiente,
          valor_retenido,
          estado_pago,
          id_matrizador,
          (valor_pagado + valor_pendiente + valor_retenido) as suma_total,
          ABS(valor_factura - (valor_pagado + valor_pendiente + valor_retenido)) as diferencia
        FROM documentos
        WHERE (valor_pagado + valor_pendiente + valor_retenido) > valor_factura + 0.01
        AND estado NOT IN ('eliminado', 'nota_credito')
        ORDER BY diferencia DESC
        LIMIT 10
      `, { type: sequelize.QueryTypes.SELECT });

      if (casos_problematicos.length > 0) {
        console.log(`❌ ENCONTRADOS ${casos_problematicos.length} CASOS PROBLEMÁTICOS:`);
        casos_problematicos.forEach((caso, i) => {
          console.log(`   ${i + 1}. Doc ${caso.codigo_barras || caso.id}:`);
          console.log(`      Factura: $${parseFloat(caso.valor_factura).toFixed(2)}`);
          console.log(`      Suma total: $${parseFloat(caso.suma_total).toFixed(2)}`);
          console.log(`      Diferencia: $${parseFloat(caso.diferencia).toFixed(2)}`);
          console.log(`      Matrizador: ${caso.id_matrizador}`);
        });
        
        this.errores.push(`${casos_problematicos.length} documentos con suma de pagos mayor a factura`);
      }

    } catch (error) {
      console.error('❌ Error auditando queries SQL:', error);
      this.errores.push(`Error en queries SQL: ${error.message}`);
    }
  }

  generarReporteFinal() {
    console.log('\n📋 REPORTE FINAL DE AUDITORÍA');
    console.log('==============================');
    console.log(`Fecha: ${moment().format('DD/MM/YYYY HH:mm:ss')}`);
    
    console.log(`\n❌ ERRORES CRÍTICOS (${this.errores.length}):`);
    if (this.errores.length === 0) {
      console.log('   ✅ No se encontraron errores críticos');
    } else {
      this.errores.forEach((error, i) => {
        console.log(`   ${i + 1}. ${error}`);
      });
    }

    console.log(`\n⚠️ ADVERTENCIAS (${this.advertencias.length}):`);
    if (this.advertencias.length === 0) {
      console.log('   ✅ No se encontraron advertencias');
    } else {
      this.advertencias.forEach((adv, i) => {
        console.log(`   ${i + 1}. ${adv}`);
      });
    }

    console.log(`\n🔍 INCONSISTENCIAS (${this.inconsistencias.length}):`);
    if (this.inconsistencias.length === 0) {
      console.log('   ✅ No se encontraron inconsistencias');
    } else {
      this.inconsistencias.forEach((inc, i) => {
        console.log(`   ${i + 1}. ${inc}`);
      });
    }

    console.log('\n🎯 DIAGNÓSTICO:');
    if (this.errores.length > 0) {
      console.log('   🚨 SISTEMA TIENE ERRORES CRÍTICOS - Revisión inmediata requerida');
    }
    if (this.inconsistencias.length > 0) {
      console.log('   ⚠️ MÉTODOS DE CÁLCULO INCONSISTENTES - Unificación necesaria');
    }
    if (this.advertencias.length > 0) {
      console.log('   📝 CONFIGURACIONES A REVISAR - No críticas pero importantes');
    }
    if (this.errores.length === 0 && this.inconsistencias.length === 0) {
      console.log('   ✅ SISTEMA MATEMÁTICAMENTE CONSISTENTE');
    }

    console.log('\n🎯 RECOMENDACIONES INMEDIATAS:');
    
    if (this.errores.some(e => e.includes('Cobrado > Facturado'))) {
      console.log('   1. 🚨 CRÍTICO: Corregir documentos donde cobrado > facturado');
      console.log('      → Ejecutar script de corrección de doble conteo');
      console.log('      → Revisar lógica de cálculo de valorPagado');
    }
    
    if (this.inconsistencias.some(i => i.includes('Método'))) {
      console.log('   2. 🔧 UNIFICAR métodos de cálculo entre admin y caja');
      console.log('      → Usar misma función calcularMetricasPeriodo');
      console.log('      → Estandarizar queries SQL');
    }
    
    if (this.advertencias.some(a => a.includes('archivo'))) {
      console.log('   3. 🔍 REVISAR configuración de rol archivo');
      console.log('      → Verificar que no contamina reportes');
      console.log('      → Actualizar filtros de consultas');
    }
    
    if (this.errores.some(e => e.includes('inconsistencia matemática'))) {
      console.log('   4. 🧮 CORREGIR documentos con matemática inconsistente');
      console.log('      → Recalcular valorPendiente = valorFactura - valorPagado - valorRetenido');
      console.log('      → Validar estados de pago');
    }

    console.log('\n📊 PRÓXIMOS PASOS:');
    console.log('   1. Ejecutar script de corrección automatizada');
    console.log('   2. Unificar funciones de cálculo en adminController y cajaController');
    console.log('   3. Implementar validaciones en modelo Documento');
    console.log('   4. Crear tests automatizados para reportes');
    console.log('   5. Configurar auditoría periódica (diaria/semanal)');

    console.log('\n✅ AUDITORÍA COMPLETADA');
    console.log(`Total de verificaciones: ${this.errores.length + this.advertencias.length + this.inconsistencias.length}`);
    console.log(`Estado: ${this.errores.length > 0 ? 'CRÍTICO' : this.inconsistencias.length > 0 ? 'ATENCIÓN' : 'SALUDABLE'}`);
  }
}

// Ejecutar auditoría si se llama directamente
if (require.main === module) {
  const auditoria = new AuditoriaReportes();
  auditoria.ejecutarAuditoria()
    .then(() => {
      console.log('\n🎉 Auditoría finalizada exitosamente');
      process.exit(0);
    })
    .catch(err => {
      console.error('\n💥 Error en auditoría:', err);
      process.exit(1);
    });
}

module.exports = AuditoriaReportes; 