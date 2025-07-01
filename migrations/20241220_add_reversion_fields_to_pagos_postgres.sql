-- Migración: Agregar campos de reversión a tabla pagos (PostgreSQL)
-- Fecha: 20241220
-- Descripción: Agregar campos para soportar reversiones de pagos por Caja

-- Agregar campo para indicar si el pago fue revertido
ALTER TABLE pagos ADD COLUMN revertido BOOLEAN DEFAULT FALSE NOT NULL;

-- Agregar campo para fecha de reversión
ALTER TABLE pagos ADD COLUMN fecha_reversion TIMESTAMP WITH TIME ZONE NULL;

-- Agregar campo para motivo de reversión
ALTER TABLE pagos ADD COLUMN motivo_reversion VARCHAR(100) NULL;

-- Agregar campo para justificación de reversión
ALTER TABLE pagos ADD COLUMN justificacion_reversion TEXT NULL;

-- Crear índices para optimizar consultas
CREATE INDEX idx_pagos_revertido ON pagos(revertido);
CREATE INDEX idx_pagos_fecha_reversion ON pagos(fecha_reversion);

-- Agregar comentarios para documentación
COMMENT ON COLUMN pagos.revertido IS 'Indica si este pago ha sido revertido por Caja';
COMMENT ON COLUMN pagos.fecha_reversion IS 'Fecha y hora cuando se revirtió el pago';
COMMENT ON COLUMN pagos.motivo_reversion IS 'Categoría del motivo de reversión';
COMMENT ON COLUMN pagos.justificacion_reversion IS 'Justificación detallada de la reversión';

-- Verificar cambios
SELECT 'Campos de reversión agregados a tabla pagos exitosamente' as status; 