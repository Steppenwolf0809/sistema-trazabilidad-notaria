/**
 * JavaScript principal para el Sistema de Trazabilidad Documental
 * Contiene funciones para interactuar con la API y gestionar la interfaz de usuario
 */

// Cuando el documento esté listo
document.addEventListener('DOMContentLoaded', function() {
  console.log('Sistema de Trazabilidad Documental - Frontend cargado');
  
  // Actualizar año en el pie de página
  actualizarAnioPiePagina();
  
  // Inicializar formulario de verificación
  inicializarFormularioVerificacion();
  
  // Inicializar ordenamiento de tablas
  console.log('Llamando a inicializarOrdenamientoTablas...');
  setTimeout(() => {
    inicializarOrdenamientoTablas();
  }, 100);
});

/**
 * Actualiza el año en el pie de página
 */
function actualizarAnioPiePagina() {
  // Buscar todas las instancias de currentYear y reemplazarlas con el año actual
  const currentYearElements = document.querySelectorAll('.current-year');
  const currentYear = new Date().getFullYear();
  
  currentYearElements.forEach(element => {
    element.textContent = currentYear;
  });
}

/**
 * Inicializa el formulario de verificación de documentos
 */
function inicializarFormularioVerificacion() {
  const form = document.getElementById('verificar-form');
  
  if (form) {
    form.addEventListener('submit', function(event) {
      event.preventDefault();
      
      const codigoBarras = document.getElementById('codigo-barras').value.trim();
      
      if (!codigoBarras) {
        mostrarAlerta('Por favor, ingrese un código de barras', 'danger');
        return;
      }
      
      verificarDocumento(codigoBarras);
    });
  }
}

/**
 * Verifica un documento mediante su código de barras
 * @param {string} codigoBarras - Código de barras del documento
 */
