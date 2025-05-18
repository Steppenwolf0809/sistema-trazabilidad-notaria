/**
 * JavaScript principal para el Sistema de Trazabilidad Documental
 * Contiene funciones para interactuar con la API y gestionar la interfaz de usuario
 */

// Cuando el documento esté listo
document.addEventListener('DOMContentLoaded', function() {
  console.log('Sistema de Trazabilidad Documental - Frontend cargado');
  
  // Actualizar año en el pie de página
  actualizarAnioPiePagina();
  
  // Inicializar formulario de verificación
  inicializarFormularioVerificacion();
});

/**
 * Actualiza el año en el pie de página
 */
function actualizarAnioPiePagina() {
  // Buscar todas las instancias de currentYear y reemplazarlas con el año actual
  const currentYearElements = document.querySelectorAll('.current-year');
  const currentYear = new Date().getFullYear();
  
  currentYearElements.forEach(element => {
    element.textContent = currentYear;
  });
}

/**
 * Inicializa el formulario de verificación de documentos
 */
function inicializarFormularioVerificacion() {
  const form = document.getElementById('verificar-form');
  
  if (form) {
    form.addEventListener('submit', function(event) {
      event.preventDefault();
      
      const codigoBarras = document.getElementById('codigo-barras').value.trim();
      
      if (!codigoBarras) {
        mostrarAlerta('Por favor, ingrese un código de barras', 'danger');
        return;
      }
      
      verificarDocumento(codigoBarras);
    });
  }
}

/**
 * Verifica un documento mediante su código de barras
 * @param {string} codigoBarras - Código de barras del documento
 */
function verificarDocumento(codigoBarras) {
  // Mostrar indicador de carga
  mostrarAlerta('Verificando documento...', 'info');
  
  // Hacer la petición a la API
  fetch(`/api/documentos/buscar/codigo/${codigoBarras}`)
    .then(response => {
      if (!response.ok) {
        throw new Error('Documento no encontrado');
      }
      return response.json();
    })
    .then(data => {
      if (data.exito) {
        // Redirigir a la página de detalles del documento
        window.location.href = `/documentos/detalle/${data.datos.id}`;
      } else {
        mostrarAlerta(data.mensaje, 'warning');
      }
    })
    .catch(error => {
      mostrarAlerta(error.message, 'danger');
    });
}

/**
 * Muestra una alerta en la página
 * @param {string} mensaje - Mensaje a mostrar
 * @param {string} tipo - Tipo de alerta (success, danger, warning, info)
 */
function mostrarAlerta(mensaje, tipo = 'info') {
  // Crear elemento de alerta
  const alertaDiv = document.createElement('div');
  alertaDiv.className = `alert alert-${tipo} alert-dismissible fade show`;
  alertaDiv.setAttribute('role', 'alert');
  
  // Agregar contenido de la alerta
  alertaDiv.innerHTML = `
    ${mensaje}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Cerrar"></button>
  `;
  
  // Buscar contenedor para alertas, o crear uno si no existe
  let alertasContainer = document.getElementById('alertas-container');
  
  if (!alertasContainer) {
    alertasContainer = document.createElement('div');
    alertasContainer.id = 'alertas-container';
    alertasContainer.className = 'container mt-3';
    
    // Insertar al principio del contenedor principal
    const mainContainer = document.querySelector('main.container');
    if (mainContainer) {
      mainContainer.insertBefore(alertasContainer, mainContainer.firstChild);
    } else {
      document.body.insertBefore(alertasContainer, document.body.firstChild);
    }
  }
  
  // Agregar alerta al contenedor
  alertasContainer.appendChild(alertaDiv);
  
  // Eliminar la alerta después de 5 segundos
  setTimeout(() => {
    alertaDiv.remove();
  }, 5000);
} 