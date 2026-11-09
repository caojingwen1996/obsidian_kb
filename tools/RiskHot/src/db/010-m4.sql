-- M4 增量迁移。只新增空目录，不改事件事实。
CREATE TABLE information.financial_object_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_kind TEXT NOT NULL CHECK (entry_kind IN ('directory', 'object')),
    parent_id UUID REFERENCES information.financial_object_config(id) ON DELETE RESTRICT,
    name TEXT NOT NULL CHECK (name = btrim(name) AND char_length(name) BETWEEN 1 AND 200),
    sort_order BIGINT NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    aliases TEXT[] NOT NULL DEFAULT '{}',
    categories JSONB NOT NULL DEFAULT '[]',
    category_version TEXT CHECK (category_version IS NULL OR btrim(category_version) <> ''),
    jurisdiction_mode TEXT NOT NULL DEFAULT 'unknown'
        CHECK (jurisdiction_mode IN ('unknown', 'specified', 'unrestricted')),
    jurisdiction TEXT CHECK (jurisdiction IS NULL OR char_length(jurisdiction) <= 200),
    scope_definition TEXT CHECK (
        scope_definition IS NULL OR
        (scope_definition = btrim(scope_definition) AND char_length(scope_definition) BETWEEN 1 AND 8000)
    ),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'disabled')),
    config_version BIGINT NOT NULL DEFAULT 1 CHECK (config_version > 0),
    identity_version BIGINT NOT NULL DEFAULT 1
        CHECK (identity_version > 0 AND identity_version <= config_version),
    current_snapshot_id UUID NOT NULL REFERENCES information.definition_snapshots(id) ON DELETE RESTRICT,
    created_by TEXT NOT NULL REFERENCES platform.actors(subject) ON DELETE RESTRICT,
    updated_by TEXT NOT NULL REFERENCES platform.actors(subject) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (updated_at >= created_at),
    CHECK (parent_id IS NULL OR parent_id <> id),
    CHECK (entry_kind = 'directory' OR parent_id IS NOT NULL),
    CHECK (cardinality(aliases) <= 200),
    CHECK (cardinality(aliases) = 0 OR (array_ndims(aliases) = 1 AND array_lower(aliases, 1) = 1)),
    CHECK (array_position(aliases, NULL) IS NULL),
    CHECK (jsonb_typeof(categories) = 'array'),
    CHECK ((jsonb_array_length(categories) = 0 AND category_version IS NULL)
        OR (jsonb_array_length(categories) > 0 AND category_version IS NOT NULL)),
    CHECK (entry_kind <> 'directory'
        OR (cardinality(aliases) = 0 AND categories = '[]'::jsonb AND category_version IS NULL)),
    CHECK ((jurisdiction_mode = 'specified' AND jurisdiction IS NOT NULL
            AND jurisdiction = btrim(jurisdiction) AND jurisdiction <> '')
        OR (jurisdiction_mode IN ('unknown', 'unrestricted') AND jurisdiction IS NULL)),
    CHECK (entry_kind <> 'object' OR status <> 'active'
        OR (scope_definition IS NOT NULL AND jsonb_array_length(categories) > 0
            AND jurisdiction_mode <> 'unknown'))
);

CREATE INDEX financial_object_config_parent_order
    ON information.financial_object_config(parent_id, sort_order, id);
CREATE UNIQUE INDEX financial_object_config_directory_name
    ON information.financial_object_config(parent_id, lower(btrim(name)))
    WHERE entry_kind = 'directory' AND parent_id IS NOT NULL;
CREATE UNIQUE INDEX financial_object_config_root_name
    ON information.financial_object_config(lower(btrim(name)))
    WHERE entry_kind = 'directory' AND parent_id IS NULL;
CREATE INDEX financial_object_config_name
    ON information.financial_object_config(lower(btrim(name)));
CREATE INDEX financial_object_config_filter
    ON information.financial_object_config(entry_kind, status, jurisdiction_mode, jurisdiction, id);
CREATE INDEX financial_object_config_categories
    ON information.financial_object_config USING gin(categories);
CREATE INDEX financial_object_config_aliases
    ON information.financial_object_config USING gin(aliases);
CREATE INDEX financial_object_config_snapshot
    ON information.financial_object_config(current_snapshot_id);

