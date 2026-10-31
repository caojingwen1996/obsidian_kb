-- schema5：仅由 ingestion-migration 的显式重建事务或空库初始化执行。
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS m1;
CREATE SCHEMA IF NOT EXISTS platform;
CREATE SCHEMA IF NOT EXISTS information;
CREATE SCHEMA IF NOT EXISTS infomation;
CREATE TABLE IF NOT EXISTS m1.sources(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),catalog_key text NOT NULL UNIQUE,name text NOT NULL,url text NOT NULL,
 metadata jsonb NOT NULL,state text NOT NULL CHECK(state IN ('ACTIVE','DISABLED'))
);
ALTER TABLE m1.sources ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp());
-- version 是保留档案中的历史字段，新接口只用 updated_at 校验，不再读取版本历史。
CREATE TABLE platform.schema_versions(version integer PRIMARY KEY,installed_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS platform.actors(
 subject text PRIMARY KEY, permissions text[] NOT NULL, source_keys text[] NOT NULL
);
CREATE TABLE IF NOT EXISTS platform.artifact_objects(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sha256 text NOT NULL UNIQUE CHECK(sha256 ~ '^[a-f0-9]{64}$'),
 size integer NOT NULL CHECK(size>=0), kind text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS platform.action_receipts(
 actor text NOT NULL REFERENCES platform.actors(subject), kind text NOT NULL, key text NOT NULL,
 digest text NOT NULL, result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(actor,kind,key)
);
CREATE TABLE IF NOT EXISTS platform.execution_intents(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL, owner_id uuid NOT NULL,
 generation bigint NOT NULL, input jsonb NOT NULL DEFAULT '{}', workflow_id text NOT NULL UNIQUE, state text NOT NULL DEFAULT 'pending',
 lease_token uuid, lease_until timestamptz, next_attempt_at timestamptz NOT NULL DEFAULT now(), attempts integer NOT NULL DEFAULT 0,
 UNIQUE(kind,owner_id,generation)
);
CREATE TABLE IF NOT EXISTS platform.model_service_state(
 protocol text PRIMARY KEY, reason_code text, blocked_until timestamptz, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS platform.runtime_alerts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), issue_key text NOT NULL, code text NOT NULL, owner_id uuid,
 opened_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz,
 delivery_status text NOT NULL DEFAULT 'pending', delivery_attempts integer NOT NULL DEFAULT 0,
 next_delivery_at timestamptz NOT NULL DEFAULT now(), delivered_at timestamptz
);
CREATE TABLE IF NOT EXISTS platform.audit_log(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor text NOT NULL, action text NOT NULL, owner_id uuid, detail jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS platform.auth_states(
 state_hash text PRIMARY KEY, verifier text NOT NULL, nonce text NOT NULL, expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS platform.auth_sessions(
 token_hash text PRIMARY KEY, subject text NOT NULL, expires_at timestamptz NOT NULL
);
CREATE TABLE infomation.ingestion_schedules(
 source_id uuid PRIMARY KEY REFERENCES m1.sources(id),enabled boolean NOT NULL DEFAULT false,
 interval_seconds integer NOT NULL DEFAULT 3600 CHECK(interval_seconds BETWEEN 60 AND 86400),
 next_run_at timestamptz NOT NULL DEFAULT now()+interval '1 hour',updated_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp())
);
CREATE TABLE infomation.ingestion_tasks(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),source_id uuid NOT NULL REFERENCES m1.sources(id),
 trigger_type text NOT NULL CHECK(trigger_type IN ('automatic','manual')),
 schedule_source_id uuid REFERENCES infomation.ingestion_schedules(source_id),scheduled_at timestamptz NOT NULL DEFAULT now(),
 actor text NOT NULL REFERENCES platform.actors(subject),
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','completed','partial','review','recoverable','blocked','failed')),
 stage text NOT NULL DEFAULT 'discover' CHECK(stage IN ('discover','read','normalize','compare','save','provide')),
 paused boolean NOT NULL DEFAULT false,reason_code text,result_summary jsonb NOT NULL DEFAULT '{}' CHECK(pg_column_size(result_summary)<=65536),
 control_revision bigint NOT NULL DEFAULT 1 CHECK(control_revision>0),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp()),
 CHECK((trigger_type='automatic' AND schedule_source_id=source_id AND schedule_source_id IS NOT NULL) OR (trigger_type='manual' AND schedule_source_id IS NULL)),
 CHECK(NOT paused OR status NOT IN ('completed','failed')),UNIQUE(id,source_id)
);
CREATE UNIQUE INDEX ingestion_automatic_once ON infomation.ingestion_tasks(source_id,scheduled_at) WHERE trigger_type='automatic';
CREATE INDEX ingestion_tasks_time ON infomation.ingestion_tasks(scheduled_at DESC,id);
CREATE TABLE infomation.ingestion_material(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),source_id uuid NOT NULL REFERENCES m1.sources(id),identity text NOT NULL,
 external_id text,canonical_url text,title text,content jsonb NOT NULL,metadata jsonb NOT NULL DEFAULT '{}',
 version integer NOT NULL DEFAULT 1 CHECK(version>0),content_digest text NOT NULL,normalizer_rule text NOT NULL,
 published_at_text text,collected_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT date_trunc('milliseconds',clock_timestamp()),
 availability_state text,availability_error text,extraction_result jsonb,
 UNIQUE(source_id,identity),UNIQUE(id,source_id)
);
CREATE TABLE infomation.ingestion_task_material(
 task_id uuid NOT NULL REFERENCES infomation.ingestion_tasks(id),material_id uuid NOT NULL REFERENCES infomation.ingestion_material(id),PRIMARY KEY(task_id,material_id)
);
CREATE FUNCTION infomation.require_same_source() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM infomation.ingestion_tasks t JOIN infomation.ingestion_material m ON m.source_id=t.source_id WHERE t.id=NEW.task_id AND m.id=NEW.material_id) THEN RAISE EXCEPTION 'TASK_MATERIAL_SOURCE_MISMATCH';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER task_material_source BEFORE INSERT OR UPDATE ON infomation.ingestion_task_material FOR EACH ROW EXECUTE FUNCTION infomation.require_same_source();
CREATE TABLE infomation.ingestion_material_segments(
 material_id uuid NOT NULL REFERENCES infomation.ingestion_material(id),id uuid NOT NULL,ordinal integer NOT NULL CHECK(ordinal>=0),
 text text NOT NULL,locator jsonb NOT NULL,PRIMARY KEY(material_id,id),UNIQUE(material_id,ordinal)
);
CREATE TABLE information.event_candidates(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),material_id uuid NOT NULL REFERENCES infomation.ingestion_material(id),
 material_version integer NOT NULL,material_digest text NOT NULL,actor text NOT NULL REFERENCES platform.actors(subject),
 candidate_key uuid NOT NULL DEFAULT gen_random_uuid(),ordinal integer NOT NULL,payload jsonb NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','review','recoverable','completed','dismissed')),
 proposal_generation bigint NOT NULL DEFAULT 1,execution_generation bigint NOT NULL DEFAULT 1,resume_step integer DEFAULT 2,
 reason_code text,commit_key uuid,commit_artifact_id uuid REFERENCES platform.artifact_objects(id),commit_digest text,saved_result_refs jsonb,
 event_options jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(material_id,material_version,candidate_key),UNIQUE(material_id,material_version,ordinal)
);
CREATE TABLE platform.model_budget_windows(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_kind text NOT NULL,owner_id uuid NOT NULL,task_id text NOT NULL,
 subject_ref jsonb NOT NULL DEFAULT '{}',generation bigint NOT NULL,used integer NOT NULL DEFAULT 0 CHECK(used BETWEEN 0 AND 3),
 deadline timestamptz NOT NULL DEFAULT now()+interval '10 minutes',actor text NOT NULL,reason text NOT NULL,
 UNIQUE(owner_kind,owner_id,task_id,generation)
);
CREATE TABLE platform.model_attempts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_kind text NOT NULL,owner_id uuid NOT NULL,task_id text NOT NULL,
 window_id uuid NOT NULL REFERENCES platform.model_budget_windows(id),generation bigint NOT NULL,attempt_no integer NOT NULL,
 status text NOT NULL DEFAULT 'prepared',request_artifact_id uuid NOT NULL REFERENCES platform.artifact_objects(id),
 response_artifact_id uuid REFERENCES platform.artifact_objects(id),finish_reason text,error_code text,call_key text,input_digest text,
 created_at timestamptz NOT NULL DEFAULT now(),started_at timestamptz,completed_at timestamptz,
 UNIQUE(owner_kind,owner_id,task_id,attempt_no),UNIQUE(owner_kind,owner_id,task_id,generation,call_key)
);
CREATE TABLE platform.automatic_recoveries(owner_kind text NOT NULL,owner_id uuid NOT NULL,generation bigint NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(owner_kind,owner_id,generation));
CREATE TABLE information.fact (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL CHECK(length(trim(title))>0),
 description text NOT NULL CHECK(length(trim(description))>0), subject text, action text,
 event_status text NOT NULL CHECK(event_status IN ('expected','announced','in_progress','effective','completed','cancelled','unknown')),
 event_time text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE information.event (LIKE information.fact INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);
ALTER TABLE information.event ALTER COLUMN subject SET NOT NULL, ALTER COLUMN action SET NOT NULL;
ALTER TABLE information.event ADD CHECK(length(trim(subject))>0 AND length(trim(action))>0);

CREATE TABLE IF NOT EXISTS platform.permission_epochs(id boolean PRIMARY KEY DEFAULT true CHECK(id),epoch bigint NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS information.candidate_step_results(

 candidate_id uuid NOT NULL REFERENCES information.event_candidates(id),step_no integer NOT NULL CHECK(step_no BETWEEN 2 AND 5),generation bigint NOT NULL,
 input_digest text NOT NULL,context jsonb NOT NULL,state text NOT NULL CHECK(state IN ('pending','succeeded','skipped','review','recoverable','superseded')),
 proposal_id uuid, result jsonb,reason_code text,reason_details jsonb,PRIMARY KEY(candidate_id,step_no,generation));
CREATE TABLE IF NOT EXISTS platform.task_proposals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),material_id uuid NOT NULL REFERENCES infomation.ingestion_material(id),candidate_id uuid REFERENCES information.event_candidates(id),task_id text NOT NULL,generation bigint NOT NULL,input_digest text NOT NULL,manifest jsonb NOT NULL,output_artifact_id uuid NOT NULL REFERENCES platform.artifact_objects(id),validation jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS information.definition_snapshots(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),kind text NOT NULL,definition_id uuid NOT NULL,definition_version text NOT NULL,payload jsonb NOT NULL,digest text NOT NULL,UNIQUE(kind,definition_id,definition_version));
CREATE TABLE IF NOT EXISTS information.definition_sets(ref text PRIMARY KEY,owner text NOT NULL,version text NOT NULL,coverage_status text NOT NULL CHECK(coverage_status='complete'),payload jsonb NOT NULL,digest text NOT NULL);
CREATE TABLE IF NOT EXISTS information.definition_candidates(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),candidate_id uuid NOT NULL REFERENCES information.event_candidates(id),generation bigint NOT NULL,payload jsonb NOT NULL,status text NOT NULL DEFAULT 'pending_governance');
CREATE TABLE IF NOT EXISTS information.event_identity_catalog(scope_key text PRIMARY KEY,catalog_epoch bigint NOT NULL CHECK(catalog_epoch>=0));
CREATE TABLE IF NOT EXISTS information.event_identity_snapshots(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),candidate_id uuid NOT NULL REFERENCES information.event_candidates(id),generation bigint NOT NULL,scope_key text NOT NULL REFERENCES information.event_identity_catalog(scope_key),catalog_epoch bigint NOT NULL,permission_epoch bigint NOT NULL,manifest jsonb NOT NULL,manifest_digest text NOT NULL,retrieval_truncated boolean NOT NULL,coverage_status text NOT NULL,UNIQUE(candidate_id,generation,id));
CREATE TABLE IF NOT EXISTS platform.review_decisions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),candidate_id uuid NOT NULL REFERENCES information.event_candidates(id),scope text NOT NULL CHECK(scope IN ('identity','relations','commit','disposition')),proposal_digest text NOT NULL,generation bigint NOT NULL,actor text NOT NULL REFERENCES platform.actors(subject),decision text NOT NULL,reason text NOT NULL CHECK(length(trim(reason))>0),policy_version text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS platform.commit_receipts(commit_key uuid PRIMARY KEY,candidate_id uuid NOT NULL REFERENCES information.event_candidates(id),proposal_generation bigint NOT NULL,result_kind text NOT NULL,effects jsonb NOT NULL,review_decision_id uuid REFERENCES platform.review_decisions(id),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(candidate_id,proposal_generation));
CREATE TABLE platform.messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),message_type text NOT NULL,owner_id uuid,material_id uuid REFERENCES infomation.ingestion_material(id),material_version integer,material_digest text,event_id uuid REFERENCES information.event(id),payload jsonb,payload_digest text,state text NOT NULL DEFAULT 'pending',attempts integer NOT NULL DEFAULT 0,next_attempt_at timestamptz NOT NULL DEFAULT now(),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS platform.event_consumers(id text PRIMARY KEY CHECK(id ~ '^[a-z][a-z0-9-]{0,40}$'),enabled boolean NOT NULL DEFAULT true);
CREATE TABLE IF NOT EXISTS platform.message_deliveries(message_id uuid REFERENCES platform.messages(id),consumer_id text REFERENCES platform.event_consumers(id),status text NOT NULL DEFAULT 'pending',attempts integer NOT NULL DEFAULT 0,generation bigint NOT NULL DEFAULT 1,window_start_attempts integer NOT NULL DEFAULT 0,lease_token uuid,lease_until timestamptz,next_attempt_at timestamptz NOT NULL DEFAULT now(),receipt jsonb,error_code text,files_state text NOT NULL DEFAULT 'pending',files_error text,PRIMARY KEY(message_id,consumer_id));

