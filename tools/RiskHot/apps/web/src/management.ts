import type { Data, Domain } from './api';

export interface Collection {
  domain: Domain;
  kind: string;
  title: string;
  command?: string;
  commandTitle?: string;
  defaults?: Data;
  emptyDescription?: string;
}

interface ManagementCollection extends Collection {
  group: string;
  summary: string;
  description: string;
}

export interface ManagementDefinition {
  title: string;
  eyebrow: string;
  question: string;
  description: string;
  note: string;
  collections: ManagementCollection[];
}

const reference = (
  kind: string,
  title: string,
  group: string,
  summary: string,
  description: string,
): ManagementCollection => ({
  domain: 'reference',
  kind,
  title,
  group,
  summary,
  description,
  command: 'reference.save',
  commandTitle: `新建${title}`,
  defaults: { kind },
  emptyDescription: `新建${title}后保存为草稿，核对内容并批准后可供研究引用。`,
});

export const managementPages: Record<string, ManagementDefinition> = {
  config: {
    title: '配置中心',
    eyebrow: 'CONFIGURATION',
    question: '统一分类，连接工具。',
    description: '维护风险分类与模型接入资料，为研究提供一致的基础设置。',
    note: '分类说明“属于什么”；评估方法在策略中心维护。',
    collections: [
      reference(
        'risk_source',
        '风险源',
        '分类字典',
        '风险从哪里产生',
        '定义致险因素的分类与分析层次，供风险识别和传导分析引用。',
      ),
      reference(
        'dimension',
        '风险类型',
        '分类字典',
        '风险表现为什么性质',
        '定义风险的性质维度，与风险来源分别维护，支持一致的识别与归类。',
      ),
      reference('market', '市场分类', '分类字典', '研究覆盖哪些市场', '维护市场分类与事件观测主体之间的对应关系。'),
      reference(
        'model',
        '模型接入',
        '工具接入',
        '登记供应商与模型',
        '维护供应商与模型标识；实际调用所用的模型和凭据由运行环境设置。',
      ),
    ],
  },
  strategies: {
    title: '策略中心',
    eyebrow: 'RESEARCH STRATEGIES',
    question: '让判断有方法可循。',
    description: '维护风险研究的评估规则和分析模板，说明如何判断、依据什么判断。',
    note: '保存为草稿 → 人工核验并批准 → 在后续研究中引用。历史任务保留原有版本。',
    collections: [
      reference(
        'rule',
        '评估规则',
        '判断方法',
        '评分、等级与确认条件',
        '按用途维护 M 评分权重、风险等级、减弱确认条件及证据时效要求。',
      ),
      reference(
        'prompt',
        '分析模板',
        '分析方法',
        '分析用途与研究指引',
        '定义研究任务的分析指引和输出要求，供分析过程参考。',
      ),
    ],
  },
  reference: {
    title: '基础资料',
    eyebrow: 'RESEARCH REFERENCE',
    question: '明确研究对象与变量。',
    description: '维护可复用的对象、变量和指标定义，具体风险的观察与跟踪在风险目录中开展。',
    note: '事件的观测主体是经济体、机构或市场等资料；纳管风险及其观察任务在风险目录中管理。',
    collections: [
      reference(
        'target',
        '事件的观测主体',
        '对象与变量',
        '经济体、机构与市场',
        '维护事件观测主体的类型、所属区域和边界，供事件引用；风险引用时须另行确认观察范围。',
      ),
      reference(
        'variable',
        '全局变量',
        '对象与变量',
        '统一变量定义与口径',
        '维护变量定义、适用边界和计量单位。',
      ),
      {
        domain: 'reference',
        kind: 'variable_candidate',
        title: '待确认变量',
        group: '对象与变量',
        summary: '复核研究中新发现的变量',
        description: '核对研究过程中提出的变量候选，决定补充资料或归入既有变量。',
        emptyDescription: '研究中新发现的变量候选会在这里汇集，打开记录后进行复核。',
      },
      {
        domain: 'observations',
        kind: 'indicator',
        title: '指标定义',
        group: '指标口径',
        summary: '单位、频率与数据来源',
        description: '定义实际观测指标的口径、计量单位和采样频率。',
        command: 'observations.indicator',
        commandTitle: '新建指标',
        emptyDescription: '先定义指标，再建立变量映射并导入观测值。',
      },
      {
        domain: 'observations',
        kind: 'mapping',
        title: '变量映射',
        group: '指标口径',
        summary: '把指标关联到研究变量',
        description: '将具体指标与全局变量对应，说明指标如何支持变量观察。',
        command: 'observations.mapping',
        commandTitle: '建立映射',
        emptyDescription: '选择已有指标和变量，建立明确的对应关系。',
      },
    ],
  },
  data: {
    title: '数据管理',
    eyebrow: 'OBSERVATION DATA',
    question: '用真实观测支撑判断。',
    description: '导入和查看观测值，保留数据时间与来源，供后续研究使用。',
    note: '指标口径和变量映射在基础资料维护；原文与宏观事件在信息与事件中维护。',
    collections: [
      {
        domain: 'observations',
        kind: 'value',
        title: '观测数据',
        group: '数据记录',
        summary: '观测值及其时间、来源',
        description: '按指标导入结构化观测值，并保留发布时间、可用时间和数据来源。',
        command: 'observations.import',
        commandTitle: '导入观测数据',
        emptyDescription: '导入已有指标的真实观测值后，可在此核对数据与时间边界。',
      },
    ],
  },
};
