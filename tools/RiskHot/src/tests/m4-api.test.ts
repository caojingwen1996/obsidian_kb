import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import Fastify from 'fastify';
import {Ajv2020} from 'ajv/dist/2020.js';
import {registerM4} from '../runtime/m4.js';
import {registerTargets} from '../runtime/targets.js';
import {DomainError} from '../platform/types.js';
import {prepared,directory,object} from './m4-fixture.js';
import {values} from '../financial-objects/contracts.js';
import {fixture} from './f02-fixture.js';
import {applyM4Migration,inspectM4Migration} from '../platform/m4-migration.js';
import {applyF02Migration} from '../platform/f02-migration.js';

test('API AC23/24/25/26/30：真实路由职责隔离、旧入口关闭、字段验证和批量部分成功',async()=>{const x=await prepared();const app=Fastify(),ajv=new Ajv2020({strict:true,coerceTypes:false,removeAdditional:false});app.setValidatorCompiler(({schema})=>ajv.compile(schema as object));app.decorateRequest('actor','operator');app.addHook('onRequest',async r=>{r.actor=String(r.headers['x-test-actor']??'operator');});app.setErrorHandler((e:any,r,reply)=>reply.code(e instanceof DomainError?e.status:e.validation?400:500).send({error:{code:e.code}}));registerM4(app,x.repo);registerTargets(app,x.repo);
 const send=(url:string,body:unknown,actor='operator',method:'POST'|'PUT'='POST',key=randomUUID())=>app.inject({method,url,headers:{'x-test-actor':actor,'idempotency-key':key},payload:body as any});
 try{
  const root=(await send('/api/v1/m4/configs',directory())).json().config;
  const a=(await send('/api/v1/m4/configs',object(root.id))).json().config,b=(await send('/api/v1/m4/configs',object(root.id,'欧元'))).json().config;
  assert.equal((await send('/api/v1/m4/configs',directory('禁止'),'observer')).statusCode,403);
  assert.equal((await send('/api/v1/m4/observations',{config_id:a.id,expected_config_version:'1',reason:'禁止'},'configurer')).statusCode,403);
  const body={items:[{config_id:a.id,expected_config_version:'1',reason:'有效新项'},{config_id:b.id,expected_config_version:'999',reason:'失效项'}]},key=randomUUID();const first=await send('/api/v1/m4/observations/batch',body,'operator','POST',key);assert.equal(first.statusCode,200,first.body);assert.deepEqual(first.json().results.map((r:any)=>r.outcome),['added','failed']);assert.deepEqual((await send('/api/v1/m4/observations/batch',body,'operator','POST',key)).json(),first.json());
  assert.equal((await x.db.query('SELECT count(*)::int n FROM information.shared_observation')).rows[0].n,1);
  const target={target_name:'禁止旧写入口',aliases:[],categories:object(root.id).categories,jurisdiction:'美国',scope_definition:'旧写入口必须关闭',is_active:true,reason:'切换验收'};
  const legacy=await send('/api/v1/targets',target);assert.equal(legacy.statusCode,409);assert.equal(legacy.json().error.code,'M4_MANUAL_TARGET_RETIRED');assert.equal((await x.db.query('SELECT count(*)::int n FROM information.target')).rows[0].n,0);
  for(const bad of [{...directory(),sort_order:4},{...directory(),actor:'spoof'},{...directory(),name:''}])assert.equal((await send('/api/v1/m4/configs',bad)).statusCode,400);
  for(const primary_category of ['constructor','toString']){const invalid=await send('/api/v1/m4/configs',{...object(root.id),categories:[{primary_category,secondary_category:'货币单位'}]});assert.equal(invalid.statusCode,422);assert.equal(invalid.json().error.code,'M4_CATEGORY_INVALID');}
  for(const query of ['limit=101','offset=-1','status=invalid','unknown=1'])assert.equal((await app.inject('/api/v1/m4/configs?'+query)).statusCode,400);
  const create=await send('/api/v1/m4/configs',directory('大整数'));assert.equal(typeof create.json().config.config_version,'string');
 }finally{await app.close();await x.close();}
});

