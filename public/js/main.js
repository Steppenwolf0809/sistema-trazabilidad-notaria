/**
 * JavaScript principal para el Sistema de Trazabilidad Documental
 * Contiene funciones para interactuar con la API y gestionar la interfaz de usuario
 */

// Cuando el documento este listo
document.addEventListener('DOMContentLoaded', function() {
  // Sistema de logging condicional
  window.DEBUG_MODE = window.DEBUG_MODE || false;
  
  if (window.DEBUG_MODE) {
    console.log('Sistema de Trazabilidad Documental - Frontend cargado');
  }
  
  // Actualizar ano en el pie de pagina
  actualizarAnioPiePagina();
  
  // Inicializar formulario de verificacion
  inicializarFormularioVerificacion();
  
  // Inicializar ordenamiento de tablas
  if (window.DEBUG_MODE) {
    console.log('Llamando a inicializarOrdenamientoTablas...');
  }
  setTimeout(() => {
    inicializarOrdenamientoTablas();
  }, 100);
});

/**
 * Actualiza el ano en el pie de pagina
 */
function actualizarAnioPiePagina() {
  // Buscar todas las instancias de currentYear y reemplazarlas con el ano actual
  const currentYearElements = document.querySelectorAll('.current-year');
  const currentYear = new Date().getFullYear();
  
  currentYearElements.forEach(element => {
    element.textContent = currentYear;
  });
}

/**
 * Inicializa el formulario de verificacion de documentos
 */
function inicializarFormularioVerificacion() {
  const form = document.getElementById('verificar-form');
  
  if (form) {
    form.addEventListener('submit', function(event) {
      event.preventDefault();
      
      const codigoBarras = document.getElementById('codigo-barras').value.trim();
      
      if (!codigoBarras) {
        mostrarAlerta('Por favor, ingrese un codigo de barras', 'danger');
        return;
      }
      
      verificarDocumento(codigoBarras);
    });
  }
}

/**
 * Verifica un documento mediante su codigo de barras
 * @param {string} codigoBarras - Codigo de barras del documento
 */
function verificarDocumento(codigoBarras) {
  // Mostrar indicador de carga
  mostrarAlerta('Verificando documento...', 'info');
  
  // Hacer la peticion a la API
  fetch(`/api/documentos/buscar/codigo/${codigoBarras}`)
    .then(response => {
      if (!response.ok) {
        throw new Error('Documento no encontrado');
      }
      return response.json();
    })
    .then(data => {
      if (data.exito) {
        // Redirigir a la pagina de detalles del documento
        window.location.href = `/documentos/detalle/${data.datos.id}`;
      } else {
        mostrarAlerta(data.mensaje, 'warning');
      }
    })
    .catch(error => {
      mostrarAlerta(error.message, 'danger');
    });
}

/**
 * Muestra una alerta en la pagina
 * @param {string} mensaje - Mensaje a mostrar
 * @param {string} tipo - Tipo de alerta (success, danger, warning, info)
 */
function mostrarAlerta(mensaje, tipo = 'info') {
  // Crear elemento de alerta
  const alertaDiv = document.createElement('div');
  alertaDiv.className = `alert alert-${tipo} alert-dismissible fade show`;
  alertaDiv.setAttribute('role', 'alert');
  
  // Agregar contenido de la alerta
  alertaDiv.innerHTML = `
    ${mensaje}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Cerrar"></button>
  `;
  
  // Buscar contenedor para alertas, o crear uno si no existe
  let alertasContainer = document.getElementById('alertas-container');
  
  if (!alertasContainer) {
    alertasContainer = document.createElement('div');
    alertasContainer.id = 'alertas-container';
    alertasContainer.className = 'container mt-3';
    
    // Insertar al principio del contenedor principal
    const mainContainer = document.querySelector('main.container');
    if (mainContainer) {
      mainContainer.insertBefore(alertasContainer, mainContainer.firstChild);
    } else {
      document.body.insertBefore(alertasContainer, document.body.firstChild);
    }
  }
  
  // Agregar alerta al contenedor
  alertasContainer.appendChild(alertaDiv);
  
  // Eliminar la alerta despues de 5 segundos
  setTimeout(() => {
    alertaDiv.remove();
  }, 5000);
}

