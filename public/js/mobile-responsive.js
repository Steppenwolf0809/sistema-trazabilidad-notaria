/**
 * PRONOTARY MOBILE RESPONSIVE SYSTEM
 * JavaScript para funcionalidad mobile-first responsive
 */

(function() {
  'use strict';

  // ===================================================
  // VARIABLES GLOBALES Y CONFIGURACIÓN
  // ===================================================
  
  let isMobile = window.innerWidth < 992;
  let sidebarOpen = false;
  let startX = null;
  let currentX = null;
  let isDragging = false;
  
  // Referencias DOM (se inicializan en DOMContentLoaded)
  let hamburgerBtn = null;
  let sidebar = null;
  let backdrop = null;
  let mainContent = null;
  let navbar = null;
  let collapseBtn = null;
  
  // Configuración
  const CONFIG = {
    breakpointLg: 992,
    swipeThreshold: 50,
    swipeMinDistance: 100,
    animationDuration: 300,
    backdropClass: 'mobile-backdrop',
    hamburgerClass: 'hamburger-menu',
    sidebarOpenClass: 'mobile-open',
    backdropActiveClass: 'active'
  };

  // ===================================================
  // INICIALIZACIÓN DEL SISTEMA
  // ===================================================
  
  document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 ProNotary Mobile System: Inicializando...');
    
    initializeElements();
    createMobileElements();
    bindEvents();
    handleResize();
    
    console.log('✅ ProNotary Mobile System: Listo');
  });

  // ===================================================
  // INICIALIZACIÓN DE ELEMENTOS DOM
  // ===================================================
  
  function initializeElements() {
    // Elementos existentes - buscar múltiples selectores
    sidebar = document.getElementById('sidebar') || 
              document.querySelector('.sidebar') || 
              document.querySelector('.sidebar-argon');
    
    mainContent = document.getElementById('mainContent') || 
                  document.querySelector('.main-content') ||
                  document.querySelector('main');
    
    navbar = document.getElementById('header') || 
             document.querySelector('.navbar') ||
             document.querySelector('.topbar');
    
    collapseBtn = document.getElementById('collapseBtn') || 
                  document.querySelector('.collapse-btn') ||
                  document.querySelector('.sidebar-toggle');
    
    if (!sidebar) {
      console.warn('⚠️ Sidebar no encontrado. Sistema responsive deshabilitado.');
      return;
    }
    
    // Agregar ID y clases necesarias si no existen
    if (!sidebar.id) {
      sidebar.id = 'sidebar';
    }
    
    // Asegurar que tiene la clase sidebar para nuestro CSS
    if (!sidebar.classList.contains('sidebar')) {
      sidebar.classList.add('sidebar');
    }
    
    console.log('✅ Elementos DOM inicializados:', {
      sidebar: sidebar?.tagName,
      mainContent: mainContent?.tagName,
      navbar: navbar?.tagName,
      collapseBtn: collapseBtn?.tagName
    });
  }

  // ===================================================
  // CREACIÓN DE ELEMENTOS MÓVILES
  // ===================================================
  
  function createMobileElements() {
    createHamburgerButton();
    createMobileBackdrop();
  }
  
  function createHamburgerButton() {
    // Verificar si ya existe
    hamburgerBtn = document.querySelector(`.${CONFIG.hamburgerClass}`);
    
    if (!hamburgerBtn) {
      hamburgerBtn = document.createElement('button');
      hamburgerBtn.className = CONFIG.hamburgerClass;
      hamburgerBtn.innerHTML = '<i class="fas fa-bars"></i>';
      hamburgerBtn.setAttribute('aria-label', 'Abrir menú de navegación');
      hamburgerBtn.setAttribute('type', 'button');
      
      document.body.appendChild(hamburgerBtn);
      console.log('✅ Hamburger button creado');
    }
  }
  
  function createMobileBackdrop() {
    // Verificar si ya existe
    backdrop = document.querySelector(`.${CONFIG.backdropClass}`);
    
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = CONFIG.backdropClass;
      backdrop.setAttribute('aria-hidden', 'true');
      
      document.body.appendChild(backdrop);
      console.log('✅ Mobile backdrop creado');
    }
  }

  // ===================================================
  // EVENT LISTENERS Y BINDINGS
  // ===================================================
  
  function bindEvents() {
    // Hamburger button
    if (hamburgerBtn) {
      hamburgerBtn.addEventListener('click', toggleMobileSidebar);
      hamburgerBtn.addEventListener('touchstart', handleTouchStart, { passive: true });
    }
    
    // Backdrop
    if (backdrop) {
      backdrop.addEventListener('click', closeMobileSidebar);
    }
    
    // Sidebar touch gestures
    if (sidebar) {
      sidebar.addEventListener('touchstart', handleTouchStart, { passive: true });
      sidebar.addEventListener('touchmove', handleTouchMove, { passive: false });
      sidebar.addEventListener('touchend', handleTouchEnd, { passive: true });
    }
    
    // Window events
    window.addEventListener('resize', debounce(handleResize, 250));
    window.addEventListener('orientationchange', handleOrientationChange);
    
    // Desktop collapse button
    if (collapseBtn) {
      collapseBtn.addEventListener('click', toggleDesktopSidebar);
    }
    
    // ESC key support
    document.addEventListener('keydown', handleKeyDown);
    
    console.log('✅ Event listeners configurados');
  }

  // ===================================================
  // FUNCIONALIDAD SIDEBAR MÓVIL
  // ===================================================
  
  function toggleMobileSidebar() {
    if (!isMobile) return;
    
    sidebarOpen = !sidebarOpen;
    updateMobileSidebar();
    
    // Analytics/logging
    console.log(`📱 Sidebar ${sidebarOpen ? 'abierto' : 'cerrado'}`);
  }
  
  function openMobileSidebar() {
    if (!isMobile) return;
    
    sidebarOpen = true;
    updateMobileSidebar();
  }
  
  function closeMobileSidebar() {
    if (!isMobile) return;
    
    sidebarOpen = false;
    updateMobileSidebar();
  }
  
  function updateMobileSidebar() {
    if (!sidebar || !backdrop || !hamburgerBtn) return;
    
    if (sidebarOpen) {
      sidebar.classList.add(CONFIG.sidebarOpenClass);
      backdrop.classList.add(CONFIG.backdropActiveClass);
      hamburgerBtn.innerHTML = '<i class="fas fa-times"></i>';
      hamburgerBtn.setAttribute('aria-label', 'Cerrar menú de navegación');
      
      // Prevenir scroll del body
      document.body.style.overflow = 'hidden';
      
      // Focus management
      sidebar.setAttribute('aria-hidden', 'false');
      backdrop.setAttribute('aria-hidden', 'false');
      
    } else {
      sidebar.classList.remove(CONFIG.sidebarOpenClass);
      backdrop.classList.remove(CONFIG.backdropActiveClass);
      hamburgerBtn.innerHTML = '<i class="fas fa-bars"></i>';
      hamburgerBtn.setAttribute('aria-label', 'Abrir menú de navegación');
      
      // Restaurar scroll del body
      document.body.style.overflow = '';
      
      // Focus management
      sidebar.setAttribute('aria-hidden', 'true');
      backdrop.setAttribute('aria-hidden', 'true');
    }
  }

  // ===================================================
  // FUNCIONALIDAD SIDEBAR DESKTOP
  // ===================================================
  
  function toggleDesktopSidebar() {
    if (isMobile) return;
    
    const isCollapsed = sidebar.classList.contains('collapsed');
    
    if (isCollapsed) {
      sidebar.classList.remove('collapsed');
      if (mainContent) mainContent.classList.remove('expanded');
      if (navbar) navbar.classList.remove('expanded');
      
      // Cambiar icono
      if (collapseBtn) {
        collapseBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
      }
    } else {
      sidebar.classList.add('collapsed');
      if (mainContent) mainContent.classList.add('expanded');
      if (navbar) navbar.classList.add('expanded');
      
      // Cambiar icono
      if (collapseBtn) {
        collapseBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
      }
    }
    
    console.log(`💻 Desktop sidebar ${isCollapsed ? 'expandido' : 'colapsado'}`);
  }

  // ===================================================
  // TOUCH GESTURES Y SWIPE
  // ===================================================
  
  function handleTouchStart(e) {
    if (!isMobile) return;
    
    startX = e.touches[0].clientX;
    currentX = startX;
    isDragging = true;
  }
  
  function handleTouchMove(e) {
    if (!isMobile || !isDragging || !startX) return;
    
    currentX = e.touches[0].clientX;
    const deltaX = currentX - startX;
    
    // Solo permitir swipe desde el borde izquierdo para abrir
    // o desde la sidebar para cerrar
    if (startX < CONFIG.swipeThreshold && deltaX > 0) {
      // Swipe right desde borde izquierdo - abrir sidebar
      e.preventDefault();
      
      if (!sidebarOpen && deltaX > CONFIG.swipeMinDistance) {
        openMobileSidebar();
        isDragging = false;
      }
    } else if (sidebarOpen && deltaX < -CONFIG.swipeMinDistance) {
      // Swipe left en sidebar abierta - cerrar sidebar
      e.preventDefault();
      closeMobileSidebar();
      isDragging = false;
    }
  }
  
  function handleTouchEnd(e) {
    isDragging = false;
    startX = null;
    currentX = null;
  }

  // ===================================================
  // MANEJO DE RESIZE Y ORIENTACIÓN
  // ===================================================
  
  function handleResize() {
    const wasIsMobile = isMobile;
    isMobile = window.innerWidth < CONFIG.breakpointLg;
    
    // Si cambió de móvil a desktop o viceversa
    if (wasIsMobile !== isMobile) {
      console.log(`📱➡️💻 Cambio de modo: ${isMobile ? 'Mobile' : 'Desktop'}`);
      
      if (isMobile) {
        // Cambió a móvil
        closeMobileSidebar();
        showMobileElements();
      } else {
        // Cambió a desktop
        closeMobileSidebar();
        hideMobileElements();
        document.body.style.overflow = '';
      }
    }
    
    updateLayout();
  }
  
  function handleOrientationChange() {
    // Delay para permitir que el viewport se ajuste
    setTimeout(() => {
      handleResize();
      
      // En landscape móvil, cerrar sidebar automáticamente
      if (isMobile && window.innerHeight < 600) {
        closeMobileSidebar();
      }
    }, 500);
  }
  
  function showMobileElements() {
    if (hamburgerBtn) hamburgerBtn.style.display = 'flex';
    if (backdrop) backdrop.style.display = 'block';
  }
  
  function hideMobileElements() {
    if (hamburgerBtn) hamburgerBtn.style.display = 'none';
    if (backdrop) backdrop.style.display = 'none';
  }
  
  function updateLayout() {
    // Ajustes específicos basados en el tamaño de pantalla
    if (isMobile) {
      // Modo móvil
      if (sidebar) {
        sidebar.style.position = 'fixed';
        sidebar.style.transform = sidebarOpen ? 'translateX(0)' : 'translateX(-100%)';
      }
      
      if (mainContent) {
        mainContent.style.marginLeft = '0';
      }
      
      if (navbar) {
        navbar.style.left = '0';
        navbar.style.paddingLeft = 'calc(var(--touch-target-comfortable) + 2rem)';
      }
    } else {
      // Modo desktop
      if (sidebar) {
        sidebar.style.position = 'fixed';
        sidebar.style.transform = 'translateX(0)';
      }
      
      const isCollapsed = sidebar && sidebar.classList.contains('collapsed');
      const sidebarWidth = isCollapsed ? 'var(--sidebar-width-collapsed)' : 'var(--sidebar-width-desktop)';
      
      if (mainContent) {
        mainContent.style.marginLeft = sidebarWidth;
      }
      
      if (navbar) {
        navbar.style.left = sidebarWidth;
        navbar.style.paddingLeft = '2rem';
      }
    }
  }

  // ===================================================
  // KEYBOARD NAVIGATION
  // ===================================================
  
  function handleKeyDown(e) {
    // ESC para cerrar sidebar móvil
    if (e.key === 'Escape' && isMobile && sidebarOpen) {
      closeMobileSidebar();
      hamburgerBtn?.focus();
    }
    
    // Navegación con Tab trap en sidebar móvil
    if (isMobile && sidebarOpen && e.key === 'Tab') {
      trapFocusInSidebar(e);
    }
  }
  
  function trapFocusInSidebar(e) {
    if (!sidebar) return;
    
    const focusableElements = sidebar.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab normal
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  }

  // ===================================================
  // UTILIDADES
  // ===================================================
  
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // ===================================================
  // API PÚBLICA
  // ===================================================
  
  // Exponer funciones útiles globalmente
  window.ProNotaryMobile = {
    toggleSidebar: toggleMobileSidebar,
    openSidebar: openMobileSidebar,
    closeSidebar: closeMobileSidebar,
    isMobile: () => isMobile,
    isOpen: () => sidebarOpen,
    
    // Para debugging
    debug: {
      CONFIG,
      elements: {
        hamburgerBtn,
        sidebar,
        backdrop,
        mainContent,
        navbar
      }
    }
  };

  // ===================================================
  // INTEGRATION CON SISTEMAS EXISTENTES
  // ===================================================
  
  // Asegurar compatibilidad con funciones existentes
  if (typeof window.cerrarSesion === 'function') {
    const originalCerrarSesion = window.cerrarSesion;
    window.cerrarSesion = function() {
      // Cerrar sidebar antes de logout
      closeMobileSidebar();
      return originalCerrarSesion.apply(this, arguments);
    };
  }

})();

// ===================================================
// POLYFILLS Y COMPATIBILIDAD
// ===================================================

// Polyfill para Element.closest() en navegadores antiguos
if (!Element.prototype.closest) {
  Element.prototype.closest = function(s) {
    var el = this;
    do {
      if (el.matches(s)) return el;
      el = el.parentElement || el.parentNode;
    } while (el !== null && el.nodeType === 1);
    return null;
  };
}

// Polyfill para Element.matches() en navegadores antiguos
if (!Element.prototype.matches) {
  Element.prototype.matches = Element.prototype.msMatchesSelector || 
                              Element.prototype.webkitMatchesSelector;
}

console.log('🚀 ProNotary Mobile Responsive System loaded'); 