CREATE TABLE information.shared_observation (
 id uuid PRIMARY KEY, config_id uuid NOT NULL UNIQUE REFERENCES information.financial_object_config(id),
 adopted_snapshot_id uuid NOT NULL REFERENCES information.definition_snapshots(id),
 adopted_identity_version bigint NOT NULL CHECK(adopted_identity_version>0),
 state text NOT NULL CHECK(state IN ('active','paused','ended')),
 state_reason text NOT NULL CHECK(state_reason IN ('manual','config_unavailable','definition_changed')),
 note text NOT NULL DEFAULT '' CHECK(char_length(note)<=8000),
 version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 created_by text NOT NULL REFERENCES platform.actors(subject), updated_by text NOT NULL REFERENCES platform.actors(subject),
 created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL
);
CREATE TABLE information.target_config_mapping (
 id uuid PRIMARY KEY,config_id uuid NOT NULL REFERENCES information.financial_object_config(id),
 target_id uuid NOT NULL REFERENCES information.target(id),
 config_snapshot_id uuid NOT NULL REFERENCES information.definition_snapshots(id),
 config_identity_version bigint NOT NULL CHECK(config_identity_version>0),
 target_snapshot_id uuid NOT NULL REFERENCES information.definition_snapshots(id),
 target_version text NOT NULL,
 state text NOT NULL CHECK(state IN ('approved','conflict','pending','revoked')),
 reason text NOT NULL CHECK(char_length(btrim(reason)) BETWEEN 1 AND 2000),
 version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 reviewed_by text NOT NULL REFERENCES platform.actors(subject),reviewed_at timestamptz NOT NULL
);
CREATE UNIQUE INDEX m4_mapping_config_approved ON information.target_config_mapping(config_id) WHERE state='approved';
CREATE UNIQUE INDEX m4_mapping_target_approved ON information.target_config_mapping(target_id) WHERE state='approved';
CREATE INDEX m4_mapping_target ON information.target_config_mapping(target_id);
CREATE TABLE information.m4_history (
 id uuid PRIMARY KEY,entity_kind text NOT NULL CHECK(entity_kind IN ('observation','mapping')),
 observation_id uuid REFERENCES information.shared_observation(id),mapping_id uuid REFERENCES information.target_config_mapping(id),
 actor text NOT NULL REFERENCES platform.actors(subject),action text NOT NULL,reason text NOT NULL,
 before_value jsonb,after_value jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((entity_kind='observation' AND observation_id IS NOT NULL AND mapping_id IS NULL) OR
       (entity_kind='mapping' AND mapping_id IS NOT NULL AND observation_id IS NULL))
);
CREATE INDEX m4_history_observation ON information.m4_history(observation_id,created_at,id);
CREATE INDEX m4_history_mapping ON information.m4_history(mapping_id,created_at,id);

CREATE FUNCTION information.m4_canonical(value jsonb) RETURNS text LANGUAGE sql IMMUTABLE STRICT AS $$
 SELECT CASE jsonb_typeof(value)
 WHEN 'object' THEN '{'||coalesce((SELECT string_agg(to_jsonb(key)::text||':'||information.m4_canonical(val),',' ORDER BY key COLLATE "C") FROM jsonb_each(value) kv(key,val)),'')||'}'
 WHEN 'array' THEN '['||coalesce((SELECT string_agg(information.m4_canonical(val),',' ORDER BY n) FROM jsonb_array_elements(value) WITH ORDINALITY a(val,n)),'')||']'
 ELSE value::text END
