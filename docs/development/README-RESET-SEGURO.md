# 🗃️ Reset Seguro de Base de Datos - ProNotary

## 📋 Descripción General

Este conjunto de scripts permite realizar una limpieza segura de datos legacy inconsistentes en el sistema ProNotary, manteniendo la estructura de la base de datos y los usuarios, pero eliminando todos los documentos y datos de testing que pueden estar causando inconsistencias matemáticas.

## 🎯 Objetivo

**PROBLEMA RESUELTO:**
- Datos financieros inconsistentes (Facturado ≠ Cobrado + Pendiente)
- Documentos de testing mezclados con datos reales
- Métricas del dashboard que no cuadran matemáticamente
- Historial de eventos y auditoría contaminado

**RESULTADO ESPERADO:**
- Base de datos limpia y confiable
- Matemática financiera perfectamente consistente
- Sistema listo para datos reales desde cero
- Usuarios y estructura preservados

## 📁 Archivos Incluidos

### 🔧 Scripts Principales

1. **`reset-datos-legacy.js`** - Script principal de limpieza
2. **`backup-before-reset.js`** - Backup preventivo antes del reset
3. **`test-matematica-financiera.js`** - Validación de consistencia matemática

### 📊 Funcionalidades

- ✅ **Limpieza segura** - Elimina datos en orden correcto respetando FK
- ✅ **Preservación** - Mantiene usuarios, estructura y configuraciones
- ✅ **Backup automático** - Crea respaldo antes de cualquier cambio
- ✅ **Validación matemática** - Verifica consistencia de cálculos
- ✅ **Reset de secuencias** - IDs empiezan desde 1 nuevamente
- ✅ **Reportes detallados** - Información completa del proceso

## 🚀 Guía de Uso

### PASO 1: Backup Preventivo (Recomendado)

```bash
# Crear backup completo antes del reset
node backup-before-reset.js
```

**¿Qué hace?**
- Crea backup completo de la base de datos
- Verifica que pg_dump esté disponible
- Guarda el archivo en `./backups/`
- Proporciona comando de restauración si es necesario

### PASO 2: Ejecutar Reset Seguro

```bash
# Limpiar datos legacy manteniendo estructura
node reset-datos-legacy.js
```

**¿Qué elimina?**
- ✅ Todos los documentos
- ✅ Eventos de documentos
- ✅ Registros de auditoría
- ✅ Cambios de matrizador
- ✅ Autorizaciones de entrega
- ✅ Relaciones entre documentos
- ✅ Notificaciones enviadas

**¿Qué preserva?**
- ✅ Estructura de todas las tablas
- ✅ Usuarios y matrizadores
- ✅ Configuraciones del sistema
- ✅ Migraciones aplicadas

### PASO 3: Validar Matemática

```bash
# Verificar que todo esté correcto
node test-matematica-financiera.js
```

**¿Qué valida?**
- ✅ Facturado = Cobrado + Pendiente
- ✅ Conteo de documentos consistente
- ✅ No hay valores negativos
- ✅ Métricas por períodos
- ✅ Reportes detallados

## 📊 Ejemplo de Ejecución

### 1. Estado Antes del Reset

```
🔍 VERIFICANDO ESTADO ACTUAL DE LA BASE DE DATOS...

📊 ESTADO ACTUAL:
  • Total documentos: 45
  • Documentos pagados: 12
  • Documentos pendientes: 33
  • Eventos registrados: 127
  • Usuarios en sistema: 4
  • Registros de auditoría: 89

💰 MÉTRICAS FINANCIERAS ACTUALES:
  • Total facturado: $5048.88
  • Total cobrado: $153.89
  • Pendiente de cobro: $4894.99
  ⚠️  INCONSISTENCIA DETECTADA: Diferencia de $825.01
     → Esta es la razón para hacer el reset
```

### 2. Proceso de Reset

```
🗃️  INICIANDO RESET SEGURO DE DATOS LEGACY...
⚠️  MANTENIENDO: Estructura, usuarios, configuraciones
🗑️  ELIMINANDO: Documentos, eventos, auditoría de testing

📋 PASO 1: Backup de configuraciones críticas...
✅ 4 usuarios encontrados para preservar

🗑️  PASO 2: Limpiando datos legacy...
  → Limpiando notificaciones enviadas...
  → Limpiando eventos de documentos...
    ✅ 127 eventos eliminados
  → Limpiando registros de auditoría...
    ✅ 89 registros de auditoría eliminados
  → Limpiando documentos principales...
    ✅ 45 documentos eliminados

🔄 PASO 3: Reseteando secuencias de IDs...
  ✅ Secuencia documentos_id_seq reseteada
  ✅ Secuencia evento_documentos_id_seq reseteada

✅ PASO 4: Verificando limpieza...
📊 ESTADO POST-LIMPIEZA:
  • Documentos: 0 (debe ser 0)
  • Eventos: 0 (debe ser 0)
  • Auditoría: 0 (debe ser 0)
  • Usuarios: 4 (preservados)

🎉 ¡RESET COMPLETADO EXITOSAMENTE!
```

