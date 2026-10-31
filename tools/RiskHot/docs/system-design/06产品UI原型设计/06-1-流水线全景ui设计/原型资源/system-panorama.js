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

 // F02: reviewed eight-step business definition; independent of runtime task packages.
 const eventDefinitions=[
  {
    "id": "EV-S",
    "type": "START",
    "name": "接收已保存资料",
    "module": "F02",
    "source": "F02",
    "section": "§4.1",
    "rule": "F02 §4.1",
    "input": "event_context",
    "output": "event_context",
    "inputDescription": "已保存 material、版本值、摘要、来源与权限",
    "outputDescription": "本次处理范围或已有记录续接",
    "summary": "复用有效处理记录；资料版本与正文必须可读，已完成部分不重复分析。",
    "ruleDetail": "复用有效处理记录；资料版本与正文必须可读，已完成部分不重复分析。",
    "next": [
      {
        "label": "准备未完成范围",
        "to": "EV-PREP"
      },
      {
        "label": "已保存仅待交付",
        "to": "EV-DELIVER"
      },
      {
        "label": "输入待恢复",
        "to": "EV-X"
      }
    ],
    "pending": "",
    "panoramaFixedStep": "起点",
    "reviewed": true,
    "panoramaDetail": {
      "actions": [
        "复用有效处理记录；资料版本与正文必须可读，已完成部分不重复分析。"
      ],
      "basis": [
        "复用有效处理记录；资料版本与正文必须可读，已完成部分不重复分析。"
      ],
      "question": "接收已保存资料？",
      "trigger": "已保存 material、版本值、摘要、来源与权限",
      "continuation": "本次处理范围或已有记录续接",
      "recovery": "复用有效处理记录；资料版本与正文必须可读，已完成部分不重复分析。",
      "resultType": "接收已保存资料",
      "resultTone": "complete"
    }
  },
  {
    "id": "EV-PREP",
    "type": "PROGRAM",
    "name": "准备候选提取输入",
    "module": "F02",
    "source": "F02",
    "section": "§4.2.3～4.2.4",
    "rule": "F02 §4.2.3～4.2.4",
    "input": "event_context",
    "output": "event_context",
    "inputDescription": "资料正文、证据定位及版本",
    "outputDescription": "完整且固定的提取输入",
    "summary": "核对资格、证据可读性、版本与覆盖范围；不把失败当成零候选。",
    "ruleDetail": "核对资格、证据可读性、版本与覆盖范围；不把失败当成零候选。",
    "next": [
      {
        "label": "输入可用",
        "to": "EV-A1"
      },
      {
        "label": "待恢复",
        "to": "EV-X"
      }
    ],
    "pending": "",
    "panoramaFixedStep": "Step 1.1",
    "reviewed": true,
    "panoramaDetail": {
      "actions": [
        "核对资格、证据可读性、版本与覆盖范围；不把失败当成零候选。"
      ],
      "basis": [
        "核对资格、证据可读性、版本与覆盖范围；不把失败当成零候选。"
      ],
      "question": "准备候选提取输入？",
      "trigger": "资料正文、证据定位及版本",
      "continuation": "完整且固定的提取输入",
      "recovery": "核对资格、证据可读性、版本与覆盖范围；不把失败当成零候选。",
      "resultType": "准备候选提取输入",
      "resultTone": "complete"
    }
  },
  {
    "id": "EV-A1",
    "type": "AI",
    "name": "候选事件提取",
    "module": "F02",
    "source": "F02",
    "section": "§4.2",
    "rule": "F02 §4.2",
    "input": "event_context",
    "output": "event_context",
    "inputDescription": "资料主文、引用关系与原文证据",
    "outputDescription": "0～N 个候选陈述、事件要素、对象线索及证据",
    "summary": "识别独立行动或状态变化，保留 Subject、Action、Object、时间、关键事实与数值、条件及未知项；不分配正式身份。",
    "ruleDetail": "识别独立行动或状态变化，保留 Subject、Action、Object、时间、关键事实与数值、条件及未知项；不分配正式身份。",
    "next": [
      {
        "label": "校验输出",
        "to": "EV-CHECK"
      }
    ],
    "pending": "",
    "panoramaFixedStep": "Step 1.2",
    "reviewed": true,
    "panoramaDetail": {
      "actions": [
        "识别独立行动或状态变化，保留 Subject、Action、Object、时间、关键事实与数值、条件及未知项；不分配正式身份。"
      ],
      "basis": [
        "识别独立行动或状态变化，保留 Subject、Action、Object、时间、关键事实与数值、条件及未知项；不分配正式身份。"
      ],
      "question": "候选事件提取？",
      "trigger": "资料主文、引用关系与原文证据",
      "continuation": "0～N 个候选陈述、事件要素、对象线索及证据",
      "recovery": "识别独立行动或状态变化，保留 Subject、Action、Object、时间、关键事实与数值、条件及未知项；不分配正式身份。",
      "resultType": "候选事件提取",
      "resultTone": "complete"
    },
    "task": "AI-01",
    "taskVersion": "reviewed-2026-10-31"
  },
  {
    "id": "EV-CHECK",
    "type": "CONDITION",
    "name": "校验并保存或复用 Fact",
    "module": "F02",
    "source": "F02",
    "section": "§4.2.4",
    "rule": "F02 §4.2.4",
    "input": "event_context",
    "output": "event_context",
    "inputDescription": "候选及证据、已有 Fact 与来源",
    "outputDescription": "已保存或复用的 Fact、零候选记录或待处理原因",
    "summary": "同一次发生跨报道复用 Fact 并补来源；完整有效的零候选才可正常结束。",
    "ruleDetail": "同一次发生跨报道复用 Fact 并补来源；完整有效的零候选才可正常结束。",
    "next": [
      {
        "label": "有效 Fact",
        "to": "EV-MODEL"
      },
      {
        "label": "合法零候选",
        "to": "EV-ZERO"
      },
      {
        "label": "输出或证据不合格",
        "to": "EV-X"
      }
    ],
    "pending": "",
    "panoramaFixedStep": "Step 1.3",
    "reviewed": true,
    "panoramaDetail": {
      "actions": [
        "同一次发生跨报道复用 Fact 并补来源；完整有效的零候选才可正常结束。"
      ],
      "basis": [
        "同一次发生跨报道复用 Fact 并补来源；完整有效的零候选才可正常结束。"
      ],
      "question": "校验并保存或复用 Fact？",
      "trigger": "候选及证据、已有 Fact 与来源",
      "continuation": "已保存或复用的 Fact、零候选记录或待处理原因",
      "recovery": "同一次发生跨报道复用 Fact 并补来源；完整有效的零候选才可正常结束。",
      "resultType": "校验并保存或复用 Fact",
      "resultTone": "complete"
    }
  },
  {
    "id": "EV-MODEL",
    "type": "PROGRAM",
    "name": "映射 Event 并准备对象语境",
    "module": "F02",
    "source": "F02",
    "section": "§4.3",
    "rule": "F02 §4.3",
    "input": "event_context",
    "output": "event_context",
    "inputDescription": "已保存 Fact、Object 及原文语境",
    "outputDescription": "待融合 Event、Target 候选识别输入",
    "summary": "程序逐字段映射 Fact → Event，保留原值、时间精度与缺口；不提前创建正式 Event。",
    "ruleDetail": "程序逐字段映射 Fact → Event，保留原值、时间精度与缺口；不提前创建正式 Event。",
    "next": [
      {
        "label": "识别对象候选",
        "to": "EV-TARGET-AI"
      }
    ],
    "pending": "",
    "panoramaFixedStep": "Step 2.1",
    "reviewed": true,
    "panoramaDetail": {
      "actions": [
        "程序逐字段映射 Fact → Event，保留原值、时间精度与缺口；不提前创建正式 Event。"
      ],
      "basis": [
        "程序逐字段映射 Fact → Event，保留原值、时间精度与缺口；不提前创建正式 Event。"
      ],
      "question": "映射 Event 并准备对象语境？",
      "trigger": "已保存 Fact、Object 及原文语境",
      "continuation": "待融合 Event、Target 候选识别输入",
      "recovery": "程序逐字段映射 Fact → Event，保留原值、时间精度与缺口；不提前创建正式 Event。",
      "resultType": "映射 Event 并准备对象语境",
      "resultTone": "complete"
    }
  },
  {
    "id": "EV-TARGET-AI",
    "type": "AI",
    "name": "Target 候选识别",
    "module": "F02",
    "source": "F02",
    "section": "§4.3.4",
    "rule": "F02 §4.3.4",
    "input": "event_context",
    "output": "event_context",
    "inputDescription": "Object、对象线索、Subject、Action、语境及证据",
    "outputDescription": "逐项 Target 候选、作用依据、来源映射、排除与未决理由",
    "summary": "可一对多识别金融观测对象；仅被提及或凭常识可能受影响不足以构成候选；不检索或核定正式身份。",
    "ruleDetail": "可一对多识别金融观测对象；仅被提及或凭常识可能受影响不足以构成候选；不检索或核定正式身份。",
    "next": [
      {
        "label": "校验候选覆盖",
        "to": "EV-MODEL-CHECK"
      }
    ],
    "pending": "",
    "panoramaFixedStep": "Step 2.2",
    "reviewed": true,
    "panoramaDetail": {
      "actions": [
        "可一对多识别金融观测对象；仅被提及或凭常识可能受影响不足以构成候选；不检索或核定正式身份。"
      ],
      "basis": [
        "可一对多识别金融观测对象；仅被提及或凭常识可能受影响不足以构成候选；不检索或核定正式身份。"
      ],
      "question": "Target 候选识别？",
      "trigger": "Object、对象线索、Subject、Action、语境及证据",
      "continuation": "逐项 Target 候选、作用依据、来源映射、排除与未决理由",
      "recovery": "可一对多识别金融观测对象；仅被提及或凭常识可能受影响不足以构成候选；不检索或核定正式身份。",
      "resultType": "Target 候选识别",
      "resultTone": "complete"
    },
    "task": "AI-08",
    "taskVersion": "reviewed-2026-10-31"
  },
  {
    "id": "EV-MODEL-CHECK",
    "type": "CONDITION",
    "name": "校验建模与候选覆盖",
    "module": "F02",
    "source": "F02",
    "section": "§4.3.4",
    "rule": "F02 §4.3.4",
    "input": "event_context",
    "output": "event_context",
    "inputDescription": "Event 映射与逐对象识别结果",
    "outputDescription": "有效建模、候选与缺口",
    "summary": "核对结构、证据、覆盖及边界，区分合法空结果、未决与执行失败；不得遗漏多对象或虚构身份。",
    "ruleDetail": "核对结构、证据、覆盖及边界，区分合法空结果、未决与执行失败；不得遗漏多对象或虚构身份。",
    "next": [
      {
        "label": "有效结果交融合",
        "to": "EV-MATCH-PREP"
      },
      {
        "label": "原始抽取错误",
        "to": "EV-PREP"
      },
      {
        "label": "待恢复或复核",
        "to": "EV-X"
      }
    ],
    "pending": "",
    "panoramaFixedStep": "Step 2.3",
    "reviewed": true,
    "panoramaDetail": {
      "actions": [
        "核对结构、证据、覆盖及边界，区分合法空结果、未决与执行失败；不得遗漏多对象或虚构身份。"
      ],
      "basis": [
        "核对结构、证据、覆盖及边界，区分合法空结果、未决与执行失败；不得遗漏多对象或虚构身份。"
      ],
      "question": "校验建模与候选覆盖？",
      "trigger": "Event 映射与逐对象识别结果",
      "continuation": "有效建模、候选与缺口",
      "recovery": "核对结构、证据、覆盖及边界，区分合法空结果、未决与执行失败；不得遗漏多对象或虚构身份。",
      "resultType": "校验建模与候选覆盖",
      "resultTone": "complete"
    }
  },
  {
    "id": "EV-MATCH-PREP",
    "type": "PROGRAM",
    "name": "准备实例与检索已有身份",
    "module": "F02",
    "source": "F02",
    "section": "§4.4.4",
    "rule": "F02 §4.4.4",
    "input": "event_context",
    "output": "event_context",
    "inputDescription": "Event、Target 候选及已有实例",
    "outputDescription": "分别固定的事件与对象比较范围",
    "summary": "Event 与 Target 分别召回和比较，名称相同不能替代同一性；检索失败不等于无匹配。",
    "ruleDetail": "Event 与 Target 分别召回和比较，名称相同不能替代同一性；检索失败不等于无匹配。",
    "next": [
      {
        "label": "比较 Event",
        "to": "EV-A2"
      },
      {
        "label": "检索失败",
        "to": "EV-X"
      }
    ],
    "pending": "",
    "panoramaFixedStep": "Step 3.1",
    "reviewed": true,
    "panoramaDetail": {
      "actions": [
        "Event 与 Target 分别召回和比较，名称相同不能替代同一性；检索失败不等于无匹配。"
      ],
      "basis": [
        "Event 与 Target 分别召回和比较，名称相同不能替代同一性；检索失败不等于无匹配。"
      ],
      "question": "准备实例与检索已有身份？",
      "trigger": "Event、Target 候选及已有实例",
      "continuation": "分别固定的事件与对象比较范围",
      "recovery": "Event 与 Target 分别召回和比较，名称相同不能替代同一性；检索失败不等于无匹配。",
      "resultType": "准备实例与检索已有身份",
      "resultTone": "complete"
    }
  },
  {
    "id": "EV-A2",
    "type": "AI",
    "name": "Event 同一性判断",
    "module": "F02",
    "source": "F02",
    "section": "§4.4.4",
    "rule": "F02 §4.4.4",
    "input": "event_context",
    "output": "event_context",
    "inputDescription": "候选事件、检索结果、Fact 与原文",
    "outputDescription": "NEW、REUSE 或 UNRESOLVED 建议及逐项依据",
    "summary": "按事件身份判定新建或复用；不把阶段变化、来源增加直接当新事件，不提前保存。",
    "ruleDetail": "按事件身份判定新建或复用；不把阶段变化、来源增加直接当新事件，不提前保存。",
    "next": [
      {
        "label": "比较适用 Target",
        "to": "EV-TARGET-MATCH"
      }
    ],
    "pending": "",
    "panoramaFixedStep": "Step 3.2",
    "reviewed": true,
    "panoramaDetail": {
      "actions": [
        "按事件身份判定新建或复用；不把阶段变化、来源增加直接当新事件，不提前保存。"
      ],
      "basis": [
        "按事件身份判定新建或复用；不把阶段变化、来源增加直接当新事件，不提前保存。"
      ],
      "question": "Event 同一性判断？",
      "trigger": "候选事件、检索结果、Fact 与原文",
      "continuation": "NEW、REUSE 或 UNRESOLVED 建议及逐项依据",
      "recovery": "按事件身份判定新建或复用；不把阶段变化、来源增加直接当新事件，不提前保存。",
      "resultType": "Event 同一性判断",
      "resultTone": "complete"
    },
    "task": "AI-02",
    "taskVersion": "reviewed-2026-10-31"
  },
  {
    "id": "EV-TARGET-MATCH",
    "type": "AI",
    "name": "Target 同一性判断",
    "module": "F02",
    "source": "F02",
    "section": "§4.4.4",
    "rule": "F02 §4.4.4",
    "input": "event_context",
    "output": "event_context",
    "inputDescription": "逐对象候选、召回结果、范围与证据",
    "outputDescription": "逐对象新建、复用或待确认建议",
    "summary": "核对对象身份、范围与别名；无适用候选可合法跳过，执行失败与无匹配分别记录。",
    "ruleDetail": "核对对象身份、范围与别名；无适用候选可合法跳过，执行失败与无匹配分别记录。",
    "next": [
      {
        "label": "统一校验身份",
        "to": "EV-MATCH-CHECK"
      }
    ],
    "pending": "",
    "panoramaFixedStep": "Step 3.3",
    "reviewed": true,
    "panoramaDetail": {
      "actions": [
        "核对对象身份、范围与别名；无适用候选可合法跳过，执行失败与无匹配分别记录。"
      ],
      "basis": [
        "核对对象身份、范围与别名；无适用候选可合法跳过，执行失败与无匹配分别记录。"
      ],
      "question": "Target 同一性判断？",
      "trigger": "逐对象候选、召回结果、范围与证据",
      "continuation": "逐对象新建、复用或待确认建议",
      "recovery": "核对对象身份、范围与别名；无适用候选可合法跳过，执行失败与无匹配分别记录。",
      "resultType": "Target 同一性判断",
      "resultTone": "complete"
    },
    "task": "AI-07",
    "taskVersion": "reviewed-2026-10-31"
  },
  {
    "id": "EV-MATCH-CHECK",
    "type": "CONDITION",
    "name": "核定身份方向与继续范围",
    "module": "F02",
    "source": "F02",
    "section": "§4.4.4",
    "rule": "F02 §4.4.4",
    "input": "event_context",
    "output": "event_context",
    "inputDescription": "Event/Target 比较、覆盖与复核依据",
    "outputDescription": "有效事件身份、对象身份或待确认项",
    "summary": "只有实例融合决定 NEW/REUSE；对象待定时保留缺口与获准独立范围，发现身份冲突须复核。",
    "ruleDetail": "只有实例融合决定 NEW/REUSE；对象待定时保留缺口与获准独立范围，发现身份冲突须复核。",
    "next": [
      {
        "label": "事件身份有效",
        "to": "EV-DELTA-PREP"
      },
      {
        "label": "身份待确认",
        "to": "EV-X"
      }
    ],
    "pending": "",
    "panoramaFixedStep": "Step 3.4",
    "reviewed": true,
    "panoramaDetail": {
      "actions": [
        "只有实例融合决定 NEW/REUSE；对象待定时保留缺口与获准独立范围，发现身份冲突须复核。"
      ],
      "basis": [
        "只有实例融合决定 NEW/REUSE；对象待定时保留缺口与获准独立范围，发现身份冲突须复核。"
      ],
      "question": "核定身份方向与继续范围？",
      "trigger": "Event/Target 比较、覆盖与复核依据",
      "continuation": "有效事件身份、对象身份或待确认项",
      "recovery": "只有实例融合决定 NEW/REUSE；对象待定时保留缺口与获准独立范围，发现身份冲突须复核。",
      "resultType": "核定身份方向与继续范围",
      "resultTone": "complete"
    }
  },
  {
    "id": "EV-DELTA-PREP",
    "type": "PROGRAM",
    "name": "固定事实与比较基准",
    "module": "F02",
    "source": "F02",
    "section": "§4.5.3～4.5.4",
    "rule": "F02 §4.5.3～4.5.4",
    "input": "event_context",
    "output": "event_context",
    "inputDescription": "身份方向、本次 Fact、历史事实及来源",
    "outputDescription": "NEW 初始依据或 REUSE 历史基准",
    "summary": "新事件明确无历史；已有事件读取失败不能当成无历史新建。",
    "ruleDetail": "新事件明确无历史；已有事件读取失败不能当成无历史新建。",
    "next": [
      {
        "label": "识别事件增量",
        "to": "EV-A5"
      },
      {
        "label": "基准待恢复",
        "to": "EV-X"
      }
    ],
    "pending": "",
    "panoramaFixedStep": "Step 4.1",
    "reviewed": true,
    "panoramaDetail": {
      "actions": [
        "新事件明确无历史；已有事件读取失败不能当成无历史新建。"
      ],
      "basis": [
        "新事件明确无历史；已有事件读取失败不能当成无历史新建。"
      ],
      "question": "固定事实与比较基准？",
      "trigger": "身份方向、本次 Fact、历史事实及来源",
      "continuation": "NEW 初始依据或 REUSE 历史基准",
      "recovery": "新事件明确无历史；已有事件读取失败不能当成无历史新建。",
      "resultType": "固定事实与比较基准",
      "resultTone": "complete"
    }
  },
  {
    "id": "EV-A5",
    "type": "AI",
    "name": "事件增量识别",
    "module": "F02",
    "source": "F02",
    "section": "§4.5",
    "rule": "F02 §4.5",
    "input": "event_context",
    "output": "event_context",
    "inputDescription": "本次事实、身份方向、历史及证据",
    "outputDescription": "初始事实或五类增量、变化描述与独立处理状态",
    "summary": "NEW 核对初始事实；REUSE 识别进展、实质补充、纠正、来源增加或重复。变量变化先保留事实口径，不依赖本轮规范变量提取。",
    "ruleDetail": "NEW 核对初始事实；REUSE 识别进展、实质补充、纠正、来源增加或重复。变量变化先保留事实口径，不依赖本轮规范变量提取。",
    "next": [
      {
        "label": "校验增量结果",
        "to": "EV-DELTA-CHECK"
      }
    ],
    "pending": "",
    "panoramaFixedStep": "Step 4.2",
    "reviewed": true,
    "panoramaDetail": {
      "actions": [
        "NEW 核对初始事实；REUSE 识别进展、实质补充、纠正、来源增加或重复。变量变化先保留事实口径，不依赖本轮规范变量提取。"
      ],
      "basis": [
        "NEW 核对初始事实；REUSE 识别进展、实质补充、纠正、来源增加或重复。变量变化先保留事实口径，不依赖本轮规范变量提取。"
      ],
      "question": "事件增量识别？",
      "trigger": "本次事实、身份方向、历史及证据",
      "continuation": "初始事实或五类增量、变化描述与独立处理状态",
      "recovery": "NEW 核对初始事实；REUSE 识别进展、实质补充、纠正、来源增加或重复。变量变化先保留事实口径，不依赖本轮规范变量提取。",
      "resultType": "事件增量识别",
      "resultTone": "complete"
    },
    "task": "AI-03",
    "taskVersion": "reviewed-2026-10-31"
  },
  {
    "id": "EV-DELTA-CHECK",
    "type": "CONDITION",
    "name": "校验事实差异与处理状态",
    "module": "F02",
    "source": "F02",
    "section": "§4.5.4",
    "rule": "F02 §4.5.4",
    "input": "event_context",
    "output": "event_context",
    "inputDescription": "分类、前后值、时间、来源及复用依据",
    "outputDescription": "有效增量或待确认原因",
    "summary": "待确认不提交部分更新；来源增加/重复不制造变量变化，仍恢复未完成的变量、评价或交付项。",
    "ruleDetail": "待确认不提交部分更新；来源增加/重复不制造变量变化，仍恢复未完成的变量、评价或交付项。",
    "next": [
      {
        "label": "核对风险变量",
        "to": "EV-VARIABLE"
      },
      {
        "label": "身份冲突返回融合",
        "to": "EV-MATCH-PREP"
      },
      {
        "label": "事实待复核",
        "to": "EV-X"
      }
    ],
    "pending": "",
    "panoramaFixedStep": "Step 4.3",
    "reviewed": true,
    "panoramaDetail": {
      "actions": [
        "待确认不提交部分更新；来源增加/重复不制造变量变化，仍恢复未完成的变量、评价或交付项。"
      ],
      "basis": [
        "待确认不提交部分更新；来源增加/重复不制造变量变化，仍恢复未完成的变量、评价或交付项。"
      ],
      "question": "校验事实差异与处理状态？",
      "trigger": "分类、前后值、时间、来源及复用依据",
      "continuation": "有效增量或待确认原因",
      "recovery": "待确认不提交部分更新；来源增加/重复不制造变量变化，仍恢复未完成的变量、评价或交付项。",
      "resultType": "校验事实差异与处理状态",
      "resultTone": "complete"
    }
  },
  {
    "id": "EV-VARIABLE",
    "type": "AI",
    "name": "风险变量识别、标准化与取值",
    "module": "F02",
    "source": "F02",
    "section": "§4.6",
    "rule": "F02 §4.6",
    "input": "event_context",
    "output": "event_context",
    "inputDescription": "事件要素、语义、定义、事实与原文、Step 4 结果",
    "outputDescription": "定义匹配或候选、取值、时间、性质、证据及变化对应",
    "summary": "从 Subject、Action、Object 及语义识别；Target 确认不是识别前提。定义与具体值分离，区分实际/计划/预期，未知不补值，风险角色不固化。",
    "ruleDetail": "从 Subject、Action、Object 及语义识别；Target 确认不是识别前提。定义与具体值分离，区分实际/计划/预期，未知不补值，风险角色不固化。",
    "next": [
      {
        "label": "校验对象与观测关联",
        "to": "EV-VARIABLE-CHECK"
      }
    ],
    "pending": "",
    "panoramaFixedStep": "Step 5.1",
    "reviewed": true,
    "panoramaDetail": {
      "actions": [
        "从 Subject、Action、Object 及语义识别；Target 确认不是识别前提。定义与具体值分离，区分实际/计划/预期，未知不补值，风险角色不固化。"
      ],
      "basis": [
        "从 Subject、Action、Object 及语义识别；Target 确认不是识别前提。定义与具体值分离，区分实际/计划/预期，未知不补值，风险角色不固化。"
      ],
      "question": "风险变量识别、标准化与取值？",
      "trigger": "事件要素、语义、定义、事实与原文、Step 4 结果",
      "continuation": "定义匹配或候选、取值、时间、性质、证据及变化对应",
      "recovery": "从 Subject、Action、Object 及语义识别；Target 确认不是识别前提。定义与具体值分离，区分实际/计划/预期，未知不补值，风险角色不固化。",
      "resultType": "风险变量识别、标准化与取值",
      "resultTone": "complete"
    },
    "task": "AI-05",
    "taskVersion": "reviewed-2026-10-31"
  },
  {
    "id": "EV-VARIABLE-CHECK",
    "type": "CONDITION",
    "name": "核对取值与对象关联",
    "module": "F02",
    "source": "F02",
    "section": "§4.6.4～4.6.6",
    "rule": "F02 §4.6.4～4.6.6",
    "input": "event_context",
    "output": "event_context",
    "inputDescription": "变量定义、取值、对象身份及证据",
    "outputDescription": "关联和观测记录建议，或候选与待关联缺口",
    "summary": "Target/Variable 确认后才形成正式关联建议；无值可有变量关联。沿用 Step 4 变化，多时间、多性质取值不覆盖；缺定义交 M2。",
    "ruleDetail": "Target/Variable 确认后才形成正式关联建议；无值可有变量关联。沿用 Step 4 变化，多时间、多性质取值不覆盖；缺定义交 M2。",
    "next": [
      {
        "label": "交适用评价",
        "to": "RATE-DECIDE"
      },
      {
        "label": "变化事实冲突",
        "to": "EV-DELTA-PREP"
      },
      {
        "label": "对象身份待核对",
        "to": "EV-MATCH-PREP"
      }
    ],
    "pending": "",
    "panoramaFixedStep": "Step 5.2",
    "reviewed": true,
    "panoramaDetail": {
      "actions": [
        "Target/Variable 确认后才形成正式关联建议；无值可有变量关联。沿用 Step 4 变化，多时间、多性质取值不覆盖；缺定义交 M2。"
      ],
      "basis": [
        "Target/Variable 确认后才形成正式关联建议；无值可有变量关联。沿用 Step 4 变化，多时间、多性质取值不覆盖；缺定义交 M2。"
      ],
      "question": "核对取值与对象关联？",
      "trigger": "变量定义、取值、对象身份及证据",
      "continuation": "关联和观测记录建议，或候选与待关联缺口",
      "recovery": "Target/Variable 确认后才形成正式关联建议；无值可有变量关联。沿用 Step 4 变化，多时间、多性质取值不覆盖；缺定义交 M2。",
      "resultType": "核对取值与对象关联",
      "resultTone": "complete"
    }
  },
  {
    "id": "RATE-DECIDE",
    "type": "CONDITION",
    "name": "判定金融意义评价范围",
    "module": "F02",
    "source": "FINANCIAL",
    "section": "第2～3节",
    "rule": "FINANCIAL 第2～3节",
    "input": "event_context",
    "output": "event_context",
    "inputDescription": "事实、变量、关系、范围、期限、已批准方法与既有评价",
    "outputDescription": "初评、复评、沿用、跳过或待处理依据",
    "summary": "金融意义由独立文档维护；同口径才比较评分，缺规则不可默认评分或将失败当跳过。",
    "ruleDetail": "金融意义由独立文档维护；同口径才比较评分，缺规则不可默认评分或将失败当跳过。",
    "next": [
      {
        "label": "满足评价条件",
        "to": "RATE-A1"
      },
      {
        "label": "合法跳过或获准保留缺口",
        "to": "EV-USAGE"
      },
      {
        "label": "等待规则或证据",
        "to": "EV-X"
      }
    ],
    "pending": "",
    "panoramaFixedStep": "Step 6.1",
    "reviewed": true,
    "panoramaDetail": {
      "actions": [
        "金融意义由独立文档维护；同口径才比较评分，缺规则不可默认评分或将失败当跳过。"
      ],
      "basis": [
        "金融意义由独立文档维护；同口径才比较评分，缺规则不可默认评分或将失败当跳过。"
      ],
      "question": "判定金融意义评价范围？",
      "trigger": "事实、变量、关系、范围、期限、已批准方法与既有评价",
      "continuation": "初评、复评、沿用、跳过或待处理依据",
      "recovery": "金融意义由独立文档维护；同口径才比较评分，缺规则不可默认评分或将失败当跳过。",
      "resultType": "判定金融意义评价范围",
      "resultTone": "complete"
    }
  },
  {
    "id": "RATE-A1",
    "type": "AI",
    "name": "金融意义五维评价",
    "module": "F02",
    "source": "FINANCIAL",
    "section": "第4～6节",
    "rule": "FINANCIAL 第4～6节",
    "input": "event_context",
    "output": "event_context",
    "inputDescription": "固定事实、范围、期限、规则与证据",
    "outputDescription": "五维依据与分数，或明确文字草案/缺口",
    "summary": "逐维匹配已批准规则，不计算正式 M；文字草案分数为空，评分失败不静默降级。任务编号待定，不占用 AI-05。",
    "ruleDetail": "逐维匹配已批准规则，不计算正式 M；文字草案分数为空，评分失败不静默降级。任务编号待定，不占用 AI-05。",
    "next": [
      {
        "label": "校验并计算",
        "to": "RATE-CALC"
      }
    ],
    "pending": "",
    "panoramaFixedStep": "Step 6.2",
    "reviewed": true,
    "panoramaDetail": {
      "actions": [
        "逐维匹配已批准规则，不计算正式 M；文字草案分数为空，评分失败不静默降级。任务编号待定，不占用 AI-05。"
      ],
      "basis": [
        "逐维匹配已批准规则，不计算正式 M；文字草案分数为空，评分失败不静默降级。任务编号待定，不占用 AI-05。"
      ],
      "question": "金融意义五维评价？",
      "trigger": "固定事实、范围、期限、规则与证据",
      "continuation": "五维依据与分数，或明确文字草案/缺口",
      "recovery": "逐维匹配已批准规则，不计算正式 M；文字草案分数为空，评分失败不静默降级。任务编号待定，不占用 AI-05。",
      "resultType": "金融意义五维评价",
      "resultTone": "complete"
    },
    "task": null,
    "taskVersion": "reviewed-2026-10-31"
  },
  {
    "id": "RATE-CALC",
    "type": "CONDITION",
    "name": "校验五维并计算 M",
    "module": "F02",
    "source": "FINANCIAL",
    "section": "第4～6节",
    "rule": "FINANCIAL 第4～6节",
    "input": "event_context",
    "output": "event_context",
    "inputDescription": "五维分数、规则、证据及范围",
    "outputDescription": "程序计算的 M 或草案/待处理结果",
    "summary": "五维齐全、规则有效、口径固定且逐维有据才计算；不补权重、不采信 AI 总分；结果交保存环节。",
    "ruleDetail": "五维齐全、规则有效、口径固定且逐维有据才计算；不补权重、不采信 AI 总分；结果交保存环节。",
    "next": [
      {
        "label": "评价结果有效",
        "to": "EV-USAGE"
      },
      {
        "label": "待修正或复核",
        "to": "EV-X"
      }
    ],
    "pending": "",
    "panoramaFixedStep": "Step 6.3",
    "reviewed": true,
    "panoramaDetail": {
      "actions": [
        "五维齐全、规则有效、口径固定且逐维有据才计算；不补权重、不采信 AI 总分；结果交保存环节。"
      ],
      "basis": [
        "五维齐全、规则有效、口径固定且逐维有据才计算；不补权重、不采信 AI 总分；结果交保存环节。"
      ],
      "question": "校验五维并计算 M？",
      "trigger": "五维分数、规则、证据及范围",
      "continuation": "程序计算的 M 或草案/待处理结果",
      "recovery": "五维齐全、规则有效、口径固定且逐维有据才计算；不补权重、不采信 AI 总分；结果交保存环节。",
      "resultType": "校验五维并计算 M",
      "resultTone": "complete"
    }
  },
  {
    "id": "EV-USAGE",
    "type": "AI",
    "name": "独立金融用途分类",
    "module": "F02",
    "source": "FINANCIAL",
    "section": "第7节",
    "rule": "FINANCIAL 第7节",
    "input": "event_context",
    "output": "event_context",
    "inputDescription": "事实、变量、分类规则及既有分类",
    "outputDescription": "用途标签、逐项依据、状态或合法跳过原因",
    "summary": "独立分类，不参与 M 计算，不占用 AI-05。缺失或失败不阻断合法评分和获准事件保存；后补分类独立提交交付。",
    "ruleDetail": "独立分类，不参与 M 计算，不占用 AI-05。缺失或失败不阻断合法评分和获准事件保存；后补分类独立提交交付。",
    "next": [
      {
        "label": "分类结果或缺口交保存",
        "to": "EV-P2"
      }
    ],
    "pending": "",
    "panoramaFixedStep": "Step 6.4",
    "reviewed": true,
    "panoramaDetail": {
      "actions": [
        "独立分类，不参与 M 计算，不占用 AI-05。缺失或失败不阻断合法评分和获准事件保存；后补分类独立提交交付。"
      ],
      "basis": [
        "独立分类，不参与 M 计算，不占用 AI-05。缺失或失败不阻断合法评分和获准事件保存；后补分类独立提交交付。"
      ],
      "question": "独立金融用途分类？",
      "trigger": "事实、变量、分类规则及既有分类",
      "continuation": "用途标签、逐项依据、状态或合法跳过原因",
      "recovery": "独立分类，不参与 M 计算，不占用 AI-05。缺失或失败不阻断合法评分和获准事件保存；后补分类独立提交交付。",
      "resultType": "独立金融用途分类",
      "resultTone": "complete"
    },
    "task": null,
    "taskVersion": "reviewed-2026-10-31"
  },
  {
    "id": "EV-P2",
    "type": "CONDITION",
    "name": "统一校验并保存事件结果",
    "module": "F02",
    "source": "F02",
    "section": "§4.8",
    "rule": "F02 §4.8",
    "input": "event_context",
    "output": "event_context",
    "inputDescription": "固定事实、身份、变量取值、关系、评价用途、权限与依据",
    "outputDescription": "正式 Event、适用结果、保存回执及交付依据",
    "summary": "统一核对归属、版本、批准与一致性；获准受限保存须保留缺口。保存成功后事件交付与 Step 8 独立推进。",
    "ruleDetail": "统一核对归属、版本、批准与一致性；获准受限保存须保留缺口。保存成功后事件交付与 Step 8 独立推进。",
    "next": [
      {
        "label": "保存成功，事件交付独立推进",
        "to": "EV-DELIVER"
      },
      {
        "label": "保存成功，符合关联条件",
        "to": "EV-ASSOC-PREP"
      },
      {
        "label": "保存结果待确认",
        "to": "EV-SAVEWAIT"
      },
      {
        "label": "依据或批准失效",
        "to": "EV-X"
      }
    ],
    "pending": "",
    "panoramaFixedStep": "Step 7.1",
    "reviewed": true,
    "panoramaDetail": {
      "actions": [
        "统一核对归属、版本、批准与一致性；获准受限保存须保留缺口。保存成功后事件交付与 Step 8 独立推进。"
      ],
      "basis": [
        "统一核对归属、版本、批准与一致性；获准受限保存须保留缺口。保存成功后事件交付与 Step 8 独立推进。"
      ],
      "question": "统一校验并保存事件结果？",
      "trigger": "固定事实、身份、变量取值、关系、评价用途、权限与依据",
      "continuation": "正式 Event、适用结果、保存回执及交付依据",
      "recovery": "统一核对归属、版本、批准与一致性；获准受限保存须保留缺口。保存成功后事件交付与 Step 8 独立推进。",
      "resultType": "统一校验并保存事件结果",
      "resultTone": "complete"
    }
  },
  {
    "id": "EV-ASSOC-PREP",
    "type": "CONDITION",
    "name": "准备正式事件关联范围",
    "module": "F02",
    "source": "F02",
    "section": "§4.9",
    "rule": "F02 §4.9",
    "input": "event_context",
    "output": "event_context",
    "inputDescription": "已保存 Event、观察窗口及可比变量",
    "outputDescription": "固定事件范围、窗口或合法跳过依据",
    "summary": "仅消费正式 Event，不用临时身份；事件交付不等待关联完成。",
    "ruleDetail": "仅消费正式 Event，不用临时身份；事件交付不等待关联完成。",
    "next": [
      {
        "label": "符合关联条件",
        "to": "EV-ASSOC"
      },
      {
        "label": "不适用，保持原事件结果",
        "to": "EV-E"
      }
    ],
    "pending": "",
    "panoramaFixedStep": "Step 8.1",
    "reviewed": true,
    "panoramaDetail": {
      "actions": [
        "仅消费正式 Event，不用临时身份；事件交付不等待关联完成。"
      ],
      "basis": [
        "仅消费正式 Event，不用临时身份；事件交付不等待关联完成。"
      ],
      "question": "准备正式事件关联范围？",
      "trigger": "已保存 Event、观察窗口及可比变量",
      "continuation": "固定事件范围、窗口或合法跳过依据",
      "recovery": "仅消费正式 Event，不用临时身份；事件交付不等待关联完成。",
      "resultType": "准备正式事件关联范围",
      "resultTone": "complete"
    }
  },
  {
    "id": "EV-ASSOC",
    "type": "AI",
    "name": "事件间关联分析",
    "module": "F02",
    "source": "F02",
    "section": "§4.9",
    "rule": "F02 §4.9",
    "input": "event_context",
    "output": "event_context",
    "inputDescription": "正式事件、变量、方向、驱动、主体、时间窗及证据",
    "outputDescription": "共同主线、五维依据、连续性及关联快照建议",
    "summary": "分析多个独立事件的共同事情或演化过程，保留反向和分化信号；不重新归组或合并原 Event。",
    "ruleDetail": "分析多个独立事件的共同事情或演化过程，保留反向和分化信号；不重新归组或合并原 Event。",
    "next": [
      {
        "label": "校验并独立保存快照",
        "to": "EV-ASSOC-SAVE"
      },
      {
        "label": "关联待恢复",
        "to": "EV-ASSOC-WAIT"
      }
    ],
    "pending": "",
    "panoramaFixedStep": "Step 8.2",
    "reviewed": true,
    "panoramaDetail": {
      "actions": [
        "分析多个独立事件的共同事情或演化过程，保留反向和分化信号；不重新归组或合并原 Event。"
      ],
      "basis": [
        "分析多个独立事件的共同事情或演化过程，保留反向和分化信号；不重新归组或合并原 Event。"
      ],
      "question": "事件间关联分析？",
      "trigger": "正式事件、变量、方向、驱动、主体、时间窗及证据",
      "continuation": "共同主线、五维依据、连续性及关联快照建议",
      "recovery": "分析多个独立事件的共同事情或演化过程，保留反向和分化信号；不重新归组或合并原 Event。",
      "resultType": "事件间关联分析",
      "resultTone": "complete"
    },
    "task": "AI-04",
    "taskVersion": "reviewed-2026-10-31"
  },
  {
    "id": "EV-ASSOC-SAVE",
    "type": "CONDITION",
    "name": "独立保存与交付关联快照",
    "module": "F02",
    "source": "F02",
    "section": "§4.9.7",
    "rule": "F02 §4.9.7",
    "input": "event_context",
    "output": "event_context",
    "inputDescription": "关联建议、范围、窗口、成员与证据",
    "outputDescription": "可追溯的关联快照及独立交付状态",
    "summary": "校验并独立保存快照，记录引用、有效性及历史；不回写原事件提交。交付失败仅恢复固定结果。",
    "ruleDetail": "校验并独立保存快照，记录引用、有效性及历史；不回写原事件提交。交付失败仅恢复固定结果。",
    "next": [
      {
        "label": "独立提交与交付完成",
        "to": "EV-E"
      },
      {
        "label": "保存或交付待恢复",
        "to": "EV-ASSOC-WAIT"
      }
    ],
    "pending": "",
    "panoramaFixedStep": "Step 8.3",
    "reviewed": true,
    "panoramaDetail": {
      "actions": [
        "校验并独立保存快照，记录引用、有效性及历史；不回写原事件提交。交付失败仅恢复固定结果。"
      ],
      "basis": [
        "校验并独立保存快照，记录引用、有效性及历史；不回写原事件提交。交付失败仅恢复固定结果。"
      ],
      "question": "独立保存与交付关联快照？",
      "trigger": "关联建议、范围、窗口、成员与证据",
      "continuation": "可追溯的关联快照及独立交付状态",
      "recovery": "校验并独立保存快照，记录引用、有效性及历史；不回写原事件提交。交付失败仅恢复固定结果。",
      "resultType": "独立保存与交付关联快照",
      "resultTone": "complete"
    }
  },
  {
    "id": "EV-DELIVER",
    "type": "CONDITION",
    "name": "独立交付已保存事件结果",
    "module": "F02",
    "source": "F02",
    "section": "§4.8.4",
    "rule": "F02 §4.8.4",
    "input": "event_context",
    "output": "event_context",
    "inputDescription": "固定保存结果及接收方契约",
    "outputDescription": "投递与接收回执",
    "summary": "发送、接收与采用分别记录；仅按实际变化交付，失败只重投固定结果，不重复分析或保存。",
    "ruleDetail": "发送、接收与采用分别记录；仅按实际变化交付，失败只重投固定结果，不重复分析或保存。",
    "next": [
      {
        "label": "交付完成",
        "to": "EV-E"
      },
      {
        "label": "投递或回执待恢复",
        "to": "EV-SENDWAIT"
      }
    ],
    "pending": "",
    "panoramaFixedStep": "共用能力",
    "reviewed": true,
    "panoramaDetail": {
      "actions": [
        "发送、接收与采用分别记录；仅按实际变化交付，失败只重投固定结果，不重复分析或保存。"
      ],
      "basis": [
        "发送、接收与采用分别记录；仅按实际变化交付，失败只重投固定结果，不重复分析或保存。"
      ],
      "question": "交付已保存事件结果？",
      "trigger": "固定保存结果及接收方契约",
      "continuation": "投递与接收回执",
      "recovery": "发送、接收与采用分别记录；仅按实际变化交付，失败只重投固定结果，不重复分析或保存。",
      "resultType": "交付已保存事件结果",
      "resultTone": "complete"
    }
  },
  {
    "id": "EV-E",
    "type": "END",
    "name": "本次结果处理完成",
    "module": "F02",
    "source": "F02",
    "section": "§4.8～4.9",
    "rule": "F02 §4.8～4.9",
    "input": "event_context",
    "output": "event_context",
    "inputDescription": "已完成的保存/交付或合法复用依据",
    "outputDescription": "事件结果、关联结果及各自状态可查",
    "summary": "事件结果与关联快照分别记录完成状态，不将一条分支完成当成全部成功。",
    "ruleDetail": "事件结果与关联快照分别记录完成状态，不将一条分支完成当成全部成功。",
    "next": [
      {
        "label": "供下游风险识别使用",
        "to": "RISK-S"
      }
    ],
    "pending": "",
    "panoramaFixedStep": "结束",
    "reviewed": true,
    "panoramaDetail": {
      "actions": [
        "事件结果与关联快照分别记录完成状态，不将一条分支完成当成全部成功。"
      ],
      "basis": [
        "事件结果与关联快照分别记录完成状态，不将一条分支完成当成全部成功。"
      ],
      "question": "本次结果处理完成？",
      "trigger": "已完成的保存/交付或合法复用依据",
      "continuation": "事件结果、关联结果及各自状态可查",
      "recovery": "事件结果与关联快照分别记录完成状态，不将一条分支完成当成全部成功。",
      "resultType": "本次结果处理完成",
      "resultTone": "complete"
    }
  },
  {
    "id": "EV-ZERO",
    "type": "END",
    "name": "记录合法零候选",
    "module": "F02",
    "source": "F02",
    "section": "§4.2",
    "rule": "F02 §4.2",
    "input": "event_context",
    "output": "event_context",
    "inputDescription": "完整校验的零候选结果",
    "outputDescription": "资料与零候选依据",
    "summary": "保留资料、覆盖及处理记录，不创建空 Fact 或 Event。",
    "ruleDetail": "保留资料、覆盖及处理记录，不创建空 Fact 或 Event。",
    "next": [],
    "pending": "",
    "panoramaFixedStep": "正常结束",
    "reviewed": true,
    "panoramaDetail": {
      "actions": [
        "保留资料、覆盖及处理记录，不创建空 Fact 或 Event。"
      ],
      "basis": [
        "保留资料、覆盖及处理记录，不创建空 Fact 或 Event。"
      ],
      "question": "记录合法零候选？",
      "trigger": "完整校验的零候选结果",
      "continuation": "资料与零候选依据",
      "recovery": "保留资料、覆盖及处理记录，不创建空 Fact 或 Event。",
      "resultType": "记录合法零候选",
      "resultTone": "complete"
    }
  },
  {
    "id": "EV-X",
    "type": "END",
    "name": "等待补齐、复核或执行恢复",
    "module": "F02",
    "source": "F02",
    "section": "§4.10",
    "rule": "F02 §4.10",
    "input": "event_context",
    "output": "event_context",
    "inputDescription": "失败、未决或条件不足",
    "outputDescription": "原因、合法已有结果与恢复位置",
    "summary": "按记录返回责任步骤，保留原文及审计；失败不能伪装成合法空结果或成功。",
    "ruleDetail": "按记录返回责任步骤，保留原文及审计；失败不能伪装成合法空结果或成功。",
    "next": [
      {
        "label": "恢复提取",
        "to": "EV-PREP"
      },
      {
        "label": "恢复身份核定",
        "to": "EV-MATCH-PREP"
      },
      {
        "label": "恢复增量",
        "to": "EV-DELTA-PREP"
      },
      {
        "label": "恢复变量处理",
        "to": "EV-VARIABLE"
      },
      {
        "label": "恢复评价",
        "to": "RATE-DECIDE"
      }
    ],
    "pending": "",
    "panoramaFixedStep": "待处理",
    "reviewed": true,
    "panoramaDetail": {
      "actions": [
        "按记录返回责任步骤，保留原文及审计；失败不能伪装成合法空结果或成功。"
      ],
      "basis": [
        "按记录返回责任步骤，保留原文及审计；失败不能伪装成合法空结果或成功。"
      ],
      "question": "等待补齐、复核或执行恢复？",
      "trigger": "失败、未决或条件不足",
      "continuation": "原因、合法已有结果与恢复位置",
      "recovery": "按记录返回责任步骤，保留原文及审计；失败不能伪装成合法空结果或成功。",
      "resultType": "等待补齐、复核或执行恢复",
      "resultTone": "complete"
    }
  },
  {
    "id": "EV-SAVEWAIT",
    "type": "END",
    "name": "保存待恢复",
    "module": "F02",
    "source": "F02",
    "section": "§4.8.4",
    "rule": "F02 §4.8.4",
    "input": "event_context",
    "output": "event_context",
    "inputDescription": "保存失败或回执未知",
    "outputDescription": "保存状态与恢复依据",
    "summary": "先查询已有结果，再恢复未完成提交，避免重复创建 Event。",
    "ruleDetail": "先查询已有结果，再恢复未完成提交，避免重复创建 Event。",
    "next": [
      {
        "label": "恢复保存",
        "to": "EV-P2"
      }
    ],
    "pending": "",
    "panoramaFixedStep": "待恢复",
    "reviewed": true,
    "panoramaDetail": {
      "actions": [
        "先查询已有结果，再恢复未完成提交，避免重复创建 Event。"
      ],
      "basis": [
        "先查询已有结果，再恢复未完成提交，避免重复创建 Event。"
      ],
      "question": "保存待恢复？",
      "trigger": "保存失败或回执未知",
      "continuation": "保存状态与恢复依据",
      "recovery": "先查询已有结果，再恢复未完成提交，避免重复创建 Event。",
      "resultType": "保存待恢复",
      "resultTone": "pending"
    }
  },
  {
    "id": "EV-SENDWAIT",
    "type": "END",
    "name": "事件交付待恢复",
    "module": "F02",
    "source": "F02",
    "section": "§4.8.4",
    "rule": "F02 §4.8.4",
    "input": "event_context",
    "output": "event_context",
    "inputDescription": "投递或回执失败",
    "outputDescription": "原交付内容与接收状态",
    "summary": "只恢复固定事件结果的投递与回执，不重跑上游分析。",
    "ruleDetail": "只恢复固定事件结果的投递与回执，不重跑上游分析。",
    "next": [
      {
        "label": "恢复事件交付",
        "to": "EV-DELIVER"
      }
    ],
    "pending": "",
    "panoramaFixedStep": "待恢复",
    "reviewed": true,
    "panoramaDetail": {
      "actions": [
        "只恢复固定事件结果的投递与回执，不重跑上游分析。"
      ],
      "basis": [
        "只恢复固定事件结果的投递与回执，不重跑上游分析。"
      ],
      "question": "事件交付待恢复？",
      "trigger": "投递或回执失败",
      "continuation": "原交付内容与接收状态",
      "recovery": "只恢复固定事件结果的投递与回执，不重跑上游分析。",
      "resultType": "事件交付待恢复",
      "resultTone": "pending"
    }
  },
  {
    "id": "EV-ASSOC-WAIT",
    "type": "END",
    "name": "关联处理待恢复",
    "module": "F02",
    "source": "F02",
    "section": "§4.9.7",
    "rule": "F02 §4.9.7",
    "input": "event_context",
    "output": "event_context",
    "inputDescription": "关联分析、保存或交付失败",
    "outputDescription": "原事件保持成功、关联独立待恢复",
    "summary": "分析失败恢复原范围；已保存快照仅恢复交付，不重新生成快照。",
    "ruleDetail": "分析失败恢复原范围；已保存快照仅恢复交付，不重新生成快照。",
    "next": [
      {
        "label": "分析未完成",
        "to": "EV-ASSOC-PREP"
      },
      {
        "label": "快照保存或交付未完成",
        "to": "EV-ASSOC-SAVE"
      }
    ],
    "pending": "",
    "panoramaFixedStep": "待恢复",
    "reviewed": true,
    "panoramaDetail": {
      "actions": [
        "分析失败恢复原范围；已保存快照仅恢复交付，不重新生成快照。"
      ],
      "basis": [
        "分析失败恢复原范围；已保存快照仅恢复交付，不重新生成快照。"
      ],
      "question": "关联处理待恢复？",
      "trigger": "关联分析、保存或交付失败",
      "continuation": "原事件保持成功、关联独立待恢复",
      "recovery": "分析失败恢复原范围；已保存快照仅恢复交付，不重新生成快照。",
      "resultType": "关联处理待恢复",
      "resultTone": "pending"
    }
  }
];
 nodes.push(...eventDefinitions);
 const eventPipeline=["EV-S", "EV-PREP", "EV-A1", "EV-CHECK", "EV-MODEL", "EV-TARGET-AI", "EV-MODEL-CHECK", "EV-MATCH-PREP", "EV-A2", "EV-TARGET-MATCH", "EV-MATCH-CHECK", "EV-DELTA-PREP", "EV-A5", "EV-DELTA-CHECK", "EV-VARIABLE", "EV-VARIABLE-CHECK", "RATE-DECIDE", "RATE-A1", "RATE-CALC", "EV-USAGE", "EV-P2", "EV-DELIVER", "EV-ASSOC-PREP", "EV-ASSOC", "EV-ASSOC-SAVE", "EV-E"];
 const eventSections=[{"title": "事件管理八步流程", "module": "F02", "items": ["EV-S", "EV-PREP", "EV-A1", "EV-CHECK", "EV-MODEL", "EV-TARGET-AI", "EV-MODEL-CHECK", "EV-MATCH-PREP", "EV-A2", "EV-TARGET-MATCH", "EV-MATCH-CHECK", "EV-DELTA-PREP", "EV-A5", "EV-DELTA-CHECK", "EV-VARIABLE", "EV-VARIABLE-CHECK", "RATE-DECIDE", "RATE-A1", "RATE-CALC", "EV-USAGE", "EV-P2", "EV-DELIVER", "EV-ASSOC-PREP", "EV-ASSOC", "EV-ASSOC-SAVE", "EV-E"]}, {"title": "正常结束与独立恢复", "module": "F02", "kind": "outcomes", "items": ["EV-ZERO", "EV-X", "EV-SAVEWAIT", "EV-SENDWAIT", "EV-ASSOC-WAIT"]}];
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
   // F02 has its own reading sequence, matching the eight steps in its function design.
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
  {code:'F02',name:'事件管理',pipeline:eventPipeline,description:'候选、建模、融合、增量、风险变量、金融意义、保存与事件关联',conceptSource:'F02',conceptSections:'§3.2～3.6、§4.3～4.5',concepts:[
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
