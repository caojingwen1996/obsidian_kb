import { Client, Connection } from '@temporalio/client';

export const temporalAddress = () => process.env.TEMPORAL_ADDRESS || '127.0.0.1:7233';
export const temporalNamespace = () => process.env.TEMPORAL_NAMESPACE || 'default';
export const temporalTaskQueue = () => process.env.TEMPORAL_TASK_QUEUE || 'riskhot-research-v1';

export async function connectTemporal() {
  const connection = await Connection.connect({ address: temporalAddress() });
  const client = new Client({ connection, namespace: temporalNamespace() });
  return { client, connection };
}