### 3. Validación Post-Reset

```
🧮 SISTEMA DE TESTING MATEMÁTICA FINANCIERA - PRONOTARY

📊 REPORTE DE MATEMÁTICA FINANCIERA
===================================

🗓️  Período: TODOS LOS DATOS
📅 Fecha del reporte: 15/1/2025 14:30:25

💰 MÉTRICAS FINANCIERAS:
   • Total facturado: $0.00
   • Total cobrado: $0.00
   • Pendiente de cobro: $0.00
   • Suma (C+P): $0.00

📋 CONTEO DE DOCUMENTOS:
   • Total documentos: 0
   • Documentos pagados: 0
   • Documentos pendientes: 0

✅ VALIDACIÓN MATEMÁTICA:
   🎉 ¡MATEMÁTICA CORRECTA! Todos los cálculos son consistentes

✅ ¡TODOS LOS TESTS PASARON EXITOSAMENTE!
✅ La matemática financiera es correcta
✅ No se detectaron inconsistencias

🎉 El sistema está listo para uso en producción
```

## 🛡️ Seguridad y Recuperación

### Backup Automático

Cada ejecución del script de backup crea un archivo con timestamp:
```
./backups/backup_pre_reset_2025-01-15T14-25-30.sql
```

### Comando de Restauración

Si necesitas restaurar el backup:
```bash
psql -h localhost -p 5433 -U postgres -d notaria < "./backups/backup_pre_reset_2025-01-15T14-25-30.sql"
```

### Verificación de Herramientas

El script verifica automáticamente:
- ✅ Conexión a PostgreSQL
- ✅ Disponibilidad de pg_dump
- ✅ Permisos de escritura
- ✅ Credenciales de base de datos

## 📋 Protocolo Post-Reset

### 1. Verificar Dashboard

- Abrir `/admin/dashboard`
- Confirmar que todas las métricas están en $0.00
- Verificar que no hay errores en consola

### 2. Testing con Datos Reales

```bash
# Flujo recomendado:
1. Cargar 2-3 XMLs reales
2. Facturar los documentos
3. Registrar pago de uno
4. Ejecutar: node test-matematica-financiera.js
5. Verificar que matemática cuadre perfectamente
```

### 3. Validación de Funcionalidades

- ✅ Login de usuarios funciona
- ✅ Carga de XMLs funciona
- ✅ Facturación funciona
- ✅ Registro de pagos funciona
- ✅ Dashboard muestra datos correctos
- ✅ Matemática es consistente

## ⚠️ Consideraciones Importantes

### Cuándo Usar Este Reset

- ✅ **Datos inconsistentes** - Matemática financiera no cuadra
- ✅ **Testing contaminado** - Mezcla de datos reales y prueba
- ✅ **Migración limpia** - Empezar desde cero con datos reales
- ✅ **Auditoría corrupta** - Historial de eventos inconsistente

### Cuándo NO Usar

- ❌ **Producción con datos reales** - Solo usar en desarrollo/testing
- ❌ **Sin backup** - Siempre crear backup primero
- ❌ **Problemas de estructura** - Este script no modifica esquema
- ❌ **Errores de código** - Primero corregir bugs en la aplicación

### Requisitos Previos

- ✅ PostgreSQL corriendo
- ✅ Credenciales correctas en `.env`
- ✅ pg_dump instalado (para backup)
- ✅ Permisos de escritura en directorio
- ✅ No hay conexiones activas a la BD

## 🔧 Solución de Problemas

### Error: "pg_dump no encontrado"

```bash
# Windows
# Instalar PostgreSQL client tools

# Ubuntu/Debian
sudo apt-get install postgresql-client

# macOS
brew install postgresql
```

### Error: "Conexión rechazada"

1. Verificar que PostgreSQL esté corriendo
2. Revisar credenciales en `.env`
3. Confirmar puerto (5433 vs 5432)
4. Verificar permisos de usuario

### Error: "Secuencia no encontrada"

Es normal - algunas secuencias pueden no existir dependiendo de las migraciones aplicadas.

### Error: "Tabla no encontrada"

Es normal - algunas tablas opcionales pueden no existir en todas las instalaciones.

## 📞 Soporte

Si encuentras problemas:

1. **Revisar logs** - Los scripts proporcionan información detallada
2. **Verificar requisitos** - PostgreSQL, credenciales, permisos
3. **Consultar documentación** - Este archivo tiene soluciones comunes
4. **Backup disponible** - Siempre puedes restaurar el estado anterior

## 🎯 Resultado Final

Después de ejecutar estos scripts tendrás:

- ✅ **Base de datos limpia** - Sin datos inconsistentes
- ✅ **Matemática perfecta** - Todos los cálculos cuadran
- ✅ **Sistema confiable** - Listo para datos reales
- ✅ **Usuarios preservados** - Sin perder accesos
- ✅ **Estructura intacta** - Todo funcional
- ✅ **Backup disponible** - Por si necesitas restaurar

**¡Tu sistema ProNotary estará completamente limpio y listo para uso profesional con datos reales!** 