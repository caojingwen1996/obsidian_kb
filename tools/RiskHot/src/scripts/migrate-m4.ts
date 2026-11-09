import {database} from '../platform/db.js';
import {applyM4Migration,inspectM4Migration} from '../platform/m4-migration.js';
const db=database('ADMIN_DATABASE_URL');
try{console.log(JSON.stringify(await(process.argv.includes('--apply')?applyM4Migration(db):inspectM4Migration(db)),null,2));}finally{await db.end();}
