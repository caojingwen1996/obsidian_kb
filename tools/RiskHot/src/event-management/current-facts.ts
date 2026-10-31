import {randomUUID} from 'node:crypto';
import type {DB} from './store.js';
import {assertCurrentEvidence,type MaterialCandidate,type MaterialEvidence} from './current-contracts.js';
import type {CurrentMaterial} from '../information-ingestion/processing/current-repository.js';
import {DomainError} from '../platform/types.js';
import {normalizeEventTime} from './time.js';
export async function addCurrentFactEvidence(db:DB,factId:string,refs:MaterialEvidence[]):Promise<void>{
 for(const evidence of refs){
  const material=(await db.query<CurrentMaterial>('SELECT * FROM infomation.ingestion_material WHERE id=$1 FOR SHARE',[evidence.material_id])).rows[0];
  if(!material)throw new DomainError('NOT_FOUND',404);assertCurrentEvidence(material,evidence);
  await db.query("INSERT INTO information.fact_information(fact_id,information_id,relation_role) VALUES($1,$2,'supporting') ON CONFLICT DO NOTHING",[factId,material.id]);
  await db.query("INSERT INTO information.fact_evidence(fact_id,information_id,material_id,material_version,material_digest,segment_id,start_cp,end_cp,quote,evidence_role) VALUES($1,$2,$2,$3,$4,$5,$6,$7,$8,'supporting') ON CONFLICT DO NOTHING",[factId,material.id,evidence.version,evidence.content_digest,evidence.segment_id,evidence.start_cp,evidence.end_cp,evidence.quote]);
 }
}
export async function saveCurrentFact(db:DB,candidateId:string,payload:MaterialCandidate):Promise<string>{
 const prior=(await db.query('SELECT fact_id FROM information.candidate_fact WHERE candidate_id=$1',[candidateId])).rows[0];if(prior)return prior.fact_id;
 const id=randomUUID();
 await db.query('INSERT INTO information.fact(id,title,description,subject,action,event_status,event_time) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,payload.title,payload.description,payload.subject,payload.action,payload.event_status,normalizeEventTime(payload.event_time)]);
 await addCurrentFactEvidence(db,id,payload.evidence_refs);
 await db.query('INSERT INTO information.candidate_fact VALUES($1,$2)',[candidateId,id]);return id;
}
