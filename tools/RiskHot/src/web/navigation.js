export function taskIdFromHash(hash){const match=/^#intake-task=([a-f0-9-]{36})$/.exec(hash);return match?.[1]||'';}
export function taskView(hash){return hash==='#manual-tasks'?'manual':hash==='#intake-tasks?view=history'?'history':'overview';}
export function workspaceRoute(hash){return hash==='#manual-tasks'?'manual':hash==='#intake-tasks'||hash==='#intake-tasks?view=history'||taskIdFromHash(hash)?'tasks':'sources';}
export function catalogMode(hash){return hash==='#schedules'||hash==='#sources?mode=automatic'?'automatic':'archive';}
