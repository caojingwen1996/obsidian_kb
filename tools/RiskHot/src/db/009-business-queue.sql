CREATE SCHEMA IF NOT EXISTS platform;
CREATE TABLE IF NOT EXISTS platform.task_runs (
 run_id uuid PRIMARY KEY, task_type text NOT NULL, payload_version integer NOT NULL CHECK(payload_version>0),
 owner_module text NOT NULL, owner_ref jsonb NOT NULL, operation_key text NOT NULL,
 execution_generation bigint NOT NULL CHECK(execution_generation>0), input_digest text NOT NULL, manifest_ref text NOT NULL,
 input_payload jsonb NOT NULL DEFAULT '{}',
 runtime_state text NOT NULL DEFAULT 'ready' CHECK(runtime_state IN ('ready','running','waiting','succeeded','recoverable','cancelled','superseded')),
 resume_ref jsonb, result_ref jsonb, next_eligible_at timestamptz, correlation_id uuid, causation_id uuid,
 engine text NOT NULL CHECK(engine IN ('pg-boss','temporal')), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(owner_module,task_type,operation_key)
);
CREATE INDEX IF NOT EXISTS task_runs_recovery ON platform.task_runs(runtime_state,next_eligible_at,run_id);
CREATE INDEX IF NOT EXISTS task_runs_owner ON platform.task_runs(owner_module,owner_ref);
CREATE TABLE IF NOT EXISTS platform.task_dispatches (
 dispatch_id uuid PRIMARY KEY, run_id uuid NOT NULL REFERENCES platform.task_runs(run_id), generation bigint NOT NULL CHECK(generation>0),
 dispatch_seq integer NOT NULL CHECK(dispatch_seq>0), job_id uuid NOT NULL, dispatch_state text NOT NULL DEFAULT 'queued',
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(run_id,generation,dispatch_seq)
);
CREATE TABLE IF NOT EXISTS platform.job_runs (
 id uuid PRIMARY KEY, schedule_key text NOT NULL, scheduled_at timestamptz NOT NULL, started_at timestamptz,
 finished_at timestamptz, status text NOT NULL, counts jsonb, error_code text, policy_version text NOT NULL,
 UNIQUE(schedule_key,scheduled_at)
);
CREATE INDEX IF NOT EXISTS job_runs_started ON platform.job_runs(status,started_at);
CREATE TABLE IF NOT EXISTS platform.schedule_registrations (
 schedule_key text PRIMARY KEY, policy_version text NOT NULL, cron text NOT NULL, timezone text NOT NULL, applied_at timestamptz NOT NULL
);
-- Completed candidates may call only the new post-save association task. All other tasks retain the original claim fence.
CREATE OR REPLACE FUNCTION platform.claim_business_model_call(p_attempt uuid)
RETURNS TABLE(allowed boolean,reason_code text,deadline timestamptz,request_artifact_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,platform,infomation,information,m1 AS $$
DECLARE a record;w record;c record;m record;r jsonb;refs jsonb;
BEGIN
 PERFORM platform.lock_permission_epoch();
 SELECT * INTO a FROM platform.model_attempts WHERE id=p_attempt FOR UPDATE;
 IF a.id IS NULL THEN RETURN QUERY SELECT false,'ATTEMPT_NOT_FOUND'::text,NULL::timestamptz,NULL::uuid;RETURN;END IF;
 SELECT * INTO c FROM information.event_candidates WHERE id=a.owner_id FOR SHARE;
 IF a.owner_kind<>'event' OR a.task_id<>'AI-04' OR c.status IS DISTINCT FROM 'completed' THEN
  RETURN QUERY SELECT * FROM platform.claim_model_call(p_attempt);RETURN;
 END IF;
 SELECT * INTO w FROM platform.model_budget_windows WHERE id=a.window_id FOR SHARE;
 IF a.subject_ref->'post_commit_package'->>'task_id' IS DISTINCT FROM 'AI-04'
 OR a.subject_ref->'post_commit_package'->>'version' IS DISTINCT FROM 'f02-eight-step-v1'
 OR coalesce(a.subject_ref->'post_commit_package'->>'digest','')!~'^[a-f0-9]{64}$'
 OR NOT EXISTS(SELECT 1 FROM information.candidate_fact cf JOIN information.fact f ON f.id=cf.fact_id JOIN information.event e ON e.id=f.event_id WHERE cf.candidate_id=c.id)
 OR c.execution_generation<>a.generation OR c.material_id<>(a.subject_ref->>'material_id')::uuid
 OR c.material_version<>(a.subject_ref->>'version')::integer OR c.material_digest<>a.subject_ref->>'content_digest'
 OR w.owner_kind<>a.owner_kind OR w.owner_id<>a.owner_id OR w.task_id<>a.task_id THEN
  RETURN QUERY SELECT false,'STALE_EXECUTION'::text,w.deadline,a.request_artifact_id;RETURN;
 END IF;
 refs=coalesce(a.subject_ref->'material_refs',jsonb_build_array(a.subject_ref-'post_commit_package'));
 FOR r IN SELECT value FROM jsonb_array_elements(refs) ORDER BY value->>'material_id' LOOP
  SELECT m0.*,s.catalog_key,s.state INTO m FROM infomation.ingestion_material m0 JOIN m1.sources s ON s.id=m0.source_id WHERE m0.id=(r->>'material_id')::uuid FOR SHARE OF m0,s;
  IF m.id IS NULL OR m.version<>(r->>'version')::integer OR m.content_digest<>r->>'content_digest' THEN RETURN QUERY SELECT false,'MATERIAL_BASIS_CHANGED'::text,w.deadline,a.request_artifact_id;RETURN;END IF;
  IF m.state<>'ACTIVE' OR NOT platform.authorize_actor(w.actor,'event_submit',m.catalog_key) THEN RETURN QUERY SELECT false,'FORBIDDEN'::text,w.deadline,a.request_artifact_id;RETURN;END IF;
 END LOOP;
 IF w.deadline<=clock_timestamp() THEN RETURN QUERY SELECT false,'MODEL_BUDGET_EXHAUSTED'::text,w.deadline,a.request_artifact_id;RETURN;END IF;
 IF EXISTS(SELECT 1 FROM platform.model_service_state WHERE protocol=a.provider_protocol AND blocked_until>clock_timestamp()) THEN RETURN QUERY SELECT false,'MODEL_SERVICE_PAUSED'::text,w.deadline,a.request_artifact_id;RETURN;END IF;
 IF a.status<>'prepared' THEN RETURN QUERY SELECT false,'MODEL_CALL_ALREADY_CLAIMED'::text,w.deadline,a.request_artifact_id;RETURN;END IF;
 UPDATE platform.model_attempts SET status='calling',started_at=clock_timestamp() WHERE id=p_attempt;
 RETURN QUERY SELECT true,NULL::text,w.deadline,a.request_artifact_id;
END $$;
REVOKE ALL ON FUNCTION platform.claim_business_model_call(uuid) FROM PUBLIC;
