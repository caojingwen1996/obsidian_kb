-- F01 material identity/versions and execution/audit tables remain unchanged.
CREATE TABLE information.fact (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL CHECK(length(trim(title))>0),
 description text NOT NULL CHECK(length(trim(description))>0), subject text, action text,
 event_status text NOT NULL CHECK(event_status IN ('expected','announced','in_progress','effective','completed','cancelled','unknown')),
 event_time text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE information.event (LIKE information.fact INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);
ALTER TABLE information.event ALTER COLUMN subject SET NOT NULL, ALTER COLUMN action SET NOT NULL;
ALTER TABLE information.event ADD CHECK(length(trim(subject))>0 AND length(trim(action))>0);
CREATE TABLE information.candidate_fact (
 candidate_id uuid PRIMARY KEY REFERENCES information.event_candidates(id), fact_id uuid NOT NULL REFERENCES information.fact(id)
);
CREATE TABLE information.fact_information (
 fact_id uuid REFERENCES information.fact(id), information_id uuid REFERENCES information.materials(id),
 relation_role text NOT NULL CHECK(relation_role IN ('supporting','conflicting')), created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(fact_id,information_id)
);
CREATE INDEX ON information.fact_information(information_id,fact_id);
ALTER TABLE information.material_versions ADD UNIQUE(material_id,id);
CREATE TABLE information.fact_evidence (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), fact_id uuid NOT NULL, information_id uuid NOT NULL,
 information_version_id uuid NOT NULL, segment_id uuid NOT NULL, start_cp integer NOT NULL, end_cp integer NOT NULL,
 quote text NOT NULL CHECK(length(quote)>0), evidence_role text NOT NULL CHECK(evidence_role IN ('supporting','conflicting')),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(fact_id,information_id) REFERENCES information.fact_information(fact_id,information_id),
 FOREIGN KEY(information_id,information_version_id) REFERENCES information.material_versions(material_id,id),
 FOREIGN KEY(information_version_id,segment_id) REFERENCES information.material_segments(version_id,id),
 UNIQUE(fact_id,information_version_id,segment_id,start_cp,end_cp,evidence_role), CHECK(start_cp>=0 AND end_cp>start_cp)
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
ALTER TABLE platform.messages ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
CREATE TABLE platform.event_message_dependencies (
 message_id uuid PRIMARY KEY REFERENCES platform.messages(id),predecessor_id uuid UNIQUE REFERENCES platform.messages(id),CHECK(message_id<>predecessor_id)
);
CREATE INDEX ON information.event(updated_at,id);
CREATE INDEX ON information.event(event_status,updated_at,id);
CREATE INDEX ON information.event(subject,action);
CREATE INDEX ON information.fact(created_at,id);
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
