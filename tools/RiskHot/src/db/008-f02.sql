-- 仅由 applyF02Migration 的事务和排他锁执行；禁止重跑005。
ALTER TABLE information.fact ADD COLUMN object text, ADD COLUMN event_id uuid REFERENCES information.event(id),
 ADD COLUMN event_relation_role text, ADD COLUMN event_relation_note text, ADD COLUMN event_assigned_at timestamptz,
 ADD CONSTRAINT fact_event_identity UNIQUE(event_id,id),
 ADD CONSTRAINT fact_event_assignment CHECK(
 (event_id IS NULL AND event_relation_role IS NULL AND event_relation_note IS NULL AND event_assigned_at IS NULL) OR
 (event_id IS NOT NULL AND event_relation_role IS NOT NULL AND event_relation_note IS NOT NULL AND event_assigned_at IS NOT NULL
 AND event_relation_role IN ('initial','progress','supplement','correction','corroboration') AND btrim(event_relation_note)<>''));
ALTER TABLE information.event ADD COLUMN object text;
UPDATE information.fact f SET event_id=ef.event_id,event_relation_role=ef.relation_role,event_relation_note=ef.relation_note,event_assigned_at=ef.created_at FROM information.event_fact ef WHERE ef.fact_id=f.id;
ALTER TABLE information.fact_information RENAME TO fact_material;
ALTER TABLE information.fact_material RENAME COLUMN information_id TO material_id;
-- 复合外键跟随重命名，但引用列改为资料身份。
ALTER TABLE information.fact_evidence DROP CONSTRAINT fact_evidence_fact_id_information_id_fkey;
ALTER TABLE information.fact_evidence ADD FOREIGN KEY(fact_id,material_id) REFERENCES information.fact_material(fact_id,material_id),ADD CHECK(information_id=material_id);
DO $$ DECLARE r record;t text;BEGIN
 FOR r IN SELECT conrelid::regclass AS t,conname FROM pg_constraint WHERE contype='f' AND confrelid='information.event_fact'::regclass LOOP
 EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I',r.t,r.conname);END LOOP;
 FOREACH t IN ARRAY ARRAY['event_target_fact','event_variable_fact','event_rating_fact'] LOOP
 EXECUTE format('ALTER TABLE information.%I ADD FOREIGN KEY(event_id,fact_id) REFERENCES information.fact(event_id,id) DEFERRABLE INITIALLY DEFERRED',t);END LOOP;
END $$;
DROP TABLE information.event_fact;
CREATE OR REPLACE FUNCTION information.require_fact_support() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM information.event e WHERE NOT EXISTS(SELECT 1 FROM information.fact f WHERE f.event_id=e.id)) THEN RAISE EXCEPTION 'EVENT_FACT_REQUIRED'; END IF;
 IF EXISTS(SELECT 1 FROM information.fact f WHERE NOT EXISTS(SELECT 1 FROM information.fact_material fm WHERE fm.fact_id=f.id)) THEN RAISE EXCEPTION 'FACT_MATERIAL_REQUIRED'; END IF;
 IF EXISTS(SELECT 1 FROM information.fact_material fm WHERE NOT EXISTS(SELECT 1 FROM information.fact_evidence fe WHERE fe.fact_id=fm.fact_id AND fe.material_id=fm.material_id)) THEN RAISE EXCEPTION 'FACT_EVIDENCE_REQUIRED'; END IF;
 IF EXISTS(SELECT 1 FROM information.event_rating r WHERE NOT EXISTS(SELECT 1 FROM information.event_rating_fact rf WHERE rf.rating_id=r.id)) THEN RAISE EXCEPTION 'RATING_FACT_REQUIRED'; END IF;
 RETURN NULL;
