export const statusNames = {ACTIVE:'启用',DISABLED:'停用',ready:'已就绪',needs_adapter:'待配置连接器',missing_url:'待补地址',authentication_required:'需登录',unknown:'待确认',running:'运行中',queued:'待执行',pending:'待执行',paused:'已暂停',completed:'已完成',partial:'部分完成',failed:'失败',blocked:'已阻断',recoverable:'待恢复',review:'待复核',waiting_config:'待配置',needs_url:'待补地址',needs_login:'需登录',access_blocked:'访问受限',skipped:'已跳过'};
export const statusName = value => statusNames[value] || value || '未知';
export const periodUnits={minutes:{seconds:60,label:'分钟'},hours:{seconds:3600,label:'小时'},days:{seconds:86400,label:'天'}};
export function schedulePeriod(seconds=3600){
  const unit=['days','hours','minutes'].find(unit=>seconds%periodUnits[unit].seconds===0)||'minutes';
  return {value:seconds/periodUnits[unit].seconds,unit};
}
export function periodSeconds(value,unit){
  const raw=Number(value)*periodUnits[unit]?.seconds,seconds=Math.round(raw);
  if(!Number.isFinite(raw)||seconds<60||seconds>86400||Math.abs(raw-seconds)>0.000001)throw new RangeError('执行周期需介于1分钟至1天，且精确到整数秒。');
  return seconds;
}
export function formatPeriod(seconds){
  if(seconds%60)return `${Math.floor(seconds/60)} 分钟 ${seconds%60} 秒`;
  const period=schedulePeriod(seconds);return `${period.value} ${periodUnits[period.unit].label}`;
}
export const steps = ['核对信源资格与接入条件','获取原始资料','正文读取与资料标准化','识别重复与资料版本','保存标准化资料','交付标准化资料'];
export const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function profileOf(source) {
  const meta=source.metadata || {};
  return {name:source.name || '',url:source.url || '',tier:'',group:'',focus:'',context:'',publisher:'',category:'',channel:'',allowed_scope:'',material_type:'',identity_basis:'',priority:'',frequency:'',...meta,
    dims:Array.isArray(meta.dims)?meta.dims:[],levels:Array.isArray(meta.levels)?meta.levels:[]};
}
export function filterSources(rows,filters={}) {
  const q=(filters.q || '').toLocaleLowerCase();
  return rows.filter(row=>{
    const p=profileOf(row);
    return (!q||[row.catalog_key,p.name,p.publisher].join(' ').toLocaleLowerCase().includes(q))
      && ['tier','group','category','priority','frequency'].every(key=>!filters[key]||p[key]===filters[key])
      && ['dims','levels'].every(key=>{const selected=Array.isArray(filters[key])?filters[key]:filters[key]?[filters[key]]:[];return !selected.length||selected.some(value=>p[key].includes(value));})
      && (!filters.state||row.state===filters.state)
      && (!filters.readiness||(row.connection?.readiness||'unknown')===filters.readiness);
  });
}
export const groupFields={verify:[['tier','信源等级'],['category','来源类别']],monitor:[['priority','关注优先级'],['frequency','监测频率'],['tier','信源等级']],research:[['dims','金融属性'],['levels','观察层级'],['priority','关注优先级']]};
export const sourceClassificationLabels={dims:{QUANTITY:'钱的数量',PRICE:'钱的价格',FLOW:'钱的流向',RISK_APPETITE:'风险偏好',ALLOCATION:'资源配置'},levels:{MACRO:'宏观',MESO:'中观',MICRO:'微观'},priority:{CORE:'核心',HIGH:'重点',NORMAL:'一般'},frequency:{REALTIME:'实时',DAILY:'每日',WEEKLY:'每周',MONTHLY:'每月',IRREGULAR:'不定期'}};
export function sourceGroupLabel(key,value){const labels=sourceClassificationLabels[key]||{};return Object.hasOwn(labels,value)?labels[value]:value;}
export function groupSources(rows,view,depth=0) {
  const [key,label]=groupFields[view]?.[depth] || ['group','分组'];
  const groups=new Map();
  for(const row of rows){
    const value=profileOf(row)[key]; const names=Array.isArray(value)?[...new Set(value)]:value?[value]:[];
    for(const raw of names.length?names:[`待补充${label}`]){
      const name=sourceGroupLabel(key,raw);
      if(!groups.has(name))groups.set(name,new Map());
      groups.get(name).set(row.catalog_key,row);
    }
  }
  return [...groups].map(([name,items])=>({name,label,items:[...items.values()]}));
}
export function researchGroups(rows){
 const groups=groupSources(rows,'research'),fixed=['钱的数量','钱的价格','钱的流向'];
 return [...fixed.map(name=>groups.find(group=>group.name===name)||{name,label:'金融属性',items:[]}),...groups.filter(group=>!fixed.includes(group.name)).map(group=>group.name==='待补充金融属性'?{...group,name:'待分类信源',unclassified:true}:group)];
}
export function countSaved(operation) {
  const versions=new Set();
  function walk(row){if(row.version_id)versions.add(row.version_id);for(const child of row.children||[])walk(child);}
  walk(operation);return versions.size;
}
export function candidateCount(processing) {return processing?.candidate_count==null?'待确认':String(processing.candidate_count);}
export function progressOf(row) {
  if(row.processing_id||['delivered','extract','candidates_saved'].includes(row.stage))return {completed:6,current:0};
  const completed={source:0,discovered:1,acquired:2,normalized:3,identified:4,saved:5}[row.stage]??0;
  return {completed,current:completed+1};
}
export function shanghaiDate(date=new Date()) {return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
export function validRange(from,to) {
  const valid=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(`${value}T00:00:00Z`))&&new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)===value;
  return valid(from)&&valid(to)&&from<=to;
}
export function dateTime(value) {if(!value)return '尚无记录';const date=new Date(value);return Number.isFinite(+date)?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(date):'时间未知';}
export function badge(value) {return `<span class="status status-${escape(value)}">${escape(statusName(value))}</span>`;}
const reasons={SOURCE_DISABLED:'信源已停用，请先核对业务资格。',CONNECTOR_NOT_CONFIGURED:'尚未配置连接器，暂时不能自动接入。',SOURCE_VERSION_CHANGED:'信源资料已更新，请刷新后重试。',VERSION_CONFLICT:'资料版本已变化，请刷新后核对。',STALE_EXECUTION:'任务已由其他操作推进，请刷新状态。',MODEL_NOT_CONFIGURED:'模型尚未配置；已保存资料保留。',MODEL_QUOTA_EXHAUSTED:'模型额度不足，等待执行通道恢复。',MODEL_LOGIN_REQUIRED:'模型登录已失效，请重新登录本机 Codex。',OUTCOME_UNKNOWN:'未收到操作回执，结果尚未确认。可查询状态或使用原请求重试。',UNAUTHENTICATED:'登录已过期，请重新登录后继续。',FORBIDDEN:'当前账号没有此项操作或信源访问权限。',IDEMPOTENCY_CONFLICT:'请求标识与原操作不一致，请重新读取状态。',SCHEDULE_VERSION_CHANGED:'计划已由其他操作更新，请刷新后核对。',SOURCE_VERIFICATION_REQUIRED:'请先补充发布主体、身份依据和允许业务范围，再核对启用。',DATE_RANGE_INVALID:'日期范围无效，请核对开始与结束日期。',SOURCE_DUPLICATE:'已有相同身份的信源，请核对并打开已有档案。'};
export function explain(error) {const code=typeof error==='string'?error:error?.code;const hints={MODEL_BUDGET_EXHAUSTED:'候选抽取的模型额度已用尽。已保存资料保留，可在候选抽取中核对额度后重试固定资料。',SOURCE_ITEMS_MISSING:'未找到可采集的资料条目。请核对信源接入范围，再从检查点重试。'};return hints[code] || reasons[code] || `未能完成操作${code?`（${code}）`:''}，请刷新状态后重试。`;}

