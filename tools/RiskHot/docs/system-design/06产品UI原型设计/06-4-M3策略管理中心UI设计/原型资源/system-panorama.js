'use strict';

// Compose a read-only system view from the six source-grounded blueprints.
// IDs are scoped here so browsing never changes a strategy's versioned graph.
const SYSTEM_PANORAMA = (() => {
 const nodes = [];
 const copy = value => JSON.parse(JSON.stringify(value));
 const ref = (prefix,id) => `${prefix}-${id}`;
 const node = id => nodes.find(item=>item.id===id);
 function importFlow(key,prefix,module){
  const flow=DOMAIN_FLOWS[key];
  nodes.push(...flow.nodes.map(original=>{
   const n=copy(original);
   n.id=ref(prefix,n.id);
   n.origin={flow:key,id:original.id};
   n.module=typeof module==='function'?module(original.id):module;
   n.next=n.next.map(edge=>({...edge,to:ref(prefix,edge.to)}));
   if(n.requiresAll)n.requiresAll=n.requiresAll.map(id=>ref(prefix,id));
   if(n.type==='START'){n.type='PROGRAM';n.input='context';}
   return n;
  }));
  return flow.stages.map(stage=>({
   title:stage.title,description:stage.description,kind:stage.kind,module:typeof module==='string'?module:'F03 / F04',
   items:stage.items.map(item=>typeof item==='string'?ref(prefix,item):{
    ...copy(item),lanes:item.lanes.map(lane=>({...copy(lane),nodes:lane.nodes.map(id=>ref(prefix,id))}))
   })
  }));
 }
 function overviewNode(originalId,id,overrides){
  const original=DOMAIN_FLOWS.system.nodes.find(item=>item.id===originalId);
  const n={...copy(original),id,...overrides};nodes.push(n);return n;
 }
 function handoff(id,next){Object.assign(node(id),{type:'PROGRAM',next});}
 const eventSections=importFlow('STR-L0-01','EV','F02');
 const ratingSections=importFlow('STR-L0-02','RATE','F02');
 const riskSections=importFlow('STR-L1-01','RISK',id=>['S','DUPCHECK','P1','A1','CRESULT','DUP','NONE'].includes(id)?'F03':'F04');
 const stateSections=importFlow('STR-L2-01','STATE','F05');
 const changeSections=importFlow('STR-L2-02','CHANGE','F06');
 const reportSections=importFlow('STR-L3-01','REPORT','F08');

 overviewNode('S','IN-S',{module:'F01',next:[{label:'核对接入资格',to:'IN-CHECK'}]});
 overviewNode('ING','IN-CHECK',{
  type:'CONDITION',name:'核对信源资格与接入条件',
  section:'§5.2 F01；§6.2；§6.4',rule:'总览 §6.2 / §6.4 资格准备',
  inputDescription:'外部资料或统计指标、M1来源资格、M2指标口径及允许来源',
  outputDescription:'接入资格检查结果',summary:'业务启用、来源限制及接入条件满足后才能继续；运行提交时复查资格。',
  ruleDetail:'依据M1业务启用资格、M2允许来源与指标口径核对；资格和接入条件均满足后采集、补录及保存版本。',
  next:[{label:'资格及条件满足',to:'IN-ING'},{label:'不满足或需要处理',to:'IN-HOLD'}]
 });
 overviewNode('ING','IN-ING',{
  name:'采集、补录与版本保存',next:[{label:'按输入类型处理',to:'IN-KIND'}]
 });
 overviewNode('KIND','IN-KIND',{
  module:'F01',
  next:[{label:'资讯 / 公告 / 报告',to:'EV-S'},{label:'指标实际值',to:'IN-VALUE'}]
 });
 overviewNode('VALUE','IN-VALUE',{
  next:[{label:'供已纳管风险准备观察证据',to:'STATE-S'}]
 });
 overviewNode('HOLD','IN-HOLD',{
  name:'接入条件不满足 · 保留原因待处理',module:'F01',section:'§6.2；§9.6',rule:'总览 §6.2 / §9.6',
  inputDescription:'来源资格、来源限制或技术接入问题',outputDescription:'待处理原因',
  summary:'区分业务停用与技术接入失败，处理后重新检查接入条件。',
  ruleDetail:'不符合来源资格的资料不得作为合格输入；技术故障不得解释为没有新风险。',next:[]
 });

 handoff('EV-RATE',[{label:'按依据决定初评、复评或沿用',to:'RATE-S'}]);
 Object.assign(node('EV-RATE'),{
  name:'进入金融意义评级',outputDescription:'待初评、复评或沿用的事件 / 有效更新',
  summary:'按是否影响评级依据进入初评、复评或沿用；评级结果回到事件统一校验。',
  ruleDetail:'金融意义评价按已固定的范围与研究期限形成版本结果；仅来源增加不自动触发重评。'
 });
 handoff('RATE-E',[{label:'回到事件统一校验',to:'EV-P2'}]);
 handoff('EV-E',[
  {label:'可触发识别的实质变化 → L1',to:'RISK-S'},
  {label:'已纳管风险可引用的事实 / 进展 → L2',to:'STATE-S'}
 ]);
 handoff('RISK-E',[{label:'有效观察定义与长期关系 → L2',to:'STATE-S'}]);
 handoff('STATE-E',[
  {label:'当前快照交历史变化分析',to:'CHANGE-S'},
  {label:'已保存当前结果供查询读取',to:'VIEW-S'},
  {label:'发生报告请求时供引用',to:'REPORT-S'}
 ]);
 handoff('CHANGE-E',[
  {label:'已保存变化结果供查询读取',to:'VIEW-S'},
  {label:'发生报告请求时供引用',to:'REPORT-S'}
 ]);
 node('CHANGE-FOLLOW').next.push({label:'必要时提交维护建议',to:'G-FEEDBACK'});

 overviewNode('LIST','VIEW-S',{
  type:'PROGRAM',name:'读取正式风险、有效快照与变化结果',section:'§5.2 F07；§6.4',
  inputDescription:'F04正式身份、F05当前快照、F06附属变化与证据引用',
  outputDescription:'可供目录、详情及时间线使用的只读查询数据',
  summary:'按阅读需求组织查询视图；无快照和不可比结果保留原有含义，不重算上游结论。',
  ruleDetail:'F07只读组合上游事实，不以缺少快照推导低风险。',
  next:[{label:'目录查询',to:'VIEW-LIST'},{label:'风险详情',to:'VIEW-DETAIL'},{label:'时间线查询',to:'VIEW-TIMELINE'}]
 });
 for(const [id,name,summary,output] of [
  ['VIEW-LIST','生成最新、最严重与全部风险目录','按有效快照时间及可比严重度查询；全部目录保留尚无快照的正式风险。','RiskList / 目录查询结果'],
  ['VIEW-DETAIL','组合风险详情与证据入口','组合风险身份、当前状态、变化解释和证据引用，保持上游结论原义。','RiskPublicationItem / 风险详情'],
  ['VIEW-TIMELINE','串联历次快照与附属变化','以同一风险的历史快照及附属变化形成可追溯时间线。','Timeline / 历史引用']
 ])overviewNode('LIST',id,{
  type:'PROGRAM',name,summary,ruleDetail:summary,section:'§5.2 F07',rule:'总览 §5.2 F07',
  inputDescription:'已确认的风险身份、有效快照、变化结果及引用',outputDescription:output,
  next:[{label:'供授权阅读及追溯',to:'VIEW-READ'}]
 });
 overviewNode('E','VIEW-READ',{next:[],module:'F07'});
 overviewNode('FEED','G-FEEDBACK',{next:[]});
 for(const [id,name,section,summary,input,output,next,pending] of [
  ['G-M1','M1 信源资格与版本治理','§5.3 M1','登记、分类、启停及追溯信源，向接入环节提供来源资格。','授权维护请求、信源档案与技术状态','信源身份、业务资格及版本',[{label:'资格供F01复查',to:'IN-CHECK'}],''],
  ['G-M2','M2 风险观察定义与候选治理','§5.3 M2','治理风险源、风险类型、全局变量、指标口径、允许来源和映射；候选审核后生效。','变量候选、定义维护请求、M1信源与业务反馈','已确认定义、指标映射及版本',[{label:'指标口径与来源限制',to:'IN-CHECK'},{label:'风险与变量配置',to:'RISK-P1'},{label:'长期关系引用的观测定义',to:'STATE-P1'}],''],
  ['G-M3','M3 方法、规则与固定版本治理','§5.3 M3','治理分析方法及适用版本，后续运行使用已确认定义，历史运行保留原引用。','授权方法维护、执行反馈和评估依据','适用方法、规则及固定版本',[{label:'当前状态分析方法',to:'STATE-FORK'}],'事件方法与报告模板的支撑范围仍待确认。']
 ])overviewNode('FEED',id,{
  type:'MODULE',name,module:id.slice(2),section,rule:`总览 ${section}`,summary,ruleDetail:summary,
  inputDescription:input,outputDescription:output,next,pending
 });

 function separateExits(sections,ids,title){
  for(const section of sections)section.items=section.items.filter(item=>typeof item!=='string'||!ids.includes(item));
  sections.push({title,kind:'outcomes',items:[{title:'按实际问题转入',parallel:false,lanes:ids.map(id=>({title:node(id).name,nodes:[id]}))}]});
 }
 separateExits(ratingSections,['RATE-X'],'评级待处理出口');
 separateExits(changeSections,['CHANGE-X'],'历史比较待处理出口');
 separateExits(reportSections,['REPORT-X','REPORT-H'],'报告校验与发布待处理出口');
 changeSections[1].items=changeSections[1].items.filter(item=>item!=='CHANGE-UNKNOWN');
 changeSections[1].description='仅有可比历史时执行下列分析；首次或不可比时进入“变化待判断”分支。';
 changeSections.splice(2,0,{title:'首次或不可比时保留变化待判断',module:'F06',description:'与上面的历史比较分析二选一，随后共同进入结果整理。',items:['CHANGE-UNKNOWN']});
 const main=sections=>sections.filter(section=>section.kind!=='outcomes'&&section.kind!=='followup');
 const exits=sections=>sections.filter(section=>section.kind==='outcomes');
 const stages=[
  {code:'L0',title:'信息接入与事件管理',description:'先接入可追溯资料，再按事件资料与指标实际值分别处理。',output:'Event / EventUpdate · Target与直接变量关联 · 金融意义 · 指标实际值',sections:[
   {title:'来源检查、接入与输入分流',module:'F01',items:['IN-S','IN-CHECK','IN-ING','IN-KIND',{title:'按输入类型进入对应路径',parallel:false,lanes:[{title:'资讯 / 公告 / 报告',nodes:['EV-S']},{title:'指标实际值 · 直接供L2证据准备',nodes:['IN-VALUE']}]}]},
   {...eventSections[0],items:eventSections[0].items.filter(id=>id!=='EV-S')},eventSections[1],
   ...main(ratingSections),eventSections[2],...exits(eventSections),...exits(ratingSections),
   {title:'接入条件出口',kind:'outcomes',items:['IN-HOLD']}
  ]},
  {code:'L1',title:'风险识别与纳管',description:'完整候选先匹配正式身份，再决定复用、新建或转待复核。',output:'MonitoredRisk · 风险事件关联 · 有效长期变量关系',sections:riskSections},
  {code:'L2',title:'风险态势分析',description:'固定本轮证据，先形成当前四维，再解释可比历史中的变化。',output:'RiskSnapshot · 变量分析明细 · RiskAnalysisResult · 后续观察与维护建议',sections:[...main(stateSections),...main(changeSections),...exits(stateSections),...exits(changeSections)]},
  {code:'L3',title:'风险产品与发布',description:'查询按阅读需求组织；周期报告在请求时单独编制、校验与授权发布。',output:'风险目录 / 详情 / Timeline · 版本化RiskReport及发布记录',sections:[
   {title:'风险展示与检索',module:'F07',description:'三类查询按阅读需求使用，并非必须依次访问。',items:['VIEW-S',{title:'按阅读需求选择查询视图',parallel:false,lanes:[{title:'风险目录',nodes:['VIEW-LIST']},{title:'风险详情',nodes:['VIEW-DETAIL']},{title:'历史时间线',nodes:['VIEW-TIMELINE']}]},'VIEW-READ']},
   ...reportSections
  ]},
  {code:'M',title:'横向治理与维护反馈',description:'M1、M2、M3为各业务层提供资格、定义与方法，独立治理后供后续运行引用。',kind:'support',output:'来源资格 · 观察定义与映射 · 分析方法版本',sections:[
   {title:'跨层复用的治理能力',kind:'support',items:['G-M1','G-M2','G-M3']},
   {title:'业务执行后的维护建议',kind:'support',items:['G-FEEDBACK']}
  ]}
 ];
 for(const stage of stages){
  let sequence=0;
  stage.kind=stage.kind||'business';
  for(const section of stage.sections){
   const numbered=!['outcomes','followup','support'].includes(section.kind);
   section.steps=section.items.map(item=>{
    const label=numbered?`Step ${++sequence}`:section.kind==='outcomes'?'条件出口':section.kind==='followup'?'后续动作':'横向支撑';
    if(typeof item==='string'){
     node(item).panoramaStep=label;
    }else{
     item.lanes.forEach((lane,laneIndex)=>lane.nodes.forEach((id,index)=>{
      node(id).panoramaStep=numbered?`${label}${String.fromCharCode(65+laneIndex)}${lane.nodes.length>1?'.'+(index+1):''}`:label;
     }));
    }
    return {label,item};
   });
  }
  stage.stepCount=sequence;
  stage.items=stage.sections.flatMap(section=>section.items);
 }
 const moduleDefinitions=[
  {code:'F01',name:'信息接入',description:'来源资格、资料版本与指标实际值'},
  {code:'F02',name:'事件管理',description:'事件抽取、归组、增量与金融意义评级'},
  {code:'F03',name:'风险识别',description:'依据有效事件形成完整风险候选'},
  {code:'F04',name:'风险纳管与跟踪',description:'同一性判断、准入及长期关系维护'},
  {code:'F05',name:'风险状态分析',description:'证据准备、并行分析与当前四维快照'},
  {code:'F06',name:'风险演化分析',description:'历史可比性、方向、持续性与减弱节点'},
  {code:'F07',name:'风险展示与检索',description:'风险目录、详情及历史时间线'},
  {code:'F08',name:'风险报告与发布',description:'周期报告、引用校验与授权发布'}
 ];
 for(const stage of stages.filter(stage=>stage.kind==='business')){
  stage.modules=moduleDefinitions.flatMap(definition=>{
   const belongs=id=>node(id).module===definition.code;
   const sections=stage.sections.map(section=>{
    const steps=section.steps.flatMap(step=>{
     if(typeof step.item==='string')return belongs(step.item)?[step]:[];
     const lanes=step.item.lanes.map(lane=>({...lane,nodes:lane.nodes.filter(belongs)})).filter(lane=>lane.nodes.length);
     return lanes.length?[{...step,item:{...step.item,lanes}}]:[];
    });
    return {...section,module:definition.code,title:definition.code==='F02'&&section.module==='F01'?'接收可追溯资料':section.title,steps,items:steps.map(step=>step.item)};
   }).filter(section=>section.steps.length);
   if(!sections.length)return [];
   const nodeIds=sections.flatMap(section=>section.items.flatMap(item=>typeof item==='string'?[item]:item.lanes.flatMap(lane=>lane.nodes)));
   const numbered=nodeIds.map(id=>Number(node(id).panoramaStep.match(/^Step (\d+)/)?.[1])).filter(Boolean);
   const first=Math.min(...numbered),last=Math.max(...numbered);
   return [{...definition,sections,nodeIds,stepRange:first===last?`Step ${first}`:`Step ${first}～${last}`}];
  });
 }
 return {source:'overview',summary:'从资料接入、事件管理、风险纳管到状态分析、历史变化与产品发布的完整业务流程；步骤编号用于阅读，分流、并行、依赖与独立触发按标注理解。',nodes,stages};
})();
