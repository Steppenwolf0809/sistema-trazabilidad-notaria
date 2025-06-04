const xml2js = require('xml2js');
const fs = require('fs');

class XMLRetentionParser {
    constructor() {
        this.parser = new xml2js.Parser({
            explicitArray: false,
            mergeAttrs: true,
            trim: true,
            ignoreAttrs: false,
            tagNameProcessors: [xml2js.processors.stripPrefix]
        });
    }

    async procesarXMLRetencion(xmlPath) {
        try {
            console.log('📄 Iniciando procesamiento XML de retención del SRI');
            
            // Leer archivo XML
            const xmlContent = fs.readFileSync(xmlPath, 'utf8');
            
            // Parsear XML principal
            const result = await this.parser.parseStringPromise(xmlContent);
            
            // Extraer datos de autorización
            const autorizacion = result.autorizacion;
            if (!autorizacion || autorizacion.estado !== 'AUTORIZADO') {
                throw new Error('XML de retención no autorizado o inválido');
            }

            console.log('✅ XML autorizado, procesando comprobante...');

            // Extraer y parsear el CDATA del comprobante
            const comprobanteXML = autorizacion.comprobante;
            const comprobante = await this.parser.parseStringPromise(comprobanteXML);
            
            const retencion = comprobante.comprobanteRetencion;
            
            // Extraer información tributaria
            const infoTributaria = retencion.infoTributaria;
            const infoCompRetencion = retencion.infoCompRetencion;
            const docSustento = retencion.docsSustento.docSustento;
            
            // Datos básicos del comprobante
            const datosBasicos = {
                numeroAutorizacion: autorizacion.numeroAutorizacion,
                fechaAutorizacion: autorizacion.fechaAutorizacion,
                ambiente: autorizacion.ambiente,
                
                // Información de la empresa retenedora
                razonSocialRetenedora: infoTributaria.razonSocial,
                nombreComercialRetenedora: infoTributaria.nombreComercial,
                rucRetenedor: infoTributaria.ruc,
                establecimiento: infoTributaria.estab,
                puntoEmision: infoTributaria.ptoEmi,
                secuencial: infoTributaria.secuencial,
                
                // Información del comprobante
                fechaEmisionRetencion: infoCompRetencion.fechaEmision,
                contribuyenteEspecial: infoCompRetencion.contribuyenteEspecial,
                obligadoContabilidad: infoCompRetencion.obligadoContabilidad,
                
                // Información del sujeto retenido
                razonSocialSujetoRetenido: infoCompRetencion.razonSocialSujetoRetenido,
                identificacionSujetoRetenido: infoCompRetencion.identificacionSujetoRetenido,
                
                // Información del documento sustento (factura)
                numeroFactura: docSustento.numDocSustento,
                fechaEmisionFactura: docSustento.fechaEmisionDocSustento,
                numeroAutorizacionFactura: docSustento.numAutDocSustento,
                totalSinImpuestos: parseFloat(docSustento.totalSinImpuestos || 0),
                importeTotal: parseFloat(docSustento.importeTotal || 0)
            };
            
            // Extraer retenciones
            const retenciones = this.extraerRetenciones(docSustento.retenciones);
            
            // Calcular totales
            const totales = this.calcularTotales(retenciones);
            
            const resultado = {
                ...datosBasicos,
                ...retenciones,
                ...totales,
                fechaProcesamiento: new Date(),
                archivoOriginal: xmlPath
            };
            
            console.log('✅ XML de retención procesado exitosamente');
            console.log('📊 Datos extraídos:', {
                numeroFactura: resultado.numeroFactura,
                empresa: resultado.razonSocialRetenedora,
                totalRetenido: resultado.totalRetenido,
                retencionIva: resultado.retencionIva,
                retencionRenta: resultado.retencionRenta
            });
            
            return {
                success: true,
                datos: resultado
            };
            
        } catch (error) {
            console.error('❌ Error procesando XML de retención:', error);
            return {
                success: false,
                error: error.message,
                details: error.stack
            };
        }
    }

