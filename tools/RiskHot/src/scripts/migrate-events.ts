import {database} from '../platform/db.js';import {applyHandoffMigration} from '../platform/handoff-migration.js';import {applyEventMigration,grantEventRoles} from '../platform/event-migration.js';import {grantRuntimeRoles} from '../platform/grants.js';
const args=process.argv.slice(2);if(args.length!==2||args[0]!=='--target'||!['test','runtime'].includes(args[1]!))throw new Error('Use --target test|runtime');
const db=database(args[1]==='test'?'TEST_DATABASE_URL':'ADMIN_DATABASE_URL');
try{await applyHandoffMigration(db);await applyEventMigration(db);await grantRuntimeRoles(db);await grantEventRoles(db);console.log(JSON.stringify({schema:4,target:args[1],migrated:true}));}finally{await db.end();}
