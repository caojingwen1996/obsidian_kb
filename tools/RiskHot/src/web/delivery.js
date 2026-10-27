import {escape as e,statusName,explain,candidateCount} from './model.js';
export function renderDelivery(row,canRetry=false){
  if(!row)return '<p class="muted">交付状态暂不可用，请刷新查询。</p>';
  const received=row.status==='received',files=row.files||{};
  const extraction=row.extraction_status==='completed'?`候选抽取已完成 · ${candidateCount(row)} 条候选${row.candidate_count?'，等待事件归组':'（无事件）'}`:`候选抽取${row.extraction_status?statusName(row.extraction_status):'未开始'} · 数量待确认`;
  return `<section class="delivery-result" aria-label="资料交付状态"><ol class="delivery-stages"><li>资料已保存</li><li>${received?'F02 已接收':row.status==='recoverable'?'交付待恢复':'等待交付 F02'}</li><li>${e(extraction)}</li></ol>
    ${row.reason_code?`<p class="run-reason">${e(explain(row.reason_code))}</p>`:''}
    <div class="actions">${[['information','下载交付资料'],['receipt','查看接收回执'],['candidates','下载候选结果']].filter(([name])=>files[name]).map(([name,label])=>`<a class="link-button" href="${e(files[name].url)}" download>${label}</a>`).join('')}
    ${canRetry&&row.status==='recoverable'?`<button type="button" class="quiet" data-retry-delivery="${e(row.version_id)}" data-generation="${row.generation}">重新交付</button>`:''}
    ${canRetry&&files.status==='recoverable'?`<button type="button" class="quiet" data-retry-files="${e(row.version_id)}" data-generation="${files.generation}">重新生成文件</button>`:''}</div>
    ${files.status==='recoverable'?`<p class="run-reason">结果文件待恢复：${e(explain(files.reason_code))}</p>`:''}
    <details class="run-identity"><summary>交付追溯信息</summary><p class="text-wrap">${e(row.delivery_id)}</p></details></section>`;
}
