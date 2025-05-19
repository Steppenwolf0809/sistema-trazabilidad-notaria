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
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    },
    formatTimeAgo: (date) => {
      if (!date) return '';
      const seconds = Math.floor((new Date() - new Date(date)) / 1000);
      
      if (seconds < 60) return 'Hace un momento';
      
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `Hace ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
      
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `Hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
      
      const days = Math.floor(hours / 24);
      if (days < 30) return `Hace ${days} ${days === 1 ? 'día' : 'días'}`;
      
      return formatDate(date);
    },
    translateEstado: (estado) => {
      const traducciones = {
        'en_proceso': 'En Proceso',
        'listo_para_entrega': 'Listo para Entrega',
        'entregado': 'Entregado',
        'cancelado': 'Cancelado'
      };
      return traducciones[estado] || estado;
    }
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
app.use('/api/documentos', documentoRoutes);
app.use('/api/matrizadores', matrizadorRoutes);

// Rutas administrativas
const adminRoutes = require('./routes/adminRoutes');
app.use('/admin', adminRoutes);

// Ruta de login
app.get('/login', (req, res) => {
  res.render('login', {
    title: 'Iniciar Sesión',
    error: req.query.error
  });
});

// Ruta principal (redirección al panel administrativo)
app.get('/', (req, res) => {
  res.redirect('/admin');
});

// Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).render('error', {
    layout: 'admin',
    title: 'Página no encontrada',
    message: 'La página que buscas no existe'
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