/* ===== SISTEMA UNIVERSAL DE ORDENAMIENTO ===== */
/* 🎯 Sistema Universal de Tablas v2.0 - JavaScript */
/* Autor: Sistema Notarial Unificado */
/* Objetivo: Ordenamiento y filtros consistentes en todos los roles */

/**
 * Clase principal para el sistema universal de ordenamiento
 */
class OrdenamientoUniversal {
    constructor(selector, options = {}) {
        this.tabla = document.querySelector(selector);
        this.opciones = {
            columnaDefecto: 'fechaFactura',
            direccionDefecto: 'desc',
            mantenerFiltros: true,
            debug: false,
            ...options
        };
        
        this.ordenActual = {
            columna: this.opciones.columnaDefecto,
            direccion: this.opciones.direccionDefecto
        };
        
        this.log('Inicializando OrdenamientoUniversal', { selector, options });
        
        if (this.tabla) {
            this.inicializar();
        } else {
            this.log('Error: No se encontró la tabla con selector:', selector);
        }
    }
    
    /**
     * Inicializar el sistema de ordenamiento
     */
    inicializar() {
        this.log('Inicializando sistema de ordenamiento');
        this.agregarIconos();
        this.configurarEventos();
        this.aplicarOrdenInicial();
        this.tabla.classList.add('ordenamiento-activo');
    }
    
    /**
     * Agregar iconos de ordenamiento a los headers
     */
    agregarIconos() {
        const headers = this.tabla.querySelectorAll('th[data-sort], th.sortable, th.ordenable');
        
        headers.forEach(header => {
            header.classList.add('sortable');
            
            // Buscar icono existente
            let icono = header.querySelector('.sort-icon-universal, .fa-sort, .sort-icon');
            
            if (!icono) {
                // Crear nuevo icono
                icono = document.createElement('i');
                icono.className = 'fas fa-sort sort-icon-universal';
                
                // Insertar después del texto
                const span = header.querySelector('span');
                if (span) {
                    span.appendChild(icono);
                } else {
                    header.appendChild(icono);
                }
            } else {
                // Actualizar clase del icono existente
                icono.classList.add('sort-icon-universal');
            }
            
            // Asegurar que tiene data-sort o data-columna
            if (!header.getAttribute('data-sort') && !header.getAttribute('data-columna')) {
                const columna = this.extraerNombreColumna(header);
                header.setAttribute('data-sort', columna);
                header.setAttribute('data-columna', columna);
            }
        });
        
        this.log(`Iconos agregados a ${headers.length} headers`);
    }
    
    /**
     * Configurar eventos de click en headers
     */
    configurarEventos() {
        this.tabla.addEventListener('click', (e) => {
            const header = e.target.closest('th.sortable, th.ordenable');
            if (header) {
                e.preventDefault();
                this.manejarClick(header);
            }
        });
        
        this.log('Eventos configurados');
    }
    
    /**
     * Manejar click en header
     */
    manejarClick(header) {
        const columna = header.getAttribute('data-sort') || header.getAttribute('data-columna');
        if (!columna) {
            this.log('Error: Header sin data-sort o data-columna', header);
            return;
        }
        
        let nuevaDireccion;
        if (this.ordenActual.columna === columna) {
            nuevaDireccion = this.ordenActual.direccion === 'asc' ? 'desc' : 'asc';
        } else {
            nuevaDireccion = 'asc';
        }
        
        this.log(`Click en columna: ${columna}, nueva dirección: ${nuevaDireccion}`);
        
        this.ordenActual = { columna, direccion: nuevaDireccion };
        this.actualizarInterfaz(header, nuevaDireccion);
        this.ejecutarOrdenamiento(columna, nuevaDireccion);
    }
    
