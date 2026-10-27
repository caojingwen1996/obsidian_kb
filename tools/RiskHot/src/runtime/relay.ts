import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { Client, Connection, WorkflowExecutionAlreadyStartedError } from '@temporalio/client';
import { database, required, transaction } from '../platform/db.js';
import { ArtifactStore } from '../platform/artifacts.js';
import { ExecutionStore } from '../information-ingestion/processing/execution.js';

const db = database('RELAY_DATABASE_URL');
const repo = new ExecutionStore(db, new ArtifactStore(required('ARTIFACT_ROOT')));
const connection = await Connection.connect({ address: required('TEMPORAL_ADDRESS') });
const client = new Client({ connection, namespace: process.env.TEMPORAL_NAMESPACE || 'riskhot-l0' });
let stopping = false;
process.on('SIGTERM', () => { stopping = true; }); process.on('SIGINT', () => { stopping = true; });
interface Intent { id: string; kind: 'discovery' | 'material' | 'extract' | 'event-extract' | 'candidate'; owner_id: string; generation: string; workflow_id: string; lease_token: string; attempts: number }
try {
  while (!stopping) {
    try {
      await repo.deliverPending();
      const intents = await transaction(db, async tx => {
        const rows = (await tx.query<Intent>("SELECT * FROM platform.execution_intents WHERE state IN ('pending','leased') AND attempts<10 AND next_attempt_at<=now() AND (lease_until IS NULL OR lease_until<=now()) ORDER BY next_attempt_at,id FOR UPDATE SKIP LOCKED LIMIT 20")).rows;
        for (const row of rows) {
          row.lease_token = randomUUID();
          await tx.query("UPDATE platform.execution_intents SET state='leased',lease_token=$2,lease_until=now()+interval '60 seconds',attempts=attempts+1 WHERE id=$1", [row.id, row.lease_token]);
        }
        return rows;
      });
      for (const intent of intents) {
        try {
          const workflow = { discovery: 'SourceFetchWorkflow', material: 'MaterialIngestionWorkflow', extract: 'EventExtractionWorkflow', 'event-extract':'FullEventExtractionWorkflow',candidate:'EventCandidateWorkflow' }[intent.kind];
          try { await client.workflow.start(workflow, { workflowId: intent.workflow_id, taskQueue: 'riskhot-l0-workflow', args: [intent.owner_id, Number(intent.generation)] }); }
          catch (error) { if (!(error instanceof WorkflowExecutionAlreadyStartedError)) throw error; }
          await db.query("UPDATE platform.execution_intents SET state='started',lease_token=NULL,lease_until=NULL WHERE id=$1 AND lease_token=$2 AND lease_until>now()", [intent.id, intent.lease_token]);
        } catch {
          await db.query("UPDATE platform.execution_intents SET state=CASE WHEN attempts>=10 THEN 'recoverable' ELSE 'pending' END,lease_until=NULL,lease_token=NULL,next_attempt_at=now()+interval '30 seconds' WHERE id=$1 AND lease_token=$2", [intent.id, intent.lease_token]);
          if (intent.attempts >= 9) {
            if (intent.kind === 'extract') await repo.extractionFailed(intent.owner_id, Number(intent.generation), 'WORKFLOW_START_UNAVAILABLE');
            else if (intent.kind === 'event-extract' || intent.kind === 'candidate') await repo.db.query("UPDATE platform.execution_intents SET state='recoverable' WHERE id=$1",[intent.id]);
            else await repo.failOperation(intent.owner_id, Number(intent.generation), 'WORKFLOW_START_UNAVAILABLE');
          }
        }
      }
    } catch { console.error('Relay dependency unavailable; durable work retained.'); }
    await setTimeout(1000);
  }
} finally { await db.end(); await connection.close(); }
