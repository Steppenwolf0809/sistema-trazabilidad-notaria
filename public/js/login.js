/**
 * ========================================
 * PRONOTARY - SISTEMA DE GESTIÓN NOTARIAL
 * JavaScript para Login Moderno - Notaría 18
 * Dra. Glenda Elizabeth Zapata Silva
 * ========================================
 */

// Configuración global del módulo de login
const LoginModule = {
  // Elementos del DOM
  elements: {
    form: null,
    emailInput: null,
    passwordInput: null,
    passwordToggle: null,
    rememberCheckbox: null,
    submitButton: null,
    alertContainer: null
  },
  
  // Estado del formulario
  state: {
    isSubmitting: false,
    validationErrors: {},
    showPassword: false
  },
  
  // Configuración de validación
  validation: {
    email: {
      required: true,
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      message: 'Por favor, ingrese un email válido'
    },
    password: {
      required: true,
      minLength: 3,
      message: 'La contraseña debe tener al menos 3 caracteres'
    }
  }
};

/**
 * Inicialización del módulo cuando el DOM esté listo
 */
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 ProNotary Login - Inicializando interfaz moderna...');
  
  // Inicializar el módulo de login
  LoginModule.init();
  
  // Configurar animaciones de entrada
  setupEntryAnimations();
  
  // Configurar efectos visuales adicionales
  setupVisualEffects();
  
  console.log('✅ ProNotary Login - Interfaz inicializada correctamente');
});

/**
 * Inicialización principal del módulo de login
 */
LoginModule.init = function() {
  // Obtener referencias a elementos del DOM
  this.cacheElements();
  
  // Configurar event listeners
  this.bindEvents();
  
  // Configurar validación en tiempo real
  this.setupValidation();
  
  // Configurar funcionalidad de mostrar/ocultar contraseña
  this.setupPasswordToggle();
  
  // Configurar autofocus
  this.setupAutofocus();
  
  // Restaurar estado del checkbox "Recordarme"
  this.restoreRememberMe();
};

/**
 * Cachear elementos del DOM para mejor performance
 */
LoginModule.cacheElements = function() {
  this.elements.form = document.getElementById('loginForm');
  this.elements.emailInput = document.getElementById('email');
  this.elements.passwordInput = document.getElementById('password');
  this.elements.passwordToggle = document.getElementById('passwordToggle');
  this.elements.rememberCheckbox = document.getElementById('rememberMe');
  this.elements.submitButton = document.getElementById('submitButton');
  this.elements.alertContainer = document.getElementById('alertContainer');
  
  // Verificar que los elementos críticos existan
  if (!this.elements.form || !this.elements.emailInput || !this.elements.passwordInput) {
    console.error('❌ Error: No se encontraron elementos críticos del formulario');
    return false;
  }
  
  return true;
};

/**
 * Configurar event listeners
 */
LoginModule.bindEvents = function() {
  // Evento de envío del formulario
  if (this.elements.form) {
    this.elements.form.addEventListener('submit', (e) => this.handleSubmit(e));
  }
  
  // Eventos de validación en tiempo real
  if (this.elements.emailInput) {
    this.elements.emailInput.addEventListener('blur', () => this.validateField('email'));
    this.elements.emailInput.addEventListener('input', () => this.clearFieldError('email'));
  }
  
  if (this.elements.passwordInput) {
    this.elements.passwordInput.addEventListener('blur', () => this.validateField('password'));
    this.elements.passwordInput.addEventListener('input', () => this.clearFieldError('password'));
  }
  
  // Evento para el botón de mostrar/ocultar contraseña
  if (this.elements.passwordToggle) {
    this.elements.passwordToggle.addEventListener('click', () => this.togglePassword());
  }
  
  // Evento para el checkbox "Recordarme"
  if (this.elements.rememberCheckbox) {
    this.elements.rememberCheckbox.addEventListener('change', () => this.saveRememberMe());
  }
  
  // Navegación por teclado mejorada
  document.addEventListener('keydown', (e) => this.handleKeyboardNavigation(e));
};