    /**
     * Actualizar interfaz visual de headers
     */
    actualizarInterfaz(headerActivo, direccion) {
        // Limpiar todos los headers
        this.tabla.querySelectorAll('th.sortable, th.ordenable').forEach(header => {
            header.classList.remove('asc', 'desc', 'active');
            const icono = header.querySelector('.sort-icon-universal, .sort-icon');
            if (icono) {
                icono.className = icono.className.replace(/fa-sort-(up|down|asc|desc)/, 'fa-sort');
            }
        });
        
        // Activar header actual
        headerActivo.classList.add(direccion, 'active');
        const icono = headerActivo.querySelector('.sort-icon-universal, .sort-icon');
        if (icono) {
            const direccionIcono = direccion === 'asc' ? 'up' : 'down';
            icono.className = icono.className.replace('fa-sort', `fa-sort-${direccionIcono}`);
        }
        
        this.log(`Interfaz actualizada: ${direccion}`);
    }
    
    /**
     * Ejecutar ordenamiento (redirección con parámetros)
     */
    ejecutarOrdenamiento(columna, direccion) {
        if (this.opciones.mantenerFiltros) {
            const params = new URLSearchParams(window.location.search);
            params.set('ordenarPor', columna);
            params.set('ordenDireccion', direccion);
            
            const nuevaURL = `${window.location.pathname}?${params.toString()}`;
            this.log('Redirigiendo a:', nuevaURL);
            window.location.href = nuevaURL;
        } else {
            window.location.href = `${window.location.pathname}?ordenarPor=${columna}&ordenDireccion=${direccion}`;
        }
    }
    
    /**
     * Aplicar orden inicial basado en URL
     */
    aplicarOrdenInicial() {
        const params = new URLSearchParams(window.location.search);
        const columna = params.get('ordenarPor') || this.opciones.columnaDefecto;
        const direccion = params.get('ordenDireccion') || this.opciones.direccionDefecto;
        
        if (columna) {
            const header = this.tabla.querySelector(`th[data-sort="${columna}"], th[data-columna="${columna}"]`);
            if (header) {
                header.classList.add(direccion, 'active');
                const icono = header.querySelector('.sort-icon-universal, .sort-icon');
                if (icono) {
                    const direccionIcono = direccion === 'asc' ? 'up' : 'down';
                    icono.className = icono.className.replace('fa-sort', `fa-sort-${direccionIcono}`);
                }
                this.ordenActual = { columna, direccion };
                this.log(`Orden inicial aplicado: ${columna} ${direccion}`);
            }
        }
    }
    
    /**
     * Extraer nombre de columna del header
     */
    extraerNombreColumna(header) {
        // Intentar extraer de diferentes fuentes
        const dataColumn = header.getAttribute('data-columna');
        if (dataColumn) return dataColumn;
        
        const dataSort = header.getAttribute('data-sort');
        if (dataSort) return dataSort;
        
        const texto = header.textContent.trim().toLowerCase();
        const mapeoColumnas = {
            'código': 'codigoBarras',
            'cliente': 'nombreCliente',
            'matrizador': 'matrizador',
            'fecha': 'fechaFactura',
            'estado': 'estado',
            'pago': 'estadoPago',
            'valor': 'valorFactura'
        };
        
        return mapeoColumnas[texto] || 'created_at';
    }
    
    /**
     * Logging condicional
     */
    log(...args) {
        if (this.opciones.debug) {
            console.log('[OrdenamientoUniversal]', ...args);
        }
    }
}

/**
 * Inicializador automático para diferentes tipos de tablas
 */
class InicializadorTablas {
    static inicializar() {
        console.log('🎯 Inicializando sistema universal de tablas v2.0...');
        
        // Configuraciones por tipo de tabla
        const configuraciones = {
            '.tabla-notaria.tabla-documentos': {
                columnaDefecto: 'fechaFactura',
                direccionDefecto: 'desc',
                debug: false
            },
            '.tabla-ordenable': {
                columnaDefecto: 'fechaFactura',
                direccionDefecto: 'desc',
                debug: false
            },
            '.tabla-notaria': {
                columnaDefecto: 'fechaFactura',
                direccionDefecto: 'desc',
                debug: false
            }
        };
        
        let tablasInicializadas = 0;
        
        // Inicializar cada tipo de tabla
        Object.entries(configuraciones).forEach(([selector, config]) => {
            const tablas = document.querySelectorAll(selector);
            tablas.forEach((tabla, index) => {
                try {
                    const id = tabla.id || `tabla-${Date.now()}-${index}`;
                    if (!tabla.id) tabla.id = id;
                    
                    new OrdenamientoUniversal(`#${id}`, config);
                    tablasInicializadas++;
                } catch (error) {
                    console.error(`Error inicializando tabla ${selector}:`, error);
                }
            });
        });
        
        console.log(`✅ Sistema universal inicializado: ${tablasInicializadas} tablas`);
        
        // Inicializar filtros de fechas automáticos
        InicializadorTablas.inicializarFiltrosFechas();
    }
    