    extraerRetenciones(retencionesXML) {
        console.log('🔍 Extrayendo retenciones del XML...');
        
        let retencionIva = 0;
        let retencionRenta = 0;
        const detalleRetenciones = [];
        
        // Manejar array o objeto único
        const retenciones = Array.isArray(retencionesXML.retencion) ? 
            retencionesXML.retencion : [retencionesXML.retencion];
        
        for (const ret of retenciones) {
            const codigoRetencion = ret.codigoRetencion;
            const valorRetenido = parseFloat(ret.valorRetenido || 0);
            const porcentaje = parseFloat(ret.porcentajeRetener || 0);
            const baseImponible = parseFloat(ret.baseImponible || 0);
            
            const detalle = {
                codigo: ret.codigo,
                codigoRetencion,
                baseImponible,
                porcentaje,
                valorRetenido,
                tipo: this.determinarTipoRetencion(codigoRetencion)
            };
            
            detalleRetenciones.push(detalle);
            
            // Clasificar por tipo
            if (this.esRetencionIVA(codigoRetencion)) {
                retencionIva += valorRetenido;
                console.log(`📋 Retención IVA: $${valorRetenido} (${porcentaje}%)`);
            } else if (this.esRetencionRenta(codigoRetencion)) {
                retencionRenta += valorRetenido;
                console.log(`📋 Retención Renta: $${valorRetenido} (${porcentaje}%)`);
            }
        }
        
        return {
            retencionIva: parseFloat(retencionIva.toFixed(2)),
            retencionRenta: parseFloat(retencionRenta.toFixed(2)),
            detalleRetenciones
        };
    }

    calcularTotales(retenciones) {
        const totalRetenido = retenciones.retencionIva + retenciones.retencionRenta;
        
        return {
            totalRetenido: parseFloat(totalRetenido.toFixed(2))
        };
    }

    determinarTipoRetencion(codigoRetencion) {
        // Códigos de retención en Ecuador según SRI
        const codigosIVA = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];
        const codigosRenta = [
            '303', '304', '304A', '304B', '304C', '304D', '304E', '304F',
            '307', '308', '309', '310', '311', '312', '320', '321', '322',
            '323', '324', '325', '326', '327', '328', '329', '330', '331',
            '332', '333', '334', '335', '336', '337', '338', '339', '340',
            '341', '342', '343', '344', '345', '346', '347', '348', '349',
            '350', '351', '352', '353', '354', '355', '356', '357', '358',
            '359', '360', '361', '362', '363', '364', '365', '366', '367',
            '368', '369', '370', '371', '372', '373', '374', '375', '376',
            '377', '378', '379', '380', '381', '382', '383', '384', '385',
            '386', '387', '388', '389', '390', '391', '392', '393', '394',
            '395', '396', '397', '398', '399', '400'
        ];
        
        if (codigosIVA.includes(codigoRetencion)) {
            return 'IVA';
        } else if (codigosRenta.includes(codigoRetencion)) {
            return 'RENTA';
        } else {
            return 'OTROS';
        }
    }

    esRetencionIVA(codigo) {
        return ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'].includes(codigo);
    }

    esRetencionRenta(codigo) {
        // Lista completa de códigos de retención en la fuente
        const codigosRenta = [
            '303', '304', '304A', '304B', '304C', '304D', '304E', '304F',
            '307', '308', '309', '310', '311', '312', '320', '321', '322',
            '323', '324', '325', '326', '327', '328', '329', '330', '331',
            '332', '333', '334', '335', '336', '337', '338', '339', '340'
        ];
        return codigosRenta.includes(codigo);
    }

    // Método para validar que el XML corresponde a una factura específica
    validarCoherenciaConDocumento(documento, datosRetencion) {
        const errores = [];
        const advertencias = [];
        
        // Validar número de factura
        if (documento.numeroFactura && datosRetencion.numeroFactura) {
            if (documento.numeroFactura !== datosRetencion.numeroFactura) {
                errores.push(`Número de factura no coincide: Documento (${documento.numeroFactura}) vs XML (${datosRetencion.numeroFactura})`);
            }
        }
        
        // Validar valor total (con tolerancia de $0.01)
        if (documento.valorFactura && datosRetencion.importeTotal) {
            const diferencia = Math.abs(documento.valorFactura - datosRetencion.importeTotal);
            if (diferencia > 0.01) {
                advertencias.push(`Diferencia en valor total: Documento ($${documento.valorFactura}) vs XML ($${datosRetencion.importeTotal})`);
            }
        }
        
        // Validar que hay retenciones
        if (datosRetencion.totalRetenido <= 0) {
            errores.push('El XML no contiene retenciones válidas');
        }
        
        return {
            esValido: errores.length === 0,
            errores,
            advertencias
        };
    }
}

module.exports = XMLRetentionParser; 