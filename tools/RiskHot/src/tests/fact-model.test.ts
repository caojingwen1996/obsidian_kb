import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {eventFixture,preparedCandidate} from './event-fixture.js';import {transaction} from '../platform/db.js';import {addFactEvidence} from '../event-management/facts.js';
import {EventQueries} from '../event-management/queries.js';
test('Fact与资料多对多，证据版本错误拒绝；同Fact不能归入两个Event',async()=>{const f=await eventFixture();try{
 await f.service.acceptExtraction(f.full.id,1,{candidates:[f.candidate,{...f.candidate,local_key:'other',title:'另一项措施',action:'实施'}],warnings:[]});assert.equal((await f.db.query('SELECT count(*) FROM information.fact')).rows[0].count,'2');
 const c=await preparedCandidate(f),r=await c.commit.commitCandidate(c.id,c.generation,c.key),fid=String(r.effects[0]!.fact_id),eid=String(r.effects[0]!.event_id);
 await assert.rejects(transaction(f.db,async tx=>{const id=randomUUID();await tx.query('INSERT INTO information.event SELECT $1,title,description,subject,action,event_status,event_time,created_at,updated_at FROM information.event WHERE id=$2',[id,eid]);await tx.query("INSERT INTO information.event_fact(event_id,fact_id,relation_role,relation_note) VALUES($1,$2,'initial','错误双归属')",[id,fid]);}),{code:'23505'});
 await assert.rejects(transaction(f.db,tx=>addFactEvidence(tx,fid,[{...f.candidate.evidence_refs[0]!,information_version_id:randomUUID()}])),/EVIDENCE_MISMATCH/);
 await assert.rejects(transaction(f.db,tx=>addFactEvidence(tx,fid,[{...f.candidate.evidence_refs[0]!,start_cp:0,end_cp:999,quote:f.old.material.segments[0]!.text}])),/EVIDENCE_MISMATCH/);
 await f.db.query("UPDATE platform.actors SET permissions=permissions||ARRAY['submit'] WHERE subject='review-operator'");
 const source=(await f.db.query("INSERT INTO m1.sources(catalog_key,name,url,metadata,state) VALUES('restricted','受限来源','https://example.invalid','{}','ACTIVE') RETURNING id")).rows[0].id;
 const mid=(await f.db.query("INSERT INTO information.materials(source_id,identity) VALUES($1,'test-copy') RETURNING id",[source])).rows[0].id;
 const old=(await f.db.query('SELECT * FROM information.material_versions WHERE id=$1',[f.old.version])).rows[0];
 // Clone the stored material under a distinct source, retaining real version and segment constraints.
 const version=randomUUID();const keys=Object.keys(old),values=keys.map(k=>k==='id'?version:k==='material_id'?mid:old[k]);
 await f.db.query(`INSERT INTO information.material_versions(${keys.join(',')}) VALUES(${keys.map((_,i)=>'$'+(i+1)).join(',')})`,values);
 const segment=(await f.db.query('SELECT * FROM information.material_segments WHERE version_id=$1 LIMIT 1',[f.old.version])).rows[0],sid=randomUUID(),sk=Object.keys(segment);
 await f.db.query(`INSERT INTO information.material_segments(${sk.join(',')}) VALUES(${sk.map((_,i)=>'$'+(i+1)).join(',')})`,sk.map(k=>k==='id'?sid:k==='version_id'?version:segment[k]));
 await transaction(f.db,tx=>addFactEvidence(tx,fid,[{...f.candidate.evidence_refs[0]!,information_version_id:version,segment_id:sid}]));assert.equal((await f.db.query('SELECT count(*) FROM information.fact_information WHERE fact_id=$1',[fid])).rows[0].count,'2');
 await assert.rejects(new EventQueries(f.repo).event(eid,'review-operator'),/FORBIDDEN/);await assert.rejects(new EventQueries(f.repo).fact(fid,'review-operator'),/FORBIDDEN/);
 }finally{await f.dispose();}});
test('原文位置、孤立事件与删除最后事实均由约束阻断',async()=>{const f=await eventFixture();try{
 await assert.rejects(f.db.query("INSERT INTO information.event(title,description,subject,action,event_status) VALUES('无依据','无依据','机构','行动','unknown')"),/EVENT_FACT_REQUIRED/);
 await f.service.acceptExtraction(f.full.id,1,{candidates:[f.candidate],warnings:[]});const c=await preparedCandidate(f),r=await c.commit.commitCandidate(c.id,c.generation,c.key);
 await assert.rejects(f.db.query('DELETE FROM information.event_fact WHERE event_id=$1',[r.effects[0]!.event_id]),/foreign key|EVENT_FACT_REQUIRED/);
 const columns=(await f.db.query("SELECT column_name FROM information_schema.columns WHERE table_schema='information' AND table_name='event' ORDER BY ordinal_position")).rows.map(r=>r.column_name);assert.deepEqual(columns,['id','title','description','subject','action','event_status','event_time','created_at','updated_at']);
 }finally{await f.dispose();}});
