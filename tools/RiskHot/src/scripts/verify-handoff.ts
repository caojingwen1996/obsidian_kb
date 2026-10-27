import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { ArtifactStore } from '../platform/artifacts.js';
import { HandoffFiles, type HandoffFileName } from '../platform/handoff-files.js';
import { required } from '../platform/db.js';
import { requestHeaders } from './request-headers.js';
import { validateInformationHandoff, type AcceptanceReceipt, type CandidateResultFile, type DeliveryView } from '../information-ingestion/processing/handoff-contract.js';
import { validateExtraction } from '../information-ingestion/processing/extraction.js';

export function verifyHandoffSnapshot(snapshot:{packet:unknown;receipt:unknown;result:unknown;delivery:DeliveryView;processing:Record<string,unknown>},options:{requireModelAttempt?:boolean;since?:string}={}) {
  const packet=validateInformationHandoff(snapshot.packet),receipt=snapshot.receipt as AcceptanceReceipt,result=snapshot.result as CandidateResultFile,p=snapshot.processing,d=snapshot.delivery;
  if(d.status!=='received'||p.extraction_status!=='completed'||!result||result.schema_version!=='riskhot.candidate-result.v1')throw new Error('VERIFICATION_INCOMPLETE');
  if(receipt.schema_version!=='riskhot.information-receipt.v1'||receipt.delivery_id!==packet.delivery_id||receipt.version_id!==packet.information.version_id||receipt.information_id!==packet.information.information_id||receipt.processing_id!==p.id||result.processing_id!==p.id||result.version_id!==packet.information.version_id||result.information_id!==packet.information.information_id||result.delivery_id!==receipt.delivery_id||receipt.payload_sha256!==d.files.information?.sha256)throw new Error('VERIFICATION_INPUT_MISMATCH');
  const stored=p.candidates as {id:string;candidate_key:string;payload:unknown}[];
  if(!Array.isArray(result.candidates)||!Array.isArray(stored)||result.candidate_count!==p.candidate_count||result.candidates.length!==p.candidate_count||stored.length!==p.candidate_count)throw new Error('VERIFICATION_COUNT_MISMATCH');
  const candidates=result.candidates as {candidate_id:string;candidate_key:string;payload:unknown}[];
  for(const [i,c]of candidates.entries())if(c.candidate_id!==stored[i]?.id||c.candidate_key!==stored[i]?.candidate_key)throw new Error('VERIFICATION_CANDIDATE_ID_MISMATCH');
  validateExtraction({complete:true,finishReason:'stop',data:{covered_segment_ids:result.covered_segment_ids,candidates:candidates.map(c=>c.payload),no_event_reason:result.no_event_reason,warnings:result.warnings}},packet.material);
  const attempts=(p.attempts??[]) as {id:string;status:string;started_at?:string;created_at:string}[];
  const accepted=attempts.filter(a=>a.status==='accepted'&&(!options.since||Date.parse(a.started_at??a.created_at)>=Date.parse(options.since)));
  if(options.requireModelAttempt!==false){
    const read=p.input_handoff as {detail:{delivery_id:string;payload_artifact_id:string;payload_sha256:string}}|null;
    if(!accepted.length||p.provider_protocol!=='codex-exec'||!read||read.detail.delivery_id!==receipt.delivery_id||read.detail.payload_artifact_id!==receipt.payload_artifact_id||read.detail.payload_sha256!==receipt.payload_sha256)throw new Error('VERIFICATION_MODEL_EVIDENCE_REQUIRED');
  }
  return {version_id:packet.information.version_id,information_id:packet.information.information_id,delivery_id:packet.delivery_id,processing_id:p.id,candidate_count:result.candidate_count,result_status:result.result_status,accepted_attempt_ids:accepted.map(a=>a.id),title:packet.material.title,url:packet.material.url};
}

async function main():Promise<void>{
  const args=new Map<string,string>();for(let i=2;i<process.argv.length;i+=2){const k=process.argv[i],v=process.argv[i+1];if(!k||!['--operation','--since'].includes(k)||!v)throw new Error('Use --operation UUID [--since ISO_TIME]');args.set(k,v);}
  const operationId=args.get('--operation');if(!operationId||!/^[a-f0-9-]{36}$/.test(operationId))throw new Error('OPERATION_REQUIRED');
  if(args.has('--since')&&!Number.isFinite(Date.parse(args.get('--since')!)))throw new Error('SINCE_INVALID');
  const origin=required('API_ORIGIN'),headers=await requestHeaders();
  const get=async(path:string)=>{const url=new URL(path,origin);if(url.origin!==new URL(origin).origin)throw new Error('DOWNLOAD_ORIGIN_INVALID');const r=await fetch(url,{headers,redirect:'error',signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error(`VERIFY_HTTP_${r.status}`);return r;};
  const op=await(await get(`/api/v1/l0/operations/${operationId}`)).json() as {children?:{version_id:string|null}[];version_id:string|null};
  const versions=[...new Set((op.children?.length?op.children:[op]).map(c=>c.version_id).filter((v):v is string=>Boolean(v)))];if(!versions.length)throw new Error('VERIFICATION_NO_SAVED_VERSION');
  const store=new ArtifactStore(required('ARTIFACT_ROOT')),files=new HandoffFiles(store),items=[];
  for(const v of versions){
    const d=await(await get(`/api/v1/l0/versions/${v}/delivery`)).json() as DeliveryView;
    const content:Record<string,unknown>={},evidence=[];
    for(const name of ['information','receipt','candidates'] as HandoffFileName[]){
      const ref=d.files[name];if(!ref)throw new Error(`VERIFICATION_FILE_MISSING_${name}`);
      const http=Buffer.from(await(await get(ref.url)).arrayBuffer()),disk=await files.read(d.delivery_id,name,{...ref,kind:name},d.processing_id??undefined);
      if(!http.equals(disk)||createHash('sha256').update(http).digest('hex')!==ref.sha256)throw new Error('VERIFICATION_FILE_MISMATCH');
      content[name]=JSON.parse(http.toString('utf8'));evidence.push({name,path:join(store.root,files.path(d.delivery_id,name,d.processing_id??undefined)),sha256:ref.sha256,size:ref.size});
    }
    const packet=validateInformationHandoff(content.information);
    for(const ref of Object.values(packet.artifacts)){const bytes=await store.read(ref.sha256);if(bytes.length!==ref.size)throw new Error('VERIFICATION_ARTIFACT_SIZE_MISMATCH');}
    const p=await(await get(`/api/v1/l0/processings/${d.processing_id}?limit=100`)).json() as Record<string,unknown>;
    items.push({...verifyHandoffSnapshot({packet,receipt:content.receipt,result:content.candidates,delivery:d,processing:p},{since:args.get('--since')}),files:evidence,input_handoff:p.input_handoff});
  }
  console.log(JSON.stringify({checked_at:new Date().toISOString(),operation_id:operationId,verified:true,items},null,2));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error instanceof Error?error.message:'VERIFICATION_FAILED');process.exitCode=1;});
