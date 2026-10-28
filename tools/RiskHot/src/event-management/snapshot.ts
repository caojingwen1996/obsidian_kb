import type {DB} from './store.js';
import {DomainError} from '../platform/types.js';
import {digest} from './contracts.js';
export async function eventSnapshot(db:DB,id:string){
 const event=(await db.query('SELECT * FROM information.event WHERE id=$1',[id])).rows[0];if(!event)throw new DomainError('NOT_FOUND',404);
 const table=async(name:string)=>(await db.query(`SELECT * FROM information.${name} WHERE event_id=$1 ORDER BY 1,2`,[id])).rows;
 const facts=(await db.query('SELECT f.*,ef.relation_role,ef.relation_note FROM information.fact f JOIN information.event_fact ef ON ef.fact_id=f.id WHERE ef.event_id=$1 ORDER BY f.created_at,f.id',[id])).rows;
 const sources=(await db.query('SELECT fi.* FROM information.fact_information fi JOIN information.event_fact ef ON ef.fact_id=fi.fact_id WHERE ef.event_id=$1 ORDER BY fi.fact_id,fi.information_id',[id])).rows;
 const evidence=(await db.query('SELECT fe.* FROM information.fact_evidence fe JOIN information.event_fact ef ON ef.fact_id=fe.fact_id WHERE ef.event_id=$1 ORDER BY fe.id',[id])).rows;
 const targets=(await db.query('SELECT t.*,d.definition_snapshot_id FROM information.event_target t JOIN information.event_target_definition d USING(event_id,target_id) WHERE t.event_id=$1 ORDER BY t.target_id',[id])).rows;
 const variables=(await db.query('SELECT t.*,d.definition_snapshot_id FROM information.event_target_variable t JOIN information.event_variable_definition d USING(event_id,target_id,variable_id) WHERE t.event_id=$1 ORDER BY t.target_id,t.variable_id',[id])).rows;
 const definitions=(await db.query('SELECT * FROM information.definition_snapshots WHERE id=ANY($1::uuid[]) ORDER BY id',[[...targets,...variables].map(r=>r.definition_snapshot_id)])).rows;
 const ratings=(await db.query('SELECT r.* FROM information.event_rating r JOIN information.event_rating_relation er ON er.rating_id=r.id WHERE er.event_id=$1 ORDER BY r.evaluated_at,r.id',[id])).rows;
 return {schema_version:'riskhot.event-facts.v2',event,facts,sources,evidence,targets,variables,definitions,ratings,target_facts:await table('event_target_fact'),variable_facts:await table('event_variable_fact'),rating_facts:await table('event_rating_fact')};
}
export async function eventDigest(db:DB,id:string){return digest(await eventSnapshot(db,id));}
