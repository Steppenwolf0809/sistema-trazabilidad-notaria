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
    eq: (v1, v2) => v1 === v2,
    neq: (v1, v2) => v1 !== v2,
    // Helpers de comparación
    gt: (v1, v2) => v1 > v2,
    gte: (v1, v2) => v1 >= v2,
    lt: (v1, v2) => v1 < v2,
    lte: (v1, v2) => v1 <= v2,
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
    formatDate: (date) => {
      if (!date) return '';
      return new Date(date).toLocaleDateString('es-ES', {
        timeZone: 'America/Guayaquil', // Zona horaria de Ecuador UTC-5
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    },
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
    // Helper para formatear fecha y hora más detallado
    formatDateTime: (date) => {
      if (!date) return '';
      return new Date(date).toLocaleString('es-ES', {
        timeZone: 'America/Guayaquil', // Zona horaria de Ecuador UTC-5
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    },
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