END $$;
CREATE FUNCTION information.lock_fact_events() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM information.event WHERE id=OLD.event_id OR id=NEW.event_id ORDER BY id FOR UPDATE;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END $$;
CREATE TRIGGER fact_event_lock BEFORE UPDATE OF event_id OR DELETE ON information.fact FOR EACH ROW EXECUTE FUNCTION information.lock_fact_events();
ALTER TABLE information.candidate_step_results ADD COLUMN node_key text,ADD COLUMN object_ref text NOT NULL DEFAULT '',ADD COLUMN manifest_ref text;
UPDATE information.candidate_step_results SET node_key='legacy-step-'||step_no::text,manifest_ref='legacy-schema5';
ALTER TABLE information.candidate_step_results DROP CONSTRAINT candidate_step_results_pkey;
ALTER TABLE information.candidate_step_results ALTER COLUMN step_no DROP NOT NULL,ALTER COLUMN node_key SET NOT NULL,ALTER COLUMN manifest_ref SET NOT NULL;
ALTER TABLE information.candidate_step_results ADD PRIMARY KEY(candidate_id,generation,node_key,object_ref);
-- NULL step_no on new semantic nodes remains unrestricted; legacy upserts keep their exact conflict target.
CREATE UNIQUE INDEX candidate_step_results_legacy_step ON information.candidate_step_results(candidate_id,step_no,generation);
ALTER TABLE information.candidate_step_results DROP CONSTRAINT candidate_step_results_state_check;
ALTER TABLE information.candidate_step_results ADD CHECK(state IN ('pending','running','succeeded','skipped','review','recoverable','superseded'));
-- 旧运行代码仅可继续旧节点，不将数字步骤推断成新任务语义。
CREATE FUNCTION information.legacy_checkpoint_defaults() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.node_key IS NULL AND NEW.step_no IS NOT NULL THEN NEW.node_key='legacy-step-'||NEW.step_no::text;END IF;
 IF NEW.manifest_ref IS NULL AND NEW.node_key LIKE 'legacy-step-%' THEN NEW.manifest_ref='legacy-schema5';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER legacy_checkpoint BEFORE INSERT ON information.candidate_step_results FOR EACH ROW EXECUTE FUNCTION information.legacy_checkpoint_defaults();
CREATE TABLE information.event_variable_extractions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),candidate_id uuid NOT NULL REFERENCES information.event_candidates(id),generation bigint NOT NULL CHECK(generation>0),
 event_id uuid REFERENCES information.event(id),input_digest text NOT NULL,manifest_ref text NOT NULL,operation_key text NOT NULL UNIQUE,
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object' AND (payload->>'schema_version'='riskhot.variable-extraction.v1') IS TRUE),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(candidate_id,generation,input_digest,manifest_ref));
CREATE INDEX ON information.event_variable_extractions(event_id,created_at,id);
CREATE INDEX ON information.event_variable_extractions(candidate_id,generation);
CREATE TABLE information.event_association_snapshots(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_id uuid NOT NULL REFERENCES information.event(id),input_digest text NOT NULL,manifest_ref text NOT NULL,operation_key text NOT NULL UNIQUE,
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object' AND (payload->>'schema_version'='riskhot.event-association.v1') IS TRUE),
 supersedes_id uuid REFERENCES information.event_association_snapshots(id),created_at timestamptz NOT NULL DEFAULT now(),CHECK(supersedes_id<>id),UNIQUE(event_id,input_digest,manifest_ref));
CREATE INDEX ON information.event_association_snapshots(event_id,created_at,id);
CREATE TABLE information.event_association_members(snapshot_id uuid REFERENCES information.event_association_snapshots(id),event_id uuid REFERENCES information.event(id),basis_digest text NOT NULL,PRIMARY KEY(snapshot_id,event_id));
CREATE INDEX ON information.event_association_members(event_id,snapshot_id);
CREATE TABLE information.event_usage_results(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_id uuid NOT NULL REFERENCES information.event(id),input_digest text NOT NULL,manifest_ref text NOT NULL,operation_key text NOT NULL UNIQUE,
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object' AND (payload->>'schema_version'='riskhot.event-usage.v1') IS TRUE),
 supersedes_id uuid REFERENCES information.event_usage_results(id),created_at timestamptz NOT NULL DEFAULT now(),CHECK(supersedes_id<>id),UNIQUE(event_id,input_digest,manifest_ref));
