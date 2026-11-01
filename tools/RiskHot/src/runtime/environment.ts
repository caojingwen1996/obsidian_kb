export type RuntimeRole = 'workflow' | 'io' | 'model' | 'relay' | 'api' | 'scheduler' | 'business';
const fields: Record<RuntimeRole, string[]> = {
  business: ['SCHEDULER_ACTOR','SCHEDULE_ENABLED','SCHEDULE_SOURCES','BUSINESS_MODEL_CODEX_HOME','CODEX_EXECUTABLE','BUSINESS_DATABASE_URL','BUSINESS_HANDLERS_MODULE','MODEL_API_KEY','MODEL_PROTOCOL','MODEL_ENDPOINT','MODEL_NAME','SOURCE_BROWSER_EXECUTABLE'],
  workflow: [], io: ['IO_DATABASE_URL', 'MODEL_PROTOCOL', 'MODEL_ENDPOINT', 'MODEL_NAME','SOURCE_BROWSER_EXECUTABLE'],
  model: ['MODEL_DATABASE_URL', 'MODEL_API_KEY', 'MODEL_PROTOCOL', 'MODEL_NAME', 'CODEX_EXECUTABLE', 'CODEX_HOME'], relay: ['RELAY_DATABASE_URL'],
  api: ['DATABASE_URL', 'AUTH_MODE', 'OIDC_ISSUER', 'OIDC_CLIENT_ID', 'OIDC_CLIENT_SECRET', 'MODEL_PROTOCOL', 'MODEL_ENDPOINT', 'MODEL_NAME'],
  scheduler: ['IO_DATABASE_URL', 'MODEL_PROTOCOL', 'MODEL_NAME', 'CODEX_EXECUTABLE', 'CODEX_HOME', 'SCHEDULE_INTERVAL_SECONDS', 'SCHEDULE_SOURCES'],
};
export function runtimeEnvironment(role: RuntimeRole, base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const keys = ['EXECUTION_ENGINE', 'PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'TZ', 'TEMPORAL_ADDRESS', 'TEMPORAL_NAMESPACE', 'ARTIFACT_ROOT', 'API_ORIGIN', ...fields[role]];
  const result: NodeJS.ProcessEnv = Object.fromEntries(keys.filter(key => base[key] !== undefined).map(key => [key, base[key]]));
  if (role === 'io' || role === 'api') result.MODEL_CREDENTIAL_READY = String(base.MODEL_PROTOCOL === 'codex-exec' || Boolean(base.MODEL_API_KEY) || base.MODEL_CREDENTIAL_READY === 'true');
  return result;
}

export interface RuntimeProcess {name:RuntimeRole;file:string;argument?:string}
export function runtimeProcesses(env:NodeJS.ProcessEnv=process.env):RuntimeProcess[]{
 if(env.EXECUTION_ENGINE==='pg-boss')return [{name:'business',file:'src/runtime/business-worker-entry.ts'},{name:'api',file:'src/runtime/server.ts'}];
 if(env.EXECUTION_ENGINE && env.EXECUTION_ENGINE!=='temporal')throw new Error('EXECUTION_ENGINE_INVALID');
 return [
  ...(['workflow','io','model'] as const).map(name=>({name,file:'src/runtime/worker.ts',argument:name})),
  {name:'relay',file:'src/runtime/relay.ts'},{name:'api',file:'src/runtime/server.ts'},
  ...(env.SCHEDULE_ENABLED==='true'?[{name:'scheduler' as const,file:'src/runtime/scheduler.ts'}]:[])
 ];
}
