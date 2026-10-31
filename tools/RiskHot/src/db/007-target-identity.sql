CREATE TABLE IF NOT EXISTS information.target(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),target_name text NOT NULL CHECK(btrim(target_name)<>''),
 aliases text[] NOT NULL DEFAULT '{}',categories jsonb NOT NULL CHECK(jsonb_typeof(categories)='array' AND jsonb_array_length(categories)>0),
 jurisdiction text,scope_definition text NOT NULL CHECK(btrim(scope_definition)<>''),is_active boolean NOT NULL DEFAULT true,
 definition_version integer NOT NULL DEFAULT 1 CHECK(definition_version>0),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(cardinality(aliases)=0 OR array_ndims(aliases)=1),CHECK(array_position(aliases,NULL) IS NULL)
);
CREATE INDEX IF NOT EXISTS target_name_lookup ON information.target(lower(btrim(target_name)));
CREATE INDEX IF NOT EXISTS target_state_jurisdiction ON information.target(is_active,jurisdiction);
CREATE INDEX IF NOT EXISTS target_categories_gin ON information.target USING gin(categories);
CREATE TABLE IF NOT EXISTS information.target_object_sets(
 candidate_id uuid NOT NULL REFERENCES information.event_candidates(id),generation bigint NOT NULL,
 payload jsonb NOT NULL,input_digest text NOT NULL,actor text NOT NULL,reason text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(candidate_id,generation)
);
CREATE TABLE IF NOT EXISTS information.target_identity_runs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),candidate_id uuid NOT NULL REFERENCES information.event_candidates(id),generation bigint NOT NULL,
 object_ref text NOT NULL,input_digest text NOT NULL,input jsonb NOT NULL,task_version text NOT NULL,
 result jsonb,state text NOT NULL DEFAULT 'pending' CHECK(state IN('pending','review','approved','superseded')),target_id uuid REFERENCES information.target(id),target_version integer,
 approval_actor text,approval_reason text,approval_digest text,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(candidate_id,generation,object_ref,input_digest)
);
ALTER TABLE platform.model_budget_windows ADD COLUMN IF NOT EXISTS object_ref text NOT NULL DEFAULT '';
ALTER TABLE platform.model_attempts ADD COLUMN IF NOT EXISTS object_ref text NOT NULL DEFAULT '';
CREATE OR REPLACE FUNCTION platform.check_model_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM platform.model_budget_windows w WHERE w.id=NEW.window_id AND w.owner_kind=NEW.owner_kind AND w.owner_id=NEW.owner_id AND w.task_id=NEW.task_id AND w.subject_ref=NEW.subject_ref AND w.object_ref=NEW.object_ref) THEN RAISE EXCEPTION 'MODEL_BUDGET_SCOPE_MISMATCH';END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS model_scope_guard ON platform.model_attempts;
CREATE TRIGGER model_scope_guard BEFORE INSERT OR UPDATE OF window_id,owner_kind,owner_id,task_id,subject_ref,object_ref ON platform.model_attempts FOR EACH ROW EXECUTE FUNCTION platform.check_model_scope();
