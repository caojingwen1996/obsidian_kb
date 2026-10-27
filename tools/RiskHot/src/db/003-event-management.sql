ALTER TABLE information.processing_runs DROP CONSTRAINT IF EXISTS processing_runs_processing_scope_check;
ALTER TABLE information.processing_runs ADD CONSTRAINT processing_runs_processing_scope_check CHECK(processing_scope IN ('EXTRACTION_ONLY','FULL_EVENT'));
ALTER TABLE information.processing_runs ADD COLUMN IF NOT EXISTS parent_processing_id uuid REFERENCES information.processing_runs(id);
ALTER TABLE information.processing_runs ADD COLUMN IF NOT EXISTS event_options jsonb;
ALTER TABLE information.processing_runs ADD COLUMN IF NOT EXISTS actor text REFERENCES platform.actors(subject);
ALTER TABLE information.event_candidates DROP CONSTRAINT IF EXISTS event_candidates_status_check;
ALTER TABLE information.event_candidates ADD CONSTRAINT event_candidates_status_check CHECK(status IN ('pending','processing','review','recoverable','completed','dismissed'));
ALTER TABLE information.event_candidates ADD COLUMN IF NOT EXISTS proposal_generation bigint NOT NULL DEFAULT 1;
ALTER TABLE information.event_candidates ADD COLUMN IF NOT EXISTS execution_generation bigint NOT NULL DEFAULT 1;
ALTER TABLE information.event_candidates ADD COLUMN IF NOT EXISTS resume_step integer DEFAULT 2;
ALTER TABLE information.event_candidates ADD COLUMN IF NOT EXISTS reason_code text;
ALTER TABLE information.event_candidates ADD COLUMN IF NOT EXISTS commit_key uuid;
ALTER TABLE information.event_candidates ADD COLUMN IF NOT EXISTS commit_artifact_id uuid REFERENCES platform.artifact_objects(id);
ALTER TABLE information.event_candidates ADD COLUMN IF NOT EXISTS commit_digest text;
ALTER TABLE information.event_candidates ADD COLUMN IF NOT EXISTS saved_result_refs jsonb;
CREATE TABLE IF NOT EXISTS platform.permission_epochs(id boolean PRIMARY KEY DEFAULT true CHECK(id),epoch bigint NOT NULL DEFAULT 0);
INSERT INTO platform.permission_epochs(id) VALUES(true) ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION platform.permission_changed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,platform AS $$ BEGIN UPDATE platform.permission_epochs SET epoch=epoch+1 WHERE id; RETURN NULL; END $$;
DROP TRIGGER IF EXISTS actors_permission_epoch ON platform.actors;
CREATE TRIGGER actors_permission_epoch BEFORE INSERT OR UPDATE OR DELETE ON platform.actors FOR EACH STATEMENT EXECUTE FUNCTION platform.permission_changed();
CREATE TABLE IF NOT EXISTS information.candidate_step_results(
 candidate_id uuid NOT NULL REFERENCES information.event_candidates(id),step_no integer NOT NULL CHECK(step_no BETWEEN 2 AND 5),generation bigint NOT NULL,
 input_digest text NOT NULL,context jsonb NOT NULL,state text NOT NULL CHECK(state IN ('pending','succeeded','skipped','review','recoverable','superseded')),
 proposal_id uuid, result jsonb,reason_code text,reason_details jsonb,PRIMARY KEY(candidate_id,step_no,generation));