test('并发相互移动、过期影响确认和移入停用分支的原子联动',async()=>{const x=await prepared();try{
 const a=(await x.save(directory('A'))).config,b=(await x.save(directory('B'))).config;
 const race=await Promise.allSettled([x.save({...values(a),parent_id:b.id,expected_config_version:a.config_version,reason:'移动A'},a.id),x.save({...values(b),parent_id:a.id,expected_config_version:b.config_version,reason:'移动B'},b.id)]);assert.equal(race.filter(r=>r.status==='fulfilled').length,1);assert.equal(race.filter(r=>r.status==='rejected'&&r.reason.code==='M4_TREE_CYCLE').length,1);
 const live=(await x.save(directory('正常'))).config,off=(await x.save({...directory('关闭'),status:'disabled'})).config,c=(await x.save(object(live.id))).config;
 const o=(await x.service.add('operator',{config_id:c.id,expected_config_version:'1',reason:'观察'},randomUUID())).observation;
 const input={...values(c),parent_id:off.id,expected_config_version:c.config_version,reason:'移入关闭分支'};
 const preview=await x.service.preview('operator',c.id,input);assert.equal(preview.observations.length,1);
 await x.service.changeObservation('operator',o.id,{action:'note',note:'新备注使影响依据过期',expected_version:'1',reason:'更新'},randomUUID());
 await assert.rejects(()=>x.save({...input,impact_token:preview.impact_token},c.id),/M4_IMPACT_CONFIRMATION_REQUIRED/);
 assert.equal((await x.service.configDetail('reader',c.id)).config.parent_id,live.id);assert.equal((await x.service.observationDetail('reader',o.id)).observation.state,'active');
 const fresh=await x.service.preview('operator',c.id,input);await x.save({...input,impact_token:fresh.impact_token},c.id);const after=await x.service.observationDetail('reader',o.id);assert.equal(after.observation.state_reason,'config_unavailable');assert.equal(after.config.id,c.id);assert.equal(after.adopted_snapshot.id,c.current_snapshot_id);assert.equal(after.observation.note,'新备注使影响依据过期');
}finally{await x.close();}});

test('迁移schema8前置、事务中途失败回滚、重复执行与旧事实保存',async()=>{const x=await fixture(true);try{
 await assert.rejects(()=>applyM4Migration(x.db),/M4_SCHEMA8_REQUIRED/);await applyF02Migration(x.db);const before=await inspectM4Migration(x.db);
 await assert.rejects(()=>applyM4Migration(x.db,{beforeCommit:async()=>{throw Error('故障注入');}}),/故障注入/);
 assert.equal((await inspectM4Migration(x.db)).m4_applied,false);assert.equal((await x.db.query("SELECT to_regclass('information.financial_object_config') t")).rows[0].t,null);
 const after=await applyM4Migration(x.db);assert.deepEqual(after.counts,before.counts);assert.deepEqual((await applyM4Migration(x.db)).counts,after.counts);
 assert.equal((await x.db.query('SELECT count(*)::int n FROM information.financial_object_config')).rows[0].n,0);
}finally{await x.close();}});

test('直接受控函数调用不能伪造配置联动；观察状态前提与数据库历史审计强制执行',async()=>{const x=await prepared();try{
 const root=(await x.save(directory())).config,c=(await x.save(object(root.id))).config,o=(await x.service.add('operator',{config_id:c.id,expected_config_version:'1',reason:'观察'},randomUUID())).observation;
 const forged={...o,state:'paused',state_reason:'config_unavailable',version:'2',updated_by:'configurer',updated_at:new Date().toISOString()};
 await assert.rejects(()=>x.role.query('SELECT platform.m4_persist($1,$2,$3)',['configurer','config',{reason:'伪造联动',observations:[forged]}]),/M4_COMMAND_INVALID/);
 assert.equal((await x.service.observationDetail('reader',o.id)).observation.state,'active');assert.equal((await x.service.observationDetail('reader',o.id)).history.length,1);
 await assert.rejects(()=>x.role.query('SELECT platform.m4_persist($1,$2,$3)',['observer','observation',{reason:'伪造自动暂停',observations:[{...forged,updated_by:'observer'}]}]),/M4_STATE_INVALID/);
 const paused={...forged,state_reason:'manual',updated_by:'observer'};await x.role.query('SELECT platform.m4_persist($1,$2,$3)',['observer','observation',{reason:'通过受控入口手工暂停',observations:[paused]}]);
 const d=await x.service.observationDetail('reader',o.id);assert.equal(d.history.length,2);assert.equal(d.history[0].actor,'observer');assert.equal((await x.db.query("SELECT count(*)::int n FROM platform.audit_log WHERE owner_id=$1 AND action='m4-controlled-observation'",[o.id])).rows[0].n,2);
 const off=(await x.save({...directory('停用'),status:'disabled'})).config,draft=(await x.save(object(off.id,'另一对象'))).config;
 await assert.rejects(()=>x.role.query('SELECT platform.m4_persist($1,$2,$3)',['observer','observation',{reason:'绕过不可选资格',observations:[{...o,id:randomUUID(),config_id:draft.id,adopted_snapshot_id:draft.current_snapshot_id,created_by:'observer',updated_by:'observer'}]}]),/M4_CONFIG_UNAVAILABLE/);
}finally{await x.close();}});

test('M4迁移门禁切换四页导航与观察页面，schema8保留旧入口',async()=>{
 const {registerWeb}=await import('../runtime/web.js');
 for(const migrated of [false,true]){const app=Fastify();try{registerWeb(app,{schemaVersion:5,m4:migrated});
  for(const route of ['/m1','/events','/pipeline']){const response=await app.inject(route);assert.equal(response.statusCode,200);assert.equal(response.body.includes('href="/m4"'),migrated,route);}
  const target=await app.inject('/targets');assert.equal(target.body.includes('src="/m1/m4.js"'),migrated);assert.equal((await app.inject('/m4')).statusCode,migrated?200:404);
 }finally{await app.close();}}
});
