import {targetSnapshotPayload,validateTargetSnapshot} from '../event-management/target-snapshots.js';
import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import type {Repository} from '../information-ingestion/processing/repository.js';
import {transaction} from '../platform/db.js';
import {DomainError} from '../platform/types.js';
import {canonical,digest} from '../event-management/contracts.js';
import {f02Storage} from '../event-management/storage-layout.js';
import {categoryVersion,targetCategories} from './categories.js';
import {normalize,values,selectable,reason,fail,uuid,version,page,paging,type Config,type ConfigInput,type ConfigValues,type Observation,type Mapping,type History,type Snapshot,type Bundle,type Query} from './contracts.js';
const increment=(v:string)=>String(BigInt(v)+1n);
const iso=(v:Date|string)=>new Date(v).toISOString();
const configPayload=(c:Config)=>{const {current_snapshot_id,...rest}=c;return {...rest,created_at:iso(c.created_at),updated_at:iso(c.updated_at)};};
const history=(actor:string,kind:'observation'|'mapping',action:string,why:string,before:Observation|Mapping|null,after:Observation|Mapping):History=>({id:randomUUID(),entity_kind:kind,observation_id:kind==='observation'?after.id:null,mapping_id:kind==='mapping'?after.id:null,actor,action,reason:why,before_value:before,after_value:after,created_at:new Date().toISOString()});
export interface ObservationInput {config_id:string;expected_config_version:string;note?:string;reason:string}
export interface ObservationChange {action:'pause'|'end'|'restore'|'note';expected_version:string;expected_config_version?:string;note?:string;reason:string}
export interface MappingInput {config_id:string;target_id:string;expected_config_version:string;expected_target_version:string;decision:'approve'|'conflict'|'revoke';identity_confirmed:boolean;reason:string;mapping_id?:string;expected_version?:string}
export class FinancialObjects {
 constructor(public repo:Repository){}
 private async access(tx:PoolClient,actor:string,permission?:string){await tx.query('SELECT platform.lock_permission_epoch()');await this.repo.authorize(actor,'read',undefined,tx);if(permission)await this.repo.authorize(actor,permission,undefined,tx);}
 private async lock(tx:PoolClient,actor:string,permission:string){await tx.query('SELECT platform.m4_lock($1,$2)',[actor,permission]);}
 private async all(tx:PoolClient){return (await tx.query<Config>('SELECT * FROM information.financial_object_config ORDER BY sort_order,id')).rows;}
 private async persist(tx:PoolClient,actor:string,kind:string,bundle:Bundle){await tx.query('SELECT platform.m4_persist($1,$2,$3)',[actor,kind,JSON.stringify(bundle)]);}
 private async audit(tx:PoolClient,actor:string,action:string,id:string,detail:unknown){await tx.query('INSERT INTO platform.audit_log(actor,action,owner_id,detail) VALUES($1,$2,$3,$4)',[actor,action,id,detail]);}
 private async controls(tx:PoolClient,actor:string){const out:Record<string,boolean>={};for(const p of ['financial_config_manage','observation_manage','target_mapping_review'])out[p]=Boolean((await tx.query('SELECT platform.authorize_actor($1,$2,NULL) allowed',[actor,p])).rows[0].allowed);return {permissions:out,category_catalog:targetCategories,category_version:categoryVersion};}
 private validateTree(id:string,config:ConfigValues,configs:Config[]){
  if(config.parent_id){const parent=configs.find(c=>c.id===config.parent_id);if(!parent||parent.entry_kind!=='directory')fail('M4_PARENT_INVALID');let p:Config|undefined=parent;const seen=new Set([id]);while(p){if(seen.has(p.id))fail('M4_TREE_CYCLE',409);seen.add(p.id);p=configs.find(c=>c.id===p!.parent_id);}}
  const lower=(s:string)=>s.trim().toLocaleLowerCase();
  if(config.entry_kind==='directory'&&configs.some(c=>c.id!==id&&c.entry_kind==='directory'&&c.parent_id===config.parent_id&&lower(c.name)===lower(config.name)))fail('M4_DIRECTORY_EXISTS',409);
  if(config.entry_kind==='object'&&config.scope_definition&&config.jurisdiction_mode!=='unknown'&&configs.some(c=>c.id!==id&&c.entry_kind==='object'&&lower(c.name)===lower(config.name)&&c.scope_definition===config.scope_definition&&c.jurisdiction_mode===config.jurisdiction_mode&&c.jurisdiction===config.jurisdiction))fail('M4_OBJECT_EXISTS',409);
 }
 private identityChanged(before:Config|undefined,after:ConfigValues){return Boolean(before?.entry_kind==='object'&&['scope_definition','jurisdiction_mode','jurisdiction','categories'].some(k=>digest(before[k as keyof Config])!==digest(after[k as keyof ConfigValues])));}
 private async impact(tx:PoolClient,id:string,value:ConfigValues,configs:Config[]){
  const before=configs.find(c=>c.id===id);if(!before)fail('NOT_FOUND',404);
  this.validateTree(id,value,configs);if(before.entry_kind!==value.entry_kind)fail('M4_KIND_IMMUTABLE');
  const identity_changed=this.identityChanged(before,value),next=configs.map(c=>c.id===id?{...c,...value}:c);
  const affectedConfigs=next.filter(c=>selectable(c,next)!==selectable(configs.find(x=>x.id===c.id)!,configs)&&c.entry_kind==='object');
  const observations=(await tx.query<Observation>('SELECT * FROM information.shared_observation ORDER BY id')).rows.filter(o=>o.state==='active'&&(identity_changed&&o.config_id===id||affectedConfigs.some(c=>c.id===o.config_id&&selectable(c,next))));
  const mappings=(await tx.query<Mapping>("SELECT * FROM information.target_config_mapping WHERE config_id=$1 AND state='approved' ORDER BY id",[id])).rows.filter(()=>identity_changed);
  const impact_token=digest({id,snapshot:before.current_snapshot_id,value,observations:observations.map(o=>({id:o.id,version:o.version})),mappings:mappings.map(m=>({id:m.id,version:m.version})),ancestry:next.map(c=>({id:c.id,parent_id:c.parent_id,status:c.status,config_version:c.config_version}))});
  return {identity_changed,impact_token,affected_configs:affectedConfigs.map(c=>({id:c.id,name:c.name,unavailable_reason:selectable(c,next)})),observations:observations.map(o=>({...o,name:next.find(c=>c.id===o.config_id)!.name,pause_reason:identity_changed&&o.config_id===id?'definition_changed' as const:'config_unavailable' as const})),mappings};
 }
 async preview(actor:string,id:string,input:ConfigInput){const value=normalize(input);return transaction(this.repo.db,async tx=>{await this.access(tx,actor,'financial_config_manage');await this.lock(tx,actor,'financial_config_manage');const configs=await this.all(tx),c=configs.find(c=>c.id===id);if(!c)fail('NOT_FOUND',404);if(c.config_version!==input.expected_config_version)fail('M4_VERSION_CONFLICT',409);return this.impact(tx,id,value,configs);});}
 async save(actor:string,input:ConfigInput,key:string,id?:string){
  const value=normalize(input);input={...input,reason:reason(input.reason)};
  return this.repo.action(actor,id?'m4-config-edit':'m4-config-create',key,{id:id??null,input},tx=>this.access(tx,actor,'financial_config_manage'),async tx=>{
   await this.lock(tx,actor,'financial_config_manage');const configs=await this.all(tx),before=id?configs.find(c=>c.id===id):undefined;
   if(id&&!before)fail('NOT_FOUND',404);if(before&&before.config_version!==input.expected_config_version)fail('M4_VERSION_CONFLICT',409);
   const configId=id??randomUUID();this.validateTree(configId,value,configs);
   if(before?.entry_kind!==undefined&&before.entry_kind!==value.entry_kind)fail('M4_KIND_IMMUTABLE');
   if(before&&digest(values(before))===digest(value))return {config:before,changed:false};
   const semantic=this.identityChanged(before,value);
   if(before?.entry_kind==='object'&&(semantic||before.name!==value.name)&&input.same_identity!==true)fail('M4_NEW_IDENTITY_REQUIRED',409);
   if(before&&value.status==='draft'&&(await tx.query('SELECT 1 FROM information.shared_observation WHERE config_id=$1 UNION ALL SELECT 1 FROM information.target_config_mapping WHERE config_id=$1 LIMIT 1',[configId])).rowCount)fail('M4_DRAFT_IN_USE',409);
   const impact=before?await this.impact(tx,configId,value,configs):null;
   if(impact&&(impact.observations.length||impact.mappings.length||impact.affected_configs.length)&&input.impact_token!==impact.impact_token)fail('M4_IMPACT_CONFIRMATION_REQUIRED',409);
   const now=new Date().toISOString(),snapshotId=randomUUID();
   const config:Config={...value,id:configId,config_version:before?increment(before.config_version):'1',identity_version:before?semantic?increment(before.identity_version):before.identity_version:'1',current_snapshot_id:snapshotId,created_by:before?.created_by??actor,updated_by:actor,created_at:before?.created_at??now,updated_at:now};
   const payload={schema_version:1,config:configPayload(config),change:{action:before?'edit':'create',reason:reason(input.reason),previous_snapshot_id:before?.current_snapshot_id??null,actor}};
   const snapshots:Snapshot[]=[{id:snapshotId,kind:'financial_object_config',definition_id:configId,definition_version:config.config_version,payload,digest:digest(payload)}];
   const histories:History[]=[],observations:Observation[]=[],mappings:Mapping[]=[];
   for(const old of impact?.observations??[]){const {name,pause_reason,...base}=old;const updated:Observation={...base,state:'paused',state_reason:pause_reason,version:increment(base.version),updated_by:actor,updated_at:now};observations.push(updated);histories.push(history(actor,'observation','config-pause',input.reason,base,updated));}
   for(const old of impact?.mappings??[]){const updated:Mapping={...old,state:'pending',reason:input.reason,version:increment(old.version),reviewed_by:actor,reviewed_at:now};mappings.push(updated);histories.push(history(actor,'mapping','definition-changed',input.reason,old,updated));}
   await this.persist(tx,actor,'config',{config,snapshots,observations,mappings,history:histories,same_identity:input.same_identity,reason:input.reason});await this.audit(tx,actor,before?'m4-config-edited':'m4-config-created',configId,{reason:input.reason,before:before??null,after:config,impact});return {config,changed:true};
  });
 }
 async add(actor:string,input:ObservationInput,key:string){
  input={...input,reason:reason(input.reason)};if(!uuid(input.config_id)||!version(input.expected_config_version)||input.note!==undefined&&(typeof input.note!=='string'||input.note.length>8000))fail('M4_OBSERVATION_INVALID');
  return this.repo.action(actor,'m4-observation-add',key,input,tx=>this.access(tx,actor,'observation_manage'),async tx=>{
   await this.lock(tx,actor,'observation_manage');const configs=await this.all(tx),c=configs.find(c=>c.id===input.config_id);if(!c)fail('NOT_FOUND',404);if(c.config_version!==input.expected_config_version)fail('M4_VERSION_CONFLICT',409);if(selectable(c,configs))fail('M4_CONFIG_UNAVAILABLE',409);
   const existing=(await tx.query<Observation>('SELECT * FROM information.shared_observation WHERE config_id=$1',[c.id])).rows[0];if(existing)return {observation:existing,outcome:existing.state==='active'?'exists':'restore_required'};
   const now=new Date().toISOString(),o:Observation={id:randomUUID(),config_id:c.id,adopted_snapshot_id:c.current_snapshot_id,adopted_identity_version:c.identity_version,state:'active',state_reason:'manual',note:input.note?.trim()??'',version:'1',created_by:actor,updated_by:actor,created_at:now,updated_at:now};
   await this.persist(tx,actor,'observation',{reason:input.reason,observations:[o],history:[history(actor,'observation','add',input.reason,null,o)]});await this.audit(tx,actor,'m4-observation-added',o.id,{reason:input.reason,after:o});return {observation:o,outcome:'added'};
  });
 }
 async batch(actor:string,items:ObservationInput[],key:string){
  if(!Array.isArray(items)||items.length<1||items.length>100||new Set(items.map(i=>i.config_id)).size!==items.length)fail('M4_BATCH_INVALID');
  await this.repo.action(actor,'m4-observation-batch',key,items,tx=>this.access(tx,actor,'observation_manage'),async()=>({accepted:true}));
  const results=[];for(const input of items){try{results.push({config_id:input.config_id,...await this.add(actor,input,`m4b-${digest({key,id:input.config_id})}`)});}catch(e){if(!(e instanceof DomainError))throw e;results.push({config_id:input.config_id,outcome:'failed',error:{code:e.code,status:e.status}});}}return {results};
 }
 async changeObservation(actor:string,id:string,input:ObservationChange,key:string){
  input={...input,reason:reason(input.reason)};if(!version(input.expected_version)||!['pause','end','restore','note'].includes(input.action)||input.note!==undefined&&(typeof input.note!=='string'||input.note.length>8000))fail('M4_OBSERVATION_INVALID');
  return this.repo.action(actor,'m4-observation-change',key,{id,input},tx=>this.access(tx,actor,'observation_manage'),async tx=>{
   await this.lock(tx,actor,'observation_manage');const configs=await this.all(tx),o=(await tx.query<Observation>('SELECT * FROM information.shared_observation WHERE id=$1',[id])).rows[0];if(!o)fail('NOT_FOUND',404);if(o.version!==input.expected_version)fail('M4_VERSION_CONFLICT',409);
   const c=configs.find(c=>c.id===o.config_id)!;
   if(input.action==='restore'&&(input.expected_config_version!==c.config_version||selectable(c,configs)))fail('M4_CONFIG_UNAVAILABLE',409);
   if(input.action==='pause'&&o.state!=='active'||input.action==='end'&&o.state==='ended'||input.action==='restore'&&o.state==='active')fail('M4_STATE_CONFLICT',409);
   const next:Observation={...o,version:increment(o.version),updated_by:actor,updated_at:new Date().toISOString()};
   if(input.action==='note'){if(input.note===undefined)fail('M4_NOTE_REQUIRED');if(o.note===input.note.trim())return {observation:o,changed:false};next.note=input.note.trim();}
   else {next.state=input.action==='pause'?'paused':input.action==='end'?'ended':'active';next.state_reason='manual';if(input.action==='restore'){next.adopted_snapshot_id=c.current_snapshot_id;next.adopted_identity_version=c.identity_version;}}
   await this.persist(tx,actor,'observation',{reason:input.reason,observations:[next],history:[history(actor,'observation',input.action,input.reason,o,next)]});await this.audit(tx,actor,'m4-observation-'+input.action,id,{reason:input.reason,before:o,after:next});return {observation:next,changed:true};
  });
 }
 async map(actor:string,input:MappingInput,key:string){
  input={...input,reason:reason(input.reason)};if(!uuid(input.config_id)||!uuid(input.target_id)||!version(input.expected_config_version)||!version(input.expected_target_version)||!['approve','conflict','revoke'].includes(input.decision))fail('M4_MAPPING_INVALID');
  return this.repo.action(actor,'m4-mapping-review',key,input,tx=>this.access(tx,actor,'target_mapping_review'),async tx=>{
   await this.lock(tx,actor,'target_mapping_review');const c=(await tx.query<Config>('SELECT * FROM information.financial_object_config WHERE id=$1',[input.config_id])).rows[0];
   // 与F02保存前的FOR SHARE互斥，串行建立首份同版本快照。
   const t=(await tx.query('SELECT * FROM information.target WHERE id=$1 FOR UPDATE',[input.target_id])).rows[0];
   if(!c||!t)fail('NOT_FOUND',404);if(c.entry_kind!=='object'||c.status==='draft')fail('M4_OBJECT_REQUIRED');if(c.config_version!==input.expected_config_version||String(t.definition_version)!==input.expected_target_version)fail('M4_VERSION_CONFLICT',409);
   if(input.decision==='approve'&&(input.identity_confirmed!==true||!t.is_active||c.jurisdiction_mode==='unknown'||c.jurisdiction_mode==='specified'&&c.jurisdiction!==t.jurisdiction||c.jurisdiction_mode==='unrestricted'&&t.jurisdiction!==null))fail('M4_IDENTITY_UNCONFIRMED',409);
   const now=new Date().toISOString(),mappings:Mapping[]=[],histories:History[]=[],snapshots:Snapshot[]=[];
   const existing=(await tx.query<Mapping>('SELECT * FROM information.target_config_mapping WHERE config_id=$1 OR target_id=$2 ORDER BY id',[c.id,t.id])).rows;
   for(const m of existing.filter(m=>m.state==='approved')){
    const live=(await tx.query('SELECT definition_version,is_active FROM information.target WHERE id=$1',[m.target_id])).rows[0];const cc=(await tx.query<Config>('SELECT * FROM information.financial_object_config WHERE id=$1',[m.config_id])).rows[0]!;
    if(String(live.definition_version)!==m.target_version||!live.is_active||cc.identity_version!==m.config_identity_version||input.decision==='conflict'){
     const updated:Mapping={...m,state:'pending',version:increment(m.version),reason:input.reason,reviewed_by:actor,reviewed_at:now};mappings.push(updated);histories.push(history(actor,'mapping','basis-invalidated',input.reason,m,updated));
    }
   }
   if(input.decision==='revoke'){
    const old=existing.find(m=>m.id===input.mapping_id);if(!old||old.config_id!==input.config_id||old.target_id!==input.target_id||old.version!==input.expected_version)fail('M4_VERSION_CONFLICT',409);
    const updated:Mapping={...old,state:'revoked',version:increment(old.version),reason:input.reason,reviewed_by:actor,reviewed_at:now};
    await this.persist(tx,actor,'mapping',{reason:input.reason,mappings:[updated],history:[history(actor,'mapping','revoke',input.reason,old,updated)]});await this.audit(tx,actor,'m4-mapping-revoked',updated.id,{reason:input.reason});return {mapping:updated};
   }
   const approved=existing.find(m=>m.state==='approved'&&!mappings.some(x=>x.id===m.id));
   if(input.decision==='approve'&&approved){if(approved.config_id===c.id&&approved.target_id===t.id)return {mapping:approved};fail('M4_MAPPING_CONFLICT',409);}
   let snapshot=(await tx.query<Snapshot>("SELECT * FROM information.definition_snapshots WHERE kind='target' AND definition_id=$1 AND definition_version=$2",[t.id,String(t.definition_version)])).rows[0];
   if(snapshot)validateTargetSnapshot(snapshot,t);
   if(!snapshot){const payload=targetSnapshotPayload(t);snapshot={id:randomUUID(),kind:'target',definition_id:t.id,definition_version:String(t.definition_version),payload:JSON.parse(canonical(payload)),digest:digest(payload)};snapshots.push(snapshot);}
   const m:Mapping={id:randomUUID(),config_id:c.id,target_id:t.id,config_snapshot_id:c.current_snapshot_id,config_identity_version:c.identity_version,target_snapshot_id:snapshot.id,target_version:String(t.definition_version),state:input.decision==='approve'?'approved':'conflict',reason:input.reason,version:'1',reviewed_by:actor,reviewed_at:now};
   mappings.push(m);histories.push(history(actor,'mapping',input.decision,input.reason,null,m));await this.persist(tx,actor,'mapping',{reason:input.reason,identity_confirmed:input.identity_confirmed,mappings,snapshots,history:histories});await this.audit(tx,actor,'m4-mapping-'+input.decision,m.id,{reason:input.reason,after:m});return {mapping:m};
  });
 }
 private async effectiveMappings(tx:PoolClient,configId?:string){return (await tx.query<Mapping&{effective_state:string}>(`SELECT m.*,CASE WHEN m.state='approved' AND (c.identity_version<>m.config_identity_version OR t.definition_version::text<>m.target_version OR NOT t.is_active) THEN 'stale' ELSE m.state END effective_state FROM information.target_config_mapping m JOIN information.financial_object_config c ON c.id=m.config_id JOIN information.target t ON t.id=m.target_id WHERE ($1::uuid IS NULL OR m.config_id=$1) ORDER BY m.reviewed_at DESC,m.id`,[configId??null])).rows;}
 private filter(configs:Config[],query:Query){
  const q=query.q?.trim().toLocaleLowerCase()??'';if(q.length>200||query.category&&!Object.hasOwn(targetCategories,query.category)||query.jurisdiction&&query.jurisdiction.length>200)fail('M4_FILTER_INVALID',400);
  return configs.filter(c=>(!q||[c.name,...c.aliases].some(s=>s.toLocaleLowerCase().includes(q)))&&(!query.category||c.categories.some(x=>x.primary_category===query.category))&&(!query.jurisdiction||c.jurisdiction?.includes(query.jurisdiction))&&(!query.parent_id||(query.parent_id==='root'?c.parent_id===null:c.parent_id===query.parent_id)));
 }
 async configs(actor:string,query:Query={}){return transaction(this.repo.db,async tx=>{
  await this.access(tx,actor);const configs=await this.all(tx),observations=(await tx.query<Observation>('SELECT * FROM information.shared_observation')).rows,mappings=await this.effectiveMappings(tx);
  if(query.status&&!['all','active','draft','disabled'].includes(query.status))fail('M4_FILTER_INVALID',400);
  const filtered=this.filter(configs,query).filter(c=>!query.status||query.status==='all'||c.status===query.status).map(c=>({...c,unavailable_reason:selectable(c,configs),observation:observations.find(o=>o.config_id===c.id)??null,mapping_state:mappings.find(m=>m.config_id===c.id)?.effective_state??'unmapped'}));
  return {...page(filtered,query),directories:configs.filter(c=>c.entry_kind==='directory'),tree_nodes:configs.map(c=>({id:c.id,parent_id:c.parent_id,name:c.name,entry_kind:c.entry_kind,status:c.status})),...await this.controls(tx,actor)};
 });}
 async configDetail(actor:string,id:string){return transaction(this.repo.db,async tx=>{
  await this.access(tx,actor);const configs=await this.all(tx),config=configs.find(c=>c.id===id);if(!config)fail('NOT_FOUND',404);
  const snapshots=(await tx.query<Snapshot>("SELECT * FROM information.definition_snapshots WHERE kind='financial_object_config' AND definition_id=$1 ORDER BY definition_version::bigint DESC",[id])).rows;
  const observation=(await tx.query<Observation>('SELECT * FROM information.shared_observation WHERE config_id=$1',[id])).rows[0]??null;
  const mappings=await this.effectiveMappings(tx,id),mapping_history=(await tx.query('SELECT h.* FROM information.m4_history h JOIN information.target_config_mapping m ON m.id=h.mapping_id WHERE m.config_id=$1 ORDER BY h.created_at DESC,h.id',[id])).rows;
  const targetSnapshots=(await tx.query<Snapshot>('SELECT * FROM information.definition_snapshots WHERE id=ANY($1::uuid[])',[mappings.map(m=>m.target_snapshot_id)])).rows;
  return {config,unavailable_reason:selectable(config,configs),snapshots,observation,mappings:mappings.map(m=>({...m,target_snapshot:targetSnapshots.find(s=>s.id===m.target_snapshot_id)})),mapping_history,...await this.controls(tx,actor)};
 });}
 private async events(tx:PoolClient,actor:string,targetId:string,query:Query){
  const {offset,limit}=paging(query),layout=await f02Storage(tx);
  const boundary=(value:string|undefined,end=false)=>{if(!value)return null;if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)fail('DATE_INVALID',400);return new Date(Date.parse(value)-8*3600000+(end?86400000:0)).toISOString();};
  const from=boundary(query.from),to=boundary(query.to,true);if(from&&to&&from>=to)fail('DATE_RANGE_INVALID',400);
  const where=`FROM information.event e WHERE EXISTS(SELECT 1 FROM information.event_target et WHERE et.event_id=e.id AND et.target_id=$2) AND NOT EXISTS(SELECT 1 FROM ${layout.eventFacts} ef JOIN ${layout.factMaterials} fm ON fm.fact_id=ef.fact_id JOIN infomation.ingestion_material im ON im.id=fm.information_id JOIN m1.sources s ON s.id=im.source_id JOIN platform.actors a ON a.subject=$1 WHERE ef.event_id=e.id AND NOT('*'=ANY(a.source_keys) OR s.catalog_key=ANY(a.source_keys))) AND ($3::timestamptz IS NULL OR e.updated_at>=$3::timestamptz) AND ($4::timestamptz IS NULL OR e.updated_at<$4::timestamptz)`;
  const params=[actor,targetId,from,to],total=Number((await tx.query(`SELECT count(*)::int n ${where}`,params)).rows[0].n);
  const items=(await tx.query(`SELECT e.* ${where} ORDER BY e.updated_at DESC,e.id LIMIT $5 OFFSET $6`,[...params,limit,offset])).rows;
  return {items,total,offset,limit,next_offset:offset+limit<total?offset+limit:null};
 }
 async observations(actor:string,query:Query={}){return transaction(this.repo.db,async tx=>{
  await this.access(tx,actor);const configs=await this.all(tx),allowed=new Set(this.filter(configs,query).map(c=>c.id)),mappings=await this.effectiveMappings(tx);
  const state=query.status??'active';if(!['all','active','paused','ended'].includes(state))fail('M4_FILTER_INVALID',400);
  const observations=(await tx.query<Observation>('SELECT * FROM information.shared_observation ORDER BY updated_at DESC,id')).rows.filter(o=>allowed.has(o.config_id)&&(state==='all'||o.state===state));
  const result=page(observations,query),items=[];for(const o of result.items){const mapping=mappings.find(m=>m.config_id===o.config_id&&m.effective_state==='approved');items.push({...o,config:configs.find(c=>c.id===o.config_id),mapping_state:mapping?'approved':mappings.find(m=>m.config_id===o.config_id)?.effective_state??'unmapped',event_count:mapping?(await this.events(tx,actor,mapping.target_id,{limit:'1'})).total:null});}
  return {...result,items,...await this.controls(tx,actor)};
 });}
 async observationDetail(actor:string,id:string,query:Query={}){return transaction(this.repo.db,async tx=>{
  await this.access(tx,actor);const configs=await this.all(tx),o=(await tx.query<Observation>('SELECT * FROM information.shared_observation WHERE id=$1',[id])).rows[0];if(!o)fail('NOT_FOUND',404);
  const config=configs.find(c=>c.id===o.config_id)!,mappings=await this.effectiveMappings(tx,config.id),mapping=mappings.find(m=>m.effective_state==='approved');
  const adopted_snapshot=(await tx.query('SELECT * FROM information.definition_snapshots WHERE id=$1',[o.adopted_snapshot_id])).rows[0],history=(await tx.query('SELECT * FROM information.m4_history WHERE observation_id=$1 ORDER BY created_at DESC,id',[id])).rows;
  return {observation:o,config,unavailable_reason:selectable(config,configs),adopted_snapshot,history,mappings,dynamics_state:mapping?'approved':mappings[0]?.effective_state??'unmapped',events:mapping?await this.events(tx,actor,mapping.target_id,query):null,...await this.controls(tx,actor)};
 });}
}
