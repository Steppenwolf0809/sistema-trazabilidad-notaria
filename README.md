# Sistema de Trazabilidad Documental para Notarías

Sistema integral para la gestión completa de documentos notariales, desde su creación hasta su entrega, con enfoque en seguridad, trazabilidad y gestión financiera avanzada.

## 🚀 Características Principales

### 📄 **Gestión de Documentos**
- **Registro Automático**: Carga de documentos mediante archivos XML
- **Códigos Únicos**: Generación automática de códigos de barras únicos
- **Estados del Documento**: Seguimiento completo del ciclo de vida
- **Tipos de Documento**: Protocolo, Diligencias, Certificaciones, Arrendamientos, Otros
- **Asignación de Matrizadores**: Sistema de asignación y reasignación

### 🔐 **Sistema de Verificación y Entrega**
- **Códigos de Verificación**: Códigos numéricos de 4 dígitos para entrega segura
- **Diferenciación de Entregas**: 
  - Titular: Recoge directamente con identificación
  - Terceros: Requieren código de verificación
- **Registro de Entregas**: Trazabilidad completa de quién recibe cada documento

### 💰 **Sistema de Pagos Avanzado con Retenciones**
- **Gestión Financiera Completa**: Control total de facturación y pagos
- **Estados de Pago**: pendiente, pago_parcial, pagado_completo, pagado_con_retencion
- **Múltiples Formas de Pago**: Efectivo, transferencia, tarjetas, cheques
- **Sistema de Retenciones Automático**:
  - Procesamiento automático de PDFs de retención
  - Extracción automática de valores (IVA, Renta)
  - Validación matemática de retenciones
  - Cálculo automático de valores netos
- **Validaciones Inteligentes**: Prevención de pagos duplicados o excesivos
- **Historial de Pagos**: Registro detallado de todos los movimientos

### 📊 **Reportes y Estadísticas**
- **Dashboard Ejecutivo**: Métricas en tiempo real
- **Reportes de Caja**: Ingresos, pagos pendientes, retenciones
- **Reportes por Matrizador**: Productividad y rendimiento
- **Análisis Temporal**: Filtros por fechas y períodos
- **Exportación de Datos**: Reportes en múltiples formatos

### 🔔 **Sistema de Notificaciones**
- **Notificaciones Automáticas**: Email y WhatsApp cuando documentos están listos
- **Configuración Flexible**: Control de qué documentos notificar
- **Plantillas Personalizables**: Mensajes adaptados por tipo de documento
- **Seguimiento de Entregas**: Confirmaciones automáticas

### 👥 **Gestión de Usuarios y Roles**
- **Roles Diferenciados**:
  - **Admin**: Control total del sistema
  - **Caja**: Gestión financiera y documentos
  - **Caja_Archivo**: Funciones híbridas (caja + matrizador)
  - **Matrizador**: Creación y gestión de documentos
  - **Recepción**: Entrega de documentos
- **Autenticación Segura**: JWT con expiración automática
- **Permisos Granulares**: Control de acceso por funcionalidad

## 🏗️ Arquitectura del Sistema

### **Tecnologías Utilizadas**
- **Backend**: Node.js con Express.js
- **Frontend**: Handlebars, Bootstrap 5, JavaScript ES6+
- **Base de Datos**: PostgreSQL con Sequelize ORM
- **Autenticación**: JWT (JSON Web Tokens)
- **Procesamiento de Archivos**: Multer, PDF-Parse
- **Notificaciones**: Nodemailer, WhatsApp API
- **Logging**: Winston para auditoría completa

### **Estructura del Proyecto**
```
sistema-notaria/
├── config/             # Configuración de la aplicación
│   ├── database.js     # Configuración de PostgreSQL
│   └── logger.js       # Sistema de logging
├── controllers/        # Controladores de la aplicación
│   ├── adminController.js
│   ├── cajaController.js
│   ├── matrizadorController.js
│   └── recepcionController.js
├── models/            # Modelos de datos (Sequelize)
│   ├── Documento.js   # Modelo principal de documentos
│   ├── Pago.js        # Sistema de pagos
│   ├── EventoDocumento.js # Auditoría y trazabilidad
│   └── Matrizador.js  # Usuarios del sistema
├── routes/            # Rutas de la API
├── views/             # Plantillas Handlebars
│   ├── layouts/       # Layouts por rol
│   ├── admin/         # Vistas administrativas
│   ├── caja/          # Gestión financiera
│   ├── matrizadores/  # Creación de documentos
│   └── recepcion/     # Entrega de documentos
├── utils/             # Utilidades del sistema
│   ├── mathValidation.js # Validaciones matemáticas
│   ├── pdfProcessor.js   # Procesamiento de PDFs
│   └── timestampUtils.js # Manejo de fechas
├── services/          # Servicios externos
│   ├── emailService.js
│   └── whatsappService.js
├── scripts/           # Scripts de mantenimiento
└── app.js            # Punto de entrada
```

