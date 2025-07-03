/**
 * SISTEMA DE SIDEBAR COLAPSABLE ARGON PRO
 * Funcionalidad completa para menu lateral responsive
 * Compatible con todos los layouts del sistema
 */

class SidebarArgon {
  constructor() {
    this.sidebar = document.querySelector('.sidebar-argon');
    this.toggleBtn = document.querySelector('.sidebar-toggle');
    this.overlay = document.querySelector('.sidebar-overlay');
    this.body = document.body;
    
    // Estados del sidebar
    this.isCollapsed = this.getStoredState();
    this.isMobile = window.innerWidth < 768;
    
    this.init();
  }

  init() {
    if (!this.sidebar) return;
    
    // Configurar estado inicial
    this.setInitialState();
    
    // Event listeners
    this.bindEvents();
    
    // Configurar responsive
    this.handleResize();
    
    console.log('🎨 Sidebar Argon Pro iniciado correctamente');
  }

  setInitialState() {
    // En mobile siempre empezar colapsado
    if (this.isMobile) {
      this.collapse(false); // Sin animación en inicio
    } else {
      // En desktop usar estado guardado
      if (this.isCollapsed) {
        this.collapse(false);
      } else {
        this.expand(false);
      }
    }
  }

  bindEvents() {
    // Toggle button
    if (this.toggleBtn) {
      this.toggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggle();
      });
    }

    // Overlay (solo mobile)
    if (this.overlay) {
      this.overlay.addEventListener('click', () => {
        if (this.isMobile) {
          this.collapse();
        }
      });
    }

    // Responsive handling
    window.addEventListener('resize', () => {
      this.handleResize();
    });

    // Escape key (cerrar en mobile)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isMobile && !this.isCollapsed) {
        this.collapse();
      }
    });

    // Menu items hover (solo cuando colapsado)
    this.setupTooltips();
  }

  toggle() {
    if (this.isCollapsed) {
      this.expand();
    } else {
      this.collapse();
    }
    
    // Actualizar ícono del botón
    this.updateToggleIcon();
  }
  
  updateToggleIcon() {
    const icon = this.toggleBtn?.querySelector('.toggle-icon');
    if (icon) {
      icon.innerHTML = this.isCollapsed ? '&raquo;' : '&laquo;';
    }
  }

  expand(animate = true) {
    this.isCollapsed = false;
    
    // Clases CSS
    this.sidebar?.classList.remove('collapsed');
    this.body.classList.remove('sidebar-collapsed');
    
    // Ajustar contenido principal
    const mainContent = document.querySelector('main, .main-content');
    if (mainContent && !this.isMobile) {
      mainContent.style.marginLeft = 'var(--sidebar-width)';
    }
    
    // En mobile agregar overlay
    if (this.isMobile) {
      this.body.classList.add('sidebar-open');
      if (this.overlay) {
        this.overlay.classList.add('active');
      }
    }
    
    // Guardar estado (solo desktop)
    if (!this.isMobile) {
      this.saveState(false);
    }
    
    // Animación suave
    if (animate) {
      this.sidebar?.style.setProperty('--transition-duration', '0.3s');
      setTimeout(() => {
        this.sidebar?.style.removeProperty('--transition-duration');
      }, 300);
    }
    
    // Actualizar ícono
    this.updateToggleIcon();

    console.log('📖 Sidebar expandido');
  }

  collapse(animate = true) {
    this.isCollapsed = true;
    
    // Clases CSS
    this.sidebar?.classList.add('collapsed');
    this.body.classList.add('sidebar-collapsed');
    
    // Ajustar contenido principal
    const mainContent = document.querySelector('main, .main-content');
    if (mainContent && !this.isMobile) {
      mainContent.style.marginLeft = 'var(--sidebar-collapsed-width)';
    }
    
    // En mobile remover overlay
    if (this.isMobile) {
      this.body.classList.remove('sidebar-open');
      if (this.overlay) {
        this.overlay.classList.remove('active');
      }
    }
    
    // Guardar estado (solo desktop)
    if (!this.isMobile) {
      this.saveState(true);
    }
    
    // Animación suave
    if (animate) {
      this.sidebar?.style.setProperty('--transition-duration', '0.3s');
      setTimeout(() => {
        this.sidebar?.style.removeProperty('--transition-duration');
      }, 300);
    }
    
    // Actualizar ícono
    this.updateToggleIcon();

    console.log('📚 Sidebar colapsado');
  }

  handleResize() {
    const wasMobile = this.isMobile;
    this.isMobile = window.innerWidth < 768;
    
    // Si cambió de mobile/desktop
    if (wasMobile !== this.isMobile) {
      if (this.isMobile) {
        // Cambió a mobile: colapsar siempre
        this.collapse(false);
        this.body.classList.remove('sidebar-open');
      } else {
        // Cambió a desktop: usar estado guardado
        this.body.classList.remove('sidebar-open');
        if (this.overlay) {
          this.overlay.classList.remove('active');
        }
        
        const storedState = this.getStoredState();
        if (storedState) {
          this.collapse(false);
        } else {
          this.expand(false);
        }
      }
    }
  }

  setupTooltips() {
    const menuItems = this.sidebar?.querySelectorAll('.nav-link[data-tooltip]');
    
    menuItems?.forEach(item => {
      // Tooltip hover
      item.addEventListener('mouseenter', (e) => {
        if (this.isCollapsed && !this.isMobile) {
          this.showTooltip(e.target);
        }
      });
      
      item.addEventListener('mouseleave', () => {
        this.hideTooltip();
      });
    });
  }

  showTooltip(element) {
    const tooltip = element.getAttribute('data-tooltip');
    if (!tooltip) return;
    
    // Crear tooltip element
    const tooltipEl = document.createElement('div');
    tooltipEl.className = 'sidebar-tooltip';
    tooltipEl.textContent = tooltip;
    tooltipEl.id = 'sidebar-tooltip';
    
    // Posicionar
    const rect = element.getBoundingClientRect();
    tooltipEl.style.cssText = `
      position: fixed;
      left: ${rect.right + 10}px;
      top: ${rect.top + (rect.height / 2)}px;
      transform: translateY(-50%);
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      white-space: nowrap;
      z-index: 9999;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s ease;
    `;
    
    document.body.appendChild(tooltipEl);
    
    // Mostrar con animación
    requestAnimationFrame(() => {
      tooltipEl.style.opacity = '1';
    });
  }

  hideTooltip() {
    const tooltip = document.getElementById('sidebar-tooltip');
    if (tooltip) {
      tooltip.style.opacity = '0';
      setTimeout(() => tooltip.remove(), 200);
    }
  }

  // Persistencia del estado
  saveState(collapsed) {
    try {
      localStorage.setItem('sidebar-argon-collapsed', collapsed.toString());
    } catch (e) {
      console.warn('No se pudo guardar estado del sidebar');
    }
  }

  getStoredState() {
    try {
      const stored = localStorage.getItem('sidebar-argon-collapsed');
      return stored === 'true';
    } catch (e) {
      return false; // Por defecto expandido
    }
  }
}

// Auto-inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  window.sidebarArgon = new SidebarArgon();
});

// API global para control externo
window.SidebarArgonAPI = {
  toggle: () => window.sidebarArgon?.toggle(),
  expand: () => window.sidebarArgon?.expand(),
  collapse: () => window.sidebarArgon?.collapse(),
  isCollapsed: () => window.sidebarArgon?.isCollapsed || false
}; 