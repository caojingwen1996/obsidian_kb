import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ArtifactStore} from '../platform/artifacts.js';
import {reserveCurrentModel,readCurrentInput,currentInputDigest,type CurrentModelReference} from '../event-management/current-model.js';
import {Pool} from 'pg';
import {applyF02Migration} from '../platform/f02-migration.js';
import {Repository} from '../information-ingestion/processing/repository.js';
import {transaction} from '../platform/db.js';
import {prepareTargetRecognition,acceptTargetRecognition} from '../event-management/target-recognition.js';
import type {RecognitionOutput} from '../event-management/target-recognition-contracts.js';
test('AI08多来源重核权限/版本、语境新证据受控接纳且重投幂等', {skip:!process.env.ADMIN_DATABASE_URL},async()=>{
 const admin=new Pool({connectionString:process.env.ADMIN_DATABASE_URL}),name=`riskhot_ai08_${randomUUID().replaceAll('-','')}`;await admin.query(`CREATE DATABASE ${name}`);const url=new URL(process.env.ADMIN_DATABASE_URL!);url.pathname=`/${name}`;const db=new Pool({connectionString:url.href}),folder=await mkdtemp(join(tmpdir(),'riskhot-ai08-'));
 try{
  await db.query(await readFile('src/db/005-ingestion.sql','utf8'));await applyF02Migration(db);
  await db.query("INSERT INTO platform.actors VALUES('reader',ARRAY['read','event_submit','submit'],ARRAY['*'])");
  const materials:any[]=[];for(const n of [1,2]){const sid=(await db.query("INSERT INTO m1.sources(catalog_key,name,url,metadata,state) VALUES($1,'测试','','{}','ACTIVE') RETURNING id",[`source-${n}`])).rows[0].id;const segments=[{id:randomUUID(),text:'主体发行债券',kind:'paragraph',rawLocator:'1'},{id:randomUUID(),text:'债券为七年期',kind:'paragraph',rawLocator:'2'}];const m=(await db.query("INSERT INTO infomation.ingestion_material(source_id,identity,content,content_digest,normalizer_rule) VALUES($1,'test',$2,repeat($3,64),'v1') RETURNING *",[sid,{title:'测试',segments,normalizerVersion:'v1'},String(n)])).rows[0];for(const [i,s] of segments.entries())await db.query('INSERT INTO infomation.ingestion_material_segments VALUES($1,$2,$3,$4,$5)',[m.id,s.id,i,s.text,{}]);materials.push(m);}
  const f=await transaction(db,async tx=>{const f=(await tx.query("INSERT INTO information.fact(title,description,subject,action,object,event_status) VALUES('发行','主体发行债券','主体','发行','债券','announced') RETURNING id")).rows[0].id;for(const m of materials){await tx.query("INSERT INTO information.fact_material(fact_id,material_id,relation_role) VALUES($1,$2,'supporting')",[f,m.id]);const s=m.content.segments[0];await tx.query("INSERT INTO information.fact_evidence(fact_id,information_id,material_id,material_version,material_digest,segment_id,start_cp,end_cp,quote,evidence_role) VALUES($1,$2,$2,1,$3,$4,0,6,$5,'supporting')",[f,m.id,m.content_digest,s.id,s.text]);}return f;});
  const repo=new Repository(db,new ArtifactStore(folder)),input=await prepareTargetRecognition(repo,'reader',f,'test');assert.equal(input.contexts.length,2);
  const e=input.evidence_catalog.find(e=>e.quote==='债券为七年期')!;
  const output:RecognitionOutput={schema_version:'riskhot.target-recognition.output.v1',fact_id:f,fact_digest:input.fact_digest,candidates:[{candidate_ref:'seven',raw_name:'七年期债券',suggested_name:null,identity_attributes:[],jurisdiction:null,scope_definition:null,categories:[],observation_meaning:'期限',action_relation:'发行对象',clue_refs:[],fact_fields:['object'],evidence_refs:[e.evidence_ref],gaps:['分类未知']}],clue_results:input.clues.map(c=>({clue_ref:c.clue_ref,status:'excluded',candidate_refs:[],reason:'语境识别对象',evidence_refs:[]})),unresolved:[],coverage:{context_reviewed:true,complete:true,uncovered_refs:[],reason:'完整'}};
  const before=Number((await db.query('SELECT count(*) n FROM information.fact_evidence')).rows[0].n);
  assert.equal((await transaction(db,tx=>acceptTargetRecognition(repo,'reader',input,output,{tx,runIdentity:'run'}))).status,'review');
  const accept=()=>transaction(db,tx=>acceptTargetRecognition(repo,'reader',input,output,{tx,runIdentity:'run',semanticEvidenceRefs:[e.evidence_ref]}));const one=await accept(),two=await accept();assert.deepEqual(one.objects,two.objects);assert.equal(Number((await db.query('SELECT count(*) n FROM information.fact_evidence')).rows[0].n),before+1);
  const modelInput={version_id:materials[0].id,material_ref:input.material_refs.find(m=>m.material_id===materials[0].id)!,material_refs:input.material_refs,material:materials[0].content,manifest:{provider:{protocol:'codex-exec',endpoint:'codex://local',model:'test'},prompt:'test',task_id:'AI-08'},context:input};
  const attempt=await reserveCurrentModel(repo,'reader',modelInput.material_ref,'material',materials[0].id,1,modelInput,'one');
  const saved=(await db.query('SELECT request_artifact_id FROM platform.model_attempts WHERE id=$1',[attempt.id])).rows[0];const reference=await repo.json<CurrentModelReference>(saved.request_artifact_id);assert.equal(reference.schema_version,'riskhot.model-reference.v2');assert.equal((reference.context as any).contexts,undefined);assert.equal(currentInputDigest(await readCurrentInput(repo,reference)),currentInputDigest(modelInput));
  await db.query("UPDATE platform.model_attempts SET status='calling' WHERE id=$1",[attempt.id]);assert.equal(currentInputDigest(await readCurrentInput(repo,reference,attempt.id)),currentInputDigest(modelInput));
  assert.equal((await reserveCurrentModel(repo,'reader',modelInput.material_ref,'material',materials[0].id,1,modelInput,'one')).id,attempt.id);
  for(const key of ['two','three'])await reserveCurrentModel(repo,'reader',modelInput.material_ref,'material',materials[0].id,1,modelInput,key);
  await assert.rejects(()=>reserveCurrentModel(repo,'reader',modelInput.material_ref,'material',materials[0].id,1,modelInput,'four'),/MODEL_BUDGET_EXHAUSTED/);
  await db.query("UPDATE platform.actors SET source_keys=ARRAY['source-1'] WHERE subject='reader'");await assert.rejects(()=>accept(),/FORBIDDEN/);await db.query("UPDATE platform.actors SET source_keys=ARRAY['*'] WHERE subject='reader'");await db.query('UPDATE infomation.ingestion_material SET version=version+1 WHERE id=$1',[materials[1]!.id]);await assert.rejects(()=>accept(),/MATERIAL_BASIS_CHANGED|REFERENCE|EVIDENCE/);
 }finally{await db.end();await rm(folder,{recursive:true,force:true});await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);await admin.end();}
});