## 🔄 Flujo Completo del Sistema

### **1. Creación de Documentos**
1. **Carga de XML**: El usuario de caja carga un archivo XML
2. **Procesamiento Automático**: Extracción de datos del XML
3. **Generación de Códigos**: Código de barras único y código de verificación
4. **Asignación**: Documento asignado a matrizador disponible
5. **Notificación**: Matrizador recibe notificación de nuevo documento

### **2. Gestión Financiera**
1. **Registro de Factura**: Valor extraído automáticamente del XML
2. **Procesamiento de Pagos**:
   - Pago simple (efectivo, transferencia, etc.)
   - Pago con retención (procesamiento automático de PDF)
3. **Validaciones**: Control de montos y prevención de errores
4. **Estados Automáticos**: Actualización automática según pagos realizados
5. **Reportes**: Generación automática de reportes financieros

### **3. Procesamiento de Retenciones**
1. **Carga de PDF**: Usuario sube comprobante de retención
2. **Extracción Automática**: 
   - Número de comprobante
   - Valores de retención (IVA, Renta)
   - Datos de empresa retenedora
3. **Validación Matemática**: Verificación de cálculos
4. **Aplicación Automática**: Actualización de estado de pago
5. **Registro Detallado**: Auditoría completa del proceso

### **4. Notificaciones y Entrega**
1. **Documento Listo**: Matrizador marca como "listo para entrega"
2. **Notificación Automática**: Email/WhatsApp al cliente
3. **Proceso de Entrega**:
   - **Titular**: Identificación + firma
   - **Tercero**: Código de verificación + identificación
4. **Confirmación**: Registro de entrega y notificación al titular

## 📋 Flujo Detallado por Roles - Ciclo de Vida de un Documento

### **🎯 ETAPA 1: INGRESO DEL DOCUMENTO**

#### **👤 ROL: CAJA**
**¿Qué hace?**
1. **Recibe el documento físico** del cliente junto con el XML
2. **Carga el archivo XML** al sistema desde `/caja/documentos/cargar`
3. **Verifica los datos extraídos** automáticamente:
   - Nombre del cliente
   - Tipo de documento
   - Valor de la factura
   - Fecha de creación
4. **Confirma la carga** - El sistema genera automáticamente:
   - Código de barras único (ej: `20251701018C00923`)
   - Código de verificación de 4 dígitos (ej: `7834`)
5. **Asigna matrizador** (automático o manual)
6. **Cobra el documento** si el cliente paga inmediatamente

**Estado del documento:** `en_proceso`
**Estado del pago:** `pendiente` (si no se pagó) o `pagado_completo` (si se pagó)

---

### **🎯 ETAPA 2: PROCESAMIENTO DEL DOCUMENTO**

#### **👤 ROL: MATRIZADOR**
**¿Qué hace?**
1. **Ve sus documentos asignados** en `/matrizadores/documentos`
2. **Accede al detalle** del documento para trabajar en él
3. **Realiza el trabajo notarial** (redacción, revisión, etc.)
4. **Puede editar información** si encuentra errores:
   - Corregir nombre del cliente
   - Ajustar tipo de documento
   - Modificar observaciones
5. **Marca como "Listo para Entrega"** cuando termina el trabajo
6. **El sistema automáticamente**:
   - Cambia estado a `listo_para_entrega`
   - Envía notificación al cliente (email/WhatsApp)
   - Genera código de verificación para terceros

**Estado del documento:** `en_proceso` → `listo_para_entrega`

---

### **🎯 ETAPA 3: GESTIÓN DE PAGOS (Paralela o posterior)**

#### **👤 ROL: CAJA**
**¿Qué hace cuando el cliente viene a pagar?**

