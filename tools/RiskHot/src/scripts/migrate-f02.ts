import {database} from '../platform/db.js';
import {applyF02Migration,inspectF02Migration} from '../platform/f02-migration.js';
const db=database('ADMIN_DATABASE_URL');
try{console.log(JSON.stringify(await (process.argv.includes('--apply')?applyF02Migration(db):inspectF02Migration(db)),null,2));}finally{await db.end();}
