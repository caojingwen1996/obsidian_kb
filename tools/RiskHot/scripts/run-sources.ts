import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import { required } from '../src/platform/db.js';
import type { SourceConnector } from '../src/m1/connectors.js';

const flags = new Map<string,string>();
for(let index=2;index<process.argv.length;index+=2){
  const key=process.argv[index],value=process.argv[index+1];
  if(!key || !value || !['--key','--sources','--wait-seconds'].includes(key))throw new Error('Use --key VALUE, --sources comma-separated-keys, --wait-seconds 0..300');
  flags.set(key,value);
}
const key=flags.get('--key')??randomUUID();
if(!/^[\x21-\x7e]{1,100}$/.test(key))throw new Error('KEY_INVALID');
const wait=Number(flags.get('--wait-seconds')??180);
if(!Number.isInteger(wait)||wait<0||wait>300)throw new Error('WAIT_INVALID');
const response=await fetch(`${required('OIDC_ISSUER')}/protocol/openid-connect/token`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(15_000),body:new URLSearchParams({grant_type:'password',client_id:required('OIDC_CLIENT_ID'),client_secret:required('OIDC_CLIENT_SECRET'),username:required('OPERATOR_USERNAME'),password:required('OPERATOR_PASSWORD')})});
if(!response.ok)throw new Error('CLI_LOGIN_FAILED');
const tokens=await response.json() as {access_token:string};
const headers={authorization:`Bearer ${tokens.access_token}`,'content-type':'application/json'};
const origin=required('API_ORIGIN');
const request=async(path:string,options:RequestInit={})=>fetch(origin+path,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(15_000)});
const sourcesResponse=await request('/api/v1/m1/sources');
if(!sourcesResponse.ok)throw new Error(`SOURCES_HTTP_${sourcesResponse.status}`);
type Source={catalog_key:string;state:string;connection:SourceConnector};
const sources=(await sourcesResponse.json() as {items:Source[]}).items;
const selected=flags.has('--sources')?flags.get('--sources')!.split(','):sources.map(item=>item.catalog_key);
if(selected.some(id=>!sources.some(source=>source.catalog_key===id)))throw new Error('SOURCE_UNKNOWN_OR_FORBIDDEN');
const queue=sources.filter(item=>selected.includes(item.catalog_key));
const items:Record<string,unknown>[]=[];
const run=async(source:Source)=>{
  const item:Record<string,unknown>={source_key:source.catalog_key,connection_status:source.connection.readiness};
  try{
    if(source.connection.readiness!=='ready'){item.status=source.connection.readiness;item.reason=source.connection.reason;return;}
    if(source.state!=='ACTIVE'){item.status='disabled';item.reason='SOURCE_DISABLED';return;}
    const submitted=await request('/api/v1/l0/source-fetches',{method:'POST',headers:{'idempotency-key':`${key}/${source.catalog_key}`},body:JSON.stringify({source_key:source.catalog_key,limit:1})});
    const receipt=await submitted.json() as {operation_id?:string;error?:{code:string}};
    if(!submitted.ok){item.status='rejected';item.reason=receipt.error?.code??`HTTP_${submitted.status}`;return;}
    item.operation_id=receipt.operation_id;item.status='queued';
    const deadline=Date.now()+wait*1000;
    while(Date.now()<deadline){
      const status=await request(`/api/v1/l0/operations/${receipt.operation_id}`);if(!status.ok)throw new Error(`STATUS_HTTP_${status.status}`);
      const op=await status.json() as {slice_status:string;reason_code:string|null;children:{version_id:string|null;reason_code:string|null}[]};
      item.status=op.slice_status;item.versions=op.children.map(child=>child.version_id).filter(Boolean);item.reason=op.reason_code??op.children.find(child=>child.reason_code)?.reason_code??null;
      if(['completed','waiting_config','review','recoverable','partial'].includes(op.slice_status))break;
      await setTimeout(1500);
    }
  }catch(error){item.status='command_error';item.reason=error instanceof Error?error.message:'COMMAND_ERROR';}
  finally{items.push(item);console.log(JSON.stringify(item));}
};
// At most two sources advance at once; each retains its own idempotent command.
await Promise.all([0,1].map(async()=>{while(queue.length){const source=queue.shift();if(source)await run(source);}}));
await mkdir('.riskhot/runs',{recursive:true,mode:0o700});
const path=`.riskhot/runs/sources-${Date.now()}.json`;
await writeFile(path,JSON.stringify({checked_at:new Date().toISOString(),request_key:key,items:items.sort((a,b)=>String(a.source_key).localeCompare(String(b.source_key)))},null,2)+'\n',{mode:0o600});
console.log(JSON.stringify({report:path,total:items.length,saved:items.filter(item=>Array.isArray(item.versions)&&item.versions.length).length}));
if(items.some(item=>item.status!=='completed'))process.exitCode=2;