**ESCENARIO A: Pago Simple**
1. **Busca el documento** por código de barras o nombre
2. **Verifica el monto** a pagar
3. **Registra el pago** desde `/caja/documentos/detalle/{id}`
4. **Selecciona forma de pago**: efectivo, transferencia, tarjeta, cheque
5. **Confirma el pago** - El sistema actualiza automáticamente el estado

**ESCENARIO B: Pago con Retención**
1. **El cliente trae comprobante de retención** (PDF)
2. **Caja sube el PDF** al sistema
3. **El sistema automáticamente**:
   - Extrae valores de retención (IVA, Renta)
   - Calcula el valor neto a pagar
   - Actualiza el resumen de pago en tiempo real
4. **Caja registra el pago neto** (valor factura - retenciones)
5. **El sistema valida** que pago + retención = valor total
6. **Estado final**: `pagado_con_retencion`

**Estados de pago posibles:**
- `pendiente`: No se ha pagado nada
- `pago_parcial`: Se pagó parte del valor
- `pagado_completo`: Se pagó el valor total sin retenciones
- `pagado_con_retencion`: Se pagó considerando retenciones

---

### **🎯 ETAPA 4: NOTIFICACIONES AUTOMÁTICAS**

#### **👤 ROL: SISTEMA (Automático)**
**¿Qué hace cuando el documento está listo?**
1. **Detecta** que el documento cambió a `listo_para_entrega`
2. **Verifica** si debe notificar (configuración por tipo de documento)
3. **Envía notificación** al cliente:
   - **Email**: Con código de verificación y detalles
   - **WhatsApp**: Mensaje personalizado con código
4. **Registra** la notificación enviada para auditoría

**Tipos de notificación:**
- **Para titular**: "Su documento está listo. Código: 7834"
- **Información incluida**: Tipo de documento, fecha, código de verificación

---

### **🎯 ETAPA 5: ENTREGA DEL DOCUMENTO**

#### **👤 ROL: RECEPCIÓN**
**¿Qué hace cuando viene alguien a recoger?**

**ESCENARIO A: Recoge el Titular**
1. **Busca el documento** por código de barras o nombre en `/recepcion/entregas`
2. **Verifica identidad** del titular (cédula/pasaporte)
3. **Confirma que coincide** con los datos del documento
4. **Registra la entrega**:
   - Quien recibe: "TITULAR"
   - Identificación verificada
   - Firma digital o física
5. **Entrega el documento físico**
6. **Estado final**: `entregado`

**ESCENARIO B: Recoge un Tercero**
1. **Busca el documento** por código de barras
2. **Solicita código de verificación** (4 dígitos)
3. **Valida el código** en el sistema
4. **Verifica identidad** del tercero
5. **Registra la entrega**:
   - Quien recibe: Nombre del tercero
   - Identificación del tercero
   - Código de verificación usado
   - Relación con el titular
6. **Entrega el documento físico**
7. **El sistema envía confirmación** al titular
8. **Estado final**: `entregado`

---

### **🎯 CASOS ESPECIALES Y VALIDACIONES**

#### **🔄 REASIGNACIÓN DE MATRIZADORES**
**ROL: CAJA o ADMIN**
- Puede reasignar documentos entre matrizadores
- Útil cuando un matrizador está sobrecargado
- Se registra el cambio para auditoría

#### **📞 GESTIÓN DE NOTIFICACIONES**
**ROL: CAJA**
- Puede reenviar notificaciones manualmente
- Puede marcar documentos para NO notificar
- Puede cambiar datos de contacto del cliente

#### **💰 PAGOS PENDIENTES**
**ROL: CAJA**
- Ve todos los documentos con pagos pendientes
- Puede aplicar descuentos o ajustes (con permisos)
- Puede registrar pagos parciales
- Maneja devoluciones si es necesario

#### **🔍 BÚSQUEDA Y SEGUIMIENTO**
**TODOS LOS ROLES**
- Pueden buscar documentos por:
  - Código de barras
  - Nombre del cliente
  - Fecha de creación
  - Estado del documento
  - Estado del pago

---

### **📊 REPORTES Y AUDITORÍA**