/**
 * SISTEMA DE ORDENAMIENTO DE TABLAS UNIVERSAL CORREGIDO
 * Version 2.0 - Soluciona problemas de CSS hover y ordenamiento bidireccional
 * 
 * PROBLEMAS CORREGIDOS:
 * - Headers no se ponen blancos en hover
 * - Ordenamiento bidireccional funcional
 * - Iconos claros que indican direccion
 * - Compatible con todos los roles
 * - Manejo de errores robusto
 */

// Estado global del ordenamiento mejorado
let estadoOrdenamientoGlobal = {
  columnaActual: null,
  direccionActual: 'asc',
  tablaActual: null,
  configuracion: {
    debug: true,
    animaciones: true,
    persistirEstado: true
  }
};

/**
 * INICIALIZACION PRINCIPAL DEL SISTEMA
 * Funcion principal que configura todas las tablas ordenables
 */
function inicializarOrdenamientoTablas() {
  if (window.DEBUG_MODE) {
    console.log('ORDENAMIENTO v2.0 Inicializando sistema corregido...');
  }
  
  try {
    // Inyectar CSS corregido primero
    inyectarEstilosCorregidos();
    
    // Buscar y configurar todas las tablas ordenables
    const tablasOrdenables = document.querySelectorAll('.tabla-ordenable');
    
    if (tablasOrdenables.length === 0) {
      if (window.DEBUG_MODE) {
        console.log('ORDENAMIENTO No se encontraron tablas ordenables en esta pagina');
      }
      return;
    }
    
    // Configurar cada tabla
    let tablasConfiguradas = 0;
    tablasOrdenables.forEach((tabla, index) => {
      try {
        configurarTablaOrdenableV2(tabla, index);
        tablasConfiguradas++;
      } catch (error) {
        console.error(`ORDENAMIENTO Error configurando tabla ${index}:`, error);
      }
    });
    
    if (window.DEBUG_MODE) {
      console.log(`ORDENAMIENTO Sistema configurado exitosamente para ${tablasConfiguradas}/${tablasOrdenables.length} tabla(s)`);
    }
    
    // Restaurar estado si existe
    restaurarEstadoOrdenamiento();
    
  } catch (error) {
    console.error('ORDENAMIENTO Error critico en inicializacion:', error);
  }
}

/**
 * INYECCION DE CSS CORREGIDO
 * Inyecta estilos que solucionan los problemas de hover blanco
 */
