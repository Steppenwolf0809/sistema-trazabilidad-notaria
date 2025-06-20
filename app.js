/**
 * Punto de entrada principal para el Sistema de Trazabilidad Documental
 * Configura el servidor Express y todas las rutas de la aplicación
 */

// Importaciones de paquetes
const express = require('express');
const cors = require('cors');
const { engine } = require('express-handlebars');
const Handlebars = require('handlebars'); // Importar Handlebars directamente
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const flash = require('connect-flash');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

// Importación de configuración de base de datos
const { testConnection, syncModels } = require('./config/database');

// Importar helpers personalizados de Handlebars
const customHelpers = require('./utils/handlebarsHelpers');

// Creación de la aplicación Express
const app = express();
const PORT = process.env.PORT || 3001;

// Configuración de middleware
app.use(cors()); // Habilita CORS para todas las rutas
app.use(bodyParser.json()); // Parsea cuerpos de solicitud en formato JSON
app.use(bodyParser.urlencoded({ extended: true })); // Parsea cuerpos de solicitud desde formularios
app.use(cookieParser()); // Parse cookies

// Configuración de sesión
app.use(session({
  secret: process.env.SESSION_SECRET || 'clave-secreta-notaria',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 7 * 24 * 60 * 60 * 1000, // Extender a 7 días
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    sameSite: 'lax' // Valor más seguro que permite funcionalidad de redirecciones mientras mantiene protección CSRF
  },
  rolling: true // Renueva el tiempo de expiración de la cookie en cada request
}));

// Configuración de flash messages
app.use(flash());

// Middleware para pasar mensajes flash a todas las vistas
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  next();
});