CREATE INDEX ON information.event_usage_results(event_id,created_at,id);
CREATE FUNCTION information.immutable_f02_result() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' OR (to_jsonb(NEW)-'event_id') IS DISTINCT FROM (to_jsonb(OLD)-'event_id') OR (OLD.event_id IS NOT NULL AND NEW.event_id IS DISTINCT FROM OLD.event_id) THEN RAISE EXCEPTION 'IMMUTABLE_F02_RESULT';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_result BEFORE UPDATE OR DELETE ON information.event_variable_extractions FOR EACH ROW EXECUTE FUNCTION information.immutable_f02_result();
CREATE TRIGGER immutable_result BEFORE UPDATE OR DELETE ON information.event_association_snapshots FOR EACH ROW EXECUTE FUNCTION information.immutable_f02_result();
CREATE TRIGGER immutable_result BEFORE UPDATE OR DELETE ON information.event_usage_results FOR EACH ROW EXECUTE FUNCTION information.immutable_f02_result();
INSERT INTO platform.schema_versions(version) VALUES(8);
CREATE TABLE information.variable_observation_records(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_id uuid NOT NULL,target_id uuid NOT NULL,variable_id uuid NOT NULL,
 definition_snapshot_id uuid NOT NULL REFERENCES information.definition_snapshots(id),value jsonb NOT NULL CHECK(jsonb_typeof(value) IN ('number','string','boolean') AND value<>'""'::jsonb),
 unit text CHECK(unit IS NULL OR btrim(unit)<>''),value_nature varchar(16) CHECK(value_nature IN ('actual','historical','planned','expected','predicted')),
 value_time jsonb NOT NULL CHECK(jsonb_typeof(value_time)='object'),acquisition_method varchar(16) NOT NULL CHECK(acquisition_method IN ('extracted','calculated','inferred')),
 derivation_basis jsonb,status varchar(16) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','disputed','invalidated')),
 supersedes_id uuid REFERENCES information.variable_observation_records(id),correction_reason text,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 basis jsonb NOT NULL CHECK(jsonb_typeof(basis)='array' AND jsonb_array_length(basis)>0),
 FOREIGN KEY(event_id,target_id,variable_id) REFERENCES information.event_target_variable(event_id,target_id,variable_id),
 CHECK(supersedes_id<>id),CHECK((supersedes_id IS NULL AND correction_reason IS NULL) OR (supersedes_id IS NOT NULL AND correction_reason IS NOT NULL AND btrim(correction_reason)<>'')),
 CHECK(status<>'confirmed' OR value_nature IS NOT NULL),
 CHECK(acquisition_method='extracted' OR (derivation_basis IS NOT NULL AND jsonb_typeof(derivation_basis)='object')));
