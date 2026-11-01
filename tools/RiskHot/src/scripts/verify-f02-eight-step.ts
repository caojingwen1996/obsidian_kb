import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {database,required} from '../platform/db.js';
import {Repository} from '../information-ingestion/processing/repository.js';
import {ArtifactStore} from '../platform/artifacts.js';
import {EightStepService} from '../event-management/eight-step-service.js';
export async function verifyEightStep(repo:Repository,id:string,actor:string){
 const view=await new EightStepService(repo).read(id,actor);
 const receipt=(await repo.db.query('SELECT commit_key,result_kind,effects FROM platform.commit_receipts WHERE candidate_id=$1 AND proposal_generation=$2',[id,view.candidate.proposal_generation])).rows[0]??null;
 const deliveries=view.saved_event_id?(await repo.db.query('SELECT d.message_id,d.consumer_id,d.status,d.files_state,i.applied FROM platform.message_deliveries d JOIN platform.messages m ON m.id=d.message_id LEFT JOIN platform.event_consumer_inbox i ON i.message_id=d.message_id AND i.consumer_id=d.consumer_id WHERE m.event_id=$1 ORDER BY d.message_id,d.consumer_id',[view.saved_event_id])).rows:[];
 const associations=view.saved_event_id?(await repo.db.query('SELECT id,manifest_ref,created_at FROM information.event_association_snapshots WHERE event_id=$1 ORDER BY created_at DESC,id',[view.saved_event_id])).rows:[];
 const core=view.candidate.status==='completed'&&Boolean(receipt)&&Boolean(view.saved_event_id);
 return {candidate_id:id,core_saved:core,event_id:view.saved_event_id,receipt,nodes:view.nodes.map(n=>({node_key:n.node_key,state:n.state,reason:n.reason_code??null})),association_saved:associations.length>0,associations,deliveries,all_registered_consumers_applied:deliveries.length>0&&deliveries.every(d=>d.status==='received'&&d.files_state==='ready'&&d.applied===true),scope:'只核对当前保存、登记接收方和关联状态；不代表F03/F05风险分析完成。'};
}
async function main(){
 const args=process.argv.slice(2),id=args[args.indexOf('--candidate')+1],actor=args[args.indexOf('--actor')+1];
 if(!args.includes('--candidate')||!args.includes('--actor')||!id||!actor){console.error('用法：npm run verify:f02 -- --candidate <候选ID> --actor <授权主体>');process.exitCode=2;return;}
 const db=database();try{const result=await verifyEightStep(new Repository(db,new ArtifactStore(required('ARTIFACT_ROOT'))),id,actor);console.log(JSON.stringify(result,null,2));if(!result.core_saved||!result.association_saved||!result.all_registered_consumers_applied)process.exitCode=1;}finally{await db.end();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await main();
