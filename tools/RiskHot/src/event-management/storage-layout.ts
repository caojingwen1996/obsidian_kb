import type {DB} from './store.js';
/** 只选择当前权威存储；派生列用于历史接口展示，不建立第二套归属。 */
export async function f02Storage(db:DB){
 const current=Boolean((await db.query("SELECT 1 FROM information_schema.columns WHERE table_schema='information' AND table_name='fact' AND column_name='event_id'")).rowCount);
 return {current,
  eventFacts:current?'(SELECT event_id,id AS fact_id,event_relation_role AS relation_role,event_relation_note AS relation_note,event_assigned_at AS created_at FROM information.fact WHERE event_id IS NOT NULL)':'information.event_fact',
  factMaterials:current?'(SELECT fact_id,material_id,material_id AS information_id,relation_role,created_at FROM information.fact_material)':'information.fact_information',
  factMaterial:current?'information.fact_material':'information.fact_information',materialColumn:current?'material_id':'information_id'};
}
