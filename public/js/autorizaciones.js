document.addEventListener('DOMContentLoaded', () => {

  const form = document.getElementById('form-autorizacion-urgente');
  if (!form) {
    // No estamos en una página con el formulario de autorización
    return;
  }
  
  const btnEnviar = document.getElementById('btn-enviar-solicitud');
  const btnText = document.getElementById('btn-text');
  const btnSpinner = document.getElementById('btn-spinner');
  const alerta = document.getElementById('autorizacion-alerta');
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Validar el formulario de forma nativa
    if (!form.checkValidity()) {
      e.stopPropagation();
      form.classList.add('was-validated');
      return;
    }

    // Deshabilitar botón para evitar envíos múltiples
    btnEnviar.disabled = true;
    btnText.textContent = 'Enviando...';
    btnSpinner.classList.remove('d-none');
    alerta.classList.add('d-none');

    // Obtener datos del formulario
    const documentoId = document.getElementById('documentoId').value;
    const justificacion = document.getElementById('justificacion-solicitud').value;
    
    try {
      // Obtener el token de las cookies
      const token = getCookie('token');
      if (!token) {
        throw new Error('No se encontró el token de autenticación.');
      }

      const response = await fetch('/api/autorizaciones-urgentes/solicitar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          documentoId: parseInt(documentoId, 10),
          justificacion: justificacion
        })
      });
      
      const resultado = await response.json();

      if (!response.ok) {
        throw new Error(resultado.error || 'Ocurrió un error desconocido');
      }

      // Éxito
      mostrarAlerta(
        `<strong>¡Solicitud enviada!</strong> Se ha notificado al matrizador responsable. ID de Autorización: ${resultado.autorizacionId}. Por favor, espera la confirmación.`,
        'success'
      );
      
      // Cerrar el modal después de un momento y refrescar la página
      setTimeout(() => {
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalAutorizacionUrgente'));
        modal.hide();
        window.location.reload();
      }, 4000);

    } catch (error) {
      console.error('Error al solicitar autorización:', error);
      mostrarAlerta(error.message, 'danger');
      
      // Habilitar botón de nuevo en caso de error
      btnEnviar.disabled = false;
      btnText.textContent = 'Enviar Solicitud';
      btnSpinner.classList.add('d-none');
    }
  });

  /**
   * Muestra una alerta en el modal.
   * @param {string} mensaje El mensaje a mostrar.
   * @param {string} tipo 'success' o 'danger'.
   */
  function mostrarAlerta(mensaje, tipo) {
    alerta.innerHTML = mensaje;
    alerta.className = `alert alert-${tipo}`;
  }

  /**
   * Obtiene el valor de una cookie por su nombre.
   * @param {string} nombre El nombre de la cookie.
   * @returns {string|null} El valor de la cookie o null si no se encuentra.
   */
  function getCookie(nombre) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${nombre}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }
}); 