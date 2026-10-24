import { randomBytes } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';

const secret = () => randomBytes(32).toString('hex');
const admin = secret(), temporal = secret();
const roles = { api: secret(), io: secret(), model: secret(), relay: secret() };
const url = (user: string, password: string, database = 'riskhot') => `postgresql://${user}:${password}@127.0.0.1:55432/${database}`;
const values: Record<string, string> = {
  PG_ADMIN_PASSWORD: admin, TEMPORAL_DB_PASSWORD: temporal, OIDC_ADMIN_PASSWORD: secret(),
  OIDC_CLIENT_SECRET: secret(), OPERATOR_PASSWORD: secret(), OPERATOR_USERNAME: 'operator',
  ADMIN_DATABASE_URL: url('postgres', admin), DATABASE_URL: url('riskhot_api', roles.api),
  IO_DATABASE_URL: url('riskhot_io', roles.io), MODEL_DATABASE_URL: url('riskhot_model', roles.model),
  RELAY_DATABASE_URL: url('riskhot_relay', roles.relay), TEST_DATABASE_URL: url('postgres', admin, 'riskhot_test'),
  ARTIFACT_ROOT: '.riskhot/artifacts', TEMPORAL_ADDRESS: '127.0.0.1:7238', API_ORIGIN: 'http://localhost:18081',
  OIDC_ISSUER: 'http://localhost:18080/realms/riskhot', OIDC_CLIENT_ID: 'riskhot-api',
  MODEL_PROTOCOL: '', MODEL_ENDPOINT: '', MODEL_NAME: '', MODEL_API_KEY: '',
};
try {
  await mkdir('.riskhot', { recursive: true, mode: 0o700 });
  await writeFile('.env', Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
  console.log('Created private .env; model settings remain unconfigured.');
} catch (error) {
  if ((error as NodeJS.ErrnoException).code === 'EEXIST') console.log('Existing .env preserved.');
  else throw error;
}
