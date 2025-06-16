# Implementación de Eliminación Definitiva de Documentos

## 📋 Resumen de la Funcionalidad

Esta implementación agrega la capacidad de eliminar definitivamente documentos del sistema notarial, corrigiendo automáticamente las estadísticas financieras y manteniendo un registro completo de auditoría.

## 🚀 Pasos de Implementación

### 1. Ejecutar Migración de Base de Datos

```bash
# Ejecutar el script SQL de migración
psql -U usuario_bd -d nombre_bd -f migrations/20241215_add_eliminacion_fields.sql
```

**O ejecutar manualmente los comandos SQL:**

```sql
-- ============================================
-- MIGRACIÓN: SISTEMA DE ELIMINACIÓN DEFINITIVA
-- ============================================

-- 1. Agregar nuevos estados al ENUM
ALTER TYPE estado_documento_enum ADD VALUE IF NOT EXISTS 'eliminado';
ALTER TYPE estado_documento_enum ADD VALUE IF NOT EXISTS 'nota_credito';

-- 2. Agregar campos de eliminación
ALTER TABLE documentos 
ADD COLUMN IF NOT EXISTS motivo_eliminacion VARCHAR(50),
ADD COLUMN IF NOT EXISTS eliminado_por INTEGER REFERENCES matrizadores(id),
ADD COLUMN IF NOT EXISTS fecha_eliminacion TIMESTAMP,
ADD COLUMN IF NOT EXISTS justificacion_eliminacion TEXT;

-- 3. Agregar campos de auditoría de pagos
ALTER TABLE documentos 
ADD COLUMN IF NOT EXISTS registrado_por INTEGER REFERENCES matrizadores(id),
ADD COLUMN IF NOT EXISTS fecha_registro_pago TIMESTAMP;

-- 4. Crear tabla de auditoría de eliminaciones
CREATE TABLE IF NOT EXISTS auditoria_eliminaciones (
    id SERIAL PRIMARY KEY,
    documento_id INTEGER NOT NULL,
    motivo_eliminacion VARCHAR(50) NOT NULL,
    justificacion TEXT NOT NULL,
    eliminado_por INTEGER NOT NULL REFERENCES matrizadores(id),
    fecha_eliminacion TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Snapshot completo del documento antes de eliminar
    snapshot_documento JSONB NOT NULL,
    
    -- Información de auditoría
    ip_address INET,
    user_agent TEXT,
    impacto_financiero JSONB,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 5. Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_auditoria_eliminaciones_documento_id ON auditoria_eliminaciones(documento_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_eliminaciones_eliminado_por ON auditoria_eliminaciones(eliminado_por);
CREATE INDEX IF NOT EXISTS idx_auditoria_eliminaciones_fecha ON auditoria_eliminaciones(fecha_eliminacion);
CREATE INDEX IF NOT EXISTS idx_documentos_estado ON documentos(estado);
CREATE INDEX IF NOT EXISTS idx_documentos_registrado_por ON documentos(registrado_por);

-- 6. Agregar acción de eliminación a auditoría general
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t 
        JOIN pg_enum e ON t.oid = e.enumtypid 
        WHERE t.typname = 'accion_auditoria_enum' 
        AND e.enumlabel = 'ELIMINACION_DOCUMENTO'
    ) THEN
        ALTER TYPE accion_auditoria_enum ADD VALUE 'ELIMINACION_DOCUMENTO';
    END IF;
END $$;

-- 7. Comentarios en tablas
COMMENT ON TABLE auditoria_eliminaciones IS 'Registro completo de auditoría para documentos eliminados definitivamente';
COMMENT ON COLUMN documentos.motivo_eliminacion IS 'Motivo por el cual se eliminó el documento';
COMMENT ON COLUMN documentos.registrado_por IS 'Usuario que registró/confirmó el pago del documento';
COMMENT ON COLUMN documentos.fecha_registro_pago IS 'Fecha y hora cuando se registró el pago';
```

### 2. Integrar Rutas en la Aplicación

En tu archivo principal de rutas (ej. `app.js` o `routes/index.js`):

```javascript
const eliminacionRoutes = require('./routes/eliminacionRoutes');

// Registrar rutas de eliminación
app.use('/api/admin', eliminacionRoutes);
```

### 3. Configurar Relaciones en los Modelos

En el archivo donde se configuran las relaciones de Sequelize:

```javascript
const AuditoriaEliminacion = require('./models/AuditoriaEliminacion');
const Matrizador = require('./models/Matrizador');

// Configurar relación con matrizadores
AuditoriaEliminacion.belongsTo(Matrizador, {
  foreignKey: 'eliminadoPor',
  as: 'administrador'
});
```

### 4. Agregar Botón de Eliminación en Vistas

En las páginas donde se listan documentos (solo para administradores):

```html
<!-- Incluir el modal -->
{{> admin/modal-eliminar-documento}}

<!-- En la tabla de documentos, agregar columna de acciones -->
<td>
  {{#if (eq usuario.rol 'admin')}}
    <button class="btn btn-sm btn-outline-danger" 
            onclick="abrirModalEliminar({
              id: {{this.id}},
              codigoBarras: '{{this.codigoBarras}}',
              tipoDocumento: '{{this.tipoDocumento}}',
              nombreCliente: '{{this.nombreCliente}}',
              estado: '{{this.estado}}',
              valorFactura: {{this.valorFactura}},
              estadoPago: '{{this.estadoPago}}'
            })">
      <i class="fas fa-trash-alt"></i>
    </button>
  {{/if}}
</td>
```

