const express = require('express');
const app = express();
const PORT = 3000;

// Ruta simple
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Sistema Notarial</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
      </head>
      <body>
        <div class="container mt-5">
          <div class="row">
            <div class="col-md-12 text-center">
              <h1 class="display-4 mb-4">Sistema de Trazabilidad Documental</h1>
              <p class="lead">Gestión y seguimiento eficiente de documentos notariales</p>
              <hr class="my-4">
              <div class="card p-4 mt-4 mb-4">
                <i class="fas fa-file-contract fa-4x text-primary mb-3"></i>
                <h2>Verificación de Documentos</h2>
                <p>Verifique el estado de sus documentos notariales mediante códigos de seguridad</p>
                <p>Para la demo, el código válido es: <strong>1234</strong></p>
              </div>
              <div class="mt-5">
                <h3>Información de Contacto</h3>
                <p><i class="fas fa-phone me-2"></i> +1 234 567 890</p>
                <p><i class="fas fa-envelope me-2"></i> info@notariadigital.com</p>
              </div>
            </div>
          </div>
        </div>
        <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
      </body>
    </html>
  `);
});

// Formulario de verificación
app.get('/verificar', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Verificación - Sistema Notarial</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
      </head>
      <body>
        <div class="container mt-5">
          <div class="row justify-content-center">
            <div class="col-md-6">
              <div class="card">
                <div class="card-header bg-primary text-white">
                  <h4 class="mb-0">Verificación de Código</h4>
                </div>
                <div class="card-body">
                  <form id="form-verificacion">
                    <div class="mb-3">
                      <label for="codigo" class="form-label">Código de Verificación</label>
                      <input type="text" class="form-control form-control-lg text-center" id="codigo" name="codigo" maxlength="4" placeholder="1234" required>
                      <div class="form-text">Introduzca el código numérico de 4 dígitos</div>
                    </div>
                    
                    <div class="mb-3">
                      <label for="nombreReceptor" class="form-label">Nombre del Receptor</label>
                      <input type="text" class="form-control" id="nombreReceptor" name="nombreReceptor" required>
                    </div>
                    
                    <div class="mb-3">
                      <label for="relacionReceptor" class="form-label">Relación con el Titular</label>
                      <select class="form-select" id="relacionReceptor" name="relacionReceptor" required>
                        <option value="">Seleccione...</option>
                        <option value="titular">Titular</option>
                        <option value="familiar">Familiar</option>
                        <option value="mandatario">Mandatario</option>
                        <option value="otro">Otro</option>
                      </select>
                    </div>
                    
                    <div class="text-center mt-4">
                      <button type="submit" class="btn btn-primary btn-lg px-5">Verificar</button>
                    </div>
                  </form>
                </div>
              </div>
              <div class="text-center mt-3">
                <a href="/" class="btn btn-outline-secondary"><i class="fas fa-arrow-left me-2"></i>Volver a inicio</a>
              </div>
            </div>
          </div>
        </div>
        <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
        <script>
          document.getElementById('form-verificacion').addEventListener('submit', function(e) {
            e.preventDefault();
            const codigo = document.getElementById('codigo').value;
            if (codigo === '1234') {
              alert('Código válido. Documento listo para entrega.');
            } else {
              alert('Código inválido. Por favor verifique.');
            }
          });
        </script>
      </body>
    </html>
  `);
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor iniciado en http://localhost:${PORT}`);
}); 