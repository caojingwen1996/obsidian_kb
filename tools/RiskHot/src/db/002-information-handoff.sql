CREATE TABLE IF NOT EXISTS information.material_version_origins(
 version_id uuid PRIMARY KEY REFERENCES information.material_versions(id),
 source_id uuid NOT NULL, source_version integer NOT NULL,
 operation_id uuid NOT NULL REFERENCES information.operations(id),
 acquisition_id uuid NOT NULL REFERENCES information.acquisitions(id), collected_at timestamptz NOT NULL,
 previous_version_id uuid REFERENCES information.material_versions(id),
 version_kind text NOT NULL CHECK(version_kind IN ('initial','source_revision')),
 basis text NOT NULL CHECK(basis IN ('saved','legacy_matching_artifacts')),
 FOREIGN KEY(source_id,source_version) REFERENCES m1.source_versions(source_id,version)
);
CREATE TABLE IF NOT EXISTS information.material_deliveries(
 version_id uuid NOT NULL REFERENCES information.material_versions(id), consumer_id text NOT NULL DEFAULT 'F02' CHECK(consumer_id='F02'),
 message_id uuid NOT NULL UNIQUE REFERENCES platform.messages(id),
 payload_artifact_id uuid REFERENCES platform.artifact_objects(id), receipt_artifact_id uuid REFERENCES platform.artifact_objects(id),
 generation bigint NOT NULL DEFAULT 1, attempts integer NOT NULL DEFAULT 0, window_start_attempts integer NOT NULL DEFAULT 0,
 lease_token uuid, lease_until timestamptz, error_code text,
 files_generation bigint NOT NULL DEFAULT 1, files_attempts integer NOT NULL DEFAULT 0, files_window_start integer NOT NULL DEFAULT 0,
 files_state text NOT NULL DEFAULT 'pending' CHECK(files_state IN ('pending','ready','recoverable')),
 files_error_code text, files_next_attempt_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(version_id,consumer_id)
);
ALTER TABLE platform.inbox ADD COLUMN IF NOT EXISTS receipt jsonb;
ALTER TABLE information.material_deliveries ADD COLUMN IF NOT EXISTS files_lease_token uuid;
ALTER TABLE information.material_deliveries ADD COLUMN IF NOT EXISTS files_lease_until timestamptz;
ALTER TABLE information.processing_runs ADD COLUMN IF NOT EXISTS validated_result_artifact_id uuid REFERENCES platform.artifact_objects(id);
ALTER TABLE information.processing_runs ADD COLUMN IF NOT EXISTS result_artifact_id uuid REFERENCES platform.artifact_objects(id);
INSERT INTO information.material_version_origins(version_id,source_id,source_version,operation_id,acquisition_id,collected_at,previous_version_id,version_kind,basis)
 SELECT v.id,m.source_id,o.source_version,o.id,o.acquisition_id,o.acquired_at,prev.id,
 CASE WHEN v.version_no=1 THEN 'initial' ELSE 'source_revision' END,'legacy_matching_artifacts'
 FROM information.material_versions v JOIN information.materials m ON m.id=v.material_id
 JOIN LATERAL(
  SELECT op.id,op.source_version,a.id AS acquisition_id,a.acquired_at
  FROM information.operations op JOIN information.acquisitions a ON a.operation_id=op.id AND a.raw_artifact_id=v.raw_artifact_id
  WHERE op.version_id=v.id AND op.source_id=m.source_id AND op.raw_artifact_id=v.raw_artifact_id AND op.normalized_artifact_id=v.normalized_artifact_id
  ORDER BY op.created_at,op.id LIMIT 1
 ) o ON true
 LEFT JOIN information.material_versions prev ON prev.material_id=v.material_id AND prev.version_no=v.version_no-1
 WHERE v.version_no=1 OR prev.id IS NOT NULL
 ON CONFLICT(version_id) DO NOTHING;
INSERT INTO information.material_deliveries(version_id,message_id) SELECT version_id,id FROM platform.messages ON CONFLICT DO NOTHING;
INSERT INTO platform.schema_versions(version) VALUES(2) ON CONFLICT DO NOTHING;
