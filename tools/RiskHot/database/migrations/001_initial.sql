CREATE SCHEMA IF NOT EXISTS platform;
CREATE TABLE IF NOT EXISTS platform.migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS platform.operations (
  key text PRIMARY KEY, actor_id text NOT NULL, command text NOT NULL, digest text NOT NULL,
  response jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS platform.claims (key text PRIMARY KEY, value text NOT NULL);
CREATE TABLE IF NOT EXISTS platform.audit (
  id bigserial PRIMARY KEY, actor_id text NOT NULL, actor_name text NOT NULL,
  action text NOT NULL, domain text NOT NULL, object_id text NOT NULL, detail jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS platform.outbox (
  id uuid PRIMARY KEY, type text NOT NULL, aggregate_id text NOT NULL, payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending', attempts int NOT NULL DEFAULT 0,
  lease_until timestamptz, delivered_at timestamptz, last_error text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS outbox_delivery ON platform.outbox(status,created_at);
CREATE TABLE IF NOT EXISTS platform.sessions (
  token_hash text PRIMARY KEY, user_id text NOT NULL, csrf_hash text NOT NULL, expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS platform.artifacts (
  id text PRIMARY KEY, hash text NOT NULL, storage_key text NOT NULL, size_bytes bigint NOT NULL,
  media_type text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
DO $$
DECLARE d text;
BEGIN
  FOREACH d IN ARRAY ARRAY['reference','observations','information','registry','analysis','publication','operations','identity'] LOOP
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I',d);
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.records (id uuid PRIMARY KEY, kind text NOT NULL, version int NOT NULL DEFAULT 1, status text NOT NULL, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())',d);
    EXECUTE format('CREATE INDEX IF NOT EXISTS records_kind ON %I.records(kind,created_at,id)',d);
    EXECUTE format('CREATE INDEX IF NOT EXISTS records_data ON %I.records USING gin(data)',d);
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.history (id uuid NOT NULL, version int NOT NULL, kind text NOT NULL, status text NOT NULL, data jsonb NOT NULL, created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL, PRIMARY KEY(id,version))',d);
  END LOOP;
END $$;
CREATE TABLE IF NOT EXISTS registry.monitored_risk_event_relation (
  relation_id uuid PRIMARY KEY, risk_id uuid NOT NULL REFERENCES registry.records(id),
  event_id uuid NOT NULL REFERENCES information.records(id), event_update_id uuid REFERENCES information.records(id),
  relation_reason text NOT NULL, is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(risk_id,event_id)
);