$$;
CREATE FUNCTION information.m4_json_versions(value jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE k text;
BEGIN
 FOREACH k IN ARRAY ARRAY['version','config_version','identity_version','adopted_identity_version','config_identity_version','sort_order'] LOOP
  IF value ? k THEN value:=jsonb_set(value,ARRAY[k],to_jsonb(value->>k));END IF;
 END LOOP;
 RETURN value;
END $$;
CREATE FUNCTION information.m4_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'M4_HISTORY_IMMUTABLE';END $$;
CREATE TRIGGER m4_immutable_snapshot BEFORE UPDATE OR DELETE ON information.definition_snapshots FOR EACH ROW EXECUTE FUNCTION information.m4_immutable();
CREATE TRIGGER m4_immutable_history BEFORE UPDATE OR DELETE ON information.m4_history FOR EACH ROW EXECUTE FUNCTION information.m4_immutable();
CREATE FUNCTION information.m4_config_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s information.definition_snapshots;r information.financial_object_config;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'M4_DELETE_FORBIDDEN';END IF;
 IF NEW.entry_kind='object' AND NEW.scope_definition IS NOT NULL AND NEW.jurisdiction_mode<>'unknown' AND EXISTS(SELECT 1 FROM information.financial_object_config c WHERE c.id<>NEW.id AND c.entry_kind='object' AND lower(btrim(c.name))=lower(btrim(NEW.name)) AND c.jurisdiction_mode=NEW.jurisdiction_mode AND c.jurisdiction IS NOT DISTINCT FROM NEW.jurisdiction AND c.scope_definition=NEW.scope_definition) THEN RAISE EXCEPTION 'M4_OBJECT_EXISTS';END IF;
 IF NEW.status='draft' AND (EXISTS(SELECT 1 FROM information.shared_observation WHERE config_id=NEW.id) OR EXISTS(SELECT 1 FROM information.target_config_mapping WHERE config_id=NEW.id)) THEN RAISE EXCEPTION 'M4_DRAFT_IN_USE';END IF;
 IF EXISTS(SELECT 1 FROM information.shared_observation o WHERE o.state='active' AND (o.config_id=NEW.id AND o.adopted_identity_version<>NEW.identity_version OR EXISTS(WITH RECURSIVE ancestors AS(SELECT id,parent_id,status FROM information.financial_object_config WHERE id=o.config_id UNION SELECT c.id,c.parent_id,c.status FROM information.financial_object_config c JOIN ancestors a ON c.id=a.parent_id) SELECT 1 FROM ancestors WHERE status<>'active'))) THEN RAISE EXCEPTION 'M4_ACTIVE_OBSERVATION_INVALID';END IF;
 IF EXISTS(SELECT 1 FROM information.target_config_mapping WHERE config_id=NEW.id AND state='approved' AND config_identity_version<>NEW.identity_version) THEN RAISE EXCEPTION 'M4_ACTIVE_MAPPING_INVALID';END IF;
 IF TG_OP='UPDATE' AND (NEW.entry_kind<>OLD.entry_kind OR NEW.created_by<>OLD.created_by OR NEW.created_at<>OLD.created_at OR NEW.config_version<>OLD.config_version+1) THEN RAISE EXCEPTION 'M4_VERSION_INVALID';END IF;
 IF NEW.parent_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM information.financial_object_config WHERE id=NEW.parent_id AND entry_kind='directory') THEN RAISE EXCEPTION 'M4_PARENT_INVALID';END IF;
 IF EXISTS(WITH RECURSIVE p AS(SELECT id,parent_id,ARRAY[id] path,false cycle FROM information.financial_object_config WHERE id=NEW.id UNION ALL SELECT c.id,c.parent_id,p.path||c.id,c.id=ANY(p.path) FROM information.financial_object_config c JOIN p ON c.id=p.parent_id WHERE NOT p.cycle) SELECT 1 FROM p WHERE cycle) THEN RAISE EXCEPTION 'M4_TREE_CYCLE';END IF;
 SELECT * INTO s FROM information.definition_snapshots WHERE id=NEW.current_snapshot_id;
 IF s.kind IS DISTINCT FROM 'financial_object_config' OR s.definition_id IS DISTINCT FROM NEW.id OR s.definition_version IS DISTINCT FROM NEW.config_version::text OR s.payload->>'schema_version' IS DISTINCT FROM '1' THEN RAISE EXCEPTION 'M4_SNAPSHOT_MISMATCH';END IF;
 IF (SELECT count(*) FROM jsonb_object_keys(s.payload))<>3 OR (SELECT count(*) FROM jsonb_object_keys(s.payload->'config'))<>18 OR (SELECT count(*) FROM jsonb_object_keys(s.payload->'change'))<>4 OR NOT(s.payload ?& ARRAY['schema_version','config','change']) OR NOT(s.payload->'change' ?& ARRAY['action','reason','previous_snapshot_id','actor']) THEN RAISE EXCEPTION 'M4_SNAPSHOT_MISMATCH';END IF;
 SELECT * INTO r FROM jsonb_populate_record(NULL::information.financial_object_config,s.payload->'config');
 IF (to_jsonb(r)-'current_snapshot_id') IS DISTINCT FROM (to_jsonb(NEW)-'current_snapshot_id') OR
 s.digest<>encode(sha256(convert_to(information.m4_canonical(s.payload),'UTF8')),'hex') THEN RAISE EXCEPTION 'M4_SNAPSHOT_MISMATCH';END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER m4_config_guard AFTER INSERT OR UPDATE OR DELETE ON information.financial_object_config DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION information.m4_config_guard();
