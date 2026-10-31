import { currentModel } from './store.js';
import { addCurrentFactEvidence, saveCurrentFact } from './current-facts.js';
import type {MaterialCandidate,MaterialEvidence} from './current-contracts.js';
import {randomUUID} from 'node:crypto';
import {DomainError} from '../platform/types.js';
import type {DB} from './store.js';
import {digest,type FullCandidate,type Evidence} from './contracts.js';
import {normalizeEventTime} from './time.js';

export async function addFactEvidence(db:DB,id:string,refs:Evidence[]){
 if(await currentModel(db))return addCurrentFactEvidence(db,id,refs as unknown as MaterialEvidence[]);
 for(const e of refs){
  const row=(await db.query('SELECT v.material_id,s.text FROM information.material_versions v JOIN information.material_segments s ON s.version_id=v.id WHERE v.id=$1 AND s.id=$2',[e.information_version_id,e.segment_id])).rows[0];
  if(!row||!Number.isInteger(e.start_cp)||!Number.isInteger(e.end_cp)||e.start_cp<0||e.end_cp>Array.from(row.text).length||e.end_cp<=e.start_cp||Array.from(row.text).slice(e.start_cp,e.end_cp).join('')!==e.quote)throw new DomainError('EVIDENCE_MISMATCH',409);
  await db.query("INSERT INTO information.fact_information(fact_id,information_id,relation_role) VALUES($1,$2,'supporting') ON CONFLICT DO NOTHING",[id,row.material_id]);
  await db.query("INSERT INTO information.fact_evidence(fact_id,information_id,information_version_id,segment_id,start_cp,end_cp,quote,evidence_role) VALUES($1,$2,$3,$4,$5,$6,$7,'supporting') ON CONFLICT DO NOTHING",[id,row.material_id,e.information_version_id,e.segment_id,e.start_cp,e.end_cp,e.quote]);
 }
}
export async function saveFact(db:DB,candidateId:string,p:FullCandidate){
 if(await currentModel(db))return saveCurrentFact(db,candidateId,p as unknown as MaterialCandidate);
 const prior=(await db.query('SELECT fact_id FROM information.candidate_fact WHERE candidate_id=$1',[candidateId])).rows[0];if(prior)return prior.fact_id as string;
 // Serialize exact repeats within a material; cross-source semantic reuse requires an explicit decision.
 const version=p.evidence_refs[0]?.information_version_id;
 const material=(await db.query('SELECT material_id FROM information.material_versions WHERE id=$1',[version])).rows[0];
 if(!material)throw new DomainError('EVIDENCE_MISMATCH',409);
 const identity=[material.material_id,p.title,p.description,p.subject,p.action,p.event_status,normalizeEventTime(p.event_time)];
 await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[digest(identity)]);
 const matches=(await db.query('SELECT f.id FROM information.fact f JOIN information.fact_information fi ON fi.fact_id=f.id WHERE fi.information_id=$1 AND (f.title,f.description,f.subject,f.action,f.event_status,f.event_time) IS NOT DISTINCT FROM ($2,$3,$4,$5,$6,$7) ORDER BY f.created_at,f.id',identity)).rows;
 for(const same of matches){
  const refs=(await db.query('SELECT information_version_id,segment_id,start_cp,end_cp,quote FROM information.fact_evidence WHERE fact_id=$1',[same.id])).rows;
  const ordered=(items:Evidence[])=>items.map(e=>digest(e)).sort();
  if(digest(ordered(refs))!==digest(ordered(p.evidence_refs)))continue;
  await db.query('INSERT INTO information.candidate_fact VALUES($1,$2)',[candidateId,same.id]);return same.id as string;
 }
 const id=randomUUID();
 await db.query('INSERT INTO information.fact(id,title,description,subject,action,event_status,event_time) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,p.title,p.description,p.subject,p.action,p.event_status,normalizeEventTime(p.event_time)]);
 await addFactEvidence(db,id,p.evidence_refs);
 await db.query('INSERT INTO information.candidate_fact VALUES($1,$2)',[candidateId,id]);return id;
}
export async function readFact(db:DB,candidateId:string){
 const f=(await db.query('SELECT f.* FROM information.fact f JOIN information.candidate_fact cf ON cf.fact_id=f.id WHERE cf.candidate_id=$1',[candidateId])).rows[0];
 if(!f)throw new DomainError('FACT_NOT_FOUND',409);return f;
}
