# Bi Shu Xi Feng Way Out Ingest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ingest the user-provided article `这辈子还能有出路么？` into the Obsidian knowledge base as one cleaned raw archive plus one linked `view` page.

**Architecture:** Keep the article appendix and comment thread out of the formal raw archive, then extract one stable thesis for the `view` layer. Update the existing `people` and `topic` pages so the new material enters the current Bi Shu Xi Feng learning chain instead of creating a new concept or topic prematurely.

**Tech Stack:** Obsidian Markdown, YAML frontmatter, wikilinks, PowerShell, Python, apply_patch

---

### Task 1: Create The Clean Raw Archive

**Files:**
- Create: `E:\caojingwen\obsidian\obsidian_kb\raw\articles\2026-04-23-ren-jian-luo-pan-can-this-life-still-have-a-way-out.md`
- Reference: `E:\caojingwen\obsidian\碧树西风付费文.md`

- [ ] **Step 1: Confirm the cutoff points in the source file**

Run:

```powershell
python -X utf8 -c "from pathlib import Path; t=Path(r'E:/caojingwen/obsidian/碧树西风付费文.md').read_text(encoding='utf-8'); print(t.find('文末，因为满级读者')); print(t.find('留言 49'))"
```

Expected: both markers exist, and the appendix marker appears before the comment marker.

- [ ] **Step 2: Write the raw archive with cleaned metadata and正文**

Create a raw article page that:

- records the title as `这辈子还能有出路么？`
- records the account as `人间罗盘`
- marks the publish date as `2026-04-23` with wording that this is inferred from the material timing
- notes that the source is a user-provided Markdown file without an original URL
- includes only the正文 up to the appendix marker, excluding the paid-article directory and comments

- [ ] **Step 3: Verify the raw archive content**

Run:

```powershell
python -X utf8 -c "from pathlib import Path; p=Path(r'E:/caojingwen/obsidian/obsidian_kb/raw/articles/2026-04-23-ren-jian-luo-pan-can-this-life-still-have-a-way-out.md'); t=p.read_text(encoding='utf-8'); print('留言 49' in t); print('文末，因为满级读者' in t); print(t[:800])"
```

Expected: both appendix/comment markers are absent from the new archive, and the page starts with metadata plus article正文.

### Task 2: Create The View Page

**Files:**
- Create: `E:\caojingwen\obsidian\obsidian_kb\views\bi-shu-xi-feng-a-way-out-comes-from-demand-optionality-and-cashflow-2026-04-23.md`
- Reference: `E:\caojingwen\obsidian\obsidian_kb\raw\articles\2026-04-23-ren-jian-luo-pan-can-this-life-still-have-a-way-out.md`
- Reference: `E:\caojingwen\obsidian\obsidian_kb\people\bi-shu-xi-feng.md`
- Reference: `E:\caojingwen\obsidian\obsidian_kb\topics\probabilistic-decision-and-risk-control.md`
- Reference: `E:\caojingwen\obsidian\obsidian_kb\topics\information-high-ground-and-nonstandard-path.md`

- [ ] **Step 1: Write the `view` frontmatter**

Use:

- `type: "view"`
- one `person` link to `[[people/bi-shu-xi-feng]]`
- two `topic_refs`: `[[topics/probabilistic-decision-and-risk-control]]` and `[[topics/information-high-ground-and-nonstandard-path]]`
- a summary and stance that center on demand, optionality, and cashflow instead of sunk cost

- [ ] **Step 2: Write the `view` body**

Capture four idea blocks:

- stop selling sunk cost and start describing solved demand
- earning models depend on ability, demand, and leverage together
- choices should widen future paths instead of narrowing them
- cashflow and time management are the practical rear base of the whole life system

- [ ] **Step 3: Verify the new `view` links**

Run:

```powershell
python -X utf8 -c "from pathlib import Path; t=Path(r'E:/caojingwen/obsidian/obsidian_kb/views/bi-shu-xi-feng-a-way-out-comes-from-demand-optionality-and-cashflow-2026-04-23.md').read_text(encoding='utf-8'); print('[[people/bi-shu-xi-feng]]' in t); print('[[topics/probabilistic-decision-and-risk-control]]' in t); print('[[topics/information-high-ground-and-nonstandard-path]]' in t)"
```

Expected: all three checks print `True`.

### Task 3: Wire The New Material Into Existing Pages

**Files:**
- Modify: `E:\caojingwen\obsidian\obsidian_kb\people\bi-shu-xi-feng.md`
- Modify: `E:\caojingwen\obsidian\obsidian_kb\topics\probabilistic-decision-and-risk-control.md`
- Modify: `E:\caojingwen\obsidian\obsidian_kb\topics\information-high-ground-and-nonstandard-path.md`
- Modify: `E:\caojingwen\obsidian\obsidian_kb\index.md`
- Modify: `E:\caojingwen\obsidian\obsidian_kb\log.md`

- [ ] **Step 1: Update the person page**

Add the new raw source, add the new `view` to `related`, add one representative-view bullet, and add one evolution bullet for the 2026-04-23 article. Update `updated:` to `2026-04-24`.

- [ ] **Step 2: Update the two topic pages**

For both topic pages:

- add the new raw source
- add the new `view` to related sections
- add one short paragraph or bullet that explains why this article belongs on that topic
- update `updated:` to `2026-04-24`

- [ ] **Step 3: Update index and log**

Add the new `view` entry to the index, increase `页面总数` from `84` to `85`, and append one `2026-04-24` ingest log entry describing the raw archive, new `view`, and page updates.

### Task 4: Run A Consistency Check

**Files:**
- Reference: `E:\caojingwen\obsidian\obsidian_kb\index.md`
- Reference: `E:\caojingwen\obsidian\obsidian_kb\people\bi-shu-xi-feng.md`
- Reference: `E:\caojingwen\obsidian\obsidian_kb\topics\probabilistic-decision-and-risk-control.md`
- Reference: `E:\caojingwen\obsidian\obsidian_kb\topics\information-high-ground-and-nonstandard-path.md`
- Reference: `E:\caojingwen\obsidian\obsidian_kb\views\bi-shu-xi-feng-a-way-out-comes-from-demand-optionality-and-cashflow-2026-04-23.md`

- [ ] **Step 1: Check every target page mentions the new `view` or raw file where expected**

Run:

```powershell
rg -n "a-way-out-comes-from-demand-optionality-and-cashflow|can-this-life-still-have-a-way-out" "E:/caojingwen/obsidian/obsidian_kb"
```

Expected: matches appear in the raw archive, new `view`, both topic pages, the person page, the index, and the log.

- [ ] **Step 2: Check the index count and key page headers**

Run:

```powershell
python -X utf8 -c "from pathlib import Path; files=[r'E:/caojingwen/obsidian/obsidian_kb/index.md', r'E:/caojingwen/obsidian/obsidian_kb/people/bi-shu-xi-feng.md', r'E:/caojingwen/obsidian/obsidian_kb/topics/probabilistic-decision-and-risk-control.md', r'E:/caojingwen/obsidian/obsidian_kb/topics/information-high-ground-and-nonstandard-path.md'];\nfor f in files:\n t=Path(f).read_text(encoding='utf-8');\n print(Path(f).name); print(t[:300]); print('---')"
```

Expected: the index header shows `页面总数：85`, and the edited pages all show `updated: 2026-04-24`.
