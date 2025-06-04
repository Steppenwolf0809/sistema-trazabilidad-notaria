/**
 * Script para verificar y mejorar la función de detalle de documentos en adminController
 * Aplicar las mismas mejoras que en matrizador y caja
 */

const fs = require('fs');
const path = require('path');

async function mejorarAdminController() {
  console.log('🔧 Mejorando función de detalle en adminController...\n');
  
  const controllerPath = './controllers/adminController.js';
  
  try {
    // Leer el archivo actual
    let content = fs.readFileSync(controllerPath, 'utf8');
    
    // Verificar si ya tiene la función de detalle mejorada
    if (content.includes('// HISTORIAL MEJORADO PARA ADMIN')) {
      console.log('✅ AdminController ya tiene las mejoras aplicadas');
      return;
    }
    
    // Buscar si existe alguna función de detalle
    const hasDetalleFunction = content.includes('detalleDocumento') || content.includes('verDocumento');
    
    if (hasDetalleFunction) {
      console.log('📋 Función de detalle encontrada en adminController');
      console.log('⚠️ Se requiere revisión manual para aplicar mejoras');
      console.log('   Las mejoras incluyen:');
      console.log('   - Ordenamiento de eventos por fecha DESC');
      console.log('   - Uso de campos mejorados (titulo, descripcion, categoria)');
      console.log('   - Timeline profesional en la vista');
      console.log('   - Información detallada del usuario en cada evento');
    } else {
      console.log('❌ No se encontró función de detalle en adminController');
      console.log('💡 Considerar agregar función de detalle para completar el sistema');
    }
    
    // Crear template de función mejorada para admin
    const templateFunction = `
// HISTORIAL MEJORADO PARA ADMIN
async function detalleDocumento(req, res) {
  try {
    const { id } = req.params;
    const usuarioId = req.user?.id || req.admin?.id;
    const usuarioNombre = req.user?.nombre || req.admin?.nombre || 'Admin';
    
    console.log(\`Obteniendo detalle de documento ID: \${id} para admin: \${usuarioNombre}\`);
    
    // Buscar documento con sus relaciones
    const documento = await Documento.findByPk(id, {
      include: [
        {
          model: Matrizador,
          as: 'matrizador',
          attributes: ['id', 'nombre', 'email']
        }
      ]
    });
    
    if (!documento) {
      return res.status(404).render('error', { 
        message: 'Documento no encontrado',
        layout: 'admin'
      });
    }
    
    // Buscar eventos del documento con información mejorada
    const EventoDocumento = require('../models/EventoDocumento');
    const eventos = await EventoDocumento.findAll({
      where: { documentoId: documento.id },
      include: [
        {
          model: Matrizador,
          as: 'matrizador',
          attributes: ['id', 'nombre', 'rol'],
          required: false
        }
      ],
      order: [['created_at', 'DESC']]
    });
    
    // Construir historial mejorado
    const historialEventos = eventos.map(evento => {
      const titulo = evento.titulo || traducirTipoEvento(evento.tipo);
      const descripcion = evento.descripcion || evento.detalles || 'Sin descripción disponible';
      const categoria = evento.categoria || determinarCategoriaEvento(evento.tipo);
      
      let usuarioInfo = evento.usuario;
      if (evento.matrizador) {
        usuarioInfo = \`\${evento.matrizador.nombre} (\${evento.matrizador.rol})\`;
      } else if (!usuarioInfo) {
        usuarioInfo = 'Sistema';
      }
      
      return {
        id: evento.id,
        tipo: evento.tipo,
        categoria: categoria,
        titulo: titulo,
        descripcion: descripcion,
        detalles: evento.detalles || {},
        usuario: usuarioInfo,
        fecha: evento.created_at,
        tiempoTranscurrido: calcularTiempoTranscurrido(evento.created_at, new Date()),
        icono: obtenerIconoEvento(evento.tipo),
        color: obtenerColorEvento(evento.tipo)
      };
    });
    
    // Obtener datos adicionales para admin
    const matrizadores = await Matrizador.findAll({
      where: { activo: true },
      attributes: ['id', 'nombre'],
      order: [['nombre', 'ASC']]
    });
    
    res.render('admin/documentos/detalle', {
      documento,
      eventos: historialEventos,
      matrizadores,
      usuario: req.user || req.admin,
      layout: 'admin'
    });
    
  } catch (error) {
    console.error('Error al obtener detalle de documento:', error);
    res.status(500).render('error', { 
      message: 'Error interno del servidor al cargar detalle',
      layout: 'admin'
    });
  }
}
`;
    
    // Guardar template en archivo separado
    fs.writeFileSync('./template-admin-detalle.js', templateFunction);
    console.log('📄 Template de función guardado en: template-admin-detalle.js');
    
    console.log('\n📋 Instrucciones para aplicar mejoras manualmente:');
    console.log('1. Revisar controllers/adminController.js');
    console.log('2. Buscar función de detalle existente');
    console.log('3. Aplicar mejoras del template generado');
    console.log('4. Verificar que la vista admin/documentos/detalle.hbs use el timeline mejorado');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Ejecutar mejoras
mejorarAdminController()
  .then(() => {
    console.log('\n✅ Análisis de adminController completado');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  }); 