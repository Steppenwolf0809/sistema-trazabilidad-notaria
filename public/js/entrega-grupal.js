/**
 * ENTREGA GRUPAL - JavaScript Compartido
 * Funcionalidad mejorada para selección dinámica de documentos
 * Compatible con todos los roles: admin, recepcion, matrizador
 */

class EntregaGrupal {
  constructor(config = {}) {
    this.rol = config.rol || 'recepcion'; // admin, recepcion, matrizador
    this.documentoPrincipal = config.documentoPrincipal || null;
    this.documentosDisponibles = config.documentosDisponibles || [];
    this.documentosSeleccionados = new Set();
    this.codigosValidos = new Map(); // Map de documentoId -> codigo
    
    this.init();
  }
  
  init() {
    console.log(`🚀 Inicializando EntregaGrupal para rol: ${this.rol}`);
    this.setupEventListeners();
    this.actualizarInterfaz();
  }
  
  setupEventListeners() {
    // Checkbox "Seleccionar todos"
    const selectAllBtn = document.getElementById('selectAll');
    if (selectAllBtn) {
      selectAllBtn.addEventListener('change', (e) => {
        this.toggleSelectAll(e.target.checked);
      });
    }
    
    // Checkboxes individuales de documentos
    document.querySelectorAll('.documento-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        this.toggleDocumento(e.target.value, e.target.checked);
      });
      
