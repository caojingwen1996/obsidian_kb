import {eventActivities} from './event-activities.js';
import { fileURLToPath } from 'node:url';
import { NativeConnection, Worker } from '@temporalio/worker';
import { database, required } from '../platform/db.js';
import { ArtifactStore } from '../platform/artifacts.js';
import { ExecutionStore } from '../information-ingestion/processing/execution.js';
import { ioActivities, modelActivities } from './activities.js';

const role = process.argv[2];
if (!['workflow', 'io', 'model'].includes(role ?? '')) throw new Error('WORKER_ROLE_REQUIRED');
const connection = await NativeConnection.connect({ address: required('TEMPORAL_ADDRESS') });
const db = role === 'workflow' ? undefined : database(role === 'model' ? 'MODEL_DATABASE_URL' : 'IO_DATABASE_URL');
const repo = db ? new ExecutionStore(db, new ArtifactStore(required('ARTIFACT_ROOT'))) : undefined;
const worker = await Worker.create({
  connection, namespace: process.env.TEMPORAL_NAMESPACE || 'riskhot-l0', taskQueue: `riskhot-l0-${role}`,
  ...(role === 'workflow' ? { workflowsPath: fileURLToPath(new URL('./workflows.ts', import.meta.url)) } : { activities: role === 'io' ? {...ioActivities(repo!),...eventActivities(repo!)} : modelActivities(repo!) }),
  maxConcurrentActivityTaskExecutions: role === 'model' ? 1 : 8,
});
try { await worker.run(); } finally { await db?.end(); await connection.close(); }
