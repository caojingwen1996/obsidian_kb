'use strict';
(() => {
  const DATA = window.RISKHOT_DEMO;
  const main = document.getElementById('maincontent');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const paths = {
    arrow: '<path d="M4 12h15M13 6l6 6-6 6"/>',
    back: '<path d="M20 12H5m6-6-6 6 6 6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    up: '<path d="M5 17 18 4M8 4h10v10"/>',
    ease: '<path d="m5 7 13 13M8 20h10V10"/>',
    stable: '<path d="M4 12h16m-5-5 5 5-5 5"/>',
    unknown: '<path d="M9 8a3 3 0 0 1 6 0c0 2-3 2-3 5m0 4h.01"/>'
  };
  const icon = key => `<svg class="${key === 'arrow' ? 'arrow' : ''}" viewBox="0 0 24 24" aria-hidden="true">${paths[key] || paths.arrow}</svg>`;
  const risk = id => DATA.risks.find(r => r.id === id);
  const stamp = value => value ? value.replaceAll('-', '.') : '尚未形成评估';
  const badge = value => {
    const cfg = {增强:['up','up','压力增加'],减弱:['down','ease','有所缓解'],稳定:['stable','stable','变化不大'],待判断:['unknown','unknown','暂难判断'],待评估:['unknown','unknown','等待评估']}[value] || ['unknown','unknown',value];
    return `<span class="status ${cfg[0]}">${icon(cfg[1])}${esc(cfg[2])}</span>`;
  };
  const link = (href, text) => `<a class="text-link" href="${href}">${esc(text)}${icon('arrow')}</a>`;
  const READING = {
    r1: {
      title:'美元融资压力仍在增加，政策支持尚未充分传导',
      short:'美元资金仍然难借，缓解还需要时间',
      intro:'部分需要借入美元的主体，正在面对更高的资金成本。支持工具的使用有所增加，但资金还没有充分到达承压环节。',
      now:'当前融资压力处于高位。获得短期美元资金变得更困难，而新增支持暂时不足以抵消这部分压力。',
      change:'与 3 月 11 日相比，风险仍处于高位，压力继续增加。严重程度没有跨档，不代表情况没有变化。',
      cause:'一方面，外币资金更难获得，短期借款成本继续上升；另一方面，支持工具使用量虽然增加，覆盖的主体范围却没有同步扩大。缓解措施已经出现，但落地效果还需要验证。',
      impact:'目前证据支持的影响，主要落在短期外币融资主体及相关融资链条。样本覆盖有限，不能据此认为所有金融机构都面临同等压力。',
      better:'融资成本连续回落，而且政策支持确实覆盖当前承压主体。',
      worse:'融资成本继续维持高位，支持覆盖仍然不足，压力可能持续。',
      signal:'融资成本能否持续回落？',
      mechanism:['美元资金更难获得','短期融资成本上升','相关主体偿付承压'],
      term:['融资溢价是什么？','可以理解为借到资金时需要额外支付的成本。1 个基点等于 0.01 个百分点；溢价变高，通常意味着融资条件趋紧。'],
      note:'严重程度为高；相比 3 月 11 日，压力继续增加。'
    },
    r2: {
      title:'债务融资压力仍处高位，没有新变化也需留意',
      short:'债务压力没有继续加重，但仍未缓解',
      intro:'一些存在较大到期债务需求的融资主体，仍然需要在较高成本下筹集资金。本轮变化不大，压力本身并没有消失。',
      now:'债务偿付与再融资约束仍处高位。既定融资安排提供了一定缓冲，但尚不足以确认压力减轻。',
      change:'与 3 月 10 日相比，实际融资条件和偿付安排未发生实质变化。“变化不大”描述的是方向，当前严重程度仍为高。',
      cause:'已有债务需要按期偿还，而重新筹集资金的成本仍然偏高。融资安排出现进展，但能否按计划完成，仍是关键。',
      impact:'主要涉及存在较大到期融资需求的主权融资主体。现有样本无法外推为所有国家的共同处境。',
      better:'既定融资安排实际完成，且发行条件改善。',
      worse:'融资安排未兑现、成本持续偏高，原有压力就可能延续。',
      signal:'到期融资安排能否兑现？',
      mechanism:['到期债务需要偿付','重新融资成本较高','偿付安排持续承压'],
      term:['再融资是什么意思？','原来的债务到期时，通过新的融资筹集偿还资金。关键既包括能否借到资金，也包括成本和期限是否可承受。'],
      note:'严重程度为高；相比 3 月 10 日，变化不大。'
    },
    r3: {
      title:'制造业需求出现改善，放缓风险尚未解除',
      short:'订单有所改善，需求仍需继续验证',
      intro:'需求端出现了一些改善信号，制造业放缓的压力有所减轻。但整体需求仍然偏弱，一轮好转还不足以确认持续修复。',
      now:'需求放缓风险处于中等程度，正在出现缓解。现有改善信号可以解释本轮变化，但还不能说明风险已经解除。',
      change:'与 3 月 11 日相比，外部需求有所修复，放缓压力减轻；需求的绝对水平仍然偏弱。',
      cause:'订单端出现边际改善，使需求进一步下滑的压力有所缓和。接下来需要看订单改善能否延续，以及能否实际带动生产。',
      impact:'已观察的影响主要涉及制造业生产及相关跨境贸易需求。订单改善是否扩展到更广泛主体，仍需更多数据。',
      better:'后续订单继续改善，并且向实际生产活动传导。',
      worse:'订单改善未能延续，需求仍停留在偏弱水平，当前缓解就可能不足以持续。',
      signal:'订单改善能否延续到生产？',
      mechanism:['订单端出现改善','需求下滑压力减轻','生产端仍待验证'],
      term:['“有所缓解”意味着什么？','它表示相较明确的历史基准，风险压力减轻。风险依然可能存在，也不等于市场价格一定上涨。'],
      note:'严重程度为中；相比 3 月 11 日，风险有所缓解。'
    },
    r4: {
      title:'能源供给扰动增加，替代供给还未填满缺口',
      short:'能源供给出现扰动，成本压力有所增加',
      intro:'可用能源供给减少，替代供给虽然增加，还没有完全弥补缺口。能源使用成本及相关生产链条正承受更多压力。',
      now:'能源供给扰动风险处于中等程度，本轮压力增加。新增替代供给起到了部分缓冲作用，但缺口仍然存在。',
      change:'与上一轮可比观察相比，能源供给可用性降低；替代供给增加，尚未完全抵消这一变化。',
      cause:'原有供给受到扰动后，替代来源的落地需要时间。现有库存可以提供缓冲，但缓冲能持续多久，还取决于后续供给恢复情况。',
      impact:'当前影响集中在能源使用成本及相关生产链条。不能把供给扰动直接换算为某类资产的涨跌判断。',
      better:'替代供给实际落地，并使供给缺口得到补充。',
      worse:'替代供给未能弥补缺口，库存缓冲进一步下降，压力可能继续。',
      signal:'替代供给能否真正落地？',
      mechanism:['可用能源供给减少','替代供给尚有缺口','相关生产成本承压'],
      term:['为什么还要看库存？','库存能在供给暂时不足时提供缓冲。供给缺口持续而库存下降时，这种缓冲就可能减弱。'],
      note:'严重程度为中；相比上一轮可比观察，压力增加。'
    },
    r5: {
      title:'跨境资金出现新信号，目前还难判断方向',
      short:'跨境资金有新信号，结论仍需等待',
      intro:'当前样本中出现了值得继续观察的资金流动信号。由于缺少可比历史与足够数据，目前还不能判断风险程度及变化方向。',
      now:'本项风险已完成首次观察，但现有证据不足以形成明确程度判断。缺少历史比较基准，也不能把首次观察写成“稳定”。',
      change:'这是首次观察，暂时没有可比历史。当前呈现“暂难判断”，不代表风险很低，也不代表正在恶化。',
      cause:'部分样本出现变化，但资金实际流向、规模及覆盖范围尚不完整。单一信号还不能说明更广泛的资金状况。',
      impact:'目前只可描述已观测样本中的跨境资金流动，不能外推到全部市场。',
      better:'补齐可比历史与实际资金流数据后，才能进一步判断。',
      worse:'现阶段尚未形成足够证据，不能给出确定的改善或恶化结论。',
      signal:'新信号能否得到更多数据印证？',
      mechanism:[],term:['为什么不能直接说稳定？','“稳定”需要与可比历史进行比较。第一次看到一个信号，不代表它与过去相同。'],
      note:'首次观察；严重程度及变化方向均待判断。'
    },
    r7: {
      title:'航运约束曾有所缓和，这是一份历史判断',short:'航运约束有所缓和',
      intro:'截至 2 月 25 日的历史观察中，运输约束有所缓和。本页保留当时的解读，不能据此说明当前航运情况。',
      now:'当时的风险程度为低，相比历史基准有所减弱。',change:'历史比较显示运输约束缓和，相关传导压力减轻。',
      cause:'本原型保留了当轮状态与摘要，没有收录该轮逐项证据。不能用 3 月的新数据补写 2 月的解释。',
      impact:'当时观测的相关运输链条。此判断的适用范围受历史证据与截止时间限制。',
      better:'本轮未提供后续验证结果。恢复观察前需更新证据。',worse:'缺少后续数据，不能判断当前是否重新出现扰动。',signal:'后续情况需要新的观察。',mechanism:[],term:null,
      note:'历史严重程度为低；历史方向有所缓解。'
    },
    r8: {
      title:'存款流出风险的历史观察保持稳定',short:'存款流出风险保持历史稳定判断',
      intro:'截至 2 月 12 日，最后两轮观察保持稳定，风险程度为低。该风险当前已结束观察，本页仅呈现当时判断。',
      now:'当时样本中的风险程度为低，最后两轮变化不大。结束观察本身不能证明风险在当前仍然较低。',
      change:'结束观察前的最后两轮结果保持稳定。',cause:'原型仅保留历史状态与摘要，未包含完整的历史逐项证据。',
      impact:'仅限当时观测的样本，不能用于描述当前银行体系。',
      better:'本项没有后续观察结果；新的判断需要新的证据。',worse:'当前情况未在这份历史结果中评估。',signal:'需要新证据才能形成当前判断。',mechanism:[],term:null,
      note:'历史严重程度为低；最后两轮变化不大。'
    }
  };
  const reportEntry = id => JSON.parse(JSON.stringify(risk(id)));
  const REPORTS = {
    day: {
      name:'日观察',period:'2025.03.14',cutoff:'2025-03-14 18:00',generated:'2025-03-14 18:10',published:'2025-03-14 18:15',id:'DEMO-REPORT-DAY-20250314',
      title:'融资压力仍在增加，需求端出现缓和',
      deck:'这一期，把融资、需求与能源供给的变化放在一起看。',
      summary:'融资条件继续趋紧，政策支持尚未充分到达压力环节；制造业需求出现改善，但还不足以确认风险解除。能源供给扰动有所增加，跨境资金的新信号仍需更多证据。',
      next:'融资成本是否回落、订单改善能否延续，以及替代能源供给能否落地，是后续需要继续验证的三个信号。',
      entries:['r1','r3','r4','r5'].map(reportEntry)
    },
    week: {
      name:'周观察',period:'2025.03.08 — 03.14',cutoff:'2025-03-14 18:00',generated:'2025-03-14 18:20',published:'2025-03-14 18:30',id:'DEMO-REPORT-WEEK-20250314',
      title:'融资压力仍未缓解，需求改善需要继续验证',
      deck:'回看这一周：哪些压力增加了，哪些出现缓解，哪些仍处高位。',
      summary:'本周的主要变化并不一致。美元融资压力继续增加，制造业需求出现缓解信号，能源供给扰动则有所加重。债务再融资压力虽然没有新的方向变化，仍然处于高位。',
      next:'下一轮要看支持资金是否真正到达承压主体、改善的订单是否带动生产，以及既定融资安排能否完成。',
      entries:['r1','r3','r4','r2'].map(reportEntry)
    },
    month: {
      name:'月观察',period:'2025.02.01 — 02.28',cutoff:'2025-02-28 18:00',generated:'2025-02-28 18:10',published:'2025-02-28 18:20',id:'DEMO-REPORT-MONTH-20250228',
      title:'运输约束曾有缓和，保留当时的观察与边界',
      deck:'二月历史样例：回到当时的判断，理解它能说明什么。',
      summary:'本月收录的历史观察中，航运约束有所缓和，存款流出风险在最后两轮观察中变化不大。这些结论只适用于各自的历史截止时点；原型未提供当轮完整证据，不能用它们描述当前情况。',
      next:'本原型未收录这些对象的后续研究结果。若要理解此后的变化，需要新的证据与评估。',
      entries:['r7','r8'].map(reportEntry)
    }
  };
  const riskHref = (id, report) => `#risk/${id}${report ? '/' + report : ''}`;
  const edition = () => `<div class="edition">本期示例截止<strong>${stamp(DATA.cutoff)} · 北京时间</strong></div>`;
  const pageHeading = (title, description) => `<div class="page-heading"><div><h1 tabindex="-1">${title}</h1><p>${description}</p></div>${edition()}</div>`;
  function home() {
    const r = risk('r1');
    return `${pageHeading('风险速览','先看重要变化，再理解背后的原因。')}
    <section class="feature" aria-label="本期重要观察">
      <div class="lead-story"><h2>${READING.r1.title}</h2><p>${READING.r1.intro}</p>
        <div class="lead-meta">${badge(r.trend)}<span>当前程度：高</span><span>相比 3 月 11 日</span></div>
        ${link(riskHref('r1'),'读懂这项风险')}</div>
      <div class="feature-side"><h2>还有两件值得注意的事</h2>${['r3','r4'].map(id => `<a class="side-story" href="${riskHref(id)}">${badge(risk(id).trend)}<h3>${READING[id].short}</h3><p>${id === 'r3' ? '改善还要持续，才能确认需求真正修复。' : '替代供给正在增加，但仍未完全填补缺口。'}</p><div class="side-bottom"><span class="small muted">了解原因</span>${icon('arrow')}</div></a>`).join('')}</div>
    </section>
    <section aria-labelledby="changing"><div class="section-head"><h2 id="changing">哪些风险正在变化？</h2><p>看变化，也看风险目前处在什么程度。</p></div>
      ${['r1','r3','r4'].map(id => `<article class="story-row"><div>${badge(risk(id).trend)}<h3><a href="${riskHref(id)}">${READING[id].short}</a></h3><div class="story-category">${esc(risk(id).category)} · 当前程度：${esc(risk(id).level)}</div></div><div><p>${READING[id].intro}</p>${link(riskHref(id),'展开解读')}</div><p class="watch"><strong>接下来，看什么</strong>${READING[id].better}</p></article>`).join('')}
    </section>
    <section class="steady-section" aria-labelledby="still"><div class="section-head"><h2 id="still">没有新变化，也不能忽略</h2><p>高位风险与尚难判断的信号，同样保留。</p></div>
      <div class="steady-grid"><article class="steady-story">${badge('稳定')}<h3><a href="${riskHref('r2')}">${READING.r2.short}</a></h3><p>当前程度仍为高。偿债与融资约束没有实质改善，“变化不大”并不意味着安全。</p>${link(riskHref('r2'),'理解持续的压力')}</article>
      <article class="steady-story">${badge('待判断')}<h3><a href="${riskHref('r5')}">${READING.r5.short}</a></h3><p>首次观察缺少可比历史和足够证据，目前还不能判断风险程度与变化方向。</p>${link(riskHref('r5'),'看看还缺哪些依据')}</article></div>
      <p class="pending-note">通胀黏性与政策路径偏离尚未完成首轮评估。${link(riskHref('r6'),'了解评估进度')}</p>
    </section>
    <section class="next-section" aria-labelledby="next"><h2 id="next">接下来，留意这三个信号</h2><p class="muted">它们将帮助判断，当前的变化能否延续。</p><div class="signal-grid">${['r1','r3','r4'].map(id => `<div><h3>${READING[id].signal}</h3><p>${READING[id].better}</p>${link(riskHref(id),'查看判断条件')}</div>`).join('')}</div></section>
    <section class="report-invite"><div><h2>把变化放回一周里看</h2><p>通过观察报告，回看判断如何形成、哪些问题仍待验证。</p></div>${link('#reports/week','阅读本期周观察')}</section>`;
  }
  function variableEvidence(r) {
    const times = ['2025-03-08 08:00','2025-03-11 08:00','2025-03-14 08:00'];
    const observations = times.map((time, index) => ({time,index:index + 1})).filter(o => r.snapshot && o.time <= r.snapshot);
    const variables = r.variables.map(id => DATA.variables.find(v => v.id === id)).filter(Boolean);
    if (!variables.length || !observations.length) return '<p>本原型仅收录该轮状态与摘要，未提供逐项证据。这里保留缺口，不使用更晚的数据补写历史。</p>';
    const latest = observations.at(-1), prior = observations.at(-2);
    return variables.map(v => `<h3>${esc(v.name)}</h3><p>${esc(v.definition)}</p><div class="data-table-wrap"><table class="data-table"><caption class="small muted">虚构观测 · 按本轮截止时间读取</caption><thead><tr><th scope="col">观察内容</th>${prior ? `<th scope="col">${prior.time.slice(5,10).replace('-','.')}</th>` : ''}<th scope="col">${latest.time.slice(5,10).replace('-','.')}</th><th scope="col">单位</th></tr></thead><tbody>${v.indicators.map(row => `<tr><th scope="row">${esc(row[0])}</th>${prior ? `<td>${esc(row[prior.index])}</td>` : ''}<td>${esc(row[latest.index])}</td><td>${esc(row[4])}</td></tr>`).join('')}</tbody></table></div><p class="source">示例来源：${v.sources.map(esc).join('、')}。观测可用时间：${stamp(latest.time)}（北京时间）。以上来源及数值均为虚构。</p>`).join('');
  }
  function references(r, report) {
    return `<div class="reference"><dl><dt>风险身份</dt><dd>${esc(r.code)} · ${esc(r.name)}</dd><dt>本轮引用</dt><dd>${esc(r.snapshotId || '尚无有效快照')}</dd><dt>信息截止</dt><dd>${stamp(r.snapshot)}${r.snapshot ? ' · 北京时间' : ''}</dd><dt>比较基准</dt><dd>${esc(r.comparisonId || '首次观察或尚无可比基准')}<br>${r.base ? stamp(r.base) + ' · 北京时间' : ''}</dd>${report ? `<dt>报告引用</dt><dd>${REPORTS[report].id} · v1.0</dd>` : ''}</dl></div>`;
  }
  function pending(r) {
    return `<a class="back-link" href="#overview">${icon('back')}返回风险速览</a><div class="reading-layout"><article><h1 class="article-title" tabindex="-1">通胀信号还需要首轮评估</h1><div class="article-meta">${badge('待评估')}<span>尚未形成有效判断</span></div><section class="unknown-panel"><h2>目前能告诉你什么？</h2><p>这项风险已被记录，但尚未完成首轮评估。当前没有可以展示的严重程度、变化方向与影响结论。</p><p>完成评估后，会在风险速览中按已有结论组织解读。你无需提交资料或设置观察任务。</p></section><section class="article-section"><h2>为什么不先给一个结论？</h2><p>没有有效评估时，直接显示“稳定”或“低风险”会让人误解。这里明确保留未知。</p></section><details class="evidence"><summary>查看记录信息${icon('down')}</summary><div class="evidence-body">${references(r)}</div></details><div class="reader-bottom">${link('#overview','回到本期风险速览')}</div></article></div>`;
  }
  function detail(id, report) {
    const r = report ? REPORTS[report]?.entries.find(entry => entry.id === id) : risk(id);
    if (!r) return missing();
    if (!r.snapshot) return pending(r);
    const text = READING[id];
    if (!text) return missing();
    const origin = report ? `#reports/${report}` : '#overview';
    const back = report ? `返回${REPORTS[report].name}` : '返回风险速览';
    const sections = [['now','现在是什么情况'],['change','这次改变了什么'],['why','为什么会这样'],['impact','当前影响到哪里'],['watch','接下来，看什么'],['basis','依据与判断演变']];
    return `<a class="back-link" href="${origin}">${icon('back')}${back}</a>
      ${report ? `<div class="history-banner"><strong>按报告时点阅读 · ${REPORTS[report].period}</strong><p>以下为报告引用的固定结果，信息截止于 ${stamp(r.snapshot)}（北京时间）。</p></div>` : ''}
      ${r.tracking !== '跟踪中' ? `<div class="history-banner"><strong>这是一份历史解读</strong><p>该风险当前${esc(r.tracking === '已暂停' ? '已暂停观察' : '已结束观察')}。下文仅适用于当时的证据与时间。</p></div>` : ''}
      <div class="reading-layout"><article><h1 class="article-title" tabindex="-1">${text.title}</h1><p class="article-intro">${text.intro}</p>
      <div class="article-meta">${badge(r.trend)}<span>${report ? '当期' : '当前'}程度：${esc(r.level)}</span><span>信息截止 ${stamp(r.snapshot)} · 北京时间</span></div>
      <section class="article-section" id="now"><h2>现在是什么情况？</h2><p>${text.now}</p><div class="explanation"><strong>程度与变化，分开理解</strong><span>${text.note}</span></div></section>
      <section class="article-section" id="change"><h2>这次改变了什么？</h2><p>${text.change}</p>${r.base ? `<div class="change-line"><div><small>上一次 · ${stamp(r.base).slice(5,10)}</small><p>${esc(r.baselineSummary)}</p></div><span class="change-arrow">${icon('arrow')}</span><div class="current"><small>本轮 · ${stamp(r.snapshot).slice(5,10)}</small><p>${esc(r.summary)}</p></div></div>` : ''}</section>
      <section class="article-section" id="why"><h2>为什么会这样？</h2><p>${text.cause}</p>${text.mechanism.length ? `<div class="mechanism" aria-label="风险作用路径">${text.mechanism.map((item, index) => `${index ? icon('arrow') : ''}<div>${item}</div>`).join('')}</div>` : ''}${text.term ? `<details class="inline-term"><summary>${text.term[0]}</summary><p>${text.term[1]}</p></details>` : ''}</section>
      <section class="article-section" id="impact"><h2>当前影响到哪里？</h2><p>${text.impact}</p></section>
      <section class="article-section" id="watch"><div class="watch-panel"><h2>接下来，看什么？</h2><h3>${r.trend === '待判断' ? '还需要补齐的依据' : '如果这些条件出现，可能有助于缓解'}</h3><p>${text.better}</p><h3>${r.trend === '待判断' ? '目前不能确定的事' : '如果这些情况持续，仍需留意压力'}</h3><p>${text.worse}</p><p class="limit">${esc(r.next)}</p></div></section>
      <section class="article-section" id="basis"><h2>依据与判断演变</h2><p>解读也有边界。以下同时保留支持判断的依据、不同信号与尚未补齐的数据。</p>
      <details class="evidence"><summary>查看本轮依据与数据${icon('down')}</summary><div class="evidence-body"><h3>本轮判断依据</h3><p>${esc(r.reason)}</p>${variableEvidence(r)}<h3>还有哪些不同信号？</h3><p>${esc(r.counter)}</p><h3>目前还缺什么？</h3><p>${esc(r.gap)}</p></div></details>
      <details class="evidence"><summary>回看判断如何变化${icon('down')}</summary><div class="evidence-body"><ol class="timeline">${r.hist.filter(h => '2025-' + h[0] <= r.snapshot.slice(0,10)).map(h => `<li><div class="time-meta"><span>2025.${h[0].replace('-','.')}</span><span>程度：${esc(h[1])}</span>${badge(h[2])}</div><p>${esc(h[3])}</p></li>`).join('')}</ol><p class="source">历史轮次仅展示当时状态与摘要，未提供逐项历史证据。${report ? '不纳入报告截止之后的记录。' : ''}</p></div></details>
      <details class="evidence"><summary>查看来源与时间信息${icon('down')}</summary><div class="evidence-body">${references(r, report)}</div></details></section>
      <div class="reader-bottom">${link(origin,back)}</div></article>
      <aside class="reader-aside" aria-label="本篇阅读目录"><h2>本篇解读</h2>${sections.map(([key,label]) => `<a href="${riskHref(id,report)}" data-scroll="${key}">${label}</a>`).join('')}<p class="aside-note">当前程度说明“有多严重”；变化方向说明“与过去相比如何”。两者分别阅读。</p></aside></div>`;
  }
  function reports(period) {
    const report = REPORTS[period];
    if (!report) return missing();
    return `<div class="page-heading"><div><h1 tabindex="-1">观察报告</h1><p>把零散的变化，放回一段时间里理解。</p></div><div class="edition">本地阅读样例<strong>所有报告均为虚构演示</strong></div></div>
      <div class="report-top"><nav class="period-nav" aria-label="报告周期">${Object.entries(REPORTS).map(([key,r]) => `<a href="#reports/${key}" ${key === period ? 'aria-current="page"' : ''}>${r.name}</a>`).join('')}</nav><p>每份报告保留各自的时间范围与当期判断。</p></div>
      <div class="reading-layout"><article class="report-paper"><h2 class="article-title">${report.title}</h2><p class="report-deck">${report.deck}</p><div class="report-metadata"><span>${report.name} · ${report.period}</span><span>数据截止 ${stamp(report.cutoff)} · 北京时间</span><span>示例版本 v1.0</span></div>
      <section class="report-summary"><h2>读完这一期，记住什么？</h2><p>${report.summary}</p></section>
      ${report.entries.map(r => `<section class="report-entry" id="report-${r.id}">${badge(r.trend)}<h3>${READING[r.id].short}</h3><p>${READING[r.id].now}</p><p class="report-next"><strong>接下来：</strong>${READING[r.id].better}</p>${link(riskHref(r.id, period),'阅读当期解读')}<p class="reference-note">引用信息截止 ${stamp(r.snapshot)} · 北京时间</p></section>`).join('')}
      <section class="article-section"><h2>下一轮还要验证什么？</h2><p>${report.next}</p></section>
      <details class="evidence"><summary>查看报告依据与版本${icon('down')}</summary><div class="evidence-body"><div class="reference"><dl><dt>报告身份</dt><dd>${report.id} · v1.0</dd><dt>覆盖周期</dt><dd>${report.period} · 北京时间</dd><dt>数据截止</dt><dd>${stamp(report.cutoff)} · 北京时间</dd><dt>示例生成</dt><dd>${stamp(report.generated)} · 北京时间</dd><dt>示例发布</dt><dd>${stamp(report.published)} · 北京时间；原型未执行真实发布</dd></dl></div>${report.entries.map(r => `<h3>${esc(r.name)}</h3>${references(r,period)}`).join('')}</div></details>
      <p class="report-footnote">本页为虚构内容与交互样例，不是实时市场研究。收录条目由原型预置，正式报告的纳入规则与发布流程仍需业务确认。阅读当期解读时，保留报告引用时点。</p></article>
      <aside class="reader-aside report-aside" aria-label="报告阅读目录"><h2>正在阅读</h2><div class="report-selected"><span class="small muted">${report.period}</span><strong>${report.name}</strong><p>${report.entries.length} 项观察 · 固定当期引用</p></div>${report.entries.map(r => `<a href="#reports/${period}" data-scroll="report-${r.id}">${READING[r.id].short}</a>`).join('')}<p class="aside-note">报告记录当时如何理解风险。后续变化不会自动覆盖这里的判断。</p></aside></div>`;
  }
  function missing() {
    return `<section class="error-view"><h1 tabindex="-1">暂时找不到这篇内容</h1><p>这个链接没有对应的风险解读或报告。可以回到风险速览，继续阅读本期内容。</p>${link('#overview','返回风险速览')}</section>`;
  }
  const positions = new Map();
  let currentHash = '';
  let initial = true;
  function render() {
    const hash = location.hash || '#overview';
    const parts = hash.slice(1).split('/');
    let content;
    const reportContext = parts[0] === 'reports' || (parts[0] === 'risk' && !!parts[2]);
    if (hash === '#overview') content = home();
    else if (parts[0] === 'reports' && parts.length === 2) content = reports(parts[1]);
    else if (parts[0] === 'risk' && parts.length >= 2 && parts.length <= 3) content = detail(parts[1],parts[2]);
    else content = missing();
    main.innerHTML = content;
    document.querySelectorAll('.primary-nav a').forEach(a => {
      const selected = reportContext ? a.dataset.view === 'reports' : a.dataset.view === 'overview';
      if (selected) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current');
    });
    document.title = `${main.querySelector('h1')?.textContent || '风险速览'} · RiskHot`;
    currentHash = hash;
    if (!initial) main.querySelector('h1')?.focus({preventScroll:true});
    requestAnimationFrame(() => window.scrollTo({top:positions.get(hash) || 0,behavior:'instant'}));
    initial = false;
  }
  document.addEventListener('click', event => {
    const anchor = event.target.closest('a');
    if (!anchor || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (anchor.dataset.scroll) {
      event.preventDefault();
      const target = document.getElementById(anchor.dataset.scroll);
      target?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',block:'start'});
      return;
    }
    if (anchor.getAttribute('href')?.startsWith('#')) positions.set(currentHash,window.scrollY);
  });
  window.addEventListener('scroll', () => {if(currentHash) positions.set(currentHash,window.scrollY);},{passive:true});
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.addEventListener('hashchange',render);
  render();
})();
