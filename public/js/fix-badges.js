/**
 * 🔧 CORRECCIÓN AUTOMÁTICA DE BADGES ENTREGADO - Sistema Optimizado
 * 
 * Este script corrige automáticamente el problema visual de badges muy pequeños
 * aplicando estilos de ancho mínimo y padding adecuado
 */

(function() {
  'use strict';
  
  console.log('🔧 Iniciando corrección automática de badges ENTREGADO...');
  
  // ✅ CONFIGURACIÓN OPTIMIZADA
  const ESTILOS_OPTIMIZADOS = {
    minWidth: '80px',
    maxWidth: '85px', 
    fontSize: '0.7rem',
    padding: '0.3rem 0.5rem',
    fontWeight: '500',
    lineHeight: '1.2',
    whiteSpace: 'nowrap',
    textAlign: 'center',
    borderRadius: '0.375rem'
  };
  
  // Palabras clave que indican badges problemáticos
  const PALABRAS_CLAVE = [
    'entregado',
    'pagado completo',
    'con retención', 
    'nota crédito',
    'listo para entrega',
    'en proceso'
  ];
  
  /**
   * Función principal para corregir badges
   */
  function corregirBadgesEntregado() {
    const badges = document.querySelectorAll('.badge, [class*="badge"]');
    let badgesCorregidos = 0;
    
    badges.forEach(badge => {
      const texto = badge.textContent.trim().toLowerCase();
      
      // Verificar si el badge contiene alguna palabra clave
      const necesitaCorreccion = PALABRAS_CLAVE.some(palabra => 
        texto.includes(palabra)
      );
      
      if (necesitaCorreccion) {
        // Aplicar estilos optimizados con !important
        Object.entries(ESTILOS_OPTIMIZADOS).forEach(([propiedad, valor]) => {
          const propiedadCSS = propiedad.replace(/([A-Z])/g, '-$1').toLowerCase();
          badge.style.setProperty(propiedadCSS, valor, 'important');
        });
        
        // Agregar clase específica para identificación
        badge.classList.add('badge-optimizado-automatico');
        
        badgesCorregidos++;
        console.log(`✅ Badge corregido: "${texto}" -> ${ESTILOS_OPTIMIZADOS.minWidth}`);
      }
    });
    
    if (badgesCorregidos > 0) {
      console.log(`🎯 Se corrigieron ${badgesCorregidos} badges automáticamente`);
    }
    
    return badgesCorregidos;
  }
  
  /**
   * Función para corregir badges específicos por selector - CORREGIDA
   */
  function corregirBadgesEspecificos() {
    // ✅ SELECTORES VÁLIDOS SIN :contains()
    const selectoresEspecificos = [
      '.badge-estado-largo',
      '.badge[class*="estado-largo"]',
      'span.badge.bg-primary',
      'span.badge.bg-success', 
      '.table .badge'
    ];
    
    selectoresEspecificos.forEach(selector => {
      try {
        const elementos = document.querySelectorAll(selector);
        elementos.forEach(elemento => {
          // Verificar contenido específico manualmente
          const texto = elemento.textContent.trim().toLowerCase();
          if (texto.includes('entregado') || texto.includes('pagado') || texto.includes('retención')) {
            Object.entries(ESTILOS_OPTIMIZADOS).forEach(([propiedad, valor]) => {
              const propiedadCSS = propiedad.replace(/([A-Z])/g, '-$1').toLowerCase();
              elemento.style.setProperty(propiedadCSS, valor, 'important');
            });
          }
        });
      } catch (error) {
        console.warn('⚠️ Error aplicando selector:', selector, error);
      }
    });
  }
  
  /**
   * Función para inyectar CSS adicional como respaldo
   */
  function inyectarCSSRespaldo() {
    const cssId = 'badge-correction-css';
    
    // Evitar duplicar el CSS
    if (document.getElementById(cssId)) {
      return;
    }
    
    const css = `
      <style id="${cssId}">
        /* 🔧 CORRECCIÓN AUTOMÁTICA DE BADGES - MÁXIMA PRIORIDAD */
        
        .badge-estado-largo,
        .badge[class*="estado-largo"],
        .badge-optimizado-automatico {
          min-width: 80px !important;
          max-width: 85px !important;
          font-size: 0.7rem !important;
          padding: 0.3rem 0.5rem !important;
          font-weight: 500 !important;
          line-height: 1.2 !important;
          white-space: nowrap !important;
          text-align: center !important;
          border-radius: 0.375rem !important;
        }
        
        /* Corrección específica para tablas */
        .table .badge-estado-largo,
        .tabla-ordenable .badge-estado-largo,
        table .badge[class*="estado-largo"] {
          min-width: 80px !important;
          font-size: 0.7rem !important;
          padding: 0.3rem 0.5rem !important;
        }
        
        /* Corrección para badges con texto específico */
        .badge:is([class*="primary"], [class*="success"], [class*="info"], [class*="warning"]) {
          min-width: 75px !important;
          font-size: 0.7rem !important;
          padding: 0.3rem 0.5rem !important;
        }
      </style>
    `;
    
    document.head.insertAdjacentHTML('beforeend', css);
    console.log('💉 CSS de respaldo inyectado');
  }
  
  /**
   * Configurar observador de mutaciones para contenido dinámico
   */
  function configurarObservador() {
    const observer = new MutationObserver(function(mutations) {
      let necesitaCorreccion = false;
      
      mutations.forEach(function(mutation) {
        if (mutation.type === 'childList') {
          // Verificar si se agregaron nuevos nodos con badges
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) { // Element node
              const badges = node.querySelectorAll ? node.querySelectorAll('.badge, [class*="badge"]') : [];
              if (badges.length > 0) {
                necesitaCorreccion = true;
              }
            }
          });
        }
      });
      
      if (necesitaCorreccion) {
        setTimeout(() => {
          corregirBadgesEntregado();
          corregirBadgesEspecificos();
        }, 100);
      }
    });
    
    // Observar cambios en todo el documento
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    console.log('👀 Observador de mutaciones configurado');
    return observer;
  }
  
  /**
   * Función de inicialización
   */
  function inicializar() {
    console.log('🚀 Iniciando corrección de badges...');
    
    // 1. Inyectar CSS de respaldo
    inyectarCSSRespaldo();
    
    // 2. Corregir badges existentes
    const corregidos = corregirBadgesEntregado();
    corregirBadgesEspecificos();
    
    // 3. Configurar observador para contenido dinámico
    configurarObservador();
    
    // 4. Re-ejecutar corrección cada 2 segundos como respaldo
    setInterval(() => {
      corregirBadgesEntregado();
    }, 2000);
    
    console.log(`✅ Corrección de badges completada. ${corregidos} badges corregidos inicialmente.`);
  }
  
  /**
   * Auto-inicializar cuando el DOM esté listo
   */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }
  
  // Exponer función globalmente para uso manual
  window.corregirBadgesEntregado = corregirBadgesEntregado;
  
})(); 