import {DomainError} from '../platform/types.js';
export interface ObservationValue {value:string|number|boolean;unit:string|null;value_nature:string|null;value_time:{kind:string;precision:string;start:string|null;end:string|null;raw_text:string|null};acquisition_method:'extracted'|'calculated'|'inferred';derivation_basis:unknown;basis:{fact_id:string;fact_evidence_id:string;material_id?:string;version?:number;content_digest?:string;input_ref?:string|null}[]}
export function validateObservationValue(v:ObservationValue,input:{fact_ids:string[];evidence_ids:string[]}){
 const bad=():never=>{throw new DomainError('OBSERVATION_INVALID',422);};
 if(!v||!['string','number','boolean'].includes(typeof v.value)||typeof v.value==='number'&&!Number.isFinite(v.value)||typeof v.value==='string'&&!v.value.trim()||v.unit!==null&&(typeof v.unit!=='string'||!v.unit.trim()))bad();
 if(v.value_nature!==null&&!['actual','historical','planned','expected','predicted'].includes(v.value_nature)||!['extracted','calculated','inferred'].includes(v.acquisition_method))bad();
 if(!Array.isArray(v.basis)||!v.basis.length||v.basis.some(b=>!input.fact_ids.includes(b.fact_id)||!input.evidence_ids.includes(b.fact_evidence_id)))bad();
 const t=v.value_time;if(!t||!['point','period','range','unknown'].includes(t.kind)||!['second','day','month','quarter','year','unknown'].includes(t.precision))bad();
 const calendar=(s:string|null)=>{if(s===null)return;const date=/^\d{4}(-\d{2})?(-\d{2})?$/.test(s);const instant=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(s);if(!date&&!instant)bad();const parsed=Date.parse(date?s.length===4?s+'-01-01':s.length===7?s+'-01':s:s);if(!Number.isFinite(parsed))bad();if(date&&new Date(parsed).toISOString().slice(0,s.length)!==s)bad();};calendar(t.start);calendar(t.end);
 if(t.kind==='unknown'?(t.start!==null||t.end!==null||t.precision!=='unknown'):t.kind==='point'?(!t.start||t.end!==null||t.precision==='quarter'):t.kind==='period'?(!t.start||!t.end):!t.start&&!t.end)bad();
 if(t.start&&t.end&&t.start>t.end)bad();
 if(v.acquisition_method!=='extracted'){
  const d=v.derivation_basis as {method?:string;rule_ref?:string|null;inputs?:{local_ref:string;value:unknown;unit:string|null;basis_refs:string[]}[]}|null;
  if(!d||typeof d.method!=='string'||!d.method.trim()||!Array.isArray(d.inputs)||!d.inputs.length)bad();
  const ids=new Set<string>();for(const i of d!.inputs!){if(!i.local_ref||ids.has(i.local_ref)||!Array.isArray(i.basis_refs)||!i.basis_refs.length||i.basis_refs.some(e=>!v.basis.some(b=>b.fact_evidence_id===e&&b.input_ref===i.local_ref)))bad();ids.add(i.local_ref);}
 }
 return v;
}
