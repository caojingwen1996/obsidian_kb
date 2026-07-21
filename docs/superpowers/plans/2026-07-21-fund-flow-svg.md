# Fund Flow SVG Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a complete, editable Mermaid source and a rendered SVG for the eight-step fund-flow analysis workflow.

**Architecture:** Use one vertical Mermaid flowchart as the source of truth. The chart follows the approved audit-funnel layout, merges the two evidence branches before validation, then separates new-cash and existing-position actions. Render with the project-installed pretty-mermaid tool and verify both structure and Chinese text.

**Tech Stack:** Mermaid flowchart syntax, beautiful-mermaid renderer, SVG, PowerShell verification.

---

### Task 1: Create the editable workflow source

**Files:**
- Create: `.agents/skills/fund-flow-analysis/assets/资金面分析完整流程.mmd`

- [ ] **Step 1: Write the vertical audit-funnel flowchart**

Create a `flowchart TD` diagram with these exact semantic stages: input contract; ① data audit; parallel ② fund-source panorama plus ③ inflow mechanism and ④ F3/F5/F7 panel; ⑤ supply and exit path; ⑥ cross-validation; ⑦ one of six capital states; ⑧ separate new-cash and existing-position actions; next verification point and invalidation loop.

- [ ] **Step 2: Encode evidence boundaries in the nodes**

The F3/F5/F7 node must say they are proxies, may overlap, and must not be mechanically summed. The fund-source node must include the nine applicable source/supply categories. The action nodes must use only `buy / sell / reduce / wait / observe / review`.

- [ ] **Step 3: Check source completeness**

Run:

```powershell
rg -n "①|②|③|④|⑤|⑥|⑦|⑧|F3|F5|F7|共振流入|共振流出|buy|sell|review" ".agents/skills/fund-flow-analysis/assets/资金面分析完整流程.mmd"
```

Expected: all eight step numbers, the three daily indicators, the state vocabulary, and action vocabulary are present.

### Task 2: Render the SVG

**Files:**
- Create: `.agents/skills/fund-flow-analysis/assets/资金面分析完整流程.svg`

- [ ] **Step 1: Render with the light documentation theme**

Run:

```powershell
& "C:/Users/lenovo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe" "D:/Users/lenovo/.codex/skills/pretty-mermaid/scripts/render.mjs" --input ".agents/skills/fund-flow-analysis/assets/资金面分析完整流程.mmd" --output ".agents/skills/fund-flow-analysis/assets/资金面分析完整流程.svg" --format svg --theme github-light --font "Microsoft YaHei"
```

Expected: exit code 0 and a non-empty SVG file.

- [ ] **Step 2: Inspect the rendered image**

Open the SVG as an image and verify the vertical reading order, branch merge, final action split, Chinese glyphs, and absence of overlapping labels.

- [ ] **Step 3: Iterate only if visual defects are found**

Adjust node wording, line breaks, spacing, or class styles in the Mermaid source, rerender with the same command, and repeat visual inspection.

### Task 3: Verify and record the artifact

**Files:**
- Modify: `log.md`

- [ ] **Step 1: Validate SVG structure and encoding**

Run:

```powershell
$svg = Get-Content -LiteralPath ".agents/skills/fund-flow-analysis/assets/资金面分析完整流程.svg" -Raw -Encoding UTF8
if ($svg -notmatch '<svg' -or $svg -notmatch 'viewBox=' -or $svg -notmatch '资金面分析') { throw 'SVG structure or title missing' }
if ($svg -match '鍐|鐭|鎯|灏|�') { throw 'Possible mojibake detected' }
```

Expected: no exception.

- [ ] **Step 2: Append a scoped maintenance record**

Append a `2026-07-21` `visualize / fund-flow` entry to `log.md` listing the Mermaid source and SVG. State that the chart is framework documentation rather than a current-market conclusion.

- [ ] **Step 3: Run final scoped checks**

Run:

```powershell
git diff --check -- ".agents/skills/fund-flow-analysis/assets/资金面分析完整流程.mmd" ".agents/skills/fund-flow-analysis/assets/资金面分析完整流程.svg" "log.md"
git status --short -- ".agents/skills/fund-flow-analysis/assets/资金面分析完整流程.mmd" ".agents/skills/fund-flow-analysis/assets/资金面分析完整流程.svg" "log.md"
```

Expected: no whitespace errors; only the two assets and the pre-existing-plus-current `log.md` modification appear in the scoped status.