CREATE TABLE information.candidate_fact (
 candidate_id uuid PRIMARY KEY REFERENCES information.event_candidates(id), fact_id uuid NOT NULL REFERENCES information.fact(id)
);
CREATE TABLE information.fact_information (
 fact_id uuid REFERENCES information.fact(id), information_id uuid REFERENCES infomation.ingestion_material(id),
 relation_role text NOT NULL CHECK(relation_role IN ('supporting','conflicting')), created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(fact_id,information_id)
);
CREATE INDEX ON information.fact_information(information_id,fact_id);

CREATE TABLE information.fact_evidence (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), fact_id uuid NOT NULL, information_id uuid NOT NULL,
 material_version integer NOT NULL, material_digest text NOT NULL, material_id uuid NOT NULL, segment_id uuid NOT NULL, start_cp integer NOT NULL, end_cp integer NOT NULL,
 quote text NOT NULL CHECK(length(quote)>0), evidence_role text NOT NULL CHECK(evidence_role IN ('supporting','conflicting')),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(fact_id,information_id) REFERENCES information.fact_information(fact_id,information_id),
 FOREIGN KEY(material_id) REFERENCES infomation.ingestion_material(id),
 
 UNIQUE(fact_id,material_id,material_version,segment_id,start_cp,end_cp,evidence_role), CHECK(start_cp>=0 AND end_cp>start_cp)
);
CREATE TABLE information.event_fact (
 event_id uuid REFERENCES information.event(id), fact_id uuid REFERENCES information.fact(id),
 relation_role text NOT NULL CHECK(relation_role IN ('initial','progress','supplement','correction','corroboration')),
 relation_note text NOT NULL CHECK(length(trim(relation_note))>0), created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(event_id,fact_id), UNIQUE(fact_id)
);
CREATE TABLE information.event_target (
 event_id uuid REFERENCES information.event(id), target_id uuid NOT NULL, relation_note text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(event_id,target_id)
);
CREATE TABLE information.event_target_definition (
 event_id uuid, target_id uuid, definition_snapshot_id uuid NOT NULL REFERENCES information.definition_snapshots(id),
 PRIMARY KEY(event_id,target_id), FOREIGN KEY(event_id,target_id) REFERENCES information.event_target(event_id,target_id)
);
CREATE TABLE information.event_target_variable (
 event_id uuid, target_id uuid, variable_id uuid NOT NULL, relation_type text NOT NULL CHECK(relation_type IN ('direct_change','direct_involvement','observed_change')),
 change_direction text NOT NULL CHECK(change_direction IN ('increase','decrease','unchanged','unknown')),
 impact_status text NOT NULL CHECK(impact_status IN ('expected','announced','effective','unknown')),description text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(event_id,target_id,variable_id), FOREIGN KEY(event_id,target_id) REFERENCES information.event_target(event_id,target_id)
);
CREATE TABLE information.event_variable_definition (
 event_id uuid,target_id uuid,variable_id uuid,definition_snapshot_id uuid NOT NULL REFERENCES information.definition_snapshots(id),
 PRIMARY KEY(event_id,target_id,variable_id), FOREIGN KEY(event_id,target_id,variable_id) REFERENCES information.event_target_variable(event_id,target_id,variable_id)
);
CREATE TABLE information.event_target_fact (
 event_id uuid,target_id uuid,fact_id uuid,PRIMARY KEY(event_id,target_id,fact_id),
 FOREIGN KEY(event_id,target_id) REFERENCES information.event_target(event_id,target_id),FOREIGN KEY(event_id,fact_id) REFERENCES information.event_fact(event_id,fact_id)
);
CREATE TABLE information.event_variable_fact (
 event_id uuid,target_id uuid,variable_id uuid,fact_id uuid,PRIMARY KEY(event_id,target_id,variable_id,fact_id),
 FOREIGN KEY(event_id,target_id,variable_id) REFERENCES information.event_target_variable(event_id,target_id,variable_id),FOREIGN KEY(event_id,fact_id) REFERENCES information.event_fact(event_id,fact_id)
);
CREATE TABLE information.event_rating (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),assessment_scope jsonb NOT NULL,research_horizon jsonb NOT NULL,method_version text NOT NULL,
 m numeric(5,2) CHECK(m BETWEEN 0 AND 100), dimension_scores jsonb NOT NULL, financial_usages jsonb NOT NULL,
 reasoning_summary text NOT NULL, limitations jsonb NOT NULL,rating_status text NOT NULL CHECK(rating_status IN ('draft','confirmed','needs_reassessment')),
 evaluated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE information.event_rating_relation (
 rating_id uuid PRIMARY KEY REFERENCES information.event_rating(id),event_id uuid NOT NULL REFERENCES information.event(id),UNIQUE(event_id,rating_id)
);
CREATE TABLE information.event_rating_fact (
 event_id uuid,rating_id uuid,fact_id uuid,PRIMARY KEY(event_id,rating_id,fact_id),
 FOREIGN KEY(event_id,rating_id) REFERENCES information.event_rating_relation(event_id,rating_id),FOREIGN KEY(event_id,fact_id) REFERENCES information.event_fact(event_id,fact_id)
);

