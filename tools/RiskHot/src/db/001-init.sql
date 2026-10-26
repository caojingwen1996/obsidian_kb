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
CREATE OR REPLACE FUNCTION platform.authorize_actor(p_subject text,p_permission text,p_source text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,platform AS $$
BEGIN
 PERFORM 1 FROM platform.actors WHERE subject=p_subject AND p_permission=ANY(permissions)
 AND (p_source IS NULL OR p_source=ANY(source_keys) OR '*'=ANY(source_keys)) FOR SHARE;
 RETURN FOUND;
END $$;
CREATE OR REPLACE FUNCTION platform.lock_source(p_id uuid)
RETURNS TABLE(catalog_key text,state text) LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,m1 AS $$
 SELECT s.catalog_key,s.state FROM m1.sources s WHERE s.id=p_id FOR SHARE OF s
$$;
REVOKE ALL ON FUNCTION platform.authorize_actor(text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION platform.lock_source(uuid) FROM PUBLIC;
CREATE OR REPLACE FUNCTION platform.source_for_submit(p_key text)
RETURNS TABLE(id uuid,version integer,state text) LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,m1 AS $$
 SELECT s.id,s.version,s.state FROM m1.sources s WHERE s.catalog_key=p_key FOR SHARE OF s
$$;
REVOKE ALL ON FUNCTION platform.source_for_submit(text) FROM PUBLIC;
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
CREATE TABLE IF NOT EXISTS platform.action_receipts(
 actor text NOT NULL REFERENCES platform.actors(subject), kind text NOT NULL, key text NOT NULL,
 digest text NOT NULL, result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(actor,kind,key)
);
CREATE TABLE IF NOT EXISTS information.acquisitions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), operation_id uuid NOT NULL REFERENCES information.operations(id),
 raw_artifact_id uuid NOT NULL REFERENCES platform.artifact_objects(id), acquired_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(operation_id,raw_artifact_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS acquisition_operation_key ON information.acquisitions(operation_id);
CREATE TABLE IF NOT EXISTS information.processing_runs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), version_id uuid NOT NULL REFERENCES information.material_versions(id),
 analysis_key text NOT NULL DEFAULT 'EXTRACTION_ONLY', processing_scope text NOT NULL DEFAULT 'EXTRACTION_ONLY' CHECK(processing_scope='EXTRACTION_ONLY'),
 extraction_status text NOT NULL DEFAULT 'pending', result_status text NOT NULL DEFAULT 'pending',
 candidate_count integer CHECK(candidate_count>=0), generation bigint NOT NULL DEFAULT 1,
 manifest_artifact_id uuid REFERENCES platform.artifact_objects(id), input_artifact_id uuid REFERENCES platform.artifact_objects(id),
 error_code text, created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, UNIQUE(version_id,analysis_key)
);
ALTER TABLE information.operations ADD COLUMN IF NOT EXISTS paused boolean NOT NULL DEFAULT false;
ALTER TABLE information.processing_runs ADD COLUMN IF NOT EXISTS paused boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS platform.task_batches(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor text NOT NULL REFERENCES platform.actors(subject),
 scheduled_at timestamptz NOT NULL DEFAULT now(), paused boolean NOT NULL DEFAULT false, version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS platform.task_batch_sources(
 batch_id uuid NOT NULL REFERENCES platform.task_batches(id), source_id uuid NOT NULL REFERENCES m1.sources(id),
 source_version integer NOT NULL, operation_id uuid UNIQUE REFERENCES information.operations(id),
 status text NOT NULL DEFAULT 'queued', reason_code text, PRIMARY KEY(batch_id,source_id),
 FOREIGN KEY(source_id,source_version) REFERENCES m1.source_versions(source_id,version)
);
CREATE INDEX IF NOT EXISTS task_batches_time_idx ON platform.task_batches(scheduled_at DESC,id);
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
ALTER TABLE platform.model_attempts ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE information.processing_runs ADD COLUMN IF NOT EXISTS review_attempt_id uuid REFERENCES platform.model_attempts(id);
ALTER TABLE information.processing_runs ADD COLUMN IF NOT EXISTS provider_protocol text;
CREATE TABLE IF NOT EXISTS platform.model_service_state(
 protocol text PRIMARY KEY, reason_code text, blocked_until timestamptz, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS platform.automatic_recoveries(
 processing_id uuid NOT NULL REFERENCES information.processing_runs(id), generation bigint NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(processing_id,generation)
);
CREATE TABLE IF NOT EXISTS platform.source_schedules(
 source_id uuid PRIMARY KEY REFERENCES m1.sources(id), enabled boolean NOT NULL DEFAULT true,
 interval_seconds integer NOT NULL DEFAULT 3600 CHECK(interval_seconds BETWEEN 60 AND 86400),
 next_run_at timestamptz NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS platform.schedule_runs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_id uuid NOT NULL REFERENCES m1.sources(id),
 scheduled_at timestamptz NOT NULL, operation_id uuid REFERENCES information.operations(id),
 status text NOT NULL DEFAULT 'pending', error_code text, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(source_id,scheduled_at)
);
CREATE TABLE IF NOT EXISTS platform.runtime_alerts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), issue_key text NOT NULL, code text NOT NULL, owner_id uuid,
 opened_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz,
 delivery_status text NOT NULL DEFAULT 'pending', delivery_attempts integer NOT NULL DEFAULT 0,
 next_delivery_at timestamptz NOT NULL DEFAULT now(), delivered_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS active_alert_key ON platform.runtime_alerts(issue_key) WHERE resolved_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS model_attempt_call_key ON platform.model_attempts(processing_id,generation,call_key);
CREATE OR REPLACE FUNCTION platform.claim_model_call(p_attempt uuid)
RETURNS TABLE(allowed boolean,reason_code text,deadline timestamptz,request_artifact_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,platform,information,m1 AS $$
DECLARE item record; source_record record; actor_name text;
BEGIN
 SELECT a.id,a.processing_id,a.generation,a.status,a.request_artifact_id,p.generation AS current_generation,
 p.extraction_status,p.paused,p.input_artifact_id,p.provider_protocol,w.deadline AS call_deadline,m.source_id INTO item
 FROM platform.model_attempts a JOIN information.processing_runs p ON p.id=a.processing_id
 JOIN platform.model_budget_windows w ON w.id=a.window_id
 JOIN information.material_versions v ON v.id=p.version_id JOIN information.materials m ON m.id=v.material_id
 WHERE a.id=p_attempt FOR UPDATE OF a FOR SHARE OF p;
 IF NOT FOUND THEN RETURN QUERY SELECT false,'ATTEMPT_NOT_FOUND'::text,NULL::timestamptz,NULL::uuid; RETURN; END IF;
 IF item.generation<>item.current_generation OR item.request_artifact_id<>item.input_artifact_id THEN
  RETURN QUERY SELECT false,'STALE_EXECUTION'::text,item.call_deadline,item.request_artifact_id; RETURN;
 END IF;
 IF item.paused OR item.extraction_status IN ('completed','review') OR NOT EXISTS(SELECT 1 FROM information.operations o WHERE o.processing_id=item.processing_id AND NOT o.paused) THEN
  RETURN QUERY SELECT false,'PROCESSING_NOT_CALLABLE'::text,item.call_deadline,item.request_artifact_id; RETURN;
 END IF;
 IF item.call_deadline<=clock_timestamp() THEN
  RETURN QUERY SELECT false,'MODEL_BUDGET_EXHAUSTED'::text,item.call_deadline,item.request_artifact_id; RETURN;
 END IF;
 IF EXISTS(SELECT 1 FROM platform.model_service_state s WHERE s.protocol=item.provider_protocol AND s.blocked_until>clock_timestamp()) THEN
  RETURN QUERY SELECT false,s.reason_code,item.call_deadline,item.request_artifact_id FROM platform.model_service_state s WHERE s.protocol=item.provider_protocol; RETURN;
 END IF;
 SELECT * INTO source_record FROM platform.lock_source(item.source_id);
 IF source_record.state<>'ACTIVE' THEN RETURN QUERY SELECT false,'SOURCE_DISABLED'::text,item.call_deadline,item.request_artifact_id; RETURN; END IF;
 SELECT o.actor INTO actor_name FROM information.operations o WHERE o.processing_id=item.processing_id ORDER BY o.created_at,o.id LIMIT 1;
 IF actor_name IS NULL OR NOT platform.authorize_actor(actor_name,'submit',source_record.catalog_key) THEN
  RETURN QUERY SELECT false,'FORBIDDEN'::text,item.call_deadline,item.request_artifact_id; RETURN;
 END IF;
 IF item.status<>'prepared' THEN
  RETURN QUERY SELECT false,'MODEL_CALL_ALREADY_CLAIMED'::text,item.call_deadline,item.request_artifact_id; RETURN;
 END IF;
 UPDATE platform.model_attempts SET status='calling',started_at=clock_timestamp() WHERE id=p_attempt;
 RETURN QUERY SELECT true,NULL::text,item.call_deadline,item.request_artifact_id;
END $$;
REVOKE ALL ON FUNCTION platform.claim_model_call(uuid) FROM PUBLIC;
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