CREATE INDEX ON information.variable_observation_records(event_id,target_id,variable_id);
CREATE INDEX ON information.variable_observation_records(definition_snapshot_id);
CREATE INDEX ON information.variable_observation_records(supersedes_id);
CREATE INDEX ON information.variable_observation_records USING gin(basis);
CREATE FUNCTION information.validate_observation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE o record;b jsonb;i jsonb;t jsonb;cnt integer;oldrow record;ids uuid[];
BEGIN
 -- 全局复查也覆盖证据删除/改属、定义变更及Fact移组。
 FOR o IN SELECT * FROM information.variable_observation_records LOOP
  IF NOT EXISTS(SELECT 1 FROM information.definition_snapshots d JOIN information.event_variable_definition vd ON vd.definition_snapshot_id=d.id WHERE d.id=o.definition_snapshot_id AND d.kind='variable' AND d.definition_id=o.variable_id AND vd.event_id=o.event_id AND vd.target_id=o.target_id AND vd.variable_id=o.variable_id) THEN RAISE EXCEPTION 'OBSERVATION_DEFINITION_MISMATCH';END IF;
  t=o.value_time;
  IF jsonb_typeof(t->'kind') IS DISTINCT FROM 'string' OR jsonb_typeof(t->'precision') IS DISTINCT FROM 'string' OR NOT (t ?& ARRAY['kind','precision','start','end','raw_text']) OR (SELECT count(*) FROM jsonb_object_keys(t))<>5 OR NOT(t->>'kind'=ANY(ARRAY['point','period','range','unknown'])) OR NOT(t->>'precision'=ANY(ARRAY['second','day','month','quarter','year','unknown'])) OR jsonb_typeof(t->'start') NOT IN('string','null') OR jsonb_typeof(t->'end') NOT IN('string','null') OR jsonb_typeof(t->'raw_text') NOT IN('string','null') THEN RAISE EXCEPTION 'OBSERVATION_TIME_INVALID';END IF;
  IF (t->>'kind'='unknown' AND (t->>'precision'<>'unknown' OR t->>'start' IS NOT NULL OR t->>'end' IS NOT NULL)) OR
   (t->>'kind'='point' AND (t->>'start' IS NULL OR t->>'end' IS NOT NULL OR t->>'precision' IN('unknown','quarter'))) OR
   (t->>'kind'='period' AND (t->>'start' IS NULL OR t->>'end' IS NULL OR t->>'precision'='unknown')) OR
   (t->>'kind'='range' AND (t->>'start' IS NULL AND t->>'end' IS NULL)) THEN RAISE EXCEPTION 'OBSERVATION_TIME_INVALID';END IF;
  FOR b IN SELECT * FROM jsonb_array_elements(o.basis) LOOP
   IF jsonb_typeof(b)<>'object' OR NOT(b ?& ARRAY['fact_id','fact_evidence_id','material_id','version','content_digest','input_ref']) OR (SELECT count(*) FROM jsonb_object_keys(b))<>6 OR (b->>'version')!~'^[1-9][0-9]*$' OR (b->>'content_digest')!~'^[a-f0-9]{64}$' OR jsonb_typeof(b->'input_ref') NOT IN('string','null') THEN RAISE EXCEPTION 'OBSERVATION_BASIS_INVALID';END IF;
   IF NOT EXISTS(SELECT 1 FROM information.fact_evidence fe JOIN information.fact f ON f.id=fe.fact_id WHERE fe.id=(b->>'fact_evidence_id')::uuid AND f.id=(b->>'fact_id')::uuid AND f.event_id=o.event_id AND fe.material_id=(b->>'material_id')::uuid AND fe.material_version=(b->>'version')::integer AND fe.material_digest=b->>'content_digest') THEN RAISE EXCEPTION 'OBSERVATION_BASIS_MISMATCH';END IF;
   IF o.acquisition_method='extracted' AND b->>'input_ref' IS NOT NULL THEN RAISE EXCEPTION 'OBSERVATION_INPUT_INVALID';END IF;
   IF o.acquisition_method<>'extracted' AND (b->>'input_ref' IS NULL OR (SELECT count(*) FROM jsonb_array_elements(o.derivation_basis->'inputs') x WHERE x->>'local_ref'=b->>'input_ref')<>1) THEN RAISE EXCEPTION 'OBSERVATION_INPUT_INVALID';END IF;
  END LOOP;
  IF o.acquisition_method<>'extracted' THEN
   IF btrim(coalesce(o.derivation_basis->>'method',''))='' OR jsonb_typeof(o.derivation_basis->'inputs') IS DISTINCT FROM 'array' OR jsonb_array_length(o.derivation_basis->'inputs')=0 THEN RAISE EXCEPTION 'OBSERVATION_DERIVATION_REQUIRED';END IF;
   FOR i IN SELECT * FROM jsonb_array_elements(o.derivation_basis->'inputs') LOOP
    IF btrim(coalesce(i->>'local_ref',''))='' OR jsonb_typeof(i->'basis_refs') IS DISTINCT FROM 'array' OR jsonb_array_length(i->'basis_refs')=0 OR (SELECT count(*) FROM jsonb_array_elements(o.derivation_basis->'inputs') x WHERE x->>'local_ref'=i->>'local_ref')<>1 THEN RAISE EXCEPTION 'OBSERVATION_INPUT_INVALID';END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(i->'basis_refs') ref WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(o.basis) basis WHERE basis->>'fact_evidence_id'=ref AND basis->>'input_ref'=i->>'local_ref')) THEN RAISE EXCEPTION 'OBSERVATION_INPUT_EVIDENCE_REQUIRED';END IF;
   END LOOP;
  END IF;
  IF o.supersedes_id IS NOT NULL THEN
   SELECT * INTO oldrow FROM information.variable_observation_records WHERE id=o.supersedes_id;
   IF (oldrow.event_id,oldrow.target_id,oldrow.variable_id) IS DISTINCT FROM (o.event_id,o.target_id,o.variable_id) THEN RAISE EXCEPTION 'OBSERVATION_CORRECTION_CONTEXT';END IF;
   IF o.status='confirmed' AND oldrow.status<>'invalidated' THEN RAISE EXCEPTION 'OBSERVATION_CORRECTION_STATUS';END IF;
   IF EXISTS(WITH RECURSIVE chain AS (SELECT id,supersedes_id,ARRAY[id] path,false cycle FROM information.variable_observation_records WHERE id=o.id UNION ALL SELECT p.id,p.supersedes_id,c.path||p.id,p.id=ANY(c.path) FROM information.variable_observation_records p JOIN chain c ON p.id=c.supersedes_id WHERE NOT c.cycle) SELECT 1 FROM chain WHERE cycle) THEN RAISE EXCEPTION 'OBSERVATION_CORRECTION_CYCLE';END IF;
  END IF;
 END LOOP;
 RETURN NULL;