CREATE TABLE information.event_file_jobs(relative_path text PRIMARY KEY,material_id uuid NOT NULL REFERENCES infomation.ingestion_material(id),payload jsonb NOT NULL,payload_digest text NOT NULL,state text NOT NULL DEFAULT 'pending',generation bigint NOT NULL DEFAULT 1,attempts integer NOT NULL DEFAULT 0,window_start integer NOT NULL DEFAULT 0,lease_token uuid,lease_until timestamptz,next_attempt_at timestamptz NOT NULL DEFAULT now(),error_code text);
CREATE TABLE platform.event_message_dependencies(message_id uuid PRIMARY KEY REFERENCES platform.messages(id),predecessor_id uuid UNIQUE REFERENCES platform.messages(id),CHECK(message_id<>predecessor_id));
INSERT INTO platform.permission_epochs(id) VALUES(true);
INSERT INTO information.event_identity_catalog VALUES('l0-event-catalog',0);
INSERT INTO platform.event_consumers(id) VALUES('event-audit');
INSERT INTO infomation.ingestion_schedules(source_id) SELECT id FROM m1.sources;
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
RETURNS TABLE(id uuid,updated_at timestamptz,state text) LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,m1 AS $$
 SELECT s.id,s.updated_at,s.state FROM m1.sources s WHERE s.catalog_key=p_key FOR SHARE OF s
