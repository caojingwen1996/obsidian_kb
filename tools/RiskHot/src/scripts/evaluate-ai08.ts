import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {evaluationCases as identityCases} from './evaluate-ai07.js';
import {buildRecognitionInput} from '../event-management/target-recognition.js';
import {validateTargetRecognition,recognitionOutputSchema,targetRecognitionPrompt} from '../event-management/target-recognition-contracts.js';
import {digest} from '../event-management/contracts.js';
import {CodexModelClient} from '../information-ingestion/processing/codex.js';
import {HttpModelClient,modelConfig,decodeModelResponse,type TaskInput} from '../information-ingestion/processing/model.js';
export async function recognitionEvaluationCases(){
 const source=await identityCases(),sample=source.cases[0]!;
 const material_ref=sample.material_ref,materials=[{...material_ref,segments:sample.material.segments.map(({id,text})=>({id,text}))}];
 return {sourceFile:source.sourceFile,source_digest:source.source_digest,cases:[{id:'explicit-treasury',object:'美国七年期国债91282CRV5',expected:'ready'},{id:'empty-object-context',object:null,expected:'ready'}].map(s=>({id:s.id,expected:s.expected,material:sample.material,input:buildRecognitionInput({fact_id:material_ref.material_id,fact:{title:'美国国债发行安排',description:'美国财政部公布七年期国债91282CRV5发行安排。',subject:'美国财政部',action:'公布发行安排',object:s.object,event_status:'announced',event_time:null},materials,evidence:sample.context.object.evidence_refs as any,manifest_ref:'ai08-evaluation-v1'})}))};
}
async function main(){
 const data=await recognitionEvaluationCases(),provider=modelConfig(),folder=resolve('docs/verification/ai08',new Date().toISOString().replace(/[:.]/g,'-'));
 await mkdir(folder,{recursive:true});await writeFile(resolve(folder,'manifest.json'),JSON.stringify({created_at:new Date().toISOString(),description:'真实原文与受控Fact；未独立人工标注，不代表泛化准确率。',provider:{protocol:provider.protocol,model:provider.model},task_digest:digest({prompt:targetRecognitionPrompt,schema:recognitionOutputSchema}),...data},null,2)+'\n','utf8');
 const results=[];for(const c of data.cases){let result:Record<string,unknown>={id:c.id,expected:c.expected,passed:false};try{const input:TaskInput={version_id:c.input.material_refs[0]!.material_id,material_ref:c.input.material_refs[0],material_refs:c.input.material_refs,material:c.material,manifest:{provider,prompt:targetRecognitionPrompt,task_id:'AI-08',output_schema:recognitionOutputSchema},context:c.input};const response=provider.protocol==='codex-exec'?await new CodexModelClient().execute(input,{deadlineMs:Date.now()+150000}):await new HttpModelClient().execute(input,process.env.MODEL_API_KEY??'',{deadlineMs:Date.now()+150000});await writeFile(resolve(folder,`${c.id}.response.json`),response.body,'utf8');const decoded=decodeModelResponse(response);if(!decoded.complete)throw new Error('MODEL_INCOMPLETE');const accepted=validateTargetRecognition(c.input,decoded.data);result={...result,...accepted,passed:accepted.status===c.expected};}catch(error){result.error=error instanceof Error?error.message:'UNKNOWN';}results.push(result);await writeFile(resolve(folder,`${c.id}.result.json`),JSON.stringify(result,null,2)+'\n','utf8');}
 await writeFile(resolve(folder,'summary.json'),JSON.stringify({total:results.length,passed:results.filter(r=>r.passed).length,results},null,2)+'\n','utf8');console.log(folder);if(results.some(r=>!r.passed))process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await main();
