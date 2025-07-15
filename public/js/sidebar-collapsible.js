/**
 * SIDEBAR COLAPSIBLE - JAVASCRIPT
 * Sistema de Notaría Digital
 */

class SidebarManager {
  constructor() {
    this.sidebar = null;
    this.mainContent = null;
    this.toggleBtn = null;
    this.overlay = null;
    this.isCollapsed = false;
    this.isMobile = false;
    this.storageKey = 'notaria_sidebar_collapsed';
    
    // Sistema de logging condicional para producción
    window.DEBUG_MODE = window.DEBUG_MODE || false;
    
    this.init();
  }

  init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  setup() {
    if (window.DEBUG_MODE) {
      console.log('🔧 Iniciando setup del sidebar...');
    }
    
    this.findElements();
    if (!this.sidebar) {
      console.error('❌ No se encontró el sidebar. Abortando inicialización.');
      return;
    }
    
    // Forzar creación del botón toggle
    this.forceCreateToggleButton();
    this.createOverlay();
    this.addTooltips();
    this.setupEventListeners();
    this.loadSavedState();
    this.updateToggleIcon(); // Asegurar que el ícono sea correcto
    this.handleResize();
    
    if (window.DEBUG_MODE) {
      console.log('✅ Sidebar colapsible inicializada correctamente');
    }
  }

  findElements() {
    this.sidebar = document.querySelector('.sidebar');
    this.mainContent = document.querySelector('.main-content');
    
    if (window.DEBUG_MODE) {
      console.log('🔍 Elementos encontrados:', {
        sidebar: !!this.sidebar,
        mainContent: !!this.mainContent
      });
    }
    
    if (!this.sidebar || !this.mainContent) {
      console.warn('⚠️ Elementos de sidebar no encontrados');
      return;
    }
  }

  /**
   * Fuerza la creación del botón toggle
   */
  forceCreateToggleButton() {
    console.log('🚀 Forzando creación del botón toggle...');
    
    // Eliminar cualquier botón existente primero
    const existingButtons = document.querySelectorAll('.sidebar-toggle');
    existingButtons.forEach(btn => btn.remove());
    
    this.toggleBtn = this.createToggleButton();
    
    // Verificación adicional después de la creación
    setTimeout(() => {
      const finalBtn = document.querySelector('.sidebar-toggle');
      if (finalBtn) {
        console.log('✅ Botón toggle creado exitosamente');
        console.log('Posición final:', {
          top: finalBtn.style.top,
          right: finalBtn.style.right,
          display: window.getComputedStyle(finalBtn).display,
          visibility: window.getComputedStyle(finalBtn).visibility
        });
      } else {
        console.error('❌ Error: Botón toggle no se creó correctamente');
      }
    }, 100);
  }