CREATE FUNCTION information.m4_adoption_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c information.financial_object_config;s information.definition_snapshots;t information.definition_snapshots;
BEGIN
 SELECT * INTO c FROM information.financial_object_config WHERE id=NEW.config_id;
 IF c.entry_kind IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'M4_OBJECT_REQUIRED';END IF;
 IF TG_TABLE_NAME='shared_observation' THEN
  SELECT * INTO s FROM information.definition_snapshots WHERE id=NEW.adopted_snapshot_id;
  IF NEW.state='active' AND (NEW.adopted_identity_version<>c.identity_version OR EXISTS(WITH RECURSIVE ancestors AS(SELECT id,parent_id,status FROM information.financial_object_config WHERE id=c.id UNION SELECT p.id,p.parent_id,p.status FROM information.financial_object_config p JOIN ancestors a ON p.id=a.parent_id) SELECT 1 FROM ancestors WHERE status<>'active')) THEN RAISE EXCEPTION 'M4_CONFIG_UNAVAILABLE';END IF;
  IF TG_OP='UPDATE' AND (NEW.config_id<>OLD.config_id OR NEW.version<>OLD.version+1 OR NEW.created_by<>OLD.created_by OR NEW.created_at<>OLD.created_at) THEN RAISE EXCEPTION 'M4_VERSION_INVALID';END IF;
  IF s.kind IS DISTINCT FROM 'financial_object_config' OR s.definition_id IS DISTINCT FROM NEW.config_id OR (s.payload->'config'->>'identity_version')::bigint IS DISTINCT FROM NEW.adopted_identity_version THEN RAISE EXCEPTION 'M4_ADOPTION_MISMATCH';END IF;
 ELSE
  SELECT * INTO s FROM information.definition_snapshots WHERE id=NEW.config_snapshot_id;
  SELECT * INTO t FROM information.definition_snapshots WHERE id=NEW.target_snapshot_id;
  IF NEW.state='approved' AND (NEW.config_identity_version<>c.identity_version OR c.status='draft' OR NOT EXISTS(SELECT 1 FROM information.target WHERE id=NEW.target_id AND is_active AND definition_version::text=NEW.target_version)) THEN RAISE EXCEPTION 'M4_MAPPING_BASIS_INVALID';END IF;
  IF s.kind IS DISTINCT FROM 'financial_object_config' OR s.definition_id IS DISTINCT FROM NEW.config_id OR (s.payload->'config'->>'identity_version')::bigint IS DISTINCT FROM NEW.config_identity_version OR t.kind IS DISTINCT FROM 'target' OR t.definition_id IS DISTINCT FROM NEW.target_id OR t.definition_version IS DISTINCT FROM NEW.target_version OR t.digest<>encode(sha256(convert_to(information.m4_canonical(t.payload),'UTF8')),'hex') THEN RAISE EXCEPTION 'M4_MAPPING_SNAPSHOT_MISMATCH';END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER m4_observation_guard AFTER INSERT OR UPDATE ON information.shared_observation DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION information.m4_adoption_guard();
CREATE CONSTRAINT TRIGGER m4_mapping_guard AFTER INSERT OR UPDATE ON information.target_config_mapping DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION information.m4_adoption_guard();

