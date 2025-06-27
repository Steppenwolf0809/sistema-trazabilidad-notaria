-- Migración: Crear tabla de autorizaciones urgentes
-- Fecha: 2025-06-21
-- Descripción: Sistema de autorización digital preferida + verbal como backup

CREATE TABLE IF NOT EXISTS autorizaciones_urgentes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  
  -- DOCUMENTO Y CLIENTE
  documento_id INT NOT NULL,
  cliente_nombre VARCHAR(255) NOT NULL,
  tipo_documento VARCHAR(100) NOT NULL,
  codigo_barras VARCHAR(100) NOT NULL,
  monto_pendiente DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  
  -- SOLICITUD
  solicitud_fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  solicitado_por_id INT NOT NULL,
  solicitado_por_nombre VARCHAR(255) NOT NULL,
  solicitado_por_rol VARCHAR(50) NOT NULL,
  justificacion_solicitud TEXT NOT NULL,
  metodo_solicitud ENUM('digital', 'verbal') NOT NULL DEFAULT 'digital',
  
  -- RESPONSABLE ORIGINAL
  matrizador_responsable_id INT NULL,
  matrizador_responsable_nombre VARCHAR(255) NULL,
  
  -- AUTORIZACIÓN
  estado ENUM('pendiente', 'autorizada', 'rechazada', 'expirada', 'verbal_pendiente') NOT NULL DEFAULT 'pendiente',
  autorizada_fecha DATETIME NULL,
  autorizada_por_id INT NULL,
  autorizada_por_nombre VARCHAR(255) NULL,
  autorizada_por_rol VARCHAR(50) NULL,
  justificacion_autorizacion TEXT NULL,
  tipo_justificacion ENUM(
    'cliente_corporativo',
    'historial_excelente', 
    'urgencia_medica',
    'error_sistema',
    'cliente_conocido',
    'personalizado'
  ) NULL,
  
  -- VERBAL BACKUP
  es_verbal BOOLEAN NOT NULL DEFAULT FALSE,
  verbal_fecha DATETIME NULL,
  verbal_quien_autorizo VARCHAR(255) NULL,
  verbal_ratificada BOOLEAN NOT NULL DEFAULT FALSE,
  verbal_fecha_limite DATETIME NULL,
  
  -- RECHAZO
  rechazada_fecha DATETIME NULL,
  rechazada_por_id INT NULL,
  rechazada_por_nombre VARCHAR(255) NULL,
  motivo_rechazo TEXT NULL,
  
  -- NOTIFICACIONES
  notificaciones_enviadas INT NOT NULL DEFAULT 0,
  ultima_notificacion DATETIME NULL,
  
  -- METADATOS
  metadatos JSON NULL,
  
  -- TIMESTAMPS
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- ÍNDICES
  INDEX idx_documento_id (documento_id),
  INDEX idx_estado (estado),
  INDEX idx_solicitud_fecha (solicitud_fecha),
  INDEX idx_matrizador_responsable (matrizador_responsable_id),
  INDEX idx_autorizada_por (autorizada_por_id),
  INDEX idx_verbal_estado (es_verbal, verbal_ratificada),
  INDEX idx_estado_fecha (estado, solicitud_fecha),
  
  -- LLAVES FORÁNEAS
  FOREIGN KEY (documento_id) REFERENCES documentos(id) ON DELETE CASCADE,
  FOREIGN KEY (solicitado_por_id) REFERENCES matrizadores(id) ON DELETE RESTRICT,
  FOREIGN KEY (matrizador_responsable_id) REFERENCES matrizadores(id) ON DELETE SET NULL,
  FOREIGN KEY (autorizada_por_id) REFERENCES matrizadores(id) ON DELETE SET NULL,
  FOREIGN KEY (rechazada_por_id) REFERENCES matrizadores(id) ON DELETE SET NULL
) 
ENGINE=InnoDB 
DEFAULT CHARSET=utf8mb4 
COLLATE=utf8mb4_unicode_ci
COMMENT='Sistema de autorización urgente para entrega sin pago - Flujo digital preferido + verbal backup'; 