  /**
   * Crea el botón toggle para colapsar/expandir el sidebar
   */
  createToggleButton() {
    console.log('🔧 Verificando botón toggle...');
    
    // Verificar si ya existe en el HTML
    const existingButton = document.querySelector('.sidebar-toggle');
    if (existingButton) {
      console.log('✅ Botón toggle encontrado en HTML');
      // Asegurar que sea visible
      existingButton.style.display = 'flex';
      existingButton.style.visibility = 'visible';
      existingButton.style.opacity = '1';
      return existingButton;
    }
    
    // Crear el botón
    const toggleButton = document.createElement('button');
    toggleButton.className = 'sidebar-toggle';
    toggleButton.innerHTML = '<i class="fas fa-chevron-left"></i>';
    toggleButton.setAttribute('aria-label', 'Contraer sidebar');
    toggleButton.setAttribute('title', 'Contraer menú');
    
    // Estilos inline para forzar visibilidad
    toggleButton.style.cssText = `
      position: absolute !important;
      top: 20px !important;
      right: -35px !important;
      width: 36px !important;
      height: 36px !important;
      background: #4f46e5 !important;
      border: 2px solid white !important;
      border-radius: 8px !important;
      color: white !important;
      cursor: pointer !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-size: 16px !important;
      transition: all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1) !important;
      box-shadow: 0 2px 8px rgba(79, 70, 229, 0.3) !important;
      z-index: 1001 !important;
      outline: none !important;
      visibility: visible !important;
      opacity: 1 !important;
      pointer-events: auto !important;
    `;
    
    // Agregar al sidebar
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      sidebar.appendChild(toggleButton);
      console.log('✅ Botón toggle creado y agregado al sidebar');
      
      // Verificar que esté visible
      setTimeout(() => {
        const computedStyle = window.getComputedStyle(toggleButton);
        console.log('🔍 Estilos del botón:', {
          display: computedStyle.display,
          visibility: computedStyle.visibility,
          opacity: computedStyle.opacity,
          position: computedStyle.position,
          zIndex: computedStyle.zIndex
        });
      }, 100);
      
      return toggleButton;
    } else {
      console.error('❌ No se encontró el sidebar para agregar el botón');
      return null;
    }
  }

  createOverlay() {
    this.overlay = document.querySelector('.sidebar-overlay');
    
    if (!this.overlay) {
      console.log('🔧 Creando overlay para móvil...');
      
      this.overlay = document.createElement('div');
      this.overlay.className = 'sidebar-overlay';
      document.body.appendChild(this.overlay);
      
      console.log('✅ Overlay creado');
    }
  }

  addTooltips() {
    if (!this.sidebar) return;
    
    const navLinks = this.sidebar.querySelectorAll('.nav-link');
    console.log(`🏷️ Agregando tooltips a ${navLinks.length} enlaces`);
    
    navLinks.forEach(link => {
      const textElement = link.querySelector('.nav-text') || link.childNodes[1];
      if (textElement && textElement.textContent) {
        const tooltipText = textElement.textContent.trim();
        link.setAttribute('data-tooltip', tooltipText);
      }
    });
  }

  setupEventListeners() {
    console.log('🎧 Configurando event listeners...');
    
    // Toggle button click
    if (this.toggleBtn) {
      this.toggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('🖱️ Click en botón toggle');
        this.toggle();
      });
      console.log('✅ Event listener del botón toggle configurado');
    } else {
      console.error('❌ No se pudo configurar event listener: botón toggle no encontrado');
    }

    // Overlay click (móvil)
    if (this.overlay) {
      this.overlay.addEventListener('click', () => {
        console.log('🖱️ Click en overlay');
        this.closeMobile();
      });
    }

    // Resize window
    window.addEventListener('resize', () => {
      this.handleResize();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + B para toggle
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        console.log('⌨️ Atajo de teclado Ctrl+B');
        this.toggle();
      }
      
      // Escape para cerrar en móvil
      if (e.key === 'Escape' && this.isMobile) {
        this.closeMobile();
      }
    });
    
    console.log('✅ Todos los event listeners configurados');
  }

  handleResize() {
    const wasMobile = this.isMobile;
    this.isMobile = window.innerWidth <= 768;
    
    if (wasMobile !== this.isMobile) {
      if (window.DEBUG_MODE) {
        console.log(`📱 Cambio de modo: ${this.isMobile ? 'móvil' : 'desktop'}`);
      }
      
      if (this.isMobile) {
        this.setupMobile();
      } else {
        this.setupDesktop();
      }
    }
    
    // Auto-collapse en tablet
    if (window.innerWidth <= 1024 && window.innerWidth > 768) {
      if (!this.isCollapsed) {
        this.collapse(false);
      }
    }
  }

  setupMobile() {
    if (!this.sidebar || !this.mainContent) return;
    
    if (window.DEBUG_MODE) {
      console.log('📱 Configurando modo móvil');
    }
    
    this.sidebar.classList.remove('collapsed');
    this.sidebar.classList.remove('mobile-active');
    this.mainContent.classList.remove('sidebar-collapsed');
    this.overlay.classList.remove('active');
  }

  setupDesktop() {
    if (!this.sidebar || !this.mainContent) return;
    
    if (window.DEBUG_MODE) {
      console.log('🖥️ Configurando modo desktop');
    }
    
    this.sidebar.classList.remove('mobile-active');
    this.overlay.classList.remove('active');
    
    // Restaurar estado guardado
    this.loadSavedState();
  }

  toggle() {
    console.log(`🔄 Toggle sidebar (modo: ${this.isMobile ? 'móvil' : 'desktop'})`);
    
    if (this.isMobile) {
      this.toggleMobile();
    } else {
      this.toggleDesktop();
    }
  }

  toggleMobile() {
    if (!this.sidebar || !this.overlay) return;
    
    const isActive = this.sidebar.classList.contains('mobile-active');
    console.log(`📱 Toggle móvil: ${isActive ? 'cerrar' : 'abrir'}`);
    
    if (isActive) {
      this.closeMobile();
    } else {
      this.openMobile();
    }
  }

  openMobile() {
    if (!this.sidebar || !this.overlay) return;
    
    console.log('📱 Abriendo sidebar móvil');
    
    this.sidebar.classList.add('mobile-active');
    this.overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  closeMobile() {
    if (!this.sidebar || !this.overlay) return;
    
    console.log('📱 Cerrando sidebar móvil');
    
    this.sidebar.classList.remove('mobile-active');
    this.overlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  toggleDesktop() {
    console.log(`🖥️ Toggle desktop (estado actual: ${this.isCollapsed ? 'colapsado' : 'expandido'})`);
    
    if (this.isCollapsed) {
      this.expand();
    } else {
      this.collapse();
    }
  }

  collapse(saveState = true) {
    if (!this.sidebar || !this.mainContent) return;
    
    console.log('📏 Colapsando sidebar');
    
    this.isCollapsed = true;
    this.sidebar.classList.add('collapsed');
    this.mainContent.classList.add('sidebar-collapsed');
    
    // Actualizar ícono del botón - Mejorado para forzar el cambio
    if (this.toggleBtn) {
      const icon = this.toggleBtn.querySelector('i');
      if (icon) {
        // Forzar el cambio de ícono
        icon.className = 'fas fa-chevron-right';
        icon.setAttribute('class', 'fas fa-chevron-right');
        console.log('🔄 Ícono cambiado a chevron-right (expandir)');
      }
      this.toggleBtn.setAttribute('title', 'Expandir menú');
      this.toggleBtn.setAttribute('aria-label', 'Expandir sidebar');
    }
    
    if (saveState) {
      this.saveState();
    }
    
    // Trigger resize event para otros componentes
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 300);
  }

  expand(saveState = true) {
    if (!this.sidebar || !this.mainContent) return;
    
    console.log('📏 Expandiendo sidebar');
    
    this.isCollapsed = false;
    this.sidebar.classList.remove('collapsed');
    this.mainContent.classList.remove('sidebar-collapsed');
    
    // Actualizar ícono del botón - Mejorado para forzar el cambio
    if (this.toggleBtn) {
      const icon = this.toggleBtn.querySelector('i');
      if (icon) {
        // Forzar el cambio de ícono
        icon.className = 'fas fa-chevron-left';
        icon.setAttribute('class', 'fas fa-chevron-left');
        console.log('🔄 Ícono cambiado a chevron-left (colapsar)');
      }
      this.toggleBtn.setAttribute('title', 'Contraer menú');
      this.toggleBtn.setAttribute('aria-label', 'Contraer sidebar');
    }
    
    if (saveState) {
      this.saveState();
    }
    
    // Trigger resize event para otros componentes
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 300);
  }

  saveState() {
    try {
      const state = {
        collapsed: this.isCollapsed,
        timestamp: Date.now()
      };
      localStorage.setItem(this.storageKey, JSON.stringify(state));
      console.log(`💾 Estado guardado: ${this.isCollapsed ? 'colapsado' : 'expandido'}`);
    } catch (e) {
      console.warn('⚠️ No se pudo guardar el estado del sidebar');
    }
  }

  loadSavedState() {
    if (this.isMobile) return;
    
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const state = JSON.parse(saved);
        
        // Verificar que el estado no sea muy antiguo (7 días)
        const isOld = Date.now() - state.timestamp > 7 * 24 * 60 * 60 * 1000;
        
        if (!isOld && typeof state.collapsed === 'boolean') {
          console.log(`📂 Cargando estado guardado: ${state.collapsed ? 'colapsado' : 'expandido'}`);
          
          if (state.collapsed) {
            this.collapse(false);
          } else {
            this.expand(false);
          }
        }
      }
    } catch (e) {
      console.warn('⚠️ No se pudo cargar el estado guardado del sidebar');
    }
  }

  /**
   * Actualiza el ícono del botón toggle según el estado actual
   */
  updateToggleIcon() {
    if (!this.toggleBtn) return;
    
    const icon = this.toggleBtn.querySelector('i');
    if (!icon) return;
    
    if (this.isCollapsed) {
      // Colapsado -> mostrar flecha hacia la derecha (expandir)
      icon.className = 'fas fa-chevron-right';
      icon.setAttribute('class', 'fas fa-chevron-right');
      this.toggleBtn.setAttribute('title', 'Expandir menú');
      this.toggleBtn.setAttribute('aria-label', 'Expandir sidebar');
      console.log('🔄 Ícono actualizado: chevron-right (expandir)');
    } else {
      // Expandido -> mostrar flecha hacia la izquierda (colapsar)
      icon.className = 'fas fa-chevron-left';
      icon.setAttribute('class', 'fas fa-chevron-left');
      this.toggleBtn.setAttribute('title', 'Contraer menú');
      this.toggleBtn.setAttribute('aria-label', 'Contraer sidebar');
      console.log('🔄 Ícono actualizado: chevron-left (colapsar)');
    }
  }

  getState() {
    return {
      isCollapsed: this.isCollapsed,
      isMobile: this.isMobile,
      hasToggleButton: !!this.toggleBtn
    };
  }
}

// Instancia global
let sidebarManager = null;

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 DOM cargado, inicializando SidebarManager...');
  sidebarManager = new SidebarManager();
  
  // Hacer disponible globalmente para debug
  window.sidebarManager = sidebarManager;
  
  // Debug info
  setTimeout(() => {
    if (sidebarManager) {
      console.log('🔍 Estado del sidebar:', sidebarManager.getState());
    }
  }, 1000);
});

// API global para otros scripts
window.SidebarAPI = {
  toggle: () => sidebarManager?.toggle(),
  collapse: () => sidebarManager?.collapse(),
  expand: () => sidebarManager?.expand(),
  getState: () => sidebarManager?.getState()
};
