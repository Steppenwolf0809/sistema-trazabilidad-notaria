-- Migración: Añadir campos del sistema de pagos con retenciones
-- Fecha: 2024
-- Descripción: Añade campos para manejo de pagos parciales, totales y retenciones

-- ============== CAMPOS DE INFORMACIÓN DE PAGOS ==============

-- Monto total pagado por el cliente
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS valor_pagado DECIMAL(10,2) DEFAULT 0.00 NOT NULL;

-- Monto pendiente de pago
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS valor_pendiente DECIMAL(10,2) DEFAULT 0.00 NOT NULL;

-- Estado detallado del pago
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_pago_enum') THEN
        CREATE TYPE estado_pago_enum AS ENUM ('pendiente', 'pago_parcial', 'pagado_completo', 'pagado_con_retencion');
    END IF;
END $$;

ALTER TABLE documentos ADD COLUMN IF NOT EXISTS estado_pago estado_pago_enum DEFAULT 'pendiente';

-- Timestamp del último pago registrado
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS fecha_ultimo_pago TIMESTAMP WITH TIME ZONE;

-- ============== CAMPOS DE INFORMACIÓN DE RETENCIONES ==============

-- Indica si el documento tiene retención asociada
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS tiene_retencion BOOLEAN DEFAULT FALSE NOT NULL;

-- Número del comprobante de retención
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS numero_comprobante_retencion VARCHAR(50);

-- Monto total retenido
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS valor_retenido DECIMAL(10,2) DEFAULT 0.00 NOT NULL;

-- Monto de retención de IVA
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS retencion_iva DECIMAL(10,2) DEFAULT 0.00 NOT NULL;

-- Monto de retención de renta
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS retencion_renta DECIMAL(10,2) DEFAULT 0.00 NOT NULL;

-- RUC de la empresa que realiza la retención
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS ruc_empresa_retenedora VARCHAR(13);

-- Razón social de la empresa que retiene
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS razon_social_retenedora VARCHAR(200);

-- Fecha de la retención
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS fecha_retencion TIMESTAMP WITH TIME ZONE;

-- Path o contenido base64 del PDF de retención
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS archivo_pdf_retencion TEXT;

-- ============== COMENTARIOS EN COLUMNAS ==============

COMMENT ON COLUMN documentos.valor_pagado IS 'Monto total pagado por el cliente';
COMMENT ON COLUMN documentos.valor_pendiente IS 'Monto pendiente de pago';
COMMENT ON COLUMN documentos.estado_pago IS 'Estado detallado del pago del documento';
COMMENT ON COLUMN documentos.fecha_ultimo_pago IS 'Timestamp del último pago registrado';
COMMENT ON COLUMN documentos.tiene_retencion IS 'Indica si el documento tiene retención asociada';
COMMENT ON COLUMN documentos.numero_comprobante_retencion IS 'Número del comprobante de retención';
COMMENT ON COLUMN documentos.valor_retenido IS 'Monto total retenido';
COMMENT ON COLUMN documentos.retencion_iva IS 'Monto de retención de IVA';
COMMENT ON COLUMN documentos.retencion_renta IS 'Monto de retención de renta';
COMMENT ON COLUMN documentos.ruc_empresa_retenedora IS 'RUC de la empresa que realiza la retención';
COMMENT ON COLUMN documentos.razon_social_retenedora IS 'Razón social de la empresa que retiene';
COMMENT ON COLUMN documentos.fecha_retencion IS 'Fecha de la retención';
COMMENT ON COLUMN documentos.archivo_pdf_retencion IS 'Path o contenido base64 del PDF de retención';

-- ============== CREAR TABLA PAGOS ==============

CREATE TABLE IF NOT EXISTS pagos (
    id SERIAL PRIMARY KEY,
    documento_id INTEGER NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
    usuario_id INTEGER NOT NULL,
    monto DECIMAL(10,2) NOT NULL,
    forma_pago VARCHAR(50) NOT NULL,
    numero_comprobante VARCHAR(100),
    es_retencion BOOLEAN DEFAULT FALSE NOT NULL,
    observaciones TEXT,
    fecha_pago TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    metadatos JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_pagos_documento_id ON pagos(documento_id);
CREATE INDEX IF NOT EXISTS idx_pagos_usuario_id ON pagos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_pagos_fecha_pago ON pagos(fecha_pago);
CREATE INDEX IF NOT EXISTS idx_pagos_es_retencion ON pagos(es_retencion);

-- Comentarios en tabla pagos
COMMENT ON TABLE pagos IS 'Registro individual de cada pago realizado a un documento';
COMMENT ON COLUMN pagos.documento_id IS 'ID del documento al que pertenece el pago';
COMMENT ON COLUMN pagos.usuario_id IS 'ID del usuario que registró el pago';
COMMENT ON COLUMN pagos.monto IS 'Monto del pago individual';
COMMENT ON COLUMN pagos.forma_pago IS 'Forma de pago utilizada';
COMMENT ON COLUMN pagos.numero_comprobante IS 'Número de comprobante del pago';
COMMENT ON COLUMN pagos.es_retencion IS 'Indica si este registro es una retención';
COMMENT ON COLUMN pagos.observaciones IS 'Observaciones adicionales del pago';
COMMENT ON COLUMN pagos.fecha_pago IS 'Fecha y hora del pago';
COMMENT ON COLUMN pagos.metadatos IS 'Información adicional en formato JSON';

-- ============== ACTUALIZAR DATOS EXISTENTES ==============

-- Inicializar valor_pendiente para documentos existentes con factura
UPDATE documentos 
SET valor_pendiente = COALESCE(valor_factura, 0) - COALESCE(valor_pagado, 0)
WHERE numero_factura IS NOT NULL;

-- Actualizar estado_pago para documentos ya pagados
UPDATE documentos 
SET estado_pago = 'pagado_completo'
WHERE metodo_pago != 'pendiente' 
AND metodo_pago IS NOT NULL 
AND numero_factura IS NOT NULL;

-- Actualizar estado_pago para documentos pendientes
UPDATE documentos 
SET estado_pago = 'pendiente'
WHERE (metodo_pago = 'pendiente' OR metodo_pago IS NULL)
AND numero_factura IS NOT NULL;

-- ============== VALIDACIONES Y CONSTRAINTS ==============

-- Constraint para validar que valor_pagado + valor_pendiente + valor_retenido = valor_factura
ALTER TABLE documentos ADD CONSTRAINT IF NOT EXISTS chk_coherencia_matematica 
CHECK (
    numero_factura IS NULL OR 
    (COALESCE(valor_pagado, 0) + COALESCE(valor_pendiente, 0) + COALESCE(valor_retenido, 0) = COALESCE(valor_factura, 0))
);

-- Constraint para validar que los montos no sean negativos
ALTER TABLE documentos ADD CONSTRAINT IF NOT EXISTS chk_montos_positivos 
CHECK (
    COALESCE(valor_pagado, 0) >= 0 AND 
    COALESCE(valor_pendiente, 0) >= 0 AND 
    COALESCE(valor_retenido, 0) >= 0
);

-- Constraint para validar RUC (13 dígitos)
ALTER TABLE documentos ADD CONSTRAINT IF NOT EXISTS chk_ruc_formato 
CHECK (
    ruc_empresa_retenedora IS NULL OR 
    (ruc_empresa_retenedora ~ '^[0-9]{13}$')
);

PRINT 'Migración completada exitosamente. Nuevos campos añadidos al sistema de pagos con retenciones.'; 