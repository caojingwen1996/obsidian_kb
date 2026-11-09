import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {digest,canonical} from '../event-management/contracts.js';
import {targetSnapshotPayload,validateTargetSnapshot} from '../event-management/target-snapshots.js';
import {prepared,directory,object} from './m4-fixture.js';
const t={id:randomUUID(),target_name:'美元',aliases:['USD'],categories:[{primary_category:'货币与货币形态',secondary_category:'货币单位'}],jurisdiction:'美国',scope_definition:'美元货币单位，不含融资市场',is_active:true,definition_version:1,created_at:new Date('2026-11-05T00:00:00Z'),updated_at:new Date('2026-11-05T00:00:00Z')};
test('Target快照兼容既有plain与扩展形状，仍拒绝错误内容、版本及摘要',()=>{
 for(const payload of [JSON.parse(canonical(t)),targetSnapshotPayload(t)])assert.doesNotThrow(()=>validateTargetSnapshot({kind:'target',definition_id:t.id,definition_version:'1',payload,digest:digest(payload)},t));
 for(const payload of [{...t,target_name:'错误同版本对象'},{...t,scope_definition:'美元融资市场'},{...t,definition_version:2},{...targetSnapshotPayload(t),status:'disabled'}])assert.throws(()=>validateTargetSnapshot({payload,digest:digest(payload)},t),/DEFINITION_VERSION_CONFLICT/);
 assert.throws(()=>validateTargetSnapshot({payload:targetSnapshotPayload(t),digest:'wrong'},t),/DEFINITION_VERSION_CONFLICT/);
});
test('映射复用已有合法plain快照，错误同版本快照不能被批准',async()=>{const x=await prepared();try{
 const root=(await x.save(directory())).config,c=(await x.save(object(root.id))).config;
 const target=(await x.db.query('INSERT INTO information.target(target_name,aliases,categories,jurisdiction,scope_definition) VALUES($1,$2,$3,$4,$5) RETURNING *',[t.target_name,t.aliases,JSON.stringify(t.categories),t.jurisdiction,t.scope_definition])).rows[0];
 const snapshot=(await x.db.query("INSERT INTO information.definition_snapshots(kind,definition_id,definition_version,payload,digest) VALUES('target',$1,'1',$2,$3) RETURNING id",[target.id,JSON.parse(canonical(target)),digest(target)])).rows[0];
 const input={config_id:c.id,target_id:target.id,expected_config_version:'1',expected_target_version:'1',decision:'approve' as const,identity_confirmed:true,reason:'合法历史快照核对'};
 assert.equal((await x.service.map('operator',input,randomUUID())).mapping.target_snapshot_id,snapshot.id);
 const wrong=(await x.db.query('INSERT INTO information.target(target_name,aliases,categories,jurisdiction,scope_definition) VALUES($1,$2,$3,$4,$5) RETURNING *',['另一个事件对象',[],JSON.stringify(t.categories),t.jurisdiction,t.scope_definition])).rows[0],payload={...wrong,scope_definition:'错误同版本范围'};
 await x.db.query("INSERT INTO information.definition_snapshots(kind,definition_id,definition_version,payload,digest) VALUES('target',$1,'1',$2,$3)",[wrong.id,JSON.parse(canonical(payload)),digest(payload)]);
 await assert.rejects(()=>x.service.map('operator',{...input,target_id:wrong.id,decision:'conflict'},randomUUID()),/DEFINITION_VERSION_CONFLICT/);
}finally{await x.close();}});

test('关联动态按上海自然日过滤，拒绝不存在日期和反向范围',async()=>{const x=await prepared();try{
 const root=(await x.save(directory())).config,c=(await x.save(object(root.id))).config,o=(await x.service.add('operator',{config_id:c.id,expected_config_version:'1',reason:'日期过滤'},randomUUID())).observation;
 const target=(await x.db.query('INSERT INTO information.target(target_name,categories,jurisdiction,scope_definition) VALUES($1,$2,$3,$4) RETURNING *',['美元',JSON.stringify(t.categories),'美国',t.scope_definition])).rows[0];await x.db.query("INSERT INTO information.event_target(event_id,target_id,relation_note) VALUES($1,$2,'直接关联')",[x.e,target.id]);await x.service.map('operator',{config_id:c.id,target_id:target.id,expected_config_version:'1',expected_target_version:'1',decision:'approve',identity_confirmed:true,reason:'核定'},randomUUID());
 await x.db.query("UPDATE information.event SET updated_at='2026-11-04T16:00:00Z' WHERE id=$1",[x.e]);assert.equal((await x.service.observationDetail('operator',o.id,{from:'2026-11-05',to:'2026-11-05'})).events?.total,1);assert.equal((await x.service.observationDetail('operator',o.id,{from:'2026-11-04',to:'2026-11-04'})).events?.total,0);
 await x.db.query("UPDATE information.event SET updated_at='2026-11-05T16:00:00Z' WHERE id=$1",[x.e]);assert.equal((await x.service.observationDetail('operator',o.id,{from:'2026-11-05',to:'2026-11-05'})).events?.total,0);
 for(const q of [{from:'2026-02-30'},{from:'2026-11-06',to:'2026-11-05'}])await assert.rejects(()=>x.service.observationDetail('operator',o.id,q),/DATE_INVALID|DATE_RANGE_INVALID/);
}finally{await x.close();}});
