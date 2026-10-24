import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import type { SourceConnector } from '../m1/connectors.js';
import { DomainError } from '../platform/types.js';
import { assertSourceUrl } from './sources.js';

export async function fetchRenderedSource(profile: SourceConnector, value: string, executable = process.env.SOURCE_BROWSER_EXECUTABLE): Promise<Buffer> {
  const url = assertSourceUrl(profile,value).href;
  if (!executable) throw new DomainError('SOURCE_BROWSER_NOT_CONFIGURED',503);
  if (!/(?:Google Chrome for Testing\.app\/Contents\/MacOS\/Google Chrome for Testing|Chromium\.app\/Contents\/MacOS\/Chromium|\/chromium(?:-browser)?)$/u.test(executable)) throw new DomainError('SOURCE_BROWSER_ISOLATION_REQUIRED',503);
  const folder = await mkdtemp(join(tmpdir(),'riskhot-source-browser-'));
  const child = spawn(executable,['--headless=new','--remote-debugging-port=0',`--user-data-dir=${folder}`,'--no-first-run','--no-default-browser-check','--disable-background-networking','about:blank'],{stdio:'ignore'});
  let spawnFailed = false; child.once('error',() => { spawnFailed = true; });
  let socket: WebSocket | undefined;
  const pending = new Map<number,{resolve:(value:any)=>void;reject:(error:Error)=>void}>();
  let sequence = 0;
  try {
    let endpoint: string[] | null = null; const startup = Date.now()+12_000;
    while (Date.now()<startup && !spawnFailed && child.exitCode===null) {
      try { endpoint=(await readFile(join(folder,'DevToolsActivePort'),'utf8')).trim().split('\n');break; } catch { await setTimeout(100); }
    }
    if (!endpoint?.[0] || !endpoint[1]) throw new DomainError('SOURCE_BROWSER_START_FAILED',503);
    socket = new WebSocket(`ws://127.0.0.1:${endpoint[0]}${endpoint[1]}`);
    await new Promise<void>((resolve,reject) => { socket!.addEventListener('open',()=>resolve(),{once:true});socket!.addEventListener('error',()=>reject(new DomainError('SOURCE_BROWSER_START_FAILED',503)),{once:true}); });
    let sessionId: string | undefined;
    const send = async (method:string,params:object={},session = sessionId): Promise<any> => {
      const id=++sequence;
      const result=new Promise((resolve,reject)=>pending.set(id,{resolve,reject}));
      socket!.send(JSON.stringify({id,method,params,...(session?{sessionId:session}:{})}));
      const timeout=globalThis.setTimeout(()=>{ const item=pending.get(id);if(item){pending.delete(id);item.reject(new DomainError('SOURCE_BROWSER_TIMEOUT',502));} },15_000);
      try { return await result; } finally { globalThis.clearTimeout(timeout); }
    };
    socket.addEventListener('message',event=>{
      const message=JSON.parse(String(event.data));
      if (message.id) { const call=pending.get(message.id);pending.delete(message.id);if(message.error)call?.reject(new DomainError('SOURCE_BROWSER_PROTOCOL_FAILED',502));else call?.resolve(message.result); }
      if (message.method==='Fetch.requestPaused') {
        try { assertSourceUrl(profile,message.params.request.url);void send('Fetch.continueRequest',{requestId:message.params.requestId}).catch(()=>{}); }
        catch { void send('Fetch.failRequest',{requestId:message.params.requestId,errorReason:'BlockedByClient'}).catch(()=>{}); }
      }
    });
    socket.addEventListener('close',()=>{for(const call of pending.values())call.reject(new DomainError('SOURCE_BROWSER_CLOSED',502));pending.clear();});
    const {targetId}=await send('Target.createTarget',{url:'about:blank'},undefined);
    sessionId=(await send('Target.attachToTarget',{targetId,flatten:true},undefined)).sessionId;
    await send('Page.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*',resourceType:'Document',requestStage:'Request'}]});
    await send('Page.navigate',{url});
    const selector=JSON.stringify(profile.browser!.waitFor);const deadline=Date.now()+15_000;
    while(Date.now()<deadline){
      const result=await send('Runtime.evaluate',{expression:`Boolean(document.querySelector(${selector}))`,returnByValue:true});
      if(result.result?.value){
        const page=await send('Runtime.evaluate',{expression:'JSON.stringify({url:location.href,html:document.documentElement.outerHTML})',returnByValue:true});
        const body=JSON.parse(page.result.value);assertSourceUrl(profile,body.url);
        const raw=Buffer.from(body.html);if(raw.byteLength>1_048_576)throw new DomainError('RAW_TOO_LARGE',413);return raw;
      }
      await setTimeout(200);
    }
    throw new DomainError('SOURCE_RENDER_CONTENT_MISSING',502);
  } finally {
    socket?.close();child.kill('SIGTERM');
    const deadline=Date.now()+3000;while(child.exitCode===null && child.signalCode===null && !spawnFailed && Date.now()<deadline)await setTimeout(50);
    if(child.exitCode===null && child.signalCode===null && !spawnFailed)child.kill('SIGKILL');
    await rm(folder,{recursive:true,force:true});
  }
}
