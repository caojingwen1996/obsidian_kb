import test from 'node:test';
import assert from 'node:assert/strict';
import {currentFactExtractionSchema,mapFactToEvent} from '../event-management/current-contracts.js';
import {Ajv2020} from 'ajv/dist/2020.js';
import {currentInputDigest,isCurrentReference} from '../event-management/current-model.js';
test('新抽取包要求object，映射不扩写行动/日期',()=>{const schema=currentFactExtractionSchema() as any;const candidate=schema.properties.candidates.items;assert.ok(candidate.required.includes('object'));assert.equal(candidate.additionalProperties,false);assert.ok(new Ajv2020({strict:false}).compile(schema));assert.deepEqual(mapFactToEvent({title:'发行',description:'发行债券',subject:null,action:'发行',object:null,event_status:'announced',event_time:null}),{title:'发行',description:'发行债券',subject:null,action:'发行',object:null,event_status:'announced',event_time:null});});
test('v2引用辨识，多来源集合改变摘要且不保存正文',()=>{assert.equal(isCurrentReference({schema_version:'riskhot.model-reference.v2'}),true);const input:any={material_ref:{material_id:'a',version:1,content_digest:'a'},material:{normalizerVersion:'v',segments:[]},manifest:{},context:{},material_refs:[{material_id:'a',version:1,content_digest:'a'}]};const before=currentInputDigest(input);input.material_refs.push({material_id:'b',version:1,content_digest:'b'});assert.notEqual(before,currentInputDigest(input));});
