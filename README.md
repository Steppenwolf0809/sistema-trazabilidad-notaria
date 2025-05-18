# Sistema de Trazabilidad Documental para Notarías

Este sistema permite gestionar la trazabilidad completa de documentos notariales, desde su creación hasta su entrega, con un enfoque en la seguridad y verificación mediante códigos de autenticación.

## Características principales

- **Gestión de Documentos**: Registra y administra documentos notariales con códigos únicos.
- **Verificación Segura**: Sistema de códigos de verificación numéricos (4 dígitos) para entrega a terceros.
- **Trazabilidad Completa**: Seguimiento del ciclo de vida de cada documento.
- **Notificaciones**: Envío de alertas por correo electrónico y WhatsApp cuando los documentos están listos.
- **Diferenciación de Entregas**: El titular puede recoger el documento directamente, mientras que terceros deben verificar un código.

## Tecnologías utilizadas

- **Backend**: Node.js con Express
- **Frontend**: Handlebars, Bootstrap 5
- **Base de datos**: PostgreSQL (Sequelize ORM)
- **Autenticación**: JWT

## Estructura del proyecto

```
sistema-notaria/
├── config/         # Configuración de la aplicación
├── controllers/    # Controladores de la aplicación
├── models/         # Modelos de datos (Sequelize)
├── routes/         # Rutas de la API
├── views/          # Plantillas Handlebars
│   ├── layouts/    # Layouts principales
│   ├── documentos/ # Vistas de documentos
│   └── partials/   # Componentes reutilizables
├── public/         # Archivos estáticos (CSS, JS, imágenes)
├── services/       # Servicios (correo, WhatsApp, etc.)
└── app.js          # Punto de entrada de la aplicación
```

## Flujo del sistema

1. El matrizador registra un documento en el sistema.
2. Cuando el documento está listo, se genera un código de verificación y se envía al cliente.
3. El cliente puede recoger el documento directamente como titular.
4. Si un tercero recoge el documento, debe proporcionar el código de verificación.
5. El sistema registra la entrega y envía confirmación al titular.

## Instalación

```bash
# Clonar el repositorio
git clone https://github.com/Steppenwolf0809/sistema-trazabilidad-notaria

# Instalar dependencias
cd sistema-trazabilidad-notaria
npm install

# Configurar variables de entorno
cp .env-sample .env
# Editar .env con tus configuraciones

# Iniciar el servidor
npm start
```

## Demo

Para probar el sistema en modo demo:
- URL: http://localhost:3000
- Código de verificación para pruebas: 1234 