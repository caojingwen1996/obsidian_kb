-- schema5的增量扩展：不重建信源或清空任务；仅首次增加字段时回填旧分类。
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='m1' AND table_name='sources' AND column_name='financial_attributes') THEN
  ALTER TABLE m1.sources ADD COLUMN financial_attributes text[] NOT NULL DEFAULT '{}' CHECK(array_position(financial_attributes,NULL) IS NULL);
  UPDATE m1.sources SET financial_attributes=CASE jsonb_typeof(metadata->'dims')
   WHEN 'array' THEN ARRAY(SELECT btrim(item #>> '{}') FROM jsonb_array_elements(metadata->'dims') AS item WHERE jsonb_typeof(item)='string' AND btrim(item #>> '{}')<>'')
   WHEN 'string' THEN CASE WHEN btrim(metadata->>'dims')='' THEN '{}'::text[] ELSE ARRAY[btrim(metadata->>'dims')] END
   ELSE '{}'::text[] END;
 END IF;
END $$;
COMMENT ON COLUMN m1.sources.financial_attributes IS '金融属性，多值；常用钱的数量、钱的价格、钱的流向；空数组表示未分类。';
