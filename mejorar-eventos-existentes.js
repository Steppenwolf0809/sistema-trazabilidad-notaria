/**
 * Script para mejorar eventos existentes con información más útil
 * Llenar títulos, descripciones y categorías basado en tipo y metadatos
 * VERSION MEJORADA: Incluye información de entregas y pagos
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'sistema_notaria',
  password: process.env.DB_PASSWORD || 'admin',
  port: process.env.DB_PORT || 5432,
});

async function mejorarEventosExistentes() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Mejorando eventos existentes con información útil...\n');
    
    // 1. Obtener todos los eventos que necesitan mejora junto con información del documento
    const eventos = await client.query(`
      SELECT 
        e.id, e.tipo, e.detalles, e.usuario, e.metadatos, e.titulo, e.descripcion, e.categoria,
        e.documento_id, e.created_at,
        d.nombre_cliente, d.codigo_barras, d.tipo_documento, d.valor_factura, d.metodo_pago,
        d.nombre_receptor, d.identificacion_receptor, d.relacion_receptor, d.numero_factura,
        d.valor_pagado, d.estado_pago, d.fecha_entrega
      FROM eventos_documentos e
      LEFT JOIN documentos d ON e.documento_id = d.id
      WHERE (e.titulo IS NULL OR e.titulo = '' OR e.descripcion IS NULL OR e.descripcion = '' OR e.categoria IS NULL)
      ORDER BY e.created_at DESC
    `);
    
    console.log(`📋 Encontrados ${eventos.rows.length} eventos para mejorar\n`);
    
    let eventosActualizados = 0;
    
    for (const evento of eventos.rows) {
      let titulo = evento.titulo;
      let descripcion = evento.descripcion;
      let categoria = evento.categoria;
      let detallesString = evento.detalles;
      
      // Mejorar información según el tipo de evento
      switch (evento.tipo) {
        case 'pago':
          titulo = titulo || '💰 Pago Registrado';
          categoria = categoria || 'pago';
          
          // Construir detalles mejorados para pago
          const detallesPago = {
            valor: evento.valor_pagado || evento.valor_factura || 0,
            metodoPago: evento.metodo_pago || 'no especificado',
            numeroFactura: evento.numero_factura || null,
            usuarioCaja: evento.usuario || 'Sistema',
            estadoPago: evento.estado_pago || 'procesado'
          };
          
          detallesString = JSON.stringify(detallesPago);
          descripcion = descripcion || `Pago de $${detallesPago.valor} procesado mediante ${detallesPago.metodoPago}`;
          break;
          
        case 'entrega':
          titulo = titulo || '📦 Documento Entregado';
          categoria = categoria || 'entrega';
          
          // Construir detalles mejorados para entrega
          const detallesEntrega = {
            receptor: evento.nombre_receptor || evento.nombre_cliente,
            identificacionReceptor: evento.identificacion_receptor || 'No registrada',
            relacion: evento.relacion_receptor || 'titular',
            fechaEntrega: evento.fecha_entrega || evento.created_at
          };
          
          detallesString = JSON.stringify(detallesEntrega);
          descripcion = descripcion || `Documento entregado a ${detallesEntrega.receptor} (${detallesEntrega.relacion})`;
          break;
          
        case 'registro':
        case 'creacion':
          titulo = titulo || '📄 Documento Creado';
          categoria = categoria || 'creacion';
          descripcion = descripcion || `Documento ${evento.codigo_barras} registrado en el sistema`;
          break;
          
        case 'asignacion':
          titulo = titulo || '👤 Matrizador Asignado';
          categoria = categoria || 'matrizador';
          descripcion = descripcion || `Documento asignado para procesamiento`;
          break;
          
        case 'estado':
          titulo = titulo || '🔄 Estado Actualizado';
          categoria = categoria || 'estado';
          descripcion = descripcion || `Estado del documento modificado`;
          break;
          
        case 'notificacion':
          titulo = titulo || '📧 Notificación Enviada';
          categoria = categoria || 'notificacion';
          descripcion = descripcion || `Notificación enviada al cliente`;
          break;
          
        case 'vista':
          titulo = titulo || '👁️ Documento Revisado';
          categoria = categoria || 'general';
          descripcion = descripcion || `Documento revisado por ${evento.usuario || 'usuario'}`;
          break;
          
        default:
          titulo = titulo || '📋 Evento del Sistema';
          categoria = categoria || 'general';
          descripcion = descripcion || `Evento registrado en el sistema`;
      }
      
      // Actualizar el evento con la información mejorada
      await client.query(`
        UPDATE eventos_documentos 
        SET 
          titulo = $1,
          descripcion = $2,
          categoria = $3,
          detalles = $4
        WHERE id = $5
      `, [titulo, descripcion, categoria, detallesString, evento.id]);
      
      eventosActualizados++;
      
      if (eventosActualizados % 10 === 0) {
        console.log(`✅ Procesados ${eventosActualizados} eventos...`);
      }
    }
    
    console.log(`\n🎉 ¡Mejora completada!`);
    console.log(`📊 Estadísticas:`);
    console.log(`   • Total eventos procesados: ${eventosActualizados}`);
    console.log(`   • Eventos con títulos mejorados: ${eventosActualizados}`);
    console.log(`   • Eventos con descripciones mejoradas: ${eventosActualizados}`);
    console.log(`   • Eventos con categorías asignadas: ${eventosActualizados}`);
    
    // Verificar la mejora
    const verificacion = await client.query(`
      SELECT 
        tipo,
        COUNT(*) as total,
        COUNT(CASE WHEN titulo IS NOT NULL AND titulo != '' THEN 1 END) as con_titulo,
        COUNT(CASE WHEN descripcion IS NOT NULL AND descripcion != '' THEN 1 END) as con_descripcion,
        COUNT(CASE WHEN categoria IS NOT NULL AND categoria != '' THEN 1 END) as con_categoria
      FROM eventos_documentos 
      GROUP BY tipo 
      ORDER BY total DESC
    `);
    
    console.log(`\n📋 Verificación por tipo de evento:`);
    console.log('TIPO\t\tTOTAL\tTÍTULO\tDESCRIP\tCATEG');
    console.log('─'.repeat(60));
    
    for (const row of verificacion.rows) {
      const tipo = row.tipo.padEnd(12);
      const total = row.total.toString().padEnd(6);
      const titulo = row.con_titulo.toString().padEnd(6);
      const desc = row.con_descripcion.toString().padEnd(7);
      const cat = row.con_categoria.toString().padEnd(5);
      console.log(`${tipo}\t${total}\t${titulo}\t${desc}\t${cat}`);
    }
    
  } catch (error) {
    console.error('❌ Error mejorando eventos:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Ejecutar el script
if (require.main === module) {
  mejorarEventosExistentes()
    .then(() => {
      console.log('\n✅ Script completado exitosamente');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error ejecutando script:', error);
      process.exit(1);
    });
}

module.exports = { mejorarEventosExistentes }; 