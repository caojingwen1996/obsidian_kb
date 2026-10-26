import { required } from '../platform/db.js';
import { requestHeaders } from './request-headers.js';

const result = await fetch(`${required('API_ORIGIN')}/api/v1/l0/monitor`, { headers: await requestHeaders(), signal: AbortSignal.timeout(15_000) });
if (!result.ok) throw new Error(`MONITOR_HTTP_${result.status}`);
console.log(JSON.stringify(await result.json(), null, 2));