$$;
REVOKE ALL ON FUNCTION platform.source_for_submit(text) FROM PUBLIC;
CREATE OR REPLACE FUNCTION platform.permission_changed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,platform AS $$ BEGIN UPDATE platform.permission_epochs SET epoch=epoch+1 WHERE id; RETURN NULL; END $$;
CREATE OR REPLACE FUNCTION platform.lock_permission_epoch() RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,platform AS $$ DECLARE value bigint; BEGIN SELECT epoch INTO value FROM platform.permission_epochs WHERE id FOR SHARE; IF NOT FOUND THEN RAISE EXCEPTION 'PERMISSION_EPOCH_REQUIRED';END IF;RETURN value;END $$;
CREATE TRIGGER actors_permission_epoch BEFORE INSERT OR UPDATE OR DELETE ON platform.actors FOR EACH STATEMENT EXECUTE FUNCTION platform.permission_changed();
REVOKE ALL ON FUNCTION platform.lock_permission_epoch() FROM PUBLIC;
INSERT INTO platform.schema_versions(version) VALUES(5);

CREATE FUNCTION information.check_current_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE m infomation.ingestion_material%ROWTYPE; segment_text text;
BEGIN
 SELECT * INTO m FROM infomation.ingestion_material WHERE id=NEW.material_id FOR SHARE;
 IF NOT FOUND OR m.id<>NEW.information_id OR m.version<>NEW.material_version OR m.content_digest<>NEW.material_digest THEN RAISE EXCEPTION 'MATERIAL_BASIS_CHANGED';END IF;
 SELECT text INTO segment_text FROM infomation.ingestion_material_segments WHERE material_id=m.id AND id=NEW.segment_id;
 IF segment_text IS NULL OR NEW.end_cp>char_length(segment_text) OR substring(segment_text FROM NEW.start_cp+1 FOR NEW.end_cp-NEW.start_cp)<>NEW.quote THEN RAISE EXCEPTION 'EVIDENCE_MISMATCH';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER fact_evidence_current BEFORE INSERT OR UPDATE ON information.fact_evidence FOR EACH ROW EXECUTE FUNCTION information.check_current_evidence();

