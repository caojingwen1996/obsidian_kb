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
 const riskSections=importFlow('STR-L1-01','RISK',id=>['S','DUPCHECK','P1','A1','CRESULT','DUP','NONE'].includes(id)?'F03':'F04');
 const stateSections=importFlow('STR-L2-01','STATE','F05');
 const changeSections=importFlow('STR-L2-02','CHANGE','F06');
 const reportSections=importFlow('STR-L3-01','REPORT','F08');

 // F01 follows its current six-step contract independently of the legacy overview blueprint.
 function intake(id,type,name,section,inputDescription,outputDescription,summary,ruleDetail,next){
  nodes.push({id,type,name,module:'F01',source:'F01',section,rule:`F01 ${section}`,
   input:'information_context',output:'information_context',inputDescription,outputDescription,summary,ruleDetail,next,pending:''});
 }
 intake('IN-S','START','接入请求与原始资料线索','§4.1','合格信源线索、链接或文件、任务与提交者身份','待核对的接入请求',
  '网页、公告、报告、文件与结构化资料统一接入。','原件、来源、取得时间和处理记录贯穿六步流程。',[{label:'核对接入条件',to:'IN-CHECK'}]);
 intake('IN-CHECK','CONDITION','核对信源资格与接入条件','§4.2','M1信源状态、允许范围、配置版本、执行权限与接入方式','资格与技术就绪结果',
  '核对信源是否启用、范围是否允许、权限和接入方式是否可用。','业务资格与技术就绪分别判断；人工提交检查出处和文件可读性，不强制要求自动连接器。',
  [{label:'资格及条件满足',to:'IN-ING'},{label:'资格或条件不满足',to:'IN-HOLD'}]);
 intake('IN-ING','PROGRAM','获取原始资料','§4.3','通过资格检查的链接、文件或采集范围','原件、必要附件和真实获取记录',
  '采集或授权补录原件及附件，绑定来源、任务与取得时间。','缺少必需附件或获取失败进入待处理；历史补采保留真实取得时间。',
  [{label:'原件取得完整',to:'IN-READ'},{label:'获取失败或必需附件缺失',to:'IN-HOLD'}]);
 intake('IN-READ','CONDITION','正文读取与资料标准化','§4.4','原件、附件及来源元信息','检查通过的标准化资料包',
  '读取正文和表格，规范结构与元数据，完成完整性检查。','保留数字、单位、表头和脚注；正文不可读、原件引用失效或必需项缺失时待处理。检查结果随资料包交给保存环节。',
  [{label:'标准化与完整性检查通过',to:'IN-VERSION'},{label:'读取失败或必需项不完整',to:'IN-HOLD'}]);
 intake('IN-VERSION','CONDITION','识别重复与资料版本','§4.5','标准化资料包、来源标识、规范链接及已有资料版本','资料身份、重复或修订判定及后续路径',
  '先确定资料身份，再比较内容与处理版本；不同信源独立保留。','同信源内优先原始编号，再核对规范详情链接，指纹仅辅助匹配。区分来源修订与重新解析；身份冲突、规则不一致或比较失败进入待处理。完整保存的重复版本按交付状态续接，部分保存恢复保存。',
  [{label:'新资料、修订或尚未完整保存',to:'IN-SAVE'},{label:'同版已保存，待交付',to:'IN-DELIVER'},{label:'同版已保存且交付已确认',to:'IN-DONE'},{label:'身份或比较条件待核对',to:'IN-HOLD'}]);
 intake('IN-SAVE','CONDITION','保存标准化资料','§4.6','已检查资料包、Step 4身份与版本判定','完整保存的资料版本及保存回执',
  '落实版本与原件定位关联，复核提交资格并持久化保存。','沿用正文检查和版本判定，原件、内容及关联完整可读才算保存成功。并发命中同版时复用已有保存与交付状态；恢复时重新复核资格，资料未变不重做标准化。',
  [{label:'完整保存，待交付',to:'IN-DELIVER'},{label:'并发同版已保存且交付完成',to:'IN-DONE'},{label:'资格失效或关联缺失',to:'IN-HOLD'},{label:'保存失败或回执未确认',to:'IN-SAVE-WAIT'}]);
 intake('IN-DELIVER','CONDITION','交付标准化资料','§4.7','完整保存且尚未确认交付的资料版本','下游接收确认及交付回执记录',
  '交付资料版本、来源、时间和原件定位，并记录接收回执。','接收确认且本地回执记录完成才算已交付。发送失败仅补发同版；接收已确认但回执记录失败时优先恢复记录。多个必需接收方分别确认，下游按资料身份和版本幂等接收。',
  [{label:'交付及回执记录完成',to:'IN-DONE'},{label:'发送失败、未确认或回执待恢复',to:'IN-SEND-WAIT'}]);
 intake('IN-DONE','END','资料已保存且交付已确认','§4.1、§4.7','完整保存的资料版本与交付确认','可读取、可追溯的标准化资料',
  '本次资料接入与标准化流程完成。','已确认交付的重复版本不再次触发；此处提供下游接收环节的阅读定位。',[{label:'查看 F02 标准化资料接收环节',to:'EV-S'}]);
 intake('IN-HOLD','END','阻断或待处理','§4.2～4.6','资格、获取、读取、身份或关联异常','原因、原件证据与待恢复阶段',
  '保留已有原件和失败原因，修复后恢复对应阶段。','资格问题先重新核验；资料变化返回正文读取与版本判断。待处理不等于已保存或已交付。',[]);
 intake('IN-SAVE-WAIT','END','保存待恢复','§4.6','保存失败、部分保存或保存结果未确认','恢复位置与保存异常记录',
  '按同版恢复保存，不重复读取未变化的正文。','恢复时复核资格并查询已有保存状态；完整保存前不向下游交付。',[{label:'恢复 Step 5 保存',to:'IN-SAVE'}]);
 intake('IN-SEND-WAIT','END','交付待恢复','§4.7','发送失败、确认超时或回执记录失败','待交付状态、原因与恢复记录',
  '补发同一资料版本，或恢复已经取得的确认回执。','不重新采集、标准化或保存资料；无法确认结果而补发时仍按同版幂等。',[{label:'恢复 Step 6 交付或回执',to:'IN-DELIVER'}]);

 // Reading content for the four node types used by F01; routes remain in next.
 const intakeDetails={
  'IN-S':{trigger:'采集任务、授权链接提交、文件上传或历史资料补采。',actions:['保留原始资料线索及请求上下文。','将请求交给资格与接入条件核对，尚不判定接入成功。']},
  'IN-CHECK':{question:'信源资格允许本次接入，且接入方式可用吗？',basis:['核对M1信源启用状态、有效配置、允许范围及执行或提交权限。','自动采集核对连接、授权、适配器和格式；人工提交核对出处、文件可读性与权限。','业务资格与技术就绪分别判断；来源不合格不能通过重试绕过。']},
  'IN-ING':{actions:['按允许范围取得原始响应、正文和必要附件，或接收授权提交的链接与文件。','绑定来源、原始标识或出处、实际取得时间及任务或提交者引用。','逐份记录获取结果；必需附件缺失时不将整份资料标记为完成。']},
  'IN-READ':{question:'正文或结构化内容可读取，且标准化资料的必需项完整吗？',basis:['保留原文、数字、表格、注释及原件定位；移除可明确识别的导航噪声。','核对内容、编码与格式、必需元数据、原件可读性及必需附件。','不确定的读取内容或时间不凭空补全；影响核心可读性或必需项缺失时待处理。']},
  'IN-VERSION':{question:'资料身份和比较条件是否明确，已有版本是否保存并确认交付？',basis:['先限定同一来源，再核对原始标识与规范链接；标题或指纹相同不能单独证明同一资料。','比较原件、有效内容及处理规则，区分首次接入、来源修订、处理版本变化和重复复用。','完整保存的同版按交付状态续接；身份冲突、比较失败或条件不足进入待核对。']},
  'IN-SAVE':{question:'保存资格与关联是否有效，资料版本是否完整保存？',basis:['使用已有标准化检查与身份版本判定，落实原件、附件、来源、任务及前版关系。','提交前复核当前信源资格；原件、内容和关联完整可读且回执明确才算保存完成。','并发命中同版时复用已有记录与交付状态；保存失败、部分保存或回执不明时保留恢复位置。']},
  'IN-DELIVER':{question:'必需接收方是否确认，且交付回执已成功记录？',basis:['仅交付完整保存的资料版本，连同来源、时间、读取信息和原件定位。','记录各必需接收方的确认与回执，同版已确认的接收方不重复触发。','发送失败补发同版；接收已确认但本地回执记录失败时优先恢复记录。']},
  'IN-DONE':{resultType:'正常完成',resultTone:'complete',continuation:'可读取并追溯已交付的标准化资料；下方入口用于查看F02接收环节，不代表再次触发处理。'},
  'IN-HOLD':{resultType:'阻断或待处理',resultTone:'pending',recovery:'根据保留原因恢复相应阶段：资格问题重新核验；资料内容变化时返回正文读取与版本判断。未明确统一后继，不自动选择恢复步骤。'},
  'IN-SAVE-WAIT':{resultType:'保存待恢复',resultTone:'pending',recovery:'恢复Step 5，先复核资格与已有保存状态，再按同版续存；资料未变时不重复标准化，完整保存前不交付。'},
  'IN-SEND-WAIT':{resultType:'交付待恢复',resultTone:'pending',recovery:'恢复Step 6，补发同一版本或恢复已取得的确认回执，不重新采集、标准化或保存。'}
 };
 Object.entries(intakeDetails).forEach(([id,detail])=>{node(id).panoramaDetail=detail;});

 // F02 follows the current seven-step function design; C01 assets stay versioned.
 const eventDefinitions=[
 {
  "id": "EV-S",
  "type": "START",
  "name": "F01 已保存的标准化资料与确定版本",
  "module": "F02",
  "source": "F02",
  "section": "§4.1、§4.9、§6.2",
  "rule": "F02 §4.1、§4.9、§6.2",
  "input": "event_context",
  "output": "event_context",
  "inputDescription": "资料身份及确定版本、标准化内容、前版关系、证据定位、权限和既有处理记录",
  "outputDescription": "受理后的待处理候选范围，或已保存变更的交付续接",
  "summary": "先核对输入与既有处理范围，按记录续接，避免重复分析已完成候选。",
  "ruleDetail": "仅完整保存且可读取的确定资料版本进入分析。相同分析键的重复投递查询既有处理记录；部分候选已完成时仅恢复其余范围，重算须另记授权与方法版本。",
  "next": [
   {
    "label": "输入满足；仅处理未完成候选",
    "to": "EV-PREP"
   },
   {
    "label": "资料版本、引用或读取条件不满足",
    "to": "EV-X"
   },
   {
    "label": "处理及必要交付已完成",
    "to": "EV-E"
   },
   {
    "label": "正式结果已保存，仅交付待恢复",
    "to": "EV-DELIVER"
   }
  ],
  "panoramaDetail": {
   "trigger": "F01交付已保存的标准化资料版本；重复投递按受理记录续接。",
   "actions": [
    "核对资料版本、证据读取权限与输入完整性；不重新接入或标准化原件。",
    "查询本次分析键、候选完成范围和交付状态，只续接未完成部分。"
   ]
  },
  "pending": ""
 },
 {
  "id": "EV-A1",
  "type": "AI",
  "name": "提取候选事件",
  "module": "F02",
  "source": "F02",
  "section": "§4.2",
  "rule": "F02 §4.2",
  "input": "event_context",
  "output": "event_context",
  "inputDescription": "确定版本的标准化内容、来源与时间、证据位置及事件类型字典",
  "outputDescription": "0..N候选、主体/行为/事件时间、状态、证据定位和不确定性",
  "summary": "AI-01从资料中识别具体行为与变化，输出候选和证据，交程序校验。",
  "ruleDetail": "一份资料可对应多个候选，各候选独立处理。区分宣布、预计与实施；事件时间不能用发布时间替代。AI不分配正式event_id。",
  "next": [
   {
    "label": "分析返回，交程序检查",
    "to": "EV-CHECK"
   },
   {
    "label": "AI执行失败，保留恢复位置",
    "to": "EV-X"
   }
  ],
  "pending": "",
  "task": "AI-01",
  "taskVersion": "1.0",
  "panoramaFixedStep": "Step 1.2"
 },
 {
  "id": "EV-A2",
  "type": "AI",
  "name": "比较事件身份与归属",
  "module": "F02",
  "source": "F02",
  "section": "§4.3",
  "rule": "F02 §4.3",
  "input": "event_context",
  "output": "event_context",
  "inputDescription": "事件候选、程序召回的已有事件、作用范围与原文证据",
  "outputDescription": "新建或复用身份建议、归组比较依据及资料关系",
  "summary": "AI-02比较候选与已有事件，提出新建、复用或待判定建议。",
  "ruleDetail": "同主题不等于同事件。仅比较真实已有身份；NEW_EVENT、归入已有事件或UNRESOLVED分别记录。正式身份与关系在校验保存阶段落实，不由AI直接创建。",
  "next": [
   {
    "label": "分析返回，交程序检查",
    "to": "EV-MATCH-CHECK"
   },
   {
    "label": "AI执行失败，保留恢复位置",
    "to": "EV-X"
   }
  ],
  "pending": "匹配阈值与精确自动通过条件尚待评审，不使用预设百分比。",
  "task": "AI-02",
  "taskVersion": "1.0",
  "panoramaFixedStep": "Step 2.2"
 },
 {
  "id": "EV-A3",
  "type": "AI",
  "name": "识别观测主体与直接变量",
  "module": "F02",
  "source": "F02",
  "section": "§4.4",
  "rule": "F02 §4.4",
  "input": "event_context",
  "output": "event_context",
  "inputDescription": "已明确身份的事件候选、Target字典、M2有效变量定义和直接证据",
  "outputDescription": "EventTarget、直接变量关系建议，或合法空关系与候选缺口",
  "summary": "AI-03提出主体、变量和关系建议，正式引用与关系由程序检查。",
  "ruleDetail": "核对主体身份、类型、辖区和范围；无明确Target或直接变量时可保留空关系并继续其他分析。无正式变量匹配时保留候选，不造ID，不替下游推导风险传导。",
  "next": [
   {
    "label": "分析返回，交程序检查",
    "to": "EV-REL-CHECK"
   },
   {
    "label": "AI执行失败，保留恢复位置",
    "to": "EV-X"
   }
  ],
  "pending": "新Target正式身份分配、审核与授权条件待定；缺定义不等于整个事件处理失败。",
  "task": "AI-03",
  "taskVersion": "1.0",
  "panoramaFixedStep": "Step 3.2"
 },
 {
  "id": "EV-A5",
  "type": "AI",
  "name": "分析事件增量与变化",
  "module": "F02",
  "source": "F02",
  "section": "§4.5",
  "rule": "F02 §4.5",
  "input": "event_context",
  "output": "event_context",
  "inputDescription": "确定资料版本及前版变化、已归组事件的事实、状态、证据与更新历史",
  "outputDescription": "七类增量结果、更新与状态调整建议及后续评价路径",
  "summary": "AI-04比较当前事实和历史，提出增量、状态与证据建议。",
  "ruleDetail": "七类为NEW_EVENT、EVENT_PROGRESS、MATERIAL_ADDITION、SOURCE_ADDITION、CORRECTION、DUPLICATE、UNRESOLVED。来源修订与处理版本变化不自动等于事件纠正；重复不制造Update或通知。新增事实改变身份判断时先复核归组。",
  "next": [
   {
    "label": "分析返回，交程序检查",
    "to": "EV-DELTA-CHECK"
   },
   {
    "label": "AI执行失败，保留恢复位置",
    "to": "EV-X"
   }
  ],
  "pending": "",
  "task": "AI-04",
  "taskVersion": "1.0",
  "panoramaFixedStep": "Step 4.2"
 },
 {
  "id": "RATE-A1",
  "type": "AI",
  "name": "分析金融意义维度与用途",
  "module": "F02",
  "source": "F02",
  "section": "§4.6",
  "rule": "F02 §4.6",
  "input": "event_context",
  "output": "event_context",
  "inputDescription": "事件及有效增量、证据、评价范围、研究期限和固定方法版本",
  "outputDescription": "金融意义评语、用途标签、评价或复评结果及方法状态",
  "summary": "AI-05在固定范围、期限和方法下分析维度、用途与依据；总分由程序计算或复算。",
  "ruleDetail": "金融意义不等于风险等级。新事件通常初评，评级依据改变才复评；纯来源增加通常沿用。方法未批准时保留评语、用途、依据和草案状态，M为空，不输出未经批准的正式分值。",
  "next": [
   {
    "label": "分析返回，交程序检查",
    "to": "RATE-CHECK"
   },
   {
    "label": "AI执行失败，保留恢复位置",
    "to": "EV-X"
   }
  ],
  "pending": "M候选维度、权重及量化方法待评审；未批准方法不得生成正式评分。",
  "task": "AI-05",
  "taskVersion": "1.0",
  "panoramaFixedStep": "Step 5.3"
 },
 {
  "id": "EV-P2",
  "type": "PROGRAM",
  "name": "校验并保存事件结果",
  "module": "F02",
  "source": "F02",
  "section": "§4.7、§3.11",
  "rule": "F02 §4.7、§3.11",
  "input": "event_context",
  "output": "event_context",
  "inputDescription": "候选、归组、主体变量关系、增量与评价建议，及权限、证据版本",
  "outputDescription": "适用的正式事件、关系、更新、评级和处理记录；确定保存结果",
  "summary": "统一落实正式身份与关系，校验后保存本次适用业务结果。",
  "ruleDetail": "校验资料版本、身份、同事件证据、时间状态、M范围、权限和幂等性。只保存适用对象；来源增加、重复及合法空关系不强制创建所有对象。并发或保存结果不明先查询已提交范围，不重复生成业务效果。",
  "next": [
   {
    "label": "保存明确成功，有待交付的正式变化",
    "to": "EV-DELIVER"
   },
   {
    "label": "保存明确成功，无待交付业务变化",
    "to": "EV-E"
   },
   {
    "label": "业务校验、身份或权限不满足",
    "to": "EV-X"
   },
   {
    "label": "保存失败、并发冲突或提交结果不明",
    "to": "EV-SAVEWAIT"
   }
  ],
  "panoramaDetail": {
   "actions": [
    "校验身份、确定资料版本、同事件证据、关系、时间、评级范围及权限。",
    "按增量类别落实适用对象与处理记录，不强制创建全部关系或评级。",
    "查询并发与已提交范围，避免重复Event、Update或Rating；保存后才交付。"
   ]
  },
  "pending": "",
  "panoramaFixedStep": "Step 6"
 },
 {
  "id": "EV-DELIVER",
  "type": "PROGRAM",
  "name": "交付事件变化",
  "module": "F02",
  "source": "F02",
  "section": "§4.8",
  "rule": "F02 §4.8",
  "input": "event_context",
  "output": "event_context",
  "inputDescription": "已保存正式变更、事件/更新引用、实际变化类别、授权接收方及证据版本",
  "outputDescription": "本次变更交付确认、回执记录和可恢复的交付状态",
  "summary": "根据实际变化交付下游，接收确认与回执记录完成后结束。",
  "ruleDetail": "新事件、实质进展及有效关系变化供F03/F05使用；评级更新供引用信息更新；仅来源增加只交付订阅该变化的消费者；纯重复无变化不发通知。失败只恢复同一变更的交付/回执，不重新分析或保存。",
  "next": [
   {
    "label": "约定交付与回执记录完成",
    "to": "EV-E"
   },
   {
    "label": "交付失败、未确认或回执待恢复",
    "to": "EV-SENDWAIT"
   }
  ],
  "panoramaDetail": {
   "actions": [
    "仅交付已保存的正式变化，按变化类型和授权订阅确定接收方。",
    "记录事件与更新、变化类别、证据版本、M范围/期限/方法及回执。",
    "已确认接收方不重复触发；失败仅恢复同一变更的交付或回执。"
   ]
  },
  "pending": "",
  "panoramaFixedStep": "Step 7"
 },
 {
  "id": "EV-E",
  "type": "END",
  "name": "本次处理完成",
  "module": "F02",
  "source": "F02",
  "section": "§4.1、§4.8～4.9",
  "rule": "F02 §4.1、§4.8～4.9",
  "input": "event_context",
  "output": "event_context",
  "inputDescription": "无事件处理记录已保存，或业务结果已保存且必要交付已确认",
  "outputDescription": "本次已完成处理范围、资料证据与适用事件结果",
  "summary": "无事件、无新增与已交付变更均可正常完成；其他未完成候选分别保留。",
  "ruleDetail": "此处是本次已完成范围的结果，不把某个候选完成误认为整份资料全部完成。下方跨模块入口仅作阅读定位，不能由无事件、纯重复或仅来源增加自动触发风险识别。",
  "next": [
   {
    "label": "查看实质变化的风险识别接收环节",
    "to": "RISK-S"
   },
   {
    "label": "查看可引用事实/进展的状态分析环节",
    "to": "STATE-S"
   }
  ],
  "panoramaDetail": {
   "resultType": "正常完成",
   "resultTone": "complete",
   "continuation": "按实际变化使用已保存结果；F03/F05入口仅提供阅读定位。无事件和纯重复不产生风险触发。"
  },
  "pending": ""
 },
 {
  "id": "EV-ZERO",
  "type": "PROGRAM",
  "name": "记录无事件结果及资料引用",
  "module": "F02",
  "source": "F02",
  "section": "§4.1～4.2、§4.9",
  "rule": "F02 §4.1～4.2、§4.9",
  "input": "event_context",
  "output": "event_context",
  "inputDescription": "零候选提取结果及确定资料版本、原文引用",
  "outputDescription": "可查询的无事件处理记录",
  "summary": "保留本次无事件结论及资料引用，不创建空事件。",
  "ruleDetail": "0个候选是合法业务结果。资料仍可追溯；记录分析与版本依据，不分配虚构的正式事件或发业务变化通知。",
  "next": [
   {
    "label": "无事件处理记录已保存",
    "to": "EV-E"
   }
  ],
  "panoramaDetail": {
   "actions": [
    "记录零候选处理结果、确定资料版本及分析依据。",
    "保留原文定位供查询；不制造Event、Update或业务变化通知。"
   ]
  },
  "pending": "",
  "panoramaFixedStep": "Step 1A.1"
 },
 {
  "id": "EV-X",
  "type": "END",
  "name": "待处理或待复核",
  "module": "F02",
  "source": "F02",
  "section": "§4.3、§4.5、§4.9",
  "rule": "F02 §4.3、§4.5、§4.9",
  "input": "event_context",
  "output": "event_context",
  "inputDescription": "输入、身份、证据、输出或业务校验问题，以及受影响的候选范围",
  "outputDescription": "问题原因、候选差异、资料版本、证据和待恢复阶段",
  "summary": "隔离受影响候选并保留依据，其他合格候选可继续。",
  "ruleDetail": "合法空Target/变量或未批准方法下的M空分不自动进入本出口。复核后由程序重新校验身份、权限与证据；按具体原因恢复，不能盲目重做整份资料。",
  "next": [],
  "panoramaDetail": {
   "resultType": "待处理或待复核",
   "resultTone": "pending",
   "recovery": "按记录恢复当前失败位置。归组改变后重新处理依赖旧身份的关系、增量与评级；已提交结果走受控修正。执行失败不等于无事件、无匹配或合法空分。复核后仍需程序检查，无统一固定后继。"
  },
  "pending": ""
 },
 {
  "id": "EV-SAVEWAIT",
  "type": "END",
  "name": "事件保存待恢复",
  "module": "F02",
  "source": "F02",
  "section": "§4.7、§4.9",
  "rule": "F02 §4.7、§4.9",
  "input": "event_context",
  "output": "event_context",
  "inputDescription": "保存失败、并发冲突、部分完成或提交结果不明",
  "outputDescription": "已保存范围、候选关联和保存恢复位置",
  "summary": "先核对实际提交范围，再恢复未完成的保存。",
  "ruleDetail": "保留已完成Event、来源关系、Update、Rating和候选记录；按同一业务变化恢复，不重建已存在的正式结果。",
  "next": [
   {
    "label": "仅恢复未完成保存",
    "to": "EV-P2"
   }
  ],
  "panoramaDetail": {
   "resultType": "保存待恢复",
   "resultTone": "pending",
   "recovery": "回到校验并保存事件结果，先查询实际已提交范围及预期修订，再恢复未完成部分。"
  },
  "pending": ""
 },
 {
  "id": "EV-SENDWAIT",
  "type": "END",
  "name": "事件交付待恢复",
  "module": "F02",
  "source": "F02",
  "section": "§4.8～4.9",
  "rule": "F02 §4.8～4.9",
  "input": "event_context",
  "output": "event_context",
  "inputDescription": "已保存业务变化与失败、超时或不明的交付/回执",
  "outputDescription": "同一变更的待交付状态和原因",
  "summary": "业务保存与交付状态分别保留，只恢复原变更交付或回执。",
  "ruleDetail": "不得因为交付重试再次生成Event、Update或Rating；已确认部分不重复触发，接收方按约定身份去重。",
  "next": [
   {
    "label": "仅恢复原变更交付或回执",
    "to": "EV-DELIVER"
   }
  ],
  "panoramaDetail": {
   "resultType": "交付待恢复",
   "resultTone": "pending",
   "recovery": "回到交付事件变化，仅补发同一已保存变更或补记回执，不重新分析与保存。"
  },
  "pending": ""
 },
 {
  "id": "EV-PREP",
  "type": "PROGRAM",
  "name": "准备资料与提取上下文",
  "module": "F02",
  "source": "F02",
  "section": "§4.2",
  "rule": "F02 §4.2",
  "input": "event_context",
  "output": "event_context",
  "inputDescription": "已受理的资料身份、确定版本与处理记录",
  "outputDescription": "可读取资料、事件类型字典及固定任务版本",
  "summary": "读取确定版本的正文、来源、时间和原文定位；沿用标题、URL和发布时间的可空规则。",
  "ruleDetail": "读取确定版本的正文、来源、时间和原文定位；沿用标题、URL和发布时间的可空规则。；固定任务与方法版本，仅准备未完成的分析范围。",
  "next": [
   {
    "label": "输入可用，交 AI-01",
    "to": "EV-A1"
   },
   {
    "label": "执行失败或输入不可用，保留恢复位置",
    "to": "EV-X"
   }
  ],
  "panoramaDetail": {
   "actions": [
    "读取确定版本的正文、来源、时间和原文定位；沿用标题、URL和发布时间的可空规则。",
    "固定任务与方法版本，仅准备未完成的分析范围。"
   ]
  },
  "pending": "",
  "panoramaFixedStep": "Step 1.1",
  "panoramaGroupTitle": "Step 1 · 提取候选事件"
 },
 {
  "id": "EV-CHECK",
  "type": "CONDITION",
  "name": "校验并固定候选清单",
  "module": "F02",
  "source": "F02",
  "section": "§4.2、§4.9",
  "rule": "F02 §4.2、§4.9",
  "input": "event_context",
  "output": "event_context",
  "inputDescription": "AI-01返回的候选集合、原文证据与执行状态",
  "outputDescription": "固定候选键、数量与校验结果",
  "summary": "检查输出完整性、字段、时间语义、资料版本和原文定位。",
  "ruleDetail": "检查输出完整性、字段、时间语义、资料版本和原文定位。；抽取完成并通过校验后固定候选键和数量；失败或数量未知不能记为零候选。",
  "next": [
   {
    "label": "有合格候选，逐个处理",
    "to": "EV-MATCH-PREP"
   },
   {
    "label": "合法零候选，记录无事件",
    "to": "EV-ZERO"
   },
   {
    "label": "校验不通过，待恢复或复核",
    "to": "EV-X"
   }
  ],
  "panoramaDetail": {
   "question": "校验并固定候选清单？",
   "basis": [
    "检查输出完整性、字段、时间语义、资料版本和原文定位。",
    "抽取完成并通过校验后固定候选键和数量；失败或数量未知不能记为零候选。"
   ]
  },
  "pending": "",
  "panoramaFixedStep": "Step 1.3"
 },
 {
  "id": "EV-MATCH-PREP",
  "type": "PROGRAM",
  "name": "召回已有事件与历史依据",
  "module": "F02",
  "source": "F02",
  "section": "§4.3",
  "rule": "F02 §4.3",
  "input": "event_context",
  "output": "event_context",
  "inputDescription": "已校验的候选、主体、行为、时间和范围",
  "outputDescription": "真实已有事件、修订版本与比较证据",
  "summary": "按主体、行为、时间及范围召回已有事件，固定比较版本。",
  "ruleDetail": "按主体、行为、时间及范围召回已有事件，固定比较版本。；召回失败进入待恢复，不能当成无匹配；成功但为空的召回仍交AI判断。",
  "next": [
   {
    "label": "召回完成，交 AI-02",
    "to": "EV-A2"
   },
   {
    "label": "执行失败或输入不可用，保留恢复位置",
    "to": "EV-X"
   }
  ],
  "panoramaDetail": {
   "actions": [
    "按主体、行为、时间及范围召回已有事件，固定比较版本。",
    "召回失败进入待恢复，不能当成无匹配；成功但为空的召回仍交AI判断。"
   ]
  },
  "pending": "",
  "panoramaFixedStep": "Step 2.1",
  "panoramaGroupTitle": "Step 2 · 匹配事件与归组"
 },
 {
  "id": "EV-MATCH-CHECK",
  "type": "CONDITION",
  "name": "校验身份与归组决定",
  "module": "F02",
  "source": "F02",
  "section": "§4.3、§4.9",
  "rule": "F02 §4.3、§4.9",
  "input": "event_context",
  "output": "event_context",
  "inputDescription": "AI-02归组建议、真实ID、修订版本及证据",
  "outputDescription": "已确认身份决定或待复核记录",
  "summary": "核对已有ID、比较时版本、证据、幂等性和适用归组规则；虚构ID当场拦截。",
  "ruleDetail": "核对已有ID、比较时版本、证据、幂等性和适用归组规则；虚构ID当场拦截。；只有符合已批准条件才接受身份决定；歧义或缺少自动通过授权时进入复核。；新事件在正式提交前按候选关联追踪，不把候选当成已保存的正式事件。",
  "next": [
   {
    "label": "身份明确且允许通过",
    "to": "EV-REL-PREP"
   },
   {
    "label": "歧义、引用无效或需要人工决定",
    "to": "EV-X"
   }
  ],
  "panoramaDetail": {
   "question": "校验身份与归组决定？",
   "basis": [
    "核对已有ID、比较时版本、证据、幂等性和适用归组规则；虚构ID当场拦截。",
    "只有符合已批准条件才接受身份决定；歧义或缺少自动通过授权时进入复核。",
    "新事件在正式提交前按候选关联追踪，不把候选当成已保存的正式事件。"
   ]
  },
  "pending": "",
  "panoramaFixedStep": "Step 2.3"
 },
 {
  "id": "EV-REL-PREP",
  "type": "PROGRAM",
  "name": "准备主体、变量字典与证据",
  "module": "F02",
  "source": "F02",
  "section": "§4.4",
  "rule": "F02 §4.4",
  "input": "event_context",
  "output": "event_context",
  "inputDescription": "已确认身份决定、事实及来源",
  "outputDescription": "有效Target与变量定义、固定版本及直接证据",
  "summary": "读取Target字典和M2有效变量定义，保留定义版本与原文证据。",
  "ruleDetail": "读取Target字典和M2有效变量定义，保留定义版本与原文证据。；区分当前候选的新建决定与已有正式事件引用，不编造正式ID。",
  "next": [
   {
    "label": "上下文可用，交 AI-03",
    "to": "EV-A3"
   },
   {
    "label": "执行失败或输入不可用，保留恢复位置",
    "to": "EV-X"
   }
  ],
  "panoramaDetail": {
   "actions": [
    "读取Target字典和M2有效变量定义，保留定义版本与原文证据。",
    "区分当前候选的新建决定与已有正式事件引用，不编造正式ID。"
   ]
  },
  "pending": "",
  "panoramaFixedStep": "Step 3.1",
  "panoramaGroupTitle": "Step 3 · 关联观测主体及直接变量"
 },
 {
  "id": "EV-REL-CHECK",
  "type": "CONDITION",
  "name": "校验关系并登记定义缺口",
  "module": "F02",
  "source": "F02",
  "section": "§4.4、§4.9",
  "rule": "F02 §4.4、§4.9",
  "input": "event_context",
  "output": "event_context",
  "inputDescription": "AI-03关系建议、正式定义引用和候选缺口",
  "outputDescription": "合格关系建议、合法空关系及治理反馈",
  "summary": "检查Target类型与范围、变量存在性、定义有效性、证据及复合关系。",
  "ruleDetail": "检查Target类型与范围、变量存在性、定义有效性、证据及复合关系。；区分已保存关系与待提交关系；缺定义向治理方反馈，其他合法结果继续。；无证据的关系可以为空，虚构正式引用或权限冲突不能继续。",
  "next": [
   {
    "label": "关系合格或合法为空",
    "to": "EV-DELTA-PREP"
   },
   {
    "label": "校验不通过，待恢复或复核",
    "to": "EV-X"
   }
  ],
  "panoramaDetail": {
   "question": "校验关系并登记定义缺口？",
   "basis": [
    "检查Target类型与范围、变量存在性、定义有效性、证据及复合关系。",
    "区分已保存关系与待提交关系；缺定义向治理方反馈，其他合法结果继续。",
    "无证据的关系可以为空，虚构正式引用或权限冲突不能继续。"
   ]
  },
  "pending": "",
  "panoramaFixedStep": "Step 3.3"
 },
 {
  "id": "EV-DELTA-PREP",
  "type": "PROGRAM",
  "name": "准备资料版本与事件历史",
  "module": "F02",
  "source": "F02",
  "section": "§4.5",
  "rule": "F02 §4.5",
  "input": "event_context",
  "output": "event_context",
  "inputDescription": "当前及前版资料、事件身份和合格关系建议",
  "outputDescription": "固定版本的事实、状态、证据与更新历史",
  "summary": "汇集当前资料、前版变化、已确认身份、关系建议及历史更新。",
  "ruleDetail": "汇集当前资料、前版变化、已确认身份、关系建议及历史更新。；固定比较版本，保留来源修订与处理版本变化的区别。",
  "next": [
   {
    "label": "历史可用，交 AI-04",
    "to": "EV-A5"
   },
   {
    "label": "执行失败或输入不可用，保留恢复位置",
    "to": "EV-X"
   }
  ],
  "panoramaDetail": {
   "actions": [
    "汇集当前资料、前版变化、已确认身份、关系建议及历史更新。",
    "固定比较版本，保留来源修订与处理版本变化的区别。"
   ]
  },
  "pending": "",
  "panoramaFixedStep": "Step 4.1",
  "panoramaGroupTitle": "Step 4 · 判定增量与更新"
 },
 {
  "id": "EV-DELTA-CHECK",
  "type": "CONDITION",
  "name": "校验增量并选择处理路径",
  "module": "F02",
  "source": "F02",
  "section": "§4.5、§4.9",
  "rule": "F02 §4.5、§4.9",
  "input": "event_context",
  "output": "event_context",
  "inputDescription": "AI-04增量建议、前后差异、证据和时间状态",
  "outputDescription": "经校验的更新、来源或重复处理方案",
  "summary": "检查同一变化是否已记录、时间序列与状态是否合法。",
  "ruleDetail": "检查同一变化是否已记录、时间序列与状态是否合法。；身份存疑返回Step 2；增量仍不明确时进入复核。；新增事件或有效更新交Step 5；纯来源补充或重复直接交Step 6，不机械生成更新或评级。",
  "next": [
   {
    "label": "新增事件或有效更新",
    "to": "RATE-DECIDE"
   },
   {
    "label": "纯来源补充或纯重复",
    "to": "EV-P2"
   },
   {
    "label": "身份判断需要重新核对",
    "to": "EV-MATCH-PREP"
   },
   {
    "label": "增量或证据仍不明确",
    "to": "EV-X"
   }
  ],
  "panoramaDetail": {
   "question": "校验增量并选择处理路径？",
   "basis": [
    "检查同一变化是否已记录、时间序列与状态是否合法。",
    "身份存疑返回Step 2；增量仍不明确时进入复核。",
    "新增事件或有效更新交Step 5；纯来源补充或重复直接交Step 6，不机械生成更新或评级。"
   ]
  },
  "pending": "",
  "panoramaFixedStep": "Step 4.3"
 },
 {
  "id": "RATE-DECIDE",
  "type": "CONDITION",
  "name": "判断是否需要初评或复评",
  "module": "F02",
  "source": "F02",
  "section": "§4.6.1",
  "rule": "F02 §4.6.1",
  "input": "event_context",
  "output": "event_context",
  "inputDescription": "新事件标记、有效增量、已有评级和适用规则",
  "outputDescription": "初评、复评或沿用／不适用决定",
  "summary": "程序结合新增标记、增量和评级规则判断是否需要评价。",
  "ruleDetail": "程序结合新增标记、增量和评级规则判断是否需要评价。；新事件通常初评，进展、实质补充或纠正只有改变评级依据时才复评。；无需评价时记录沿用或不适用原因，不调用AI-05、不新增评级。",
  "next": [
   {
    "label": "需要初评或复评",
    "to": "RATE-PREP"
   },
   {
    "label": "依据未变，沿用或不适用",
    "to": "EV-P2"
   },
   {
    "label": "缺少判断所需依据",
    "to": "EV-X"
   }
  ],
  "panoramaDetail": {
   "question": "判断是否需要初评或复评？",
   "basis": [
    "程序结合新增标记、增量和评级规则判断是否需要评价。",
    "新事件通常初评，进展、实质补充或纠正只有改变评级依据时才复评。",
    "无需评价时记录沿用或不适用原因，不调用AI-05、不新增评级。"
   ]
  },
  "pending": "",
  "panoramaFixedStep": "Step 5.1",
  "panoramaGroupTitle": "Step 5 · 评价金融意义 M"
 },
 {
  "id": "RATE-PREP",
  "type": "PROGRAM",
  "name": "固定评价范围、期限与方法",
  "module": "F02",
  "source": "F02",
  "section": "§4.6.1",
  "rule": "F02 §4.6.1",
  "input": "event_context",
  "output": "event_context",
  "inputDescription": "初评／复评决定、事件事实、关系和证据",
  "outputDescription": "固定范围、期限、方法、规则锚点与历史评级",
  "summary": "程序固定assessment_scope、研究期限和method_version，汇集事实、阶段、Target范围、变量定义与方向。",
  "ruleDetail": "程序固定assessment_scope、研究期限和method_version，汇集事实、阶段、Target范围、变量定义与方向。；提供确定版本证据、规则和锚点；复评同时提供旧评级与新增变化。；明确规则批准状态；规则未定可准备文字评价，必需上下文缺失时待处理。",
  "next": [
   {
    "label": "上下文完整，交 AI-05",
    "to": "RATE-A1"
   },
   {
    "label": "执行失败或输入不可用，保留恢复位置",
    "to": "EV-X"
   }
  ],
  "panoramaDetail": {
   "actions": [
    "程序固定assessment_scope、研究期限和method_version，汇集事实、阶段、Target范围、变量定义与方向。",
    "提供确定版本证据、规则和锚点；复评同时提供旧评级与新增变化。",
    "明确规则批准状态；规则未定可准备文字评价，必需上下文缺失时待处理。"
   ]
  },
  "pending": "",
  "panoramaFixedStep": "Step 5.2"
 },
 {
  "id": "RATE-CHECK",
  "type": "CONDITION",
  "name": "校验评价范围、证据与分值",
  "module": "F02",
  "source": "F02",
  "section": "§4.6.1、§4.9",
  "rule": "F02 §4.6.1、§4.9",
  "input": "event_context",
  "output": "event_context",
  "inputDescription": "AI-05维度判断、用途、理由及证据",
  "outputDescription": "通过校验的评价建议或具体错误原因",
  "summary": "核对事件关联、范围、期限和方法与输入一致。",
  "ruleDetail": "核对事件关联、范围、期限和方法与输入一致。；检查维度结构、原文定位、分值范围与用途标签；未知用途显式保留。；输出不合法不能作为空分草案保存，先恢复或复核。",
  "next": [
   {
    "label": "结果通过校验",
    "to": "RATE-CALC"
   },
   {
    "label": "校验不通过，待恢复或复核",
    "to": "EV-X"
   }
  ],
  "panoramaDetail": {
   "question": "校验评价范围、证据与分值？",
   "basis": [
    "核对事件关联、范围、期限和方法与输入一致。",
    "检查维度结构、原文定位、分值范围与用途标签；未知用途显式保留。",
    "输出不合法不能作为空分草案保存，先恢复或复核。"
   ]
  },
  "pending": "",
  "panoramaFixedStep": "Step 5.4"
 },
 {
  "id": "RATE-CALC",
  "type": "PROGRAM",
  "name": "按批准规则计算或复算 M",
  "module": "F02",
  "source": "F02",
  "section": "§4.6.1～4.6.2",
  "rule": "F02 §4.6.1～4.6.2",
  "input": "event_context",
  "output": "event_context",
  "inputDescription": "合格维度建议、规则批准状态和固定方法",
  "outputDescription": "程序算得的M，或有依据的空分结果",
  "summary": "规则已批准且输入充分时，程序执行确定性加权计算；AI总分建议必须独立复算。",
  "ruleDetail": "规则已批准且输入充分时，程序执行确定性加权计算；AI总分建议必须独立复算。；规则未批准或量化依据不足时保留文字评价、限制和空分，不把执行失败当作合法空分。；计算不一致时查明原因并记录处理依据，不能静默采用AI总分。",
  "next": [
   {
    "label": "计算完成或合法空分",
    "to": "RATE-RECORD"
   },
   {
    "label": "计算失败或差异未解决",
    "to": "EV-X"
   }
  ],
  "panoramaDetail": {
   "actions": [
    "规则已批准且输入充分时，程序执行确定性加权计算；AI总分建议必须独立复算。",
    "规则未批准或量化依据不足时保留文字评价、限制和空分，不把执行失败当作合法空分。",
    "计算不一致时查明原因并记录处理依据，不能静默采用AI总分。"
   ]
  },
  "pending": "",
  "panoramaFixedStep": "Step 5.5"
 },
 {
  "id": "RATE-RECORD",
  "type": "PROGRAM",
  "name": "整理评级记录与历史引用",
  "module": "F02",
  "source": "F02",
  "section": "§4.6.1～4.6.2",
  "rule": "F02 §4.6.1～4.6.2",
  "input": "event_context",
  "output": "event_context",
  "inputDescription": "经校验的维度、用途、程序计算或空分结果",
  "outputDescription": "初评／复评待保存记录与旧评级引用",
  "summary": "整理范围、期限、方法、证据、用途、理由和旧评级引用，保留复评历史。",
  "ruleDetail": "整理范围、期限、方法、证据、用途、理由和旧评级引用，保留复评历史。；评级身份、评价时间和状态由程序及既有复核流程管理；方法未批准保持草案。；将待保存结果交Step 6统一提交；本节点完成不代表评级已入库。",
  "next": [
   {
    "label": "评级记录就绪，交统一保存",
    "to": "EV-P2"
   },
   {
    "label": "记录或授权检查不通过",
    "to": "EV-X"
   }
  ],
  "panoramaDetail": {
   "actions": [
    "整理范围、期限、方法、证据、用途、理由和旧评级引用，保留复评历史。",
    "评级身份、评价时间和状态由程序及既有复核流程管理；方法未批准保持草案。",
    "将待保存结果交Step 6统一提交；本节点完成不代表评级已入库。"
   ]
  },
  "pending": "",
  "panoramaFixedStep": "Step 5.6"
 }
];
 nodes.push(...eventDefinitions);
 const eventPipeline=["EV-S", "EV-PREP", "EV-A1", "EV-CHECK", "EV-MATCH-PREP", "EV-A2", "EV-MATCH-CHECK", "EV-REL-PREP", "EV-A3", "EV-REL-CHECK", "EV-DELTA-PREP", "EV-A5", "EV-DELTA-CHECK", "RATE-DECIDE", "RATE-PREP", "RATE-A1", "RATE-CHECK", "RATE-CALC", "RATE-RECORD", "EV-P2", "EV-DELIVER", "EV-E"];
 const eventSections=[{"title": "事件管理七步主线", "module": "F02", "items": ["EV-S", "EV-PREP", "EV-A1", "EV-CHECK", "EV-MATCH-PREP", "EV-A2", "EV-MATCH-CHECK", "EV-REL-PREP", "EV-A3", "EV-REL-CHECK", "EV-DELTA-PREP", "EV-A5", "EV-DELTA-CHECK", "RATE-DECIDE", "RATE-PREP", "RATE-A1", "RATE-CHECK", "RATE-CALC", "RATE-RECORD", "EV-P2", "EV-DELIVER", "EV-E"]}, {"title": "无事件、待处理与恢复", "module": "F02", "kind": "outcomes", "items": [{"title": "无事件记录", "parallel": false, "lanes": [{"title": "0个候选", "nodes": ["EV-ZERO"]}]}, "EV-X", "EV-SAVEWAIT", "EV-SENDWAIT"]}];
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
  ['G-M2','M2 风险观察定义与候选治理','§5.3 M2','治理风险源、风险类型、全局变量、指标口径、允许来源和映射；候选审核后生效。','变量候选、定义维护请求、M1信源与业务反馈','已确认定义、指标映射及版本',[{label:'风险与变量配置',to:'RISK-P1'},{label:'长期关系引用的观测定义',to:'STATE-P1'}],''],
  ['G-M3','M3 方法、规则与固定版本治理','§5.3 M3','治理分析方法及适用版本，后续运行使用已确认定义，历史运行保留原引用。','授权方法维护、执行反馈和评估依据','适用方法、规则及固定版本',[{label:'当前状态分析方法',to:'STATE-FORK'}],'事件方法与报告模板的支撑范围仍待确认。']
 ])overviewNode('FEED',id,{
  type:'MODULE',name,module:id.slice(2),section,rule:`总览 ${section}`,summary,ruleDetail:summary,
  inputDescription:input,outputDescription:output,next,pending
 });

 function separateExits(sections,ids,title){
  for(const section of sections)section.items=section.items.filter(item=>typeof item!=='string'||!ids.includes(item));
  sections.push({title,kind:'outcomes',items:[{title:'按实际问题转入',parallel:false,lanes:ids.map(id=>({title:node(id).name,nodes:[id]}))}]});
 }
 separateExits(changeSections,['CHANGE-X'],'历史比较待处理出口');
 separateExits(reportSections,['REPORT-X','REPORT-H'],'报告校验与发布待处理出口');
 changeSections[1].items=changeSections[1].items.filter(item=>item!=='CHANGE-UNKNOWN');
 changeSections[1].description='仅有可比历史时执行下列分析；首次或不可比时进入“变化待判断”分支。';
 changeSections.splice(2,0,{title:'首次或不可比时保留变化待判断',module:'F06',description:'与上面的历史比较分析二选一，随后共同进入结果整理。',items:['CHANGE-UNKNOWN']});
 const main=sections=>sections.filter(section=>section.kind!=='outcomes'&&section.kind!=='followup');
 const exits=sections=>sections.filter(section=>section.kind==='outcomes');
 const stages=[
  {code:'L0',title:'信息接入与事件管理',description:'先接入并交付标准化资料，再进入事件管理。',output:'Information · Event / EventUpdate · Target与直接变量关联 · 金融意义',sections:[
   {title:'信息接入与标准化',module:'F01',items:['IN-S','IN-CHECK','IN-ING','IN-READ','IN-VERSION','IN-SAVE','IN-DELIVER','IN-DONE']},
   {title:'接入异常与恢复',module:'F01',kind:'outcomes',items:['IN-HOLD','IN-SAVE-WAIT','IN-SEND-WAIT']},
   ...eventSections
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
 // Presentation metadata never replaces the versioned executor type or graph identity.
 const triggers=new Set(['IN-S','EV-S','RATE-S','RISK-S','STATE-S','CHANGE-S','REPORT-S']);
 const transfers=new Set(['RISK-E','STATE-E','CHANGE-E']);
 const waiting=new Set(['IN-HOLD','IN-SAVE-WAIT','IN-SEND-WAIT','EV-X','EV-SAVEWAIT','EV-SENDWAIT','RISK-RESTORE','RISK-X','STATE-H','STATE-XCTX','CHANGE-X','REPORT-H','REPORT-X']);
 for(const n of nodes){
  n.panoramaKind=triggers.has(n.id)?'START':transfers.has(n.id)||n.type==='END'?'END':n.type==='CONDITION'?'DECISION':n.type==='MODULE'?'SUPPORT':'STEP';
  n.panoramaBoundary=waiting.has(n.id)?'待处理出口':transfers.has(n.id)?'交付':n.panoramaKind==='START'?'起点':n.panoramaKind==='END'?'结束':'横向支撑';
  n.panoramaRole=n.type==='CONDITION'?'CONDITION':['AI','HUMAN','PROGRAM'].includes(n.type)?n.type:'PROGRAM';
 }
 // This result explicitly saves the identification record: keep the action numbered.
 node('RISK-NONE').panoramaKind='STEP';
 const branchAnchors={"无事件记录":"EV-A1",'归组结果':'EV-C','变化处理':'EV-DELTA','按评级依据选择路径':'RATE-C','身份与准入分支':'RISK-C','按阅读需求选择查询视图':'VIEW-S'};
 for(const stage of stages){
  let sequence=0,f02Started=false;
  const branches=new Map();
  stage.kind=stage.kind||'business';
  for(const section of stage.sections){
   // F02 has its own reading sequence, matching the seven steps in its function design.
   if(stage.code==='L0'&&section.module==='F02'&&!f02Started){sequence=0;branches.clear();f02Started=true;}
   section.steps=section.items.map(item=>{
    let label='';
    if(typeof item==='string'){
     const n=node(item);
     label=n.panoramaFixedStep||(['STEP','DECISION'].includes(n.panoramaKind)?`Step ${++sequence}`:n.panoramaBoundary);
     n.panoramaStep=label;
    }else{
     const anchor=node(branchAnchors[item.title])||node(item.parallel?(stage.code==='L2'&&section.module==='F05'?'STATE-FORK':'CHANGE-C'):'');
     const base=anchor?.panoramaStep?.match(/^Step (\d+)/)?.[1]||String(sequence);
     item.lanes.forEach((lane,laneIndex)=>{
      const incoming=nodes.find(n=>n.next.some(edge=>lane.nodes.includes(edge.to))&&n.panoramaStep?.startsWith('Step '));
      const parent=section.kind==='outcomes'?incoming?.panoramaStep?.match(/^Step (\d+)/)?.[1]||base:base;
      const pathIndex=Math.max(branches.get(parent)||0,laneIndex);
      branches.set(parent,pathIndex+1);
      lane.path=String.fromCharCode(65+pathIndex);
      lane.basis=anchor?.name||incoming?.name||section.description||'按对应节点的实际出口条件';
      let action=0;
      lane.nodes.forEach(id=>{
       const n=node(id);
       n.panoramaStep=n.panoramaFixedStep||(['STEP','DECISION'].includes(n.panoramaKind)?`Step ${parent}${item.numbering==='substeps'?'':lane.path}.${++action}`:n.panoramaBoundary);
      });
     });
    }
    return {label,item};
   });
  }
  stage.stepCount=new Set(stage.sections.flatMap(section=>section.steps).filter(step=>/^Step \d/.test(step.label)).map(step=>`${node(step.item).module}:${step.label.match(/^Step (\d+)/)[1]}`)).size;
  stage.actionCount=stage.sections.flatMap(section=>section.items.flatMap(item=>typeof item==='string'?[item]:item.lanes.flatMap(lane=>lane.nodes))).filter(id=>['STEP','DECISION'].includes(node(id).panoramaKind)).length;
  stage.items=stage.sections.flatMap(section=>section.items);
 }
 const moduleDefinitions=[
  {code:'F01',name:'信息接入与标准化模块',description:'资格核对、资料获取、标准化、版本识别、保存与交付',conceptSource:'F01',conceptSections:'§1.1～1.2、§3.1～3.3、§4.5',concepts:[
   {name:'资料',term:'Information',definition:'资料是从可核验来源取得、以原件为依据保存的内容单元，可以是网页、公告、报告、文件或结构化原始响应。F01将其整理为标准化资料，包含正文或结构化内容，以及来源、发布时间、取得时间、原件定位和版本信息。',boundary:'同一来源的同一份资料沿用稳定身份：内容未变时复用，来源修订或重新解析后内容变化时保留新版本。不同来源分别保存，不能仅凭标题或内容相似合并；原文、数字、表格与附件保持可追溯，发布时间未知时留空。'}
  ]},
  {code:'F02',name:'事件管理',pipeline:eventPipeline,description:'事件提取、归组、增量与金融意义评级',conceptSource:'F02',conceptSections:'§3.2～3.6、§4.3～4.5',concepts:[
   {name:'事件',term:'Event',definition:'在明确时间语境下，由特定宏观主体发起或体现、包含相对完整的行为、决定或状态变化，并能被持续追踪的事件单元。',boundary:'基础要素是主体、行为／变化、时间。同一核心行为的多篇报道归为同一事件；一篇汇总资料也可能包含多个事件。计划中的具体变化需保留状态与时间语义。'},
   {name:'事件更新',term:'EventUpdate',definition:'记录同一事件的新增变化、阶段推进和纠正历史；一个事件可以有多条更新记录。',boundary:'同一政策或行动的“宣布—推进—实施—完成”可作为连续进展；明确独立的决定或新措施应建立新事件。仅增加来源且无实质变化时，增加来源关联。'},
   {name:'观测主体',term:'Target',definition:'事件分析中被观测、用于记录事件作用及相关变量变化的主体，具有稳定身份和明确范围，可被多个事件共同引用。',boundary:'首版限于宏观范围。观测主体与发起、执行或体现事件行为的主体（Subject）分别记录；二者只有在身份及范围相符时才对应。'},
   {name:'变量',term:'Variable',definition:'跨事件和风险分析复用的全局变量，沿用统一名称、定义、单位和解释口径。',boundary:'F02只关联事件直接涉及、宣布改变或有来源记录发生变化的变量。缺少直接依据时可以留空，后续传导变量交由下游风险分析判断。'}
  ]},
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
     const lanes=step.item.lanes.map(lane=>({...lane,nodes:lane.nodes.filter(belongs),handoffs:section.module===definition.code?lane.nodes.filter(id=>!belongs(id)):[]})).filter(lane=>lane.nodes.length||lane.handoffs.length);
     return lanes.length?[{...step,item:{...step.item,lanes}}]:[];
    });
    return {...section,module:definition.code,title:definition.code==='F02'&&section.module==='F01'?'接收可追溯资料':section.title,steps,items:steps.map(step=>step.item)};
   }).filter(section=>section.steps.length);
   if(!sections.length)return [];
   const nodeIds=sections.flatMap(section=>section.items.flatMap(item=>typeof item==='string'?[item]:item.lanes.flatMap(lane=>lane.nodes)));
   const numbered=nodeIds.map(id=>Number(node(id).panoramaStep.match(/^Step (\d+)/)?.[1])).filter(Boolean);
   const first=Math.min(...numbered),last=Math.max(...numbered);
   const numberedLabels=nodeIds.map(id=>node(id).panoramaStep).filter(label=>label.startsWith('Step '));
   return [{...definition,sections,nodeIds,stepRange:numberedLabels.length?`${first===last?'Step '+first:'Step '+first+'～'+last} · ${numberedLabels.length} 个动作`:'无编号业务动作'}];
  });
 }
 return {source:'overview',summary:'从资料接入、事件管理、风险纳管到状态分析、历史变化与产品发布的完整业务流程；步骤编号用于阅读，分流、并行、依赖与独立触发按标注理解。',nodes,stages};
})();
