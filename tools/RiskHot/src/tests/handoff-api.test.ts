import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { savedFixture } from './handoff-fixture.js';
import { buildServer } from '../runtime/server.js';

test('delivery API separates receipt, extraction and files and protects every download and recovery',async()=>{
  const c=await savedFixture();
  await c.db.query("INSERT INTO platform.actors VALUES('riskhot-local-operator',ARRAY['read','retry'],ARRAY['*'])");
  const app=await buildServer(c.repo,{mode:'local',origin:'http://localhost:18081'});
  const headers={host:'localhost:18081',origin:'http://localhost:18081','idempotency-key':randomUUID()},url=`/api/v1/l0/versions/${c.version}/delivery`;
  try{
    let response=await app.inject({url,headers});assert.equal(response.statusCode,200,response.body);assert.equal(response.json().status,'pending');assert.equal(response.json().files.information,null);
    const receipt=await c.delivery.accept(c.message);
    response=await app.inject({url,headers});assert.equal(response.json().status,'received');assert.equal(response.json().candidate_count,null);
    let download=await app.inject({url:url+'/files/information',headers});assert.equal(download.statusCode,200,download.body);assert.match(String(download.headers['content-disposition']),/attachment/);assert.equal(download.json().information.version_id,c.version);
    assert.equal((await app.inject({url:url+'/files/receipt',headers})).json().processing_id,receipt.processing_id);
    assert.equal((await app.inject({url:url+'/files/candidates',headers})).statusCode,503);
    await c.repo.acceptSet(receipt.processing_id,1,{covered_segment_ids:c.material.segments.map(x=>x.id),candidates:[],no_event_reason:'背景说明',warnings:[]});await c.delivery.publishResult(receipt.processing_id);
    download=await app.inject({url:url+'/files/candidates',headers});assert.equal(download.json().no_event_reason,'背景说明');
    const p=await app.inject({url:`/api/v1/l0/processings/${receipt.processing_id}`,headers});assert.equal(p.json().no_event_reason,'背景说明');
    assert.equal((await app.inject({url:url+'/files/unknown',headers})).statusCode,400);
    await c.db.query("UPDATE platform.actors SET permissions=ARRAY['read'] WHERE subject='riskhot-local-operator'");
    assert.equal((await app.inject({method:'POST',url:url+'/retry',headers,payload:{expected_generation:1,reason:'检查回执'}})).statusCode,403);
    await c.db.query("UPDATE platform.actors SET source_keys=ARRAY['other'] WHERE subject='riskhot-local-operator'");
    assert.equal((await app.inject({url:url+'/files/information',headers})).statusCode,403);
  }finally{await app.close();await c.dispose();}
});
