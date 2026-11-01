import {HttpModelClient,type TaskInput} from '../information-ingestion/processing/model.js';
import {CodexModelClient} from '../information-ingestion/processing/codex.js';
import {DomainError} from '../platform/types.js';
let bytes=0;const chunks:Buffer[]=[];
try{
 for await(const chunk of process.stdin){bytes+=chunk.length;if(bytes>100_000)throw new DomainError('INPUT_BUDGET_EXCEEDED');chunks.push(chunk);}
 const {input,deadlineMs}=JSON.parse(Buffer.concat(chunks).toString('utf8')) as {input:TaskInput;deadlineMs:number};
 const response=input.manifest.provider.protocol==='codex-exec'
  ?await new CodexModelClient(undefined,false).execute(input,{deadlineMs})
  :await new HttpModelClient().execute(input,process.env.MODEL_API_KEY??'',{deadlineMs});
 process.stdout.write(JSON.stringify({response}));
}catch(error){process.stdout.write(JSON.stringify({error_code:error instanceof DomainError?error.code:'MODEL_PROCESS_FAILED'}));}
