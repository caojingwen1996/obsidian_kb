import { Connection } from '@temporalio/client';
import Long from 'long';
import { required } from '../src/platform/db.js';

const connection = await Connection.connect({ address: required('TEMPORAL_ADDRESS') });
try {
  await connection.workflowService.registerNamespace({ namespace: process.env.TEMPORAL_NAMESPACE || 'riskhot-l0', workflowExecutionRetentionPeriod: { seconds: Long.fromNumber(86_400) } });
  console.log('Temporal namespace registered.');
} catch (error) {
  if ((error as { code?: number }).code !== 6) throw error;
  console.log('Existing Temporal namespace preserved.');
} finally { await connection.close(); }