      // Agregar código válido al mapa
      const codigo = checkbox.dataset.codigo;
      if (codigo && codigo !== 'sin_codigo') {
        this.codigosValidos.set(checkbox.value, codigo);
      }
    });
    
    // Validación de código
    const validarCodigoBtn = document.getElementById('validarCodigo');
    if (validarCodigoBtn) {
      validarCodigoBtn.addEventListener('click', () => {
        this.validarCodigo();
      });
    }
    
    // Input de código (validar al presionar Enter)
    const codigoInput = document.getElementById('codigoVerificacion');
    if (codigoInput) {
      codigoInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.validarCodigo();
        }
      });
      
      // Solo permitir números
      codigoInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, '');
      });
    }
    
    // Formulario de entrega
    const formEntrega = document.getElementById('formEntrega');
    if (formEntrega) {
      formEntrega.addEventListener('submit', (e) => {
        this.validarFormularioAntesDEnvio(e);
      });
    }
  }
  
  toggleSelectAll(seleccionar) {
    const checkboxes = document.querySelectorAll('.documento-checkbox');
    
    checkboxes.forEach(checkbox => {
      // Solo seleccionar documentos que el rol puede entregar
      if (this.puedeEntregar(checkbox.dataset.matrizadorId)) {
        checkbox.checked = seleccionar;
        this.toggleDocumento(checkbox.value, seleccionar);
      }
    });
    
    this.actualizarInterfaz();
  }
  
  toggleDocumento(documentoId, seleccionar) {
    if (seleccionar) {
      this.documentosSeleccionados.add(documentoId);
    } else {
      this.documentosSeleccionados.delete(documentoId);
    }
    
    this.actualizarInterfaz();
  }
  
  puedeEntregar(matrizadorId) {
    switch (this.rol) {
      case 'admin':
      case 'recepcion':
        return true; // Pueden entregar cualquier documento
      case 'matrizador':
        // Solo pueden entregar sus propios documentos
        const usuarioActual = window.usuarioActual?.id;
        return matrizadorId == usuarioActual;
      default:
        return false;
    }
  }
  
  actualizarInterfaz() {
    const cantidadSeleccionados = this.documentosSeleccionados.size;
    
    // Mostrar/ocultar secciones según selección
    this.toggleSeccion('informacion-receptor', cantidadSeleccionados > 0);
    this.toggleSeccion('validacion-codigo', cantidadSeleccionados > 0);
    
    // Actualizar códigos válidos
    this.actualizarCodigosValidos();
    
    // Actualizar contador de selección
    this.actualizarContadorSeleccion();
    
    // Actualizar botón de entrega
    this.actualizarBotonEntrega();
  }
  
  toggleSeccion(seccionId, mostrar) {
    const seccion = document.getElementById(seccionId);
    if (seccion) {
      seccion.style.display = mostrar ? 'block' : 'none';
    }
  }
  
  actualizarCodigosValidos() {
    const codigosValidosDiv = document.getElementById('codigos-validos');
    if (!codigosValidosDiv) return;
    
    const codigosSeleccionados = Array.from(this.documentosSeleccionados)
      .map(docId => this.codigosValidos.get(docId))
      .filter(codigo => codigo && codigo !== 'sin_codigo');
    
    if (codigosSeleccionados.length > 0) {
      codigosValidosDiv.innerHTML = `
        <div class="alert alert-info alert-sm">
          <i class="fas fa-key me-1"></i>
          <strong>Códigos válidos:</strong> ${codigosSeleccionados.join(', ')}
          <br><small>Puede usar cualquiera de estos códigos para validar la entrega grupal</small>
        </div>
      `;
    } else {
      codigosValidosDiv.innerHTML = `
        <div class="alert alert-warning alert-sm">
          <i class="fas fa-exclamation-triangle me-1"></i>
          <strong>Sin códigos:</strong> Los documentos seleccionados no requieren código de verificación
        </div>
      `;
    }
  }
  
  actualizarContadorSeleccion() {
    const contador = document.getElementById('contador-seleccion');
    if (contador) {
      const total = this.documentosSeleccionados.size;
      if (this.documentoPrincipal) {
        contador.textContent = `${total + 1} documento(s) seleccionado(s)`;
      } else {
        contador.textContent = `${total} documento(s) seleccionado(s)`;
      }
    }
  }
  
  actualizarBotonEntrega() {
    const btnEntrega = document.getElementById('btnConfirmarEntrega');
    if (!btnEntrega) return;
    
    const cantidadTotal = this.documentosSeleccionados.size + (this.documentoPrincipal ? 1 : 0);
    
    if (cantidadTotal > 1) {
      btnEntrega.innerHTML = `
        <i class="fas fa-boxes me-2"></i> 
        Confirmar Entrega Grupal (${cantidadTotal} documentos)
      `;
      btnEntrega.classList.remove('btn-primary');
      btnEntrega.classList.add('btn-success');
    } else {
      btnEntrega.innerHTML = `
        <i class="fas fa-check-circle me-2"></i> 
        Confirmar Entrega
      `;
      btnEntrega.classList.remove('btn-success');
      btnEntrega.classList.add('btn-primary');
    }
  }
  
  validarCodigo() {
    const codigoInput = document.getElementById('codigoVerificacion');
    const mensajeDiv = document.getElementById('mensaje-validacion-codigo');
    
    if (!codigoInput) return;
    
    const codigoIngresado = codigoInput.value.trim();
    
    if (!codigoIngresado) {
      this.mostrarMensajeValidacion('Debe ingresar un código de verificación', 'error');
      return;
    }
    
    // Obtener códigos válidos de documentos seleccionados
    const codigosSeleccionados = Array.from(this.documentosSeleccionados)
      .map(docId => this.codigosValidos.get(docId))
      .filter(codigo => codigo && codigo !== 'sin_codigo');
    
    // Agregar código del documento principal si existe
    if (this.documentoPrincipal && this.documentoPrincipal.codigoVerificacion) {
      codigosSeleccionados.push(this.documentoPrincipal.codigoVerificacion);
    }
    
    if (codigosSeleccionados.includes(codigoIngresado)) {
      this.mostrarMensajeValidacion('✅ Código válido. Puede proceder con la entrega', 'success');
      this.habilitarFormularioReceptor();
    } else {
      this.mostrarMensajeValidacion('❌ Código incorrecto. Use cualquier código de los documentos seleccionados', 'error');
    }
  }
  
  mostrarMensajeValidacion(mensaje, tipo) {
    const mensajeDiv = document.getElementById('mensaje-validacion-codigo');
    if (!mensajeDiv) return;
    
    const claseAlerta = tipo === 'success' ? 'alert-success' : 'alert-danger';
    mensajeDiv.innerHTML = `
      <div class="alert ${claseAlerta} alert-sm mt-2">
        ${mensaje}
      </div>
    `;
  }
  
  habilitarFormularioReceptor() {
    const seccionReceptor = document.getElementById('informacion-receptor');
    if (seccionReceptor) {
      seccionReceptor.style.display = 'block';
      
      // Focus en primer campo
      const primerCampo = seccionReceptor.querySelector('input');
      if (primerCampo) {
        primerCampo.focus();
      }
    }
  }
  
  validarFormularioAntesDEnvio(event) {
    const cantidadTotal = this.documentosSeleccionados.size + (this.documentoPrincipal ? 1 : 0);
    
    // Validar campos requeridos
    const nombreReceptor = document.getElementById('nombreReceptor')?.value?.trim();
    const identificacionReceptor = document.getElementById('identificacionReceptor')?.value?.trim();
    const relacionReceptor = document.getElementById('relacionReceptor')?.value;
    
    if (!nombreReceptor || !identificacionReceptor || !relacionReceptor) {
      event.preventDefault();
      alert('❌ Debe completar todos los datos del receptor');
      return false;
    }
    
    // Validar código si es necesario
    const requiereCodigo = this.requiereValidacionCodigo();
    if (requiereCodigo) {
      const codigoIngresado = document.getElementById('codigoVerificacion')?.value?.trim();
      if (!codigoIngresado) {
        event.preventDefault();
        alert('❌ Debe validar el código de verificación antes de proceder');
        return false;
      }
    }
    
    // Confirmar entrega grupal
    if (cantidadTotal > 1) {
      const confirmar = confirm(`¿Confirma la entrega grupal de ${cantidadTotal} documentos?`);
      if (!confirmar) {
        event.preventDefault();
        return false;
      }
    }
    
    // Preparar datos para envío
    this.prepararDatosEnvio();
    
    return true;
  }
  
  requiereValidacionCodigo() {
    // Verificar si algún documento seleccionado requiere código
    const codigosSeleccionados = Array.from(this.documentosSeleccionados)
      .map(docId => this.codigosValidos.get(docId))
      .filter(codigo => codigo && codigo !== 'sin_codigo');
    
    // Agregar código del documento principal si existe
    if (this.documentoPrincipal && this.documentoPrincipal.codigoVerificacion) {
      codigosSeleccionados.push(this.documentoPrincipal.codigoVerificacion);
    }
    
    return codigosSeleccionados.length > 0;
  }
  
  prepararDatosEnvio() {
    // Agregar documentos seleccionados al formulario
    const documentosInput = document.getElementById('documentos_seleccionados');
    if (documentosInput) {
      const documentosArray = Array.from(this.documentosSeleccionados);
      documentosInput.value = JSON.stringify(documentosArray);
    }
    
    // Marcar como entrega grupal si hay múltiples documentos
    const entregaGrupalInput = document.getElementById('entrega_grupal');
    if (entregaGrupalInput) {
      const cantidadTotal = this.documentosSeleccionados.size + (this.documentoPrincipal ? 1 : 0);
      entregaGrupalInput.value = cantidadTotal > 1 ? 'true' : 'false';
    }
    
    // Agregar información del rol
    const rolInput = document.getElementById('rol_usuario');
    if (rolInput) {
      rolInput.value = this.rol;
    }
  }
  
  // Métodos públicos para uso desde las vistas
  
  mostrarAlertaDocumentosOtros() {
    const alertaOtros = document.getElementById('alerta-documentos-otros');
    if (alertaOtros) {
      alertaOtros.style.display = alertaOtros.style.display === 'none' ? 'block' : 'none';
    }
  }
  
  ocultarAlertaGrupal() {
    const alertaGrupal = document.getElementById('alerta-entrega-grupal');
    if (alertaGrupal) {
      alertaGrupal.style.display = 'none';
    }
  }
  
  resetearSeleccion() {
    this.documentosSeleccionados.clear();
    
    // Desmarcar todos los checkboxes
    document.querySelectorAll('.documento-checkbox').forEach(checkbox => {
      checkbox.checked = false;
    });
    
    // Desmarcar "seleccionar todos"
    const selectAllBtn = document.getElementById('selectAll');
    if (selectAllBtn) {
      selectAllBtn.checked = false;
    }
    
    this.actualizarInterfaz();
  }
}