// Configuración de vistas con Handlebars como motor de plantillas
const hbs = engine({
  extname: '.hbs', // Extensión de archivos de plantilla
  defaultLayout: 'main', // Diseño por defecto
  layoutsDir: path.join(__dirname, 'views/layouts'), // Directorio de layouts
  partialsDir: path.join(__dirname, 'views/partials'), // Directorio de partials
  handlebars: Handlebars, // Usar la instancia directamente
  // Configuraciones para permitir acceso a propiedades
  runtimeOptions: {
    allowProtoPropertiesByDefault: true,
    allowProtoMethodsByDefault: true
  },
  helpers: {
    // Combinar helpers existentes con los nuevos
    ...customHelpers,
    
    // Helper para switch/case
    switch: function(value, options) {
      this.switch_value = value;
      return options.fn(this);
    },
    case: function(value, options) {
      if (value == this.switch_value) {
        return options.fn(this);
      }
    },
    // Mantener helpers específicos existentes
    eq: (v1, v2) => v1 === v2,
    neq: (v1, v2) => v1 !== v2,
    // Helpers de comparación
    gt: (v1, v2) => v1 > v2,
    gte: (v1, v2) => v1 >= v2,
    lt: (v1, v2) => v1 < v2,
    lte: (v1, v2) => v1 <= v2,
    // AGREGADO: Helper "not" para negación lógica
    not: (value) => !value,
    hasRole: (userRole, roles) => {
      if (!userRole) return false;
      if (typeof roles === 'string') {
        if (roles.includes(',')) {
          const roleArray = roles.split(',').map(r => r.trim());
          return roleArray.includes(userRole);
        }
        return userRole === roles;
      }
      return roles.includes(userRole);
    },
    or: (...args) => {
      return Array.prototype.slice.call(args, 0, -1).some(Boolean);
    },
    isActiveLink: (path, currentPath) => {
      return currentPath.startsWith(path) ? 'active' : '';
    },
    // formatDate removido - se usa el helper correcto de utils/handlebarsHelpers.js
    formatTimeAgo: (date) => {
      if (!date) return '';
      
      // Crear fechas usando zona horaria de Ecuador para cálculos precisos
      const now = new Date();
      const dateEcuador = new Date(date);
      const seconds = Math.floor((now - dateEcuador) / 1000);
      
      if (seconds < 60) return 'Hace un momento';
      
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `Hace ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
      
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `Hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
      
      const days = Math.floor(hours / 24);
      if (days < 30) return `Hace ${days} ${days === 1 ? 'día' : 'días'}`;
      
      // Usar formatDate que ya tiene la zona horaria correcta
      return new Date(date).toLocaleDateString('es-ES', {
        timeZone: 'America/Guayaquil',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    },
    translateEstado: (estado) => {
      const traducciones = {
        'en_proceso': 'En Proceso',
        'listo_para_entrega': 'Listo para Entrega',
        'entregado': 'Entregado',
        'nota_credito': 'Nota de Crédito',
        'eliminado': 'Eliminado (Solo Auditoría)'
      };
      return traducciones[estado] || estado;
    },
    stringifyNumber: (num) => {
      return num ? num.toString() : '';
    },
    // Helper para buscar elementos en un array por índice
    lookup: function(obj, index) {
      return obj[index];
    },
    // Helper para sumar números
    add: function(a, b) {
      return parseInt(a) + parseInt(b);
    },
    // Helper para dividir números (para cálculos de porcentajes)
    divide: function(a, b) {
      const num1 = parseFloat(a) || 0;
      const num2 = parseFloat(b) || 0;
      if (num2 === 0) return 0;
      return num1 / num2;
    },
    // Helpers de comparación para las vistas
    eq: function(a, b) {
      return a === b;
    },
    ne: function(a, b) {
      return a !== b;
    },
    gt: function(a, b) {
      return parseFloat(a) > parseFloat(b);
    },
    lt: function(a, b) {
      return parseFloat(a) < parseFloat(b);
    },
    gte: function(a, b) {
      return parseFloat(a) >= parseFloat(b);
    },
    lte: function(a, b) {
      return parseFloat(a) <= parseFloat(b);
    },
    // Helper para convertir objeto a JSON string
    json: (context) => {
      return JSON.stringify(context);
    },
    // Helper para formatear valores monetarios (máximo 2 decimales)
    formatMoney: (value) => {
      if (value === null || value === undefined || value === '') {
        return '0.00';
      }
      const numero = parseFloat(value);
      if (isNaN(numero)) {
        return '0.00';
      }
      return (Math.round(numero * 100) / 100).toFixed(2);
    },
    // Helper para calcular el tiempo transcurrido entre dos fechas
    tiempoTranscurrido: (fechaInicio, fechaFin) => {
      if (!fechaInicio || !fechaFin) return 'N/A';
      
      // Crear fechas asegurando manejo correcto de zona horaria
      const inicio = new Date(fechaInicio);
      const fin = new Date(fechaFin);
      
      // Calcular diferencia en milisegundos
      const diffMs = fin - inicio;
      
      // Si hay error o fechas inversas
      if (isNaN(diffMs) || diffMs < 0) return 'N/A';
      
      // Convertir a unidades de tiempo
      const segundos = Math.floor(diffMs / 1000);
      const minutos = Math.floor(segundos / 60);
      const horas = Math.floor(minutos / 60);
      const dias = Math.floor(horas / 24);
      
      // Formatear para mostrar (formato más compacto)
      if (dias > 0) {
        return `${dias}d ${horas % 24}h ${minutos % 60}m`;
      } else if (horas > 0) {
        return `${horas}h ${minutos % 60}m`;
      } else if (minutos > 0) {
        return `${minutos}m`;
      } else {
        return 'Inmediato';
      }
    },
    // Helper para determinar si un usuario puede editar un documento
    puedeEditarDocumento: (usuario, documento) => {
      console.log('DEBUG Helper puedeEditarDocumento:', 
        JSON.stringify({
          usuario: usuario ? { 
            id: usuario.id, 
            rol: usuario.rol 
          } : 'undefined',
          documento: documento ? { 
            id: documento.id, 
            estado: documento.estado,
            idMatrizador: documento.idMatrizador
          } : 'undefined'
        })
      );
      
      if (!usuario || !documento) return false;

      if (usuario.rol === 'admin') {
        // Admin puede editar si no está entregado
        return documento.estado !== 'entregado';
      }

      if (usuario.rol === 'matrizador') {
        // Matrizador puede editar si es suyo y está en proceso o registrado
        // Asumimos que 'registrado' es un alias válido o se maneja como 'en_proceso'
        return documento.idMatrizador === usuario.id && 
               (documento.estado === 'en_proceso' || documento.estado === 'registrado');
      }
      
      // Recepción y otros roles no pueden editar
      return false;
    },
    // Helper para determinar si recepción puede marcar un documento como listo
    puedeMarcarComoListoRecepcion: (usuario, documento) => {
      if (!usuario || !documento) return false;

      // Solo el rol 'recepcion' puede marcar como listo
      // y solo si el documento está 'en_proceso'
      return usuario.rol === 'recepcion' && documento.estado === 'en_proceso';
    },
    // formatDateTime removido - se usa el helper correcto de utils/handlebarsHelpers.js
    // Helper para contar eventos por tipo específico
    contarEventosPorTipo: (eventos, tipo) => {
      if (!eventos || !Array.isArray(eventos)) return 0;
      return eventos.filter(evento => evento.tipo === tipo).length;
    },
    // Helper para contar eventos por categoría
    contarEventosPorCategoria: (eventos, categoria) => {
      if (!eventos || !Array.isArray(eventos)) return 0;
      return eventos.filter(evento => evento.categoria === categoria).length;
    },
    // Helper para verificar si hay eventos de un tipo específico
    tieneEventosTipo: (eventos, tipo) => {
      if (!eventos || !Array.isArray(eventos)) return false;
      return eventos.some(evento => evento.tipo === tipo);
    },
    // Helper para obtener el último evento de un tipo
    ultimoEventoTipo: (eventos, tipo) => {
      if (!eventos || !Array.isArray(eventos)) return null;
      return eventos.find(evento => evento.tipo === tipo);
    },
    // Helper para formatear estados con colores
    formatearEstadoColor: (estado) => {
      const estados = {
        'en_proceso': { texto: 'En Proceso', color: 'warning' },
        'listo_para_entrega': { texto: 'Listo para Entrega', color: 'info' },
        'entregado': { texto: 'Entregado', color: 'success' },
        'nota_credito': { texto: 'Nota de Crédito', color: 'secondary' },
        'eliminado': { texto: 'Eliminado', color: 'danger' }
      };
      return estados[estado] || { texto: estado, color: 'secondary' };
    },
    // Helper para operaciones lógicas AND
    and: function() {
      const args = Array.prototype.slice.call(arguments, 0, -1);
      return args.every(Boolean);
    },
    // Helper para operaciones lógicas OR
    or: function() {
      const args = Array.prototype.slice.call(arguments, 0, -1);
      return args.some(Boolean);
    },
    // AGREGADO: Helper "map" para mapear arrays
    map: function(array, property) {
      if (!Array.isArray(array)) return [];
      return array.map(item => {
        if (typeof property === 'string') {
          return item[property];
        }
        return item;
      });
    },
    // formatDateOnly removido - se usa el helper correcto de utils/handlebarsHelpers.js
    // AGREGADO: Helper para calcular días transcurridos desde una fecha
    daysSince: (date) => {
      if (!date) return 0;
      const now = new Date();
      const targetDate = new Date(date);
      const diffTime = Math.abs(now - targetDate);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    },
    // Helper específico para fechas de documentos (sin conversión de zona horaria)
    formatDateDocument: (date) => {
      if (!date) return '';
      // Para fechas de documentos, usar la fecha tal como está almacenada
      // sin conversión de zona horaria para evitar cambios de día
      const dateObj = new Date(date);
      const day = String(dateObj.getUTCDate()).padStart(2, '0');
      const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
      const year = dateObj.getUTCFullYear();
      return `${day}/${month}/${year}`;
    },
    
    // === ESTRATEGIA DE FECHAS PARA NOTARÍA ===
    
    // Helper para fecha operacional (cuándo se procesó en el sistema)
    formatDateOperacional: (date) => {
      if (!date) return '';
      const dateObj = new Date(date);
      const day = String(dateObj.getUTCDate()).padStart(2, '0');
      const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
      const year = dateObj.getUTCFullYear();
      return `${day}/${month}/${year}`;
    },
    
    // Helper para fecha contable (fecha real del acto notarial)
    formatDateContable: (date) => {
      if (!date) return '';
      const dateObj = new Date(date);
      const day = String(dateObj.getUTCDate()).padStart(2, '0');
      const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
      const year = dateObj.getUTCFullYear();
      return `${day}/${month}/${year}`;
    },
    
    // Helper para calcular días de atraso (desde fecha del documento hasta hoy)
    diasAtraso: (fechaDocumento) => {
      if (!fechaDocumento) return 0;
      const hoy = new Date();
      const fechaDoc = new Date(fechaDocumento);
      const diffTime = hoy - fechaDoc;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays); // No negativos
    },
    
    // Helper para calcular días desde registro (productividad)
    diasDesdeRegistro: (fechaRegistro) => {
      if (!fechaRegistro) return 0;
      const hoy = new Date();
      const fechaReg = new Date(fechaRegistro);
      const diffTime = hoy - fechaReg;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays); // No negativos
    },
    
    // Helper para determinar qué fecha mostrar según contexto
    fechaSegunContexto: (documento, contexto) => {
      if (!documento) return '';
      
      switch (contexto) {
        case 'operacional':
        case 'productividad':
        case 'workflow':
          // Usar fecha de registro del sistema
          return documento.created_at ? 
            new Date(documento.created_at).toLocaleDateString('es-ES') : '';
            
        case 'contable':
        case 'financiero':
        case 'legal':
          // Usar fecha del documento original
          return documento.fechaFactura ? 
            new Date(documento.fechaFactura).toLocaleDateString('es-ES') : '';
            
        default:
          // Por defecto, operacional
          return documento.created_at ? 
            new Date(documento.created_at).toLocaleDateString('es-ES') : '';
      }
    },
    // NUEVO: Helper moment para formatear fechas con moment.js
    moment: function(date, format) {
      if (!date) return '';
      const moment = require('moment');
      moment.locale('es'); // Configurar en español
      return moment(date).format(format || 'DD/MM/YYYY HH:mm:ss');
    },
    // Helper para construir query strings para paginación
    buildQueryString: function(params) {
      if (!params || typeof params !== 'object') return '';
      
      const query = new URLSearchParams();
      
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
          query.append(key, params[key]);
        }
      });
      
      const queryString = query.toString();
      return queryString ? '?' + queryString : '';
    },
  }
});