/**
 * Configurar validación en tiempo real
 */
LoginModule.setupValidation = function() {
  // Agregar clases CSS para estados de validación
  const inputs = [this.elements.emailInput, this.elements.passwordInput];
  
  inputs.forEach(input => {
    if (input) {
      // Efectos visuales en focus
      input.addEventListener('focus', function() {
        this.parentElement.classList.add('focused');
      });
      
      input.addEventListener('blur', function() {
        this.parentElement.classList.remove('focused');
      });
    }
  });
};

/**
 * Configurar funcionalidad de mostrar/ocultar contraseña
 */
LoginModule.setupPasswordToggle = function() {
  if (!this.elements.passwordToggle || !this.elements.passwordInput) return;
  
  // Configurar icono inicial
  this.updatePasswordToggleIcon();
};

/**
 * Configurar autofocus en el campo email
 */
LoginModule.setupAutofocus = function() {
  if (this.elements.emailInput) {
    // Pequeño delay para que las animaciones se completen
    setTimeout(() => {
      this.elements.emailInput.focus();
    }, 500);
  }
};

/**
 * Restaurar estado del checkbox "Recordarme"
 */
LoginModule.restoreRememberMe = function() {
  if (!this.elements.rememberCheckbox) return;
  
  const remembered = localStorage.getItem('pronotary_remember_me');
  if (remembered === 'true') {
    this.elements.rememberCheckbox.checked = true;
    
    // Si hay email guardado, restaurarlo
    const savedEmail = localStorage.getItem('pronotary_saved_email');
    if (savedEmail && this.elements.emailInput) {
      this.elements.emailInput.value = savedEmail;
    }
  }
};

/**
 * Guardar estado del checkbox "Recordarme"
 */
LoginModule.saveRememberMe = function() {
  if (!this.elements.rememberCheckbox) return;
  
  const isChecked = this.elements.rememberCheckbox.checked;
  localStorage.setItem('pronotary_remember_me', isChecked.toString());
  
  if (isChecked && this.elements.emailInput.value) {
    localStorage.setItem('pronotary_saved_email', this.elements.emailInput.value);
  } else {
    localStorage.removeItem('pronotary_saved_email');
  }
};

/**
 * Manejar envío del formulario
 */
LoginModule.handleSubmit = function(event) {
  // NO prevenir el envío del formulario - permitir envío tradicional
  // event.preventDefault(); // COMENTADO para permitir envío normal
  
  // Prevenir envíos múltiples
  if (this.state.isSubmitting) {
    event.preventDefault();
    return false;
  }
  
  console.log('📝 Validando formulario antes del envío...');
  
  // Validar todos los campos
  const isValid = this.validateAllFields();
  
  if (!isValid) {
    // Solo prevenir envío si hay errores de validación
    event.preventDefault();
    this.showAlert('Por favor, corrija los errores antes de continuar', 'error');
    return false;
  }
  
  // Guardar email si "Recordarme" está marcado
  this.saveRememberMe();
  
  // Mostrar estado de carga (visual)
  this.setLoadingState(true);
  
  // Permitir que el formulario se envíe de manera tradicional
  console.log('✅ Formulario válido - enviando de manera tradicional...');
  
  // El formulario se enviará automáticamente al servidor
  return true;
};

/**
 * Validar todos los campos del formulario
 */
LoginModule.validateAllFields = function() {
  let isValid = true;
  
  // Limpiar errores previos
  this.state.validationErrors = {};
  
  // Validar email
  if (!this.validateField('email')) {
    isValid = false;
  }
  
  // Validar contraseña
  if (!this.validateField('password')) {
    isValid = false;
  }
  
  return isValid;
};

/**
 * Validar un campo específico
 */
