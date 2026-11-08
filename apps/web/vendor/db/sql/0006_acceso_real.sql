-- Ónix Govern 0006: acceso real (contraseñas, invitaciones, recuperación), intentos de login,
-- archivos de evidencia y control de recordatorios.

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_consultant boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS default_organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

CREATE TABLE IF NOT EXISTS user_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text,
  role membership_role NOT NULL DEFAULT 'admin',
  as_consultant boolean NOT NULL DEFAULT false,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  invited_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_invites_org_idx ON user_invites(organization_id);

-- Sin RLS: se buscan por hash del token antes de tener sesión y no contienen datos de negocio.
CREATE TABLE IF NOT EXISTS password_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_attempts (
  key text PRIMARY KEY,
  count integer NOT NULL DEFAULT 0,
  reset_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS evidence_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  evidence_id uuid NOT NULL REFERENCES evidences(id) ON DELETE CASCADE,
  filename text NOT NULL,
  content_type text NOT NULL,
  size integer NOT NULL,
  data bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS evidence_files_evidence_idx ON evidence_files(evidence_id);

ALTER TABLE invitations ADD COLUMN IF NOT EXISTS last_reminded_at timestamptz;
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS reminders_sent integer NOT NULL DEFAULT 0;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS reeval_reminded_for date;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['user_invites', 'evidence_files']
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
