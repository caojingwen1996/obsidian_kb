import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import Long from 'long';
import {Client,Connection} from '@temporalio/client';
import {NativeConnection,Worker} from '@temporalio/worker';

test('真实Temporal Worker处理21及50对象并在有界循环耗尽时显式失败',{timeout:120000},async()=>{
 const connection=await Connection.connect({address:process.env.TEMPORAL_ADDRESS,connectTimeout:'5 seconds'}),namespace=`ai07-${randomUUID()}`;
 await connection.workflowService.registerNamespace({namespace,workflowExecutionRetentionPeriod:{seconds:Long.fromNumber(86400)}});
 const native=await NativeConnection.connect({address:process.env.TEMPORAL_ADDRESS}),counts=new Map<string,number>(),failed:string[]=[],invoked=new Map<string,number>();
 const workflow=await Worker.create({connection:native,namespace,taskQueue:'ai07-workflow',workflowsPath:fileURLToPath(new URL('../runtime/event-workflows.ts',import.meta.url))});
 const io=await Worker.create({connection:native,namespace,taskQueue:'riskhot-l0-io',activities:{
  async advanceEvent(id:string){const n=counts.get(id)??0;counts.set(id,n+1);if(id!=='exhausted'&&n>=Number(id))return {stop:true};return {attempt:{id,deadline_ms:Date.now()+600000,window_used:1}};},
  async consumeEvent(){return {};},async failEvent(id:string){failed.push(id);}
 }}),model=await Worker.create({connection:native,namespace,taskQueue:'riskhot-l0-model',activities:{async invoke(id:string){invoked.set(id,(invoked.get(id)??0)+1);}}});
 try{await workflow.runUntil(()=>io.runUntil(()=>model.runUntil(async()=>{const client=new Client({connection,namespace});for(const id of ['21','50','exhausted'])await client.workflow.execute('EventCandidateWorkflow',{taskQueue:'ai07-workflow',workflowId:randomUUID(),args:[id,1]});})));assert.equal(invoked.get('21'),21);assert.equal(invoked.get('50'),50);assert.equal(invoked.get('exhausted'),200);assert.deepEqual(failed,['exhausted']);}
 finally{await native.close();await connection.close();}
});