-- API 无直接 DML；事务取得同一锁序后通过此窄入口提交已经核对的业务变化。
CREATE FUNCTION platform.m4_lock(p_actor text,p_permission text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,platform,information AS $$
BEGIN
 PERFORM platform.lock_permission_epoch();
 IF p_permission NOT IN ('financial_config_manage','observation_manage','target_mapping_review') OR NOT platform.authorize_actor(p_actor,'read',NULL) OR NOT platform.authorize_actor(p_actor,p_permission,NULL) THEN RAISE EXCEPTION 'M4_FORBIDDEN';END IF;
 LOCK TABLE information.financial_object_config IN SHARE ROW EXCLUSIVE MODE;
END $$;
CREATE FUNCTION platform.m4_persist(p_actor text,p_kind text,p_bundle jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,platform,information AS $$
DECLARE c information.financial_object_config;old_c information.financial_object_config;
 o information.shared_observation;old_o information.shared_observation;m information.target_config_mapping;old_m information.target_config_mapping;
 t information.target;v jsonb;permission text;why text;semantic boolean:=false;before_value jsonb;
 expected_ids uuid[];provided_ids uuid[];new_mapping jsonb;
BEGIN
 permission:=CASE p_kind WHEN 'config' THEN 'financial_config_manage' WHEN 'observation' THEN 'observation_manage' WHEN 'mapping' THEN 'target_mapping_review' END;
 why:=btrim(p_bundle->>'reason');
 IF permission IS NULL OR why IS NULL OR char_length(why) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'M4_COMMAND_INVALID';END IF;
 PERFORM platform.m4_lock(p_actor,permission);
 IF p_kind='config' THEN
  IF NOT(p_bundle ? 'config') OR jsonb_array_length(coalesce(p_bundle->'snapshots','[]'))<>1 THEN RAISE EXCEPTION 'M4_COMMAND_INVALID';END IF;
  SELECT * INTO c FROM jsonb_populate_record(NULL::information.financial_object_config,p_bundle->'config');
  SELECT * INTO old_c FROM information.financial_object_config WHERE id=c.id;
  IF c.updated_by IS DISTINCT FROM p_actor THEN RAISE EXCEPTION 'M4_ACTOR_INVALID';END IF;
  IF old_c.id IS NULL THEN
   IF c.created_by IS DISTINCT FROM p_actor OR c.config_version<>1 OR c.identity_version<>1 THEN RAISE EXCEPTION 'M4_VERSION_INVALID';END IF;
  ELSE
   semantic:=c.entry_kind='object' AND (c.scope_definition,c.jurisdiction_mode,c.jurisdiction,c.categories) IS DISTINCT FROM (old_c.scope_definition,old_c.jurisdiction_mode,old_c.jurisdiction,old_c.categories);
   IF c.config_version<>old_c.config_version+1 OR c.identity_version<>old_c.identity_version+(CASE WHEN semantic THEN 1 ELSE 0 END) OR c.entry_kind<>old_c.entry_kind OR c.created_by<>old_c.created_by OR c.created_at<>old_c.created_at THEN RAISE EXCEPTION 'M4_VERSION_INVALID';END IF;
   IF c.entry_kind='object' AND (semantic OR c.name<>old_c.name) AND (p_bundle->>'same_identity') IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'M4_NEW_IDENTITY_REQUIRED';END IF;
  END IF;
 ELSIF p_kind='observation' THEN
  IF p_bundle ? 'config' OR jsonb_array_length(coalesce(p_bundle->'snapshots','[]'))<>0 OR jsonb_array_length(coalesce(p_bundle->'mappings','[]'))<>0 OR jsonb_array_length(coalesce(p_bundle->'observations','[]'))<>1 THEN RAISE EXCEPTION 'M4_COMMAND_INVALID';END IF;
 ELSE
  IF p_bundle ? 'config' OR jsonb_array_length(coalesce(p_bundle->'observations','[]'))<>0 OR jsonb_array_length(coalesce(p_bundle->'mappings','[]'))=0 THEN RAISE EXCEPTION 'M4_COMMAND_INVALID';END IF;
  SELECT value INTO new_mapping FROM jsonb_array_elements(p_bundle->'mappings') WHERE NOT EXISTS(SELECT 1 FROM information.target_config_mapping WHERE id=(value->>'id')::uuid) LIMIT 1;
  IF (SELECT count(*) FROM jsonb_array_elements(p_bundle->'mappings') WHERE NOT EXISTS(SELECT 1 FROM information.target_config_mapping WHERE id=(value->>'id')::uuid))>1 THEN RAISE EXCEPTION 'M4_COMMAND_INVALID';END IF;
 END IF;
 FOR v IN SELECT * FROM jsonb_array_elements(coalesce(p_bundle->'snapshots','[]')) LOOP
  IF v->>'kind' NOT IN ('financial_object_config','target') OR p_kind='observation' OR (p_kind='config' AND v->>'kind'<>'financial_object_config') OR (p_kind='mapping' AND v->>'kind'<>'target') OR v->>'digest' IS DISTINCT FROM encode(sha256(convert_to(information.m4_canonical(v->'payload'),'UTF8')),'hex') THEN RAISE EXCEPTION 'M4_SNAPSHOT_INVALID';END IF;
  IF p_kind='config' AND ((v->>'id')::uuid<>c.current_snapshot_id OR (v->>'definition_id')::uuid<>c.id OR v->>'definition_version'<>c.config_version::text OR v->'payload'->'change'->>'reason' IS DISTINCT FROM why OR v->'payload'->'change'->>'actor' IS DISTINCT FROM p_actor OR (v->'payload'->'change'->>'previous_snapshot_id')::uuid IS DISTINCT FROM old_c.current_snapshot_id) THEN RAISE EXCEPTION 'M4_SNAPSHOT_INVALID';END IF;
  IF p_kind='mapping' THEN
   SELECT * INTO t FROM information.target WHERE id=(v->>'definition_id')::uuid FOR SHARE;
   IF t.id IS NULL OR v->>'definition_version'<>t.definition_version::text OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_bundle->'mappings') candidate(payload) WHERE candidate.payload->>'target_snapshot_id'=v->>'id') THEN RAISE EXCEPTION 'M4_SNAPSHOT_INVALID';END IF;
   IF (to_jsonb(jsonb_populate_record(NULL::information.target,v->'payload'))-ARRAY['created_at','updated_at']) IS DISTINCT FROM (to_jsonb(t)-ARRAY['created_at','updated_at']) THEN RAISE EXCEPTION 'M4_SNAPSHOT_INVALID';END IF;
  END IF;
  INSERT INTO information.definition_snapshots SELECT * FROM jsonb_populate_record(NULL::information.definition_snapshots,v);
 END LOOP;
 IF p_kind='config' THEN
  IF old_c.id IS NULL THEN INSERT INTO information.financial_object_config SELECT c.*;
  ELSE UPDATE information.financial_object_config SET parent_id=c.parent_id,name=c.name,sort_order=c.sort_order,aliases=c.aliases,categories=c.categories,category_version=c.category_version,jurisdiction_mode=c.jurisdiction_mode,jurisdiction=c.jurisdiction,scope_definition=c.scope_definition,status=c.status,config_version=c.config_version,identity_version=c.identity_version,current_snapshot_id=c.current_snapshot_id,updated_by=c.updated_by,updated_at=c.updated_at WHERE id=c.id;END IF;
  SELECT coalesce(array_agg(id ORDER BY id),'{}') INTO expected_ids FROM information.shared_observation obs WHERE state='active' AND (semantic AND config_id=c.id OR EXISTS(WITH RECURSIVE ancestors AS(SELECT id,parent_id,status FROM information.financial_object_config WHERE id=obs.config_id UNION SELECT p.id,p.parent_id,p.status FROM information.financial_object_config p JOIN ancestors a ON p.id=a.parent_id) SELECT 1 FROM ancestors WHERE status<>'active'));
  SELECT coalesce(array_agg((value->>'id')::uuid ORDER BY (value->>'id')::uuid),'{}') INTO provided_ids FROM jsonb_array_elements(coalesce(p_bundle->'observations','[]'));
  IF expected_ids<>provided_ids THEN RAISE EXCEPTION 'M4_IMPACT_MISMATCH';END IF;
  SELECT coalesce(array_agg(id ORDER BY id),'{}') INTO expected_ids FROM information.target_config_mapping WHERE state='approved' AND config_id=c.id AND semantic;
  SELECT coalesce(array_agg((value->>'id')::uuid ORDER BY (value->>'id')::uuid),'{}') INTO provided_ids FROM jsonb_array_elements(coalesce(p_bundle->'mappings','[]'));
  IF expected_ids<>provided_ids THEN RAISE EXCEPTION 'M4_IMPACT_MISMATCH';END IF;
  INSERT INTO platform.audit_log(actor,action,owner_id,detail) VALUES(p_actor,'m4-controlled-config',c.id,jsonb_build_object('reason',why,'before',to_jsonb(old_c),'after',to_jsonb(c)));
 END IF;
 FOR v IN SELECT * FROM jsonb_array_elements(coalesce(p_bundle->'observations','[]')) LOOP
  SELECT * INTO o FROM jsonb_populate_record(NULL::information.shared_observation,v);
  SELECT * INTO old_o FROM information.shared_observation WHERE id=o.id;
  IF o.updated_by IS DISTINCT FROM p_actor OR o.updated_at IS NULL THEN RAISE EXCEPTION 'M4_ACTOR_INVALID';END IF;
  IF old_o.id IS NULL THEN
   IF p_kind<>'observation' OR o.created_by IS DISTINCT FROM p_actor OR o.version<>1 OR o.state<>'active' OR o.state_reason<>'manual' THEN RAISE EXCEPTION 'M4_STATE_INVALID';END IF;
  ELSE
   IF o.version<>old_o.version+1 OR o.config_id<>old_o.config_id OR o.created_by<>old_o.created_by OR o.created_at<>old_o.created_at THEN RAISE EXCEPTION 'M4_VERSION_INVALID';END IF;
   IF p_kind='config' THEN
    IF old_o.state<>'active' OR o.state<>'paused' OR o.state_reason<>(CASE WHEN semantic AND o.config_id=c.id THEN 'definition_changed' ELSE 'config_unavailable' END) OR (to_jsonb(o)-ARRAY['state','state_reason','version','updated_by','updated_at']) IS DISTINCT FROM (to_jsonb(old_o)-ARRAY['state','state_reason','version','updated_by','updated_at']) THEN RAISE EXCEPTION 'M4_IMPACT_MISMATCH';END IF;
   ELSIF o.state=old_o.state THEN
    IF o.note=old_o.note OR (to_jsonb(o)-ARRAY['note','version','updated_by','updated_at']) IS DISTINCT FROM (to_jsonb(old_o)-ARRAY['note','version','updated_by','updated_at']) THEN RAISE EXCEPTION 'M4_STATE_INVALID';END IF;
   ELSE
    IF o.note<>old_o.note OR o.state_reason<>'manual' OR NOT(old_o.state='active' AND o.state IN ('paused','ended') OR old_o.state='paused' AND o.state IN ('active','ended') OR old_o.state='ended' AND o.state='active') THEN RAISE EXCEPTION 'M4_STATE_INVALID';END IF;
    IF o.state<>'active' AND (o.adopted_snapshot_id<>old_o.adopted_snapshot_id OR o.adopted_identity_version<>old_o.adopted_identity_version) THEN RAISE EXCEPTION 'M4_ADOPTION_MISMATCH';END IF;
   END IF;
  END IF;
  IF o.state='active' AND (old_o.id IS NULL OR old_o.state<>'active') AND NOT EXISTS(SELECT 1 FROM information.financial_object_config WHERE id=o.config_id AND entry_kind='object' AND current_snapshot_id=o.adopted_snapshot_id AND identity_version=o.adopted_identity_version) THEN RAISE EXCEPTION 'M4_ADOPTION_MISMATCH';END IF;
  IF old_o.id IS NULL THEN INSERT INTO information.shared_observation SELECT o.*;
  ELSE UPDATE information.shared_observation SET adopted_snapshot_id=o.adopted_snapshot_id,adopted_identity_version=o.adopted_identity_version,state=o.state,state_reason=o.state_reason,note=o.note,version=o.version,updated_by=o.updated_by,updated_at=o.updated_at WHERE id=o.id;END IF;
  INSERT INTO information.m4_history(id,entity_kind,observation_id,actor,action,reason,before_value,after_value) VALUES(gen_random_uuid(),'observation',o.id,p_actor,CASE WHEN p_kind='config' THEN 'config-pause' WHEN old_o.id IS NULL THEN 'add' WHEN old_o.state=o.state THEN 'note' ELSE o.state END,why,CASE WHEN old_o.id IS NULL THEN NULL ELSE information.m4_json_versions(to_jsonb(old_o)) END,information.m4_json_versions(to_jsonb(o)));
  INSERT INTO platform.audit_log(actor,action,owner_id,detail) VALUES(p_actor,'m4-controlled-observation',o.id,jsonb_build_object('reason',why,'before',to_jsonb(old_o),'after',to_jsonb(o)));
 END LOOP;
 FOR v IN SELECT * FROM jsonb_array_elements(coalesce(p_bundle->'mappings','[]')) LOOP
  SELECT * INTO m FROM jsonb_populate_record(NULL::information.target_config_mapping,v);
  SELECT * INTO old_m FROM information.target_config_mapping WHERE id=m.id;
  IF m.reviewed_by IS DISTINCT FROM p_actor OR m.reason IS DISTINCT FROM why THEN RAISE EXCEPTION 'M4_ACTOR_INVALID';END IF;
  IF old_m.id IS NULL THEN
   IF p_kind<>'mapping' OR m.version<>1 OR m.state NOT IN ('approved','conflict') THEN RAISE EXCEPTION 'M4_STATE_INVALID';END IF;
   SELECT * INTO t FROM information.target WHERE id=m.target_id FOR SHARE;
   SELECT * INTO c FROM information.financial_object_config WHERE id=m.config_id;
   IF c.entry_kind<>'object' OR c.status='draft' OR c.current_snapshot_id<>m.config_snapshot_id OR c.identity_version<>m.config_identity_version OR t.definition_version::text<>m.target_version THEN RAISE EXCEPTION 'M4_MAPPING_BASIS_INVALID';END IF;
   IF m.state='approved' AND ((p_bundle->>'identity_confirmed') IS DISTINCT FROM 'true' OR NOT t.is_active OR c.jurisdiction_mode='unknown' OR c.jurisdiction IS DISTINCT FROM t.jurisdiction) THEN RAISE EXCEPTION 'M4_IDENTITY_UNCONFIRMED';END IF;
  ELSE
   IF m.version<>old_m.version+1 OR (to_jsonb(m)-ARRAY['state','reason','version','reviewed_by','reviewed_at']) IS DISTINCT FROM (to_jsonb(old_m)-ARRAY['state','reason','version','reviewed_by','reviewed_at']) THEN RAISE EXCEPTION 'M4_VERSION_INVALID';END IF;
   IF p_kind='config' AND (old_m.state<>'approved' OR m.state<>'pending' OR NOT semantic OR m.config_id<>c.id) THEN RAISE EXCEPTION 'M4_IMPACT_MISMATCH';END IF;
   IF p_kind='mapping' THEN
    IF m.state='pending' THEN
     IF old_m.state<>'approved' OR NOT(EXISTS(SELECT 1 FROM information.target live_target JOIN information.financial_object_config live_config ON live_config.id=m.config_id WHERE live_target.id=m.target_id AND (NOT live_target.is_active OR live_target.definition_version::text<>m.target_version OR live_config.identity_version<>m.config_identity_version)) OR coalesce(new_mapping->>'state'='conflict' AND (new_mapping->>'config_id'=m.config_id::text OR new_mapping->>'target_id'=m.target_id::text),false)) THEN RAISE EXCEPTION 'M4_MAPPING_BASIS_INVALID';END IF;
    ELSIF m.state<>'revoked' OR old_m.state='revoked' THEN RAISE EXCEPTION 'M4_STATE_INVALID';END IF;
   END IF;
  END IF;
  IF old_m.id IS NULL THEN INSERT INTO information.target_config_mapping SELECT m.*;
  ELSE UPDATE information.target_config_mapping SET state=m.state,reason=m.reason,version=m.version,reviewed_by=m.reviewed_by,reviewed_at=m.reviewed_at WHERE id=m.id;END IF;
  INSERT INTO information.m4_history(id,entity_kind,mapping_id,actor,action,reason,before_value,after_value) VALUES(gen_random_uuid(),'mapping',m.id,p_actor,m.state,why,CASE WHEN old_m.id IS NULL THEN NULL ELSE information.m4_json_versions(to_jsonb(old_m)) END,information.m4_json_versions(to_jsonb(m)));
  INSERT INTO platform.audit_log(actor,action,owner_id,detail) VALUES(p_actor,'m4-controlled-mapping',m.id,jsonb_build_object('reason',why,'before',to_jsonb(old_m),'after',to_jsonb(m)));
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION platform.m4_lock(text,text),platform.m4_persist(text,text,jsonb) FROM PUBLIC;
INSERT INTO platform.schema_versions(version) VALUES(10);
