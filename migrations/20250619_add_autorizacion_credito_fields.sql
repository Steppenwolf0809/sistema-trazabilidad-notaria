-- Migración: Agregar campos de autorización de crédito
-- Fecha: 2025-06-19
-- Descripción: Agregar campos para sistema de autorización de entrega sin verificación de pago

-- Agregar campo booleano para autorización de entrega sin pago
ALTER TABLE documentos 
ADD COLUMN entrega_sin_verificar_pago BOOLEAN DEFAULT FALSE NOT NULL 
COMMENT 'Indica si el cliente tiene crédito autorizado y puede retirar sin pago previo';

-- Agregar campo para justificación de la autorización
ALTER TABLE documentos 
ADD COLUMN justificacion_entrega_sin_pago ENUM('cliente_corporativo', 'historial_pagos', 'urgencia_justificada', 'cliente_frecuente', 'otro') NULL 
COMMENT 'Justificación para autorizar entrega sin verificación de pago';

-- Agregar campo para fecha de autorización
ALTER TABLE documentos 
ADD COLUMN fecha_autorizacion_entrega TIMESTAMP NULL 
COMMENT 'Timestamp de cuando se autorizó la entrega sin verificación de pago';

-- Agregar campo para ID del matrizador que autorizó
ALTER TABLE documentos 
ADD COLUMN autorizado_por_matrizador_id INT NULL 
COMMENT 'ID del matrizador que autorizó la entrega sin verificación de pago';

-- Agregar índice en autorizado_por_matrizador_id para mejor performance
ALTER TABLE documentos 
ADD INDEX idx_autorizado_por_matrizador (autorizado_por_matrizador_id);

-- Agregar índice en entrega_sin_verificar_pago para consultas rápidas
ALTER TABLE documentos 
ADD INDEX idx_entrega_sin_verificar_pago (entrega_sin_verificar_pago);

-- Agregar clave foránea para autorizado_por_matrizador_id
ALTER TABLE documentos 
ADD CONSTRAINT fk_autorizado_por_matrizador 
FOREIGN KEY (autorizado_por_matrizador_id) REFERENCES matrizadores(id) 
ON UPDATE CASCADE ON DELETE SET NULL;

-- Comentario de confirmación
SELECT 'Migración completada: Campos de autorización de crédito agregados a tabla documentos' AS resultado; 