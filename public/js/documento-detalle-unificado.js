/**
 * DOCUMENTO DETALLE UNIFICADO - JAVASCRIPT
 * Sistema de edición in-place con validaciones y guardado por secciones
 */

class DocumentoDetalleUnificado {
  constructor() {
    this.editingMode = false;
    this.sectionsEditing = new Set();
    this.documentoId = null;
    this.originalValues = new Map();
    
    this.init();
  }
  
  init() {
    console.log('🎨 Inicializando sistema de edición unificado...');
    
    // Obtener ID del documento
    this.documentoId = window.documentoId || this.extractDocumentoId();
    
    // Guardar valores originales
    this.storeOriginalValues();
    
    // Configurar event listeners globales
    this.setupGlobalEventListeners();
    
    // Configurar validaciones
    this.setupValidations();
    
    console.log('✅ Sistema de edición unificado inicializado', {
      documentoId: this.documentoId,
      sectionsAvailable: this.getAvailableSections()
    });
  }
  
  extractDocumentoId() {
    // Extraer de la URL o de algún elemento del DOM
    const urlParts = window.location.pathname.split('/');
    const detalleIndex = urlParts.indexOf('detalle');
    return detalleIndex !== -1 ? urlParts[detalleIndex + 1] : null;
  }
  
  getAvailableSections() {
    return Array.from(document.querySelectorAll('[id^="seccion-"]')).map(el => 
      el.id.replace('seccion-', '')
    );
  }
  
  storeOriginalValues() {
    document.querySelectorAll('input, select, textarea').forEach(input => {
      const key = input.id || input.name;
      if (key) {
        this.originalValues.set(key, input.value);
        input.setAttribute('data-original-value', input.value);
      }
    });
  }
  
