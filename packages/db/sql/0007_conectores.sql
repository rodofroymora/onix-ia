-- Ónix Govern 0007: conectores de descubrimiento (Microsoft, AWS, Google) y lo que detectan.
CREATE TABLE IF NOT EXISTS connectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'pendiente',
  display_name text,
  config jsonb NOT NULL DEFAULT '{}',
  secret_enc text,
  last_sync_at timestamptz,
  last_sync_summary jsonb NOT NULL DEFAULT '{}',
  last_error text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS connectors_org_provider_uidx ON connectors(organization_id, provider);

CREATE TABLE IF NOT EXISTS discovered_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  connector_id uuid NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
  provider text NOT NULL,
  source text NOT NULL,
  external_id text NOT NULL,
  kind text NOT NULL DEFAULT 'agente',
  name text NOT NULL,
  vendor text,
  platform text,
  owner_name text,
  users_count integer,
  suggested_risk text,
  details jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'nuevo',
  agent_id uuid REFERENCES ai_agents(id) ON DELETE SET NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS discovered_items_org_source_ext_uidx ON discovered_items(organization_id, source, external_id);
CREATE INDEX IF NOT EXISTS discovered_items_org_status_idx ON discovered_items(organization_id, status);

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['connectors', 'discovered_items']
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
