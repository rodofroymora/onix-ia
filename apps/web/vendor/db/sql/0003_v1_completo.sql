-- 0003: multi-respondente, inventario completo, avance del plan, metas y reevaluación

-- Respuestas por respondente (antes: una sola respuesta por pregunta)
ALTER TABLE answers ADD COLUMN IF NOT EXISTS invitation_id uuid REFERENCES invitations(id) ON DELETE CASCADE;
DROP INDEX IF EXISTS answers_assessment_question_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS answers_assessment_question_invitation_uidx
  ON answers(assessment_id, question_id, invitation_id) NULLS NOT DISTINCT;

-- Respondentes: nombre, funciones que cubre y fecha de término
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS respondent_name text;
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS functions jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Inventario: ficha completa (CU-05) con atributos de priorización y factibilidad (CU-08)
ALTER TABLE ai_use_cases ADD COLUMN IF NOT EXISTS owner_name text;
ALTER TABLE ai_use_cases ADD COLUMN IF NOT EXISTS technology text;
ALTER TABLE ai_use_cases ADD COLUMN IF NOT EXISTS vendor text;
ALTER TABLE ai_use_cases ADD COLUMN IF NOT EXISTS uses_personal_data boolean NOT NULL DEFAULT false;
ALTER TABLE ai_use_cases ADD COLUMN IF NOT EXISTS decides_on_people boolean NOT NULL DEFAULT false;
ALTER TABLE ai_use_cases ADD COLUMN IF NOT EXISTS customer_facing boolean NOT NULL DEFAULT false;
ALTER TABLE ai_use_cases ADD COLUMN IF NOT EXISTS autonomy text NOT NULL DEFAULT 'sugiere';
ALTER TABLE ai_use_cases ADD COLUMN IF NOT EXISTS value_score integer;
ALTER TABLE ai_use_cases ADD COLUMN IF NOT EXISTS annual_value integer;
ALTER TABLE ai_use_cases ADD COLUMN IF NOT EXISTS strategic_objective text;
ALTER TABLE ai_use_cases ADD COLUMN IF NOT EXISTS strategic_fit integer;
ALTER TABLE ai_use_cases ADD COLUMN IF NOT EXISTS data_quality integer;
ALTER TABLE ai_use_cases ADD COLUMN IF NOT EXISTS effort integer;
ALTER TABLE ai_use_cases ADD COLUMN IF NOT EXISTS tech_maturity integer;
ALTER TABLE ai_use_cases ADD COLUMN IF NOT EXISTS integration integer;
ALTER TABLE ai_use_cases ADD COLUMN IF NOT EXISTS infrastructure integer;
ALTER TABLE ai_use_cases ADD COLUMN IF NOT EXISTS skills integer;

-- Plan: fecha compromiso, puntos que aporta a su dimensión y notas (CU-09 / CU-12)
ALTER TABLE actions ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE actions ADD COLUMN IF NOT EXISTS lift_points integer NOT NULL DEFAULT 6;
ALTER TABLE actions ADD COLUMN IF NOT EXISTS summary text;

-- Metas de madurez por dimensión (0 a 100), fijadas por el cliente con el consultor
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS maturity_targets jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Reevaluación (CU-13)
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'inicial';
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS previous_assessment_id uuid REFERENCES assessments(id) ON DELETE SET NULL;

-- Metadatos de la plataforma (versión de la siembra demo). Sin datos de clientes, sin RLS.
CREATE TABLE IF NOT EXISTS govern_meta (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
