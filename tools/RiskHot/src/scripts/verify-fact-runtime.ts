import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {database,required} from '../platform/db.js';
import {ArtifactStore} from '../platform/artifacts.js';
import {Repository} from '../information-ingestion/processing/repository.js';
import {EventDelivery} from '../event-management/delivery.js';
import {EventFiles,eventContentPath,messagePath} from '../event-management/files.js';
import {digest} from '../event-management/contracts.js';
import {requestHeaders} from './request-headers.js';

const db=database(),root=required('ARTIFACT_ROOT'),repo=new Repository(db,new ArtifactStore(root));
try{
 const headers=await requestHeaders(),origin=required('API_ORIGIN');
 const get=async(path:string)=>{const r=await fetch(origin+path,{headers,redirect:'error',signal:AbortSignal.timeout(15000)});assert.equal(r.status,200,`HTTP ${path}`);return Buffer.from(await r.arrayBuffer());};
 assert.equal(JSON.parse((await get('/health/ready')).toString()).ready,true);
 assert.equal((await db.query('SELECT 1 FROM platform.schema_versions WHERE version=4')).rowCount,1);
 const counts=(await db.query(`SELECT (SELECT count(*) FROM information.materials) AS information,
 (SELECT count(*) FROM information.material_versions) AS information_versions,(SELECT count(*) FROM information.event_candidates) AS candidates,
 (SELECT count(*) FROM information.candidate_fact) AS candidate_links,(SELECT count(*) FROM information.fact) AS facts,
 (SELECT count(*) FROM information.event) AS events,(SELECT count(*) FROM information.event_fact) AS event_facts`)).rows[0];
 assert.equal(counts.candidates,counts.candidate_links);
 for(const old of ['events','event_updates','event_revisions'])assert.equal((await db.query('SELECT to_regclass($1) AS value',['information.'+old])).rows[0].value,null);
 const delivery=new EventDelivery(repo),files=new EventFiles(repo),evidence=[];
 const messages=(await db.query("SELECT id,event_id FROM platform.messages WHERE message_type='event.facts.committed.v2' ORDER BY created_at,id")).rows;
 assert.ok(messages.length,'No real event delivery exists');
 for(const item of messages){
  const m=await delivery.message(item.id),current=JSON.parse((await get(`/api/v1/l0/events/${item.event_id}`)).toString());
  assert.equal(current.event.id,item.event_id);assert.ok(current.facts.length);
  const paths=[{path:eventContentPath(item.id),value:m.payload.content,url:`/api/v1/l0/event-deliveries/${item.id}/files/event`},{path:messagePath(item.id),value:delivery.envelope(m),url:`/api/v1/l0/event-deliveries/${item.id}/files/message`}];
  const applications=[];
  for(const row of (await db.query('SELECT consumer_id,receipt,status,files_state FROM platform.message_deliveries WHERE message_id=$1',[item.id])).rows){
   const application=await delivery.applicationView(item.id,row.consumer_id);assert.equal(application.application_status,'applied');assert.equal(row.status,'received');assert.equal(row.files_state,'ready');
   assert.equal(row.receipt.content_digest,digest(m.payload.content));applications.push({consumer:row.consumer_id,...application});
   paths.push({path:messagePath(item.id,row.consumer_id),value:row.receipt,url:`/api/v1/l0/event-deliveries/${item.id}/files/receipt?consumer_id=${encodeURIComponent(row.consumer_id)}`});
  }
  assert.ok(applications.length,'No downstream receipt exists');const outputs=[];
  for(const p of paths){const disk=await files.read(p.path,p.value),http=await get(p.url);assert.ok(disk.equals(http));outputs.push({path:join(root,p.path),sha256:createHash('sha256').update(disk).digest('hex'),size:disk.length});}
  const fid=current.facts[0].id;assert.equal(JSON.parse((await get(`/api/v1/l0/facts/${fid}`)).toString()).fact.id,fid);
  evidence.push({event_id:item.event_id,message_id:item.id,title:current.event.title,kind:m.payload.migration?'approved_event_migration':'new_commit',fact_ids:current.facts.map((f:{id:string})=>f.id),applications,files:outputs});
 }
 const pending=(await db.query("SELECT id,status,resume_step,reason_code FROM information.event_candidates WHERE reason_code='MODEL_CHANGED_REVIEW_REQUIRED' ORDER BY id")).rows;
 const report={verified:true,checked_at:new Date().toISOString(),schema:4,counts,events:evidence,pending_reviews:pending,note:'Existing approved real data migration and actual downstream file reads; this does not claim a new model run or new business approval.'};
 await mkdir('.riskhot/fact-runtime',{recursive:true});await writeFile('.riskhot/fact-runtime/report.json',JSON.stringify(report,null,2)+'\n',{mode:0o600});
 console.log(JSON.stringify({verified:true,counts,events:evidence.map(e=>({event_id:e.event_id,message_id:e.message_id})),pending_reviews:pending.length,report:resolve('.riskhot/fact-runtime/report.json')}));
}finally{await db.end();}
