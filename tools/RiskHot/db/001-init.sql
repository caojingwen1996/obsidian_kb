CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS m1;
CREATE SCHEMA IF NOT EXISTS platform;
CREATE SCHEMA IF NOT EXISTS information;
CREATE TABLE IF NOT EXISTS platform.schema_versions(version integer PRIMARY KEY, installed_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS m1.sources(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), catalog_key text NOT NULL UNIQUE,
 name text NOT NULL, url text NOT NULL, metadata jsonb NOT NULL,
 state text NOT NULL CHECK(state IN ('ACTIVE','DISABLED')), version integer NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS m1.source_versions(
 source_id uuid REFERENCES m1.sources(id), version integer NOT NULL, config jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(source_id,version)
);
CREATE TABLE IF NOT EXISTS platform.actors(
 subject text PRIMARY KEY, permissions text[] NOT NULL, source_keys text[] NOT NULL
);
CREATE TABLE IF NOT EXISTS platform.artifact_objects(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sha256 text NOT NULL UNIQUE CHECK(sha256 ~ '^[a-f0-9]{64}$'),
 size integer NOT NULL CHECK(size>=0), kind text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS information.materials(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_id uuid NOT NULL REFERENCES m1.sources(id),
 identity text NOT NULL, current_version_id uuid, row_version bigint NOT NULL DEFAULT 0, UNIQUE(source_id,identity)
);
CREATE TABLE IF NOT EXISTS information.material_versions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), material_id uuid NOT NULL REFERENCES information.materials(id),
 version_no integer NOT NULL CHECK(version_no>0), raw_artifact_id uuid NOT NULL REFERENCES platform.artifact_objects(id),
 normalized_artifact_id uuid NOT NULL REFERENCES platform.artifact_objects(id), content_digest text NOT NULL,
 normalizer_version text NOT NULL, title text, published_at_text text, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(material_id,content_digest), UNIQUE(material_id,version_no), UNIQUE(material_id,id)
);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='materials_current_version_fk') THEN
 ALTER TABLE information.materials ADD CONSTRAINT materials_current_version_fk FOREIGN KEY(id,current_version_id) REFERENCES information.material_versions(material_id,id) DEFERRABLE INITIALLY DEFERRED;
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS information.material_segments(
 version_id uuid REFERENCES information.material_versions(id), id uuid NOT NULL,
 ordinal integer NOT NULL, text text NOT NULL, raw_locator text NOT NULL, kind text NOT NULL,
 PRIMARY KEY(version_id,id), UNIQUE(version_id,ordinal)
);
CREATE TABLE IF NOT EXISTS information.operations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), parent_id uuid REFERENCES information.operations(id),
 kind text NOT NULL CHECK(kind IN ('batch','material')), source_id uuid NOT NULL REFERENCES m1.sources(id), source_version integer NOT NULL,
 actor text NOT NULL REFERENCES platform.actors(subject), command_artifact_id uuid NOT NULL REFERENCES platform.artifact_objects(id),
 url text, status text NOT NULL DEFAULT 'queued', stage text NOT NULL DEFAULT 'source', reason_code text,
 generation bigint NOT NULL DEFAULT 1, raw_artifact_id uuid REFERENCES platform.artifact_objects(id),
 normalized_artifact_id uuid REFERENCES platform.artifact_objects(id), version_id uuid REFERENCES information.material_versions(id), processing_id uuid,
 created_at timestamptz NOT NULL DEFAULT now(), scheduled_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(source_id,source_version) REFERENCES m1.source_versions(source_id,version), UNIQUE(parent_id,url)
);
CREATE TABLE IF NOT EXISTS platform.command_receipts(
 actor text NOT NULL REFERENCES platform.actors(subject), kind text NOT NULL, key text NOT NULL,
 digest text NOT NULL, operation_id uuid NOT NULL REFERENCES information.operations(id),
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(actor,kind,key)
);
CREATE TABLE IF NOT EXISTS information.acquisitions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), operation_id uuid NOT NULL REFERENCES information.operations(id),
 raw_artifact_id uuid NOT NULL REFERENCES platform.artifact_objects(id), acquired_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(operation_id,raw_artifact_id)
);
CREATE TABLE IF NOT EXISTS information.processing_runs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), version_id uuid NOT NULL REFERENCES information.material_versions(id),
 analysis_key text NOT NULL DEFAULT 'EXTRACTION_ONLY', processing_scope text NOT NULL DEFAULT 'EXTRACTION_ONLY' CHECK(processing_scope='EXTRACTION_ONLY'),
 extraction_status text NOT NULL DEFAULT 'pending', result_status text NOT NULL DEFAULT 'pending',
 candidate_count integer CHECK(candidate_count>=0), generation bigint NOT NULL DEFAULT 1,
 manifest_artifact_id uuid REFERENCES platform.artifact_objects(id), input_artifact_id uuid REFERENCES platform.artifact_objects(id),
 error_code text, created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, UNIQUE(version_id,analysis_key)
);
CREATE TABLE IF NOT EXISTS information.event_candidates(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), processing_id uuid NOT NULL REFERENCES information.processing_runs(id),
 candidate_key uuid NOT NULL DEFAULT gen_random_uuid(), status text NOT NULL DEFAULT 'pending' CHECK(status='pending'),
 ordinal integer NOT NULL, payload jsonb NOT NULL, UNIQUE(processing_id,candidate_key), UNIQUE(processing_id,ordinal)
);
CREATE TABLE IF NOT EXISTS platform.execution_intents(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL, owner_id uuid NOT NULL,
 generation bigint NOT NULL, workflow_id text NOT NULL UNIQUE, state text NOT NULL DEFAULT 'pending',
 lease_token uuid, lease_until timestamptz, next_attempt_at timestamptz NOT NULL DEFAULT now(), attempts integer NOT NULL DEFAULT 0,
 UNIQUE(kind,owner_id,generation)
);
CREATE TABLE IF NOT EXISTS platform.messages(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), version_id uuid NOT NULL REFERENCES information.material_versions(id) UNIQUE,
 state text NOT NULL DEFAULT 'pending', receipt_processing_id uuid REFERENCES information.processing_runs(id),
 attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS platform.inbox(
 message_id uuid PRIMARY KEY REFERENCES platform.messages(id), processing_id uuid NOT NULL REFERENCES information.processing_runs(id), received_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS platform.model_budget_windows(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), processing_id uuid NOT NULL REFERENCES information.processing_runs(id),
 generation bigint NOT NULL, used integer NOT NULL DEFAULT 0 CHECK(used BETWEEN 0 AND 3),
 deadline timestamptz NOT NULL DEFAULT now()+interval '10 minutes', actor text NOT NULL, reason text NOT NULL,
 UNIQUE(processing_id,generation)
);
CREATE TABLE IF NOT EXISTS platform.model_attempts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), processing_id uuid NOT NULL REFERENCES information.processing_runs(id),
 window_id uuid NOT NULL REFERENCES platform.model_budget_windows(id), generation bigint NOT NULL,
 attempt_no integer NOT NULL, status text NOT NULL DEFAULT 'prepared', request_artifact_id uuid NOT NULL REFERENCES platform.artifact_objects(id),
 response_artifact_id uuid REFERENCES platform.artifact_objects(id), finish_reason text, error_code text,
 created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, UNIQUE(processing_id,attempt_no)
);
ALTER TABLE platform.model_attempts ADD COLUMN IF NOT EXISTS call_key text;
CREATE UNIQUE INDEX IF NOT EXISTS model_attempt_call_key ON platform.model_attempts(processing_id,generation,call_key);
CREATE TABLE IF NOT EXISTS platform.audit_log(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor text NOT NULL, action text NOT NULL, owner_id uuid, detail jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS platform.auth_states(
 state_hash text PRIMARY KEY, verifier text NOT NULL, nonce text NOT NULL, expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS platform.auth_sessions(
 token_hash text PRIMARY KEY, subject text NOT NULL, expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS operations_time_idx ON information.operations(scheduled_at DESC,id);
CREATE INDEX IF NOT EXISTS pending_intents_idx ON platform.execution_intents(next_attempt_at,id) WHERE state<>'started';
INSERT INTO platform.schema_versions(version) VALUES(1) ON CONFLICT DO NOTHING;