// Registrar el motor de plantillas
app.engine('hbs', hbs);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Servir archivos estáticos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Rutas de la API
const documentoRoutes = require('./routes/documentoRoutes');
const matrizadorRoutes = require('./routes/matrizadorRoutes');
const documentoRelacionRoutes = require('./routes/documentoRelacionRoutes');
const recepcionRoutes = require('./routes/recepcionRoutes');
const cajaRoutes = require('./routes/cajaRoutes');
const adminRoutes = require('./routes/adminRoutes');
const archivoRoutes = require('./routes/archivoRoutes');
const eliminacionRoutes = require('./routes/eliminacionRoutes');

// Importar middleware de autenticación
const { verificarToken } = require('./middlewares/auth');

app.use('/api/documentos', documentoRoutes);
app.use('/api/matrizadores', matrizadorRoutes);
app.use('/api/documento-relaciones', documentoRelacionRoutes);
app.use('/matrizador', matrizadorRoutes);
app.use('/recepcion', recepcionRoutes);
app.use('/caja', cajaRoutes);
app.use('/admin', adminRoutes);
app.use('/archivo', archivoRoutes);
// Rutas de eliminación definitiva (solo para administradores)
app.use('/api/admin', verificarToken, eliminacionRoutes);

// Ruta de login
app.get('/login', (req, res) => {
  res.render('login', {
    title: 'Iniciar Sesión',
    error: req.query.error
  });
});

