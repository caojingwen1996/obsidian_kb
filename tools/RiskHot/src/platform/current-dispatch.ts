import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { Pool, PoolClient } from 'pg';
import { enqueueBusinessJob } from './business-queue.js';
export type ExecutionEngine='temporal'|'pg-boss';
export function executionEngine(env:NodeJS.ProcessEnv=process.env):ExecutionEngine{
 const engine=env.EXECUTION_ENGINE??'temporal';
 if(engine!=='temporal'&&engine!=='pg-boss')throw new Error('EXECUTION_ENGINE_INVALID');
 return engine;
}
export interface CurrentExecution {kind:'ingestion'|'material-extract'|'candidate';owner_id:string;generation:number;workflow_id:string;input:Record<string,unknown>;manifest_ref?:string}
const taskTypes={'ingestion':'sources.fetch','material-extract':'information.extract',candidate:'events.process'} as const;
function canonical(value:unknown):string{
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value!==null&&typeof value==='object')return '{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';
 return JSON.stringify(value);
}
export async function dispatchCurrentExecution(tx:PoolClient,args:CurrentExecution,engine:ExecutionEngine=executionEngine()):Promise<void>{
 const {kind,owner_id,generation,input}=args;const task_type=taskTypes[kind];
 await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,3))',[`${kind}/${owner_id}/${generation}`]);
 if(engine==='temporal'){
  if((await tx.query("SELECT to_regclass('platform.task_runs') AS name")).rows[0].name){
   if((await tx.query("SELECT 1 FROM platform.task_runs WHERE owner_module=$1 AND task_type=$2 AND operation_key=$3 AND engine='pg-boss'",[kind==='ingestion'?'F01':'F02',task_type,`${kind}/${owner_id}/${generation}`])).rowCount)throw new Error('ENGINE_FENCE');
  }
  const row=(await tx.query('SELECT input FROM platform.execution_intents WHERE kind=$1 AND owner_id=$2 AND generation=$3',[kind,owner_id,generation])).rows[0];
  if(row && !isDeepStrictEqual(row.input,input))throw new Error('INPUT_DIGEST_CONFLICT');
  await tx.query('INSERT INTO platform.execution_intents(kind,owner_id,generation,workflow_id,input) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',[kind,owner_id,generation,args.workflow_id,input]);return;
 }
 if((await tx.query('SELECT 1 FROM platform.execution_intents WHERE kind=$1 AND owner_id=$2 AND generation=$3',[kind,owner_id,generation])).rowCount)throw new Error('ENGINE_FENCE');
 await enqueueBusinessJob(tx,{task_type,payload_version:1,run_id:randomUUID(),owner_module:kind==='ingestion'?'F01':'F02',owner_ref:{id:owner_id},operation_key:`${kind}/${owner_id}/${generation}`,execution_generation:generation,
  input_digest:createHash('sha256').update(canonical(input)).digest('hex'),manifest_ref:args.manifest_ref??(kind==='ingestion'?'f01-source-fetch-v1':'f02-eight-step-v1'),correlation_id:randomUUID(),causation_id:null,trigger_kind:'command',payload:input});
}
export async function readCurrentExecutionInput(db:Pool|PoolClient,kind:CurrentExecution['kind'],owner_id:string,generation?:number,engine:ExecutionEngine=executionEngine()):Promise<Record<string,unknown>|undefined>{
 if(engine==='temporal')return (await db.query('SELECT input FROM platform.execution_intents WHERE kind=$1 AND owner_id=$2 AND ($3::bigint IS NULL OR generation=$3) ORDER BY generation DESC LIMIT 1',[kind,owner_id,generation??null])).rows[0]?.input;
 return (await db.query("SELECT input_payload FROM platform.task_runs WHERE task_type=$1 AND owner_ref->>'id'=$2 AND ($3::bigint IS NULL OR execution_generation=$3) AND engine='pg-boss' AND runtime_state NOT IN ('superseded','cancelled') AND NOT EXISTS(SELECT 1 FROM platform.task_runs newer WHERE newer.task_type=platform.task_runs.task_type AND newer.owner_ref=platform.task_runs.owner_ref AND newer.execution_generation>platform.task_runs.execution_generation) ORDER BY execution_generation DESC LIMIT 1",[taskTypes[kind],owner_id,generation??null])).rows[0]?.input_payload;
}
