// Script para crear los archivos de plantillas
const fs = require('fs');
const path = require('path');

// Contenido del layout principal
const mainLayout = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{title}} - Sistema Notarial</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    body { background-color: #f8f9fa; }
    .navbar-brand { font-weight: bold; }
    footer { margin-top: 3rem; padding: 1.5rem 0; background-color: #212529; color: #ffffff; }
  </style>
</head>
<body>
  <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
    <div class="container">
      <a class="navbar-brand" href="/">
        <i class="fas fa-file-contract me-2"></i> Notaría Digital
      </a>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse" id="navbarNav">
        <ul class="navbar-nav ms-auto">
          <li class="nav-item">
            <a class="nav-link" href="/">Inicio</a>
          </li>
          <li class="nav-item">
            <a class="nav-link" href="/documentos/verificacion/CODIGO123">Verificar Documento</a>
          </li>
        </ul>
      </div>
    </div>
  </nav>
  <main class="container mt-4">
    {{{body}}}
  </main>
  <footer class="text-center">
    <div class="container">
      <p>Sistema de Trazabilidad Documental para Notarías &copy; 2023</p>
    </div>
  </footer>
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>`;

// Contenido de la página de inicio
const homePage = `<div class="row">
  <div class="col-md-12 mb-4">
    <div class="text-center p-5 bg-primary text-white rounded">
      <h1>Sistema de Trazabilidad Documental</h1>
      <p class="lead">Gestión y seguimiento eficiente de documentos notariales</p>
    </div>
  </div>
</div>

<div class="row">
  <div class="col-md-4 mb-4">
    <div class="card h-100">
      <div class="card-body text-center">
        <i class="fas fa-search fa-3x text-primary mb-3"></i>
        <h4 class="card-title">Verificación de Documentos</h4>
        <p class="card-text">Compruebe el estado de sus documentos notariales mediante el código de verificación.</p>
        <a href="/documentos/verificacion/CODIGO123" class="btn btn-outline-primary">Verificar documento</a>
      </div>
    </div>
  </div>
  
  <div class="col-md-4 mb-4">
    <div class="card h-100">
      <div class="card-body text-center">
        <i class="fas fa-file-signature fa-3x text-primary mb-3"></i>
        <h4 class="card-title">Entrega Segura</h4>
        <p class="card-text">Sistema de entrega con verificación de identidad y códigos de seguridad.</p>
      </div>
    </div>
  </div>
  
  <div class="col-md-4 mb-4">
    <div class="card h-100">
      <div class="card-body text-center">
        <i class="fas fa-history fa-3x text-primary mb-3"></i>
        <h4 class="card-title">Trazabilidad Completa</h4>
        <p class="card-text">Seguimiento del ciclo de vida completo de cada documento notarial.</p>
      </div>
    </div>
  </div>
</div>

<div class="row mt-4">
  <div class="col-12">
    <div class="card">
      <div class="card-header bg-light">
        <h3>¿Cómo funciona?</h3>
      </div>
      <div class="card-body">
        <ol class="lead">
          <li class="mb-3">Cuando su documento esté listo, recibirá un <strong>código de verificación</strong> por correo electrónico o WhatsApp.</li>
          <li class="mb-3">Si usted es el titular, puede recoger el documento directamente presentando su identificación.</li>
          <li class="mb-3">Si un tercero recoge el documento por usted, deberá proporcionar el código de verificación de 4 dígitos.</li>
          <li class="mb-3">El sistema registra automáticamente la entrega y envía una confirmación al titular.</li>
        </ol>
      </div>
    </div>
  </div>
</div>`;

// Contenido del error
const errorPage = `<div class="row justify-content-center">
  <div class="col-md-8 text-center">
    <div class="py-5">
      <i class="fas fa-exclamation-triangle fa-5x text-warning mb-4"></i>
      <h1 class="display-4">{{title}}</h1>
      <p class="lead">{{message}}</p>
      <hr class="my-4">
      <p>Verifique la URL o regrese a la página de inicio.</p>
      <a href="/" class="btn btn-primary btn-lg mt-3">
        <i class="fas fa-home me-2"></i> Volver al inicio
      </a>
    </div>
  </div>
</div>`;

// Verificar que existan los directorios
const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Directorio creado: ${dirPath}`);
  }
};

// Crear los archivos
const createFile = (filePath, content) => {
  fs.writeFileSync(filePath, content);
  console.log(`Archivo creado: ${filePath}`);
};

// Estructura de directorios
ensureDir(path.join(__dirname, 'views'));
ensureDir(path.join(__dirname, 'views/layouts'));
ensureDir(path.join(__dirname, 'views/documentos'));
ensureDir(path.join(__dirname, 'views/partials'));

// Crear los archivos de plantillas
createFile(path.join(__dirname, 'views/layouts/main.hbs'), mainLayout);
createFile(path.join(__dirname, 'views/home.hbs'), homePage);
createFile(path.join(__dirname, 'views/error.hbs'), errorPage);

console.log('¡Plantillas creadas exitosamente!'); 