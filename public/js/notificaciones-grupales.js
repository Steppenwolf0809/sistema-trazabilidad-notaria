/**
 * NOTIFICACIONES GRUPALES - SPRINT 3
 * Sistema completo de gestión de notificaciones grupales por cliente
 * 
 * @author Sistema de Gestión Notarial
 * @version 1.0.0
 * @since 2025-01-20
 */

// ============== CONFIGURACIÓN GLOBAL ==============
const NotificacionesGrupales = {
  // Estado del sistema
  documentoActual: null,
  documentosDisponibles: [],
  grupoActual: null,
  modales: {},
  
  // URLs de endpoints
  endpoints: {
    detectar: '/matrizador/api/documentos/{documentoId}/detectar-notificacion',
    crear: '/matrizador/api/grupos-notificacion/crear',
    separar: '/matrizador/api/grupos-notificacion/{documentoId}/separar',
    marcarGrupo: '/matrizador/api/documentos/{documentoId}/marcar-listo-grupo'
  },
  
  // Configuración de interfaz
  config: {
    animacionDuracion: 300,
    tiempoRedireccion: 2000,
    maxDocumentosGrupo: 10
  },

  /**
   * Inicializa el sistema de notificaciones grupales
   */
  init() {
    console.log('📱 [NOTIFICACIONES GRUPALES] Inicializando sistema...');
    
    try {
      this.detectarElementosDOM();
      this.configurarEventListeners();
      this.verificarEstadoActual();
      
      console.log('✅ [NOTIFICACIONES GRUPALES] Sistema inicializado correctamente');
    } catch (error) {
      console.error('❌ [NOTIFICACIONES GRUPALES] Error en inicialización:', error);
    }
  },

  /**
   * Detecta y configura elementos del DOM
   */
  detectarElementosDOM() {
    // Obtener información del documento actual
    const documentoIdElement = document.querySelector('[data-documento-id]');
    if (documentoIdElement) {
      this.documentoActual = {
        id: documentoIdElement.dataset.documentoId,
        nombreCliente: documentoIdElement.dataset.nombreCliente || '',
        identificacionCliente: documentoIdElement.dataset.identificacionCliente || ''
      };
    }

    // Configurar modales
    this.configurarModales();
  },

  /**
   * Configura los modales del sistema
   */
  configurarModales() {
    // Modal para agrupar documentos
    this.modales.agrupar = {
      elemento: this.crearModalAgrupar(),
      visible: false
    };

    // Modal para confirmar separación
    this.modales.separar = {
      elemento: this.crearModalSeparar(),
      visible: false
    };

    // Modal para marcar grupo como listo
    this.modales.marcarGrupo = {
      elemento: this.crearModalMarcarGrupo(),
      visible: false
    };

    // Agregar modales al body
    Object.values(this.modales).forEach(modal => {
      document.body.appendChild(modal.elemento);
    });
  },

  /**
   * Configura los event listeners
   */
  configurarEventListeners() {
    // Botón para agrupar documentos
    const btnAgrupar = document.getElementById('btn-agrupar-documentos');
    if (btnAgrupar) {
      btnAgrupar.addEventListener('click', (e) => {
        e.preventDefault();
        this.abrirModalAgrupar();
      });
    }

    // Botón para separar de grupo
    const btnSeparar = document.getElementById('btn-separar-grupo');
    if (btnSeparar) {
      btnSeparar.addEventListener('click', (e) => {
        e.preventDefault();
        this.abrirModalSeparar();
      });
    }

    // Interceptar formulario de "marcar como listo"
    const formMarcarListo = document.getElementById('formMarcarListo');
    if (formMarcarListo) {
      formMarcarListo.addEventListener('submit', (e) => {
        this.interceptarMarcarListo(e);
      });
    }

    // Cerrar modales con ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.cerrarTodosLosModales();
      }
    });
  },

  /**
   * Verifica el estado actual del documento
   */
  verificarEstadoActual() {
    if (!this.documentoActual?.id) {
      console.warn('⚠️ [NOTIFICACIONES GRUPALES] No se detectó documento actual');
      return;
    }

    // Verificar si el documento está en un grupo
    this.verificarGrupoExistente();
  },

  // ============== GESTIÓN DE MODALES ==============

  /**
   * Crea el modal para agrupar documentos
   */
  crearModalAgrupar() {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = 'modalAgruparDocumentos';
    modal.setAttribute('tabindex', '-1');
    modal.setAttribute('aria-hidden', 'true');

    modal.innerHTML = `
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header bg-primary text-white">
            <h5 class="modal-title">
              <i class="fas fa-layer-group me-2"></i>
              Agrupar Documentos para Notificación
            </h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="alert alert-info">
              <i class="fas fa-info-circle me-2"></i>
              <strong>Ventajas de agrupar:</strong> El cliente recibirá una sola notificación 
              con un código único para retirar todos sus documentos juntos.
            </div>
            
            <div id="documentos-disponibles-container">
              <div class="d-flex justify-content-center py-4">
                <div class="spinner-border text-primary" role="status">
                  <span class="visually-hidden">Cargando documentos...</span>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
              <i class="fas fa-times me-2"></i>Cancelar
            </button>
            <button type="button" class="btn btn-primary" id="btn-confirmar-agrupacion" disabled>
              <i class="fas fa-layer-group me-2"></i>
              Crear Grupo (<span id="contador-seleccionados">0</span> documentos)
            </button>
          </div>
        </div>
      </div>
    `;

    return modal;
  },

  /**
   * Crea el modal para separar documento del grupo
   */
  crearModalSeparar() {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = 'modalSepararGrupo';
    modal.setAttribute('tabindex', '-1');
    modal.setAttribute('aria-hidden', 'true');

    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header bg-warning text-dark">
            <h5 class="modal-title">
              <i class="fas fa-unlink me-2"></i>
              Separar Documento del Grupo
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="alert alert-warning">
              <i class="fas fa-exclamation-triangle me-2"></i>
              <strong>¿Está seguro?</strong> Al separar este documento del grupo:
            </div>
            <ul class="list-unstyled">
              <li><i class="fas fa-minus-circle text-danger me-2"></i>Se eliminará del grupo actual</li>
              <li><i class="fas fa-bell text-info me-2"></i>Recibirá notificación individual</li>
              <li><i class="fas fa-key text-warning me-2"></i>Tendrá su propio código de verificación</li>
            </ul>
            <div id="info-grupo-actual"></div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
              <i class="fas fa-times me-2"></i>Cancelar
            </button>
            <button type="button" class="btn btn-warning" id="btn-confirmar-separacion">
              <i class="fas fa-unlink me-2"></i>Separar del Grupo
            </button>
          </div>
        </div>
      </div>
    `;

    return modal;
  },

  /**
   * Crea el modal para marcar grupo como listo
   */
  crearModalMarcarGrupo() {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = 'modalMarcarGrupo';
    modal.setAttribute('tabindex', '-1');
    modal.setAttribute('aria-hidden', 'true');

    modal.innerHTML = `
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header bg-success text-white">
            <h5 class="modal-title">
              <i class="fas fa-check-double me-2"></i>
              Marcar Grupo Completo como Listo
            </h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="alert alert-success">
              <i class="fas fa-info-circle me-2"></i>
              <strong>Notificación Grupal:</strong> Se enviará UNA SOLA notificación WhatsApp 
              con todos los documentos del grupo y un código único de verificación.
            </div>
            
            <div id="resumen-grupo"></div>
            
            <div class="mt-3">
              <h6>Opciones de marcado:</h6>
              <div class="form-check">
                <input class="form-check-input" type="radio" name="tipoMarcado" id="marcarTodoGrupo" value="grupo" checked>
                <label class="form-check-label fw-bold" for="marcarTodoGrupo">
                  <i class="fas fa-layer-group text-success me-2"></i>
                  Marcar TODO el grupo como listo (Recomendado)
                </label>
                <small class="text-muted d-block">Una sola notificación para todos los documentos</small>
              </div>
              <div class="form-check mt-2">
                <input class="form-check-input" type="radio" name="tipoMarcado" id="marcarSoloEste" value="individual">
                <label class="form-check-label" for="marcarSoloEste">
                  <i class="fas fa-file-alt text-warning me-2"></i>
                  Marcar solo este documento
                </label>
                <small class="text-muted d-block">Se separará del grupo y tendrá notificación individual</small>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
              <i class="fas fa-times me-2"></i>Cancelar
            </button>
            <button type="button" class="btn btn-success" id="btn-confirmar-marcar-grupo">
              <i class="fas fa-check me-2"></i>Proceder
            </button>
          </div>
        </div>
      </div>
    `;

    return modal;
  },

  // ============== FUNCIONES DE MODAL ==============

  /**
   * Abre el modal para agrupar documentos
   */
  async abrirModalAgrupar() {
    console.log('📱 [MODAL AGRUPAR] Abriendo modal...');
    
    try {
      // Mostrar modal
      const modal = new bootstrap.Modal(this.modales.agrupar.elemento);
      modal.show();
      
      // Cargar documentos disponibles
      await this.cargarDocumentosDisponibles();
      
      // Configurar eventos del modal
      this.configurarEventosModalAgrupar();
      
    } catch (error) {
      console.error('❌ [MODAL AGRUPAR] Error:', error);
      this.mostrarError('Error al abrir modal de agrupación');
    }
  },

  /**
   * Abre el modal para separar documento
   */
  abrirModalSeparar() {
    console.log('📱 [MODAL SEPARAR] Abriendo modal...');
    
    try {
      // Mostrar modal
      const modal = new bootstrap.Modal(this.modales.separar.elemento);
      modal.show();
      
      // Configurar eventos del modal
      this.configurarEventosModalSeparar();
      
    } catch (error) {
      console.error('❌ [MODAL SEPARAR] Error:', error);
      this.mostrarError('Error al abrir modal de separación');
    }
  },

  /**
   * Intercepta el envío del formulario "marcar como listo"
   */
  interceptarMarcarListo(event) {
    // Verificar si el documento está en un grupo
    const grupoInfo = this.obtenerInfoGrupoActual();
    
    if (grupoInfo && grupoInfo.enGrupo) {
      event.preventDefault();
      console.log('📱 [MARCAR LISTO] Documento en grupo detectado, abriendo modal...');
      this.abrirModalMarcarGrupo();
    }
    // Si no está en grupo, dejar que el formulario se envíe normalmente
  },

  /**
   * 🆕 NUEVO: Abre el modal para marcar grupo como listo
   */
  abrirModalMarcarGrupo() {
    console.log('📱 [MODAL MARCAR GRUPO] Abriendo modal...');
    
    try {
      // Cargar información del grupo en el modal
      this.cargarResumenGrupo();
      
      // Mostrar modal
      const modal = new bootstrap.Modal(this.modales.marcarGrupo.elemento);
      modal.show();
      
      // Configurar eventos del modal
      this.configurarEventosModalMarcarGrupo();
      
    } catch (error) {
      console.error('❌ [MODAL MARCAR GRUPO] Error:', error);
      this.mostrarError('Error al abrir modal de marcado grupal');
    }
  },

  /**
   * 🆕 NUEVO: Configura eventos del modal de separación
   */
  configurarEventosModalSeparar() {
    const btnConfirmar = document.getElementById('btn-confirmar-separacion');
    const infoGrupoActual = document.getElementById('info-grupo-actual');

    // Mostrar información del grupo actual
    if (infoGrupoActual && this.grupoActual) {
      infoGrupoActual.innerHTML = `
        <div class="bg-light p-3 rounded">
          <h6 class="mb-2">
            <i class="fas fa-layer-group text-primary me-2"></i>
            Grupo Actual
          </h6>
          <ul class="list-unstyled mb-0">
            <li><strong>Código:</strong> ${this.grupoActual.codigoVerificacion}</li>
            <li><strong>Total documentos:</strong> ${this.grupoActual.totalDocumentos}</li>
            <li><strong>Su rol:</strong> ${this.grupoActual.esLider ? 'Líder del grupo' : 'Miembro'}</li>
          </ul>
        </div>
      `;
    }

    // Botón confirmar separación
    if (btnConfirmar) {
      btnConfirmar.addEventListener('click', () => {
        this.separarDelGrupo();
      });
    }
  },

  /**
   * 🆕 NUEVO: Configura eventos del modal de marcar grupo
   */
  configurarEventosModalMarcarGrupo() {
    const btnConfirmar = document.getElementById('btn-confirmar-marcar-grupo');
    const radioGrupo = document.getElementById('marcarTodoGrupo');
    const radioIndividual = document.getElementById('marcarSoloEste');

    // Actualizar texto del botón según la selección
    const actualizarTextoBoton = () => {
      if (btnConfirmar) {
        if (radioGrupo && radioGrupo.checked) {
          btnConfirmar.innerHTML = `
            <i class="fas fa-check-double me-2"></i>
            Marcar Todo el Grupo
          `;
          btnConfirmar.className = 'btn btn-success';
        } else if (radioIndividual && radioIndividual.checked) {
          btnConfirmar.innerHTML = `
            <i class="fas fa-check me-2"></i>
            Marcar Solo Este Documento
          `;
          btnConfirmar.className = 'btn btn-warning';
        }
      }
    };

    // Event listeners para radio buttons
    if (radioGrupo) {
      radioGrupo.addEventListener('change', actualizarTextoBoton);
    }
    if (radioIndividual) {
      radioIndividual.addEventListener('change', actualizarTextoBoton);
    }

    // Botón confirmar
    if (btnConfirmar) {
      btnConfirmar.addEventListener('click', () => {
        const tipoMarcado = document.querySelector('input[name="tipoMarcado"]:checked')?.value;
        this.procesarMarcadoGrupal(tipoMarcado);
      });
    }

    // Establecer texto inicial
    actualizarTextoBoton();
  },

  /**
   * 🆕 NUEVO: Carga el resumen del grupo en el modal
   */
  cargarResumenGrupo() {
    const resumenContainer = document.getElementById('resumen-grupo');
    const grupoInfo = this.grupoActual;

    if (resumenContainer && grupoInfo) {
      resumenContainer.innerHTML = `
        <div class="bg-light p-3 rounded">
          <h6 class="mb-3">
            <i class="fas fa-layer-group text-success me-2"></i>
            Resumen del Grupo
          </h6>
          <div class="row">
            <div class="col-md-6">
              <ul class="list-unstyled">
                <li><strong>Código único:</strong> <code>${grupoInfo.codigoVerificacion}</code></li>
                <li><strong>Total documentos:</strong> ${grupoInfo.totalDocumentos}</li>
                <li><strong>Su rol:</strong> ${grupoInfo.esLider ? 'Líder del grupo' : 'Miembro'}</li>
              </ul>
            </div>
            <div class="col-md-6">
              <div class="alert alert-info mb-0">
                <small>
                  <i class="fas fa-info-circle me-1"></i>
                  Al marcar todo el grupo, se enviará <strong>una sola notificación</strong> 
                  con todos los documentos.
                </small>
              </div>
            </div>
          </div>
        </div>
      `;
    }
  },

  /**
   * 🆕 NUEVO: Separa el documento actual del grupo
   */
  async separarDelGrupo() {
    if (!this.documentoActual?.id) {
      this.mostrarError('No se pudo identificar el documento actual');
      return;
    }

    try {
      this.mostrarCargando('Separando documento del grupo...');

      const url = this.endpoints.separar.replace('{documentoId}', this.documentoActual.id);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const data = await response.json();

      if (data.exito) {
        this.mostrarExito('Documento separado exitosamente del grupo');
        
        // Cerrar modal y recargar página
        const modal = bootstrap.Modal.getInstance(this.modales.separar.elemento);
        modal.hide();
        
        setTimeout(() => {
          window.location.reload();
        }, this.config.tiempoRedireccion);
        
      } else {
        throw new Error(data.mensaje || 'Error al separar documento');
      }

    } catch (error) {
      console.error('❌ [SEPARAR GRUPO] Error:', error);
      this.mostrarError(`Error al separar documento: ${error.message}`);
    }
  },

  /**
   * 🆕 NUEVO: Procesa el marcado grupal según la opción seleccionada
   */
  async procesarMarcadoGrupal(tipoMarcado) {
    if (!tipoMarcado) {
      this.mostrarError('Debe seleccionar una opción de marcado');
      return;
    }

    try {
      this.mostrarCargando('Procesando marcado...');

      if (tipoMarcado === 'grupo') {
        // Marcar todo el grupo
        await this.marcarGrupoCompleto();
      } else if (tipoMarcado === 'individual') {
        // Separar y marcar solo este documento
        await this.separarYMarcarIndividual();
      }

    } catch (error) {
      console.error('❌ [MARCAR GRUPAL] Error:', error);
      this.mostrarError(`Error en marcado grupal: ${error.message}`);
    }
  },

  /**
   * 🆕 NUEVO: Marca todo el grupo como listo
   */
  async marcarGrupoCompleto() {
    const url = this.endpoints.marcarGrupo.replace('{documentoId}', this.documentoActual.id);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        marcarTodoElGrupo: true
      })
    });

    const data = await response.json();

    if (data.exito) {
      this.mostrarExito('Grupo completo marcado como listo - Notificación consolidada enviada');
      
      // Cerrar modal y redirigir
      const modal = bootstrap.Modal.getInstance(this.modales.marcarGrupo.elemento);
      modal.hide();
      
      setTimeout(() => {
        window.location.href = '/matrizador/documentos/entrega';
      }, this.config.tiempoRedireccion);
      
    } else {
      throw new Error(data.mensaje || 'Error al marcar grupo como listo');
    }
  },

  /**
   * 🆕 NUEVO: Separa el documento y lo marca individualmente
   */
  async separarYMarcarIndividual() {
    // Primero separar del grupo
    await this.separarDelGrupo();
    
    // Luego ejecutar el marcado normal del formulario
    setTimeout(() => {
      const formMarcarListo = document.getElementById('formMarcarListo');
      if (formMarcarListo) {
        // Deshabilitar el interceptor temporalmente
        this.interceptorHabilitado = false;
        formMarcarListo.submit();
      }
    }, 1000);
  },

  // ============== FUNCIONES AJAX ==============

  /**
   * Carga documentos disponibles para agrupar
   */
  async cargarDocumentosDisponibles() {
    const container = document.getElementById('documentos-disponibles-container');
    
    try {
      const url = this.endpoints.detectar.replace('{documentoId}', this.documentoActual.id);
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.exito) {
        this.documentosDisponibles = data.documentos || [];
        this.renderizarDocumentosDisponibles(container);
      } else {
        throw new Error(data.mensaje || 'Error al cargar documentos');
      }
      
    } catch (error) {
      console.error('❌ [CARGAR DOCUMENTOS] Error:', error);
      container.innerHTML = `
        <div class="alert alert-danger">
          <i class="fas fa-exclamation-triangle me-2"></i>
          Error al cargar documentos disponibles: ${error.message}
        </div>
      `;
    }
  },

  /**
   * Renderiza la lista de documentos disponibles
   */
  renderizarDocumentosDisponibles(container) {
    if (this.documentosDisponibles.length === 0) {
      container.innerHTML = `
        <div class="alert alert-warning">
          <i class="fas fa-info-circle me-2"></i>
          No hay otros documentos del mismo cliente disponibles para agrupar.
        </div>
      `;
      return;
    }

    let html = `
      <h6 class="mb-3">
        <i class="fas fa-list me-2"></i>
        Documentos disponibles para agrupar (${this.documentosDisponibles.length}):
      </h6>
      <div class="table-responsive">
        <table class="table table-sm">
          <thead>
            <tr>
              <th width="50">
                <input type="checkbox" id="selectAll" class="form-check-input">
              </th>
              <th>Tipo de Documento</th>
              <th>Código</th>
              <th>Notas</th>
              <th>Fecha Ingreso</th>
            </tr>
          </thead>
          <tbody>
    `;

    this.documentosDisponibles.forEach(doc => {
      html += `
        <tr>
          <td>
            <input type="checkbox" class="form-check-input documento-checkbox" 
                   value="${doc.id}" data-documento-id="${doc.id}">
          </td>
          <td>
            <strong>${doc.tipoDocumento}</strong>
            ${doc.esLiderGrupo ? '<span class="badge bg-primary ms-1">Actual</span>' : ''}
          </td>
          <td>
            <code>${doc.codigoBarras}</code>
          </td>
          <td>
            ${doc.notas ? `<small class="text-muted">${doc.notas}</small>` : '-'}
          </td>
          <td>
            <small>${new Date(doc.created_at).toLocaleDateString('es-EC')}</small>
          </td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = html;
  },

  /**
   * Configura eventos del modal de agrupación
   */
  configurarEventosModalAgrupar() {
    const btnConfirmar = document.getElementById('btn-confirmar-agrupacion');
    const contadorSeleccionados = document.getElementById('contador-seleccionados');
    const selectAll = document.getElementById('selectAll');

    // Checkbox "Seleccionar todos"
    if (selectAll) {
      selectAll.addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.documento-checkbox');
        checkboxes.forEach(cb => {
          cb.checked = e.target.checked;
        });
        this.actualizarContadorSeleccionados();
      });
    }

    // Checkboxes individuales
    document.addEventListener('change', (e) => {
      if (e.target.classList.contains('documento-checkbox')) {
        this.actualizarContadorSeleccionados();
      }
    });

    // Botón confirmar
    if (btnConfirmar) {
      btnConfirmar.addEventListener('click', () => {
        this.crearGrupoNotificacion();
      });
    }
  },

  /**
   * Actualiza el contador de documentos seleccionados
   */
  actualizarContadorSeleccionados() {
    const checkboxes = document.querySelectorAll('.documento-checkbox:checked');
    const contador = checkboxes.length;
    const contadorElement = document.getElementById('contador-seleccionados');
    const btnConfirmar = document.getElementById('btn-confirmar-agrupacion');

    if (contadorElement) {
      contadorElement.textContent = contador;
    }

    if (btnConfirmar) {
      btnConfirmar.disabled = contador === 0;
      btnConfirmar.innerHTML = `
        <i class="fas fa-layer-group me-2"></i>
        Crear Grupo (${contador} documento${contador !== 1 ? 's' : ''})
      `;
    }
  },

  /**
   * Crea el grupo de notificación
   */
  async crearGrupoNotificacion() {
    const checkboxes = document.querySelectorAll('.documento-checkbox:checked');
    const documentosSeleccionados = Array.from(checkboxes).map(cb => cb.value);

    if (documentosSeleccionados.length === 0) {
      this.mostrarError('Debe seleccionar al menos un documento');
      return;
    }

    try {
      this.mostrarCargando('Creando grupo de notificación...');

      const response = await fetch(this.endpoints.crear, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentoLiderId: this.documentoActual.id,
          documentosIds: documentosSeleccionados
        })
      });

      const data = await response.json();

      if (data.exito) {
        this.mostrarExito('Grupo creado exitosamente');
        
        // Cerrar modal y recargar página
        const modal = bootstrap.Modal.getInstance(this.modales.agrupar.elemento);
        modal.hide();
        
        setTimeout(() => {
          window.location.reload();
        }, this.config.tiempoRedireccion);
        
      } else {
        throw new Error(data.mensaje || 'Error al crear grupo');
      }

    } catch (error) {
      console.error('❌ [CREAR GRUPO] Error:', error);
      this.mostrarError(`Error al crear grupo: ${error.message}`);
    }
  },

  // ============== FUNCIONES DE UTILIDAD ==============

  /**
   * Obtiene información del grupo actual
   */
  obtenerInfoGrupoActual() {
    const grupoElement = document.querySelector('[data-grupo-info]');
    if (!grupoElement) return { enGrupo: false };

    return {
      enGrupo: true,
      grupoId: grupoElement.dataset.grupoId,
      codigoVerificacion: grupoElement.dataset.codigoVerificacion,
      totalDocumentos: parseInt(grupoElement.dataset.totalDocumentos) || 0,
      esLider: grupoElement.dataset.esLider === 'true'
    };
  },

  /**
   * Verifica si el documento está en un grupo
   */
  async verificarGrupoExistente() {
    // Esta función puede expandirse para verificar el estado del grupo
    // por ahora, utilizamos la información ya disponible en el DOM
    const grupoInfo = this.obtenerInfoGrupoActual();
    
    if (grupoInfo.enGrupo) {
      console.log('📱 [GRUPO] Documento pertenece a grupo:', grupoInfo);
      this.grupoActual = grupoInfo;
    }
  },

  /**
   * Muestra mensaje de éxito
   */
  mostrarExito(mensaje) {
    this.mostrarNotificacion(mensaje, 'success');
  },

  /**
   * Muestra mensaje de error
   */
  mostrarError(mensaje) {
    this.mostrarNotificacion(mensaje, 'error');
  },

  /**
   * Muestra indicador de carga
   */
  mostrarCargando(mensaje) {
    this.mostrarNotificacion(mensaje, 'loading');
  },

  /**
   * Muestra notificación usando el sistema existente
   */
  mostrarNotificacion(mensaje, tipo) {
    // Utilizar el sistema de notificaciones existente si está disponible
    if (window.mostrarNotificacion) {
      window.mostrarNotificacion(mensaje, tipo);
    } else {
      // Fallback a alert/console
      if (tipo === 'error') {
        alert('Error: ' + mensaje);
        console.error(mensaje);
      } else {
        console.log(mensaje);
      }
    }
  },

  /**
   * Cierra todos los modales
   */
  cerrarTodosLosModales() {
    Object.values(this.modales).forEach(modal => {
      const instance = bootstrap.Modal.getInstance(modal.elemento);
      if (instance) {
        instance.hide();
      }
    });
  }
};

// ============== INICIALIZACIÓN ==============

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  // Solo inicializar si estamos en páginas relevantes
  const paginasRelevantes = [
    '/matrizador/documentos/',
    '/documentos/detalle/',
    '/documentos/editar/'
  ];
  
  const paginaActual = window.location.pathname;
  const esRelevante = paginasRelevantes.some(pagina => paginaActual.includes(pagina));
  
  if (esRelevante) {
    NotificacionesGrupales.init();
  }
});

// Exportar para uso global
window.NotificacionesGrupales = NotificacionesGrupales; 