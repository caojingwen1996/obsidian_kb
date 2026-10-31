import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluationCases} from '../scripts/evaluate-ai07.js';
import {validateTargetInput,validateTargetOutput,type TargetOutput} from '../event-management/target-identity-contracts.js';
const cases=(await evaluationCases()).cases;
const base=cases[0]!.context;
function output():TargetOutput {const refs=base.basis_catalog.map(b=>b.basis_ref);return {object_ref:base.object_ref,decision:'REUSE',matched_target_id:base.candidates[0]!.id,comparisons:[{target_id:base.candidates[0]!.id,identity_match:true,reason:'同一批次',basis_refs:refs}],reason:'同一批次',basis_refs:refs,unresolved_issues:[]};}
test('AI07：合法复用及完整空目录新建',()=>{assert.equal(validateTargetOutput(base,output()).decision,'REUSE');const empty=cases[1]!.context;assert.equal(validateTargetOutput(empty,{...output(),decision:'NEW',matched_target_id:null,comparisons:[],basis_refs:empty.basis_catalog.map(b=>b.basis_ref)}).decision,'NEW');});
test('AI07：拒绝额外字段、错对象、漏比较、陌生依据与单方证据',()=>{
 assert.throws(()=>validateTargetOutput(base,{...output(),target_id:'invented'}),/TARGET_OUTPUT_SCHEMA_INVALID/);
 assert.throws(()=>validateTargetOutput(base,{...output(),object_ref:'other'}),/TARGET_COVERAGE_INVALID/);
 assert.throws(()=>validateTargetOutput(base,{...output(),comparisons:[]}),/TARGET_COVERAGE_INVALID/);
 const x=output();x.comparisons[0]!.basis_refs=['invented'];assert.throws(()=>validateTargetOutput(base,x),/TARGET_BASIS_UNKNOWN/);
 const y=output();y.comparisons[0]!.basis_refs=[y.basis_refs[0]!];assert.throws(()=>validateTargetOutput(base,y),/TARGET_BOTH_EVIDENCE_REQUIRED/);
});
test('AI07：多个true、任一null、停用目标不能复用，未决必须给缺口',()=>{
 const ambiguous=cases[4]!.context,refs=ambiguous.basis_catalog.map(b=>b.basis_ref);
 const x={...output(),basis_refs:refs,comparisons:ambiguous.candidates.map((t,i)=>({target_id:t.id,identity_match:true,reason:'同一批次',basis_refs:[refs[0]!,refs[i+1]!]}))};
 assert.throws(()=>validateTargetOutput(ambiguous,x),/TARGET_REUSE_INVALID/);
 assert.equal(validateTargetOutput(ambiguous,{...x,decision:'UNRESOLVED',matched_target_id:null,unresolved_issues:['重复定义需要处理']}).decision,'UNRESOLVED');
 x.comparisons[1]!.identity_match=null as unknown as boolean;assert.throws(()=>validateTargetOutput(ambiguous,x),/TARGET_REUSE_INVALID/);
 assert.throws(()=>validateTargetOutput(cases[6]!.context,output()),/TARGET_REUSE_INVALID/);
 assert.throws(()=>validateTargetOutput(base,{...output(),decision:'UNRESOLVED',matched_target_id:null}),/TARGET_DECISION_INVALID/);
});
test('AI07：不完整召回、重复候选、错版本或跨候选引用拒绝',()=>{
 const x=structuredClone(base);x.retrieval.truncated=true;assert.throws(()=>validateTargetInput(x),/TARGET_RETRIEVAL_INCOMPLETE/);
 const y=structuredClone(base);y.candidates.push(y.candidates[0]!);assert.throws(()=>validateTargetInput(y),/TARGET_CANDIDATE_INVALID/);
 const z=structuredClone(base);z.basis_catalog[1]!.version='99';assert.throws(()=>validateTargetInput(z),/TARGET_BASIS_OWNER_INVALID/);
 const a=cases[4]!.context,refs=a.basis_catalog.map(b=>b.basis_ref);const o={...output(),basis_refs:refs,comparisons:a.candidates.map(t=>({target_id:t.id,identity_match:false,reason:'范围不同',basis_refs:[refs[0]!,refs[1]!]})),decision:'NEW',matched_target_id:null};assert.throws(()=>validateTargetOutput(a,o),/TARGET_BASIS_OWNER_INVALID/);
});
test('AI07：缺范围、身份不确定或分类无效时不能新建',()=>{
 const empty=structuredClone(cases[1]!.context),o={...output(),decision:'NEW',matched_target_id:null,comparisons:[],basis_refs:empty.basis_catalog.map(b=>b.basis_ref)};
 empty.object.scope_definition=null;assert.throws(()=>validateTargetOutput(empty,o),/TARGET_NEW_INVALID/);
 empty.object.scope_definition='范围';empty.object.uncertainties=['身份待定'];assert.throws(()=>validateTargetOutput(empty,o),/TARGET_NEW_INVALID/);
 empty.object.categories=[{primary_category:'金融资产与金融合约',secondary_category:'货币单位'}];assert.throws(()=>validateTargetInput(empty),/TARGET_CATEGORY_INVALID/);
});
