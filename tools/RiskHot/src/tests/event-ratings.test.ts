import test from 'node:test';import assert from 'node:assert/strict';import {prepareRating,validateRating,calculateM} from '../event-management/ratings.js';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {digest,validateTaskOutput} from '../event-management/contracts.js';
import {financialMeaningInstructions,loadTaskPackage} from '../event-management/task-packages.js';
const input={assessment_scope:{region:'中国'},research_horizon:{term:'短期'},method_version:'text-draft-v1',basis_revision_no:1};
const output={assessment_scope:input.assessment_scope,research_horizon:input.research_horizon,method_version:input.method_version,dimensions:[],financial_usages:[],reasoning_summary:'基于原文分析',limitations:['没有批准量化规则']};
test('来源与重复跳过评价，文字草案为空分且范围不可漂移',()=>{assert.equal(prepareRating('SOURCE_ADDITION'),false);assert.equal(prepareRating('DUPLICATE'),false);assert.equal(prepareRating('NEW_EVENT'),true);const result=validateRating(input,output);assert.equal(result.m,null);assert.equal(result.rating_status,'draft');assert.throws(()=>validateRating(input,{...output,assessment_scope:{region:'美国'}}),/RATING_CONTEXT_MISMATCH/);assert.throws(()=>validateRating(input,{...output,dimensions:[{dimension_key:'x',score:4,reason:'猜测',evidence_refs:[]}]}),/RATING_METHOD_UNAPPROVED/);});
test('仅显式批准方法可确定性计算，缺项和非法值不补默认',()=>{const method={approved:true,weights:{a:0.6,b:0.4}};assert.equal(calculateM(method,{a:5,b:0}),60);assert.equal(calculateM({...method,approved:false},{a:5,b:0}),null);assert.throws(()=>calculateM(method,{a:5}),/RATING_DIMENSIONS_MISSING/);assert.throws(()=>calculateM(method,{a:6,b:0}),/RATING_VALUE_INVALID/);});
test('AI-05 运行正文与文档保持一致，修订和完整提示词进入摘要',async()=>{
 const document=await readFile(new URL('../../docs/system-design/03-系统功能架构/AI任务与提示词/AI-05 金融意义评级提示词 V0.1.md',import.meta.url),'utf8');
 assert.equal(document.match(/```text\n([\s\S]*?)\n```/)?.[1],financialMeaningInstructions.trim());
 const task=loadTaskPackage('AI-05','f02-fact-draft-v2');
 assert.equal(task.prompt_revision,'ai05-domain-text-v1');
 assert.ok(task.prompt.endsWith(financialMeaningInstructions));
 const {digest:stored,...content}=task;
 assert.equal(stored,digest(content));
 assert.notEqual(stored,digest({...content,prompt_revision:'previous'}));
 assert.notEqual(stored,digest({...content,prompt:'旧提示词'}));
 assert.equal(loadTaskPackage('AI-04','f02-fact-draft-v2').prompt_revision,undefined);
});
test('五维文字草案可经现有契约接纳，越界评分、总分和伪造引文被拒绝',()=>{
 const version=randomUUID(),segment=randomUUID();
 const text='机构完成560亿元7天期逆回购，利率1.40%，满足本次交易商需求。';
 const evidence={information_version_id:version,segment_id:segment,start_cp:0,end_cp:Array.from(text).length,quote:text};
 const context={version_id:version,segments:[{id:segment,text}],event_ids:[],target_ids:[],variable_ids:[]};
 const reasons=[
  ['底层变量关联','涉及短期货币供给；未提供正式变量定义，不能确定后续传导。'],
  ['影响程度','操作额560亿元；缺到期量和比较基准，不能判断净投放与影响强弱。'],
  ['持续时间','工具期限7天；不能据此确定全部经济影响持续时间。'],
  ['影响范围','原文仅支持本次交易商需求得到满足；不外推全社会融资条件。'],
  ['作用落地','操作已完成；尚无经济效果观测结果。'],
 ];
 const proposal={...output,dimensions:reasons.map(([dimension_key,reason])=>({dimension_key:dimension_key!,reason:reason!,score:null,evidence_refs:[evidence]})),financial_usages:['financing'],reasoning_summary:'中国短期范围内，初评关注本次流动性供给和融资条件观察；缺到期量，不能判断净投放。',limitations:['五维为候选框架，量化锚点、权重及等级阈值未批准。','未提供正式观测对象与变量定义、历史利率或到期量。']};
 assert.equal(validateTaskOutput('AI-05',proposal,context).valid,true);
 const saved=validateRating(input,proposal);
 assert.equal(saved.m,null);assert.equal(saved.rating_status,'draft');assert.equal(saved.dimensions.length,5);
 assert.throws(()=>validateRating(input,{...proposal,dimensions:proposal.dimensions.map(d=>({...d,score:3}))}),/RATING_METHOD_UNAPPROVED/);
 for(const extra of [{m:60},{financial_significance_m:60},{rating_status:'confirmed'}])assert.equal(validateTaskOutput('AI-05',{...proposal,...extra},context).valid,false);
 for(const changed of [{quote:'央行降息'},{information_version_id:randomUUID()}]){
  const bad={...proposal,dimensions:[{...proposal.dimensions[0]!,evidence_refs:[{...evidence,...changed}]}]};
  assert.equal(validateTaskOutput('AI-05',bad,context).valid,false);
 }
});