CREATE TABLE information.identity_decisions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),candidate_id uuid NOT NULL,generation bigint NOT NULL,decision text NOT NULL CHECK(decision IN ('NEW','REUSE','UNRESOLVED')),event_id uuid REFERENCES information.event(id),expected_digest text,retrieval_snapshot_id uuid NOT NULL,review_id uuid,consumed_event_id uuid REFERENCES information.event(id),UNIQUE(candidate_id,generation),FOREIGN KEY(candidate_id,generation,retrieval_snapshot_id) REFERENCES information.event_identity_snapshots(candidate_id,generation,id));
CREATE TABLE platform.event_consumer_inbox(message_id uuid REFERENCES platform.messages(id),consumer_id text REFERENCES platform.event_consumers(id),event_id uuid NOT NULL REFERENCES information.event(id),payload_digest text NOT NULL,receipt jsonb NOT NULL,applied boolean NOT NULL DEFAULT false,PRIMARY KEY(message_id,consumer_id));
CREATE TABLE platform.event_consumer_progress(consumer_id text REFERENCES platform.event_consumers(id),event_id uuid REFERENCES information.event(id),last_message_id uuid REFERENCES platform.messages(id),PRIMARY KEY(consumer_id,event_id));

CREATE FUNCTION information.require_fact_support() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM information.event e WHERE NOT EXISTS(SELECT 1 FROM information.event_fact ef WHERE ef.event_id=e.id)) THEN RAISE EXCEPTION 'EVENT_FACT_REQUIRED'; END IF;
 IF EXISTS(SELECT 1 FROM information.fact f WHERE NOT EXISTS(SELECT 1 FROM information.fact_information fi WHERE fi.fact_id=f.id)) THEN RAISE EXCEPTION 'FACT_INFORMATION_REQUIRED'; END IF;
 IF EXISTS(SELECT 1 FROM information.fact_information fi WHERE NOT EXISTS(SELECT 1 FROM information.fact_evidence fe WHERE fe.fact_id=fi.fact_id AND fe.information_id=fi.information_id)) THEN RAISE EXCEPTION 'FACT_EVIDENCE_REQUIRED'; END IF;
 IF EXISTS(SELECT 1 FROM information.event_rating r WHERE NOT EXISTS(SELECT 1 FROM information.event_rating_fact rf WHERE rf.rating_id=r.id)) THEN RAISE EXCEPTION 'RATING_FACT_REQUIRED'; END IF;
 RETURN NULL;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['event','fact','event_fact','fact_information','fact_evidence','event_rating','event_rating_fact','event_rating_relation'] LOOP
 EXECUTE format('CREATE CONSTRAINT TRIGGER require_support AFTER INSERT OR UPDATE OR DELETE ON information.%I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION information.require_fact_support()',t);
 END LOOP;
