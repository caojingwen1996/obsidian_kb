import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { NativeConnection, Worker } from '@temporalio/worker';
import type pg from 'pg';
import type { ModelAdapter } from '../../../packages/platform/agent-runtime/index.js';
import { createPool } from '../../../packages/platform/database/index.js';
import {
  temporalAddress,
  temporalNamespace,
  temporalTaskQueue,
} from '../../../packages/platform/workflow/client.js';
import { createActivities } from './activities.js';

export async function createWorker(pool: pg.Pool, model?: ModelAdapter, taskQueue = temporalTaskQueue()) {
  const deploymentName = process.env.TEMPORAL_DEPLOYMENT_NAME;
  const buildId = process.env.WORKER_BUILD_ID;
  if (!!deploymentName !== !!buildId)
    throw new Error('TEMPORAL_DEPLOYMENT_NAME and WORKER_BUILD_ID must be configured together');
  const connection = await NativeConnection.connect({ address: temporalAddress() });
  try {
    const worker = await Worker.create({
      connection,
      namespace: temporalNamespace(),
      taskQueue,
      workflowsPath: fileURLToPath(new URL('./workflows.ts', import.meta.url)),
      activities: createActivities(pool, model),
      ...(deploymentName && buildId
        ? {
            workerDeploymentOptions: {
              version: { deploymentName, buildId },
              useWorkerVersioning: true as const,
              defaultVersioningBehavior: 'PINNED' as const,
            },
          }
        : {}),
      maxConcurrentActivityTaskExecutions: 8,
      shutdownGraceTime: '20 seconds',
    });
    return { worker, connection };
  } catch (error) {
    await connection.close();
    throw error;
  }
}

export async function main() {
  const pool = createPool();
  const { worker, connection } = await createWorker(pool);
  const stop = () => {
    if (worker.getState() === 'RUNNING') worker.shutdown();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    await worker.run();
  } finally {
    await connection.close();
    await pool.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
