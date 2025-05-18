/**
 * Punto de entrada principal para el Sistema de Trazabilidad Documental
 * Configura el servidor Express y todas las rutas de la aplicación
 */

// Importaciones de paquetes
const express = require('express');
const cors = require('cors');
const { engine } = require('express-handlebars');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const flash = require('connect-flash');

// Importación de configuración de base de datos
const { testConnection } = require('./config/database');

// Creación de la aplicación Express
const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de middleware
app.use(cors()); // Habilita CORS para todas las rutas
app.use(bodyParser.json()); // Parsea cuerpos de solicitud en formato JSON
app.use(bodyParser.urlencoded({ extended: true })); // Parsea cuerpos de solicitud desde formularios

// Configuración de sesión
app.use(session({
  secret: process.env.SESSION_SECRET || 'notaria-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 horas
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
app.engine('hbs', engine({
  extname: '.hbs', // Extensión de archivos de plantilla
  defaultLayout: 'main', // Diseño por defecto
  layoutsDir: path.join(__dirname, 'views/layouts'), // Directorio de layouts
  partialsDir: path.join(__dirname, 'views/partials'), // Directorio de partials
  helpers: {
    eq: (v1, v2) => v1 === v2,
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
}));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Servir archivos estáticos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Rutas de la API
const documentoRoutes = require('./routes/documentoRoutes');
app.use('/api/documentos', documentoRoutes);

// Rutas administrativas
const adminRoutes = require('./routes/adminRoutes');
app.use('/admin', adminRoutes);

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
  } else {
    console.log('⚠️ No se pudo conectar a la base de datos');
  }
  
  console.log('✅ ¡Sistema de Trazabilidad Documental iniciado correctamente!');
  console.log('👉 Panel administrativo disponible en http://localhost:' + PORT + '/admin');
});

// Manejo de errores no capturados
process.on('unhandledRejection', (err) => {
  console.error('Error no controlado:', err);
});

module.exports = app; 