END $$;

ALTER TABLE platform.model_attempts ADD COLUMN subject_ref jsonb NOT NULL;
CREATE FUNCTION platform.claim_model_call(p_attempt uuid)
RETURNS TABLE(allowed boolean,reason_code text,deadline timestamptz,request_artifact_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,platform,infomation,information,m1 AS $$
DECLARE a record; w record; m record; c record;
BEGIN
 PERFORM platform.lock_permission_epoch();
 SELECT * INTO a FROM platform.model_attempts WHERE id=p_attempt FOR UPDATE;
 IF NOT FOUND THEN RETURN QUERY SELECT false,'ATTEMPT_NOT_FOUND'::text,NULL::timestamptz,NULL::uuid;RETURN;END IF;
 SELECT * INTO w FROM platform.model_budget_windows WHERE id=a.window_id;
 SELECT m0.*,s.catalog_key,s.state INTO m FROM infomation.ingestion_material m0 JOIN m1.sources s ON s.id=m0.source_id WHERE m0.id=(a.subject_ref->>'material_id')::uuid FOR SHARE OF m0,s;
 IF m.id IS NULL OR m.version<>(a.subject_ref->>'version')::integer OR m.content_digest<>a.subject_ref->>'content_digest' THEN RETURN QUERY SELECT false,'MATERIAL_BASIS_CHANGED'::text,w.deadline,a.request_artifact_id;RETURN;END IF;
 IF m.state<>'ACTIVE' OR NOT platform.authorize_actor(w.actor,CASE WHEN a.owner_kind='event' THEN 'event_submit' ELSE 'submit' END,m.catalog_key) THEN RETURN QUERY SELECT false,'FORBIDDEN'::text,w.deadline,a.request_artifact_id;RETURN;END IF;
 IF a.owner_kind='event' THEN
  SELECT * INTO c FROM information.event_candidates WHERE id=a.owner_id FOR SHARE;
  IF c.id IS NULL OR c.material_id<>m.id OR c.material_version<>m.version OR c.material_digest<>m.content_digest OR c.execution_generation<>a.generation OR c.status IN ('review','completed','dismissed') THEN RETURN QUERY SELECT false,'STALE_EXECUTION'::text,w.deadline,a.request_artifact_id;RETURN;END IF;
 ELSIF a.owner_kind<>'material' OR a.owner_id<>m.id THEN RETURN QUERY SELECT false,'UNKNOWN_REFERENCE'::text,w.deadline,a.request_artifact_id;RETURN;END IF;
 IF w.owner_kind<>a.owner_kind OR w.owner_id<>a.owner_id OR w.task_id<>a.task_id THEN RETURN QUERY SELECT false,'UNKNOWN_REFERENCE'::text,w.deadline,a.request_artifact_id;RETURN;END IF;
 IF EXISTS(SELECT 1 FROM platform.model_service_state WHERE protocol=a.provider_protocol AND blocked_until>clock_timestamp()) THEN RETURN QUERY SELECT false,'MODEL_SERVICE_PAUSED'::text,w.deadline,a.request_artifact_id;RETURN;END IF;
 IF w.deadline<=clock_timestamp() THEN RETURN QUERY SELECT false,'MODEL_BUDGET_EXHAUSTED'::text,w.deadline,a.request_artifact_id;RETURN;END IF;
 IF a.status<>'prepared' THEN RETURN QUERY SELECT false,'MODEL_CALL_ALREADY_CLAIMED'::text,w.deadline,a.request_artifact_id;RETURN;END IF;
 UPDATE platform.model_attempts SET status='calling',started_at=clock_timestamp() WHERE id=p_attempt;
 RETURN QUERY SELECT true,NULL::text,w.deadline,a.request_artifact_id;
END $$;
CREATE FUNCTION platform.current_model_material(p_attempt uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,platform,infomation,m1 AS $$
DECLARE body jsonb;
BEGIN
 PERFORM platform.lock_permission_epoch();
 SELECT m.content INTO body FROM platform.model_attempts a JOIN platform.model_budget_windows w ON w.id=a.window_id JOIN infomation.ingestion_material m ON m.id=(a.subject_ref->>'material_id')::uuid JOIN m1.sources s ON s.id=m.source_id
 WHERE a.id=p_attempt AND a.status='calling' AND m.version=(a.subject_ref->>'version')::integer AND m.content_digest=a.subject_ref->>'content_digest' AND s.state='ACTIVE'
 AND platform.authorize_actor(w.actor,CASE WHEN a.owner_kind='event' THEN 'event_submit' ELSE 'submit' END,s.catalog_key) FOR SHARE OF m,s;
 IF body IS NULL THEN RAISE EXCEPTION 'MODEL_CALL_NOT_PERMITTED';END IF;RETURN body;
END $$;
REVOKE ALL ON FUNCTION platform.claim_model_call(uuid),platform.current_model_material(uuid) FROM PUBLIC;
ALTER TABLE platform.message_deliveries ADD COLUMN file_generation bigint NOT NULL DEFAULT 1;
ALTER TABLE platform.message_deliveries ADD COLUMN file_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE platform.message_deliveries ADD COLUMN file_window_start integer NOT NULL DEFAULT 0;
ALTER TABLE platform.model_attempts ADD COLUMN provider_protocol text NOT NULL;
