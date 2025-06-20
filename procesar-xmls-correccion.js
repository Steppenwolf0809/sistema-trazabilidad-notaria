/**
 * Script para procesar XMLs de corrección automáticamente
 * 
 * INSTRUCCIONES:
 * 1. Pon todos los XMLs en la carpeta 'xmls-correccion/'
 * 2. Ejecuta: node procesar-xmls-correccion.js
 * 3. El script extraerá los valores y actualizará automáticamente
 */

const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const { sequelize } = require('./config/database');
const Documento = require('./models/Documento');
const EventoDocumento = require('./models/EventoDocumento');

const CARPETA_XMLS = './xmls-correccion';

async function procesarXMLsCorreccion() {
  try {
    console.log('🔧 PROCESADOR AUTOMÁTICO DE XMLs PARA CORRECCIÓN');
    console.log('=' .repeat(60));

    // Verificar que existe la carpeta
    if (!fs.existsSync(CARPETA_XMLS)) {
      console.log(`❌ La carpeta ${CARPETA_XMLS} no existe.`);
      console.log(`📁 Créala y pon los XMLs ahí: mkdir ${CARPETA_XMLS}`);
      return;
    }

    // Leer archivos XML de la carpeta
    const archivos = fs.readdirSync(CARPETA_XMLS)
      .filter(archivo => archivo.toLowerCase().endsWith('.xml'));

    if (archivos.length === 0) {
      console.log(`📂 No se encontraron archivos XML en ${CARPETA_XMLS}`);
      console.log('📝 Pon los XMLs en esa carpeta y vuelve a ejecutar el script');
      return;
    }

    console.log(`📋 Se encontraron ${archivos.length} archivos XML:`);
    archivos.forEach((archivo, index) => {
      console.log(`   ${index + 1}. ${archivo}`);
    });

    const resultados = {
      procesados: 0,
      actualizados: 0,
      errores: 0,
      noEncontrados: 0,
      detalles: []
    };

    // Procesar cada XML
    for (const archivo of archivos) {
      console.log(`\n🔍 Procesando: ${archivo}`);
      
      try {
        const rutaCompleta = path.join(CARPETA_XMLS, archivo);
        const contenidoXML = fs.readFileSync(rutaCompleta, 'utf8');
        
        // Parsear XML
        const parser = new xml2js.Parser();
        const xmlData = await parser.parseStringPromise(contenidoXML);
        
        // Extraer datos de la factura
        const datosFactura = extraerDatosFactura(xmlData);
        
        if (!datosFactura.numeroFactura || !datosFactura.valorTotal) {
          console.log(`   ⚠️ XML incompleto: falta número o valor de factura`);
          resultados.errores++;
          resultados.detalles.push({
            archivo,
            estado: 'error',
            razon: 'XML incompleto'
          });
          continue;
        }

        console.log(`   📋 Número de factura: ${datosFactura.numeroFactura}`);
        console.log(`   💰 Valor extraído: $${datosFactura.valorTotal}`);
        console.log(`   👤 Cliente: ${datosFactura.nombreCliente}`);

        // Buscar documento en la base de datos
        const documento = await buscarDocumentoPorFactura(datosFactura.numeroFactura, datosFactura.nombreCliente);

        if (!documento) {
          console.log(`   ❌ No se encontró documento con esa factura`);
          resultados.noEncontrados++;
          resultados.detalles.push({
            archivo,
            numeroFactura: datosFactura.numeroFactura,
            valorXML: datosFactura.valorTotal,
            estado: 'no_encontrado'
          });
          continue;
        }

        console.log(`   ✅ Documento encontrado: ID ${documento.id} - ${documento.codigoBarras}`);
        console.log(`   📊 Valor actual en BD: $${documento.valorFactura}`);

        // Actualizar si el valor es diferente
        if (parseFloat(documento.valorFactura) !== parseFloat(datosFactura.valorTotal)) {
          await actualizarValorDocumento(documento, datosFactura.valorTotal, archivo);
          console.log(`   🔄 Documento actualizado: $${documento.valorFactura} → $${datosFactura.valorTotal}`);
          resultados.actualizados++;
        } else {
          console.log(`   ✅ Valor ya es correcto, no se requiere actualización`);
        }

        resultados.procesados++;
        resultados.detalles.push({
          archivo,
          documentoId: documento.id,
          codigoBarras: documento.codigoBarras,
          numeroFactura: datosFactura.numeroFactura,
          valorAnterior: documento.valorFactura,
          valorNuevo: datosFactura.valorTotal,
          estado: 'actualizado'
        });

      } catch (error) {
        console.log(`   ❌ Error procesando ${archivo}: ${error.message}`);
        resultados.errores++;
        resultados.detalles.push({
          archivo,
          estado: 'error',
          razon: error.message
        });
      }
    }

    // Mostrar resumen final
    console.log('\n📊 RESUMEN DE PROCESAMIENTO:');
    console.log('=' .repeat(60));
    console.log(`📋 Archivos procesados: ${resultados.procesados}/${archivos.length}`);
    console.log(`✅ Documentos actualizados: ${resultados.actualizados}`);
    console.log(`❌ Errores: ${resultados.errores}`);
    console.log(`🔍 No encontrados: ${resultados.noEncontrados}`);

    if (resultados.actualizados > 0) {
      console.log('\n🎉 ¡CORRECCIÓN COMPLETADA!');
      console.log('✅ Los valores de factura han sido actualizados automáticamente');
    }

    if (resultados.noEncontrados > 0) {
      console.log('\n⚠️ DOCUMENTOS NO ENCONTRADOS:');
      resultados.detalles
        .filter(d => d.estado === 'no_encontrado')
        .forEach(detalle => {
          console.log(`   📄 ${detalle.archivo}: Factura ${detalle.numeroFactura} ($${detalle.valorXML})`);
        });
    }

    if (resultados.errores > 0) {
      console.log('\n❌ ERRORES ENCONTRADOS:');
      resultados.detalles
        .filter(d => d.estado === 'error')
        .forEach(detalle => {
          console.log(`   📄 ${detalle.archivo}: ${detalle.razon}`);
        });
    }

  } catch (error) {
    console.error('❌ Error general:', error);
  } finally {
    await sequelize.close();
  }
}

