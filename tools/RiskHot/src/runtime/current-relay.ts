import {reconcileEventFiles} from '../event-management/files.js';
import {EventDelivery} from '../event-management/delivery.js';
import type {Repository} from '../information-ingestion/processing/repository.js';
import { Client, WorkflowExecutionAlreadyStartedError } from '@temporalio/client';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { transaction } from '../platform/db.js';
export async function currentRelayTick(db: Pool, temporal: Client, repo:Repository): Promise<void> {
  await reconcileEventFiles(repo);await new EventDelivery(repo).reconcile();
  const intents = await transaction(db, async tx => {
    const rows = (await tx.query("SELECT * FROM platform.execution_intents WHERE kind IN ('ingestion','material-extract','candidate') AND state IN ('pending','leased') AND attempts<10 AND next_attempt_at<=now() AND (lease_until IS NULL OR lease_until<=now()) ORDER BY next_attempt_at,id FOR UPDATE SKIP LOCKED LIMIT 20")).rows;
    for (const row of rows) {
      row.lease_token = randomUUID();
      await tx.query("UPDATE platform.execution_intents SET state='leased',lease_token=$2,lease_until=now()+interval '60 seconds',attempts=attempts+1 WHERE id=$1",[row.id,row.lease_token]);
    }
    return rows;
  });
  for (const intent of intents) {
    try {
      try { await temporal.workflow.start(({ingestion:'IngestionWorkflow','material-extract':'MaterialExtractionWorkflow',candidate:'EventCandidateWorkflow'} as Record<string,string>)[intent.kind]!,{workflowId:intent.workflow_id,taskQueue:'riskhot-l0-workflow',args:[intent.owner_id,Number(intent.generation)]}); }
      catch (error) { if (!(error instanceof WorkflowExecutionAlreadyStartedError)) throw error; }
      await db.query("UPDATE platform.execution_intents SET state='started',lease_token=NULL,lease_until=NULL WHERE id=$1 AND lease_token=$2 AND lease_until>now()",[intent.id,intent.lease_token]);
    } catch {
      const failed = await db.query("UPDATE platform.execution_intents SET state=CASE WHEN attempts>=10 THEN 'recoverable' ELSE 'pending' END,lease_token=NULL,lease_until=NULL,next_attempt_at=now()+interval '30 seconds' WHERE id=$1 AND lease_token=$2",[intent.id,intent.lease_token]);
      if (failed.rowCount && intent.attempts>=9) await markCurrentIntentFailure(db,intent);
    }
  }
}

export async function markCurrentIntentFailure(db:Pool,intent:{kind:string;owner_id:string;generation:string|number;input?:Record<string,unknown>},code='WORKFLOW_START_UNAVAILABLE'):Promise<void>{
 if(intent.kind==='ingestion')await db.query("UPDATE infomation.ingestion_tasks SET status='recoverable',reason_code=$3,updated_at=clock_timestamp() WHERE id=$1 AND control_revision=$2 AND NOT paused AND status<>'completed'",[intent.owner_id,intent.generation,code]);
 else if(intent.kind==='material-extract')await db.query("UPDATE infomation.ingestion_material SET extraction_result=jsonb_build_object('version',version,'content_digest',content_digest,'status','recoverable','error_code',$4::text) WHERE id=$1 AND version=$2 AND content_digest=$3 AND extraction_result->>'candidate_count' IS NULL",[intent.owner_id,intent.input?.version,intent.input?.content_digest,code]);
 else if(intent.kind==='candidate')await db.query("UPDATE information.event_candidates SET status='recoverable',reason_code=$3 WHERE id=$1 AND execution_generation=$2 AND (status NOT IN ('completed','dismissed','review') OR reason_code='DISPOSITION_PENDING')",[intent.owner_id,intent.generation,code]);
}

export async function reconcileCurrentExecutions(db:Pool,inspect:(workflow:string)=>Promise<'running'|'closed'|'missing'|'unknown'>):Promise<void>{
 const rows=(await db.query(`SELECT i.* FROM platform.execution_intents i
 LEFT JOIN infomation.ingestion_tasks t ON i.kind='ingestion' AND t.id=i.owner_id
 LEFT JOIN information.event_candidates c ON i.kind='candidate' AND c.id=i.owner_id
 LEFT JOIN infomation.ingestion_material m ON i.kind='material-extract' AND m.id=i.owner_id
 WHERE i.state='started' AND i.next_attempt_at<=now() AND
 ((t.id IS NOT NULL AND t.control_revision=i.generation AND NOT t.paused AND t.status IN ('queued','running')) OR
 (c.id IS NOT NULL AND c.execution_generation=i.generation AND (c.status IN ('pending','processing') OR c.reason_code='DISPOSITION_PENDING')) OR
 (m.id IS NOT NULL AND m.version=(i.input->>'version')::integer AND m.content_digest=i.input->>'content_digest' AND m.extraction_result->>'candidate_count' IS NULL AND COALESCE(m.extraction_result->>'status','pending')='pending'))
 ORDER BY i.next_attempt_at,i.id LIMIT 20`)).rows;
 for(const intent of rows){
  await db.query("UPDATE platform.execution_intents SET next_attempt_at=now()+interval '60 seconds' WHERE id=$1 AND state='started'",[intent.id]);
  const state=await inspect(intent.workflow_id);if(state==='closed'||state==='missing'){await markCurrentIntentFailure(db,intent,'WORKFLOW_TERMINATED');await db.query("UPDATE platform.execution_intents SET state='recoverable' WHERE id=$1 AND state='started'",[intent.id]);}
 }
}