function inyectarEstilosCorregidos() {
  console.log('ORDENAMIENTO Inyectando CSS corregido...');
  
  // Verificar si ya existe
  if (document.getElementById('ordenamiento-css-corregido')) {
    return;
  }
  
  const estilosCorregidos = `
    <style id="ordenamiento-css-corregido">
      /* CORRECCION CRITICA: Estilos de hover para headers ordenables */
      
      /* Estilos base para headers ordenables */
      .tabla-ordenable th.ordenable {
        cursor: pointer !important;
        user-select: none !important;
        position: relative !important;
        transition: all 0.2s ease !important;
        border-bottom: 2px solid transparent !important;
      }
      
      /* CORRECCION PRINCIPAL: Hover apropiado segun el tema */
      
      /* Para tablas con fondo claro (table-light) */
      .table-light .tabla-ordenable th.ordenable:hover,
      .table:not(.table-dark) .tabla-ordenable th.ordenable:hover {
        background-color: rgba(0, 0, 0, 0.05) !important;
        color: #495057 !important;
        border-bottom-color: #007bff !important;
      }
      
      /* Para tablas con fondo oscuro (table-dark) */
      .table-dark .tabla-ordenable th.ordenable:hover {
        background-color: rgba(255, 255, 255, 0.1) !important;
        color: #ffffff !important;
        border-bottom-color: #ffc107 !important;
      }
      
      /* Estados activos */
      .tabla-ordenable th.ordenable.activo {
        font-weight: 600 !important;
      }
      
      .table-light .tabla-ordenable th.ordenable.activo {
        background-color: #e3f2fd !important;
        color: #1976d2 !important;
        border-bottom-color: #1976d2 !important;
      }
      
      .table-dark .tabla-ordenable th.ordenable.activo {
        background-color: rgba(255, 193, 7, 0.2) !important;
        color: #ffc107 !important;
        border-bottom-color: #ffc107 !important;
      }
      
      /* ICONOS DE ORDENAMIENTO MEJORADOS */
      .ordenamiento-icono {
        margin-left: 0.5rem !important;
        font-size: 0.8em !important;
        transition: all 0.2s ease !important;
        display: inline-block !important;
      }
      
      .ordenamiento-icono.neutro {
        opacity: 0.4 !important;
        color: currentColor !important;
      }
      
      .ordenamiento-icono.activo {
        opacity: 1 !important;
        transform: scale(1.1) !important;
      }
      
      .table-light .ordenamiento-icono.activo {
        color: #1976d2 !important;
      }
      
      .table-dark .ordenamiento-icono.activo {
        color: #ffc107 !important;
      }
      
      /* Animaciones suaves */
      .ordenamiento-icono.cambiando {
        animation: cambioOrden 0.3s ease-in-out !important;
      }
      
      @keyframes cambioOrden {
        0% { transform: scale(1); opacity: 0.4; }
        50% { transform: scale(1.2); opacity: 0.8; }
        100% { transform: scale(1.1); opacity: 1; }
      }
      
      /* CORRECCIONES ESPECIFICAS PARA PROBLEMAS IDENTIFICADOS */
      
      /* Sobrescribir estilos problematicos de vistas especificas */
      .tabla-ordenable th.ordenable:hover {
        background-color: unset !important;
      }
      
      /* Aplicar estilos correctos segun contexto */
      .table-light .tabla-ordenable th.ordenable:hover {
        background-color: rgba(0, 0, 0, 0.05) !important;
      }
      
      .table-dark .tabla-ordenable th.ordenable:hover {
        background-color: rgba(255, 255, 255, 0.1) !important;
      }
      
      /* Estados de carga */
      .tabla-ordenando {
        opacity: 0.7 !important;
        pointer-events: none !important;
      }
      
      .tabla-ordenando tbody {
        position: relative !important;
      }
      
      .tabla-ordenando tbody::after {
        content: "Ordenando..." !important;
        position: absolute !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        background: rgba(0, 0, 0, 0.8) !important;
        color: white !important;
        padding: 1rem 2rem !important;
        border-radius: 0.5rem !important;
        font-size: 0.9rem !important;
        z-index: 1000 !important;
      }
      
      /* Responsividad */
      @media (max-width: 768px) {
        .tabla-ordenable th.ordenable {
          font-size: 0.85rem !important;
          padding: 0.5rem 0.25rem !important;
        }
        
        .ordenamiento-icono {
          font-size: 0.7em !important;
          margin-left: 0.25rem !important;
        }
      }
    </style>
  `;
  
  document.head.insertAdjacentHTML('beforeend', estilosCorregidos);
  console.log('ORDENAMIENTO CSS corregido inyectado exitosamente');
}

  /**
   * CONFIGURACION DE TABLA INDIVIDUAL
   * Configura una tabla especifica para ordenamiento robusto
   */
function configurarTablaOrdenableV2(tabla, indice) {
  const tablaId = tabla.id || `tabla-ordenable-${indice}`;
  console.log(`ORDENAMIENTO Configurando tabla: ${tablaId}`);
  
  // Asignar ID si no tiene
  if (!tabla.id) {
    tabla.id = tablaId;
  }
  
  // Buscar headers ordenables
  const headers = tabla.querySelectorAll('th.ordenable');
  
  if (headers.length === 0) {
    console.warn(`ORDENAMIENTO No se encontraron headers ordenables en tabla ${tablaId}`);
    return;
  }
  
  // Configurar cada header
  headers.forEach((header, headerIndex) => {
    configurarHeaderOrdenable(header, tabla, headerIndex);
  });
  
  console.log(`ORDENAMIENTO Tabla ${tablaId} configurada con ${headers.length} columnas ordenables`);
}

  /**
   * CONFIGURACION DE HEADER INDIVIDUAL
   * Configura un header especifico para ordenamiento
   */
function configurarHeaderOrdenable(header, tabla, indice) {
  const columna = header.getAttribute('data-columna');
  const tipoColumna = header.getAttribute('data-tipo') || 'texto';
  
  if (!columna) {
    console.warn(`ORDENAMIENTO Header ${indice} sin atributo data-columna`);
    return;
  }
  
  // Limpiar eventos previos
  const nuevoHeader = header.cloneNode(true);
  header.parentNode.replaceChild(nuevoHeader, header);
  
  // Configurar estructura del header
  configurarEstructuraHeader(nuevoHeader, columna, tipoColumna);
  
  // Agregar evento de click
  nuevoHeader.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    manejarClickHeaderV2(this, tabla, columna, tipoColumna);
  });
  
  console.log(`ORDENAMIENTO Header configurado: ${columna} (${tipoColumna})`);
}

  /**
   * CONFIGURACION DE ESTRUCTURA DE HEADER
   * Asegura que el header tenga la estructura correcta
   */
