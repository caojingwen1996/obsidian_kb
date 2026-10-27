import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {validateTaskOutput} from '../event-management/contracts.js';
import {loadTaskPackage} from '../event-management/task-packages.js';
const version=randomUUID(), segment=randomUUID(), event=randomUUID();
const evidence={information_version_id:version,segment_id:segment,start_cp:0,end_cp:4,quote:'机构宣布'};
const context={version_id:version,segments:[{id:segment,text:'机构宣布措施。'}],event_ids:[event],target_ids:[],variable_ids:[]};
const candidate={local_key:'a',title:'机构宣布措施',description:'一项实际措施',subject_name:'机构',action:'宣布',event_type:null,target_clues:[],event_status:'announced',event_time:null,evidence_refs:[evidence],missing_fields:[]};
test('完整抽取拒绝超限、重复键、坏引文和额外字段，保留未知时间',()=>{
 assert.equal(validateTaskOutput('AI-01',{candidates:[candidate],warnings:[]},context).valid,true);
 for(const payload of [{candidates:Array(51).fill(candidate),warnings:[]},{candidates:[candidate,candidate],warnings:[]},{candidates:[{...candidate,evidence_refs:[{...evidence,quote:'机构取消'}]}],warnings:[]},{candidates:[],warnings:[],event_id:event}])assert.equal(validateTaskOutput('AI-01',payload,context).valid,false);
});
test('归组仅接受召回中的真实ID，未解决必须列出问题',()=>{
 const output={decision:'REUSE',matched_event_id:event,comparisons:[],reason:'同一决定',evidence_refs:[evidence],unresolved_issues:[]};
 assert.equal(validateTaskOutput('AI-02',output,context).valid,true);
 assert.equal(validateTaskOutput('AI-02',{...output,matched_event_id:randomUUID()},context).valid,false);
 assert.equal(validateTaskOutput('AI-02',{...output,decision:'NEW'},context).valid,false);
 assert.equal(validateTaskOutput('AI-02',{...output,decision:'UNRESOLVED',matched_event_id:null},context).valid,false);
});
test('直接关系合法空值、增量和文字评级结构严格校验',()=>{
 assert.equal(validateTaskOutput('AI-03',{targets:[],variables:[],definition_candidates:[],unresolved_issues:[]},context).valid,true);
 assert.equal(validateTaskOutput('AI-04',{classification:'DUPLICATE',changes:[],source_evidence_refs:[evidence],reason:'重复',unresolved_issues:[]},context).valid,true);
 assert.equal(validateTaskOutput('AI-05',{assessment_scope:{},research_horizon:{},method_version:'draft',dimensions:[],financial_usages:[],reasoning_summary:'文字评价',limitations:['未量化']},context).valid,true);
});
test('任务包版本与内容固定，缺绑定不能静默选最新',()=>{
 const ref=loadTaskPackage('AI-02','f02-local-draft-v1');
 assert.equal(ref.publication_status,'draft');assert.match(ref.digest,/^[a-f0-9]{64}$/);
 assert.throws(()=>loadTaskPackage('AI-02','latest'),/TASK_PACKAGE_NOT_BOUND/);
});
