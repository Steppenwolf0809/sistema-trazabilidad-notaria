-- Migración para agregar funcionalidad de eliminación definitiva de documentos
-- Fecha: 2024-12-15
-- Descripción: Agrega nuevos estados y campos para la eliminación controlada de documentos

-- 1. Agregar nuevos estados al ENUM de documentos
ALTER TYPE estado_documento_enum ADD VALUE 'eliminado';
ALTER TYPE estado_documento_enum ADD VALUE 'nota_credito';

-- Si el ENUM no existe, crearlo
-- CREATE TYPE estado_documento_enum AS ENUM('en_proceso', 'listo_para_entrega', 'entregado', 'cancelado', 'eliminado', 'nota_credito');

-- 2. Agregar campos de eliminación a la tabla documentos
ALTER TABLE documentos ADD COLUMN motivo_eliminacion VARCHAR(50);
ALTER TABLE documentos ADD COLUMN eliminado_por INTEGER REFERENCES matrizadores(id);
ALTER TABLE documentos ADD COLUMN fecha_eliminacion TIMESTAMP;
ALTER TABLE documentos ADD COLUMN justificacion_eliminacion TEXT;

-- 3. Crear tabla de auditoría de eliminaciones
CREATE TABLE auditoria_eliminaciones (
    id SERIAL PRIMARY KEY,
    documento_id INTEGER NOT NULL,
    codigo_documento VARCHAR(255) NOT NULL,
    datos_documento JSONB NOT NULL,
    motivo VARCHAR(50) NOT NULL CHECK (motivo IN ('documento_duplicado', 'error_critico', 'nota_credito', 'cancelacion_cliente', 'otro')),
    justificacion TEXT NOT NULL,
    eliminado_por INTEGER NOT NULL REFERENCES matrizadores(id),
    nombre_administrador VARCHAR(255) NOT NULL,
    fecha_eliminacion TIMESTAMP DEFAULT NOW(),
    valor_impacto DECIMAL(10,2),
    estaba_pagado BOOLEAN DEFAULT FALSE,
    ip VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. Crear índices para optimizar consultas
CREATE INDEX idx_documentos_estado_eliminado ON documentos(estado) WHERE estado IN ('eliminado', 'nota_credito');
CREATE INDEX idx_auditoria_eliminaciones_fecha ON auditoria_eliminaciones(fecha_eliminacion);
CREATE INDEX idx_auditoria_eliminaciones_eliminado_por ON auditoria_eliminaciones(eliminado_por);
CREATE INDEX idx_auditoria_eliminaciones_motivo ON auditoria_eliminaciones(motivo);

-- 5. Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 6. Trigger para actualizar updated_at en auditoría de eliminaciones
CREATE TRIGGER update_auditoria_eliminaciones_updated_at 
    BEFORE UPDATE ON auditoria_eliminaciones 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. Comentarios para documentación
COMMENT ON TABLE auditoria_eliminaciones IS 'Registro de auditoría para documentos eliminados definitivamente del sistema';
COMMENT ON COLUMN auditoria_eliminaciones.datos_documento IS 'Snapshot completo del documento antes de la eliminación';
COMMENT ON COLUMN auditoria_eliminaciones.valor_impacto IS 'Impacto financiero de la eliminación en las estadísticas';
COMMENT ON COLUMN auditoria_eliminaciones.estaba_pagado IS 'Indica si el documento estaba pagado al momento de eliminarlo';

-- 8. Permisos (ajustar según la configuración de usuarios de la BD)
-- GRANT SELECT, INSERT ON auditoria_eliminaciones TO notaria_app;
-- GRANT USAGE ON SEQUENCE auditoria_eliminaciones_id_seq TO notaria_app; 