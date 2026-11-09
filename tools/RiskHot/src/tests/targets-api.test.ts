import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import Fastify from 'fastify';
import {Ajv2020} from 'ajv/dist/2020.js';
import {fixture} from './f02-fixture.js';
import {applyF02Migration} from '../platform/f02-migration.js';
import {Repository} from '../information-ingestion/processing/repository.js';
import {ArtifactStore} from '../platform/artifacts.js';
import {DomainError} from '../platform/types.js';
import {grantIngestionRoles} from '../platform/ingestion-grants.js';
import {registerTargets} from '../runtime/targets.js';
import {transaction} from '../platform/db.js';

async function prepared(){
 const x=await fixture(true);await applyF02Migration(x.db);await grantIngestionRoles(x.db);
 await x.db.query("UPDATE platform.actors SET permissions=permissions||ARRAY['event_review'] WHERE subject='operator'");
 const role=new Pool({connectionString:x.db.options.connectionString,options:'-c role=riskhot_api'});
 const app=Fastify(),ajv=new Ajv2020({strict:true,coerceTypes:false,removeAdditional:false});app.setValidatorCompiler(({schema})=>ajv.compile(schema as object));
 app.decorateRequest('actor','operator');app.addHook('onRequest',async r=>{r.actor=String(r.headers['x-test-actor']??'operator');});
 app.setErrorHandler((error:any,_request,reply)=>reply.code(error instanceof DomainError?error.status:error.validation?400:500).send({error:{code:error.code,message:error.message}}));
 registerTargets(app,new Repository(role,new ArtifactStore('/tmp/riskhot-targets-api-unused')));
 const a=randomUUID(),b=randomUUID(),inactive=randomUUID();
 for(const [id,name,aliases,categories,active] of [
  [a,'美国国债',['UST'],[{primary_category:'金融资产与金融合约',secondary_category:'主权债务工具'}],true],
  [b,'美元100%',['百分号_原样'],[{primary_category:'货币与货币形态',secondary_category:'货币单位'}],true],
  [inactive,'中国货币市场',[],[{primary_category:'金融市场与基础设施',secondary_category:'货币市场'}],false]
 ] as const)await x.db.query('INSERT INTO information.target(id,target_name,aliases,categories,scope_definition,is_active) VALUES($1,$2,$3,$4,$5,$6)',[id,name,aliases,JSON.stringify(categories),'隔离测试对象，不含其他对象',active]);
 await x.db.query("INSERT INTO information.event_target(event_id,target_id,relation_note) VALUES($1,$2,'本次事件已核定关联')",[x.e,a]);
 await x.db.query("INSERT INTO platform.actors VALUES('restricted',ARRAY['read'],ARRAY['test']),('no-read',ARRAY[]::text[],ARRAY['*']),('no-source',ARRAY['read'],ARRAY[]::text[])");
 return {...x,app,a,b,inactive,async close(){await app.close();await role.end();await x.close();}};
}
test('观测对象API以实际API角色读取，名称/别名、分类、状态、分页和通配字面值可组合',async()=>{const x=await prepared();try{
 const list=await x.app.inject('/api/v1/targets?limit=2');assert.equal(list.statusCode,200,list.body);assert.equal(list.json().total,3);assert.equal(list.json().items.length,2);assert.equal(list.json().next_offset,2);
 const next=await x.app.inject('/api/v1/targets?offset=2&limit=2');assert.equal(next.json().items.length,1);assert.equal(next.json().next_offset,null);assert.equal(new Set([...list.json().items,...next.json().items].map(t=>t.id)).size,3);
 for(const [query,id] of [['q=UST',x.a],['q='+encodeURIComponent('%'),x.b],['q='+encodeURIComponent('_'),x.b],['category='+encodeURIComponent('金融资产与金融合约'),x.a],['status=inactive',x.inactive]]){const r=await x.app.inject('/api/v1/targets?'+query);assert.equal(r.statusCode,200,r.body);assert.deepEqual(r.json().items.map((t:any)=>t.id),[id]);}
 assert.equal((await x.app.inject('/api/v1/targets?q=UST&status=inactive')).json().total,0);
 for(const query of ['offset=-1','limit=101','status=unknown','category=unknown','unknown=1'])assert.equal((await x.app.inject('/api/v1/targets?'+query)).statusCode,400,query);
 assert.equal((await x.app.inject('/api/v1/targets/'+randomUUID())).statusCode,404);
 assert.equal((await x.app.inject('/api/v1/targets/not-a-uuid')).statusCode,400);
}finally{await x.close();}});
test('目录数量与详情都排除任一来源无权读取的关联事件，定义目录不泄漏事件',async()=>{const x=await prepared();try{
 const detail=await x.app.inject('/api/v1/targets/'+x.a);assert.equal(detail.statusCode,200,detail.body);assert.equal(detail.json().events.total,1);assert.equal(detail.json().events.items[0].id,x.e);
 const material=(await x.db.query("WITH s AS(INSERT INTO m1.sources(catalog_key,name,url,metadata,state) VALUES('private-source','受限','','{}','ACTIVE') RETURNING id) INSERT INTO infomation.ingestion_material(source_id,identity,content,content_digest,normalizer_rule) SELECT id,'private','{}',repeat('b',64),'test' FROM s RETURNING id")).rows[0].id;
 await transaction(x.db,async tx=>{const segment=randomUUID();await tx.query("INSERT INTO infomation.ingestion_material_segments VALUES($1,$2,0,'受限证据','{}')",[material,segment]);await tx.query("INSERT INTO information.fact_material(fact_id,material_id,relation_role) VALUES($1,$2,'supporting')",[x.f,material]);await tx.query("INSERT INTO information.fact_evidence(fact_id,information_id,material_id,material_version,material_digest,segment_id,start_cp,end_cp,quote,evidence_role) VALUES($1,$2,$2,1,repeat('b',64),$3,0,4,'受限证据','supporting')",[x.f,material,segment]);});
 const headers={'x-test-actor':'restricted'};
 const list=await x.app.inject({url:'/api/v1/targets?q=UST',headers});assert.equal(list.statusCode,200,list.body);assert.equal(list.json().items[0].event_count,0);
 const restricted=await x.app.inject({url:'/api/v1/targets/'+x.a,headers});assert.equal(restricted.statusCode,200);assert.equal(restricted.json().events.total,0);assert.deepEqual(restricted.json().events.items,[]);assert.ok(!restricted.body.includes(x.e));
 const full=await x.app.inject('/api/v1/targets/'+x.a);assert.equal(full.json().events.total,1);
 await x.db.query("UPDATE platform.actors SET source_keys=ARRAY['test'] WHERE subject='operator'");assert.equal((await x.app.inject('/api/v1/targets/'+x.a)).json().events.total,0);
}finally{await x.close();}});
test('观测对象查询必须具备read权限，只读账号无法维护对象',async()=>{const x=await prepared();try{
 for(const url of ['/api/v1/targets','/api/v1/targets/'+x.a])assert.equal((await x.app.inject({url,headers:{'x-test-actor':'no-read'}})).statusCode,403);
 assert.equal((await x.app.inject({url:'/api/v1/targets',headers:{'x-test-actor':'restricted'}})).json().can_manage,false);
 assert.equal((await x.app.inject({method:'POST',url:'/api/v1/targets',headers:{'x-test-actor':'restricted','idempotency-key':'denied'},payload:draft})).statusCode,403);
 assert.equal((await x.db.query('SELECT count(*)::int n FROM information.target')).rows[0].n,3);
}finally{await x.close();}});
const draft={target_name:'新增测试对象',aliases:['测试别名'],categories:[{primary_category:'金融资产与金融合约',secondary_category:'主权债务工具'}],jurisdiction:'测试地区',scope_definition:'仅限隔离测试中的单一对象',is_active:true,reason:'验证人工维护'};
test('人工新建及编辑绑定幂等键和版本，重复及并发不会覆盖或建重',async()=>{const x=await prepared();try{
 const create={method:'POST' as const,url:'/api/v1/targets',headers:{'idempotency-key':'create'},payload:draft};
 const first=await x.app.inject(create);assert.equal(first.statusCode,201,first.body);const target=first.json().target;assert.equal(target.definition_version,1);
 assert.deepEqual((await x.app.inject(create)).json(),first.json());
 assert.equal((await x.app.inject({...create,headers:{'idempotency-key':'duplicate'}})).json().error.code,'TARGET_ALREADY_EXISTS');
 assert.equal((await x.app.inject({...create,payload:{...draft,reason:'不同内容'}})).json().error.code,'IDEMPOTENCY_CONFLICT');
 const body={...draft,target_name:'更新后的名称',expected_version:1,reason:'修改测试名称'};
 const update={method:'PUT' as const,url:'/api/v1/targets/'+target.id,headers:{'idempotency-key':'edit'},payload:body};
 const edited=await x.app.inject(update);assert.equal(edited.statusCode,200,edited.body);assert.equal(edited.json().target.definition_version,2);
 assert.deepEqual((await x.app.inject(update)).json(),edited.json());
 const stale=await x.app.inject({...update,headers:{'idempotency-key':'stale'},payload:{...body,target_name:'过期覆盖'}});assert.equal(stale.statusCode,409);assert.equal(stale.json().error.code,'TARGET_VERSION_CONFLICT');
 const latest=(await x.app.inject('/api/v1/targets/'+target.id)).json().target;assert.equal(latest.target_name,'更新后的名称');
 const noChange=await x.app.inject({...update,headers:{'idempotency-key':'no-change'},payload:{...body,expected_version:2}});assert.equal(noChange.json().changed,false);assert.equal(noChange.json().target.definition_version,2);
 assert.equal((await x.db.query("SELECT count(*)::int n FROM platform.audit_log WHERE owner_id=$1 AND action IN ('target-catalog-created','target-catalog-edited')",[target.id])).rows[0].n,2);
 await x.db.query("UPDATE platform.actors SET permissions=ARRAY['read'] WHERE subject='operator'");assert.equal((await x.app.inject(create)).statusCode,403);
}finally{await x.close();}});
test('人工维护拒绝无效分类和同范围重复对象，允许同名但范围明确不同',async()=>{const x=await prepared();try{
 const post=(payload:unknown,key:string)=>x.app.inject({method:'POST',url:'/api/v1/targets',headers:{'idempotency-key':key},payload:payload as any});
 const first=await post(draft,'one');assert.equal(first.statusCode,201,first.body);
 assert.equal((await post({...draft,categories:[{primary_category:'金融资产与金融合约',secondary_category:'货币单位'}]},'bad')).statusCode,422);
 assert.equal((await post({...draft,aliases:['重复','重复 ']},'aliases')).statusCode,422);
 assert.equal((await post({...draft,scope_definition:'另一明确范围'},'other')).statusCode,201);
 const concurrent=await Promise.all(['race-a','race-b'].map(key=>post({...draft,target_name:'并发新建'},key)));assert.deepEqual(concurrent.map(r=>r.statusCode).sort(),[201,409]);
 assert.equal((await x.db.query("SELECT count(*)::int n FROM information.target WHERE target_name='并发新建'")).rows[0].n,1);
}finally{await x.close();}});
