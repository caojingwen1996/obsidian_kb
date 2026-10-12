import 'dotenv/config';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { createPool } from '../../../packages/platform/database/index.js';
import { connectTemporal } from '../../../packages/platform/workflow/client.js';
import { runRelayOnce } from './relay.js';

export async function main() {
  const pool = createPool();
  const { client, connection } = await connectTemporal();
  let stopped = false;
  const stop = () => {
    stopped = true;
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    while (!stopped) {
      if (!(await runRelayOnce(pool, client))) await setTimeout(500);
    }
  } finally {
    await connection.close();
    await pool.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
