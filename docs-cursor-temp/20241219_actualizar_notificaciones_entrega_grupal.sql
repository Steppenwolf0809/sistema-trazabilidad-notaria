-- Migración para actualizar tabla notificaciones_enviadas para soporte de entrega grupal
-- Fecha: 2024-12-19
-- Descripción: Agregar campos para entrega grupal y actualizar ENUM

BEGIN;

-- 1. Agregar columna documentos_ids para entrega grupal
ALTER TABLE notificaciones_enviadas 
ADD COLUMN documentos_ids JSON;

-- 2. Agregar columna tipo_entrega
ALTER TABLE notificaciones_enviadas 
ADD COLUMN tipo_entrega VARCHAR(20) DEFAULT 'individual' NOT NULL;

-- 2.1. Agregar constraint para tipo_entrega
ALTER TABLE notificaciones_enviadas 
ADD CONSTRAINT check_tipo_entrega CHECK (tipo_entrega IN ('individual', 'grupal'));

-- 3. Permitir que documento_id sea NULL para entrega grupal
ALTER TABLE notificaciones_enviadas 
ALTER COLUMN documento_id DROP NOT NULL;

-- 4. Actualizar ENUM tipo_evento para incluir entrega_grupal
-- Crear nuevo ENUM con el valor adicional
CREATE TYPE enum_notificaciones_enviadas_tipo_evento_new AS ENUM (
    'documento_listo', 
    'entrega_confirmada', 
    'entrega_grupal', 
    'recordatorio', 
    'alerta_sin_recoger'
);

-- Actualizar la columna para usar el nuevo ENUM
ALTER TABLE notificaciones_enviadas 
ALTER COLUMN tipo_evento TYPE enum_notificaciones_enviadas_tipo_evento_new 
USING tipo_evento::text::enum_notificaciones_enviadas_tipo_evento_new;

-- Eliminar el ENUM viejo y renombrar el nuevo
DROP TYPE IF EXISTS enum_notificaciones_enviadas_tipo_evento;
ALTER TYPE enum_notificaciones_enviadas_tipo_evento_new RENAME TO enum_notificaciones_enviadas_tipo_evento;

-- 5. Agregar índices para mejorar consultas
CREATE INDEX IF NOT EXISTS idx_notificaciones_tipo_entrega ON notificaciones_enviadas(tipo_entrega);

-- 6. Verificar que las estructuras se crearon correctamente
DO $$
BEGIN
    -- Verificar que las columnas existan
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notificaciones_enviadas' 
        AND column_name = 'documentos_ids'
    ) THEN
        RAISE EXCEPTION 'Columna documentos_ids no fue creada correctamente';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notificaciones_enviadas' 
        AND column_name = 'tipo_entrega'
    ) THEN
        RAISE EXCEPTION 'Columna tipo_entrega no fue creada correctamente';
    END IF;
    
    RAISE NOTICE '✅ Migración completada exitosamente';
END $$;

COMMIT; 