function configurarEstructuraHeader(header, columna, tipoColumna) {
  // Buscar o crear el span del texto
  let spanTexto = header.querySelector('span');
  if (!spanTexto) {
    const textoActual = header.textContent.trim();
    header.innerHTML = `<span>${textoActual}</span>`;
    spanTexto = header.querySelector('span');
  }
  
  // Remover iconos existentes
  header.querySelectorAll('.ordenamiento-icono, .fa-sort, .fa-sort-up, .fa-sort-down').forEach(icono => {
    icono.remove();
  });
  
  // Agregar icono de ordenamiento
  const icono = document.createElement('i');
  icono.className = 'fas fa-sort ordenamiento-icono neutro';
  icono.setAttribute('data-columna', columna);
  header.appendChild(icono);
  
  // Agregar atributos de accesibilidad
  header.setAttribute('role', 'button');
  header.setAttribute('tabindex', '0');
  header.setAttribute('aria-label', `Ordenar por ${spanTexto.textContent}`);
  header.setAttribute('title', `Clic para ordenar por ${spanTexto.textContent}`);
}

  /**
   * MANEJO DE CLICK EN HEADER
   * Funcion principal que maneja el click en headers ordenables
   */
function manejarClickHeaderV2(header, tabla, columna, tipoColumna) {
  console.log(`ORDENAMIENTO Click en columna: ${columna} (${tipoColumna})`);
  
  try {
    // Mostrar estado de carga
    mostrarEstadoCarga(tabla, true);
    
    // Determinar nueva direccion
    const direccionActual = header.getAttribute('data-direccion') || null;
    let nuevaDireccion;
    
    if (direccionActual === 'asc') {
      nuevaDireccion = 'desc';
    } else if (direccionActual === 'desc') {
      nuevaDireccion = 'asc';
    } else {
      nuevaDireccion = 'asc'; // Primera vez
    }
    
    console.log(`ORDENAMIENTO ${columna}: ${direccionActual || 'ninguna'} -> ${nuevaDireccion}`);
    
    // Actualizar estado global
    estadoOrdenamientoGlobal.columnaActual = columna;
    estadoOrdenamientoGlobal.direccionActual = nuevaDireccion;
    estadoOrdenamientoGlobal.tablaActual = tabla;
    
    // Actualizar UI de headers
    actualizarUIHeaders(tabla, columna, nuevaDireccion);
    
    // Ejecutar ordenamiento
    setTimeout(() => {
      ejecutarOrdenamiento(tabla, columna, nuevaDireccion, tipoColumna);
    }, 100); // Pequeno delay para mostrar el cambio de UI
    
  } catch (error) {
    console.error('ORDENAMIENTO Error en manejo de click:', error);
    mostrarEstadoCarga(tabla, false);
    mostrarError('Error al ordenar. Intente nuevamente.');
  }
}

  /**
   * ACTUALIZACION DE UI DE HEADERS
   * Actualiza los iconos y estados visuales de todos los headers
   */
function actualizarUIHeaders(tabla, columnaActiva, direccion) {
  const headers = tabla.querySelectorAll('th.ordenable');
  
  headers.forEach(header => {
    const columnaHeader = header.getAttribute('data-columna');
    const icono = header.querySelector('.ordenamiento-icono');
    
    if (!icono) return;
    
    // Limpiar estados previos
    header.classList.remove('activo');
    header.removeAttribute('data-direccion');
    icono.classList.remove('activo', 'neutro', 'cambiando');
    
    if (columnaHeader === columnaActiva) {
      // Header activo
      header.classList.add('activo');
      header.setAttribute('data-direccion', direccion);
      
      // Cambiar icono con animacion
      icono.classList.add('cambiando');
      
      setTimeout(() => {
        icono.className = `fas fa-sort-${direccion} ordenamiento-icono activo`;
        icono.classList.remove('cambiando');
      }, 150);
      
    } else {
      // Headers inactivos
      icono.className = 'fas fa-sort ordenamiento-icono neutro';
    }
  });
}

  /**
   * EJECUCION DE ORDENAMIENTO
   * Ejecuta el ordenamiento segun el tipo de tabla
   */
