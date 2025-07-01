-- Migración: Agregar campos de reversión a tabla pagos
-- Fecha: 20241220
-- Descripción: Agregar campos para soportar reversiones de pagos por Caja

-- Agregar campo para indicar si el pago fue revertido
ALTER TABLE pagos ADD COLUMN revertido BOOLEAN DEFAULT FALSE NOT NULL 
COMMENT 'Indica si este pago ha sido revertido por Caja';

-- Agregar campo para fecha de reversión
ALTER TABLE pagos ADD COLUMN fecha_reversion DATETIME NULL 
COMMENT 'Fecha y hora cuando se revirtió el pago';

-- Agregar campo para motivo de reversión
ALTER TABLE pagos ADD COLUMN motivo_reversion VARCHAR(100) NULL 
COMMENT 'Categoría del motivo de reversión';

-- Agregar campo para justificación de reversión
ALTER TABLE pagos ADD COLUMN justificacion_reversion TEXT NULL 
COMMENT 'Justificación detallada de la reversión';

-- Crear índices para optimizar consultas
CREATE INDEX idx_pagos_revertido ON pagos(revertido);
CREATE INDEX idx_pagos_fecha_reversion ON pagos(fecha_reversion);

-- Verificar cambios
SELECT 'Campos de reversión agregados a tabla pagos exitosamente' as status; 