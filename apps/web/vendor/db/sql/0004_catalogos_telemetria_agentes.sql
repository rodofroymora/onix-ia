-- Ónix Govern 0004: listas estándar en casos, telemetría de uso, registro de agentes,
-- dependencias entre acciones y recordatorio de reevaluación.

ALTER TABLE ai_use_cases ADD COLUMN IF NOT EXISTS ai_type text;
ALTER TABLE ai_use_cases ADD COLUMN IF NOT EXISTS value_type text;
ALTER TABLE ai_use_cases ADD COLUMN IF NOT EXISTS data_classification text;
ALTER TABLE ai_use_cases ADD COLUMN IF NOT EXISTS deployment text;
ALTER TABLE ai_use_cases ADD COLUMN IF NOT EXISTS user_scope text;

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS reevaluation_months integer NOT NULL DEFAULT 6;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS ingest_key_hash text;

ALTER TABLE assessments ADD COLUMN IF NOT EXISTS published_at timestamptz;
UPDATE assessments SET published_at = updated_at WHERE status = 'completed' AND published_at IS NULL;

CREATE TABLE IF NOT EXISTS ai_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  platform text NOT NULL,
  publisher text NOT NULL DEFAULT 'Organización',
  channel text NOT NULL DEFAULT 'Interno',
  owner_name text,
  status text NOT NULL DEFAULT 'Activo',
  risk text NOT NULL DEFAULT 'Medio',
  managed boolean NOT NULL DEFAULT true,
  use_case_id uuid REFERENCES ai_use_cases(id) ON DELETE SET NULL,
  data_sources jsonb NOT NULL DEFAULT '[]',
  capabilities jsonb NOT NULL DEFAULT '[]',
  monthly_users integer NOT NULL DEFAULT 0,
  last_activity date,
  origin text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_agents_org_idx ON ai_agents(organization_id);

CREATE TABLE IF NOT EXISTS ai_usage_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period date NOT NULL,
  tool text NOT NULL,
  use_case_id uuid REFERENCES ai_use_cases(id) ON DELETE SET NULL,
  agent_id uuid REFERENCES ai_agents(id) ON DELETE SET NULL,
  active_users integer NOT NULL DEFAULT 0,
  requests integer NOT NULL DEFAULT 0,
  cost_mxn integer NOT NULL DEFAULT 0,
  incidents integer NOT NULL DEFAULT 0,
  sanctioned boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_usage_metrics_org_period_idx ON ai_usage_metrics(organization_id, period);
CREATE UNIQUE INDEX IF NOT EXISTS ai_usage_metrics_org_period_tool_uidx ON ai_usage_metrics(organization_id, period, tool);

CREATE TABLE IF NOT EXISTS action_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  from_action_id uuid NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
  to_action_id uuid NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
  weight integer NOT NULL DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT action_dependencies_not_self CHECK (from_action_id <> to_action_id),
  CONSTRAINT action_dependencies_weight CHECK (weight BETWEEN 1 AND 100)
);
CREATE UNIQUE INDEX IF NOT EXISTS action_dependencies_pair_uidx ON action_dependencies(from_action_id, to_action_id);

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ai_agents', 'ai_usage_metrics', 'action_dependencies']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_org_isolation', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I
         FOR ALL
         USING (organization_id = govern_current_org())
         WITH CHECK (organization_id = govern_current_org())',
      t || '_org_isolation',
      t
    );
  END LOOP;
END $$;
