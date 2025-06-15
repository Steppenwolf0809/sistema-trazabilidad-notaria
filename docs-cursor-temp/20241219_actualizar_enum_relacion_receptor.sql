-- Migración para actualizar ENUM relacion_receptor con nuevos valores
-- Fecha: 2024-12-19
-- Descripción: Agregar valores faltantes al ENUM relacion_receptor para soportar entrega grupal

BEGIN;

-- 1. Crear el nuevo tipo ENUM con todos los valores
CREATE TYPE enum_documentos_relacion_receptor_new AS ENUM (
    'titular',
    'representante_legal', 
    'apoderado',
    'familiar',
    'empleado',
    'tercero_autorizado',
    'mandatario',  -- Valor legacy, mantener por compatibilidad
    'otro'         -- Valor legacy, mantener por compatibilidad
);

-- 2. Actualizar la columna para usar el nuevo tipo
ALTER TABLE documentos 
ALTER COLUMN relacion_receptor TYPE enum_documentos_relacion_receptor_new 
USING relacion_receptor::text::enum_documentos_relacion_receptor_new;

-- 3. Eliminar el tipo anterior
DROP TYPE enum_documentos_relacion_receptor;

-- 4. Renombrar el nuevo tipo al nombre original
ALTER TYPE enum_documentos_relacion_receptor_new RENAME TO enum_documentos_relacion_receptor;

-- 5. Actualizar valores legacy para que coincidan con los nuevos estándares
UPDATE documentos 
SET relacion_receptor = 'tercero_autorizado' 
WHERE relacion_receptor = 'mandatario';

UPDATE documentos 
SET relacion_receptor = 'tercero_autorizado' 
WHERE relacion_receptor = 'otro';

-- 6. Agregar comentario para documentar los valores válidos
COMMENT ON COLUMN documentos.relacion_receptor IS 
'Relación del receptor con el cliente: titular, representante_legal, apoderado, familiar, empleado, tercero_autorizado';

COMMIT; 