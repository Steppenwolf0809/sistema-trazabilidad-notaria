-- Migración: Crear tabla de auditoría de reversiones (PostgreSQL)
-- Fecha: 20241220
-- Descripción: Tabla inmutable para registrar todas las reversiones del sistema

-- Crear tipos ENUM para PostgreSQL
CREATE TYPE tipo_reversion_enum AS ENUM (
    'desmarcar_listo', 
    'deshacer_entrega', 
    'separar_grupo', 
    'reactivar_documento',
    'deshacer_pago', 
    'corregir_metodo_pago', 
    'ajustar_monto_pago', 
    'deshacer_retencion'
);

CREATE TYPE rol_reversion_enum AS ENUM (
    'admin', 
    'caja', 
    'caja_archivo'
);

-- Crear tabla principal
CREATE TABLE IF NOT EXISTS reversiones_auditoria (
    id SERIAL PRIMARY KEY,
    tipo_reversion tipo_reversion_enum NOT NULL,
    documento_id INTEGER NOT NULL,
    pago_id INTEGER NULL,
    usuario_id INTEGER NOT NULL,
    rol_usuario rol_reversion_enum NOT NULL,
    estado_anterior VARCHAR(100) NULL,
    estado_nuevo VARCHAR(100) NULL,
    datos_anteriores JSONB NULL,
    datos_nuevos JSONB NULL,
    motivo_categoria VARCHAR(100) NOT NULL,
    justificacion TEXT NOT NULL,
    ip_address VARCHAR(45) NULL,
    fecha_reversion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadatos JSONB NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraint para validar longitud de justificación
    CONSTRAINT chk_justificacion_length CHECK (CHAR_LENGTH(justificacion) >= 20)
);

-- Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_reversiones_documento_id ON reversiones_auditoria(documento_id);
CREATE INDEX IF NOT EXISTS idx_reversiones_usuario_id ON reversiones_auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_reversiones_tipo ON reversiones_auditoria(tipo_reversion);
CREATE INDEX IF NOT EXISTS idx_reversiones_fecha ON reversiones_auditoria(fecha_reversion);
CREATE INDEX IF NOT EXISTS idx_reversiones_rol ON reversiones_auditoria(rol_usuario);

-- Agregar claves foráneas (sin restricciones estrictas por ahora)
-- NOTA: Las claves foráneas pueden agregarse posteriormente si las tablas referencidas existen

-- Comentarios en la tabla y columnas
COMMENT ON TABLE reversiones_auditoria IS 'Tabla inmutable de auditoría para todas las reversiones del sistema';
COMMENT ON COLUMN reversiones_auditoria.tipo_reversion IS 'Tipo específico de reversión realizada';
COMMENT ON COLUMN reversiones_auditoria.documento_id IS 'ID del documento afectado';
COMMENT ON COLUMN reversiones_auditoria.pago_id IS 'Solo para reversiones de pagos específicos';
COMMENT ON COLUMN reversiones_auditoria.usuario_id IS 'ID del usuario que realizó la reversión';
COMMENT ON COLUMN reversiones_auditoria.rol_usuario IS 'Rol del usuario al momento de la reversión';
COMMENT ON COLUMN reversiones_auditoria.estado_anterior IS 'Estado del documento antes de la reversión';
COMMENT ON COLUMN reversiones_auditoria.estado_nuevo IS 'Estado del documento después de la reversión';
COMMENT ON COLUMN reversiones_auditoria.datos_anteriores IS 'Valores anteriores (monto, método, datos de entrega, etc.)';
COMMENT ON COLUMN reversiones_auditoria.datos_nuevos IS 'Valores nuevos después de la reversión';
COMMENT ON COLUMN reversiones_auditoria.motivo_categoria IS 'Categoría del error: error_humano, error_sistema, cambio_cliente, etc.';
COMMENT ON COLUMN reversiones_auditoria.justificacion IS 'Justificación detallada de por qué se necesita la reversión';
COMMENT ON COLUMN reversiones_auditoria.ip_address IS 'IP desde donde se realizó la reversión';
COMMENT ON COLUMN reversiones_auditoria.fecha_reversion IS 'Timestamp exacto de cuándo se realizó la reversión';
COMMENT ON COLUMN reversiones_auditoria.metadatos IS 'Información adicional de contexto';

-- Función y trigger para prevenir actualizaciones (inmutabilidad)
CREATE OR REPLACE FUNCTION prevent_reversiones_update()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Los registros de auditoría de reversiones son inmutables';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_reversiones_update_trigger
    BEFORE UPDATE ON reversiones_auditoria
    FOR EACH ROW
    EXECUTE FUNCTION prevent_reversiones_update();

-- Función para prevenir eliminaciones (inmutabilidad)
CREATE OR REPLACE FUNCTION prevent_reversiones_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Los registros de auditoría de reversiones no se pueden eliminar';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_reversiones_delete_trigger
    BEFORE DELETE ON reversiones_auditoria
    FOR EACH ROW
    EXECUTE FUNCTION prevent_reversiones_delete();

-- Verificar creación de la tabla
SELECT 'Tabla reversiones_auditoria creada exitosamente en PostgreSQL' as status; 