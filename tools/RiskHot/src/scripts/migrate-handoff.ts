import { database } from '../platform/db.js';
import { applyHandoffMigration } from '../platform/handoff-migration.js';
import { grantRuntimeRoles } from '../platform/grants.js';
const target = process.argv.slice(2);
if (target.length !== 2 || target[0] !== '--target' || !['test','runtime'].includes(target[1]!)) throw new Error('Use --target test|runtime');
const db = database(target[1] === 'test' ? 'TEST_DATABASE_URL' : 'ADMIN_DATABASE_URL');
try { await applyHandoffMigration(db); if(target[1] === 'runtime') await grantRuntimeRoles(db); console.log(JSON.stringify({schema:2,target:target[1],migrated:true})); }
finally { await db.end(); }
