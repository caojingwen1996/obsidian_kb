# 航天电子资金面报告与每日跟踪区 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 生成航天电子完整资金面 HTML，并在原机构级研报中加入可每日替换的基本面、动态价值和股价偏离度区域。

**Architecture:** 资金证据保存在独立 HTML 中，原研报只展示三层结论和链接。动态区使用稳定 HTML 注释作为替换边界，不引入联网脚本；大盘继续通过目录扫描收录报告。

**Tech Stack:** 静态 HTML/CSS、PowerShell、项目 `scripts/build.mjs`、现有 HTML 大盘校验脚本。

---

## 文件结构

- Create: `sources/automations/新兴产业/商业航天/2026-07-21-航天电子资金面分析.html` — 完整资金面分析，严格保留模板 1—10 章。
- Modify: `sources/automations/新兴产业/商业航天/2026-07-17-航天电子机构级决策研报.html` — 加入三层每日跟踪区和资金报告链接。
- Modify: `log.md` — 记录本次资金报告、动态区和大盘重建。
- Generated/Modify: `tools/a-share-market-dashboard/a-share-market-dashboard.html` — 由现有构建流程重新生成，不手工编辑。

### Task 1: 固化资金判断和动态估值输入

- [ ] **Step 1: 核对关键数据时点**

执行行情、K 线、资金流、融资、ETF、公告查询。盘中价格采用 `2026-07-21 10:24 Asia/Shanghai` 快照；近 5 日和近 20 日采用截至 2026-07-20 的完成交易日。

- [ ] **Step 2: 核对计算结果**

预期结果：

```text
航天电子：14.27 元，盘中 -2.59%；5 日 -26.10%；20 日 -24.33%
F5 主力净额：7/21 盘中 -0.41 亿元；截至 7/20 的 5 日 -17.29 亿元；20 日 -20.94 亿元
F5 特大单净额：7/21 盘中 -0.43 亿元；截至 7/20 的 5 日 -11.49 亿元；20 日 -12.36 亿元
F3 融资余额：6/22 的 27.13 亿元降至 7/17 的 23.03 亿元，减少 4.10 亿元；7/20 以后未取得可靠更新
国防军工：5 日 -10.03%；20 日 -16.55%
上证指数：5 日 -4.95%；20 日 -8.17%
```

- [ ] **Step 3: 固化判断**

```text
资金状态：结构性流出
新增资金：observe，0%
已有持仓：review；若反弹仍无资金和基本面修复，按风险预算复核是否降低 1/4—1/2 风险敞口
基本面状态：恶化
临时动态价值区间：8—12 元/股
14.27 元相对区间：高于上沿 18.9%，高于中枢 42.7%，高于下沿 78.4%
```

### Task 2: 生成完整资金面 HTML

- [ ] **Step 1: 写入报告**

使用资金面模板的全部章节和顺序：

```text
1. 核心结论与行动
2. 数据审计
3. 资金来源全景
4. F3/F5/F7 日频面板
5. 价格、广度与筹码交叉验证
6. 资金分歧与传导链
7. 支持证据、反证与缺口
8. 行动与仓位映射
9. 下一验证点与失效条件
10. 来源与使用边界
```

- [ ] **Step 2: 检查模板完整性**

Run:

```powershell
$p='sources\automations\新兴产业\商业航天\2026-07-21-航天电子资金面分析.html'
1..10 | ForEach-Object { if (-not (Select-String -LiteralPath $p -Pattern ">$_\. " -Quiet)) { throw "missing section $_" } }
```

Expected: exit 0，无输出。

### Task 3: 在原研报加入每日跟踪区

- [ ] **Step 1: 写入样式和动态区**

动态区必须包含以下稳定边界和语义字段：

```html
<!-- DAILY_TRACKING_START -->
<section class="daily-tracking" id="daily-tracking" data-updated-at="2026-07-21T10:24:00+08:00">
  <div data-tracking-key="fundamental-status">基本面状态</div>
  <div data-tracking-key="dynamic-value-range">动态价值区间</div>
  <div data-tracking-key="price-deviation">股价偏离度</div>
</section>
<!-- DAILY_TRACKING_END -->
```

- [ ] **Step 2: 验证没有破坏原报告结构**

Run:

```powershell
$p='sources\automations\新兴产业\商业航天\2026-07-17-航天电子机构级决策研报.html'
if ((Select-String -LiteralPath $p -Pattern 'DAILY_TRACKING_START').Count -ne 1) { throw 'start marker' }
if ((Select-String -LiteralPath $p -Pattern 'DAILY_TRACKING_END').Count -ne 1) { throw 'end marker' }
if ((Select-String -LiteralPath $p -Pattern '<h2 id="section-' -AllMatches).Matches.Count -ne 16) { throw 'section count' }
```

Expected: exit 0，无输出。

### Task 4: 更新日志并重建大盘

- [ ] **Step 1: 追加维护日志**

在 `log.md` 追加 2026-07-21 记录，列出新报告、原研报动态区和数据缺口。

- [ ] **Step 2: 重建大盘**

Run:

```powershell
Set-Location 'tools\a-share-market-dashboard'
& 'C:\Users\lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' scripts\build.mjs
```

Expected: 构建成功，输出报告数量且无异常。

- [ ] **Step 3: 检查新报告被收录**

Run:

```powershell
Select-String -LiteralPath 'tools\a-share-market-dashboard\a-share-market-dashboard.html' -SimpleMatch '2026-07-21-航天电子资金面分析.html'
```

Expected: 至少一个匹配。

### Task 5: 最终质量验证

- [ ] **Step 1: 运行字符、链接和结构检查**

检查两个 HTML 的 UTF-8、`�` 与典型乱码、相对链接目标、资金模板 10 章、原研报 16 章和三层字段。

- [ ] **Step 2: 检查任务范围**

Run:

```powershell
git status --short
git diff --check
```

Expected: 只出现本任务文件、构建产物，以及执行前已存在的无关删除；不修改该无关删除。

## 自检

- 设计中的三层动态区、独立资金报告、数据滞后边界和不自动联网要求均有对应任务。
- 无待定占位符或未定义字段。
- 资金状态与价值区间分开计算，未把 F3/F5/F7 机械求和。
