-- Inventario: origen y estado (CU-05/06/07)
ALTER TABLE ai_use_cases ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'manual';
ALTER TABLE ai_use_cases ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Propuesto';
