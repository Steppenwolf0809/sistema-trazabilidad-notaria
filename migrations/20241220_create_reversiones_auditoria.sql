-- Migración: Crear tabla de auditoría de reversiones
-- Fecha: 20241220
-- Descripción: Tabla inmutable para registrar todas las reversiones del sistema

CREATE TABLE IF NOT EXISTS reversiones_auditoria (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tipo_reversion ENUM(
        'desmarcar_listo', 
        'deshacer_entrega', 
        'separar_grupo', 
        'reactivar_documento',
        'deshacer_pago', 
        'corregir_metodo_pago', 
        'ajustar_monto_pago', 
        'deshacer_retencion'
    ) NOT NULL COMMENT 'Tipo específico de reversión realizada',
    documento_id INT NOT NULL COMMENT 'ID del documento afectado',
    pago_id INT NULL COMMENT 'Solo para reversiones de pagos específicos',
    usuario_id INT NOT NULL COMMENT 'ID del usuario que realizó la reversión',
    rol_usuario ENUM('admin', 'caja', 'caja_archivo') NOT NULL COMMENT 'Rol del usuario al momento de la reversión',
    estado_anterior VARCHAR(100) NULL COMMENT 'Estado del documento antes de la reversión',
    estado_nuevo VARCHAR(100) NULL COMMENT 'Estado del documento después de la reversión',
    datos_anteriores JSON NULL COMMENT 'Valores anteriores (monto, método, datos de entrega, etc.)',
    datos_nuevos JSON NULL COMMENT 'Valores nuevos después de la reversión',
    motivo_categoria VARCHAR(100) NOT NULL COMMENT 'Categoría del error: error_humano, error_sistema, cambio_cliente, etc.',
    justificacion TEXT NOT NULL COMMENT 'Justificación detallada de por qué se necesita la reversión',
    ip_address VARCHAR(45) NULL COMMENT 'IP desde donde se realizó la reversión',
    fecha_reversion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Timestamp exacto de cuándo se realizó la reversión',
    metadatos JSON NULL DEFAULT '{}' COMMENT 'Información adicional de contexto',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Índices para optimizar consultas
    INDEX idx_documento_id (documento_id),
    INDEX idx_usuario_id (usuario_id),
    INDEX idx_tipo_reversion (tipo_reversion),
    INDEX idx_fecha_reversion (fecha_reversion),
    INDEX idx_rol_usuario (rol_usuario),
    
    -- Claves foráneas
    FOREIGN KEY (documento_id) REFERENCES documentos(id) ON DELETE RESTRICT,
    FOREIGN KEY (usuario_id) REFERENCES matrizadores(id) ON DELETE RESTRICT,
    
    -- Constraint para validar longitud de justificación
    CONSTRAINT chk_justificacion_length CHECK (CHAR_LENGTH(justificacion) >= 20)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Comentario de la tabla
ALTER TABLE reversiones_auditoria COMMENT = 'Tabla inmutable de auditoría para todas las reversiones del sistema';

-- Trigger para prevenir actualizaciones (inmutabilidad)
DELIMITER $$
CREATE TRIGGER prevent_reversiones_update 
    BEFORE UPDATE ON reversiones_auditoria
    FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los registros de auditoría de reversiones son inmutables';
END$$
DELIMITER ;

-- Verificar creación de la tabla
SELECT 'Tabla reversiones_auditoria creada exitosamente' as status; 