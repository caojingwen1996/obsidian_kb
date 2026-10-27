import type {Pool} from 'pg';import type {RuntimeIssue} from '../platform/notifications.js';
export async function eventIssues(db:Pool):Promise<RuntimeIssue[]>{if(!(await db.query('SELECT 1 FROM platform.schema_versions WHERE version=3')).rowCount)return [];
 const rows=(await db.query("SELECT c.id,c.processing_id,c.reason_code,c.proposal_generation FROM information.event_candidates c JOIN information.processing_runs p ON p.id=c.processing_id WHERE p.processing_scope='FULL_EVENT' AND NOT p.paused AND c.status IN ('review','recoverable')")).rows;
 const deliveries=(await db.query("SELECT d.message_id,d.consumer_id,d.generation,d.error_code,d.files_error,d.file_generation FROM platform.message_deliveries d WHERE d.status='recoverable' OR (d.files_state='recoverable' AND d.file_attempts-d.file_window_start>=10)")).rows;
 return [...rows.map(r=>({key:`event:${r.id}:${r.proposal_generation}:${r.reason_code}`,code:r.reason_code??'EVENT_REVIEW_REQUIRED',owner:r.processing_id})),...deliveries.map(r=>({key:`event-delivery:${r.message_id}:${r.consumer_id}:${r.generation}:${r.file_generation}`,code:r.error_code??r.files_error??'EVENT_DELIVERY_FAILED',owner:null}))];
}
