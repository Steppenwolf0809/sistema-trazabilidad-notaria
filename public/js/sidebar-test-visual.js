// SCRIPT DE PRUEBA VISUAL DEL SIDEBAR
// Este script creará un panel de debugging visible en la página

console.log('🔧 INICIANDO PRUEBA VISUAL DEL SIDEBAR');

function crearPanelDebugging() {
    // Crear panel flotante de debugging
    const panel = document.createElement('div');
    panel.id = 'sidebar-debug-panel';
    panel.style.cssText = `
        position: fixed !important;
        top: 10px !important;
        left: 10px !important;
        width: 400px !important;
        max-height: 500px !important;
        background: #1e293b !important;
        color: white !important;
        padding: 15px !important;
        border-radius: 8px !important;
        font-family: monospace !important;
        font-size: 12px !important;
        z-index: 9999 !important;
        overflow-y: auto !important;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3) !important;
        border: 2px solid #4f46e5 !important;
    `;
    
    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h4 style="margin: 0; color: #4f46e5;">🔍 SIDEBAR DEBUG</h4>
            <button onclick="this.parentElement.parentElement.remove()" style="background: #dc2626; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">✕</button>
        </div>
        <div id="debug-content">Iniciando diagnóstico...</div>
    `;
    
    document.body.appendChild(panel);
    return panel;
}

function diagnosticarSidebar() {
    const panel = document.getElementById('sidebar-debug-panel');
    const content = document.getElementById('debug-content');
    
    let diagnostico = [];
    
    // 1. Verificar elementos del DOM
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    const appContainer = document.querySelector('.app-container');
    const toggleBtn = document.querySelector('.sidebar-toggle');
    
    diagnostico.push(`<div style="color: #10b981; font-weight: bold;">📋 ELEMENTOS DOM:</div>`);
    diagnostico.push(`Sidebar: ${sidebar ? '✅' : '❌'}`);
    diagnostico.push(`Main Content: ${mainContent ? '✅' : '❌'}`);
    diagnostico.push(`App Container: ${appContainer ? '✅' : '❌'}`);
    diagnostico.push(`Toggle Button: ${toggleBtn ? '✅' : '❌'}`);
    
    // 2. Verificar estilos CSS
    if (sidebar) {
        const sidebarStyles = window.getComputedStyle(sidebar);
        diagnostico.push(`<div style="color: #f59e0b; font-weight: bold; margin-top: 10px;">🎨 ESTILOS SIDEBAR:</div>`);
        diagnostico.push(`Position: ${sidebarStyles.position}`);
        diagnostico.push(`Width: ${sidebarStyles.width}`);
        diagnostico.push(`Left: ${sidebarStyles.left}`);
        diagnostico.push(`Z-index: ${sidebarStyles.zIndex}`);
    }
    
    if (mainContent) {
        const mainStyles = window.getComputedStyle(mainContent);
        diagnostico.push(`<div style="color: #8b5cf6; font-weight: bold; margin-top: 10px;">📄 ESTILOS MAIN:</div>`);
        diagnostico.push(`Display: ${mainStyles.display}`);
        diagnostico.push(`Width: ${mainStyles.width}`);
        diagnostico.push(`Max-width: ${mainStyles.maxWidth}`);
        diagnostico.push(`Margin-left: ${mainStyles.marginLeft}`);
        diagnostico.push(`Flex: ${mainStyles.flex}`);
    }
    
    if (appContainer) {
        const containerStyles = window.getComputedStyle(appContainer);
        diagnostico.push(`<div style="color: #06b6d4; font-weight: bold; margin-top: 10px;">📦 ESTILOS CONTAINER:</div>`);
        diagnostico.push(`Display: ${containerStyles.display}`);
        diagnostico.push(`Width: ${containerStyles.width}`);
        diagnostico.push(`Max-width: ${containerStyles.maxWidth}`);
        diagnostico.push(`Overflow-x: ${containerStyles.overflowX}`);
    }
    
    // 3. Verificar viewport y scroll
    diagnostico.push(`<div style="color: #ef4444; font-weight: bold; margin-top: 10px;">📱 VIEWPORT:</div>`);
    diagnostico.push(`Window width: ${window.innerWidth}px`);
    diagnostico.push(`Document width: ${document.documentElement.scrollWidth}px`);
    diagnostico.push(`Scroll horizontal: ${document.documentElement.scrollLeft}px`);
    
    // 4. Verificar JavaScript
    diagnostico.push(`<div style="color: #84cc16; font-weight: bold; margin-top: 10px;">⚙️ JAVASCRIPT:</div>`);
    diagnostico.push(`SidebarManager: ${typeof SidebarManager !== 'undefined' ? '✅' : '❌'}`);
    diagnostico.push(`window.sidebarManager: ${window.sidebarManager ? '✅' : '❌'}`);
    
    // 5. Probar acciones
    diagnostico.push(`<div style="color: #f97316; font-weight: bold; margin-top: 10px;">🧪 ACCIONES:</div>`);
    
    // Botones de prueba
    diagnostico.push(`
        <div style="margin-top: 10px;">
            <button onclick="probarToggle()" style="background: #4f46e5; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin-right: 5px;">
                Toggle
            </button>
            <button onclick="forzarCrearBoton()" style="background: #059669; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin-right: 5px;">
                Crear Botón
            </button>
            <button onclick="rediagnosticar()" style="background: #dc2626; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">
                Re-diagnosticar
            </button>
        </div>
    `);
    
    content.innerHTML = diagnostico.join('<br>');
}

function probarToggle() {
    console.log('🧪 Probando toggle del sidebar...');
    if (window.sidebarManager) {
        window.sidebarManager.toggle();
        console.log('✅ Toggle ejecutado');
    } else if (window.SidebarAPI) {
        window.SidebarAPI.toggle();
        console.log('✅ Toggle API ejecutado');
    } else {
        console.error('❌ No se encontró función de toggle');
    }
    setTimeout(rediagnosticar, 500);
}

function forzarCrearBoton() {
    console.log('🔧 Forzando creación del botón toggle...');
    
    // Eliminar botones existentes
    document.querySelectorAll('.sidebar-toggle').forEach(btn => btn.remove());
    
    // Crear botón manualmente
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        const toggleButton = document.createElement('button');
        toggleButton.className = 'sidebar-toggle';
        toggleButton.innerHTML = '<i class="fas fa-chevron-left"></i>';
        toggleButton.style.cssText = `
            position: absolute !important;
            top: 20px !important;
            right: -40px !important;
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
            z-index: 1001 !important;
            visibility: visible !important;
            opacity: 1 !important;
        `;
        
        toggleButton.addEventListener('click', function() {
            probarToggle();
        });
        
        sidebar.appendChild(toggleButton);
        console.log('✅ Botón creado manualmente');
    }
    
    setTimeout(rediagnosticar, 500);
}

function rediagnosticar() {
    diagnosticarSidebar();
}

// Hacer funciones globales
window.probarToggle = probarToggle;
window.forzarCrearBoton = forzarCrearBoton;
window.rediagnosticar = rediagnosticar;

// Ejecutar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM cargado, iniciando diagnóstico visual...');
    setTimeout(() => {
        crearPanelDebugging();
        diagnosticarSidebar();
    }, 1000);
});

// Si el DOM ya está cargado
if (document.readyState === 'loading') {
    // Ya tenemos el event listener arriba
} else {
    setTimeout(() => {
        crearPanelDebugging();
        diagnosticarSidebar();
    }, 1000);
} 