export function renderDelivery(row,canRetry=false){
  if(!row)return '<p class="muted">交付状态暂不可用，请刷新查询。</p>';
  const received=row.status==='received',files=row.files||{};
  const extraction=row.event_processing?`正式事件处理：${statusName(row.event_processing.result_status)}`:row.extraction_status==='completed'?`候选抽取已完成 · ${candidateCount(row)} 条候选${row.candidate_count?'，等待事件归组':'（无事件）'}`:`候选抽取${row.extraction_status?statusName(row.extraction_status):'未开始'} · 数量待确认`;
  return `<section class="delivery-result" aria-label="资料交付状态"><ol class="delivery-stages"><li>资料已保存</li><li>${received?'F02 已接收':row.status==='recoverable'?'交付待恢复':'等待交付 F02'}</li><li>${escape(extraction)}</li></ol>
    ${row.reason_code?`<p class="run-reason">${escape(explain(row.reason_code))}</p>`:''}
    <div class="actions">${received&&row.version_id?`<a class="link-button" href="/events#information=${escape(row.version_id)}">查看候选事实与归属</a>`:''}${[['information','下载交付资料'],['receipt','查看接收回执'],['candidates','下载候选结果']].filter(([name])=>files[name]).map(([name,label])=>`<a class="link-button" href="${escape(files[name].url)}" download>${label}</a>`).join('')}
    ${canRetry&&row.status==='recoverable'?`<button type="button" class="quiet" data-retry-delivery="${escape(row.version_id)}" data-generation="${row.generation}">重新交付</button>`:''}
    ${canRetry&&files.status==='recoverable'?`<button type="button" class="quiet" data-retry-files="${escape(row.version_id)}" data-generation="${files.generation}">重新生成文件</button>`:''}</div>
    ${files.status==='recoverable'?`<p class="run-reason">结果文件待恢复：${escape(explain(files.reason_code))}</p>`:''}
    <details class="run-identity"><summary>交付追溯信息</summary><p class="text-wrap">${escape(row.delivery_id)}</p></details></section>`;
}
