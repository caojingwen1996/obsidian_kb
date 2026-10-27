import type {TimeValue} from './contracts.js';
function day(t:TimeValue):string|null{const match=(t.start??t.text).match(/(\d{4})[-年](\d{1,2})[-月](\d{1,2})/);if(!match)return null;return `${match[1]}-${match[2]!.padStart(2,'0')}-${match[3]!.padStart(2,'0')}`;}
// Calendar ordering updates only the calendar projection; it never fabricates a precise instant.
export function mayProjectTime(previous:TimeValue|null,next:TimeValue|null):boolean{
 if(!next||!['occurred','announced'].includes(next.kind)||!['timestamp','day'].includes(next.precision))return false;
 if(!previous||previous.kind==='expected'||previous.precision==='unknown')return true;
 if(next.precision==='timestamp'&&previous.precision==='timestamp'&&next.start&&previous.start)return Date.parse(next.start)>=Date.parse(previous.start);
 const before=day(previous),after=day(next);return !!before&&!!after&&after>before;
}
