import type {Repository} from '../information-ingestion/processing/repository.js';
import {IngestionRepository,type MaterialBasis} from '../information-ingestion/processing/current-repository.js';
import {reserveCurrentModel,isCurrentReference,readCurrentInput,currentInputDigest,type CurrentModelReference} from '../event-management/current-model.js';
import {currentTaskSchema,validateCurrentExtraction} from '../event-management/current-contracts.js';
import {loadTaskPackage} from '../event-management/task-packages.js';
import {modelConfig,decodeModelResponse,type TaskInput,type TransportResponse} from '../information-ingestion/processing/model.js';
import {DomainError} from '../platform/types.js';
import {retryableModelFailure} from '../information-ingestion/processing/policy.js';
interface ExtractionReference extends MaterialBasis {actor:string}
export function currentExtractionActivities(repo:Repository){
 const store=new IngestionRepository(repo);
 const reference=async(id:string,generation:number):Promise<ExtractionReference>=>{
  const row=(await repo.db.query("SELECT input FROM platform.execution_intents WHERE kind='material-extract' AND owner_id=$1 AND generation=$2",[id,generation])).rows[0];
  if(!row)throw new DomainError('TASK_INPUT_UNAVAILABLE',409);return row.input;
 };
 return {
  async prepareCurrentExtraction(id:string,generation:number,index:number){
   const basis=await reference(id,generation);
   try{
    const material=await store.material(basis.actor,id);
    if(material.version!==basis.version||material.content_digest!==basis.content_digest)throw new DomainError('MATERIAL_BASIS_CHANGED',409);
    if(material.extraction_result?.candidate_count!==undefined)return {stop:true as const};
    const task=loadTaskPackage('AI-01','f02-fact-draft-v2'),schema=currentTaskSchema('AI-01');
    const input:TaskInput={version_id:id,material_ref:{material_id:id,version:basis.version,content_digest:basis.content_digest},material:material.content,manifest:{provider:modelConfig(),task_id:'AI-01',prompt:task.prompt+'\n当前资料身份为material_id、version、content_digest；证据必须携带这三个字段，禁止使用information_version_id或version_id。只返回符合本次JSON Schema的完整对象。',output_schema:schema}};
    return {attempt:await reserveCurrentModel(repo,basis.actor,basis,'material',id,generation,input,`workflow-${index}`)};
   }catch(error){const code=error instanceof DomainError?error.code:'MODEL_PREPARATION_FAILED';if(!['MATERIAL_BASIS_CHANGED','FORBIDDEN','SOURCE_DISABLED'].includes(code))await store.extractionFailed(basis.actor,basis,code);return {stop:true as const};}
  },
  async consumeCurrentExtraction(id:string,generation:number,attemptId:string){
   const basis=await reference(id,generation);
   try{
    const attempt=(await repo.db.query('SELECT a.*,w.deadline,w.used FROM platform.model_attempts a JOIN platform.model_budget_windows w ON w.id=a.window_id WHERE a.id=$1',[attemptId])).rows[0];
    if(!attempt||attempt.owner_kind!=='material'||attempt.owner_id!==id||Number(attempt.generation)!==generation)throw new DomainError('STALE_EXECUTION',409);
    if(new Date(attempt.deadline).getTime()<=Date.now())throw new DomainError('MODEL_BUDGET_EXHAUSTED',409);
    if(!attempt.response_artifact_id)throw new DomainError(attempt.error_code??'MODEL_NETWORK_ERROR',502,retryableModelFailure(attempt.error_code??'MODEL_NETWORK_ERROR'));
    const request=await repo.json<CurrentModelReference>(attempt.request_artifact_id);if(!isCurrentReference(request))throw new DomainError('INPUT_REFERENCE_INVALID',409);
    const input=await readCurrentInput(repo,request);if(currentInputDigest(input)!==attempt.input_digest)throw new DomainError('INPUT_DIGEST_MISMATCH',409);
    const response=decodeModelResponse(await repo.json<TransportResponse>(attempt.response_artifact_id));if(!response.complete)throw new DomainError('MODEL_INCOMPLETE',422);
    const material=await store.material(basis.actor,id);validateCurrentExtraction(material,response.data);
    await store.acceptExtraction(basis.actor,basis,{...response.data,...(!response.data.candidates.length?{no_event_reason:'完整有效输出中的候选数量为零。'}:{})});
    await repo.db.query("UPDATE platform.model_attempts SET status='accepted',finish_reason=$2,error_code=NULL WHERE id=$1",[attemptId,response.finishReason]);return {stop:true as const};
   }catch(error){
    const code=error instanceof DomainError?error.code:'MODEL_OUTPUT_UNAVAILABLE';await repo.db.query("UPDATE platform.model_attempts SET status='rejected',error_code=$2 WHERE id=$1 AND status<>'accepted'",[attemptId,code]);
    if(!['MATERIAL_BASIS_CHANGED','FORBIDDEN','SOURCE_DISABLED'].includes(code))await store.extractionFailed(basis.actor,basis,code);
    return {stop:!(error instanceof DomainError&&error.retryable),retry:error instanceof DomainError&&error.retryable};
   }
  },
 };
}
export type CurrentExtractionActivities=ReturnType<typeof currentExtractionActivities>;
