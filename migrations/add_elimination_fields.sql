-- Migración: Agregar campos de eliminación para sistema de caja
-- Sprint 5: Sistema de eliminación de documentos

-- Agregar campos de soft delete si no existen
DO $$
BEGIN
    -- Agregar campo deleted_at si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documentos' AND column_name='deleted_at') THEN
        ALTER TABLE documentos ADD COLUMN deleted_at TIMESTAMP NULL;
        ALTER TABLE documentos ADD COLUMN deleted_by INTEGER NULL REFERENCES matrizadores(id);
        ALTER TABLE documentos ADD COLUMN deletion_reason VARCHAR(50) NULL;
        ALTER TABLE documentos ADD COLUMN deletion_justification TEXT NULL;
        ALTER TABLE documentos ADD COLUMN payment_handling VARCHAR(50) NULL;
        
        -- Comentarios para documentación
        COMMENT ON COLUMN documentos.deleted_at IS 'Timestamp de soft delete - si está presente, el documento fue eliminado';
        COMMENT ON COLUMN documentos.deleted_by IS 'ID del usuario de caja que eliminó el documento';
        COMMENT ON COLUMN documentos.deletion_reason IS 'Motivo específico de eliminación para operaciones de caja';
        COMMENT ON COLUMN documentos.deletion_justification IS 'Justificación detallada de la eliminación (mínimo 20 caracteres)';
        COMMENT ON COLUMN documentos.payment_handling IS 'Cómo se manejó el pago existente al eliminar';
        
        RAISE NOTICE 'Campos de eliminación agregados exitosamente';
    ELSE
        RAISE NOTICE 'Los campos de eliminación ya existen';
    END IF;
    
    -- Verificar y crear índices para performance
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='documentos' AND indexname='idx_documentos_deleted_at') THEN
        CREATE INDEX idx_documentos_deleted_at ON documentos(deleted_at) WHERE deleted_at IS NOT NULL;
        RAISE NOTICE 'Índice idx_documentos_deleted_at creado';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='documentos' AND indexname='idx_documentos_deletion_reason') THEN
        CREATE INDEX idx_documentos_deletion_reason ON documentos(deletion_reason) WHERE deletion_reason IS NOT NULL;
        RAISE NOTICE 'Índice idx_documentos_deletion_reason creado';
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error en migración: %', SQLERRM;
END
$$; 