function verificarDocumento(codigoBarras) {
  // Mostrar indicador de carga
  mostrarAlerta('Verificando documento...', 'info');
  
  // Hacer la petición a la API
  fetch(`/api/documentos/buscar/codigo/${codigoBarras}`)
    .then(response => {
      if (!response.ok) {
        throw new Error('Documento no encontrado');
      }
      return response.json();
    })
    .then(data => {
      if (data.exito) {
        // Redirigir a la página de detalles del documento
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
 * Muestra una alerta en la página
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
  
  // Eliminar la alerta después de 5 segundos
  setTimeout(() => {
    alertaDiv.remove();
  }, 5000);
}

/**
 * Inicializa el ordenamiento de tablas en la aplicación
 * Para usar esta funcionalidad, se debe:
 * 1. Agregar la clase 'tabla-ordenable' a la tabla
 * 2. Agregar la clase 'ordenable' a los th que se quieran ordenar
 * 3. Agregar el atributo data-columna con el nombre de la columna a cada th
 * 4. Agregar el atributo data-tipo con el tipo de dato (texto, fecha, numero, estado) a cada th
 */
function inicializarOrdenamientoTablas() {
  console.log('Inicializando ordenamiento de tablas');
  const tablas = document.querySelectorAll('table.tabla-ordenable');
  
  if (tablas.length === 0) {
    console.log('No se encontraron tablas ordenables');
    return;
  }
  
  console.log(`Encontradas ${tablas.length} tablas ordenables`);
  
  tablas.forEach((tabla, index) => {
    console.log(`Configurando tabla ${index + 1}`);
    const encabezados = tabla.querySelectorAll('th.ordenable');
    console.log(`La tabla tiene ${encabezados.length} encabezados ordenables`);
    
    // Si no hay encabezados ordenables, salir
    if (encabezados.length === 0) {
      console.log('No hay encabezados ordenables en esta tabla');
      return;
    }
    
    encabezados.forEach(encabezado => {
      // Obtener o asignar columna si no existe
      const columna = encabezado.dataset.columna || encabezado.textContent.toLowerCase().trim();
      encabezado.dataset.columna = columna;
      
      // Añadir cursor pointer
      encabezado.style.cursor = 'pointer';
      
      // Crear elemento para el icono si no existe
      let iconoSort = encabezado.querySelector('.fa-sort, .fa-sort-up, .fa-sort-down');
      if (!iconoSort) {
        iconoSort = document.createElement('i');
        iconoSort.className = 'fas fa-sort ms-1';
        encabezado.appendChild(iconoSort);
      }
      
      // Añadir evento de clic
      encabezado.addEventListener('click', function() {
        console.log(`Clic en encabezado: ${columna}`);
        const tipoOrden = encabezado.dataset.orden || 'ninguno';
        let nuevoOrden = 'asc';
        
        // Cambiar el orden de forma cíclica: ninguno -> asc -> desc -> ninguno
        if (tipoOrden === 'asc') {
          nuevoOrden = 'desc';
          console.log(`Cambiando orden a: ${nuevoOrden}`);
        } else if (tipoOrden === 'desc') {
          nuevoOrden = 'ninguno';
          console.log(`Cambiando orden a: ${nuevoOrden}`);
        } else {
          console.log(`Cambiando orden a: ${nuevoOrden}`);
        }
        
        // Resetear otros encabezados
        encabezados.forEach(otroEncabezado => {
          if (otroEncabezado !== encabezado) {
            otroEncabezado.dataset.orden = 'ninguno';
            const otroIcono = otroEncabezado.querySelector('.fa-sort, .fa-sort-up, .fa-sort-down');
            if (otroIcono) {
              otroIcono.className = 'fas fa-sort ms-1';
            }
          }
        });
        
        // Actualizar estado actual
        encabezado.dataset.orden = nuevoOrden;
        
        // Actualizar icono
        if (nuevoOrden === 'asc') {
          iconoSort.className = 'fas fa-sort-up ms-1';
        } else if (nuevoOrden === 'desc') {
          iconoSort.className = 'fas fa-sort-down ms-1';
        } else {
          iconoSort.className = 'fas fa-sort ms-1';
        }
        
        // Ordenar la tabla
        ordenarTabla(tabla, columna, nuevoOrden, encabezado.dataset.tipo);
      });
    });
  });
}

/**
 * Ordena una tabla por una columna específica
 * @param {HTMLElement} tabla - La tabla a ordenar
 * @param {string} columna - El nombre de la columna a ordenar
 * @param {string} orden - La dirección del ordenamiento ('asc', 'desc' o 'ninguno')
 * @param {string} tipo - El tipo de datos de la columna (texto, fecha, numero, estado)
 */
function ordenarTabla(tabla, columna, orden, tipo) {
  console.log(`Ordenando tabla por columna ${columna} (${tipo}) en orden ${orden}`);
  
  if (orden === 'ninguno') {
    console.log('Orden ninguno, no se realiza ordenamiento');
    return;
  }
  
  const tbody = tabla.querySelector('tbody');
  if (!tbody) {
    console.error('No se encontró el tbody en la tabla');
    return;
  }
  
  // Guardar filas originales si no existen
  if (!tabla.dataset.filasOriginales) {
    const htmlOriginal = tbody.innerHTML;
    tabla.dataset.filasOriginales = htmlOriginal;
    console.log('Guardando orden original de filas');
  }
  
  // Si es orden ninguno, restaurar orden original
  if (orden === 'ninguno') {
    tbody.innerHTML = tabla.dataset.filasOriginales;
    console.log('Restaurando orden original de filas');
    return;
  }
  
  const filas = Array.from(tbody.querySelectorAll('tr'));
  
  // Si no hay filas para ordenar, salir
  if (filas.length <= 1) {
    console.log('No hay suficientes filas para ordenar');
    return;
  }
  
  // Función para obtener el valor de la columna
  const getValorColumna = (fila, indiceColumna, tipo) => {
    const celda = fila.cells[indiceColumna];
    if (!celda) {
      console.log(`No se encontró la celda en índice ${indiceColumna}`);
      return '';
    }

    // Si es de tipo fecha y existe data-sort-value, usarlo.
    if (tipo === 'fecha' && celda.dataset.sortValue) {
      return celda.dataset.sortValue;
    }
    
    // Intentar extraer el contenido más relevante
    const badge = celda.querySelector('.badge');
    if (badge) {
      return badge.textContent.trim();
    }
    
    // Si hay un elemento span, usar su contenido
    const span = celda.querySelector('span');
    if (span) {
      return span.textContent.trim();
    }
    
    return celda.textContent.trim();
  };
  
  // Obtener el índice de la columna a ordenar
  const encabezados = tabla.querySelectorAll('th');
  let indiceColumna = -1;
  let tipoDatoColumna = 'texto'; // tipo por defecto
  
  for (let i = 0; i < encabezados.length; i++) {
    if (encabezados[i].dataset.columna === columna) {
      indiceColumna = i;
      tipoDatoColumna = encabezados[i].dataset.tipo || 'texto'; // Obtener el tipo del encabezado
      break;
    }
  }
  
  if (indiceColumna === -1) {
    console.error(`No se encontró columna con identificador ${columna}`);
    return;
  }
  
  console.log(`Índice de columna a ordenar: ${indiceColumna}`);
  
  // Ordenar las filas
  filas.sort((a, b) => {
    // Pasar el tipo de dato a getValorColumna
    let valorA = getValorColumna(a, indiceColumna, tipoDatoColumna);
    let valorB = getValorColumna(b, indiceColumna, tipoDatoColumna);
    
    console.log(`Comparando: "${valorA}" con "${valorB}" (Tipo: ${tipoDatoColumna})`);
    
    // Aplicar formato según el tipo de datos
    if (tipoDatoColumna === 'numero') {
      valorA = parseFloat(valorA.replace(/[^\\d.-]/g, '')) || 0;
      valorB = parseFloat(valorB.replace(/[^\\d.-]/g, '')) || 0;
    } else if (tipoDatoColumna === 'fecha') {
      // Intentar convertir desde varios formatos comunes o si ya es timestamp
      const parseDate = (dateString) => {
        if (!dateString) return 0;
        // Si es un número, asumimos que es un timestamp
        if (!isNaN(dateString)) return parseInt(dateString, 10);

        // Formato DD/MM/YYYY o DD/MM/YYYY, HH:MM:SS
        const dateTimeParts = dateString.split(', ');
        const dateParts = dateTimeParts[0].split('/');
        if (dateParts.length === 3) {
          // new Date(year, monthIndex, day, hours, minutes, seconds)
          const day = parseInt(dateParts[0], 10);
          const month = parseInt(dateParts[1], 10) - 1; // Mes es 0-indexado
          const year = parseInt(dateParts[2], 10);
          
          let hours = 0, minutes = 0, seconds = 0;
          if (dateTimeParts.length > 1) {
            const timeParts = dateTimeParts[1].split(':');
            if (timeParts.length >= 2) {
              hours = parseInt(timeParts[0], 10) || 0;
              minutes = parseInt(timeParts[1], 10) || 0;
            }
            if (timeParts.length === 3) {
              seconds = parseInt(timeParts[2], 10) || 0;
            }
          }
          return new Date(year, month, day, hours, minutes, seconds).getTime();
        }
        // Si no es DD/MM/YYYY, intentar directamente (puede ser ISO)
        return new Date(dateString).getTime() || 0;
      };
      valorA = parseDate(valorA);
      valorB = parseDate(valorB);
    } else if (tipoDatoColumna === 'estado') {
      // Ordenar por prioridad de estado
      const prioridades = {
        'En Proceso': 1,
        'Listo': 2,
        'Entregado': 3,
        'Cancelado': 4
      };
      
      valorA = prioridades[valorA] || 999;
      valorB = prioridades[valorB] || 999;
    }
    
    // Comparar valores
    let resultado = 0;
    
    if (valorA < valorB) {
      resultado = orden === 'asc' ? -1 : 1;
    } else if (valorA > valorB) {
      resultado = orden === 'asc' ? 1 : -1;
    }
    
    return resultado;
  });
  
  // Reconstruir la tabla con las filas ordenadas
  while (tbody.firstChild) {
    tbody.removeChild(tbody.firstChild);
  }
  
  filas.forEach(fila => {
    tbody.appendChild(fila);
  });
  
  console.log('Ordenamiento completado');
} 