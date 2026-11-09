import {database} from '../platform/db.js';
const subject=process.argv[2],allowed=['financial_config_manage','observation_manage','target_mapping_review'];
const permissions=process.argv.slice(3);
if(!subject||!permissions.length||permissions.some(p=>!allowed.includes(p)))throw new Error('用法：npm run grant:m4 -- 账号 financial_config_manage observation_manage target_mapping_review');
const db=database('ADMIN_DATABASE_URL');
try{const result=await db.query('UPDATE platform.actors SET permissions=ARRAY(SELECT DISTINCT p FROM unnest(permissions||$2::text[]) p ORDER BY p) WHERE subject=$1',[subject,permissions]);if(!result.rowCount)throw new Error('账号不存在');console.log('已更新指定账号的 M4 职责。');}finally{await db.end();}
