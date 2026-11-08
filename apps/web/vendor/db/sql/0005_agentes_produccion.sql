-- Ónix Govern 0005: "Activo" pasa a "En producción" para alinear agentes con el inventario.
UPDATE ai_agents SET status = 'En producción' WHERE status = 'Activo';
ALTER TABLE ai_agents ALTER COLUMN status SET DEFAULT 'En producción';
