export type RuntimeRole = 'workflow' | 'io' | 'model' | 'relay' | 'api' | 'scheduler';
const fields: Record<RuntimeRole, string[]> = {
  workflow: [], io: ['IO_DATABASE_URL', 'MODEL_PROTOCOL', 'MODEL_ENDPOINT', 'MODEL_NAME','SOURCE_BROWSER_EXECUTABLE'],
  model: ['MODEL_DATABASE_URL', 'MODEL_API_KEY', 'MODEL_PROTOCOL', 'MODEL_NAME', 'CODEX_EXECUTABLE', 'CODEX_HOME'], relay: ['RELAY_DATABASE_URL'],
  api: ['DATABASE_URL', 'AUTH_MODE', 'OIDC_ISSUER', 'OIDC_CLIENT_ID', 'OIDC_CLIENT_SECRET', 'MODEL_PROTOCOL', 'MODEL_ENDPOINT', 'MODEL_NAME'],
  scheduler: ['IO_DATABASE_URL', 'MODEL_PROTOCOL', 'MODEL_NAME', 'CODEX_EXECUTABLE', 'CODEX_HOME', 'SCHEDULE_INTERVAL_SECONDS', 'SCHEDULE_SOURCES'],
};
export function runtimeEnvironment(role: RuntimeRole, base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const keys = ['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'TZ', 'TEMPORAL_ADDRESS', 'TEMPORAL_NAMESPACE', 'ARTIFACT_ROOT', 'API_ORIGIN', ...fields[role]];
  const result: NodeJS.ProcessEnv = Object.fromEntries(keys.filter(key => base[key] !== undefined).map(key => [key, base[key]]));
  if (role === 'io' || role === 'api') result.MODEL_CREDENTIAL_READY = String(base.MODEL_PROTOCOL === 'codex-exec' || Boolean(base.MODEL_API_KEY) || base.MODEL_CREDENTIAL_READY === 'true');
  return result;
}