function ejecutarOrdenamiento(tabla, columna, direccion, tipoColumna) {
  console.log(`ORDENAMIENTO Ejecutando: ${columna} (${direccion})`);
  
  try {
    // Determinar tipo de ordenamiento
    if (esOrdenamientoLocal(tabla)) {
      ejecutarOrdenamientoLocal(tabla, columna, direccion, tipoColumna);
    } else {
      ejecutarOrdenamientoServidor(columna, direccion);
    }
    
    // Guardar estado
    guardarEstadoOrdenamiento(columna, direccion);
    
  } catch (error) {
    console.error('ORDENAMIENTO Error en ejecucion:', error);
    mostrarEstadoCarga(tabla, false);
    mostrarError('Error al ordenar datos.');
  }
}

  /**
   * ORDENAMIENTO POR SERVIDOR
   * Maneja ordenamiento con recarga de pagina (mantiene filtros y paginacion)
   */
function ejecutarOrdenamientoServidor(columna, direccion) {
  console.log(`ORDENAMIENTO Servidor: ${columna} (${direccion})`);
  
  try {
    // Construir nueva URL con parametros de ordenamiento
    const url = new URL(window.location);
    
    // Actualizar parametros de ordenamiento
    url.searchParams.set('ordenarPor', columna);
    url.searchParams.set('ordenDireccion', direccion);
    
    // Resetear pagina a 1 para ver resultados ordenados desde el principio
    url.searchParams.set('page', '1');
    
    console.log(`ORDENAMIENTO Navegando a: ${url.pathname}${url.search}`);
    
    // Navegar a nueva URL
    window.location.href = url.toString();
    
  } catch (error) {
    console.error('ORDENAMIENTO Error en ordenamiento servidor:', error);
    throw error;
  }
}

/**
 * ORDENAMIENTO LOCAL
 * Maneja ordenamiento en el cliente (para tablas pequenas)
 */
function ejecutarOrdenamientoLocal(tabla, columna, direccion, tipoColumna) {
  console.log(`ORDENAMIENTO Local: ${columna} (${direccion})`);
  
  try {
    const tbody = tabla.querySelector('tbody');
    if (!tbody) {
      throw new Error('No se encontro tbody en la tabla');
    }
    
    const filas = Array.from(tbody.querySelectorAll('tr'));
    
    if (filas.length === 0) {
      console.log('ORDENAMIENTO No hay filas para ordenar');
      mostrarEstadoCarga(tabla, false);
      return;
    }
    
    // Obtener indice de columna
    const indiceColumna = obtenerIndiceColumna(tabla, columna);
    if (indiceColumna === -1) {
      throw new Error(`No se encontro la columna: ${columna}`);
    }
    
    // Ordenar filas
    filas.sort((filaA, filaB) => {
      const valorA = extraerValorCelda(filaA, indiceColumna, tipoColumna);
      const valorB = extraerValorCelda(filaB, indiceColumna, tipoColumna);
      
      let comparacion = compararValores(valorA, valorB, tipoColumna);
      
      return direccion === 'desc' ? -comparacion : comparacion;
    });
    
    // Reordenar DOM
    filas.forEach(fila => tbody.appendChild(fila));
    
    // Ocultar estado de carga
    setTimeout(() => {
      mostrarEstadoCarga(tabla, false);
      console.log('ORDENAMIENTO Local completado');
    }, 300);
    
  } catch (error) {
    console.error('ORDENAMIENTO Error en ordenamiento local:', error);
    mostrarEstadoCarga(tabla, false);
    throw error;
  }
}

/**
 * FUNCIONES AUXILIARES DE ORDENAMIENTO
 */

function esOrdenamientoLocal(tabla) {
  return tabla.hasAttribute('data-ordenamiento-local') || 
         tabla.getAttribute('data-ordenamiento') === 'local';
}

function obtenerIndiceColumna(tabla, nombreColumna) {
  const headers = tabla.querySelectorAll('th');
  for (let i = 0; i < headers.length; i++) {
    if (headers[i].getAttribute('data-columna') === nombreColumna) {
      return i;
    }
  }
  return -1;
}

function extraerValorCelda(fila, indiceColumna, tipoColumna) {
  const celda = fila.cells[indiceColumna];
  if (!celda) return '';
  
  // Buscar valor especifico para ordenamiento
  const valorSort = celda.getAttribute('data-sort-value');
  if (valorSort) return valorSort;
  
  // Extraer texto limpio
  let valor = celda.textContent.trim();
  
  // Procesar segun tipo
  switch (tipoColumna) {
    case 'numero':
      valor = valor.replace(/[$,\s]/g, '');
      return parseFloat(valor) || 0;
      
    case 'fecha':
      return new Date(valor).getTime() || 0;
      
    case 'texto':
    default:
      return valor.toLowerCase();
  }
}