// Ruta principal (redirección según rol)
app.get('/', (req, res) => {
  // Si no hay token, redirigir al login
  if (!req.cookies?.token) {
    return res.redirect('/login');
  }
  
  // Intentar decodificar el token para obtener el rol
  try {
    const token = req.cookies.token;
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'clave_secreta_notaria_2024');
    
    // Redirigir según el rol
    switch (decoded.rol) {
      case 'admin':
        return res.redirect('/admin');
      case 'matrizador':
        return res.redirect('/matrizador');
      case 'recepcion':
        return res.redirect('/recepcion');
      case 'caja':
        return res.redirect('/caja');
      case 'caja_archivo':
        return res.redirect('/caja'); // caja_archivo redirige a caja por defecto
      case 'archivo':
        return res.redirect('/archivo');
      default:
        return res.redirect('/login');
    }
  } catch (error) {
    // Si hay error al decodificar el token, redirigir al login
    console.error('Error al decodificar token en ruta principal:', error);
    return res.redirect('/login');
  }
});

// Ruta de logout global
app.get('/logout', (req, res) => {
  // Eliminar la cookie del token
  res.clearCookie('token');
  
  // Redirigir a la página de login
  return res.redirect('/login');
});

// Manejo de rutas no encontradas
app.use(async (req, res) => {
  // Intentar determinar el usuario autenticado sin redirigir
  let layout = 'main'; // layout por defecto
  let userRole = '';
  let userName = '';
  
  try {
    // Obtener token de cabecera, cookie o query param
    const token = 
      req.headers.authorization?.split(' ')[1] || 
      req.cookies?.token || 
      req.query?.token;
    
    if (token) {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'clave_secreta_notaria_2024');
      
      if (decoded.id) {
        const Matrizador = require('./models/Matrizador');
        const matrizador = await Matrizador.findByPk(decoded.id);
        
        if (matrizador && matrizador.activo) {
          userRole = matrizador.rol;
          userName = matrizador.nombre;
          
          switch (matrizador.rol) {
            case 'admin':
              layout = 'admin';
              break;
            case 'matrizador':
              layout = 'matrizador';
              break;
            case 'recepcion':
              layout = 'recepcion';
              break;
            case 'caja':
              layout = 'caja';
              break;
            case 'caja_archivo':
              layout = 'caja'; // caja_archivo usa layout de caja
              break;
            case 'archivo':
              layout = 'archivo';
              break;
            default:
              layout = 'main';
          }
        }
      }
    }
  } catch (error) {
    // En caso de error, usar layout por defecto
    console.log('Error al verificar token en 404:', error.message);
  }
  
  res.status(404).render('error', {
    layout,
    title: 'Página no encontrada',
    message: 'La página que buscas no existe',
    userRole,
    userName
  });
});