#### **👤 ROL: ADMIN**
**¿Qué puede ver?**
1. **Dashboard completo** con métricas en tiempo real
2. **Reportes de productividad** por matrizador
3. **Reportes financieros** detallados
4. **Auditoría completa** de todas las operaciones
5. **Gestión de usuarios** y permisos

#### **👤 ROL: CAJA**
**¿Qué puede ver?**
1. **Reportes de ingresos** diarios/mensuales
2. **Documentos pendientes de pago**
3. **Retenciones procesadas**
4. **Historial de pagos** por documento

#### **👤 ROL: MATRIZADOR**
**¿Qué puede ver?**
1. **Sus documentos asignados**
2. **Productividad personal**
3. **Documentos completados**
4. **Tiempo promedio de procesamiento**

---

### **🚨 FLUJO DE EXCEPCIONES**

#### **📄 DOCUMENTO PERDIDO**
1. **Recepción** marca como "documento perdido"
2. **Se notifica** automáticamente a caja y admin
3. **Se inicia proceso** de reposición
4. **Se registra** en auditoría para seguimiento

#### **💸 ERROR EN PAGO**
1. **Caja** puede corregir pagos con permisos especiales
2. **Se registra** la corrección en auditoría
3. **Se notifica** al admin del cambio
4. **Se mantiene** historial de cambios

#### **🔄 DOCUMENTO DEVUELTO**
1. **Cliente** puede solicitar cambios
2. **Recepción** marca como "devuelto para corrección"
3. **Vuelve** al matrizador asignado
4. **Se reinicia** el flujo desde procesamiento

---

### **⏱️ TIEMPOS TÍPICOS DEL PROCESO**

| Etapa | Tiempo Promedio | Responsable |
|-------|----------------|-------------|
| Ingreso de documento | 5-10 minutos | Caja |
| Asignación automática | Inmediato | Sistema |
| Procesamiento notarial | 1-3 días | Matrizador |
| Notificación automática | Inmediato | Sistema |
| Entrega al cliente | 5-10 minutos | Recepción |

**Tiempo total típico: 1-3 días** (dependiendo de la complejidad del documento)

---

### **🎯 INDICADORES CLAVE DE RENDIMIENTO (KPIs)**

#### **📈 Métricas del Sistema**
- **Documentos procesados por día**
- **Tiempo promedio de procesamiento**
- **Porcentaje de documentos entregados a tiempo**
- **Eficiencia de notificaciones** (% de entregas exitosas)
- **Productividad por matrizador**
- **Ingresos diarios/mensuales**
- **Retenciones procesadas automáticamente**

#### **🎯 Objetivos de Calidad**
- **99% de documentos sin errores**
- **95% de entregas en menos de 3 días**
- **100% de trazabilidad** en todos los procesos
- **0% de documentos perdidos**
- **95% de satisfacción del cliente**

## 🛠️ Instalación y Configuración

### **Requisitos Previos**
- Node.js 16+ 
- PostgreSQL 12+
- Git

### **Instalación**
```bash
# Clonar el repositorio
git clone https://github.com/tu-usuario/sistema-notaria
cd sistema-notaria

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus configuraciones:
# - DATABASE_URL
# - JWT_SECRET
# - EMAIL_CONFIG
# - WHATSAPP_CONFIG

# Configurar base de datos
npm run db:create
npm run db:migrate
npm run db:seed

# Iniciar el servidor
npm start
```

### **Variables de Entorno Principales**
```env
# Base de datos
DATABASE_URL=postgresql://usuario:password@localhost:5432/sistema_notaria

# Autenticación
JWT_SECRET=tu_clave_secreta_muy_segura

# Email
EMAIL_HOST=smtp.gmail.com
EMAIL_USER=tu_email@gmail.com
EMAIL_PASS=tu_password_de_aplicacion

# WhatsApp (opcional)
WHATSAPP_API_URL=tu_api_whatsapp
WHATSAPP_TOKEN=tu_token

# Configuración general
NODE_ENV=production
PORT=3000
TIMEZONE=America/Guayaquil
```

## 📱 Uso del Sistema

### **Acceso por Roles**
- **Admin**: `http://localhost:3000/admin`
- **Caja**: `http://localhost:3000/caja`
- **Matrizador**: `http://localhost:3000/matrizadores`
- **Recepción**: `http://localhost:3000/recepcion`

### **Funcionalidades Principales por Rol**