function compararValores(a, b, tipoColumna) {
  if (tipoColumna === 'numero' || tipoColumna === 'fecha') {
    return a - b;
  } else {
    return a.localeCompare(b);
  }
}

/**
 * FUNCIONES DE UI Y ESTADO
 */

function mostrarEstadoCarga(tabla, mostrar) {
  if (mostrar) {
    tabla.classList.add('tabla-ordenando');
  } else {
    tabla.classList.remove('tabla-ordenando');
  }
}

function mostrarError(mensaje) {
  console.error(`ORDENAMIENTO ${mensaje}`);
  
  // Crear notificacion temporal
  const alerta = document.createElement('div');
  alerta.className = 'alert alert-warning alert-dismissible fade show position-fixed';
  alerta.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 300px;';
  alerta.innerHTML = `
    <i class="fas fa-exclamation-triangle me-2"></i>
    ${mensaje}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  
  document.body.appendChild(alerta);
  
  // Auto-remover despues de 5 segundos
  setTimeout(() => {
    if (alerta.parentNode) {
      alerta.remove();
    }
  }, 5000);
}

/**
 * PERSISTENCIA DE ESTADO
 */

function guardarEstadoOrdenamiento(columna, direccion) {
  if (!estadoOrdenamientoGlobal.configuracion.persistirEstado) return;
  
  try {
    const estado = {
      columna,
      direccion,
      timestamp: Date.now(),
      url: window.location.pathname
    };
    
    localStorage.setItem('ordenamiento-estado', JSON.stringify(estado));
    console.log(`ORDENAMIENTO Estado guardado: ${columna} (${direccion})`);
  } catch (error) {
    console.warn('ORDENAMIENTO No se pudo guardar estado:', error);
  }
}

function restaurarEstadoOrdenamiento() {
  if (!estadoOrdenamientoGlobal.configuracion.persistirEstado) return;
  
  try {
    const estadoGuardado = localStorage.getItem('ordenamiento-estado');
    if (!estadoGuardado) return;
    
    const estado = JSON.parse(estadoGuardado);
    
    // Verificar si es la misma pagina y no muy antiguo (1 hora)
    if (estado.url === window.location.pathname && 
        (Date.now() - estado.timestamp) < 3600000) {
      
      console.log(`ORDENAMIENTO Restaurando estado: ${estado.columna} (${estado.direccion})`);
      
      // Buscar header correspondiente y aplicar estado
      const header = document.querySelector(`th.ordenable[data-columna="${estado.columna}"]`);
      if (header && header.closest('table')) {
        const tabla = header.closest('table');
        actualizarUIHeaders(tabla, estado.columna, estado.direccion);
        
        estadoOrdenamientoGlobal.columnaActual = estado.columna;
        estadoOrdenamientoGlobal.direccionActual = estado.direccion;
        estadoOrdenamientoGlobal.tablaActual = tabla;
      }
    }
  } catch (error) {
    console.warn('ORDENAMIENTO Error restaurando estado:', error);
  }
}

/**
 * EXPOSICION GLOBAL
 * Hacer funciones disponibles globalmente
 */
window.inicializarOrdenamientoTablas = inicializarOrdenamientoTablas;
window.estadoOrdenamientoGlobal = estadoOrdenamientoGlobal;

// Auto-inicializacion cuando el DOM este listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', inicializarOrdenamientoTablas);
} else {
  // DOM ya esta listo
  setTimeout(inicializarOrdenamientoTablas, 100);
}

    if (window.DEBUG_MODE) {
      console.log('ORDENAMIENTO v2.0 Sistema universal cargado y listo');
    }

// ============== SISTEMA DE NOTIFICACIONES GRUPALES - SPRINT 3 ==============

// ============== SISTEMA DE NOTIFICACIONES GRUPALES - SPRINT 3 ==============

/**
 * NOTIFICACIONES GRUPALES MOVIDAS A ARCHIVO SEPARADO
 * Ver: /public/js/notificaciones-grupales.js
 *
 * Esta seccion fue eliminada para evitar conflictos con el archivo dedicado.
 * El sistema de notificaciones grupales ahora se maneja completamente en su propio archivo.
 */

if (window.DEBUG_MODE) {
  console.log('MAIN.JS Sistema principal cargado correctamente');
}