CREATE TABLE IF NOT EXISTS platform.task_proposals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),processing_id uuid NOT NULL REFERENCES information.processing_runs(id),candidate_id uuid REFERENCES information.event_candidates(id),task_id text NOT NULL,generation bigint NOT NULL,input_digest text NOT NULL,manifest jsonb NOT NULL,output_artifact_id uuid NOT NULL REFERENCES platform.artifact_objects(id),validation jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS information.events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),title text NOT NULL,description text NOT NULL,subject_name text,action_code text,event_status text NOT NULL,event_time timestamptz,event_time_text text,event_time_precision text NOT NULL,event_time_kind text NOT NULL,event_time_start timestamptz,event_time_end timestamptz,revision_no bigint NOT NULL CHECK(revision_no>0),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS information.event_sources(event_id uuid REFERENCES information.events(id),information_id uuid REFERENCES information.materials(id),role text NOT NULL,PRIMARY KEY(event_id,information_id));
CREATE TABLE IF NOT EXISTS information.event_evidence(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_id uuid NOT NULL,information_id uuid NOT NULL,version_id uuid NOT NULL,segment_id uuid NOT NULL,start_cp integer NOT NULL,end_cp integer NOT NULL,quote text NOT NULL,role text NOT NULL,UNIQUE(event_id,id),UNIQUE(event_id,version_id,segment_id,start_cp,end_cp),FOREIGN KEY(event_id,information_id) REFERENCES information.event_sources(event_id,information_id),FOREIGN KEY(version_id,segment_id) REFERENCES information.material_segments(version_id,id),CHECK(start_cp>=0 AND end_cp>start_cp));
CREATE TABLE IF NOT EXISTS information.definition_snapshots(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),kind text NOT NULL,definition_id uuid NOT NULL,definition_version text NOT NULL,payload jsonb NOT NULL,digest text NOT NULL,UNIQUE(kind,definition_id,definition_version));
CREATE TABLE IF NOT EXISTS information.definition_sets(ref text PRIMARY KEY,owner text NOT NULL,version text NOT NULL,coverage_status text NOT NULL CHECK(coverage_status='complete'),payload jsonb NOT NULL,digest text NOT NULL);
CREATE TABLE IF NOT EXISTS information.definition_candidates(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),candidate_id uuid NOT NULL REFERENCES information.event_candidates(id),generation bigint NOT NULL,payload jsonb NOT NULL,status text NOT NULL DEFAULT 'pending_governance');
CREATE TABLE IF NOT EXISTS information.event_targets(event_id uuid REFERENCES information.events(id),target_id uuid NOT NULL,definition_snapshot_id uuid NOT NULL REFERENCES information.definition_snapshots(id),relation_note text NOT NULL,PRIMARY KEY(event_id,target_id));
CREATE TABLE IF NOT EXISTS information.event_target_variables(event_id uuid NOT NULL,target_id uuid NOT NULL,variable_id uuid NOT NULL,definition_snapshot_id uuid NOT NULL REFERENCES information.definition_snapshots(id),relation_type text NOT NULL,change_direction text NOT NULL,impact_status text NOT NULL,PRIMARY KEY(event_id,target_id,variable_id),FOREIGN KEY(event_id,target_id) REFERENCES information.event_targets(event_id,target_id));
CREATE TABLE IF NOT EXISTS information.event_updates(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_id uuid NOT NULL REFERENCES information.events(id),business_change_key uuid NOT NULL,update_type text NOT NULL,summary text NOT NULL,previous_status text,current_status text,effective_at timestamptz,effective_time jsonb,recorded_at timestamptz NOT NULL DEFAULT now(),UNIQUE(event_id,business_change_key),UNIQUE(event_id,id));
CREATE TABLE IF NOT EXISTS information.event_update_supersedes(event_id uuid NOT NULL,update_id uuid NOT NULL,superseded_update_id uuid NOT NULL,PRIMARY KEY(event_id,update_id,superseded_update_id),FOREIGN KEY(event_id,update_id) REFERENCES information.event_updates(event_id,id),FOREIGN KEY(event_id,superseded_update_id) REFERENCES information.event_updates(event_id,id),CHECK(update_id<>superseded_update_id));
CREATE TABLE IF NOT EXISTS information.event_ratings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_id uuid NOT NULL REFERENCES information.events(id),assessment_key uuid NOT NULL,scope_key text NOT NULL,assessment_scope jsonb NOT NULL,research_horizon jsonb NOT NULL,method_version text NOT NULL,m numeric(5,2),dimension_scores jsonb NOT NULL,financial_usages jsonb NOT NULL,reasoning_summary text NOT NULL,limitations jsonb NOT NULL,rating_status text NOT NULL,basis_revision_no bigint NOT NULL,supersedes_rating_id uuid,UNIQUE(event_id,assessment_key),UNIQUE(event_id,id),FOREIGN KEY(event_id,supersedes_rating_id) REFERENCES information.event_ratings(event_id,id),CHECK(m IS NULL OR m BETWEEN 0 AND 100));
CREATE TABLE IF NOT EXISTS information.event_revisions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_id uuid NOT NULL REFERENCES information.events(id),revision_no bigint NOT NULL,commit_key uuid NOT NULL,snapshot jsonb NOT NULL,snapshot_digest text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(event_id,revision_no),UNIQUE(event_id,commit_key));
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='events_current_revision_fk') THEN
 ALTER TABLE information.events ADD CONSTRAINT events_current_revision_fk FOREIGN KEY(id,revision_no) REFERENCES information.event_revisions(event_id,revision_no) DEFERRABLE INITIALLY DEFERRED;
 ALTER TABLE information.event_ratings ADD CONSTRAINT ratings_basis_revision_fk FOREIGN KEY(event_id,basis_revision_no) REFERENCES information.event_revisions(event_id,revision_no) DEFERRABLE INITIALLY DEFERRED;
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS information.event_identity_catalog(scope_key text PRIMARY KEY,catalog_epoch bigint NOT NULL CHECK(catalog_epoch>=0));
INSERT INTO information.event_identity_catalog VALUES('l0-event-catalog',0) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS information.event_identity_snapshots(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),candidate_id uuid NOT NULL REFERENCES information.event_candidates(id),generation bigint NOT NULL,scope_key text NOT NULL REFERENCES information.event_identity_catalog(scope_key),catalog_epoch bigint NOT NULL,permission_epoch bigint NOT NULL,manifest jsonb NOT NULL,manifest_digest text NOT NULL,retrieval_truncated boolean NOT NULL,coverage_status text NOT NULL,UNIQUE(candidate_id,generation,id));
CREATE TABLE IF NOT EXISTS information.identity_decisions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),candidate_id uuid NOT NULL,generation bigint NOT NULL,decision text NOT NULL CHECK(decision IN ('NEW','REUSE','UNRESOLVED')),event_id uuid REFERENCES information.events(id),expected_revision bigint,retrieval_snapshot_id uuid NOT NULL,review_id uuid,consumed_event_id uuid REFERENCES information.events(id),UNIQUE(candidate_id,generation),FOREIGN KEY(candidate_id,generation,retrieval_snapshot_id) REFERENCES information.event_identity_snapshots(candidate_id,generation,id));
CREATE TABLE IF NOT EXISTS platform.review_decisions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),candidate_id uuid NOT NULL REFERENCES information.event_candidates(id),scope text NOT NULL CHECK(scope IN ('identity','commit','disposition')),proposal_digest text NOT NULL,generation bigint NOT NULL,actor text NOT NULL REFERENCES platform.actors(subject),decision text NOT NULL,reason text NOT NULL CHECK(length(trim(reason))>0),policy_version text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS disposition_once ON platform.review_decisions(candidate_id,generation) WHERE scope='disposition';
ALTER TABLE platform.review_decisions DROP CONSTRAINT IF EXISTS review_decisions_scope_check;
ALTER TABLE platform.review_decisions ADD CONSTRAINT review_decisions_scope_check CHECK(scope IN ('identity','relations','commit','disposition'));
CREATE TABLE IF NOT EXISTS platform.commit_receipts(commit_key uuid PRIMARY KEY,candidate_id uuid NOT NULL REFERENCES information.event_candidates(id),proposal_generation bigint NOT NULL,result_kind text NOT NULL,effects jsonb NOT NULL,review_decision_id uuid REFERENCES platform.review_decisions(id),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(candidate_id,proposal_generation));
ALTER TABLE platform.model_budget_windows ADD COLUMN IF NOT EXISTS owner_kind text NOT NULL DEFAULT 'extraction';
ALTER TABLE platform.model_budget_windows ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE platform.model_budget_windows ADD COLUMN IF NOT EXISTS task_id text NOT NULL DEFAULT 'AI-01';
ALTER TABLE platform.model_attempts ADD COLUMN IF NOT EXISTS owner_kind text NOT NULL DEFAULT 'extraction';
ALTER TABLE platform.model_attempts ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE platform.model_attempts ADD COLUMN IF NOT EXISTS task_id text NOT NULL DEFAULT 'AI-01';
ALTER TABLE platform.model_attempts ADD COLUMN IF NOT EXISTS input_digest text;
DROP INDEX IF EXISTS platform.event_budget_scope;
CREATE UNIQUE INDEX event_budget_scope ON platform.model_budget_windows(owner_kind,owner_id,task_id,generation) WHERE owner_kind='event';
ALTER TABLE platform.messages ALTER COLUMN version_id DROP NOT NULL;
ALTER TABLE platform.messages ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'information.version.ready.v1';
ALTER TABLE platform.messages ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES information.events(id);
ALTER TABLE platform.messages ADD COLUMN IF NOT EXISTS revision_no bigint;
ALTER TABLE platform.messages ADD COLUMN IF NOT EXISTS payload jsonb;
ALTER TABLE platform.messages ADD COLUMN IF NOT EXISTS payload_digest text;
CREATE UNIQUE INDEX IF NOT EXISTS event_revision_message ON platform.messages(event_id,revision_no) WHERE event_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS platform.event_consumers(id text PRIMARY KEY CHECK(id ~ '^[a-z][a-z0-9-]{0,40}$'),enabled boolean NOT NULL DEFAULT true);
INSERT INTO platform.event_consumers(id) VALUES('event-audit') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS platform.message_deliveries(message_id uuid REFERENCES platform.messages(id),consumer_id text REFERENCES platform.event_consumers(id),status text NOT NULL DEFAULT 'pending',attempts integer NOT NULL DEFAULT 0,generation bigint NOT NULL DEFAULT 1,window_start_attempts integer NOT NULL DEFAULT 0,lease_token uuid,lease_until timestamptz,next_attempt_at timestamptz NOT NULL DEFAULT now(),receipt jsonb,error_code text,files_state text NOT NULL DEFAULT 'pending',files_error text,PRIMARY KEY(message_id,consumer_id));
CREATE TABLE IF NOT EXISTS platform.event_consumer_inbox(message_id uuid REFERENCES platform.messages(id),consumer_id text REFERENCES platform.event_consumers(id),event_id uuid NOT NULL REFERENCES information.events(id),revision_no bigint NOT NULL,payload_digest text NOT NULL,receipt jsonb NOT NULL,applied boolean NOT NULL DEFAULT false,PRIMARY KEY(message_id,consumer_id));
CREATE TABLE IF NOT EXISTS platform.event_consumer_progress(consumer_id text REFERENCES platform.event_consumers(id),event_id uuid REFERENCES information.events(id),revision_no bigint NOT NULL DEFAULT 0,PRIMARY KEY(consumer_id,event_id));
CREATE OR REPLACE FUNCTION information.reject_revision_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'IMMUTABLE_EVENT_REVISION'; END $$;
DROP TRIGGER IF EXISTS immutable_event_revision ON information.event_revisions;
CREATE TRIGGER immutable_event_revision BEFORE UPDATE OR DELETE ON information.event_revisions FOR EACH ROW EXECUTE FUNCTION information.reject_revision_change();
INSERT INTO platform.schema_versions(version) VALUES(3) ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION platform.claim_event_model_call(p_attempt uuid)
RETURNS TABLE(allowed boolean,reason_code text,deadline timestamptz,request_artifact_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,platform,information,m1 AS $$
DECLARE a record;p record;c information.event_candidates%ROWTYPE;src record;w record;
BEGIN
 PERFORM 1 FROM platform.permission_epochs WHERE id FOR SHARE;
 SELECT p0.* INTO p FROM information.processing_runs p0 JOIN platform.model_attempts a0 ON a0.processing_id=p0.id WHERE a0.id=p_attempt FOR SHARE OF p0;
 IF NOT FOUND THEN RETURN QUERY SELECT false,'NOT_FOUND'::text,NULL::timestamptz,NULL::uuid;RETURN;END IF;
 SELECT * INTO a FROM platform.model_attempts WHERE id=p_attempt FOR UPDATE;
 SELECT * INTO w FROM platform.model_budget_windows WHERE id=a.window_id;
 IF a.owner_id<>p.id THEN SELECT * INTO c FROM information.event_candidates WHERE id=a.owner_id FOR SHARE; END IF;
 SELECT s.* INTO src FROM m1.sources s JOIN information.materials m ON m.source_id=s.id JOIN information.material_versions v ON v.material_id=m.id WHERE v.id=p.version_id FOR SHARE OF s;
 IF p.processing_scope<>'FULL_EVENT' OR p.paused OR a.owner_kind<>'event' OR w.deadline<=clock_timestamp() OR
 (a.owner_id=p.id AND (a.generation<>p.generation OR p.extraction_status='completed')) OR
 (a.owner_id<>p.id AND (c.id IS NULL OR c.processing_id<>p.id OR c.execution_generation<>a.generation OR c.status IN ('completed','dismissed') OR EXISTS(SELECT 1 FROM platform.review_decisions r WHERE r.candidate_id=c.id AND r.generation=c.proposal_generation AND r.scope='disposition'))) THEN
 RETURN QUERY SELECT false,'STALE_EXECUTION'::text,w.deadline,a.request_artifact_id;RETURN; END IF;
 IF src.state<>'ACTIVE' OR NOT platform.authorize_actor(p.actor,'event_submit',src.catalog_key) THEN RETURN QUERY SELECT false,'FORBIDDEN'::text,w.deadline,a.request_artifact_id;RETURN;END IF;
 IF a.status<>'prepared' THEN RETURN QUERY SELECT false,'MODEL_CALL_ALREADY_CLAIMED'::text,w.deadline,a.request_artifact_id;RETURN;END IF;
 UPDATE platform.model_attempts SET status='calling',started_at=clock_timestamp() WHERE id=a.id;
 RETURN QUERY SELECT true,NULL::text,w.deadline,a.request_artifact_id;
END $$;
REVOKE ALL ON FUNCTION platform.claim_event_model_call(uuid) FROM PUBLIC;
ALTER TABLE platform.message_deliveries ADD COLUMN IF NOT EXISTS file_generation bigint NOT NULL DEFAULT 1;
ALTER TABLE platform.message_deliveries ADD COLUMN IF NOT EXISTS file_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE platform.message_deliveries ADD COLUMN IF NOT EXISTS file_window_start integer NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS information.event_file_jobs(relative_path text PRIMARY KEY,processing_id uuid NOT NULL REFERENCES information.processing_runs(id),payload jsonb NOT NULL,payload_digest text NOT NULL,state text NOT NULL DEFAULT 'pending',generation bigint NOT NULL DEFAULT 1,attempts integer NOT NULL DEFAULT 0,window_start integer NOT NULL DEFAULT 0,lease_token uuid,lease_until timestamptz,next_attempt_at timestamptz NOT NULL DEFAULT now(),error_code text);
CREATE TABLE IF NOT EXISTS information.event_target_evidence(event_id uuid NOT NULL,target_id uuid NOT NULL,evidence_id uuid NOT NULL,PRIMARY KEY(event_id,target_id,evidence_id),FOREIGN KEY(event_id,target_id) REFERENCES information.event_targets(event_id,target_id),FOREIGN KEY(event_id,evidence_id) REFERENCES information.event_evidence(event_id,id));
CREATE TABLE IF NOT EXISTS information.event_variable_evidence(event_id uuid NOT NULL,target_id uuid NOT NULL,variable_id uuid NOT NULL,evidence_id uuid NOT NULL,PRIMARY KEY(event_id,target_id,variable_id,evidence_id),FOREIGN KEY(event_id,target_id,variable_id) REFERENCES information.event_target_variables(event_id,target_id,variable_id),FOREIGN KEY(event_id,evidence_id) REFERENCES information.event_evidence(event_id,id));
CREATE TABLE IF NOT EXISTS information.event_update_evidence(event_id uuid NOT NULL,update_id uuid NOT NULL,evidence_id uuid NOT NULL,PRIMARY KEY(event_id,update_id,evidence_id),FOREIGN KEY(event_id,update_id) REFERENCES information.event_updates(event_id,id),FOREIGN KEY(event_id,evidence_id) REFERENCES information.event_evidence(event_id,id));
CREATE TABLE IF NOT EXISTS information.event_rating_evidence(event_id uuid NOT NULL,rating_id uuid NOT NULL,evidence_id uuid NOT NULL,PRIMARY KEY(event_id,rating_id,evidence_id),FOREIGN KEY(event_id,rating_id) REFERENCES information.event_ratings(event_id,id),FOREIGN KEY(event_id,evidence_id) REFERENCES information.event_evidence(event_id,id));
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='event_message_binding') THEN
 ALTER TABLE platform.messages ADD CONSTRAINT event_message_binding CHECK((message_type='information.version.ready.v1' AND version_id IS NOT NULL AND event_id IS NULL) OR (message_type='event.revision.committed.v1' AND version_id IS NULL AND event_id IS NOT NULL AND revision_no IS NOT NULL AND payload IS NOT NULL AND payload_digest IS NOT NULL));
 ALTER TABLE platform.messages ADD CONSTRAINT event_message_revision FOREIGN KEY(event_id,revision_no) REFERENCES information.event_revisions(event_id,revision_no);
 END IF;
END $$;
DROP TRIGGER IF EXISTS immutable_identity_snapshot ON information.event_identity_snapshots;
CREATE TRIGGER immutable_identity_snapshot BEFORE UPDATE OR DELETE ON information.event_identity_snapshots FOR EACH ROW EXECUTE FUNCTION information.reject_revision_change();
DROP TRIGGER IF EXISTS immutable_definition_snapshot ON information.definition_snapshots;
CREATE TRIGGER immutable_definition_snapshot BEFORE UPDATE OR DELETE ON information.definition_snapshots FOR EACH ROW EXECUTE FUNCTION information.reject_revision_change();
CREATE OR REPLACE FUNCTION platform.lock_permission_epoch() RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,platform AS $$ DECLARE value bigint; BEGIN SELECT epoch INTO value FROM platform.permission_epochs WHERE id FOR SHARE; IF NOT FOUND THEN RAISE EXCEPTION 'PERMISSION_EPOCH_REQUIRED';END IF;RETURN value;END $$;
REVOKE ALL ON FUNCTION platform.lock_permission_epoch() FROM PUBLIC;
ALTER TABLE information.events ADD COLUMN IF NOT EXISTS event_time_value jsonb;
