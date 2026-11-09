/* M4交互原型模型：全部数据为演示夹具，不连接正式API或数据库。 */
(()=>{
 const clone=v=>JSON.parse(JSON.stringify(v));
 const categoryCatalog={
  '货币与货币形态':['货币单位','中央银行货币','商业银行存款货币','其他货币性工具'],
  '金融资产与金融合约':['主权债务工具','企业债务工具','信贷资产','证券化产品','权益资产','集合投资产品','衍生金融工具','其他金融合约'],
  '金融主体与机构':['主权及公共部门','货币当局','存款类金融机构','非银行金融机构','非金融部门','机构投资者'],
  '金融市场与基础设施':['货币市场','债券市场','股票市场','外汇市场','衍生品市场','金融基础设施'],
  '金融体系与宏观制度':['国家金融体系','货币与汇率制度','金融部门体系','跨境金融网络','全球金融体系'],
  '投资组合与交易策略':['单一资产持仓','多资产组合','杠杆与融资策略','风险对冲策略']
 };
 const folder=(id,name,parent=null,order=0,status='active')=>({id,name,parent,kind:'directory',order,status,version:1,history:[]});
 const object=(id,name,parent,primary,secondary,jurisdiction,scope,aliases=[],status='active',order=0)=>({id,name,parent,kind:'object',order,status,version:1,aliases,categories:[{primary_category:primary,secondary_category:secondary}],jurisdiction,scope,history:[]});
 function seed(){
  const items=[folder('A','A－货币与货币形态',null,1),folder('A1','法定货币','A',1),folder('A2','货币性资产','A',2),folder('B','B－金融资产与金融合约',null,2),folder('B1','主权债务工具','B',1),folder('C','C－金融主体与机构',null,3),folder('D','D－金融市场与基础设施',null,4),folder('D1','货币市场','D',1),folder('E','E－金融体系与宏观制度',null,5),folder('F','F－投资组合与交易策略',null,6),
   object('USD','美元','A1','货币与货币形态','货币单位','美国','美元这一货币计价单位的购买力与对外价值；不包含美元融资市场、美元资产持仓或美国国债。',['美元货币单位','USD'], 'active',1),
   object('CNY','人民币','A1','货币与货币形态','货币单位','中国','人民币这一货币计价单位的购买力与对外价值；不等同于人民币外汇市场或任一具体资产。',['CNY','人民币货币单位'],'active',2),
   object('EUR','欧元','A1','货币与货币形态','货币单位','欧元区','欧元这一货币计价单位；不包括欧元区全部金融机构或资产。',['EUR'],'active',3),
   object('DEPOSIT','商业银行存款','A2','货币与货币形态','商业银行存款货币','中国','',[],'draft',1),
   object('CBMONEY','中央银行货币','A2','货币与货币形态','中央银行货币','中国','中国中央银行负债形态中的现金和准备金；不包含商业银行存款。',[],'disabled',2),
   object('UST','美国国债','B1','金融资产与金融合约','主权债务工具','美国','美国财政部发行的国债工具总体；不包括国债市场、财政部机构本身、国债ETF或交易策略。',['美债','U.S. Treasury Securities'],'active',1),
   object('CGB','中国国债','B1','金融资产与金融合约','主权债务工具','中国','中国中央政府发行的国债工具总体；不包括地方政府债和政策性金融债。',[],'active',2),
   object('CNMM','中国货币市场','D1','金融市场与基础设施','货币市场','中国','中国境内短期融资与资金交易市场；不将人民币货币单位或任一逆回购操作作为同一对象。',[],'active',1)
  ];
  const usd=items.find(x=>x.id==='USD');usd.version=2;usd.history=[{version:1,name:'美元',scope:'美元这一货币计价单位。',action:'建立配置',reason:'演示配置基线',at:'2026-11-04 09:30'},{version:2,name:'美元',scope:usd.scope,action:'澄清对象边界',reason:'明确排除融资市场和资产持仓',at:'2026-11-05 09:00'}];
  const observations=[{id:'OBS-USD',configId:'USD',version:2,snapshot:clone(usd),status:'observing',reason:'',note:'关注货币单位本身的变化，核对直接关联的事实。',history:[{action:'建立观察',reason:'演示：加入系统共享清单',at:'2026-11-05 09:15'}]},{id:'OBS-UST',configId:'UST',version:1,snapshot:clone(items.find(x=>x.id==='UST')),status:'observing',reason:'',note:'关注国债工具，不混入美国国债市场。',history:[{action:'建立观察',reason:'演示：观察主权债务工具',at:'2026-11-05 09:20'}]},{id:'OBS-CNMM',configId:'CNMM',version:1,snapshot:clone(items.find(x=>x.id==='CNMM')),status:'paused',reason:'手工暂停',note:'保留历史查阅。',history:[{action:'暂停观察',reason:'演示：暂缓主动关注',at:'2026-11-05 09:25'}]}];
  return {items,observations,events:[{id:'EV-USD-1',title:'演示｜美元货币单位的汇兑关系说明',summary:'本演示事实明确讨论美元这一货币单位，不涉及美元融资市场或具体金融资产。',date:'2026-11-05',sources:['公开演示来源'],stage:'已发布'},{id:'EV-USD-2',title:'演示｜美元计价与购买力口径补充',summary:'本演示材料补充计价单位与购买力的口径，用于核对对象范围与历史事件展示。',date:'2026-11-04',sources:['公开演示来源','受限演示来源'],stage:'已发布'},{id:'EV-CNY-1',title:'演示｜人民币货币单位的范围说明',summary:'本演示事实讨论人民币作为货币计价单位的范围，不将外汇市场当作同一对象。',date:'2026-11-03',sources:['公开演示来源'],stage:'已发布'}],
   mappings:{USD:{status:'confirmed',targetName:'美元（货币单位）',scope:usd.scope,jurisdiction:'美国',events:['EV-USD-1','EV-USD-2'],reason:'演示：身份与范围核对一致'},CNY:{status:'pending',targetName:'人民币货币单位',scope:items.find(x=>x.id==='CNY').scope,jurisdiction:'中国',events:['EV-CNY-1']},UST:{status:'conflict',targetName:'美国国债市场',scope:'国债交易、供需、市场深度与收益率形成。',jurisdiction:'美国',events:[]}},receipts:{},audit:[],sequence:0,role:'all',scenario:'normal',restricted:false};
 }
 const find=(s,id)=>s.items.find(x=>x.id===id);
 const observed=(s,id)=>s.observations.find(x=>x.configId===id);
 const can=(s,kind)=>s.role==='all'||s.role===kind;
 function ancestors(s,id){const out=[],seen=new Set();let n=find(s,id);while(n?.parent){if(seen.has(n.parent))throw Error('目录出现循环');seen.add(n.parent);n=find(s,n.parent);if(!n)throw Error('上级目录缺失');out.push(n);}return out;}
 function descendants(s,id){const result=[];const visit=parent=>{for(const n of s.items.filter(x=>x.parent===parent)){result.push(n);if(n.kind==='directory')visit(n.id);}};visit(id);return result;}
 function eligibility(s,id){const n=find(s,id);if(!n||n.kind!=='object')return {ok:false,reason:'目录不能建立观察'};if(n.status!=='active')return {ok:false,reason:n.status==='draft'?'对象仍为草稿':'对象已停用'};const parent=ancestors(s,id).find(p=>p.status!=='active');return parent?{ok:false,reason:`上级目录“${parent.name}”${parent.status==='draft'?'仍为草稿':'已停用'}`}:{ok:true,reason:''};}
 function availableEvents(s,id){const m=s.mappings[id];if(m?.status!=='confirmed')return [];return s.events.filter(e=>m.events.includes(e.id)&&(!s.restricted||e.sources.every(x=>x!=='受限演示来源')));}
 function log(s,action,id,reason){const at=`2026-11-05 10:${String(++s.sequence%60).padStart(2,'0')}`,entry={action,id,reason,at,actor:'演示维护者'};s.audit.unshift(entry);return entry;}
 function affected(s,id){const ids=[id,...descendants(s,id).map(x=>x.id)];return s.observations.filter(o=>ids.includes(o.configId)&&o.status==='observing');}
 function pauseUnavailable(s,reason){for(const o of s.observations)if(o.status==='observing'&&!eligibility(s,o.configId).ok){o.status='paused';o.reason=reason;o.history.unshift(log(s,'暂停观察',o.configId,reason));}}
 function requireRole(s,kind){if(!can(s,kind))throw Error('当前演示角色没有此项操作权限');}
 function saveItem(s,draft,id,expectedVersion,keepDraft=false){
  requireRole(s,'config');const prior=id?find(s,id):null;if(id&&!prior)throw Error('对象已不存在');if(prior&&prior.version!==expectedVersion)throw Error('版本已变化，填写内容已保留，请核对最新版本后重试。');
  const next={...clone(draft),name:draft.name.trim(),aliases:(draft.aliases||[]).map(x=>x.trim()).filter(Boolean),scope:(draft.scope||'').trim(),jurisdiction:(draft.jurisdiction||'').trim(),status:keepDraft?'draft':draft.status||'active'};
  if(!next.name)throw Error('请填写名称');const parent=next.parent?find(s,next.parent):null;if(next.parent&&parent?.kind!=='directory')throw Error('上级必须是目录');if(next.kind==='object'&&!next.parent)throw Error('请选择所属目录');
  if(next.kind==='object'&&next.status==='active'){if(!next.scope||!next.categories?.length)throw Error('启用对象前，请补齐范围和至少一项金融分类');if(!next.jurisdiction&&!next.unrestricted)throw Error('请填写国家/辖区，或明确选择不限定');}
  if(next.categories?.some(c=>!categoryCatalog[c.primary_category]?.includes(c.secondary_category)))throw Error('请选择有效的金融分类');
  if(prior&&prior.parent!==next.parent)throw Error('请使用移动操作调整所属目录');if(prior&&prior.kind!==next.kind)throw Error('条目类型不能直接转换');if(prior&&next.status==='draft'&&(observed(s,id)||s.mappings[id]))throw Error('已有引用的对象不能退回草稿，请使用停用');
  const same=s.items.find(x=>x.id!==id&&x.kind===next.kind&&x.name===next.name&&(x.kind==='directory'?x.parent===next.parent:x.jurisdiction===next.jurisdiction&&x.scope===next.scope));if(same)throw Error('已有相同名称与范围的条目，请先核对并复用已有对象');
  if(!draft.reason?.trim())throw Error('请填写保存说明');
  const semantic=prior&&next.kind==='object'&&(prior.scope!==next.scope||!!prior.unrestricted!==!!next.unrestricted||prior.jurisdiction!==next.jurisdiction||JSON.stringify(prior.categories)!==JSON.stringify(next.categories));
  const event=log(s,prior?'修订配置':'建立配置',id||'新条目',draft.reason);const record={...next,id:id||'DEMO-'+s.sequence,order:prior?.order??s.items.length+1,version:(prior?.version||0)+1,history:[{...event,version:(prior?.version||0)+1,name:next.name,scope:next.scope},...(prior?.history||[])]};delete record.reason;
  if(prior)s.items[s.items.indexOf(prior)]=record;else s.items.push(record);
  if(semantic){const o=observed(s,id);if(o?.status==='observing'){o.status='paused';o.reason='定义待确认';o.history.unshift(log(s,'暂停观察',id,'定义待确认'));}if(s.mappings[id])s.mappings[id].status='pending';}
  pauseUnavailable(s,'配置不可用');return record;
 }
 function move(s,id,parent,confirmed,reason){requireRole(s,'config');const n=find(s,id),p=parent?find(s,parent):null;if(!n)throw Error('条目不存在');if(parent&&(p?.kind!=='directory'||id===parent||descendants(s,id).some(x=>x.id===parent)))throw Error('不能移动到自身、后代或金融对象下');if(n.kind==='object'&&!parent)throw Error('金融对象需要所属目录');if(!reason.trim())throw Error('请填写移动说明');const previous=n.parent;n.parent=parent;const impacted=s.observations.filter(o=>o.status==='observing'&&!eligibility(s,o.configId).ok);if(impacted.length&&!confirmed){n.parent=previous;throw Error('移动会暂停正在观察的对象，请先确认影响');}n.history.unshift(log(s,'移动条目',id,reason));pauseUnavailable(s,'上级目录不可用');return impacted.length;}
 function toggle(s,id,confirmed,reason){requireRole(s,'config');const n=find(s,id);if(!n)throw Error('条目不存在');if(!reason.trim())throw Error('请填写操作说明');if(n.status==='active'&&affected(s,id).length&&!confirmed)throw Error('请先确认对共享观察的影响');if(n.status!=='active'&&n.kind==='object'&&(!n.scope||!n.categories?.length||(!n.jurisdiction&&!n.unrestricted)))throw Error('定义尚不完整，请先编辑范围与分类');n.status=n.status==='active'?'disabled':'active';n.version++;n.history.unshift({...log(s,n.status==='active'?'启用配置':'停用配置',id,reason),version:n.version,name:n.name,scope:n.scope});pauseUnavailable(s,'配置不可用');return n;}
 function reorder(s,id,direction){requireRole(s,'config');const n=find(s,id),siblings=s.items.filter(x=>x.parent===n.parent).sort((a,b)=>a.order-b.order);const index=siblings.indexOf(n),other=siblings[index+direction];if(!other)throw Error('已经位于该目录边界');const order=n.order;n.order=other.order;other.order=order;log(s,'调整排序',id,'仅调整目录顺序');}
 function add(s,entries,key){requireRole(s,'observe');if(s.receipts[key])return clone(s.receipts[key]);const rows=[];for(const entry of entries){const n=find(s,entry.id),exists=observed(s,entry.id),valid=eligibility(s,entry.id);if(!valid.ok)rows.push({id:entry.id,status:'failed',reason:valid.reason});else if(n.version!==entry.version)rows.push({id:entry.id,status:'failed',reason:'配置版本已变化，请重新核对'});else if(exists)rows.push({id:entry.id,status:exists.status==='observing'?'existing':'restore',reason:exists.status==='observing'?'已经在共享清单中':'请恢复原观察记录'});else{const event=log(s,'建立观察',n.id,'从配置目录选择');s.observations.push({id:'OBS-'+n.id,configId:n.id,version:n.version,snapshot:clone(n),status:'observing',reason:'',note:'',history:[event]});rows.push({id:n.id,status:'added',reason:'已加入共享观察'});}}s.receipts[key]=clone(rows);return rows;}
 function observeAction(s,id,action,reason,adopted=false){requireRole(s,'observe');const o=observed(s,id),n=find(s,id);if(!o||!n)throw Error('观察记录不存在');if(!reason.trim())throw Error('请填写操作说明');if(action==='restore'){const valid=eligibility(s,id);if(!valid.ok)throw Error(valid.reason);if(o.version!==n.version&&!adopted)throw Error('请先核对并确认采用当前配置版本');o.status='observing';o.version=n.version;o.snapshot=clone(n);o.reason='';}else{o.status=action==='pause'?'paused':'ended';o.reason=reason;}o.history.unshift(log(s,action==='restore'?'恢复观察':action==='pause'?'暂停观察':'结束观察',id,reason));return o;}
 function confirmMapping(s,id,agree,reason){requireRole(s,'mapping');const n=find(s,id),m=s.mappings[id];if(!n||!m)throw Error('没有待核定映射');if(m.status==='conflict')throw Error('金融工具与市场范围不同，不能核定为同一对象');if(!agree||!reason.trim())throw Error('请确认身份与范围一致，并填写核定说明');m.status='confirmed';m.reason=reason;m.version=n.version;log(s,'核定事件对象映射',id,reason);}
 window.M4Model={seed,clone,find,observed,can,ancestors,descendants,eligibility,availableEvents,affected,log,saveItem,move,toggle,reorder,add,observeAction,confirmMapping,categoryCatalog};
})();
