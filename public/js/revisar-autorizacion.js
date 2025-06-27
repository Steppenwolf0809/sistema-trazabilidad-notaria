document.addEventListener('DOMContentLoaded', () => {

  const formAutorizar = document.getElementById('form-autorizar');
  const formRechazar = document.getElementById('form-rechazar');

  // Obtener token de las cookies
  function getCookie(nombre) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${nombre}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  // Función para mostrar alertas
  function mostrarAlerta(elementoId, mensaje, tipo) {
    const elemento = document.getElementById(elementoId);
    elemento.innerHTML = mensaje;
    elemento.className = `alert alert-${tipo}`;
  }

  // Manejar formulario de autorización
  if (formAutorizar) {
    formAutorizar.addEventListener('submit', async (e) => {
      e.preventDefault();

      const btnConfirmar = document.getElementById('btn-confirmar-autorizacion');
      const btnText = document.getElementById('btn-autorizar-text');
      const btnSpinner = document.getElementById('btn-autorizar-spinner');

      // Validar formulario
      if (!formAutorizar.checkValidity()) {
        e.stopPropagation();
        formAutorizar.classList.add('was-validated');
        return;
      }

      // Deshabilitar botón
      btnConfirmar.disabled = true;
      btnText.textContent = 'Procesando...';
      btnSpinner.classList.remove('d-none');

      const autorizacionId = document.getElementById('autorizacion-id').value;
      const tipoJustificacion = document.getElementById('tipo-justificacion').value;
      const justificacion = document.getElementById('justificacion-autorizacion').value;

      try {
        const token = getCookie('token');
        if (!token) {
          throw new Error('No se encontró el token de autenticación.');
        }

        const response = await fetch(`/api/autorizaciones-urgentes/${autorizacionId}/autorizar`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            justificacion: justificacion,
            tipo_justificacion: tipoJustificacion
          })
        });

        const resultado = await response.json();

        if (!response.ok) {
          throw new Error(resultado.message || 'Error al procesar la autorización');
        }

        // Éxito
        mostrarAlerta(
          'alerta-autorizacion',
          '<strong>¡Autorización Exitosa!</strong> El documento ha sido autorizado para entrega sin verificación de pago.',
          'success'
        );

        // Cerrar modal y redirigir después de un momento
        setTimeout(() => {
          const modal = bootstrap.Modal.getInstance(document.getElementById('modalAutorizar'));
          modal.hide();
          
          // Redirigir al dashboard
          window.location.href = window.location.pathname.includes('/matrizador/') ? '/matrizador' : '/caja';
        }, 3000);

      } catch (error) {
        console.error('Error al autorizar:', error);
        mostrarAlerta('alerta-autorizacion', error.message, 'danger');

        // Habilitar botón nuevamente
        btnConfirmar.disabled = false;
        btnText.textContent = 'Confirmar Autorización';
        btnSpinner.classList.add('d-none');
      }
    });
  }

  // Manejar formulario de rechazo
  if (formRechazar) {
    formRechazar.addEventListener('submit', async (e) => {
      e.preventDefault();

      const btnConfirmar = document.getElementById('btn-confirmar-rechazo');
      const btnText = document.getElementById('btn-rechazar-text');
      const btnSpinner = document.getElementById('btn-rechazar-spinner');

      // Validar formulario
      if (!formRechazar.checkValidity()) {
        e.stopPropagation();
        formRechazar.classList.add('was-validated');
        return;
      }

      // Deshabilitar botón
      btnConfirmar.disabled = true;
      btnText.textContent = 'Procesando...';
      btnSpinner.classList.remove('d-none');

      const autorizacionId = document.getElementById('autorizacion-id').value;
      const motivo = document.getElementById('motivo-rechazo').value;

      try {
        const token = getCookie('token');
        if (!token) {
          throw new Error('No se encontró el token de autenticación.');
        }

        const response = await fetch(`/api/autorizaciones-urgentes/${autorizacionId}/rechazar`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            motivo: motivo
          })
        });

        const resultado = await response.json();

        if (!response.ok) {
          throw new Error(resultado.message || 'Error al procesar el rechazo');
        }

        // Éxito
        mostrarAlerta(
          'alerta-rechazo',
          '<strong>Solicitud Rechazada</strong> La autorización ha sido denegada. El documento no será entregado hasta que se confirme el pago.',
          'success'
        );

        // Cerrar modal y redirigir después de un momento
        setTimeout(() => {
          const modal = bootstrap.Modal.getInstance(document.getElementById('modalRechazar'));
          modal.hide();
          
          // Redirigir al dashboard
          window.location.href = window.location.pathname.includes('/matrizador/') ? '/matrizador' : '/caja';
        }, 3000);

      } catch (error) {
        console.error('Error al rechazar:', error);
        mostrarAlerta('alerta-rechazo', error.message, 'danger');

        // Habilitar botón nuevamente
        btnConfirmar.disabled = false;
        btnText.textContent = 'Confirmar Rechazo';
        btnSpinner.classList.add('d-none');
      }
    });
  }
}); 