/**
 * Extrae datos importantes de la factura del XML
 */
function extraerDatosFactura(xmlData) {
  try {
    const factura = xmlData.factura || xmlData.comprobanteRetencion || xmlData;
    const infoTributaria = factura.infoTributaria?.[0] || {};
    const infoFactura = factura.infoFactura?.[0] || {};

    // Extraer número de factura
    let numeroFactura = null;
    if (infoTributaria.estab && infoTributaria.ptoEmi && infoTributaria.secuencial) {
      numeroFactura = `${infoTributaria.estab}-${infoTributaria.ptoEmi}-${infoTributaria.secuencial}`;
    }

    // Extraer valor total
    let valorTotal = null;
    if (infoFactura.importeTotal) {
      valorTotal = parseFloat(infoFactura.importeTotal);
    }

    // Extraer nombre del cliente
    let nombreCliente = infoFactura.razonSocialComprador || 
                       infoFactura.nombreComprador || 
                       'Cliente no identificado';

    return {
      numeroFactura,
      valorTotal,
      nombreCliente,
      identificacionCliente: infoFactura.identificacionComprador
    };
  } catch (error) {
    console.error('Error extrayendo datos del XML:', error);
    return {};
  }
}

/**
 * Busca un documento por número de factura y cliente
 */
async function buscarDocumentoPorFactura(numeroFactura, nombreCliente) {
  try {
    // Primero buscar por número de factura exacto
    let documento = await Documento.findOne({
      where: {
        numeroFactura: numeroFactura
      }
    });

    if (documento) return documento;

    // Si no se encuentra, buscar por número sin guiones
    const numeroSinGuiones = numeroFactura.replace(/-/g, '');
    documento = await Documento.findOne({
      where: {
        numeroFactura: numeroSinGuiones
      }
    });

    if (documento) return documento;

    // Buscar por cliente y valor cero (último recurso)
    const { Op } = require('sequelize');
    documento = await Documento.findOne({
      where: {
        nombreCliente: { [Op.iLike]: `%${nombreCliente.split(' ')[0]}%` },
        valorFactura: 0,
        numeroFactura: { [Op.not]: null }
      }
    });

    return documento;
  } catch (error) {
    console.error('Error buscando documento:', error);
    return null;
  }
}

/**
 * Actualiza el valor de un documento
 */
async function actualizarValorDocumento(documento, nuevoValor, archivoXML) {
  const transaction = await sequelize.transaction();
  
  try {
    const valorAnterior = documento.valorFactura;
    
    // Actualizar el documento
    await documento.update({
      valorFactura: nuevoValor
    }, { transaction });

    // Registrar evento de corrección
    await EventoDocumento.create({
      documentoId: documento.id,
      tipo: 'otro',
      detalles: `Valor de factura corregido automáticamente: $${valorAnterior} → $${nuevoValor}`,
      usuario: 'Sistema de Corrección Automática',
      metadatos: {
        tipo: 'correccion_valor_factura',
        valorAnterior: valorAnterior,
        valorNuevo: nuevoValor,
        archivoXML: archivoXML,
        metodoCorreccion: 'procesamiento_xml_automatico',
        timestamp: new Date().toISOString()
      }
    }, { transaction });

    await transaction.commit();
    
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

// Ejecutar el procesamiento
procesarXMLsCorreccion();

module.exports = { procesarXMLsCorreccion }; 