  setupGlobalEventListeners() {
    // Event listener para el botón de edición global
    const globalToggle = document.getElementById('globalEditToggle');
    if (globalToggle) {
      globalToggle.addEventListener('click', () => this.toggleGlobalEdit());
    }
    
    // Event listeners para botones de edición por sección
    document.querySelectorAll('.edit-toggle').forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const section = e.target.getAttribute('data-section') || e.target.closest('.edit-toggle').getAttribute('data-section');
        console.log('🔄 Click en botón editar, sección:', section);
        if (section) {
          this.toggleSectionEdit(section);
        }
      });
    });
    
    // Event listener para tecla Escape (cancelar edición)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.sectionsEditing.size > 0) {
        this.cancelAllEdits();
      }
    });
  }
  
  setupValidations() {
    // Configurar validaciones en tiempo real
    this.setupEmailValidation();
    this.setupTelefonoValidation();
    this.setupNotificationValidation();
  }
  
  setupEmailValidation() {
    const emailInputs = document.querySelectorAll('input[type="email"]');
    emailInputs.forEach(input => {
      input.addEventListener('input', this.validateEmail.bind(this));
      input.addEventListener('blur', this.validateEmail.bind(this));
    });
  }
  
  setupTelefonoValidation() {
    const telefonoInputs = document.querySelectorAll('input[type="tel"]');
    telefonoInputs.forEach(input => {
      input.addEventListener('input', this.validateTelefono.bind(this));
      input.addEventListener('blur', this.validateTelefono.bind(this));
    });
  }
  
  setupNotificationValidation() {
    const notificationRadios = document.querySelectorAll('input[name="politicaNotificacion"]');
    notificationRadios.forEach(radio => {
      radio.addEventListener('change', this.toggleRazonField.bind(this));
    });
  }
  
  // ============== MÉTODOS DE EDICIÓN ==============
  
  toggleGlobalEdit() {
    const button = document.getElementById('globalEditToggle');
    const isEditing = button.textContent.includes('Cancelar');
    
    if (isEditing) {
      this.cancelAllEdits();
      this.exitGlobalEditMode();
    } else {
      this.enterGlobalEditMode();
    }
  }
  
  enterGlobalEditMode() {
    this.editingMode = true;
    const button = document.getElementById('globalEditToggle');
    
    button.innerHTML = '<i class="fas fa-times me-1"></i> Cancelar Edición';
    button.classList.add('active');
    
    this.updateEditToggleButtons();
    this.showGlobalEditMessage();
    
    console.log('🔧 Modo edición global activado');
  }
  
  exitGlobalEditMode() {
    this.editingMode = false;
    const button = document.getElementById('globalEditToggle');
    
    button.innerHTML = '<i class="fas fa-edit me-1"></i> Editar';
    button.classList.remove('active');
    
    this.updateEditToggleButtons();
    
    console.log('✅ Modo edición global desactivado');
  }
  
  updateEditToggleButtons() {
    const toggleButtons = document.querySelectorAll('.edit-toggle');
    toggleButtons.forEach(btn => {
      if (this.editingMode) {
        btn.style.display = 'block';
        btn.disabled = false;
      } else {
        btn.style.display = 'block';
        btn.disabled = false;
        btn.classList.remove('active');
      }
    });
  }
  
  showGlobalEditMessage() {
    const existingMessage = document.querySelector('.global-edit-message');
    if (existingMessage) {
      existingMessage.remove();
    }
    
    const message = document.createElement('div');
    message.className = 'alert alert-info-professional global-edit-message';
    message.innerHTML = `
      <i class="fas fa-info-circle me-2"></i>
      <strong>Modo edición activado:</strong> Haga clic en "Editar" en cualquier sección para modificar la información.
      <button type="button" class="btn-close" onclick="this.parentElement.remove()"></button>
    `;
    
    const container = document.querySelector('.document-unified-container');
    const header = container.querySelector('.document-header');
    header.after(message);
    
    // Auto-remover después de 6 segundos
    setTimeout(() => {
      if (message.parentNode) {
        message.remove();
      }
    }, 6000);
  }
  
  toggleSectionEdit(sectionName) {
    // Verificar permisos para archivo
    if (window.userRole === 'archivo' && !window.esDocumentoPropio) {
      alert('❌ Solo puede editar sus propios documentos');
      return;
    }
    
    const isEditing = this.sectionsEditing.has(sectionName);
    
    if (isEditing) {
      this.cancelSectionEdit(sectionName);
    } else {
      this.enableSectionEdit(sectionName);
    }
  }
  
  enableSectionEdit(sectionName) {
    const section = document.getElementById(`seccion-${sectionName}`);
    if (!section) {
      console.error(`Sección '${sectionName}' no encontrada`);
      return;
    }
    
    const viewMode = section.querySelector(`#${sectionName}-view`);
    const editMode = section.querySelector(`#${sectionName}-edit`);
    const toggle = section.querySelector('.edit-toggle');
    
    if (!viewMode || !editMode) {
      console.error(`Elementos de vista/edición no encontrados para '${sectionName}'`);
      return;
    }
    
    // Cambiar vista
    viewMode.style.display = 'none';
    editMode.style.display = 'block';
    editMode.classList.add('active');
    
    // Actualizar estado visual
    section.classList.add('editing');
    if (toggle) {
      toggle.classList.add('active');
      toggle.innerHTML = '<i class="fas fa-times"></i> Cancelar';
    }
    
    // Marcar como en edición
    this.sectionsEditing.add(sectionName);
    
    // Configurar event listeners específicos
    this.setupSectionEventListeners(sectionName);
    
    // Focus en primer campo editable
    const firstInput = editMode.querySelector('input, select, textarea');
    if (firstInput) {
      setTimeout(() => firstInput.focus(), 100);
    }
    
    console.log(`📝 Sección '${sectionName}' activada para edición`);
  }
  
  cancelSectionEdit(sectionName) {
    const section = document.getElementById(`seccion-${sectionName}`);
    if (!section) return;
    
    const viewMode = section.querySelector(`#${sectionName}-view`);
    const editMode = section.querySelector(`#${sectionName}-edit`);
    const toggle = section.querySelector('.edit-toggle');
    
    // Restaurar valores originales
    this.restoreOriginalValues(sectionName);
    
    // Cambiar vista
    if (editMode) {
      editMode.style.display = 'none';
      editMode.classList.remove('active');
    }
    if (viewMode) {
      viewMode.style.display = 'block';
    }
    
    // Actualizar estado visual
    section.classList.remove('editing');
    if (toggle) {
      toggle.classList.remove('active');
      toggle.innerHTML = '<i class="fas fa-edit"></i> Editar';
    }
    
    // Remover de lista de edición
    this.sectionsEditing.delete(sectionName);
    
    console.log(`❌ Edición de '${sectionName}' cancelada`);
  }
  
  cancelAllEdits() {
    Array.from(this.sectionsEditing).forEach(sectionName => {
      this.cancelSectionEdit(sectionName);
    });
    this.sectionsEditing.clear();
    
    if (this.editingMode) {
      this.exitGlobalEditMode();
    }
  }
  
  restoreOriginalValues(sectionName) {
    const section = document.getElementById(`seccion-${sectionName}`);
    const inputs = section.querySelectorAll('input, select, textarea');
    
    inputs.forEach(input => {
      const originalValue = input.getAttribute('data-original-value') || '';
      input.value = originalValue;
      input.classList.remove('is-invalid', 'is-valid');
      
      // Limpiar mensajes de error
      const feedback = input.nextElementSibling;
      if (feedback && feedback.classList.contains('invalid-feedback')) {
        feedback.textContent = '';
      }
    });
  }
  
  setupSectionEventListeners(sectionName) {
    const section = document.getElementById(`seccion-${sectionName}`);
    
    // Event listeners específicos por sección
    if (sectionName === 'notificaciones') {
      const radios = section.querySelectorAll('input[name="politicaNotificacion"]');
      radios.forEach(radio => {
        radio.addEventListener('change', this.toggleRazonField.bind(this));
      });
      
      // Ejecutar inmediatamente para configurar estado inicial
      this.toggleRazonField();
    }
  }
  
  // ============== VALIDACIONES ==============
  
  validateEmail(event) {
    const input = event.target;
    const email = input.value.trim();
    const feedback = input.nextElementSibling;
    
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      input.classList.add('is-invalid');
      input.classList.remove('is-valid');
      if (feedback) feedback.textContent = 'Ingrese un email válido (ejemplo@dominio.com)';
      return false;
    } else {
      input.classList.remove('is-invalid');
      if (email) input.classList.add('is-valid');
      if (feedback) feedback.textContent = '';
      return true;
    }
  }
  
  validateTelefono(event) {
    const input = event.target;
    let telefono = input.value.replace(/\D/g, '');
    const feedback = input.nextElementSibling;
    
    // Limitar a 10 dígitos
    if (telefono.length > 10) {
      telefono = telefono.substring(0, 10);
      input.value = telefono;
    }
    
    if (telefono && telefono.length !== 10) {
      input.classList.add('is-invalid');
      input.classList.remove('is-valid');
      if (feedback) feedback.textContent = 'El teléfono debe tener exactamente 10 dígitos';
      return false;
    } else {
      input.classList.remove('is-invalid');
      if (telefono) input.classList.add('is-valid');
      if (feedback) feedback.textContent = '';
      return true;
    }
  }
  
  toggleRazonField() {
    const razonGroup = document.getElementById('razonGroup-edit');
    const noNotificar = document.getElementById('noNotificar-edit');
    
    if (razonGroup && noNotificar) {
      if (noNotificar.checked) {
        razonGroup.style.display = 'block';
        const textarea = razonGroup.querySelector('textarea');
        if (textarea) {
          textarea.setAttribute('required', 'required');
        }
      } else {
        razonGroup.style.display = 'none';
        const textarea = razonGroup.querySelector('textarea');
        if (textarea) {
          textarea.removeAttribute('required');
          textarea.classList.remove('is-invalid');
        }
      }
    }
  }
  
  validateSectionData(sectionName) {
    const section = document.getElementById(`seccion-${sectionName}`);
    let isValid = true;
    
    if (sectionName === 'general') {
      const tipoSelect = section.querySelector('#tipoDocumento-edit');
      if (!tipoSelect || !tipoSelect.value) {
        if (tipoSelect) this.showFieldError(tipoSelect, 'Debe seleccionar un tipo de documento');
        isValid = false;
      }
    }
    
    if (sectionName === 'cliente') {
      const nombre = section.querySelector('#nombreCliente-edit');
      const identificacion = section.querySelector('#identificacionCliente-edit');
      const email = section.querySelector('#emailCliente-edit');
      const telefono = section.querySelector('#telefonoCliente-edit');
      
      if (!nombre || !nombre.value.trim()) {
        if (nombre) this.showFieldError(nombre, 'El nombre del cliente es obligatorio');
        isValid = false;
      }
      
      if (!identificacion || !identificacion.value.trim()) {
        if (identificacion) this.showFieldError(identificacion, 'La identificación del cliente es obligatoria');
        isValid = false;
      }
      
      // Validar email si está presente
      if (email && email.value.trim()) {
        if (!this.validateEmail({ target: email })) {
          isValid = false;
        }
      }
      
      // Validar teléfono si está presente
      if (telefono && telefono.value.trim()) {
        if (!this.validateTelefono({ target: telefono })) {
          isValid = false;
        }
      }
    }
    
    if (sectionName === 'notificaciones') {
      const notificarAuto = section.querySelector('#notificarAutomatico-edit');
      const noNotificar = section.querySelector('#noNotificar-edit');
      const entregaInmediata = section.querySelector('#entregaInmediata-edit');
      const razon = section.querySelector('#razonSinNotificar-edit');
      
      console.log('🔍 VALIDACIÓN NOTIFICACIONES - Estados:', {
        notificarAuto: notificarAuto?.checked,
        noNotificar: noNotificar?.checked,
        entregaInmediata: entregaInmediata?.checked,
        razonValor: razon?.value?.trim()
      });
      
      // Verificar que elementos existen
      if (!notificarAuto || !noNotificar) {
        console.log('❌ VALIDACIÓN: Elementos de notificación no encontrados');
        isValid = false;
        return isValid;
      }
      
      // Validar que al menos una opción esté seleccionada
      if (!notificarAuto.checked && !noNotificar.checked) {
        console.log('❌ VALIDACIÓN: No hay opción de notificación seleccionada');
        isValid = false;
      }
      
      // Validar entrega inmediata vs notificar automáticamente (mutual exclusivity)
      if (entregaInmediata && entregaInmediata.checked && notificarAuto.checked) {
        console.log('❌ VALIDACIÓN: Entrega inmediata y notificar automáticamente son mutuamente excluyentes');
        isValid = false;
      }
      
      // Validar razón solo si NO es entrega inmediata y se selecciona "No notificar"
      if (noNotificar.checked && (!entregaInmediata || !entregaInmediata.checked)) {
        if (!razon || !razon.value.trim()) {
          if (razon) this.showFieldError(razon, 'Debe especificar la razón para no notificar al cliente');
          console.log('❌ VALIDACIÓN: Falta razón para no notificar (sin entrega inmediata)');
          isValid = false;
        }
      }
      
      if (isValid) {
        console.log('✅ VALIDACIÓN NOTIFICACIONES: Configuración válida');
      }
    }
    
    return isValid;
  }
  
  showFieldError(field, message) {
    field.classList.add('is-invalid');
    field.classList.remove('is-valid');
    
    const feedback = field.nextElementSibling;
    if (feedback && feedback.classList.contains('invalid-feedback')) {
      feedback.textContent = message;
    }
    
    // Focus en el primer campo con error
    if (!document.querySelector('.is-invalid:focus')) {
      field.focus();
    }
  }
  
  // ============== GUARDADO DE DATOS ==============
  
  collectSectionData(sectionName) {
    const section = document.getElementById(`seccion-${sectionName}`);
    const data = {};
    
    if (sectionName === 'general') {
      const tipoSelect = section.querySelector('#tipoDocumento-edit');
      if (tipoSelect) data.tipoDocumento = tipoSelect.value;
    }
    
    if (sectionName === 'cliente') {
      const nombre = section.querySelector('#nombreCliente-edit');
      const identificacion = section.querySelector('#identificacionCliente-edit');
      const email = section.querySelector('#emailCliente-edit');
      const telefono = section.querySelector('#telefonoCliente-edit');
      
      if (nombre) data.nombreCliente = nombre.value.trim();
      if (identificacion) data.identificacionCliente = identificacion.value.trim();
      if (email) data.emailCliente = email.value.trim();
      if (telefono) {
        const telefonoLimpio = telefono.value.replace(/\D/g, '');
        data.telefonoCliente = telefonoLimpio || ''; // Enviar string vacío en lugar de undefined
      }
    }
    
    if (sectionName === 'notificaciones') {
      const automatico = section.querySelector('#notificarAutomatico-edit');
      const noNotificar = section.querySelector('#noNotificar-edit');
      const entregaInmediata = section.querySelector('#entregaInmediata-edit');
      const razon = section.querySelector('#razonSinNotificar-edit');
      
      // Recolectar estado de entrega inmediata
      data.entregadoInmediatamente = entregaInmediata ? entregaInmediata.checked : false;
      
      // Lógica de método de notificación
      if (data.entregadoInmediatamente) {
        // Entrega inmediata siempre implica "ninguno" con razón automática
        data.metodoNotificacion = 'ninguno';
        data.razonSinNotificar = 'Cliente recogerá personalmente sin notificación previa';
      } else {
        // Lógica normal según radio buttons
        data.metodoNotificacion = (automatico && automatico.checked) ? 'whatsapp' : 'ninguno';
        
        if (data.metodoNotificacion === 'ninguno' && razon && razon.value.trim()) {
          data.razonSinNotificar = razon.value.trim();
        } else if (data.metodoNotificacion === 'whatsapp') {
          data.razonSinNotificar = null; // Limpiar razón si se activan notificaciones
        }
      }
      
      console.log('📦 DATOS NOTIFICACIONES recolectados:', {
        entregadoInmediatamente: data.entregadoInmediatamente,
        metodoNotificacion: data.metodoNotificacion,
        razonSinNotificar: data.razonSinNotificar
      });
    }
    
    if (sectionName === 'notas') {
      const notas = section.querySelector('#notas-edit-field');
      if (notas) data.notas = notas.value.trim();
    }
    
    return data;
  }
  
  async saveSectionChanges(sectionName) {
    console.log(`💾 Iniciando guardado de sección: ${sectionName}`);
    
    // Verificar permisos para archivo
    if (window.userRole === 'archivo' && !window.esDocumentoPropio) {
      alert('❌ Solo puede editar sus propios documentos');
      return;
    }
    
    // Validar datos antes de guardar
    if (!this.validateSectionData(sectionName)) {
      console.log('❌ Validación fallida, cancelando guardado');
      return;
    }
    
    const section = document.getElementById(`seccion-${sectionName}`);
    const saveButton = section.querySelector('.btn-success-soft');
    
    // Mostrar estado de carga
    const originalText = saveButton.innerHTML;
    saveButton.disabled = true;
    saveButton.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Guardando...';
    
    try {
      const formData = this.collectSectionData(sectionName);
      console.log('📤 Datos a enviar:', formData);
      
      // Determinar la ruta base según el rol del usuario
      const roleBasePath = window.userRole === 'archivo' ? '/archivo' : '/matrizador';
      
      const response = await fetch(`${roleBasePath}/documentos/${this.documentoId}/seccion/${sectionName}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.updateViewMode(sectionName, formData);
        this.updateOriginalValues(sectionName, formData);
        this.cancelSectionEdit(sectionName);
        this.showSuccessToast('Sección actualizada correctamente');
        
        console.log('✅ Sección guardada exitosamente');
      } else {
        throw new Error(data.message || 'Error desconocido al guardar');
      }
      
    } catch (error) {
      console.error('❌ Error guardando sección:', error);
      this.showErrorToast('Error al guardar: ' + error.message);
    } finally {
      // Restaurar botón
      saveButton.disabled = false;
      saveButton.innerHTML = originalText;
    }
  }
  
  updateViewMode(sectionName, data) {
    const section = document.getElementById(`seccion-${sectionName}`);
    
    if (sectionName === 'general') {
      const display = section.querySelector('#tipoDocumento-display');
      if (display && data.tipoDocumento) {
        display.textContent = data.tipoDocumento;
      }
    }
    
    if (sectionName === 'cliente') {
      this.updateClientDisplays(section, data);
    }
    
    if (sectionName === 'notificaciones') {
      this.updateNotificationDisplays(section, data);
    }
    
    if (sectionName === 'notas') {
      const display = section.querySelector('#notas-display');
      if (display) {
        display.textContent = data.notas || 'Sin notas registradas';
        display.className = data.notas ? 'info-value' : 'info-value empty';
      }
    }
  }
  
  updateClientDisplays(section, data) {
    const updates = [
      { id: '#nombreCliente-display', value: data.nombreCliente },
      { id: '#identificacionCliente-display', value: data.identificacionCliente },
      { id: '#emailCliente-display', value: data.emailCliente, fallback: 'No registrado' },
      { id: '#telefonoCliente-display', value: data.telefonoCliente, fallback: 'No registrado' }
    ];
    
    updates.forEach(({ id, value, fallback }) => {
      const display = section.querySelector(id);
      if (display) {
        display.textContent = value || fallback || '';
        display.className = value ? 'info-value' : 'info-value empty';
      }
    });
  }
  
  updateNotificationDisplays(section, data) {
    const politicaDisplay = section.querySelector('#politicaNotificacion-display');
    const canalDisplay = section.querySelector('#canalNotificacion-display');
    
    if (politicaDisplay) {
      if (data.metodoNotificacion === 'ninguno') {
        politicaDisplay.innerHTML = '<span class="badge estado-pendiente">🚫 No notificar</span>';
      } else {
        politicaDisplay.innerHTML = '<span class="badge estado-listo">🔔 Notificar automáticamente</span>';
      }
    }
    
    if (canalDisplay) {
      if (data.metodoNotificacion === 'ninguno') {
        canalDisplay.innerHTML = '<span class="text-subtle">Sin notificaciones</span>';
      } else {
        canalDisplay.innerHTML = '📱 WhatsApp';
      }
    }
  }
  
  updateOriginalValues(sectionName, data) {
    const section = document.getElementById(`seccion-${sectionName}`);
    const inputs = section.querySelectorAll('input, select, textarea');
    
    inputs.forEach(input => {
      this.originalValues.set(input.id || input.name, input.value);
      input.setAttribute('data-original-value', input.value);
    });
  }
  
  // ============== NOTIFICACIONES ==============
  
  showSuccessToast(message) {
    this.showToast(message, 'success');
  }
  
  showErrorToast(message) {
    this.showToast(message, 'error');
  }
  
  showToast(message, type) {
    const toast = document.createElement('div');
    toast.className = `alert ${type === 'success' ? 'alert-success-professional' : 'alert-warning-professional'} position-fixed`;
    toast.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 350px; max-width: 500px;';
    toast.innerHTML = `
      <div class="d-flex align-items-center">
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-triangle'} me-2"></i>
        <span>${message}</span>
        <button type="button" class="btn-close ms-auto" onclick="this.parentElement.parentElement.remove()"></button>
      </div>
    `;
    
    document.body.appendChild(toast);
    
    // Auto-remover después de 5 segundos
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 5000);
  }
}

// ============== FUNCIONES GLOBALES PARA COMPATIBILIDAD ==============

// Exponer funciones globalmente para uso desde HTML
window.toggleGlobalEdit = function() {
  if (window.documentoDetalle) {
    window.documentoDetalle.toggleGlobalEdit();
  }
};

window.toggleSectionEdit = function(sectionName) {
  if (window.documentoDetalle) {
    window.documentoDetalle.toggleSectionEdit(sectionName);
  }
};

window.saveSectionChanges = function(sectionName) {
  if (window.documentoDetalle) {
    window.documentoDetalle.saveSectionChanges(sectionName);
  }
};

window.cancelSectionEdit = function(sectionName) {
  if (window.documentoDetalle) {
    window.documentoDetalle.cancelSectionEdit(sectionName);
  }
};

window.llenarRazonRapida = function(razon) {
  const razonInput = document.getElementById('razonSinNotificar-edit');
  if (razonInput) {
    razonInput.value = razon;
    razonInput.focus();
  }
};

// ============== SISTEMA ROBUSTO DE NOTIFICACIONES ==============

class SistemaNotificacionesBidireccional {
  constructor() {
    this.elementos = {};
    this.init();
  }
  
  init() {
    console.log('🔄 Inicializando sistema bidireccional de notificaciones...');
    
    // Obtener elementos
    this.elementos = {
      entregaInmediata: document.getElementById('entregaInmediata-edit'),
      notificarAuto: document.getElementById('notificarAutomatico-edit'),
      noNotificar: document.getElementById('noNotificar-edit'),
      razonGroup: document.getElementById('razonGroup-edit'),
      infoBox: document.getElementById('infoEntregaInmediata')
    };
    
    // Verificar que existen los elementos
    if (!this.elementos.entregaInmediata || !this.elementos.notificarAuto || !this.elementos.noNotificar) {
      console.log('⚠️ Elementos de notificación no encontrados, skipping sistema bidireccional');
      return;
    }
    
    this.configurarEventListeners();
    this.actualizarUI(); // Estado inicial
    
    console.log('✅ Sistema bidireccional configurado correctamente');
  }
  
  configurarEventListeners() {
    // Listener para entrega inmediata
    this.elementos.entregaInmediata.addEventListener('change', () => {
      if (this.elementos.entregaInmediata.checked) {
        console.log('🚀 MODO: Entrega inmediata ACTIVADA');
        // Forzar "No notificar"
        this.elementos.noNotificar.checked = true;
        this.elementos.notificarAuto.checked = false;
      } else {
        console.log('📋 MODO: Entrega inmediata DESACTIVADA');
        // Restaurar a "Notificar automáticamente"
        this.elementos.notificarAuto.checked = true;
        this.elementos.noNotificar.checked = false;
      }
      this.actualizarUI();
    });
    
    // Listener para "Notificar automáticamente" 
    this.elementos.notificarAuto.addEventListener('change', () => {
      if (this.elementos.notificarAuto.checked) {
        console.log('🔔 MODO: Notificar automáticamente - desmarcando entrega inmediata');
        // Desmarcar entrega inmediata si estaba marcada
        if (this.elementos.entregaInmediata.checked) {
          this.elementos.entregaInmediata.checked = false;
        }
        this.actualizarUI();
      }
    });
    
    // Listener para "No notificar"
    this.elementos.noNotificar.addEventListener('change', () => {
      if (this.elementos.noNotificar.checked) {
        console.log('🔕 MODO: No notificar seleccionado');
        // Desmarcar entrega inmediata si estaba marcada (para permitir razón manual)
        if (this.elementos.entregaInmediata.checked) {
          this.elementos.entregaInmediata.checked = false;
          console.log('🔕 → ⚡ Entrega inmediata desactivada (razón manual)');
        }
        this.actualizarUI();
      }
    });
  }
  
  actualizarUI() {
    const { entregaInmediata, notificarAuto, noNotificar, razonGroup, infoBox } = this.elementos;
    
    if (entregaInmediata.checked) {
      // MODO: Entrega inmediata
      notificarAuto.disabled = true;
      noNotificar.disabled = true;
      if (infoBox) infoBox.style.display = 'block';
      if (razonGroup) razonGroup.style.display = 'none';
    } else {
      // MODO: Notificaciones normales
      notificarAuto.disabled = false;
      noNotificar.disabled = false;
      if (infoBox) infoBox.style.display = 'none';
      
      // Mostrar/ocultar razón según selección
      if (razonGroup) {
        razonGroup.style.display = noNotificar.checked ? 'block' : 'none';
      }
    }
  }
}

// ============== INICIALIZACIÓN ==============

document.addEventListener('DOMContentLoaded', function() {
  console.log('📄 Inicializando documento detalle unificado...');
  
  // Crear instancia global
  window.documentoDetalle = new DocumentoDetalleUnificado();
  
  // Inicializar sistema de notificaciones bidireccional
  window.sistemaNotificaciones = new SistemaNotificacionesBidireccional();
  
  console.log('✅ Sistema de documento detalle unificado listo');
}); 