LoginModule.validateField = function(fieldName) {
  const field = this.elements[fieldName + 'Input'];
  const validation = this.validation[fieldName];
  
  if (!field || !validation) return true;
  
  const value = field.value.trim();
  let isValid = true;
  let errorMessage = '';
  
  // Validar campo requerido
  if (validation.required && !value) {
    isValid = false;
    errorMessage = `El campo ${fieldName === 'email' ? 'email' : 'contraseña'} es requerido`;
  }
  
  // Validar patrón de email
  if (fieldName === 'email' && value && validation.pattern && !validation.pattern.test(value)) {
    isValid = false;
    errorMessage = validation.message;
  }
  
  // Validar longitud mínima
  if (validation.minLength && value && value.length < validation.minLength) {
    isValid = false;
    errorMessage = validation.message;
  }
  
  // Mostrar/ocultar error
  if (!isValid) {
    this.showFieldError(fieldName, errorMessage);
    this.state.validationErrors[fieldName] = errorMessage;
  } else {
    this.clearFieldError(fieldName);
    delete this.state.validationErrors[fieldName];
  }
  
  return isValid;
};

/**
 * Mostrar error en un campo específico
 */
LoginModule.showFieldError = function(fieldName, message) {
  const field = this.elements[fieldName + 'Input'];
  if (!field) return;
  
  // Agregar clase de error al campo
  field.classList.add('error');
  field.parentElement.classList.add('has-error');
  
  // Buscar o crear elemento de mensaje de error
  let errorElement = field.parentElement.querySelector('.error-message');
  if (!errorElement) {
    errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    field.parentElement.appendChild(errorElement);
  }
  
  errorElement.textContent = message;
  errorElement.style.display = 'block';
  
  // Animación de shake para el campo
  field.style.animation = 'shake 0.5s ease-in-out';
  setTimeout(() => {
    field.style.animation = '';
  }, 500);
};

/**
 * Limpiar error de un campo específico
 */
LoginModule.clearFieldError = function(fieldName) {
  const field = this.elements[fieldName + 'Input'];
  if (!field) return;
  
  // Remover clases de error
  field.classList.remove('error');
  field.parentElement.classList.remove('has-error');
  
  // Ocultar mensaje de error
  const errorElement = field.parentElement.querySelector('.error-message');
  if (errorElement) {
    errorElement.style.display = 'none';
  }
};

/**
 * Alternar visibilidad de la contraseña
 */
LoginModule.togglePassword = function() {
  if (!this.elements.passwordInput || !this.elements.passwordToggle) return;
  
  this.state.showPassword = !this.state.showPassword;
  
  // Cambiar tipo de input
  this.elements.passwordInput.type = this.state.showPassword ? 'text' : 'password';
  
  // Actualizar icono
  this.updatePasswordToggleIcon();
  
  // Mantener focus en el campo
  this.elements.passwordInput.focus();
};

/**
 * Actualizar icono del botón de mostrar/ocultar contraseña
 */
LoginModule.updatePasswordToggleIcon = function() {
  if (!this.elements.passwordToggle) return;
  
  const icon = this.elements.passwordToggle.querySelector('i');
  if (icon) {
    icon.className = this.state.showPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
  }
};

/**
 * Establecer estado de carga
 */
LoginModule.setLoadingState = function(isLoading) {
  this.state.isSubmitting = isLoading;
  
  if (!this.elements.submitButton) return;
  
  if (isLoading) {
    this.elements.submitButton.disabled = true;
    this.elements.submitButton.classList.add('loading');
    this.elements.submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Iniciando sesión...';
  } else {
    this.elements.submitButton.disabled = false;
    this.elements.submitButton.classList.remove('loading');
    this.elements.submitButton.innerHTML = '<i class="fas fa-sign-in-alt"></i> Iniciar Sesión';
  }
};

/**
 * Mostrar alerta al usuario
 */