    /**
     * Inicializar filtros de fechas automáticos
     */
    static inicializarFiltrosFechas() {
        console.log('📅 Inicializando filtros de fechas automáticos...');
        
        // Buscar campos de fecha en formularios de filtros
        const camposFecha = document.querySelectorAll('input[type="date"][name*="fecha"]');
        
        camposFecha.forEach(campo => {
            campo.addEventListener('change', function() {
                const form = this.closest('form');
                if (form) {
                    // Verificar si ambas fechas están llenas antes de enviar
                    const fechaDesde = form.querySelector('input[name*="fechaDesde"], input[name*="fechaInicio"]');
                    const fechaHasta = form.querySelector('input[name*="fechaHasta"], input[name*="fechaFin"]');
                    
                    if (fechaDesde && fechaHasta) {
                        if (fechaDesde.value && fechaHasta.value) {
                            console.log('📅 Aplicando filtro automático de fechas:', fechaDesde.value, 'a', fechaHasta.value);
                            form.submit();
                        }
                    } else if (this.value) {
                        // Si solo hay un campo de fecha, aplicar inmediatamente
                        console.log('📅 Aplicando filtro automático de fecha única:', this.value);
                        form.submit();
                    }
                }
            });
        });
        
        console.log(`✅ Filtros de fechas configurados: ${camposFecha.length} campos`);
    }
}

/**
 * Función de inicialización global (mantener compatibilidad)
 */
function inicializarOrdenamientoTablas() {
    InicializadorTablas.inicializar();
}

/**
 * Inicialización automática cuando el DOM esté listo
 */
document.addEventListener('DOMContentLoaded', function() {
    // Pequeño delay para asegurar que todas las tablas estén renderizadas
    setTimeout(() => {
        InicializadorTablas.inicializar();
    }, 100);
});

/**
 * Funciones auxiliares para filtros avanzados
 */
class FiltrosAvanzados {
    /**
     * Configurar filtros en tiempo real
     */
    static configurarFiltrosEnTiempoReal(formSelector = '#filtrosForm') {
        const form = document.querySelector(formSelector);
        if (!form) return;
        
        const campos = form.querySelectorAll('select, input[type="text"], input[type="search"]');
        
        campos.forEach(campo => {
            let timeout;
            
            campo.addEventListener('input', function() {
                clearTimeout(timeout);
                
                // Para campos de texto, esperar 500ms antes de aplicar
                if (this.type === 'text' || this.type === 'search') {
                    timeout = setTimeout(() => {
                        if (this.value.length >= 3 || this.value.length === 0) {
                            form.submit();
                        }
                    }, 500);
                } else {
                    // Para selects, aplicar inmediatamente
                    form.submit();
                }
            });
        });
        
        console.log('✅ Filtros en tiempo real configurados');
    }
    
    /**
     * Limpiar todos los filtros
     */
    static limpiarFiltros(formSelector = '#filtrosForm') {
        const form = document.querySelector(formSelector);
        if (!form) return;
        
        // Limpiar todos los campos
        form.querySelectorAll('input, select').forEach(campo => {
            if (campo.type === 'checkbox' || campo.type === 'radio') {
                campo.checked = false;
            } else {
                campo.value = '';
            }
        });
        
        // Enviar formulario para aplicar filtros vacíos
        form.submit();
    }
}

// Exportar funciones para uso global
window.InicializadorTablas = InicializadorTablas;
window.OrdenamientoUniversal = OrdenamientoUniversal;
window.FiltrosAvanzados = FiltrosAvanzados;
window.inicializarOrdenamientoTablas = inicializarOrdenamientoTablas; 