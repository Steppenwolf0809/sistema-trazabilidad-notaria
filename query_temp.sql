SELECT tipo, COUNT(*) as cantidad FROM NotificacionesEnviadas GROUP BY tipo ORDER BY cantidad DESC LIMIT 10;