LoginModule.showAlert = function(message, type = 'info') {
  // Crear elemento de alerta
  const alertElement = document.createElement('div');
  alertElement.className = `alert-custom alert-${type === 'error' ? 'danger' : type}`;
  
  // Agregar icono según el tipo
  const icon = type === 'error' ? 'fas fa-exclamation-triangle' : 
               type === 'success' ? 'fas fa-check-circle' : 
               'fas fa-info-circle';
  
  alertElement.innerHTML = `
    <i class="${icon}"></i>
    <span>${message}</span>
  `;
  
  // Insertar en el contenedor de alertas o al inicio del formulario
  const container = this.elements.alertContainer || this.elements.form;
  if (container) {
    // Remover alertas previas
    const existingAlerts = container.querySelectorAll('.alert-custom');
    existingAlerts.forEach(alert => alert.remove());
    
    // Insertar nueva alerta
    container.insertBefore(alertElement, container.firstChild);
    
    // Auto-remover después de 5 segundos
    setTimeout(() => {
      if (alertElement.parentNode) {
        alertElement.remove();
      }
    }, 5000);
  }
};

/**
 * Manejar navegación por teclado
 */
LoginModule.handleKeyboardNavigation = function(event) {
  // Enter en cualquier campo envía el formulario
  if (event.key === 'Enter' && event.target.matches('input')) {
    event.preventDefault();
    this.handleSubmit(event);
  }
  
  // Escape limpia errores
  if (event.key === 'Escape') {
    this.clearAllErrors();
  }
};

/**
 * Limpiar todos los errores de validación
 */
LoginModule.clearAllErrors = function() {
  this.clearFieldError('email');
  this.clearFieldError('password');
  
  // Remover alertas
  const alerts = document.querySelectorAll('.alert-custom');
  alerts.forEach(alert => alert.remove());
};

/**
 * ========================================
 * FUNCIONES DE ANIMACIONES Y EFECTOS
 * ========================================
 */

/**
 * Configurar animaciones de entrada
 */
function setupEntryAnimations() {
  // Observador de intersección para animaciones scroll-triggered
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-in');
      }
    });
  }, observerOptions);
  
  // Observar elementos animables
  const animatableElements = document.querySelectorAll('.form-group, .form-header');
  animatableElements.forEach(el => observer.observe(el));
}

/**
 * Configurar efectos visuales adicionales
 */
function setupVisualEffects() {
  // Efecto parallax sutil en el fondo del branding
  const brandingSection = document.querySelector('.login-branding');
  if (brandingSection) {
    window.addEventListener('scroll', () => {
      const scrolled = window.pageYOffset;
      const rate = scrolled * -0.5;
      brandingSection.style.transform = `translateY(${rate}px)`;
    });
  }
  
  // Efecto de partículas flotantes decorativas
  createFloatingParticles();
  
  // Configurar efectos de hover mejorados
  setupHoverEffects();
}

/**
 * Crear partículas flotantes decorativas
 */
function createFloatingParticles() {
  const brandingSection = document.querySelector('.login-branding');
  if (!brandingSection) return;
  
  // Crear contenedor de partículas
  const particlesContainer = document.createElement('div');
  particlesContainer.className = 'particles-container';
  particlesContainer.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 1;
  `;
  
  // Crear partículas
  for (let i = 0; i < 20; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.cssText = `
      position: absolute;
      width: 4px;
      height: 4px;
      background: rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      animation: float ${5 + Math.random() * 10}s ease-in-out infinite;
      animation-delay: ${Math.random() * 5}s;
      left: ${Math.random() * 100}%;
      top: ${Math.random() * 100}%;
    `;
    
    particlesContainer.appendChild(particle);
  }
  
  brandingSection.appendChild(particlesContainer);
}

/**
 * Configurar efectos de hover mejorados
 */
function setupHoverEffects() {
  // Efecto de elevación en campos de input
  const inputs = document.querySelectorAll('.form-input');
  inputs.forEach(input => {
    input.addEventListener('mouseenter', function() {
      this.style.transform = 'translateY(-1px)';
    });
    
    input.addEventListener('mouseleave', function() {
      if (!this.matches(':focus')) {
        this.style.transform = 'translateY(0)';
      }
    });
  });
  
  // Efecto de ondas en el botón de login
  const loginButton = document.querySelector('.btn-login');
  if (loginButton) {
    loginButton.addEventListener('click', function(e) {
      const ripple = document.createElement('span');
      const rect = this.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;
      
      ripple.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        left: ${x}px;
        top: ${y}px;
        background: rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        transform: scale(0);
        animation: ripple 0.6s ease-out;
        pointer-events: none;
      `;
      
      this.appendChild(ripple);
      
      setTimeout(() => {
        ripple.remove();
      }, 600);
    });
  }
}

