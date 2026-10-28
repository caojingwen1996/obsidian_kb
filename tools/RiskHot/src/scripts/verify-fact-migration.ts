import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {randomUUID} from 'node:crypto';import {readFile,writeFile,mkdir} from 'node:fs/promises';import {resolve} from 'node:path';import {Pool} from 'pg';
import {applyHandoffMigration} from '../platform/handoff-migration.js';
import {applyEventMigration,grantEventRoles} from '../platform/event-migration.js';
import {grantRuntimeRoles} from '../platform/grants.js';import {EventDelivery} from '../event-management/delivery.js';import {Repository} from '../information-ingestion/processing/repository.js';import {ArtifactStore} from '../platform/artifacts.js';
const backup=process.argv[2];if(!backup)throw new Error('Supply an existing pg_dump backup path');
const run=promisify(execFile),name='riskhot_fact_verify_'+randomUUID().replaceAll('-',''),url=new URL(process.env.ADMIN_DATABASE_URL!);url.pathname='/'+name;
const folder=resolve('.riskhot/fact-migration-validation');await mkdir(folder,{recursive:true,mode:0o700});
await run('docker',['compose','exec','-T','postgres','createdb','-U','postgres',name]);
const db=new Pool({connectionString:url.href});
try{
 const bytes=await readFile(backup);await new Promise<void>((done,fail)=>{const child=execFile('docker',['compose','exec','-T','postgres','pg_restore','-U','postgres','--exit-on-error','-d',name],error=>error?fail(new Error('RESTORE_FAILED')):done());child.stdin!.end(bytes);});
 const before={materials:(await db.query('SELECT count(*) FROM information.materials')).rows[0].count,candidates:(await db.query('SELECT count(*) FROM information.event_candidates')).rows[0].count,events:(await db.query('SELECT id FROM information.events ORDER BY id')).rows.map(r=>r.id)};
 for(let i=0;i<2;i++){await applyHandoffMigration(db);await applyEventMigration(db);await grantRuntimeRoles(db);await grantEventRoles(db);}
 const repo=new Repository(db,new ArtifactStore(folder+'/artifacts')),delivery=new EventDelivery(repo);await delivery.reconcile();
 const messages=(await db.query("SELECT id FROM platform.messages WHERE message_type='event.facts.committed.v2'")).rows;
 const results=[];for(const m of messages)results.push({message_id:m.id,...await delivery.applicationView(m.id,'event-audit')});
 const after={materials:(await db.query('SELECT count(*) FROM information.materials')).rows[0].count,candidate_links:(await db.query('SELECT count(*) FROM information.candidate_fact')).rows[0].count,facts:(await db.query('SELECT count(*) FROM information.fact')).rows[0].count,events:(await db.query('SELECT id FROM information.event ORDER BY id')).rows.map(r=>r.id)};
 const verified=before.materials===after.materials&&before.candidates===after.candidate_links&&JSON.stringify(before.events)===JSON.stringify(after.events)&&results.every(r=>r.application_status==='applied');
 const report={verified,backup:resolve(backup),before,after,deliveries:results,isolated_database_removed:true,artifacts:folder+'/artifacts'};await writeFile(folder+'/report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(!verified)process.exitCode=1;
}finally{await db.end();await run('docker',['compose','exec','-T','postgres','dropdb','-U','postgres',name]);}
