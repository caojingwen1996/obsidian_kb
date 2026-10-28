import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseDisplayTime,parsePublication,displaySortValue,displayTimeRank,timelineSources,type TimelineEvidence} from '../event-management/timeline.js';
const row=(patch:Partial<TimelineEvidence>={}):TimelineEvidence=>({material_id:'m',version_id:'v',source_id:'s',catalog_key:'source',name:'信源',first_collected_at:'2026-10-27T08:00:00.000Z',published_at_text:'2026-10-27T08:00:00.000Z',relation_created_at:'2026-10-27T09:00:00Z',...patch});
test('72小时连续阈值包含0与恰好72小时，晚1ms采用原文时间',()=>{
 const p='2026-10-24T08:00:00.000Z';
 for(const delay of [0,72*3600000-1,72*3600000,72*3600000+1]){
  const c=new Date(Date.parse(p)+delay).toISOString(),r=chooseDisplayTime([row({published_at_text:p,first_collected_at:c})]);
  assert.equal(r.display_time,delay>72*3600000?p:c);assert.equal(r.display_time_basis,delay>72*3600000?'published':'first_collected');
 }
});
test('不猜测时区或非法日历，日期/月/年保留精度',()=>{
 for(const invalid of ['2026-02-29','2026-13','2026-01-32','2026-01-01T24:00:00Z','2026-02-30T08:00Z','2026-01-01 08:00','2026-01-01T12:00+14:30','garbage'])assert.equal(parsePublication(invalid),null,invalid);
 for(const [date,precision] of [['2024-02-29','day'],['2026-10','month'],['2026','year']])assert.equal(parsePublication(date!)?.precision,precision);
 assert.equal(parsePublication('2026-10-27T16:00:00+08:00')?.value,'2026-10-27T08:00:00.000Z');
});
test('低精度按范围判阈值，成功收录收紧同日可能上界，跨阈值明确降级',()=>{
 const cases=[['2026-10-27','first_collected','0～72'],['2026-10-26','first_collected','0～72'],['2026-10-24','first_collected','跨越'],['2026-10-23','published','超过72'],['2026-09','published','超过72'],['2025','published','超过72'],['2026','first_collected','跨越'],['2026-10-28','first_collected','晚于']];
 for(const [p,basis,reason] of cases){const r=chooseDisplayTime([row({published_at_text:p!})]);assert.equal(r.display_time_basis,basis,p);assert.ok(r.display_time_reason.includes(reason!),p);if(basis==='published')assert.equal(r.display_time,p);}
});
test('缺失、负延迟及无收录证据均有明确降级，两项皆无不假造时间',()=>{
 for(const p of [null,'bad','2026-10-28T08:00:00Z']){const r=chooseDisplayTime([row({published_at_text:p})]);assert.equal(r.display_time_basis,'first_collected');assert.match(r.display_time_reason,/待核实/);}
 const p=chooseDisplayTime([row({published_at_text:'2026-10-01',first_collected_at:null})]);assert.equal(p.display_time,'2026-10-01');assert.match(p.display_time_reason,/首次收录时间待核实/);
 const unknown=chooseDisplayTime([]);assert.equal(unknown.display_time,null);assert.equal(displaySortValue(unknown),-Infinity);
});
test('同篇证据版本C/P配对，最早有事件证据的成功收录优先，转载不置顶',()=>{
 const initial=row({published_at_text:'2026-10-01T08:00:00Z',first_collected_at:'2026-10-25T08:00:00Z'});
 const revision=row({version_id:'v2',published_at_text:'2026-10-27T07:00:00Z'}),reprint=row({material_id:'m2',version_id:'v3',source_id:'s2'});
 const time=chooseDisplayTime([revision,reprint,initial,initial]);assert.equal(time.time_version_id,'v');assert.equal(time.display_time,'2026-10-01T08:00:00.000Z');assert.equal(time.first_collected_at,new Date(initial.first_collected_at!).toISOString());
 assert.equal(chooseDisplayTime([revision]).time_version_id,'v2');
 assert.equal(chooseDisplayTime([initial,revision,reprint]).display_time,time.display_time);
 const tied=[row({material_id:'b',version_id:'z'}),row({material_id:'a',version_id:'y'})];assert.equal(chooseDisplayTime(tied).time_version_id,'y');
});
test('来源按身份去重，同名不同ID保留，依据信源排在第一位',()=>{
 const a=row({source_id:'a'}),b=row({source_id:'b',version_id:'b',relation_created_at:'2026-10-28T00:00Z'});
 assert.deepEqual(timelineSources([a,b,a],'b').map(s=>s.id),['b','a']);
});

test('不完整日期排序区域在完整日期之后，缺C时优先采用有效原文',()=>{
 assert.equal(displayTimeRank({display_time_precision:'day'}),0);assert.equal(displayTimeRank({display_time_precision:'month'}),1);assert.equal(displayTimeRank({display_time_precision:'unknown'}),2);
 const time=chooseDisplayTime([row({version_id:'a',first_collected_at:null,published_at_text:'bad'}),row({version_id:'b',first_collected_at:null,published_at_text:'2026-10-01'})]);
 assert.equal(time.time_version_id,'b');assert.equal(time.display_time,'2026-10-01');
});

test('至少三来源以最早关系排序，同刻按ID，重复关系不改顺序且依据来源优先',()=>{
 const items=[row({source_id:'c',version_id:'c',relation_created_at:'2026-10-25T08:00:00Z'}),row({source_id:'b',version_id:'b-late',relation_created_at:'2026-10-27T08:00:00Z'}),row({source_id:'a',version_id:'a',relation_created_at:'2026-10-25T08:00:00Z'}),row({source_id:'b',version_id:'b-early',relation_created_at:'2026-10-24T08:00:00Z'})];
 assert.deepEqual(timelineSources(items,null).map(s=>s.id),['b','a','c']);
 assert.deepEqual(timelineSources([...items].reverse(),'c').map(s=>s.id),['c','b','a']);
});
