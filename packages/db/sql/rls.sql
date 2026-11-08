-- Ónix Govern — helpers RLS (Postgres / PGlite compatible donde aplique).
-- Política: toda fila de negocio se filtra por organization_id = current_setting('app.organization_id')::uuid

CREATE OR REPLACE FUNCTION govern_current_org() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.organization_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION govern_set_org(p_org uuid) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('app.organization_id', p_org::text, true);
END;
$$;

-- Habilitar RLS en tablas de negocio (idempotente vía DO blocks)
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'memberships',
    'responsibility_maps',
    'assessments',
    'invitations',
    'answers',
    'dimension_results',
    'gaps',
    'tech_profiles',
    'ai_use_cases',
    'triage_validations',
    'prioritization_weights',
    'prioritization_scores',
    'plans',
    'stages',
    'actions',
    'evidences',
    'reports',
    'audit_logs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
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
