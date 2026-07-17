# BBXM 个股研报 HTML 导出实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将航天电子研报升级为当前模板的完整 16 模块，并把电科蓝天版式固化为 `bbxm-equity-research` 的可测试 HTML 导出能力。

**Architecture:** Markdown 是唯一研究正文，渲染脚本解析 frontmatter、一级标题、决策摘要和 16 个二级标题，再套用固定 HTML/CSS 模板。测试用 UTF-8 中文夹具验证结构、乱码、目录锚点与 Obsidian 双链转换；两份现有研报用同一脚本生成 HTML。

**Tech Stack:** Node.js CommonJS、`marked`、HTML5、CSS、PowerShell 校验、Markdown。

---

## 文件结构

- 新建 `.agents/skills/bbxm-equity-research/scripts/render-report-html.cjs`：命令行入口、Markdown 解析、字段抽取、双链转换和 HTML 生成。
- 新建 `.agents/skills/bbxm-equity-research/scripts/test-render-report-html.cjs`：UTF-8、16 模块、目录和链接回归测试。
- 新建 `.agents/skills/bbxm-equity-research/assets/report.css`：电科蓝天版式的唯一样式源。
- 修改 `.agents/skills/bbxm-equity-research/SKILL.md`：增加默认 HTML 必交付步骤和质量门。
- 修改 `.agents/skills/bbxm-equity-research/agents/openai.yaml`：默认提示明确交付 Markdown 与 HTML。
- 修改 `wiki/queries/2026-07-15-1433-航天电子机构级决策研报.md`：按模板重排为完整 16 模块。
- 生成 `sources/automations/商业航天每日跟踪/2026-07-17-航天电子机构级决策研报.html`。
- 重新生成 `sources/automations/商业航天每日跟踪/2026-07-17-电科蓝天机构级决策研报.html`。
- 修改 `log.md`：记录技能、研报和 HTML 维护动作。

### Task 1：建立 HTML 导出回归测试

**Files:**
- Create: `.agents/skills/bbxm-equity-research/scripts/test-render-report-html.cjs`

- [ ] **Step 1: 写入失败测试**

测试创建含中文、`12—24`、Obsidian 双链和完整 16 个 `##` 模块的临时 Markdown，调用尚不存在的渲染器，并断言：

```js
assert.match(html, /高估 · wait \/ observe/);
assert.match(html, /12—24/);
assert.equal((html.match(/<a class="toc-link"/g) || []).length, 16);
assert.doesNotMatch(html, /\[\[/);
assert.doesNotMatch(html, /�|12\?24|\?\?/);
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node .agents/skills/bbxm-equity-research/scripts/test-render-report-html.cjs`

Expected: 非零退出，原因是 `render-report-html.cjs` 尚不存在。

### Task 2：实现统一渲染器与版式

**Files:**
- Create: `.agents/skills/bbxm-equity-research/scripts/render-report-html.cjs`
- Create: `.agents/skills/bbxm-equity-research/assets/report.css`

- [ ] **Step 1: 实现最小渲染器**

命令行接口固定为：

```text
node render-report-html.cjs --input <report.md> --output <report.html> --vault-root <vault>
```

实现以下确定性转换：读取 UTF-8；剥离 YAML；解析标题和决策摘要表；把 16 个二级标题映射为稳定锚点；将 `[[path|label]]` 转为相对 HTML 链接；用 `marked` 渲染正文；嵌入 `report.css`；写出 UTF-8 HTML。

- [ ] **Step 2: 固化电科蓝天视觉结构**

CSS 必须包含渐变封面、判断徽章、四列 KPI 卡、左侧吸顶目录、右侧正文、响应式断点和打印样式；不加入交互框架或外部资源。

- [ ] **Step 3: 运行测试确认通过**

Run: `node .agents/skills/bbxm-equity-research/scripts/test-render-report-html.cjs`

Expected: 输出 `PASS: report HTML renderer`，退出码 0。

### Task 3：把 HTML 导出写入技能契约

**Files:**
- Modify: `.agents/skills/bbxm-equity-research/SKILL.md`
- Modify: `.agents/skills/bbxm-equity-research/agents/openai.yaml`

- [ ] **Step 1: 增加 Step 9**

在落盘之后增加“生成并验证 HTML”：默认与 Markdown 同名；调用统一脚本；HTML 失败则整体未完成；用户明确只要 Markdown 时才可跳过。

- [ ] **Step 2: 扩充质量门**

加入 16 模块名称/顺序、目录锚点、UTF-8、关键字段、Obsidian 双链转换、Markdown/HTML 同源等检查项。

- [ ] **Step 3: 更新默认提示**

将默认提示改为生成 decision-ready Markdown report and matching HTML version，不改变隐式调用策略。

### Task 4：重排航天电子完整研报

**Files:**
- Modify: `wiki/queries/2026-07-15-1433-航天电子机构级决策研报.md`

- [ ] **Step 1: 按模板重排 16 模块**

保留已有行情、五年财务、分部、估值、催化剂、产业位置和来源冲突；将缺失数据明确放入第 14 模块；新增完整的第 11 模块三要素与风险方向，其中风险方向因缺少可比窗口数据写“证据不足”。

- [ ] **Step 2: 校验模块名称与顺序**

Run: PowerShell 提取报告和模板中匹配 `^## \d+\.` 的标题并逐项比较。

Expected: 两组各 16 项且文本完全一致。

### Task 5：生成并验证两份 HTML

**Files:**
- Modify: `sources/automations/商业航天每日跟踪/2026-07-17-航天电子机构级决策研报.html`
- Modify: `sources/automations/商业航天每日跟踪/2026-07-17-电科蓝天机构级决策研报.html`
- Modify: `log.md`

- [ ] **Step 1: 用同一渲染器生成两份 HTML**

Run: 对航天电子和电科蓝天 Markdown 分别执行 `render-report-html.cjs`，输出到现有 HTML 路径。

- [ ] **Step 2: 执行结构与编码验收**

检查两份 HTML 均有 16 个目录项，不含 `??`、`12?24`、`�`、`[[`，且标题、价格、估值区间和动作与对应 Markdown 一致。

- [ ] **Step 3: 记录维护日志**

在 `log.md` 追加 2026-07-17 maintenance 记录，列明技能、研报、两份 HTML 和设计文档。

- [ ] **Step 4: 检查任务范围差异**

Run: `git diff --check` 与任务文件定向 `git diff --stat`。

Expected: 无空白错误；无无关文件被本任务修改。
