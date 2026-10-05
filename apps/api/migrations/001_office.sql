CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS users (id text PRIMARY KEY, email text UNIQUE NOT NULL, name text NOT NULL, role text NOT NULL CHECK(role IN ('Admin','Operator','Viewer','Client')), password_hash text NOT NULL, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS sessions (token_hash text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL, csrf_token text NOT NULL);
CREATE TABLE IF NOT EXISTS settings (id text PRIMARY KEY, data jsonb NOT NULL, updated_at timestamptz DEFAULT now());
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['clients','projects','stages','tasks','task_dependencies','agents','agent_messages','tool_calls','artifacts','requirements','test_runs','bugs','deployments','emails','approvals','usage_costs','events','chat_sessions','chat_messages','knowledge_items','surveys','change_requests','security_reports','dead_letters'] LOOP
EXECUTE format('CREATE TABLE IF NOT EXISTS %I (id text PRIMARY KEY, project_id text, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())', t);
EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I(project_id)',t||'_project_idx',t);
END LOOP; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS task_idempotency ON tasks ((data->>'idempotency_key')) WHERE data->>'idempotency_key' IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS email_idempotency ON emails ((data->>'idempotency_key')) WHERE data->>'idempotency_key' IS NOT NULL;
CREATE INDEX IF NOT EXISTS event_ts ON events ((data->>'ts'));
CREATE INDEX IF NOT EXISTS task_status ON tasks ((data->>'status'));
CREATE OR REPLACE FUNCTION audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Audit events are append-only'; END $$;
DROP TRIGGER IF EXISTS immutable_events ON events;
CREATE TRIGGER immutable_events BEFORE UPDATE OR DELETE ON events FOR EACH ROW EXECUTE FUNCTION audit_immutable();
CREATE OR REPLACE FUNCTION approval_once() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.data->>'decision' IS NOT NULL AND NEW.data IS DISTINCT FROM OLD.data THEN RAISE EXCEPTION 'Approval already decided'; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS immutable_approval ON approvals;
CREATE TRIGGER immutable_approval BEFORE UPDATE ON approvals FOR EACH ROW EXECUTE FUNCTION approval_once();