### 5. Agregar Middleware de Autenticación

Crear o actualizar el middleware de autenticación:

```javascript
// middleware/auth.js
exports.requireAdmin = (req, res, next) => {
  if (!req.user || req.user.rol !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Acceso denegado. Solo administradores.'
    });
  }
  next();
};
```

### 6. Actualizar Dashboard

En el dashboard administrativo, agregar las nuevas estadísticas:

```html
<div class="col-md-3">
  <div class="card bg-danger text-white">
    <div class="card-body text-center">
      <i class="fas fa-trash-alt fa-2x mb-2"></i>
      <h4 class="mb-0">{{stats.eliminados}}</h4>
      <small>Documentos Eliminados</small>
    </div>
  </div>
</div>
```

### 7. Agregar Menú de Auditoría

En el menú administrativo:

```html
<li class="nav-item">
  <a class="nav-link" href="/admin/auditoria-eliminaciones">
    <i class="fas fa-trash-alt text-danger me-2"></i>
    Auditoría de Eliminaciones
  </a>
</li>
```

## 🔧 Funcionalidades Implementadas

### ✅ Estados de Documento Ampliados
- **eliminado**: Documento borrado definitivamente
- **nota_credito**: Anulado con devolución de dinero

### ✅ Interfaz de Eliminación
- Modal de confirmación con validaciones
- Selección obligatoria de motivo
- Justificación detallada mínima
- Confirmación doble de entendimiento
- Cálculo automático de impacto financiero

### ✅ Auditoría Completa
- Snapshot completo del documento antes de eliminar
- Registro de IP, User-Agent, fecha/hora
- Información del administrador que eliminó
- Justificación detallada
- Valor de impacto financiero

### ✅ Estadísticas Corregidas
- Total de documentos excluye eliminados
- Gráficos filtran documentos eliminados
- Reportes corregidos automáticamente
- Métricas financieras precisas

### ✅ Página de Auditoría
- Lista completa de eliminaciones
- Filtros por fecha, motivo, administrador
- Exportación a CSV/Excel
- Detalles completos de cada eliminación
- Estadísticas de eliminaciones

## 🛡️ Validaciones de Seguridad

### Autenticación
- Solo administradores pueden eliminar
- Verificación de permisos en cada operación
- Middleware de protección en todas las rutas

### Validaciones de Datos
- Motivo obligatorio
- Justificación mínimo 10 caracteres
- Confirmación doble requerida
- Documento no puede estar ya eliminado

### Auditoría
- Registro inmutable de eliminaciones
- Snapshot completo del documento
- Trazabilidad completa de la acción
- IP y User-Agent registrados

## 📊 Impacto en Estadísticas

### Consultas Actualizadas
Todas las consultas estadísticas ahora excluyen:
```sql
WHERE estado NOT IN ('eliminado', 'nota_credito')
```

### Métricas Afectadas
- Total de documentos
- Documentos por matrizador
- Reportes financieros
- Gráficos de volumen
- Estadísticas por tipo

## 🔄 Casos de Uso

### 1. Documento Duplicado
```
Motivo: documento_duplicado
Justificación: "Documento ingresado por error dos veces por el usuario de recepción. 
                Mantener solo el documento con código XXX-123."
Impacto: Descuento de estadísticas sin afectar facturación real
```

### 2. Nota de Crédito
```
Motivo: nota_credito
Justificación: "Cliente solicitó devolución por cancelación de trámite. 
                Dinero devuelto en efectivo según recibo #456."
Impacto: Descuento de facturado y cobrado
```

### 3. Error Crítico
```
Motivo: error_critico
Justificación: "Error en nombre del cliente que afecta validez legal del documento. 
                No es posible corregir sin crear inconsistencias."
Impacto: Eliminación completa sin impacto financiero
```

## 🚨 Consideraciones Importantes

### Backup Antes de Implementar
```bash
pg_dump nombre_bd > backup_antes_eliminacion_$(date +%Y%m%d).sql
```

### Pruebas Recomendadas
1. Crear documento de prueba
2. Eliminar con cada motivo
3. Verificar estadísticas corregidas
4. Probar exportación de auditoría
5. Validar permisos de acceso

### Monitoreo
- Revisar logs de eliminaciones semanalmente
- Verificar integridad de estadísticas
- Auditar accesos a la funcionalidad

## 📞 Soporte

Para problemas o dudas sobre la implementación:
1. Revisar logs de aplicación
2. Verificar permisos de base de datos
3. Comprobar configuración de rutas
4. Validar middleware de autenticación

## 🔄 Versiones Futuras

### Posibles Mejoras
- Recuperación temporal de documentos eliminados (papelera)
- Notificaciones automáticas de eliminaciones
- Dashboard específico para auditoría
- Exportación a PDF con formato legal
- Integración con sistema de respaldos automáticos 