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
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
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
      
      // Formatear para mostrar
      if (dias > 0) {
        return `${dias} día(s), ${horas % 24} hora(s), ${minutos % 60} minuto(s)`;
      } else if (horas > 0) {
        return `${horas} hora(s), ${minutos % 60} minuto(s), ${segundos % 60} segundo(s)`;
      } else if (minutos > 0) {
        return `${minutos} minuto(s), ${segundos % 60} segundo(s)`;
      } else {
        return `${segundos} segundo(s)`;
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
const documentoRelacionRoutes = require('./routes/documentoRelacionRoutes');
const recepcionRoutes = require('./routes/recepcionRoutes');
const cajaRoutes = require('./routes/cajaRoutes');
app.use('/api/documentos', documentoRoutes);
app.use('/api/matrizadores', matrizadorRoutes);
app.use('/api/documento-relaciones', documentoRelacionRoutes);
app.use('/matrizador', matrizadorRoutes);
app.use('/recepcion', recepcionRoutes);
app.use('/caja', cajaRoutes);

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