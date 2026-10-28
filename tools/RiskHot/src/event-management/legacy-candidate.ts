import {legacyEventTime} from './time.js';
import {stages,type FullCandidate} from './contracts.js';

// Compatibility boundary for archived F02 records and the F01 extraction transport.
export function convertLegacyCandidate(p:Record<string,any>,version:string):FullCandidate {
 return {local_key:p.local_key??'legacy',title:p.title,description:p.description,subject:p.subject??p.subject_name??null,action:p.action,
  event_status:stages.includes(p.event_status??p.stage)?p.event_status??p.stage:'unknown',
  event_time:typeof p.event_time==='string'?p.event_time:legacyEventTime(p.event_time??p.time,p.action),target_clues:p.target_clues??[],
  missing_fields:p.missing_fields??p.uncertainties??[],evidence_refs:p.evidence_refs??(p.evidence??[]).map((e:object)=>({...e,information_version_id:version}))};
}
