import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {load} from 'cheerio';
import Fastify from 'fastify';
import {registerWeb} from '../runtime/web.ts';
import {targetRoute,targetHash,targetFormHash,renderTargets,renderTargetDetail,renderTargetForm,renderTargetError} from '../web/targets-view.js';
const target={id:'00000000-0000-4000-8000-000000000001',target_name:'<名称>',aliases:['别名'],categories:[{primary_category:'金融资产与金融合约',secondary_category:'主权债务工具'}],scope_definition:'明确范围<script>bad()</script>',jurisdiction:'测试',is_active:true,definition_version:2,updated_at:'2026-11-05T00:00:00Z',event_count:1};
const route=targetRoute('#targets?q=UST&category='+encodeURIComponent('金融资产与金融合约')+'&offset=20');
test('各功能页面均提供四个带图标入口，全部动态与观测对象归入内容',async()=>{
 for(const file of ['index','events','pipeline','targets']){const $=load(await readFile(`src/web/${file}.html`,'utf8'));const links=$('.sidebar nav a');assert.deepEqual(links.map((_,a)=>$(a).text()).get(),['全部动态','观测对象','信源管理中心','流水线全景']);assert.equal(links.find('svg[aria-hidden="true"]').length,4);assert.equal($('#nav-content').parent().find('a[href="/targets"]').length,1);assert.equal($('.sidebar nav [aria-current="page"]').length,1);}
});
test('新页面资源延续同源CSP，白名单外路径不能读取',async()=>{const app=Fastify();registerWeb(app,{schemaVersion:5});try{for(const url of ['/targets','/m1/targets.js','/m1/targets-view.js','/m1/targets.css','/m1/product-navigation.css']){const r=await app.inject(url);assert.equal(r.statusCode,200,url);assert.match(String(r.headers['content-security-policy']),/script-src 'self'/);}assert.equal((await app.inject('/targets/')).headers.location,'/targets');assert.equal((await app.inject('/m1/target-catalog.ts')).statusCode,404);}finally{await app.close();}});
test('列表/表单/详情往返保留搜索、分类及列表分页，关联事件页码独立',()=>{
 const hash=targetHash({...route,event_offset:20},target.id),parsed=targetRoute(hash);assert.equal(parsed.offset,20);assert.equal(parsed.event_offset,20);assert.equal(parsed.q,'UST');assert.equal(targetHash(parsed),targetHash(route));assert.equal(targetRoute(targetFormHash(route,target.id)).mode,'edit');assert.equal(targetRoute(targetFormHash(route)).mode,'new');
});
test('目录和详情展示真实定义/事件，全部动态链接正确且内容转义',()=>{
 const data={items:[target],total:1,limit:20,offset:0,next_offset:null,categories:['金融资产与金融合约'],can_manage:true};const html=renderTargets(data,route);assert.match(html,/&lt;名称&gt;/);assert.doesNotMatch(html,/<script>/);assert.match(html,/新建观测对象/);
 const detail=renderTargetDetail({target,events:{...data,items:[{id:'event',title:'关联事件',description:'完整描述',event_status:'completed'}]},can_manage:true},route);assert.match(detail,/编辑对象/);assert.match(detail,/\/events#event\/event/);assert.match(detail,/V2/);assert.match(detail,/明确范围&lt;script&gt;/);
});
test('空库、筛选无结果、读取错误与只读账号保持不同状态',()=>{
 const empty={items:[],total:0,limit:20,offset:0,next_offset:null,categories:[]};assert.match(renderTargets(empty,{status:'all'}),/尚无观测对象/);assert.match(renderTargets(empty,{q:'none',status:'all'}),/没有找到匹配的对象/);assert.match(renderTargetError({status:503}),/暂时无法读取/);assert.match(renderTargetError({status:403}),/没有所需的读取权限/);assert.doesNotMatch(renderTargets({...empty,can_manage:false},{status:'all'}),/新建观测对象/);
 const form=renderTargetForm({target,can_manage:true,category_catalog:{金融资产与金融合约:['主权债务工具']}},{...route,mode:'edit'});assert.match(form,/保存修改/);assert.match(form,/name="reason" required/);assert.doesNotMatch(form,/<script>/);assert.match(renderTargetForm({can_manage:false},route),/无法访问观测对象/);
});
