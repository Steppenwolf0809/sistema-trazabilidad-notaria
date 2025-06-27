document.addEventListener('DOMContentLoaded', () => {

  const contenedorAlertas = document.getElementById('contenedor-alertas-urgentes');
  if (!contenedorAlertas) {
    // No estamos en un dashboard que necesite alertas
    return;
  }

  const INTERVALO_POLLING = 20000; // 20 segundos

  /**
   * Obtiene el valor de una cookie por su nombre.
   */
  function getCookie(nombre) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${nombre}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  /**
   * Crea el HTML para una sola alerta de autorización.
   */
  function crearAlertaHTML(alerta) {
    const minutos = Math.floor(alerta.minutos_espera);
    const urgenciaClass = alerta.es_urgente ? 'alert-danger' : 'alert-warning';
    const urgenciaIcon = alerta.es_urgente ? 'fa-bell fa-shake' : 'fa-clock';
    
    return `
      <div class="alert ${urgenciaClass} alert-dismissible fade show" role="alert">
        <div class="d-flex align-items-center">
          <div class="me-3">
            <i class="fas ${urgenciaIcon} fa-2x"></i>
          </div>
          <div>
            <h5 class="alert-heading">¡Autorización Urgente Requerida!</h5>
            <p class="mb-1">
              El documento <strong>${alerta.codigo_barras}</strong> para el cliente <strong>${alerta.cliente_nombre}</strong> requiere su atención.
            </p>
            <p class="mb-2">
              Solicitado por: <strong>${alerta.solicitado_por_nombre} (${alerta.solicitado_por_rol})</strong>
              <span class="badge bg-secondary ms-2">Hace ${minutos} min</span>
            </p>
            <a href="/autorizacion/revisar/${alerta.id}" class="btn btn-sm btn-dark">
              Revisar y Autorizar <i class="fas fa-arrow-right ms-1"></i>
            </a>
          </div>
          <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
      </div>
    `;
  }

  /**
   * Función principal que busca y muestra las autorizaciones pendientes.
   */
  async function verificarAutorizacionesPendientes() {
    try {
      const token = getCookie('token');
      if (!token) {
        console.warn('No se encontró token, no se pueden verificar autorizaciones.');
        return;
      }

      const response = await fetch('/api/autorizaciones-urgentes/pendientes', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Error del servidor: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.autorizaciones.length > 0) {
        // Filtrar para no mostrar alertas ya visibles
        const alertasNuevas = data.autorizaciones.filter(alerta => 
          !document.querySelector(`a[href="/autorizacion/revisar/${alerta.id}"]`)
        );

        if (alertasNuevas.length > 0) {
          const alertasHTML = alertasNuevas.map(crearAlertaHTML).join('');
          contenedorAlertas.insertAdjacentHTML('beforeend', alertasHTML);
        }
      }

    } catch (error) {
      console.error('Error al verificar autorizaciones pendientes:', error);
      // Opcional: podrías detener el polling si hay un error persistente
      // clearInterval(pollingId);
    }
  }

  // Iniciar el polling
  verificarAutorizacionesPendientes(); // Llamada inicial
  const pollingId = setInterval(verificarAutorizacionesPendientes, INTERVALO_POLLING);
}); 