/**
 * Script para investigar documentos con valorFactura = 0 incorrectos
 * 
 * PROBLEMA REPORTADO:
 * - Documentos en la vista de archivo muestran $0.00
 * - Solo FISCALIA GENERAL DEL ESTADO debería ser $0.00
 * - Otros documentos como DARWIN ENRIQUE SALAZAR AMORES deberían tener valores reales
 */

const { sequelize } = require('./config/database');
const Documento = require('./models/Documento');
const { Op } = require('sequelize');

async function investigarDocumentosValorCero() {
  try {
    console.log('🔍 INVESTIGANDO DOCUMENTOS CON VALOR $0.00 INCORRECTOS');
    console.log('=' .repeat(70));

    // 1. Buscar documentos con valor 0 que tienen número de factura
    console.log('📋 PASO 1: Documentos con valorFactura = 0 pero con número de factura');
    
    const documentosValorCero = await Documento.findAll({
      where: {
        valorFactura: 0,
        numeroFactura: { [Op.not]: null },
        estado: { [Op.notIn]: ['eliminado', 'nota_credito', 'cancelado'] }
      },
      attributes: [
        'id', 'codigoBarras', 'nombreCliente', 'identificacionCliente', 
        'valorFactura', 'numeroFactura', 'fechaFactura', 'created_at'
      ],
      order: [['created_at', 'DESC']],
      limit: 20
    });

    console.log(`\n📊 Encontrados ${documentosValorCero.length} documentos con valor $0.00 y número de factura:`);
    
    if (documentosValorCero.length === 0) {
      console.log('✅ No hay documentos problemáticos encontrados');
      return;
    }

    // Analizar cada documento
    let documentosProblematicos = 0;
    let documentosLegitimos = 0;

    console.log('\n📋 ANÁLISIS DETALLADO:');
    console.log('ID | Código | Cliente | Valor | Factura | Fecha | ¿Legítimo?');
    console.log('---|--------|---------|-------|---------|-------|----------');

    documentosValorCero.forEach(doc => {
      const esLegitimo = esDocumentoExentoLegitimo(doc);
      
      if (esLegitimo) {
        documentosLegitimos++;
      } else {
        documentosProblematicos++;
      }

      const fechaCreacion = new Date(doc.created_at).toLocaleDateString('es-EC');
      const estado = esLegitimo ? '✅ SÍ' : '❌ NO';
      
      console.log(
        `${doc.id} | ${doc.codigoBarras} | ${doc.nombreCliente?.substring(0, 20)}... | $${doc.valorFactura} | ${doc.numeroFactura} | ${fechaCreacion} | ${estado}`
      );
    });

    console.log('\n📊 RESUMEN:');
    console.log(`- Total documentos analizados: ${documentosValorCero.length}`);
    console.log(`- Documentos exentos legítimos: ${documentosLegitimos}`);
    console.log(`- Documentos problemáticos: ${documentosProblematicos}`);

    if (documentosProblematicos > 0) {
      console.log('\n🚨 DOCUMENTOS PROBLEMÁTICOS DETECTADOS');
      console.log('Estos documentos probablemente deberían tener un valor > $0.00');
      
      // 2. Buscar documentos similares con valores reales para comparar
      console.log('\n📋 PASO 2: Buscando documentos similares con valores reales...');
      
      const documentosConValor = await Documento.findAll({
        where: {
          valorFactura: { [Op.gt]: 0 },
          numeroFactura: { [Op.not]: null },
          estado: { [Op.notIn]: ['eliminado', 'nota_credito', 'cancelado'] }
        },
        attributes: [
          'id', 'codigoBarras', 'nombreCliente', 'valorFactura', 'numeroFactura', 'created_at'
        ],
        order: [['created_at', 'DESC']],
        limit: 10
      });

      console.log('\n📊 DOCUMENTOS CON VALORES REALES (para comparación):');
      console.log('ID | Código | Cliente | Valor | Factura | Fecha');
      console.log('---|--------|---------|-------|---------|-------');

      documentosConValor.forEach(doc => {
        const fechaCreacion = new Date(doc.created_at).toLocaleDateString('es-EC');
        console.log(
          `${doc.id} | ${doc.codigoBarras} | ${doc.nombreCliente?.substring(0, 20)}... | $${doc.valorFactura} | ${doc.numeroFactura} | ${fechaCreacion}`
        );
      });

      // 3. Proponer solución
      console.log('\n🔧 POSIBLES SOLUCIONES:');
      console.log('1. ✅ Revisar XMLs originales para extraer valores correctos');
      console.log('2. ✅ Actualizar documentos problemáticos con valores reales');
      console.log('3. ✅ Implementar validación para prevenir futuros casos');
      
      // 4. Generar script de corrección
      console.log('\n📝 GENERANDO LISTA DE DOCUMENTOS PARA CORRECCIÓN...');
      
      const documentosParaCorregir = documentosValorCero.filter(doc => !esDocumentoExentoLegitimo(doc));
      
      if (documentosParaCorregir.length > 0) {
        console.log('\n🎯 DOCUMENTOS QUE NECESITAN CORRECCIÓN:');
        documentosParaCorregir.forEach(doc => {
          console.log(`- ID ${doc.id}: ${doc.nombreCliente} (${doc.numeroFactura})`);
        });
        
        console.log('\n💡 RECOMENDACIÓN:');
        console.log('Estos documentos probablemente se crearon con una versión anterior');
        console.log('del código que no extraía correctamente el valor del XML.');
        console.log('Se recomienda revisar los XMLs originales y actualizar los valores.');
      }
    } else {
      console.log('\n✅ TODOS LOS DOCUMENTOS CON VALOR $0.00 SON LEGÍTIMOS');
      console.log('No se requiere corrección.');
    }

  } catch (error) {
    console.error('❌ Error en investigación:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    await sequelize.close();
    console.log('\n🔒 Conexión a base de datos cerrada');
  }
}

/**
 * Determina si un documento con valor $0.00 es legítimamente exento
 * @param {Object} documento - Documento a evaluar
 * @returns {boolean} True si es legítimamente exento
 */
function esDocumentoExentoLegitimo(documento) {
  const cliente = documento.nombreCliente?.toLowerCase() || '';
  
  // Términos que indican exención legítima
  const terminosExentos = [
    'fiscalia', 'fiscalía', 'fiscal',
    'juzgado', 'tribunal', 'corte',
    'ministerio', 'gobierno', 'municipio',
    'consejo provincial', 'asamblea nacional',
    'defensoria', 'defensoría',
    'procuraduria', 'procuraduría'
  ];
  
  // Verificar si el cliente es una entidad exenta
  const esEntidadExenta = terminosExentos.some(termino => cliente.includes(termino));
  
  // También verificar por patrones en el número de factura que indiquen exención
  const facturaNumero = documento.numeroFactura?.toLowerCase() || '';
  const tienePatronExento = facturaNumero.includes('exento') || facturaNumero.includes('0000');
  
  return esEntidadExenta || tienePatronExento;
}

// Ejecutar investigación
if (require.main === module) {
  investigarDocumentosValorCero()
    .then(() => {
      console.log('\n✅ Investigación completada');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Error en investigación:', error);
      process.exit(1);
    });
}

module.exports = { investigarDocumentosValorCero, esDocumentoExentoLegitimo }; 