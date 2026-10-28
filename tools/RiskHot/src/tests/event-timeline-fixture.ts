import {randomUUID} from 'node:crypto';
import type {eventFixture} from './event-fixture.js';

// All records live in eventFixture's disposable database. Relationships satisfy
// the same deferred support constraints as a committed formal event.
export async function seedTimeline(f:Awaited<ReturnType<typeof eventFixture>>,count=25){
 await f.repo.seedCatalog([{id:'wiki-source-002',name:'中国人民银行',url:'https://example.invalid/',tier:'T1',group:'受控测试',focus:'受控测试',context:'受控测试'}]);
 const other=(await f.db.query("SELECT id FROM m1.sources WHERE catalog_key='wiki-source-002'")).rows[0].id as string;
 const origin=(await f.db.query('SELECT * FROM information.material_version_origins WHERE version_id=$1',[f.old.version])).rows[0];
 const segment=f.old.material.segments[0]!,ids:string[]=[],versions:string[]=[];
 const client=await f.db.connect();
 try{
  await client.query('BEGIN');
  const version=async(source:string,published:string,c:string,materialId?:string)=>{
   const material=materialId??randomUUID(),v=randomUUID(),operation=randomUUID(),acquisition=randomUUID();
   if(!materialId)await client.query('INSERT INTO information.materials(id,source_id,identity) VALUES($1,$2,$3)',[material,source,randomUUID()]);
   await client.query(`INSERT INTO information.material_versions(id,material_id,version_no,raw_artifact_id,normalized_artifact_id,content_digest,normalizer_version,title,published_at_text) SELECT $1,$2,(SELECT COALESCE(MAX(version_no),0)+1 FROM information.material_versions WHERE material_id=$2),raw_artifact_id,normalized_artifact_id,$3,normalizer_version,title,$4 FROM information.material_versions WHERE id=$5`,[v,material,randomUUID(),published,f.old.version]);
   await client.query('INSERT INTO information.material_segments(version_id,id,ordinal,text,raw_locator,kind) SELECT $1,id,ordinal,text,raw_locator,kind FROM information.material_segments WHERE version_id=$2',[v,f.old.version]);
   await client.query(`INSERT INTO information.operations(id,kind,source_id,source_version,actor,command_artifact_id,status,stage,raw_artifact_id,normalized_artifact_id,version_id) SELECT $1,'material',$2,1,actor,command_artifact_id,'completed','saved',raw_artifact_id,normalized_artifact_id,$3 FROM information.operations WHERE id=$4`,[operation,source,v,origin.operation_id]);
   await client.query('INSERT INTO information.acquisitions(id,operation_id,raw_artifact_id,acquired_at) SELECT $1,$2,raw_artifact_id,$3 FROM information.material_versions WHERE id=$4',[acquisition,operation,c,v]);
   await client.query("INSERT INTO information.material_version_origins(version_id,source_id,source_version,operation_id,acquisition_id,collected_at,version_kind,basis) VALUES($1,$2,1,$3,$4,$5,'initial','saved')",[v,source,operation,acquisition,c]);
   return {material,v};
  };
  const fact=async(event:string,material:string,v:string)=>{
   const id=randomUUID();await client.query("INSERT INTO information.fact(id,title,description,subject,action,event_status) VALUES($1,'受控事实','虚构机构宣布一项措施。','虚构机构','宣布','announced')",[id]);
   await client.query("INSERT INTO information.fact_information(fact_id,information_id,relation_role) VALUES($1,$2,'supporting')",[id,material]);
   await client.query("INSERT INTO information.fact_evidence(fact_id,information_id,information_version_id,segment_id,start_cp,end_cp,quote,evidence_role) VALUES($1,$2,$3,$4,0,5,'虚构机构宣','supporting')",[id,material,v,segment.id]);
   await client.query("INSERT INTO information.event_fact(event_id,fact_id,relation_role,relation_note) VALUES($1,$2,'initial','受控测试证据')",[event,id]);return id;
  };
  for(let i=0;i<count;i++){
   const id=randomUUID(),c=new Date(Date.UTC(2026,9,27-i,8)).toISOString(),p=i===0?'2026-01-01T00:00:00Z':new Date(Date.parse(c)-3600000).toISOString();
   ids.push(id);await client.query("INSERT INTO information.event(id,title,description,subject,action,event_status,event_time) VALUES($1,$2,$3,'虚构机构','宣布','announced','2026')",[id,`时间线受控事件${i+1}：${i===2?'多来源与完整正文':''}`,`这是第${i+1}条受控描述。\n完整正文保留数字、事实与条件。`+(i===2?'长内容与URL https://example.invalid/'+ 'long'.repeat(40):'')]);
   const entry=await version(origin.source_id,p,c);versions.push(entry.v);const firstFact=await fact(id,entry.material,entry.v);
   if(i===2){
    await fact(id,entry.material,entry.v);
    const revision=await version(origin.source_id,'2026-10-27T08:00:00Z','2026-10-27T09:00:00Z',entry.material);
    await client.query("INSERT INTO information.fact_evidence(fact_id,information_id,information_version_id,segment_id,start_cp,end_cp,quote,evidence_role) VALUES($1,$2,$3,$4,0,5,'虚构机构宣','supporting')",[firstFact,revision.material,revision.v,segment.id]);
    const second=await version(other,'2026-10-27T08:00:00Z','2026-10-27T09:00:00Z');await fact(id,second.material,second.v);
   }
  }
  await client.query('COMMIT');return {ids,versions};
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
