export type RuntimeRole = 'workflow' | 'io' | 'model' | 'relay' | 'api';
const fields: Record<RuntimeRole, string[]> = {
  workflow: [], io: ['IO_DATABASE_URL', 'MODEL_PROTOCOL', 'MODEL_ENDPOINT', 'MODEL_NAME'],
  model: ['MODEL_DATABASE_URL', 'MODEL_API_KEY'], relay: ['RELAY_DATABASE_URL'],
  api: ['DATABASE_URL', 'OIDC_ISSUER', 'OIDC_CLIENT_ID', 'OIDC_CLIENT_SECRET', 'MODEL_PROTOCOL', 'MODEL_ENDPOINT', 'MODEL_NAME'],
};
export function runtimeEnvironment(role: RuntimeRole, base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const keys = ['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'TZ', 'TEMPORAL_ADDRESS', 'TEMPORAL_NAMESPACE', 'ARTIFACT_ROOT', 'API_ORIGIN', ...fields[role]];
  const result: NodeJS.ProcessEnv = Object.fromEntries(keys.filter(key => base[key] !== undefined).map(key => [key, base[key]]));
  if (role === 'io' || role === 'api') result.MODEL_CREDENTIAL_READY = String(Boolean(base.MODEL_API_KEY) || base.MODEL_CREDENTIAL_READY === 'true');
  return result;
}