// Funciones globales para compatibilidad con código existente
window.EntregaGrupal = EntregaGrupal;

// Funciones de utilidad
window.mostrarEntregaGrupal = function() {
  if (window.entregaGrupalInstance) {
    const seccion = document.getElementById('seccion-entrega-grupal');
    if (seccion) {
      seccion.style.display = 'block';
    }
  }
};

window.ocultarEntregaGrupal = function() {
  if (window.entregaGrupalInstance) {
    window.entregaGrupalInstance.ocultarAlertaGrupal();
  }
};

window.resetearEntregaGrupal = function() {
  if (window.entregaGrupalInstance) {
    window.entregaGrupalInstance.resetearSeleccion();
  }
};

// Auto-inicialización cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
  // Solo inicializar si hay elementos de entrega grupal en la página
  if (document.querySelector('.documento-checkbox') || document.getElementById('selectAll')) {
    console.log('🔄 Auto-inicializando EntregaGrupal...');
    
    // Obtener configuración desde atributos data del body o elementos específicos
    const config = {
      rol: document.body.dataset.userRole || 'recepcion',
      documentoPrincipal: window.documentoPrincipal || null,
      documentosDisponibles: window.documentosDisponibles || []
    };
    
    window.entregaGrupalInstance = new EntregaGrupal(config);
  }
}); 