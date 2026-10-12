// Generated API client; the server remains the authorization authority.
import type { CommandInputs, CommandName } from './commands.js';
export class ApiError extends Error { constructor(public code:string,message:string,public status:number){super(message);} }
export async function query<T>(path:string):Promise<T>{const r=await fetch('/api/v1'+path,{credentials:'include'});const d=await r.json();if(!r.ok)throw new ApiError(d.code??'HTTP_ERROR',d.detail??'请求失败',r.status);return d as T;}
export async function command<K extends CommandName>(name:K,input:CommandInputs[K],csrf:string,key=crypto.randomUUID()):Promise<unknown>{const r=await fetch('/api/v1/commands/'+name,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf,'Idempotency-Key':key},body:JSON.stringify(input)});const d=await r.json();if(!r.ok)throw new ApiError(d.code??'HTTP_ERROR',d.detail??'操作失败',r.status);return d;}
