import 'dotenv/config';
import { createPool } from '../../../packages/platform/database/index.js';
import { buildApp } from './app.js';
const pool = createPool();
const app = buildApp({ pool });
const close = async () => {
  await app.close();
  await pool.end();
  process.exit(0);
};
process.on('SIGTERM', close);
process.on('SIGINT', close);
await app.listen({ host: process.env.API_HOST || '127.0.0.1', port: Number(process.env.API_PORT || 4310) });
console.log('RiskHot API ready at http://127.0.0.1:' + (process.env.API_PORT || 4310));