/**
 * ========================================
 * UTILIDADES Y HELPERS
 * ========================================
 */

/**
 * Detectar si el dispositivo es móvil
 */
function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Detectar soporte para características modernas
 */
function supportsModernFeatures() {
  return 'IntersectionObserver' in window && 
         'fetch' in window && 
         'Promise' in window;
}

/**
 * Fallback para navegadores antiguos
 */
if (!supportsModernFeatures()) {
  console.warn('⚠️ Navegador con soporte limitado detectado. Algunas características pueden no funcionar correctamente.');
  
  // Polyfill básico para fetch si no está disponible
  if (!window.fetch) {
    window.fetch = function(url, options) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(options.method || 'GET', url);
        xhr.onload = () => resolve({
          ok: xhr.status >= 200 && xhr.status < 300,
          status: xhr.status,
          text: () => Promise.resolve(xhr.responseText)
        });
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send(options.body);
      });
    };
  }
}

/**
 * Agregar estilos CSS adicionales dinámicamente
 */
function addDynamicStyles() {
  const style = document.createElement('style');
  style.textContent = `
    /* Animación de shake para errores */
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-5px); }
      75% { transform: translateX(5px); }
    }
    
    /* Animación de ripple para botones */
    @keyframes ripple {
      to {
        transform: scale(2);
        opacity: 0;
      }
    }
    
    /* Estados de error para campos */
    .form-input.error {
      border-color: #dc3545 !important;
      box-shadow: 0 0 0 3px rgba(220, 53, 69, 0.1) !important;
    }
    
    .error-message {
      color: #dc3545;
      font-size: 0.8rem;
      margin-top: 0.25rem;
      display: none;
    }
    
    .has-error .input-icon {
      color: #dc3545 !important;
    }
    
    /* Mejoras de accesibilidad */
    .form-input:focus-visible {
      outline: 3px solid #FFC107;
      outline-offset: 2px;
    }
    
    /* Animaciones de entrada */
    .animate-in {
      animation: slideInUp 0.6s ease-out;
    }
    
    @keyframes slideInUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `;
  
  document.head.appendChild(style);
}

// Agregar estilos dinámicos al cargar
addDynamicStyles();

// Exportar módulo para uso global
window.ProNotaryLogin = LoginModule; 

/**
 * Enviar formulario al servidor (DESHABILITADO - Ahora se usa envío tradicional)
 * Esta función se mantiene comentada para referencia futura si se necesita AJAX
 */
/*
LoginModule.submitForm = function() {
  // Crear FormData con los datos del formulario
  const formData = new FormData(this.elements.form);
  
  // Enviar usando fetch API
  fetch(this.elements.form.action, {
    method: 'POST',
    body: formData,
    headers: {
      'X-Requested-With': 'XMLHttpRequest'
    }
  })
  .then(response => {
    if (response.redirected) {
      // Si hay redirección, seguirla
      window.location.href = response.url;
      return;
    }
    return response.text();
  })
  .then(data => {
    if (typeof data === 'string') {
      // Si recibimos HTML, probablemente hay un error
      // Buscar mensaje de error en la respuesta
      const parser = new DOMParser();
      const doc = parser.parseFromString(data, 'text/html');
      const errorAlert = doc.querySelector('.alert-danger');
      
      if (errorAlert) {
        const errorMessage = errorAlert.textContent.trim();
        this.showAlert(errorMessage, 'error');
      } else {
        this.showAlert('Error inesperado. Por favor, intente nuevamente.', 'error');
      }
    }
  })
  .catch(error => {
    console.error('❌ Error en login:', error);
    this.showAlert('Error de conexión. Por favor, verifique su conexión a internet.', 'error');
  })
  .finally(() => {
    this.setLoadingState(false);
  });
};
*/

/**
 */ 