END $$;
DO $$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['variable_observation_records','fact_evidence','fact','definition_snapshots','event_variable_definition'] LOOP
 EXECUTE format('CREATE CONSTRAINT TRIGGER observation_basis_guard AFTER INSERT OR UPDATE OR DELETE ON information.%I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION information.validate_observation()',t);END LOOP;
END $$;
CREATE FUNCTION information.check_association_members() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s record;
BEGIN
 FOR s IN SELECT * FROM information.event_association_snapshots LOOP
  IF jsonb_typeof(s.payload->'members') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'ASSOCIATION_MEMBERS_REQUIRED';END IF;
  IF EXISTS((SELECT m.event_id,m.basis_digest FROM information.event_association_members m WHERE m.snapshot_id=s.id EXCEPT SELECT (p->>'event_id')::uuid,p->>'basis_digest' FROM jsonb_array_elements(s.payload->'members') p) UNION ALL (SELECT (p->>'event_id')::uuid,p->>'basis_digest' FROM jsonb_array_elements(s.payload->'members') p EXCEPT SELECT m.event_id,m.basis_digest FROM information.event_association_members m WHERE m.snapshot_id=s.id)) THEN RAISE EXCEPTION 'ASSOCIATION_MEMBERS_MISMATCH';END IF;
  IF EXISTS(WITH RECURSIVE chain AS (SELECT id,supersedes_id,ARRAY[id] path,false cycle FROM information.event_association_snapshots WHERE id=s.id UNION ALL SELECT p.id,p.supersedes_id,c.path||p.id,p.id=ANY(c.path) FROM information.event_association_snapshots p JOIN chain c ON p.id=c.supersedes_id WHERE NOT c.cycle) SELECT 1 FROM chain WHERE cycle) THEN RAISE EXCEPTION 'ASSOCIATION_CYCLE';END IF;
 END LOOP;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER association_members_guard AFTER INSERT OR UPDATE OR DELETE ON information.event_association_members DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION information.check_association_members();
CREATE CONSTRAINT TRIGGER association_members_guard AFTER INSERT OR UPDATE OR DELETE ON information.event_association_snapshots DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION information.check_association_members();
CREATE FUNCTION platform.current_model_materials(p_attempt uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,platform,infomation,m1 AS $$
DECLARE a record;w record;r jsonb;m record;items jsonb='[]';refs jsonb;
BEGIN
 PERFORM platform.lock_permission_epoch();
 SELECT * INTO a FROM platform.model_attempts WHERE id=p_attempt FOR SHARE;
 IF a.id IS NULL OR a.status<>'calling' THEN RAISE EXCEPTION 'MODEL_CALL_NOT_PERMITTED';END IF;
 SELECT * INTO w FROM platform.model_budget_windows WHERE id=a.window_id FOR SHARE;
 refs=coalesce(a.subject_ref->'material_refs',jsonb_build_array(a.subject_ref-'material_refs'));
 IF jsonb_typeof(refs)<>'array' OR jsonb_array_length(refs)=0 THEN RAISE EXCEPTION 'MATERIAL_BASIS_REQUIRED';END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(refs) ORDER BY value->>'material_id' LOOP
  SELECT m0.*,s.catalog_key,s.state INTO m FROM infomation.ingestion_material m0 JOIN m1.sources s ON s.id=m0.source_id WHERE m0.id=(r->>'material_id')::uuid FOR SHARE OF m0,s;
  IF m.id IS NULL OR m.version<>(r->>'version')::integer OR m.content_digest<>r->>'content_digest' THEN RAISE EXCEPTION 'MATERIAL_BASIS_CHANGED';END IF;
  IF m.state<>'ACTIVE' OR NOT platform.authorize_actor(w.actor,CASE WHEN a.owner_kind='event' THEN 'event_submit' ELSE 'submit' END,m.catalog_key) THEN RAISE EXCEPTION 'FORBIDDEN';END IF;
  items=items||jsonb_build_array(jsonb_build_object('material_ref',r,'content',m.content));
 END LOOP;
 RETURN items;
END $$;
REVOKE ALL ON FUNCTION platform.current_model_materials(uuid) FROM PUBLIC;
