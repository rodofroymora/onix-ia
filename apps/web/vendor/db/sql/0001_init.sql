-- Bootstrap DDL mínimo para PGlite (espejo del esquema Drizzle).
-- db:migrate aplica este archivo + rls.sql.
-- Nota: PGlite no incluye pgcrypto; gen_random_uuid() viene en el core (PG ≥13).

DO $$ BEGIN
  CREATE TYPE membership_role AS ENUM ('owner', 'admin', 'member', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE assessment_status AS ENUM ('draft', 'in_progress', 'completed', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'expired', 'revoked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE evidence_status AS ENUM ('none', 'pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE action_progress AS ENUM ('0', '25', '50', '75', '100');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE stage_name AS ENUM ('Bases', 'Controles', 'Mejora continua');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE extended_risk AS ENUM ('Bajo', 'Medio', 'Alto', 'Inaceptable');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE dimension_key AS ENUM ('est', 'rol', 'dat', 'rie', 'seg', 'per');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  sector text,
  country text NOT NULL DEFAULT 'MX',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  locale text NOT NULL DEFAULT 'es-MX',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role membership_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS memberships_org_user_uidx ON memberships(organization_id, user_id);

CREATE TABLE IF NOT EXISTS responsibility_maps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  roles jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS questionnaire_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  version text NOT NULL,
  label text NOT NULL,
  maturity_count integer NOT NULL,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS questionnaire_versions_version_uidx ON questionnaire_versions(version);

CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  questionnaire_version_id uuid NOT NULL REFERENCES questionnaire_versions(id) ON DELETE CASCADE,
  code text NOT NULL,
  dimension dimension_key,
  kind text NOT NULL,
  prompt text NOT NULL,
  options jsonb,
  order_index integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS questions_version_code_uidx ON questions(questionnaire_version_id, code);

CREATE TABLE IF NOT EXISTS assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  questionnaire_version_id uuid NOT NULL REFERENCES questionnaire_versions(id),
  title text NOT NULL,
  status assessment_status NOT NULL DEFAULT 'draft',
  saas_route integer,
  global_score integer,
  global_level integer,
  route_index integer,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assessment_id uuid REFERENCES assessments(id) ON DELETE CASCADE,
  email text NOT NULL,
  role membership_role NOT NULL DEFAULT 'member',
  status invitation_status NOT NULL DEFAULT 'pending',
  token text NOT NULL UNIQUE,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id),
  value_int integer,
  value_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS answers_assessment_question_uidx ON answers(assessment_id, question_id);

CREATE TABLE IF NOT EXISTS dimension_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  dimension dimension_key NOT NULL,
  score integer NOT NULL,
  level integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS dimension_results_assessment_dim_uidx ON dimension_results(assessment_id, dimension);

CREATE TABLE IF NOT EXISTS gaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  from_dimension dimension_key NOT NULL,
  to_dimension dimension_key NOT NULL,
  from_level integer NOT NULL,
  to_level integer NOT NULL,
  delta integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tech_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  stack jsonb NOT NULL DEFAULT '[]',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_use_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assessment_id uuid REFERENCES assessments(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  risk extended_risk NOT NULL DEFAULT 'Medio',
  recommended boolean NOT NULL DEFAULT false,
  in_production boolean NOT NULL DEFAULT false,
  area text,
  origin text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'Propuesto',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS triage_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  subject text NOT NULL,
  opinions jsonb NOT NULL DEFAULT '[]',
  agreed boolean NOT NULL,
  resolved_value integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prioritization_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'default',
  impacto_negocio numeric(6,4) NOT NULL,
  urgencia_regulatoria numeric(6,4) NOT NULL,
  facilidad_implementacion numeric(6,4) NOT NULL,
  dependencia_otros numeric(6,4) NOT NULL,
  riesgo_residual numeric(6,4) NOT NULL,
  valor_aprendizaje numeric(6,4) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prioritization_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  weights_id uuid NOT NULL REFERENCES prioritization_weights(id) ON DELETE CASCADE,
  subject_type text NOT NULL,
  subject_id uuid NOT NULL,
  criteria jsonb NOT NULL,
  score numeric(8,4) NOT NULL,
  normalized numeric(6,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assessment_id uuid REFERENCES assessments(id) ON DELETE SET NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  name stage_name NOT NULL,
  order_index integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  stage_id uuid NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
  title text NOT NULL,
  dimension dimension_key,
  progress action_progress NOT NULL DEFAULT '0',
  critical boolean NOT NULL DEFAULT false,
  deletable boolean NOT NULL DEFAULT true,
  from_risk extended_risk,
  owner_user_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evidences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  action_id uuid NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
  status evidence_status NOT NULL DEFAULT 'pending',
  label text NOT NULL,
  url text,
  notes text,
  reviewed_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assessment_id uuid REFERENCES assessments(id) ON DELETE SET NULL,
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'revision_inicial',
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  meta jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