#### **👑 Administrador**
- Gestión completa de usuarios
- Reportes ejecutivos y estadísticas
- Configuración del sistema
- Auditoría y logs del sistema
- Gestión de matrizadores

#### **💰 Caja**
- Carga de documentos (XML)
- Gestión de pagos y retenciones
- Reportes financieros
- Control de facturación
- Procesamiento de PDFs de retención

#### **📝 Matrizador**
- Gestión de documentos asignados
- Marcado de documentos como listos
- Edición de información de documentos
- Seguimiento de productividad

#### **🎯 Recepción**
- Entrega de documentos
- Verificación de códigos
- Registro de entregas
- Gestión de terceros

## 🔧 Características Técnicas Avanzadas

### **Sistema de Logging**
- **Auditoría Completa**: Registro de todas las operaciones
- **Niveles de Log**: Error, Warning, Info, Debug
- **Trazabilidad**: Seguimiento de cambios por usuario
- **Rotación Automática**: Gestión automática de archivos de log

### **Validaciones Matemáticas**
- **Cálculos Automáticos**: Retenciones según normativa ecuatoriana
- **Validación de Consistencia**: Verificación de integridad de datos
- **Prevención de Errores**: Validaciones en frontend y backend
- **Corrección Automática**: Detección y corrección de inconsistencias

### **Procesamiento de PDFs**
- **Extracción Inteligente**: Reconocimiento de patrones en PDFs
- **Múltiples Formatos**: Soporte para diferentes tipos de comprobantes
- **Validación Automática**: Verificación de datos extraídos
- **Fallback Manual**: Opción de ingreso manual si falla la extracción

### **Sistema de Estados**
```
Documento: en_proceso → listo_para_entrega → entregado
Pago: pendiente → pago_parcial → pagado_completo/pagado_con_retencion
```

## 📊 Métricas y Reportes

### **Dashboard en Tiempo Real**
- Documentos procesados hoy/mes
- Ingresos totales y pendientes
- Productividad por matrizador
- Estados de documentos
- Retenciones procesadas

### **Reportes Disponibles**
- **Financieros**: Ingresos, pagos, retenciones
- **Operacionales**: Documentos por estado, tiempos de procesamiento
- **Por Usuario**: Productividad individual
- **Auditoría**: Logs de sistema y cambios

## 🔒 Seguridad

### **Autenticación y Autorización**
- JWT con expiración automática
- Roles y permisos granulares
- Validación en cada endpoint
- Protección contra ataques comunes

### **Auditoría**
- Registro de todas las operaciones
- Trazabilidad completa de cambios
- Logs de acceso y errores
- Backup automático de datos críticos

## 🚀 Características Destacadas

### **✨ Innovaciones del Sistema**
1. **Procesamiento Automático de Retenciones**: Primer sistema que procesa automáticamente PDFs de retención
2. **Validación Matemática Inteligente**: Detección automática de inconsistencias
3. **Flujo Híbrido de Roles**: Usuarios con múltiples permisos según necesidades
4. **Notificaciones Inteligentes**: Sistema que decide automáticamente qué documentos notificar
5. **Trazabilidad Completa**: Seguimiento detallado desde creación hasta entrega

### **🎯 Beneficios Clave**
- **Reducción de Errores**: Validaciones automáticas y procesamiento inteligente
- **Ahorro de Tiempo**: Automatización de procesos manuales
- **Transparencia Total**: Trazabilidad completa de todos los procesos
- **Cumplimiento Normativo**: Gestión correcta de retenciones según normativa
- **Escalabilidad**: Arquitectura preparada para crecimiento

## 📞 Soporte y Contribución

### **Documentación Adicional**
- [Manual de Usuario](docs/manual-usuario.md)
- [Guía de Administrador](docs/guia-admin.md)
- [API Documentation](docs/api.md)
- [Troubleshooting](docs/troubleshooting.md)

### **Contribuir al Proyecto**
1. Fork del repositorio
2. Crear rama para nueva funcionalidad
3. Implementar cambios con pruebas
4. Enviar Pull Request

### **Reportar Problemas**
- Usar el sistema de Issues de GitHub
- Incluir logs relevantes
- Describir pasos para reproducir
- Especificar versión y entorno

---

**Desarrollado con ❤️ para modernizar la gestión notarial**

*Sistema en constante evolución - Última actualización: Mayo 2025* 