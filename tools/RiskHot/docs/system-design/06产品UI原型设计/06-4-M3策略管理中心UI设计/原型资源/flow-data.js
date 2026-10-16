'use strict';
// Source-grounded business blueprints; version numbers and evaluation fixtures remain UI examples.
const FLOW_SOURCES = {
  "overview": {
    "title": "系统功能架构总览",
    "path": "docs/system-design/03-系统功能架构/系统功能架构总览.md"
  },
  "L0": {
    "title": "L0 信息处理层：业务架构与领域设计",
    "path": "docs/system-design/02-业务架构与领域设计/RiskHot_L0_信息处理层_业务架构与领域设计V1.0.md"
  },
  "L1": {
    "title": "L1 风险识别与纳管层：业务架构与领域设计",
    "path": "docs/system-design/02-业务架构与领域设计/RiskHot_L1_风险识别与纳管层_业务架构与领域设计.md"
  },
  "L2": {
    "title": "L2 风险态势分析层：业务架构与领域设计",
    "path": "docs/system-design/02-业务架构与领域设计/RiskHot_L2_风险态势分析层_业务架构与领域设计V1.0.md"
  },
  "L3": {
    "title": "L3 风险产品与发布层：业务架构与领域设计",
    "path": "docs/system-design/02-业务架构与领域设计/RiskHot_L3_风险产品与发布层_业务架构与领域设计 V1.0.md"
  }
};
const DOMAIN_FLOWS = {
  "system": {
    "source": "overview",
    "summary": "按总览 §6.2～6.4 展示 F01～F08 的业务依赖；M1/M2/M3 为横向支撑。分流和交接表示业务关系，不规定部署或运行调度。",
    "nodes": [
      {
        "id": "S",
        "type": "START",
        "name": "外部资料 / 统计指标",
        "section": "§6.2",
        "rule": "§5.2 F01",
        "input": "business_context",
        "output": "context",
        "inputDescription": "外部资料、统计指标、M1/M2定义",
        "outputDescription": "待接入材料",
        "summary": "核对来源资格和采集条件后才能接入。",
        "ruleDetail": "核对来源资格和采集条件后才能接入。",
        "next": [
          {
            "label": "接入",
            "to": "ING"
          }
        ],
        "pending": "",
        "module": "",
        "source": "overview"
      },
      {
        "id": "ING",
        "type": "PROGRAM",
        "name": "F01 来源资格、接入与版本保存",
        "section": "§5.2 F01；§6.2",
        "rule": "§6.4 资格准备",
        "input": "context",
        "output": "context",
        "inputDescription": "M1资格、M2指标口径与材料",
        "outputDescription": "Information / 指标实际值及版本",
        "summary": "保存来源、时间、原始版本和修订；定义治理仍归M1/M2。",
        "ruleDetail": "保存来源、时间、原始版本和修订；定义治理仍归M1/M2。",
        "next": [
          {
            "label": "按输入类型",
            "to": "KIND"
          }
        ],
        "pending": "",
        "module": "F01",
        "source": "overview"
      },
      {
        "id": "KIND",
        "type": "CONDITION",
        "name": "输入类型分流",
        "section": "§6.2",
        "rule": "图 FA-D06",
        "input": "context",
        "output": "context",
        "inputDescription": "接入后材料",
        "outputDescription": "资讯事件路径或指标数据路径",
        "summary": "资讯、公告、报告进入事件处理；指标实际值校验后直接参与证据准备。",
        "ruleDetail": "资讯、公告、报告进入事件处理；指标实际值校验后直接参与证据准备。",
        "next": [
          {
            "label": "资讯 / 公告 / 报告",
            "to": "EVENT"
          },
          {
            "label": "指标实际值",
            "to": "VALUE"
          }
        ],
        "pending": "",
        "module": "",
        "source": "overview"
      },
      {
        "id": "EVENT",
        "type": "MODULE",
        "name": "F02 事件抽取、归组与增量",
        "section": "§5.2 F02；§6.3",
        "rule": "图 FA-D07",
        "input": "context",
        "output": "context",
        "inputDescription": "Information及原文版本",
        "outputDescription": "Event / EventUpdate / EventRating",
        "summary": "区分新事件、进展、仅新增来源、重复、纠正和待归组；事件M不等于风险等级。",
        "ruleDetail": "区分新事件、进展、仅新增来源、重复、纠正和待归组；事件M不等于风险等级。",
        "next": [
          {
            "label": "实质变化可触发识别",
            "to": "CAND"
          },
          {
            "label": "事实与进展也供观察引用",
            "to": "OBS"
          }
        ],
        "pending": "",
        "module": "F02",
        "source": "overview"
      },
      {
        "id": "VALUE",
        "type": "PROGRAM",
        "name": "F01 指标值校验及存储",
        "section": "§5.2 F01；§6.2",
        "rule": "§6.6 指标接入契约",
        "input": "context",
        "output": "context",
        "inputDescription": "指标值、单位、对象、观测期、来源",
        "outputDescription": "可引用实际值及版本",
        "summary": "实际值归信息接入，指标定义归M2；数据不经事件抽取也可进入观察。",
        "ruleDetail": "实际值归信息接入，指标定义归M2；数据不经事件抽取也可进入观察。",
        "next": [
          {
            "label": "证据输入",
            "to": "OBS"
          }
        ],
        "pending": "",
        "module": "F01",
        "source": "overview"
      },
      {
        "id": "CAND",
        "type": "MODULE",
        "name": "F03 形成完整风险候选",
        "section": "§5.2 F03；§6.3",
        "rule": "图 FA-D08",
        "input": "context",
        "output": "context",
        "inputDescription": "有效事件、分类和全局变量",
        "outputDescription": "0..N项完整风险候选",
        "summary": "先界定风险问题、范围、机制、潜在损害和变量，再交F04匹配；不分配正式risk_id。",
        "ruleDetail": "先界定风险问题、范围、机制、潜在损害和变量，再交F04匹配；不分配正式risk_id。",
        "next": [
          {
            "label": "进入同一性判断",
            "to": "MATCH"
          }
        ],
        "pending": "",
        "module": "F03",
        "source": "overview"
      },
      {
        "id": "MATCH",
        "type": "CONDITION",
        "name": "F04 同一性与准入判断",
        "section": "§5.2 F04；§6.3",
        "rule": "图 FA-D08",
        "input": "context",
        "output": "context",
        "inputDescription": "完整候选与既有风险",
        "outputDescription": "复用 / 新建 / 待复核 / 无风险",
        "summary": "匹配已有身份优先；未匹配也必须经过准入，歧义不能自动新建。",
        "ruleDetail": "匹配已有身份优先；未匹配也必须经过准入，歧义不能自动新建。",
        "next": [
          {
            "label": "已有风险",
            "to": "REUSE"
          },
          {
            "label": "全新且准入通过",
            "to": "CREATE"
          },
          {
            "label": "无法确定",
            "to": "HOLD"
          },
          {
            "label": "无具体风险",
            "to": "NONE"
          }
        ],
        "pending": "",
        "module": "",
        "source": "overview"
      },
      {
        "id": "REUSE",
        "type": "MODULE",
        "name": "F04 复用正式风险身份",
        "section": "§6.3",
        "rule": "图 FA-D08",
        "input": "context",
        "output": "context",
        "inputDescription": "匹配结果与既有风险",
        "outputDescription": "原risk_id与有效观察定义",
        "summary": "复用风险身份，关系与定义维护由F04负责。",
        "ruleDetail": "复用风险身份，关系与定义维护由F04负责。",
        "next": [
          {
            "label": "维护关系",
            "to": "LINK"
          }
        ],
        "pending": "",
        "module": "F04",
        "source": "overview"
      },
      {
        "id": "CREATE",
        "type": "MODULE",
        "name": "F04 建立正式风险",
        "section": "§6.3",
        "rule": "图 FA-D08",
        "input": "context",
        "output": "context",
        "inputDescription": "通过同一性及准入的候选",
        "outputDescription": "MonitoredRisk及初始配置",
        "summary": "新建、初始关键变量、事件关系需一致完成后才交付L2。",
        "ruleDetail": "新建、初始关键变量、事件关系需一致完成后才交付L2。",
        "next": [
          {
            "label": "维护关系",
            "to": "LINK"
          }
        ],
        "pending": "",
        "module": "F04",
        "source": "overview"
      },
      {
        "id": "HOLD",
        "type": "END",
        "name": "待复核 / 暂不纳管",
        "section": "§6.2～6.3",
        "rule": "§6.5 异常分支",
        "input": "context",
        "output": "context",
        "inputDescription": "歧义、引用或准入问题",
        "outputDescription": "待复核记录",
        "summary": "保留原因，不自动创建新风险。",
        "ruleDetail": "保留原因，不自动创建新风险。",
        "next": [],
        "pending": "",
        "module": "",
        "source": "overview"
      },
      {
        "id": "NONE",
        "type": "END",
        "name": "无具体风险 · 记录结束",
        "section": "§6.2～6.3",
        "rule": "§6.5 无具体风险",
        "input": "context",
        "output": "context",
        "inputDescription": "无可识别风险的处理结果",
        "outputDescription": "处理记录",
        "summary": "无风险是业务结果，不包装为技术失败。",
        "ruleDetail": "无风险是业务结果，不包装为技术失败。",
        "next": [],
        "pending": "",
        "module": "",
        "source": "overview"
      },
      {
        "id": "LINK",
        "type": "MODULE",
        "name": "F04 风险与事件、变量关系",
        "section": "§6.3～6.4",
        "rule": "§6.6 风险纳管契约",
        "input": "context",
        "output": "context",
        "inputDescription": "正式风险及事件、变量引用",
        "outputDescription": "有效长期关系及观察输入",
        "summary": "未完成纳管或关联的对象不交付F05。",
        "ruleDetail": "未完成纳管或关联的对象不交付F05。",
        "next": [
          {
            "label": "观察定义输入",
            "to": "OBS"
          }
        ],
        "pending": "",
        "module": "F04",
        "source": "overview"
      },
      {
        "id": "OBS",
        "type": "MODULE",
        "name": "F05 固定观察上下文与证据",
        "section": "§6.3～6.4",
        "rule": "图 FA-D09",
        "input": "context",
        "output": "context",
        "inputDescription": "F04定义、F01实际值、F02事实、M2/M3引用",
        "outputDescription": "固定截止与版本的本轮证据",
        "summary": "缺少部分依据时标记缺口并受限分析；无效身份先补齐。",
        "ruleDetail": "缺少部分依据时标记缺口并受限分析；无效身份先补齐。",
        "next": [
          {
            "label": "当前状态分析",
            "to": "SNAP"
          }
        ],
        "pending": "",
        "module": "F05",
        "source": "overview"
      },
      {
        "id": "SNAP",
        "type": "MODULE",
        "name": "F05 当前四维 RiskSnapshot",
        "section": "§5.2 F05；§6.3",
        "rule": "图 FA-D09",
        "input": "context",
        "output": "context",
        "inputDescription": "来源、应对、力量比较、损害",
        "outputDescription": "程度、阶段、范围、持续性与变量明细",
        "summary": "当前四维不包含历史trend；分析完成后才解释历史变化。",
        "ruleDetail": "当前四维不包含历史trend；分析完成后才解释历史变化。",
        "next": [
          {
            "label": "交F06比较",
            "to": "CHANGE"
          },
          {
            "label": "供F07读取",
            "to": "LIST"
          }
        ],
        "pending": "",
        "module": "F05",
        "source": "overview"
      },
      {
        "id": "CHANGE",
        "type": "MODULE",
        "name": "F06 可比性与风险演化分析",
        "section": "§5.2 F06；§6.3",
        "rule": "图 FA-D09",
        "input": "context",
        "output": "context",
        "inputDescription": "当前快照与可比历史",
        "outputDescription": "RiskAnalysisResult / 待判断原因",
        "summary": "首次或不可比时变化待判断；方向减弱不自动确认减弱节点或关闭跟踪。",
        "ruleDetail": "首次或不可比时变化待判断；方向减弱不自动确认减弱节点或关闭跟踪。",
        "next": [
          {
            "label": "交F07读取",
            "to": "LIST"
          },
          {
            "label": "交F08编制",
            "to": "REPORT"
          },
          {
            "label": "必要维护反馈",
            "to": "FEED"
          }
        ],
        "pending": "",
        "module": "F06",
        "source": "overview"
      },
      {
        "id": "LIST",
        "type": "MODULE",
        "name": "F07 风险列表、详情、Timeline",
        "section": "§5.2 F07",
        "rule": "§6.4 结果产品化",
        "input": "context",
        "output": "context",
        "inputDescription": "风险身份、当前快照与变化结果",
        "outputDescription": "只读查询与时间线视图",
        "summary": "不重算上游风险结论；全部目录保留无快照风险。",
        "ruleDetail": "不重算上游风险结论；全部目录保留无快照风险。",
        "next": [
          {
            "label": "报告可引用查询结果",
            "to": "REPORT"
          },
          {
            "label": "授权阅读",
            "to": "E"
          }
        ],
        "pending": "",
        "module": "F07",
        "source": "overview"
      },
      {
        "id": "REPORT",
        "type": "MODULE",
        "name": "F08 周期报告、校验与授权发布",
        "section": "§5.2 F08；§6.3",
        "rule": "§6.4 结果产品化",
        "input": "context",
        "output": "context",
        "inputDescription": "风险、快照、变化、报告周期及截止",
        "outputDescription": "RiskReport及发布/撤回记录",
        "summary": "引用固定上游结果；不随上游更新无痕改写已发布内容。",
        "ruleDetail": "引用固定上游结果；不随上游更新无痕改写已发布内容。",
        "next": [
          {
            "label": "授权阅读",
            "to": "E"
          }
        ],
        "pending": "完整发布状态机与强制复核条件待确认。",
        "module": "F08",
        "source": "overview"
      },
      {
        "id": "FEED",
        "type": "END",
        "name": "向 F04 / M2 / M3 提交维护反馈",
        "section": "§6.4",
        "rule": "§6.4 治理与方法反馈",
        "input": "context",
        "output": "context",
        "inputDescription": "变量、定义或方法缺口",
        "outputDescription": "候选或维护请求",
        "summary": "反馈经审核生效后供后续运行使用，不直接改写当前业务事实。",
        "ruleDetail": "反馈经审核生效后供后续运行使用，不直接改写当前业务事实。",
        "next": [],
        "pending": "",
        "module": "",
        "source": "overview"
      },
      {
        "id": "E",
        "type": "END",
        "name": "授权阅读与追溯",
        "section": "§2.3；§6.4",
        "rule": "§9.2 授权边界",
        "input": "context",
        "output": "context",
        "inputDescription": "查询结果与已发布报告",
        "outputDescription": "授权范围内阅读",
        "summary": "授权阅读者只读查询，业务维护由具备操作权限的系统管理员执行。",
        "ruleDetail": "授权阅读者只读查询，业务维护由具备操作权限的系统管理员执行。",
        "next": [],
        "pending": "",
        "module": "",
        "source": "overview"
      }
    ],
    "layout": [
      "S",
      "ING",
      "KIND",
      {
        "title": "输入类型 · 两条证据路径",
        "parallel": false,
        "lanes": [
          {
            "title": "资料 → 事件与风险识别",
            "nodes": [
              "EVENT",
              "CAND",
              "MATCH",
              "REUSE",
              "CREATE",
              "LINK"
            ]
          },
          {
            "title": "指标 → 直接供观察",
            "nodes": [
              "VALUE"
            ]
          }
        ]
      },
      "OBS",
      "SNAP",
      "CHANGE",
      {
        "title": "结果消费与反馈",
        "parallel": false,
        "lanes": [
          {
            "title": "F07 查询视图",
            "nodes": [
              "LIST"
            ]
          },
          {
            "title": "F08 周期产品",
            "nodes": [
              "REPORT"
            ]
          },
          {
            "title": "维护反馈",
            "nodes": [
              "FEED"
            ]
          }
        ]
      },
      "E",
      {
        "title": "业务分支 · 按条件结束",
        "parallel": false,
        "lanes": [
          {
            "title": "身份 / 准入不确定",
            "nodes": [
              "HOLD"
            ]
          },
          {
            "title": "无具体风险",
            "nodes": [
              "NONE"
            ]
          }
        ]
      }
    ],
    "stages": [
      {
        "code": "L0",
        "title": "信息接入与事件管理",
        "description": "把外部资料与实际观测值转为可追溯的业务输入。",
        "items": [
          "S",
          "ING",
          "KIND",
          {
            "title": "按输入类型分流",
            "parallel": false,
            "lanes": [
              {
                "title": "资讯 / 公告 / 报告",
                "nodes": [
                  "EVENT"
                ]
              },
              {
                "title": "指标实际值",
                "nodes": [
                  "VALUE"
                ]
              }
            ]
          }
        ],
        "output": "Event / EventUpdate · 指标实际值",
        "kind": "business",
        "extraTitle": "输入来源与类型分流",
        "overviewNodes": [
          "ING",
          "EVENT",
          "VALUE"
        ]
      },
      {
        "code": "L1",
        "title": "风险识别与纳管",
        "description": "先定义风险，再确认身份、准入与长期观察关系。",
        "items": [
          "CAND",
          "MATCH",
          {
            "title": "身份处理",
            "parallel": false,
            "lanes": [
              {
                "title": "复用已有风险",
                "nodes": [
                  "REUSE"
                ]
              },
              {
                "title": "符合准入的新风险",
                "nodes": [
                  "CREATE"
                ]
              }
            ]
          },
          "LINK",
          {
            "title": "按条件保留业务结果",
            "parallel": false,
            "lanes": [
              {
                "title": "暂不纳管",
                "nodes": [
                  "HOLD"
                ]
              },
              {
                "title": "无具体风险",
                "nodes": [
                  "NONE"
                ]
              }
            ]
          }
        ],
        "output": "MonitoredRisk · 有效长期关系",
        "kind": "business",
        "overviewNodes": [
          "CAND",
          "MATCH"
        ]
      },
      {
        "code": "L2",
        "title": "风险态势分析",
        "description": "固定证据与截止时间，分析当前状态及历史变化。",
        "items": [
          "OBS",
          "SNAP",
          "CHANGE"
        ],
        "output": "RiskSnapshot · RiskAnalysisResult",
        "kind": "business",
        "overviewNodes": [
          "SNAP",
          "CHANGE"
        ]
      },
      {
        "code": "L3",
        "title": "风险产品与发布",
        "description": "引用已确认结果，形成查询视图与周期报告。",
        "items": [
          {
            "title": "两类产品",
            "parallel": false,
            "lanes": [
              {
                "title": "动态查询",
                "nodes": [
                  "LIST"
                ]
              },
              {
                "title": "周期报告",
                "nodes": [
                  "REPORT"
                ]
              }
            ]
          },
          "E"
        ],
        "output": "风险列表 / 详情 / Timeline · RiskReport",
        "kind": "business",
        "overviewNodes": [
          "LIST",
          "REPORT"
        ]
      },
      {
        "code": "M",
        "title": "横向治理与反馈",
        "description": "来源资格、观察定义与方法治理跨层复用。",
        "items": [
          "FEED"
        ],
        "output": "",
        "kind": "support",
        "overviewNodes": [
          "FEED"
        ]
      }
    ]
  },
  "STR-L0-01": {
    "source": "L0",
    "summary": "依据L0 §2.2.2～2.2.4、§2.2.6及总览F02：事件抽取、归组、对象变量、增量分类和保存交付。F01信息接入在系统全景单独展示。",
    "nodes": [
      {
        "id": "S",
        "type": "START",
        "name": "取得可追溯 Information 版本",
        "section": "§2.2.2",
        "rule": "§3.1",
        "input": "business_context",
        "output": "context",
        "inputDescription": "已由F01接入的资料及原文定位",
        "outputDescription": "抽取输入",
        "summary": "一份资料可以拆分多个事件；每个事件独立完成后续处理。",
        "ruleDetail": "一份资料可以拆分多个事件；每个事件独立完成后续处理。",
        "next": [
          {
            "label": "抽取事件",
            "to": "A1"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L0"
      },
      {
        "id": "A1",
        "type": "AI",
        "name": "事件抽取与原文定位",
        "section": "§2.2.2",
        "rule": "§3.2",
        "input": "context",
        "output": "context",
        "inputDescription": "Information正文、附件与时间元数据",
        "outputDescription": "事件候选与引用位置",
        "summary": "AI-01识别事件要素；程序检查结构和引用。",
        "ruleDetail": "AI-01识别事件要素；程序检查结构和引用。",
        "next": [
          {
            "label": "程序校验",
            "to": "CVALID"
          }
        ],
        "task": "AI-01",
        "taskVersion": "1.0",
        "pending": "",
        "module": "",
        "source": "L0"
      },
      {
        "id": "CVALID",
        "type": "CONDITION",
        "name": "结构引用合格且存在宏观事件？",
        "section": "§2.2.2",
        "rule": "§3.2",
        "input": "context",
        "output": "context",
        "inputDescription": "抽取结果",
        "outputDescription": "有效事件 / 保留资料 / 待复核",
        "summary": "无宏观事件保留资料后结束；结构或引用不合格待复核。",
        "ruleDetail": "无宏观事件保留资料后结束；结构或引用不合格待复核。",
        "next": [
          {
            "label": "合格且有事件",
            "to": "SPLIT"
          },
          {
            "label": "无宏观事件",
            "to": "NOEVENT"
          },
          {
            "label": "结构 / 引用不合格",
            "to": "X"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L0"
      },
      {
        "id": "SPLIT",
        "type": "PROGRAM",
        "name": "拆分事件并读取历史",
        "section": "§2.2.2",
        "rule": "§3.2 / §3.5",
        "input": "context",
        "output": "context",
        "inputDescription": "多个事件候选",
        "outputDescription": "逐项候选及已有事件历史",
        "summary": "某事件待复核或无增量不阻断其他事件。",
        "ruleDetail": "某事件待复核或无增量不阻断其他事件。",
        "next": [
          {
            "label": "匹配归组",
            "to": "A2"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L0"
      },
      {
        "id": "A2",
        "type": "AI",
        "name": "事件匹配与归组",
        "section": "§2.2.2",
        "rule": "§3.5",
        "input": "context",
        "output": "context",
        "inputDescription": "候选要素、历史事件与原文",
        "outputDescription": "新事件 / 同事件 / 未决建议",
        "summary": "主体、行为、对象、时间和行动标识共同参与判断，禁止强行合并。",
        "ruleDetail": "主体、行为、对象、时间和行动标识共同参与判断，禁止强行合并。",
        "next": [
          {
            "label": "程序判断",
            "to": "C"
          }
        ],
        "task": "AI-02",
        "taskVersion": "1.0",
        "pending": "",
        "module": "",
        "source": "L0"
      },
      {
        "id": "C",
        "type": "CONDITION",
        "name": "事件归组结果？",
        "section": "§2.2.2",
        "rule": "§3.5",
        "input": "context",
        "output": "context",
        "inputDescription": "匹配建议、ID与引用",
        "outputDescription": "创建或复用决策",
        "summary": "程序执行身份与引用校验；无法可靠判断保留待归组记录。",
        "ruleDetail": "程序执行身份与引用校验；无法可靠判断保留待归组记录。",
        "next": [
          {
            "label": "新事件",
            "to": "NEW"
          },
          {
            "label": "同一事件",
            "to": "REUSE"
          },
          {
            "label": "无法可靠判断",
            "to": "X"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L0"
      },
      {
        "id": "NEW",
        "type": "PROGRAM",
        "name": "准备新事件及来源关联",
        "section": "§2.2.2",
        "rule": "§3.2 / §3.5",
        "input": "context",
        "output": "context",
        "inputDescription": "新事件判断与资料定位",
        "outputDescription": "待统一保存的新事件身份与关联",
        "summary": "此处形成业务变更，图⑥统一校验及持久化。",
        "ruleDetail": "此处形成业务变更，图⑥统一校验及持久化。",
        "next": [
          {
            "label": "对象变量识别",
            "to": "A3"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L0"
      },
      {
        "id": "REUSE",
        "type": "PROGRAM",
        "name": "匹配既有事件并保留历史",
        "section": "§2.2.2",
        "rule": "§3.5",
        "input": "context",
        "output": "context",
        "inputDescription": "有效既有事件ID",
        "outputDescription": "既有事件与来源上下文",
        "summary": "保留原身份和来源历史，不因新来源建立重复事件。",
        "ruleDetail": "保留原身份和来源历史，不因新来源建立重复事件。",
        "next": [
          {
            "label": "对象变量识别",
            "to": "A3"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L0"
      },
      {
        "id": "A3",
        "type": "AI",
        "name": "Target 与 Variable 识别",
        "section": "§2.2.3",
        "rule": "§3.3 / §3.4",
        "input": "context",
        "output": "context",
        "inputDescription": "已归组事件、对象库与全局变量",
        "outputDescription": "对象、直接变量候选及依据",
        "summary": "只识别有直接依据的对象与变量，不推测后续传导变量。",
        "ruleDetail": "只识别有直接依据的对象与变量，不推测后续传导变量。",
        "next": [
          {
            "label": "检查引用与关联",
            "to": "ASSOC"
          }
        ],
        "task": "AI-03",
        "taskVersion": "1.0",
        "pending": "",
        "module": "",
        "source": "L0"
      },
      {
        "id": "ASSOC",
        "type": "PROGRAM",
        "name": "校验对象变量并处理关联缺口",
        "section": "§2.2.3",
        "rule": "§3.3 / §3.4",
        "input": "context",
        "output": "context",
        "inputDescription": "对象变量候选及全局定义",
        "outputDescription": "有效关联、空关联或M2候选",
        "summary": "对象不确定可留空；变量无直接依据可留空；无正式定义提交M2候选，不虚构ID。",
        "ruleDetail": "对象不确定可留空；变量无直接依据可留空；无正式定义提交M2候选，不虚构ID。",
        "next": [
          {
            "label": "复核事件身份",
            "to": "IDENTITY"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L0"
      },
      {
        "id": "IDENTITY",
        "type": "AI",
        "name": "事件身份复核",
        "section": "§2.2.4",
        "rule": "§3.5",
        "input": "context",
        "output": "context",
        "inputDescription": "本轮信息与事件历史",
        "outputDescription": "身份明确或待归组建议",
        "summary": "增量判定前再次核对事件身份，复用同一个AI-02职责。",
        "ruleDetail": "增量判定前再次核对事件身份，复用同一个AI-02职责。",
        "next": [
          {
            "label": "判断身份",
            "to": "CID"
          }
        ],
        "task": "AI-02",
        "taskVersion": "1.0",
        "pending": "",
        "module": "",
        "source": "L0"
      },
      {
        "id": "CID",
        "type": "CONDITION",
        "name": "事件身份仍明确？",
        "section": "§2.2.4",
        "rule": "§3.5",
        "input": "context",
        "output": "context",
        "inputDescription": "身份建议与校验",
        "outputDescription": "继续或返回归组",
        "summary": "身份不明确返回事件归组，不直接计算增量。",
        "ruleDetail": "身份不明确返回事件归组，不直接计算增量。",
        "next": [
          {
            "label": "是",
            "to": "A4"
          },
          {
            "label": "否，返回归组",
            "to": "A2"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L0"
      },
      {
        "id": "A4",
        "type": "AI",
        "name": "事件增量识别",
        "section": "§2.2.4",
        "rule": "§3.5",
        "input": "context",
        "output": "context",
        "inputDescription": "当前事件与历史",
        "outputDescription": "增量类型、理由与状态变化",
        "summary": "区分进展、补充、纠正、来源增加和重复。",
        "ruleDetail": "区分进展、补充、纠正、来源增加和重复。",
        "next": [
          {
            "label": "按类型处理",
            "to": "DELTA"
          }
        ],
        "task": "AI-04",
        "taskVersion": "1.0",
        "pending": "",
        "module": "",
        "source": "L0"
      },
      {
        "id": "DELTA",
        "type": "CONDITION",
        "name": "增量类型分流",
        "section": "§2.2.4",
        "rule": "§3.5",
        "input": "context",
        "output": "context",
        "inputDescription": "结构化增量结果",
        "outputDescription": "更新 / 来源 / 重复 / 未决",
        "summary": "来源增加不算实质进展；纠正保留旧版；重复不发通知。",
        "ruleDetail": "来源增加不算实质进展；纠正保留旧版；重复不发通知。",
        "next": [
          {
            "label": "NEW_EVENT / EVENT_PROGRESS / MATERIAL_ADDITION / CORRECTION",
            "to": "UPDATE"
          },
          {
            "label": "SOURCE_ADDITION",
            "to": "SOURCE"
          },
          {
            "label": "DUPLICATE",
            "to": "DUP"
          },
          {
            "label": "UNRESOLVED",
            "to": "A2"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L0"
      },
      {
        "id": "UPDATE",
        "type": "PROGRAM",
        "name": "生成更新或追加纠正记录",
        "section": "§2.2.4",
        "rule": "§3.5",
        "input": "context",
        "output": "context",
        "inputDescription": "有效进展或纠正",
        "outputDescription": "EventUpdate及历史",
        "summary": "纠正保留旧描述；有效变化交独立评级流程判断是否初评/复评。",
        "ruleDetail": "纠正保留旧描述；有效变化交独立评级流程判断是否初评/复评。",
        "next": [
          {
            "label": "交金融意义评级流程",
            "to": "RATE"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L0"
      },
      {
        "id": "RATE",
        "type": "PROGRAM",
        "name": "引用金融意义评级处理结果",
        "section": "§2.2.5",
        "rule": "§3.6",
        "input": "context",
        "output": "context",
        "inputDescription": "新增/有效更新、评级规则",
        "outputDescription": "初评 / 复评 / 沿用结果",
        "summary": "本节点是与STR-L0-02的交接，不重复展开AI-05。",
        "ruleDetail": "本节点是与STR-L0-02的交接，不重复展开AI-05。",
        "next": [
          {
            "label": "统一校验",
            "to": "P2"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L0"
      },
      {
        "id": "SOURCE",
        "type": "PROGRAM",
        "name": "仅追加来源并沿用评级",
        "section": "§2.2.4",
        "rule": "§3.5",
        "input": "context",
        "output": "context",
        "inputDescription": "新来源关系",
        "outputDescription": "来源关联变化",
        "summary": "不记作实质业务进展，也不因此自动复评。",
        "ruleDetail": "不记作实质业务进展，也不因此自动复评。",
        "next": [
          {
            "label": "统一校验",
            "to": "P2"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L0"
      },
      {
        "id": "P2",
        "type": "PROGRAM",
        "name": "统一校验事件、ID与关联",
        "section": "§2.2.6",
        "rule": "§3.2～3.6",
        "input": "context",
        "output": "context",
        "inputDescription": "事件、更新、关联和评级",
        "outputDescription": "结构、时间和引用校验结果",
        "summary": "检查ID、关联约束、时间语义和幂等性。",
        "ruleDetail": "检查ID、关联约束、时间语义和幂等性。",
        "next": [
          {
            "label": "判断能否保存",
            "to": "CSAVE"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L0"
      },
      {
        "id": "CSAVE",
        "type": "CONDITION",
        "name": "统一校验通过？",
        "section": "§2.2.6",
        "rule": "§2.2.6 校验与存储",
        "input": "context",
        "output": "context",
        "inputDescription": "统一校验结果",
        "outputDescription": "通过或待复核",
        "summary": "复核后返回对应处理步骤，具体恢复机制不在此定稿。",
        "ruleDetail": "复核后返回对应处理步骤，具体恢复机制不在此定稿。",
        "next": [
          {
            "label": "是",
            "to": "P3"
          },
          {
            "label": "否",
            "to": "X"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L0"
      },
      {
        "id": "P3",
        "type": "PROGRAM",
        "name": "F02 幂等保存并按变化分发",
        "section": "§2.2.6",
        "rule": "§2.2.6 通知按实际变化产生",
        "input": "context",
        "output": "context",
        "inputDescription": "经校验的事件及记录",
        "outputDescription": "Event及引用、对应变化通知",
        "summary": "仅来源增加使用来源通知；重复不保存新更新或重复分发。",
        "ruleDetail": "仅来源增加使用来源通知；重复不保存新更新或重复分发。",
        "next": [
          {
            "label": "交付下游",
            "to": "E"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L0"
      },
      {
        "id": "E",
        "type": "END",
        "name": "交付 F03 / F05 消费",
        "section": "§2.2.6",
        "rule": "总览 §6.6",
        "input": "context",
        "output": "context",
        "inputDescription": "已保存事件与证据",
        "outputDescription": "可消费事件事实与增量",
        "summary": "风险方向、风险身份和长期变量作用由下游判断。",
        "ruleDetail": "风险方向、风险身份和长期变量作用由下游判断。",
        "next": [],
        "pending": "",
        "module": "",
        "source": "L0"
      },
      {
        "id": "NOEVENT",
        "type": "END",
        "name": "无宏观事件 · 保留资料",
        "section": "§2.2.2",
        "rule": "§3.2",
        "input": "context",
        "output": "context",
        "inputDescription": "无可抽取事件的Information",
        "outputDescription": "资料保留记录",
        "summary": "不强行生成事件。",
        "ruleDetail": "不强行生成事件。",
        "next": [],
        "pending": "",
        "module": "",
        "source": "L0"
      },
      {
        "id": "DUP",
        "type": "END",
        "name": "重复输入 · 幂等结束",
        "section": "§2.2.4",
        "rule": "§3.5",
        "input": "context",
        "output": "context",
        "inputDescription": "无新增变化",
        "outputDescription": "跳过记录",
        "summary": "不重复生成更新或通知。",
        "ruleDetail": "不重复生成更新或通知。",
        "next": [],
        "pending": "",
        "module": "",
        "source": "L0"
      },
      {
        "id": "X",
        "type": "END",
        "name": "待归组 / 复核或重新处理",
        "section": "§2.2.2；§2.2.6",
        "rule": "§3.5",
        "input": "context",
        "output": "context",
        "inputDescription": "歧义或校验问题及原文引用",
        "outputDescription": "待处理依据",
        "summary": "保留UNRESOLVED及依据；复核后回到对应步骤。",
        "ruleDetail": "保留UNRESOLVED及依据；复核后回到对应步骤。",
        "next": [],
        "pending": "归组阈值与人工处理机制待进一步确认。",
        "module": "",
        "source": "L0"
      }
    ],
    "layout": [
      "S",
      "A1",
      "CVALID",
      "SPLIT",
      "A2",
      "C",
      "NEW",
      "REUSE",
      "A3",
      "ASSOC",
      "IDENTITY",
      "CID",
      "A4",
      "DELTA",
      "UPDATE",
      "RATE",
      "SOURCE",
      "P2",
      "CSAVE",
      "P3",
      "E",
      "NOEVENT",
      "DUP",
      "X"
    ],
    "stages": [
      {
        "code": "01",
        "title": "资料与事件候选",
        "description": "抽取、拆分及身份归组。",
        "items": [
          "S",
          "A1",
          "CVALID",
          "SPLIT",
          "A2",
          "C",
          {
            "title": "归组结果",
            "parallel": false,
            "lanes": [
              {
                "title": "新事件",
                "nodes": [
                  "NEW"
                ]
              },
              {
                "title": "已有事件",
                "nodes": [
                  "REUSE"
                ]
              }
            ]
          }
        ],
        "output": "",
        "kind": "business"
      },
      {
        "code": "02",
        "title": "对象、变量与增量",
        "description": "引用有依据的对象和全局变量，识别真实变化。",
        "items": [
          "A3",
          "ASSOC",
          "IDENTITY",
          "CID",
          "A4",
          "DELTA",
          {
            "title": "变化处理",
            "parallel": false,
            "lanes": [
              {
                "title": "实质变化 / 纠正",
                "nodes": [
                  "UPDATE",
                  "RATE"
                ]
              },
              {
                "title": "仅增加来源",
                "nodes": [
                  "SOURCE"
                ]
              }
            ]
          }
        ],
        "output": "",
        "kind": "business"
      },
      {
        "code": "03",
        "title": "校验与交付",
        "description": "检查一致性后幂等保存，按实际变化分发。",
        "items": [
          "P2",
          "CSAVE",
          "P3",
          "E"
        ],
        "output": "",
        "kind": "business"
      },
      {
        "code": "04",
        "title": "业务暂停与结束",
        "description": "这些是条件出口，不代表所有请求都必须经历。",
        "items": [
          {
            "title": "独立业务出口",
            "parallel": false,
            "lanes": [
              {
                "title": "没有事件",
                "nodes": [
                  "NOEVENT"
                ]
              },
              {
                "title": "重复输入",
                "nodes": [
                  "DUP"
                ]
              },
              {
                "title": "待确认",
                "nodes": [
                  "X"
                ]
              }
            ]
          }
        ],
        "output": "",
        "kind": "outcomes"
      }
    ]
  },
  "STR-L0-02": {
    "source": "L0",
    "summary": "依据L0 §2.2.5～2.2.6：新增/有效更新先判断是否影响评级，纯来源增加沿用已有评级；M不等于风险等级。",
    "nodes": [
      {
        "id": "S",
        "type": "START",
        "name": "新增事件 / 有效更新",
        "section": "§2.2.5",
        "rule": "§3.6",
        "input": "business_context",
        "output": "context",
        "inputDescription": "事件、增量与原始证据",
        "outputDescription": "是否初评或复评的输入",
        "summary": "纯来源增加在事件处理路径沿用评级。",
        "ruleDetail": "纯来源增加在事件处理路径沿用评级。",
        "next": [
          {
            "label": "判断评级依据",
            "to": "C"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L0"
      },
      {
        "id": "C",
        "type": "CONDITION",
        "name": "新增事件或影响评级依据？",
        "section": "§2.2.5",
        "rule": "§3.6",
        "input": "context",
        "output": "context",
        "inputDescription": "增量类型与评级规则",
        "outputDescription": "初评 / 复评 / 沿用决策",
        "summary": "由程序根据规则判断，不按新闻数量自动提升评级。",
        "ruleDetail": "由程序根据规则判断，不按新闻数量自动提升评级。",
        "next": [
          {
            "label": "是",
            "to": "P1"
          },
          {
            "label": "否",
            "to": "KEEP"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L0"
      },
      {
        "id": "P1",
        "type": "PROGRAM",
        "name": "固定评价范围与研究期限",
        "section": "§2.2.5",
        "rule": "§3.6",
        "input": "context",
        "output": "context",
        "inputDescription": "事件及适用方法",
        "outputDescription": "assessment_scope与研究期限",
        "summary": "金融用途允许投资、融资、投机/情绪多标签及无法判断。",
        "ruleDetail": "金融用途允许投资、融资、投机/情绪多标签及无法判断。",
        "next": [
          {
            "label": "分析金融意义",
            "to": "A1"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L0"
      },
      {
        "id": "A1",
        "type": "AI",
        "name": "金融意义 M 与用途评价",
        "section": "§2.2.5",
        "rule": "§3.6",
        "input": "context",
        "output": "context",
        "inputDescription": "固定范围、期限、事件证据",
        "outputDescription": "M维度判断、用途标签与理由",
        "summary": "权重尚未验证时总分允许为空，保留维度判断与草案状态。",
        "ruleDetail": "权重尚未验证时总分允许为空，保留维度判断与草案状态。",
        "next": [
          {
            "label": "形成评级记录",
            "to": "P2"
          }
        ],
        "task": "AI-05",
        "taskVersion": "1.0",
        "pending": "",
        "module": "",
        "source": "L0"
      },
      {
        "id": "P2",
        "type": "PROGRAM",
        "name": "形成初评/复评并保留历史",
        "section": "§2.2.5",
        "rule": "§3.6",
        "input": "context",
        "output": "context",
        "inputDescription": "M维度与依据",
        "outputDescription": "EventRating及规则版本",
        "summary": "保留旧评价、适用范围与状态，M不代表收益概率或风险方向。",
        "ruleDetail": "保留旧评价、适用范围与状态，M不代表收益概率或风险方向。",
        "next": [
          {
            "label": "统一校验",
            "to": "CHECK"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L0"
      },
      {
        "id": "KEEP",
        "type": "PROGRAM",
        "name": "沿用已有评级",
        "section": "§2.2.5",
        "rule": "§3.5 / §3.6",
        "input": "context",
        "output": "context",
        "inputDescription": "不影响评级的变更",
        "outputDescription": "原评级引用",
        "summary": "不因来源增加虚增金融意义。",
        "ruleDetail": "不因来源增加虚增金融意义。",
        "next": [
          {
            "label": "统一校验",
            "to": "CHECK"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L0"
      },
      {
        "id": "CHECK",
        "type": "CONDITION",
        "name": "统一结构、引用与约束校验",
        "section": "§2.2.6",
        "rule": "§2.2.6 校验与存储",
        "input": "context",
        "output": "context",
        "inputDescription": "评级及对应事件/证据",
        "outputDescription": "可保存或待复核",
        "summary": "评级随事件记录统一校验，不能越过来源和ID约束。",
        "ruleDetail": "评级随事件记录统一校验，不能越过来源和ID约束。",
        "next": [
          {
            "label": "通过",
            "to": "P3"
          },
          {
            "label": "不通过",
            "to": "X"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L0"
      },
      {
        "id": "P3",
        "type": "PROGRAM",
        "name": "F02 保存评级及变更通知",
        "section": "§2.2.6",
        "rule": "§3.6",
        "input": "context",
        "output": "context",
        "inputDescription": "校验通过的评级结果",
        "outputDescription": "EventRating / 评级变化通知",
        "summary": "只按实际变化产生相应通知。",
        "ruleDetail": "只按实际变化产生相应通知。",
        "next": [
          {
            "label": "交付",
            "to": "E"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L0"
      },
      {
        "id": "E",
        "type": "END",
        "name": "交付事件金融意义结果",
        "section": "§2.2.6",
        "rule": "§3.6",
        "input": "context",
        "output": "context",
        "inputDescription": "保存后的EventRating",
        "outputDescription": "下游可引用的M与用途",
        "summary": "M可以辅助筛选，不直接决定风险存在、等级或趋势。",
        "ruleDetail": "M可以辅助筛选，不直接决定风险存在、等级或趋势。",
        "next": [],
        "pending": "",
        "module": "",
        "source": "L0"
      },
      {
        "id": "X",
        "type": "END",
        "name": "待复核或重新处理",
        "section": "§2.2.6",
        "rule": "§3.6",
        "input": "context",
        "output": "context",
        "inputDescription": "校验未通过的评级依据",
        "outputDescription": "待处理事项",
        "summary": "保留不确定性，不编造已确定分数。",
        "ruleDetail": "保留不确定性，不编造已确定分数。",
        "next": [],
        "pending": "M权重、正式阈值与恢复流程待确认。",
        "module": "",
        "source": "L0"
      }
    ],
    "layout": [
      "S",
      "C",
      "P1",
      "A1",
      "P2",
      "KEEP",
      "CHECK",
      "P3",
      "E",
      "X"
    ],
    "stages": [
      {
        "code": "01",
        "title": "判断评级必要性",
        "description": "新增或有效更新先判断是否需要初评或复评。",
        "items": [
          "S",
          "C"
        ],
        "output": "",
        "kind": "business"
      },
      {
        "code": "02",
        "title": "分析或沿用",
        "description": "固定评价范围，保留M的用途与判断限制。",
        "items": [
          {
            "title": "按评级依据选择路径",
            "parallel": false,
            "lanes": [
              {
                "title": "需要评价",
                "nodes": [
                  "P1",
                  "A1",
                  "P2"
                ]
              },
              {
                "title": "无需重评",
                "nodes": [
                  "KEEP"
                ]
              }
            ]
          }
        ],
        "output": "",
        "kind": "business"
      },
      {
        "code": "03",
        "title": "校验与保存",
        "description": "与事件记录统一核对后保留版本。",
        "items": [
          "CHECK",
          "P3",
          "E",
          "X"
        ],
        "output": "",
        "kind": "business"
      }
    ]
  },
  "STR-L1-01": {
    "source": "L1",
    "summary": "依据L1四张业务图及总览F03/F04：先完整定义候选，再检索同一性、复用/准入、建立长期关系并一致交付。",
    "nodes": [
      {
        "id": "S",
        "type": "START",
        "name": "接收 Event / EventUpdate 或人工请求",
        "section": "§2.2.1",
        "rule": "§2.2.1 触发口径",
        "input": "business_context",
        "output": "context",
        "inputDescription": "有效新事件或更新",
        "outputDescription": "识别请求",
        "summary": "不重新采集或抽取Event。",
        "ruleDetail": "不重新采集或抽取Event。",
        "next": [
          {
            "label": "重复检查",
            "to": "DUPCHECK"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L1"
      },
      {
        "id": "DUPCHECK",
        "type": "CONDITION",
        "name": "同一输入已处理且无有效增量？",
        "section": "§2.2.1",
        "rule": "§2.2.1 重复检查",
        "input": "context",
        "output": "context",
        "inputDescription": "事件ID、版本与记录",
        "outputDescription": "有效输入或重复结束",
        "summary": "人工发起同样经过重复检查。",
        "ruleDetail": "人工发起同样经过重复检查。",
        "next": [
          {
            "label": "是",
            "to": "DUP"
          },
          {
            "label": "否",
            "to": "P1"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L1"
      },
      {
        "id": "P1",
        "type": "PROGRAM",
        "name": "准备事件证据与风险/变量配置",
        "section": "§2.2.1～2.2.2",
        "rule": "§3.4",
        "input": "context",
        "output": "context",
        "inputDescription": "Event、对象、直接变量、M、原文、M2配置",
        "outputDescription": "AI识别上下文",
        "summary": "M仅辅助筛选；引用全局已确认定义，不虚构变量ID。",
        "ruleDetail": "M仅辅助筛选；引用全局已确认定义，不虚构变量ID。",
        "next": [
          {
            "label": "完整风险识别",
            "to": "A1"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L1"
      },
      {
        "id": "A1",
        "type": "AI",
        "name": "形成完整风险候选定义",
        "section": "§2.2.2",
        "rule": "§2.2.2 业务步骤2.1～2.6",
        "input": "context",
        "output": "context",
        "inputDescription": "事件与证据上下文",
        "outputDescription": "0..N项完整候选",
        "summary": "同一个AI-L1-01完成风险问题、对象范围、来源机制、潜在损害对象、关键变量与定义汇总；不拆成六个独立AI任务。",
        "ruleDetail": "同一个AI-L1-01完成风险问题、对象范围、来源机制、潜在损害对象、关键变量与定义汇总；不拆成六个独立AI任务。",
        "next": [
          {
            "label": "判断识别结果",
            "to": "CRESULT"
          }
        ],
        "task": "AI-L1-01",
        "taskVersion": "1.0",
        "pending": "",
        "module": "",
        "source": "L1"
      },
      {
        "id": "CRESULT",
        "type": "CONDITION",
        "name": "识别结果与定义校验",
        "section": "§2.2.2",
        "rule": "§6.2 业务校验",
        "input": "context",
        "output": "context",
        "inputDescription": "候选定义、范围与引用",
        "outputDescription": "完整候选 / 无风险 / 待复核",
        "summary": "先形成完整候选，再开展存量检索；各候选独立处理。",
        "ruleDetail": "先形成完整候选，再开展存量检索；各候选独立处理。",
        "next": [
          {
            "label": "形成候选且校验通过",
            "to": "SEARCH"
          },
          {
            "label": "无可识别风险",
            "to": "NONE"
          },
          {
            "label": "无法可靠判断或校验失败",
            "to": "X"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L1"
      },
      {
        "id": "SEARCH",
        "type": "PROGRAM",
        "name": "按完整定义检索已有风险",
        "section": "§2.2.3",
        "rule": "§3.2",
        "input": "context",
        "output": "context",
        "inputDescription": "风险问题、观察对象、范围、潜在损害",
        "outputDescription": "MonitoredRisk候选集合",
        "summary": "检索无结果也不意味着可以直接创建。",
        "ruleDetail": "检索无结果也不意味着可以直接创建。",
        "next": [
          {
            "label": "同一性判断",
            "to": "A2"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L1"
      },
      {
        "id": "A2",
        "type": "AI",
        "name": "风险同一性判断",
        "section": "§2.2.3",
        "rule": "§3.2 / §6.2",
        "input": "context",
        "output": "context",
        "inputDescription": "完整候选与召回的已有风险",
        "outputDescription": "匹配 / 未匹配 / 歧义建议",
        "summary": "比较风险问题、对象、范围、潜在损害；风险源或触发事件不同不必然新建。",
        "ruleDetail": "比较风险问题、对象、范围、潜在损害；风险源或触发事件不同不必然新建。",
        "next": [
          {
            "label": "程序校验匹配与引用",
            "to": "C"
          }
        ],
        "task": "AI-L1-02",
        "taskVersion": "1.0",
        "pending": "",
        "module": "",
        "source": "L1"
      },
      {
        "id": "C",
        "type": "CONDITION",
        "name": "匹配建议及引用校验结果？",
        "section": "§2.2.3",
        "rule": "§3.2",
        "input": "context",
        "output": "context",
        "inputDescription": "同一性建议与真实风险ID",
        "outputDescription": "复用 / 新风险准入 / 待复核",
        "summary": "AI建议不能自行指定正式新ID。",
        "ruleDetail": "AI建议不能自行指定正式新ID。",
        "next": [
          {
            "label": "匹配成功且引用有效",
            "to": "REUSE"
          },
          {
            "label": "未匹配已有风险",
            "to": "ADMIT"
          },
          {
            "label": "歧义或校验失败",
            "to": "X"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L1"
      },
      {
        "id": "REUSE",
        "type": "PROGRAM",
        "name": "复用已有 risk_id",
        "section": "§2.2.3",
        "rule": "§3.2",
        "input": "context",
        "output": "context",
        "inputDescription": "有效已有风险身份",
        "outputDescription": "原risk_id",
        "summary": "优先复用稳定身份，并检查跟踪状态。",
        "ruleDetail": "优先复用稳定身份，并检查跟踪状态。",
        "next": [
          {
            "label": "检查已关闭状态",
            "to": "CLOSED"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L1"
      },
      {
        "id": "CLOSED",
        "type": "CONDITION",
        "name": "已有风险已关闭？",
        "section": "§2.2.3",
        "rule": "§2.2.3 维护与恢复边界",
        "input": "context",
        "output": "context",
        "inputDescription": "已有风险跟踪状态",
        "outputDescription": "沿用或待确认恢复",
        "summary": "已关闭风险保留历史身份，不预设自动恢复。",
        "ruleDetail": "已关闭风险保留历史身份，不预设自动恢复。",
        "next": [
          {
            "label": "是",
            "to": "RESTORE"
          },
          {
            "label": "否",
            "to": "CONFIG"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L1"
      },
      {
        "id": "CONFIG",
        "type": "PROGRAM",
        "name": "沿用观察配置，必要时提出维护",
        "section": "§2.2.3",
        "rule": "BR-L1-20 / BR-L1-21",
        "input": "context",
        "output": "context",
        "inputDescription": "既有定义、关键变量与新依据",
        "outputDescription": "原观察配置或维护建议",
        "summary": "建议不直接覆盖配置，正式变更须经治理。",
        "ruleDetail": "建议不直接覆盖配置，正式变更须经治理。",
        "next": [
          {
            "label": "维护事件关联",
            "to": "REL"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L1"
      },
      {
        "id": "ADMIT",
        "type": "CONDITION",
        "name": "新风险准入校验通过？",
        "section": "§2.2.3",
        "rule": "§6.2 系统纳管动作",
        "input": "context",
        "output": "context",
        "inputDescription": "完整定义、宏观范围、证据、观察条件",
        "outputDescription": "可新建或待复核",
        "summary": "关键变量最低数量和自动准入条件未定，不能视为默认通过。",
        "ruleDetail": "关键变量最低数量和自动准入条件未定，不能视为默认通过。",
        "next": [
          {
            "label": "满足已确认准入",
            "to": "CREATE"
          },
          {
            "label": "不满足或条件待定",
            "to": "X"
          }
        ],
        "pending": "自动准入门槛与关键变量最低配置数量待讨论。",
        "module": "",
        "source": "L1",
        "blocking": true
      },
      {
        "id": "CREATE",
        "type": "PROGRAM",
        "name": "F04 新建风险及初始变量关系",
        "section": "§2.2.3",
        "rule": "§3.4 / §6.2",
        "input": "context",
        "output": "context",
        "inputDescription": "已通过同一性与准入的候选",
        "outputDescription": "MonitoredRisk及长期变量关系",
        "summary": "正式ID由系统创建，关键变量引用M2定义，未审批候选不冒充正式定义。",
        "ruleDetail": "正式ID由系统创建，关键变量引用M2定义，未审批候选不冒充正式定义。",
        "next": [
          {
            "label": "建立初始事件关系",
            "to": "REL"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L1"
      },
      {
        "id": "REL",
        "type": "PROGRAM",
        "name": "建立风险—事件关联并保存依据",
        "section": "§2.2.4",
        "rule": "§4.5",
        "input": "context",
        "output": "context",
        "inputDescription": "复用/新建风险与Event/Update",
        "outputDescription": "关联原因、证据与时间语义",
        "summary": "关联不表示风险加剧或缓和。",
        "ruleDetail": "关联不表示风险加剧或缓和。",
        "next": [
          {
            "label": "一致性检查",
            "to": "CCONSIST"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L1"
      },
      {
        "id": "CCONSIST",
        "type": "CONDITION",
        "name": "纳管结果与关联完整一致？",
        "section": "§2.2.4",
        "rule": "§2.2.4 校验与交付",
        "input": "context",
        "output": "context",
        "inputDescription": "正式身份、关键变量及事件依据",
        "outputDescription": "可交付或待补齐",
        "summary": "未完成纳管时暂不交付L2；新建与初始关系一致完成。",
        "ruleDetail": "未完成纳管时暂不交付L2；新建与初始关系一致完成。",
        "next": [
          {
            "label": "是",
            "to": "P3"
          },
          {
            "label": "否",
            "to": "X"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L1"
      },
      {
        "id": "P3",
        "type": "PROGRAM",
        "name": "F04 保存并按实际变化分发",
        "section": "§2.2.4",
        "rule": "§5.2～5.3",
        "input": "context",
        "output": "context",
        "inputDescription": "一致完成的风险与关系",
        "outputDescription": "新纳管 / 关联变化 / 状态变化结果",
        "summary": "防止重复分发，不预设事务或消息协议。",
        "ruleDetail": "防止重复分发，不预设事务或消息协议。",
        "next": [
          {
            "label": "交付F05",
            "to": "E"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L1"
      },
      {
        "id": "E",
        "type": "END",
        "name": "交付 L2 观察定义与有效关系",
        "section": "§2.2.4",
        "rule": "§5.2",
        "input": "context",
        "output": "context",
        "inputDescription": "risk_id、定义、变量配置及事件增量",
        "outputDescription": "L2观察输入",
        "summary": "当前等级与历史方向由L2分析。",
        "ruleDetail": "当前等级与历史方向由L2分析。",
        "next": [],
        "pending": "",
        "module": "",
        "source": "L1"
      },
      {
        "id": "DUP",
        "type": "END",
        "name": "重复输入 · 不重复创建或分发",
        "section": "§2.2.1",
        "rule": "§2.3",
        "input": "context",
        "output": "context",
        "inputDescription": "无增量重复请求",
        "outputDescription": "跳过记录",
        "summary": "同一输入不重复创建风险。",
        "ruleDetail": "同一输入不重复创建风险。",
        "next": [],
        "pending": "",
        "module": "",
        "source": "L1"
      },
      {
        "id": "NONE",
        "type": "END",
        "name": "无具体风险 · 保存识别记录",
        "section": "§2.2.2",
        "rule": "§2.2.2 本环节规则",
        "input": "context",
        "output": "context",
        "inputDescription": "无可识别风险结果",
        "outputDescription": "无MonitoredRisk新增",
        "summary": "不为填满流程而强行生成风险。",
        "ruleDetail": "不为填满流程而强行生成风险。",
        "next": [],
        "pending": "",
        "module": "",
        "source": "L1"
      },
      {
        "id": "RESTORE",
        "type": "END",
        "name": "保留历史身份，等待恢复条件确认",
        "section": "§2.2.3",
        "rule": "§2.2.3 维护与恢复边界",
        "input": "context",
        "output": "context",
        "inputDescription": "已关闭风险",
        "outputDescription": "待确认恢复事项",
        "summary": "不自动恢复、不重复新建。",
        "ruleDetail": "不自动恢复、不重复新建。",
        "next": [],
        "pending": "恢复条件与状态迁移待讨论。",
        "module": "",
        "source": "L1"
      },
      {
        "id": "X",
        "type": "END",
        "name": "待复核 / 暂缓纳管或补齐",
        "section": "§2.2.2～2.2.4",
        "rule": "§6.2",
        "input": "context",
        "output": "context",
        "inputDescription": "歧义、定义缺口、准入或关联问题",
        "outputDescription": "原因与证据",
        "summary": "某候选待复核不阻断其他候选；补齐后回到对应步骤。",
        "ruleDetail": "某候选待复核不阻断其他候选；补齐后回到对应步骤。",
        "next": [],
        "pending": "人工复核、准入、事务和恢复机制待讨论。",
        "module": "",
        "source": "L1"
      }
    ],
    "layout": [
      "S",
      "DUPCHECK",
      "P1",
      "A1",
      "CRESULT",
      "SEARCH",
      "A2",
      "C",
      "REUSE",
      "CLOSED",
      "CONFIG",
      "ADMIT",
      "CREATE",
      "REL",
      "CCONSIST",
      "P3",
      "E",
      "DUP",
      "NONE",
      "RESTORE",
      "X"
    ],
    "stages": [
      {
        "code": "01",
        "title": "输入与完整候选",
        "description": "先组织完整风险定义，允许0..N个候选。",
        "items": [
          "S",
          "DUPCHECK",
          "P1",
          "A1",
          "CRESULT"
        ],
        "output": "",
        "kind": "business"
      },
      {
        "code": "02",
        "title": "检索、同一性与准入",
        "description": "匹配已存在的稳定身份，再决定复用或新建。",
        "items": [
          "SEARCH",
          "A2",
          "C",
          {
            "title": "身份与准入分支",
            "parallel": false,
            "lanes": [
              {
                "title": "复用已有身份",
                "nodes": [
                  "REUSE",
                  "CLOSED",
                  "CONFIG"
                ]
              },
              {
                "title": "全新风险",
                "nodes": [
                  "ADMIT",
                  "CREATE"
                ]
              }
            ]
          }
        ],
        "output": "",
        "kind": "business"
      },
      {
        "code": "03",
        "title": "关系与一致交付",
        "description": "纳管、初始变量和事件关联完整后交付L2。",
        "items": [
          "REL",
          "CCONSIST",
          "P3",
          "E"
        ],
        "output": "",
        "kind": "business"
      },
      {
        "code": "04",
        "title": "独立业务出口",
        "description": "保留重复、无风险、恢复待定与复核的不同含义。",
        "items": [
          {
            "title": "条件出口",
            "parallel": false,
            "lanes": [
              {
                "title": "重复",
                "nodes": [
                  "DUP"
                ]
              },
              {
                "title": "无具体风险",
                "nodes": [
                  "NONE"
                ]
              }
            ]
          },
          {
            "title": "待处理",
            "parallel": false,
            "lanes": [
              {
                "title": "恢复条件待定",
                "nodes": [
                  "RESTORE"
                ]
              },
              {
                "title": "补齐 / 复核",
                "nodes": [
                  "X"
                ]
              }
            ]
          }
        ],
        "output": "",
        "kind": "outcomes"
      }
    ]
  },
  "STR-L2-01": {
    "source": "L2",
    "summary": "依据L2图①/②及总览F05：先固定身份、时间和证据。来源、应对、损害可逻辑并行，力量比较依赖来源与应对，整体状态汇总全部结果。",
    "nodes": [
      {
        "id": "S",
        "type": "START",
        "name": "接收本轮观察请求",
        "section": "§2.2.1",
        "rule": "BR-L2-01",
        "input": "business_context",
        "output": "context",
        "inputDescription": "新风险、事件、指标、周期或人工触发",
        "outputDescription": "待检查观察请求",
        "summary": "触发阈值和无新数据是否形成快照仍待讨论。",
        "ruleDetail": "触发阈值和无新数据是否形成快照仍待讨论。",
        "next": [
          {
            "label": "检查重复",
            "to": "DUPCHECK"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L2"
      },
      {
        "id": "DUPCHECK",
        "type": "CONDITION",
        "name": "是否重复处理请求？",
        "section": "§2.2.1",
        "rule": "BR-L2-01",
        "input": "context",
        "output": "context",
        "inputDescription": "请求与已处理记录",
        "outputDescription": "有效观察或重复结束",
        "summary": "避免重复生成同一次处理结果，不凭没有新闻断言维持。",
        "ruleDetail": "避免重复生成同一次处理结果，不凭没有新闻断言维持。",
        "next": [
          {
            "label": "是",
            "to": "DUP"
          },
          {
            "label": "否",
            "to": "CONTEXT"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L2"
      },
      {
        "id": "CONTEXT",
        "type": "PROGRAM",
        "name": "固定风险、范围、截止时间和版本",
        "section": "§2.2.1",
        "rule": "BR-L2-02",
        "input": "context",
        "output": "context",
        "inputDescription": "MonitoredRisk及定义版本",
        "outputDescription": "risk_id / snapshot_time / 版本引用",
        "summary": "本轮使用受理时固定的定义与证据，历史判断保留原依据。",
        "ruleDetail": "本轮使用受理时固定的定义与证据，历史判断保留原依据。",
        "next": [
          {
            "label": "检查身份和上下文",
            "to": "CCTX"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L2"
      },
      {
        "id": "CCTX",
        "type": "CONDITION",
        "name": "风险身份及必要上下文有效？",
        "section": "§2.2.1",
        "rule": "BR-L2-02",
        "input": "context",
        "output": "context",
        "inputDescription": "风险身份、引用与范围",
        "outputDescription": "有效上下文或待补齐",
        "summary": "无效身份/引用先修复；与部分指标缺失区别处理。",
        "ruleDetail": "无效身份/引用先修复；与部分指标缺失区别处理。",
        "next": [
          {
            "label": "是",
            "to": "P1"
          },
          {
            "label": "否",
            "to": "XCTX"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L2"
      },
      {
        "id": "P1",
        "type": "PROGRAM",
        "name": "读取关键变量、机制与观测证据",
        "section": "§2.2.1",
        "rule": "BR-L2-03 / BR-L2-04",
        "input": "context",
        "output": "context",
        "inputDescription": "长期变量关系、指标实际值、必要事件",
        "outputDescription": "按本轮范围与截止筛选的证据",
        "summary": "变量角色来自L1；实际值来自F01，定义来自M2；必要时补充事件。",
        "ruleDetail": "变量角色来自L1；实际值来自F01，定义来自M2；必要时补充事件。",
        "next": [
          {
            "label": "准备历史和缺口",
            "to": "BASE"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L2"
      },
      {
        "id": "BASE",
        "type": "PROGRAM",
        "name": "准备历史基准并标记缺口",
        "section": "§2.2.1",
        "rule": "BR-L2-02 / BR-L2-12",
        "input": "context",
        "output": "context",
        "inputDescription": "同风险历史快照及本轮证据",
        "outputDescription": "历史基准、缺口和可比性限制",
        "summary": "部分指标不足可携带限制进入分析；无效身份不能直接继续。",
        "ruleDetail": "部分指标不足可携带限制进入分析；无效身份不能直接继续。",
        "next": [
          {
            "label": "按角色组织共用证据",
            "to": "FORK"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L2"
      },
      {
        "id": "FORK",
        "type": "PROGRAM",
        "name": "按角色组织共用证据",
        "section": "§2.2.2",
        "rule": "BR-L2-03 / BR-L2-04",
        "input": "context",
        "output": "context",
        "inputDescription": "变量角色、机制与证据",
        "outputDescription": "来源/应对/损害所需上下文",
        "summary": "下游三项逻辑上可并行；实际模型调用合并和并行策略待技术设计。",
        "ruleDetail": "下游三项逻辑上可并行；实际模型调用合并和并行策略待技术设计。",
        "next": [
          {
            "label": "来源分析",
            "to": "A1"
          },
          {
            "label": "应对分析",
            "to": "A2"
          },
          {
            "label": "损害分析",
            "to": "A4"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L2"
      },
      {
        "id": "A1",
        "type": "AI",
        "name": "风险来源分析",
        "section": "§2.2.2 · 2.1",
        "rule": "BR-L2-03 / BR-L2-04 / BR-L2-05 / BR-L2-06",
        "input": "context",
        "output": "context",
        "inputDescription": "risk_driver、risk_transmission变量及指标/事件",
        "outputDescription": "来源变量状态、当前作用与来源压力",
        "summary": "从机制和证据判断当前驱动与传导条件，角色标签不能替代当前作用。",
        "ruleDetail": "从机制和证据判断当前驱动与传导条件，角色标签不能替代当前作用。",
        "next": [
          {
            "label": "供力量比较",
            "to": "A3"
          },
          {
            "label": "供整体状态汇总",
            "to": "A5"
          }
        ],
        "task": "AI-L2-01",
        "taskVersion": "1.0",
        "pending": "",
        "module": "",
        "source": "L2"
      },
      {
        "id": "A2",
        "type": "AI",
        "name": "风险应对分析",
        "section": "§2.2.2 · 2.2",
        "rule": "BR-L2-03 / BR-L2-04 / BR-L2-05 / BR-L2-06",
        "input": "context",
        "output": "context",
        "inputDescription": "risk_buffer及治理事件、实施和效果证据",
        "outputDescription": "措施出现、落实、效果和限制",
        "summary": "已宣布措施不等于缓解已生效；可作为持续性条件。",
        "ruleDetail": "已宣布措施不等于缓解已生效；可作为持续性条件。",
        "next": [
          {
            "label": "供力量比较",
            "to": "A3"
          },
          {
            "label": "供整体状态汇总",
            "to": "A5"
          }
        ],
        "task": "AI-L2-02",
        "taskVersion": "1.0",
        "pending": "",
        "module": "",
        "source": "L2"
      },
      {
        "id": "A4",
        "type": "AI",
        "name": "风险影响与损害分析",
        "section": "§2.2.2 · 2.4",
        "rule": "BR-L2-07",
        "input": "context",
        "output": "context",
        "inputDescription": "潜在损害主体、损害验证变量及证据",
        "outputDescription": "实际影响范围、损害兑现及限制",
        "summary": "区分观察对象与损害对象、潜在影响与已发生损害，不把未证实写成无损害。",
        "ruleDetail": "区分观察对象与损害对象、潜在影响与已发生损害，不把未证实写成无损害。",
        "next": [
          {
            "label": "供整体状态汇总",
            "to": "A5"
          }
        ],
        "task": "AI-L2-04",
        "taskVersion": "1.0",
        "pending": "",
        "module": "",
        "source": "L2"
      },
      {
        "id": "A3",
        "type": "AI",
        "name": "两股力量比较",
        "section": "§2.2.2 · 2.3",
        "rule": "BR-L2-06",
        "input": "context",
        "output": "context",
        "inputDescription": "A1来源压力 + A2实际应对效果",
        "outputDescription": "相对作用结论与解释",
        "summary": "依赖来源和应对两项分析；不直接映射风险等级或历史trend。",
        "ruleDetail": "依赖来源和应对两项分析；不直接映射风险等级或历史trend。",
        "next": [
          {
            "label": "比较完成，供整体汇总",
            "to": "A5"
          }
        ],
        "task": "AI-L2-03",
        "taskVersion": "1.0",
        "pending": "",
        "module": "",
        "source": "L2",
        "requiresAll": [
          "A1",
          "A2"
        ]
      },
      {
        "id": "A5",
        "type": "AI",
        "name": "整体风险状态评估",
        "section": "§2.2.2 · 2.5",
        "rule": "BR-L2-08 / BR-L2-09 / BR-L2-10 / BR-L2-11",
        "input": "context",
        "output": "context",
        "inputDescription": "来源、应对、两股力量、影响与损害",
        "outputDescription": "程度、阶段、范围、持续性及status_summary",
        "summary": "汇总A1～A4及限制；等级规则未定时不强制赋值，历史方向留给F06。",
        "ruleDetail": "汇总A1～A4及限制；等级规则未定时不强制赋值，历史方向留给F06。",
        "next": [
          {
            "label": "结构引用校验",
            "to": "P2"
          }
        ],
        "task": "AI-L2-05",
        "taskVersion": "1.0",
        "pending": "",
        "module": "",
        "source": "L2",
        "requiresAll": [
          "A1",
          "A2",
          "A3",
          "A4"
        ]
      },
      {
        "id": "P2",
        "type": "PROGRAM",
        "name": "检查结果结构与证据引用",
        "section": "§2.2.2",
        "rule": "BR-L2-02 / BR-L2-08",
        "input": "context",
        "output": "context",
        "inputDescription": "AI分析、变量明细、引用",
        "outputDescription": "程序校验结果",
        "summary": "数值计算、引用映射和结构约束归程序。",
        "ruleDetail": "数值计算、引用映射和结构约束归程序。",
        "next": [
          {
            "label": "决定交付或返回",
            "to": "C"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L2"
      },
      {
        "id": "C",
        "type": "CONDITION",
        "name": "结果结构及引用有效？",
        "section": "§2.2.2",
        "rule": "BR-L2-08 / BR-L2-15",
        "input": "context",
        "output": "context",
        "inputDescription": "校验结果及待判断项",
        "outputDescription": "整理快照或补齐/复核",
        "summary": "业务允许的待判断不等于技术失败；数据/引用问题返回准备，分析问题返回对应分析。",
        "ruleDetail": "业务允许的待判断不等于技术失败；数据/引用问题返回准备，分析问题返回对应分析。",
        "next": [
          {
            "label": "是，允许注明待判断",
            "to": "P3"
          },
          {
            "label": "否，补齐或复核",
            "to": "H"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L2"
      },
      {
        "id": "H",
        "type": "END",
        "name": "补齐 / 复核后返回对应环节",
        "section": "§2.2.2 · 复核衔接",
        "rule": "BR-L2-02 / BR-L2-03",
        "input": "context",
        "output": "context",
        "inputDescription": "数据缺口、引用或分析问题",
        "outputDescription": "待处理原因及返回目标",
        "summary": "数据问题返回证据准备；分析问题返回对应2.1～2.5；机制配置问题反馈L1。",
        "ruleDetail": "数据问题返回证据准备；分析问题返回对应2.1～2.5；机制配置问题反馈L1。",
        "next": [],
        "pending": "复核条件、权限和恢复执行机制待讨论。",
        "module": "",
        "source": "L2"
      },
      {
        "id": "P3",
        "type": "PROGRAM",
        "name": "整理并由 F05 保存当前快照与变量明细",
        "section": "§2.2.2；总览§5.2 F05",
        "rule": "BR-L2-15",
        "input": "context",
        "output": "context",
        "inputDescription": "有效的当前四维与变量分析",
        "outputDescription": "RiskSnapshot / risk_snapshot_variable_analysis",
        "summary": "按总览F05归属保存当前结果；L2图④与F06附属结果的一致保存边界仍待技术设计。",
        "ruleDetail": "按总览F05归属保存当前结果；L2图④与F06附属结果的一致保存边界仍待技术设计。",
        "next": [
          {
            "label": "交历史变化分析",
            "to": "E"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L2"
      },
      {
        "id": "E",
        "type": "END",
        "name": "交 F06 比较及 F07/F08 消费",
        "section": "总览 §5.2 F05；L2 §5.2",
        "rule": "BR-L2-15",
        "input": "context",
        "output": "context",
        "inputDescription": "当前快照、变量明细、证据与版本",
        "outputDescription": "当前状态分析交接",
        "summary": "保存成功后交付；F06比较形成附属变化，不能倒灌当前四维。",
        "ruleDetail": "保存成功后交付；F06比较形成附属变化，不能倒灌当前四维。",
        "next": [],
        "pending": "",
        "module": "",
        "source": "L2"
      },
      {
        "id": "DUP",
        "type": "END",
        "name": "重复观察 · 结束本次处理",
        "section": "§2.2.1",
        "rule": "BR-L2-01",
        "input": "context",
        "output": "context",
        "inputDescription": "已处理请求",
        "outputDescription": "不重复生成记录",
        "summary": "重复不等于风险稳定。",
        "ruleDetail": "重复不等于风险稳定。",
        "next": [],
        "pending": "",
        "module": "",
        "source": "L2"
      },
      {
        "id": "XCTX",
        "type": "END",
        "name": "身份或上下文无效 · 待补齐",
        "section": "§2.2.1",
        "rule": "BR-L2-02",
        "input": "context",
        "output": "context",
        "inputDescription": "无效身份或必要引用缺口",
        "outputDescription": "待补齐事项",
        "summary": "先修复身份与必要上下文，不冒充有效观察输入。",
        "ruleDetail": "先修复身份与必要上下文，不冒充有效观察输入。",
        "next": [],
        "pending": "必要输入集合及补齐责任待讨论。",
        "module": "",
        "source": "L2"
      }
    ],
    "layout": [
      "S",
      "DUPCHECK",
      "CONTEXT",
      "CCTX",
      "P1",
      "BASE",
      "FORK",
      {
        "title": "逻辑可并行 · 实际调用方式待定",
        "parallel": true,
        "lanes": [
          {
            "title": "来源",
            "nodes": [
              "A1"
            ]
          },
          {
            "title": "应对",
            "nodes": [
              "A2"
            ]
          },
          {
            "title": "影响与损害",
            "nodes": [
              "A4"
            ]
          }
        ]
      },
      "A3",
      "A5",
      "P2",
      "C",
      "P3",
      "E",
      {
        "title": "按条件转入的业务出口",
        "parallel": false,
        "lanes": [
          {
            "title": "重复输入",
            "nodes": [
              "DUP"
            ]
          },
          {
            "title": "身份无效",
            "nodes": [
              "XCTX"
            ]
          },
          {
            "title": "补齐 / 复核",
            "nodes": [
              "H"
            ]
          }
        ]
      }
    ],
    "stages": [
      {
        "code": "01",
        "title": "观察与证据准备",
        "description": "固定风险、范围、截止时间与必要引用。",
        "items": [
          "S",
          "DUPCHECK",
          "CONTEXT",
          "CCTX",
          "P1",
          "BASE"
        ],
        "output": "",
        "kind": "business"
      },
      {
        "code": "02",
        "title": "当前状态分析",
        "description": "按业务依赖组织分析，而非机械串行调用。",
        "items": [
          "FORK",
          {
            "title": "逻辑可并行",
            "parallel": true,
            "lanes": [
              {
                "title": "来源压力",
                "nodes": [
                  "A1"
                ]
              },
              {
                "title": "应对效果",
                "nodes": [
                  "A2"
                ]
              },
              {
                "title": "影响与损害",
                "nodes": [
                  "A4"
                ]
              }
            ]
          },
          "A3",
          "A5"
        ],
        "output": "",
        "kind": "business"
      },
      {
        "code": "03",
        "title": "校验与交付",
        "description": "保留证据限制，将当前状态交给历史变化分析。",
        "items": [
          "P2",
          "C",
          "P3",
          "E"
        ],
        "output": "",
        "kind": "business"
      },
      {
        "code": "04",
        "title": "条件业务出口",
        "description": "重复、身份无效、补齐复核分别处理。",
        "items": [
          {
            "title": "按条件结束或暂停",
            "parallel": false,
            "lanes": [
              {
                "title": "重复请求",
                "nodes": [
                  "DUP"
                ]
              },
              {
                "title": "身份无效",
                "nodes": [
                  "XCTX"
                ]
              },
              {
                "title": "补齐 / 复核",
                "nodes": [
                  "H"
                ]
              }
            ]
          }
        ],
        "output": "",
        "kind": "outcomes"
      }
    ]
  },
  "STR-L2-02": {
    "source": "L2",
    "summary": "依据L2图③/④及总览F06：可比性检查后分别比较方向和持续性，再汇合识别减弱节点；首次或不可比时保留变化待判断。",
    "nodes": [
      {
        "id": "S",
        "type": "START",
        "name": "接收当前快照及分析依据",
        "section": "§2.2.3",
        "rule": "BR-L2-12",
        "input": "business_context",
        "output": "context",
        "inputDescription": "F05当前快照、变量明细、status_summary",
        "outputDescription": "历史比较输入",
        "summary": "不重新生成当前四维；比较同一风险。",
        "ruleDetail": "不重新生成当前四维；比较同一风险。",
        "next": [
          {
            "label": "读取历史基准",
            "to": "P1"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L2"
      },
      {
        "id": "P1",
        "type": "PROGRAM",
        "name": "读取同一风险的历史比较基准",
        "section": "§2.2.3",
        "rule": "BR-L2-02 / BR-L2-12",
        "input": "context",
        "output": "context",
        "inputDescription": "历史快照、范围、定义、配置与方法版本",
        "outputDescription": "比较基准及限制",
        "summary": "来源和损害未独立成评分字段，应从状态说明与明细读取。",
        "ruleDetail": "来源和损害未独立成评分字段，应从状态说明与明细读取。",
        "next": [
          {
            "label": "检查可比性",
            "to": "C"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L2"
      },
      {
        "id": "C",
        "type": "CONDITION",
        "name": "存在可比历史快照？",
        "section": "§2.2.3",
        "rule": "BR-L2-12",
        "input": "context",
        "output": "context",
        "inputDescription": "当前与历史及口径",
        "outputDescription": "正常比较或变化待判断",
        "summary": "首次、定义范围或方法不可比，不强行输出维持/减弱。",
        "ruleDetail": "首次、定义范围或方法不可比，不强行输出维持/减弱。",
        "next": [
          {
            "label": "是，分析方向",
            "to": "A1"
          },
          {
            "label": "是，分析持续性",
            "to": "A2"
          },
          {
            "label": "首次 / 不可比",
            "to": "UNKNOWN"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L2"
      },
      {
        "id": "A1",
        "type": "AI",
        "name": "风险方向变化分析",
        "section": "§2.2.3 · 3.1",
        "rule": "BR-L2-12",
        "input": "context",
        "output": "context",
        "inputDescription": "可比前后快照、来源应对依据",
        "outputDescription": "trend及变化解释",
        "summary": "等级不变也可能方向减弱，不能仅按等级差决定方向。",
        "ruleDetail": "等级不变也可能方向减弱，不能仅按等级差决定方向。",
        "next": [
          {
            "label": "供减弱节点识别",
            "to": "A3"
          }
        ],
        "task": "AI-L2-06",
        "taskVersion": "1.0",
        "pending": "",
        "module": "",
        "source": "L2"
      },
      {
        "id": "A2",
        "type": "AI",
        "name": "风险持续性变化分析",
        "section": "§2.2.3 · 3.2",
        "rule": "BR-L2-13",
        "input": "context",
        "output": "context",
        "inputDescription": "前后persistence_outlook及条件",
        "outputDescription": "持续预期修订、依据和限制",
        "summary": "时间自然流逝不等于持续预期缩短；条件不足时待判断。",
        "ruleDetail": "时间自然流逝不等于持续预期缩短；条件不足时待判断。",
        "next": [
          {
            "label": "供减弱节点识别",
            "to": "A3"
          }
        ],
        "task": "AI-L2-07",
        "taskVersion": "1.0",
        "pending": "",
        "module": "",
        "source": "L2"
      },
      {
        "id": "A3",
        "type": "AI",
        "name": "风险减弱节点识别",
        "section": "§2.2.3 · 3.3",
        "rule": "BR-L2-14",
        "input": "context",
        "output": "context",
        "inputDescription": "方向与持续性变化及相关证据",
        "outputDescription": "减弱信号、候选节点和后续验证",
        "summary": "汇合两项比较后识别，方向减弱不能单独确认减弱节点。",
        "ruleDetail": "汇合两项比较后识别，方向减弱不能单独确认减弱节点。",
        "next": [
          {
            "label": "检查引用",
            "to": "CHECK"
          }
        ],
        "task": "AI-L2-08",
        "taskVersion": "1.0",
        "pending": "",
        "module": "",
        "source": "L2",
        "requiresAll": [
          "A1",
          "A2"
        ]
      },
      {
        "id": "CHECK",
        "type": "CONDITION",
        "name": "比较结果及引用有效？",
        "section": "§2.2.3",
        "rule": "BR-L2-12 / BR-L2-13 / BR-L2-14",
        "input": "context",
        "output": "context",
        "inputDescription": "变化、节点、比较基准和引用",
        "outputDescription": "有效结果或待复核",
        "summary": "允许业务上的部分待判断，结构错误不能伪装成稳定。",
        "ruleDetail": "允许业务上的部分待判断，结构错误不能伪装成稳定。",
        "next": [
          {
            "label": "是，允许部分待判断",
            "to": "P2"
          },
          {
            "label": "否",
            "to": "X"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L2"
      },
      {
        "id": "UNKNOWN",
        "type": "PROGRAM",
        "name": "记录无基准 / 不可比及变化待判断",
        "section": "§2.2.3",
        "rule": "BR-L2-12 / BR-L2-14",
        "input": "context",
        "output": "context",
        "inputDescription": "首次或不可比原因",
        "outputDescription": "方向与持续性待判断、节点不作确定结论",
        "summary": "保留当前快照，不补写维持风险。",
        "ruleDetail": "保留当前快照，不补写维持风险。",
        "next": [
          {
            "label": "整理结果",
            "to": "P2"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L2"
      },
      {
        "id": "P2",
        "type": "PROGRAM",
        "name": "整理 RiskAnalysisResult",
        "section": "§2.2.3",
        "rule": "BR-L2-12 / BR-L2-13 / BR-L2-14",
        "input": "context",
        "output": "context",
        "inputDescription": "有效比较或待判断说明",
        "outputDescription": "快照附属变化结果",
        "summary": "trend、persistence_change与节点说明与当前四维分开。",
        "ruleDetail": "trend、persistence_change与节点说明与当前四维分开。",
        "next": [
          {
            "label": "一致性检查",
            "to": "P3"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L2"
      },
      {
        "id": "P3",
        "type": "PROGRAM",
        "name": "检查时间、引用与本轮结果一致性",
        "section": "§2.2.4 · 4.1",
        "rule": "BR-L2-02 / BR-L2-08 / BR-L2-12 / BR-L2-15",
        "input": "context",
        "output": "context",
        "inputDescription": "当前快照、变量与变化结果",
        "outputDescription": "一致性检查结果",
        "summary": "首次观察可保存快照及变化待判断结果。",
        "ruleDetail": "首次观察可保存快照及变化待判断结果。",
        "next": [
          {
            "label": "判断交付条件",
            "to": "CCONSIST"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L2"
      },
      {
        "id": "CCONSIST",
        "type": "CONDITION",
        "name": "满足交付条件？",
        "section": "§2.2.4",
        "rule": "BR-L2-15",
        "input": "context",
        "output": "context",
        "inputDescription": "本轮一致性检查",
        "outputDescription": "保存或补齐/复核",
        "summary": "未通过返回对应环节；保存与交付失败区别处理。",
        "ruleDetail": "未通过返回对应环节；保存与交付失败区别处理。",
        "next": [
          {
            "label": "是",
            "to": "SAVE"
          },
          {
            "label": "否",
            "to": "X"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L2"
      },
      {
        "id": "SAVE",
        "type": "PROGRAM",
        "name": "保存附属分析并提供 Timeline / 可消费结果",
        "section": "§2.2.4 · 4.2～4.4",
        "rule": "BR-L2-15",
        "input": "context",
        "output": "context",
        "inputDescription": "经校验的快照引用与变化明细",
        "outputDescription": "RiskAnalysisResult及历史视图数据",
        "summary": "正式保存后发布；F05当前快照与F06附属结果归属按总览，事务边界待定。",
        "ruleDetail": "正式保存后发布；F05当前快照与F06附属结果归属按总览，事务边界待定。",
        "next": [
          {
            "label": "持续观察与反馈",
            "to": "FOLLOW"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L2"
      },
      {
        "id": "FOLLOW",
        "type": "PROGRAM",
        "name": "保留观察重点与必要 L1 维护反馈",
        "section": "§2.2.4 · 4.5",
        "rule": "BR-L2-16",
        "input": "context",
        "output": "context",
        "inputDescription": "方向、持续性、候选节点与缺口",
        "outputDescription": "后续观察重点和维护建议",
        "summary": "不直接改风险身份、变量定义或跟踪状态。",
        "ruleDetail": "不直接改风险身份、变量定义或跟踪状态。",
        "next": [
          {
            "label": "等待下轮观察",
            "to": "E"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L2"
      },
      {
        "id": "E",
        "type": "END",
        "name": "交付 F07/F08，等待下一轮观察",
        "section": "§2.2.4",
        "rule": "BR-L2-15 / BR-L2-16",
        "input": "context",
        "output": "context",
        "inputDescription": "可消费变化与Timeline",
        "outputDescription": "展示、报告与后续观察输入",
        "summary": "风险减弱不自动关闭风险。",
        "ruleDetail": "风险减弱不自动关闭风险。",
        "next": [],
        "pending": "",
        "module": "",
        "source": "L2"
      },
      {
        "id": "X",
        "type": "END",
        "name": "补齐 / 复核，返回对应比较或准备",
        "section": "§2.2.3～2.2.4",
        "rule": "BR-L2-12 / BR-L2-15",
        "input": "context",
        "output": "context",
        "inputDescription": "基准、比较、引用或节点问题",
        "outputDescription": "待处理原因",
        "summary": "基准问题返回读取步骤；方向/持续性问题返回对应分析；节点问题返回节点识别。",
        "ruleDetail": "基准问题返回读取步骤；方向/持续性问题返回对应分析；节点问题返回节点识别。",
        "next": [],
        "pending": "比较基准选择、复核和发布细则待讨论。",
        "module": "",
        "source": "L2"
      }
    ],
    "layout": [
      "S",
      "P1",
      "C",
      {
        "title": "有可比历史 → 两项分别分析",
        "parallel": true,
        "lanes": [
          {
            "title": "方向变化",
            "nodes": [
              "A1"
            ]
          },
          {
            "title": "持续性变化",
            "nodes": [
              "A2"
            ]
          }
        ]
      },
      "A3",
      "CHECK",
      {
        "title": "按条件合流到结果整理",
        "parallel": false,
        "lanes": [
          {
            "title": "首次 / 不可比",
            "nodes": [
              "UNKNOWN"
            ]
          },
          {
            "title": "结果无效",
            "nodes": [
              "X"
            ]
          }
        ]
      },
      "P2",
      "P3",
      "CCONSIST",
      "SAVE",
      "FOLLOW",
      "E"
    ],
    "stages": [
      {
        "code": "01",
        "title": "历史基准与可比性",
        "description": "同一风险的当前快照与可比历史相比较。",
        "items": [
          "S",
          "P1",
          "C"
        ],
        "output": "",
        "kind": "business"
      },
      {
        "code": "02",
        "title": "变化与减弱节点",
        "description": "方向、持续性分别分析，再汇合识别节点。",
        "items": [
          {
            "title": "逻辑可并行",
            "parallel": true,
            "lanes": [
              {
                "title": "方向变化",
                "nodes": [
                  "A1"
                ]
              },
              {
                "title": "持续性变化",
                "nodes": [
                  "A2"
                ]
              }
            ]
          },
          "A3",
          "CHECK",
          "UNKNOWN"
        ],
        "output": "",
        "kind": "business"
      },
      {
        "code": "03",
        "title": "一致保存与持续观察",
        "description": "保存附属分析、交付结果并保留后续重点。",
        "items": [
          "P2",
          "P3",
          "CCONSIST",
          "SAVE",
          "FOLLOW",
          "E",
          "X"
        ],
        "output": "",
        "kind": "business"
      }
    ]
  },
  "STR-L3-01": {
    "source": "L3",
    "summary": "依据L3图①/②B/③B及总览F08：固定报告周期与截止，组织已有结论、校验、保存报告聚合，再按授权和已确认条件发布或撤回。",
    "nodes": [
      {
        "id": "S",
        "type": "START",
        "name": "日报 / 周报 / 月报请求",
        "section": "§2.2.1",
        "rule": "BR-L3-01 / BR-L3-10",
        "input": "business_context",
        "output": "context",
        "inputDescription": "报告请求、产品类型和周期",
        "outputDescription": "报告编制请求",
        "summary": "不重算风险定义、等级或历史变化。",
        "ruleDetail": "不重算风险定义、等级或历史变化。",
        "next": [
          {
            "label": "固定周期截止",
            "to": "P1"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L3"
      },
      {
        "id": "P1",
        "type": "PROGRAM",
        "name": "确定 ReportPeriod 与 dataCutoffAt",
        "section": "§2.2.4 · 2B.1",
        "rule": "BR-L3-10",
        "input": "context",
        "output": "context",
        "inputDescription": "请求与周期规则",
        "outputDescription": "报告周期、数据截止及适用范围",
        "summary": "时间边界和纳入规则未定时明确保留待确认。",
        "ruleDetail": "时间边界和纳入规则未定时明确保留待确认。",
        "next": [
          {
            "label": "读取固定上游结果",
            "to": "UPSTREAM"
          }
        ],
        "pending": "日历边界、时区与空报告策略待讨论。",
        "module": "",
        "source": "L3"
      },
      {
        "id": "UPSTREAM",
        "type": "PROGRAM",
        "name": "读取风险身份、快照及必要变化结果",
        "section": "§2.2.1；§2.2.4",
        "rule": "BR-L3-02 / BR-L3-10 / BR-L3-12",
        "input": "context",
        "output": "context",
        "inputDescription": "L1 MonitoredRisk、L2快照与附属分析",
        "outputDescription": "riskId / snapshotId / comparisonSnapshotId引用",
        "summary": "固定截止内上游结果与依据；不把后续更新无痕写入历史报告。",
        "ruleDetail": "固定截止内上游结果与依据；不把后续更新无痕写入历史报告。",
        "next": [
          {
            "label": "AI组织内容",
            "to": "A1"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L3"
      },
      {
        "id": "A1",
        "type": "AI",
        "name": "组织报告摘要与栏目内容",
        "section": "§2.2.4 · 2B.3",
        "rule": "BR-L3-12 / BR-L3-13",
        "input": "context",
        "output": "context",
        "inputDescription": "已确认上游结论和固定引用",
        "outputDescription": "summary、栏目及风险条目内容",
        "summary": "AI只组织与概括已有判断，不扩展授权或重新评级。",
        "ruleDetail": "AI只组织与概括已有判断，不扩展授权或重新评级。",
        "next": [
          {
            "label": "程序校验",
            "to": "P2"
          }
        ],
        "task": "AI-L3-01",
        "taskVersion": "1.0",
        "pending": "",
        "module": "",
        "source": "L3"
      },
      {
        "id": "P2",
        "type": "PROGRAM",
        "name": "校验结构、引用与上游语义",
        "section": "§2.2.4 · 2B.4",
        "rule": "BR-L3-13 / BR-L3-14",
        "input": "context",
        "output": "context",
        "inputDescription": "AI内容、原风险与快照结论",
        "outputDescription": "一致性检查结果",
        "summary": "检查内容未改写上游结论，保存完整引用链。",
        "ruleDetail": "检查内容未改写上游结论，保存完整引用链。",
        "next": [
          {
            "label": "校验结果",
            "to": "C"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L3"
      },
      {
        "id": "C",
        "type": "CONDITION",
        "name": "内容校验通过？",
        "section": "§2.2.4",
        "rule": "BR-L3-13",
        "input": "context",
        "output": "context",
        "inputDescription": "结构、引用和语义结果",
        "outputDescription": "可保存内容或待处理",
        "summary": "冲突不能直接发布；复核或重新组织机制待确认。",
        "ruleDetail": "冲突不能直接发布；复核或重新组织机制待确认。",
        "next": [
          {
            "label": "是",
            "to": "SAVE"
          },
          {
            "label": "否",
            "to": "X"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L3"
      },
      {
        "id": "SAVE",
        "type": "PROGRAM",
        "name": "F08 建立报告身份、版本并保存引用",
        "section": "§2.2.5 · 3B.1",
        "rule": "BR-L3-11 / BR-L3-12",
        "input": "context",
        "output": "context",
        "inputDescription": "有效报告内容",
        "outputDescription": "RiskReport、栏目、条目及固定引用",
        "summary": "报告为独立聚合，保存不等于已经发布。",
        "ruleDetail": "报告为独立聚合，保存不等于已经发布。",
        "next": [
          {
            "label": "检查发布资格",
            "to": "CPUB"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L3"
      },
      {
        "id": "CPUB",
        "type": "CONDITION",
        "name": "是否满足发布条件与授权？",
        "section": "§2.2.5；总览§5.2 F08",
        "rule": "BR-L3-14",
        "input": "context",
        "output": "context",
        "inputDescription": "报告、已确认发布条件与动作权限",
        "outputDescription": "授权发布或待处理",
        "summary": "总览要求授权发布；领域文档的强制复核和正式发布条件仍待定。",
        "ruleDetail": "总览要求授权发布；领域文档的强制复核和正式发布条件仍待定。",
        "next": [
          {
            "label": "满足已确认条件且获授权",
            "to": "PUB"
          },
          {
            "label": "不满足 / 条件待定",
            "to": "H"
          }
        ],
        "pending": "正式发布条件、强制复核和状态机待讨论。",
        "module": "",
        "source": "L3",
        "blocking": true
      },
      {
        "id": "PUB",
        "type": "PROGRAM",
        "name": "F08 执行授权发布动作",
        "section": "§2.2.5 · 3B.3",
        "rule": "BR-L3-14",
        "input": "context",
        "output": "context",
        "inputDescription": "具备资格的报告及授权操作",
        "outputDescription": "发布记录与报告阅读版本",
        "summary": "系统管理员在授权范围内发起发布；程序执行业务动作，AI不能自批。",
        "ruleDetail": "系统管理员在授权范围内发起发布；程序执行业务动作，AI不能自批。",
        "next": [
          {
            "label": "供阅读",
            "to": "E"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L3"
      },
      {
        "id": "E",
        "type": "END",
        "name": "已发布报告供授权阅读",
        "section": "§2.2.5",
        "rule": "BR-L3-14",
        "input": "context",
        "output": "context",
        "inputDescription": "已发布RiskReport",
        "outputDescription": "可阅读的日报 / 周报 / 月报",
        "summary": "上游更新不无痕重写旧报告；撤回是后续显式业务动作。",
        "ruleDetail": "上游更新不无痕重写旧报告；撤回是后续显式业务动作。",
        "next": [
          {
            "label": "后续如需授权撤回",
            "to": "WITHDRAW"
          }
        ],
        "pending": "",
        "module": "",
        "source": "L3"
      },
      {
        "id": "WITHDRAW",
        "type": "PROGRAM",
        "name": "F08 执行授权撤回动作",
        "section": "§2.2.5；总览§5.2 F08",
        "rule": "BR-L3-14",
        "input": "context",
        "output": "context",
        "inputDescription": "已发布报告、授权与撤回原因",
        "outputDescription": "撤回记录",
        "summary": "不预设撤回后可见性、原位修改或再次发布的正式状态迁移。",
        "ruleDetail": "不预设撤回后可见性、原位修改或再次发布的正式状态迁移。",
        "next": [
          {
            "label": "记录撤回结果",
            "to": "WEND"
          }
        ],
        "pending": "撤回迁移、可见性及再次发布规则待讨论。",
        "module": "",
        "source": "L3"
      },
      {
        "id": "WEND",
        "type": "END",
        "name": "撤回记录与历史引用保留",
        "section": "§2.2.5",
        "rule": "BR-L3-14",
        "input": "context",
        "output": "context",
        "inputDescription": "撤回处理记录",
        "outputDescription": "可追溯历史",
        "summary": "正式版本与可见性规则另行确认。",
        "ruleDetail": "正式版本与可见性规则另行确认。",
        "next": [],
        "pending": "",
        "module": "",
        "source": "L3"
      },
      {
        "id": "H",
        "type": "END",
        "name": "保留待处理报告，复核机制待定",
        "section": "§2.2.5",
        "rule": "BR-L3-14",
        "input": "context",
        "output": "context",
        "inputDescription": "未满足资格的已保存报告",
        "outputDescription": "待处理依据",
        "summary": "不自动发布，也不把未经确认的强制人工审核固化进流程。",
        "ruleDetail": "不自动发布，也不把未经确认的强制人工审核固化进流程。",
        "next": [],
        "pending": "复核入口、条件、发布状态机待讨论。",
        "module": "",
        "source": "L3"
      },
      {
        "id": "X",
        "type": "END",
        "name": "内容待复核或重新组织",
        "section": "§2.2.4",
        "rule": "BR-L3-13",
        "input": "context",
        "output": "context",
        "inputDescription": "冲突、引用或结构错误",
        "outputDescription": "待处理原因",
        "summary": "先处理冲突，再回对应内容组织步骤；恢复执行细节待定。",
        "ruleDetail": "先处理冲突，再回对应内容组织步骤；恢复执行细节待定。",
        "next": [],
        "pending": "",
        "module": "",
        "source": "L3"
      }
    ],
    "layout": [
      "S",
      "P1",
      "UPSTREAM",
      "A1",
      "P2",
      "C",
      "SAVE",
      "CPUB",
      "PUB",
      "E",
      "WITHDRAW",
      "WEND",
      "H",
      "X"
    ],
    "stages": [
      {
        "code": "01",
        "title": "周期与上游依据",
        "description": "固定数据截止，引用已有风险结论。",
        "items": [
          "S",
          "P1",
          "UPSTREAM"
        ],
        "output": "",
        "kind": "business"
      },
      {
        "code": "02",
        "title": "内容组织与校验",
        "description": "AI组织报告，程序核对引用与上游语义。",
        "items": [
          "A1",
          "P2",
          "C",
          "X"
        ],
        "output": "",
        "kind": "business"
      },
      {
        "code": "03",
        "title": "保存与授权发布",
        "description": "保存不等于发布，未定条件保留待确认。",
        "items": [
          "SAVE",
          "CPUB",
          "PUB",
          "E",
          "H"
        ],
        "output": "",
        "kind": "business"
      },
      {
        "code": "04",
        "title": "后续撤回",
        "description": "显式授权动作；正式状态迁移待业务确认。",
        "items": [
          "WITHDRAW",
          "WEND"
        ],
        "output": "",
        "kind": "followup"
      }
    ]
  }
};