// Iniciar el servidor
app.listen(PORT, async () => {
  console.log(`🚀 Servidor iniciado en http://localhost:${PORT}`);
  
  // Probar conexión a la base de datos
  const dbConnected = await testConnection();
  if (dbConnected) {
    console.log('🔌 Base de datos conectada correctamente');
    
    // Sincronizar modelos con la base de datos
    await syncModels();
    
    // Inicializar el servicio de notificaciones después de la conexión a BD
    try {
      const notificationService = require('./services/notificationService');
      const servicioInicializado = await notificationService.inicializar();
      
      if (servicioInicializado) {
        console.log('📱 Servicio de notificaciones WhatsApp inicializado correctamente');
      } else {
        console.log('⚠️ El servicio de notificaciones no se pudo inicializar completamente');
      }
    } catch (notificationError) {
      console.error('❌ Error al inicializar servicio de notificaciones:', notificationError.message);
      console.log('   El sistema funcionará sin notificaciones automáticas');
    }
  } else {
    console.log('⚠️ No se pudo conectar a la base de datos');
  }
  
  console.log('✅ ¡Sistema de Trazabilidad Documental iniciado correctamente!');
  console.log('👉 Panel administrativo disponible en http://localhost:' + PORT + '/admin');
  console.log('👉 Página de login disponible en http://localhost:' + PORT + '/login');
});

// Manejo de errores no capturados
process.on('unhandledRejection', (err) => {
  console.error('Error no controlado:', err);
});

module.exports = app; 