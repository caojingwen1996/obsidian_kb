#!/usr/bin/env python3
"""Prepare evidence for the skill's Agent, then validate and publish its Timeline plan.

No model calls or network access: semantic reading belongs to the invoking Agent.
All durable intermediate records live in the capture task's processing directory.
"""
from __future__ import annotations

import argparse
from contextlib import contextmanager
from datetime import datetime
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import tempfile
from typing import Any
from zoneinfo import ZoneInfo

try:
    from .utils import DEFAULT_EXTEND_FILE, read_preferred_output_root
except ImportError:
    from utils import DEFAULT_EXTEND_FILE, read_preferred_output_root

VERSION = "1"
LOCAL_HEADINGS = [
    "导读：阅读问题与知识脉络", "1. 页面定位", "2. 核心问题", "3. 判断演化表",
    "4. 关键转折点", "5. 阶段总览", "6. 事实、观点、推断分离",
    "7. 后续验证点", "8. 不确定性", "9. 来源",
]


def digest(data: str | bytes) -> str:
    return hashlib.sha256(data.encode("utf-8") if isinstance(data, str) else data).hexdigest()


def today() -> str:
    return datetime.now(ZoneInfo("Asia/Shanghai")).date().isoformat()


def read_json(path: Path, default=None):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default


def atomic(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as f:
        f.write(text)
        temp = Path(f.name)
    try:
        temp.replace(path)
    finally:
        temp.unlink(missing_ok=True)


def save_json(path: Path, value) -> None:
    atomic(path, json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def inside(root: Path, value: str | Path) -> Path:
    path = (root / value).resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError(f"路径越界: {value}")
    return path


def config(extend_file: Path = DEFAULT_EXTEND_FILE) -> dict:
    extend_file = extend_file.resolve()
    text = extend_file.read_text(encoding="utf-8")
    blocks = re.findall(r"```json timeline-postprocess\s*\n(.*?)\n```", text, re.S)
    if len(blocks) != 1:
        raise ValueError("EXTEND.md 必须有一个 json timeline-postprocess 配置块")
    cfg = json.loads(blocks[0])
    cfg["vault"] = (extend_file.parent / cfg["vault_root"]).resolve()
    cfg["extend_file"] = str(extend_file)
    cfg["capture_root"] = Path(read_preferred_output_root(extend_file)).expanduser().resolve()
    if cfg["min_dates"] < 3:
        raise ValueError("自动建页至少需要三个不同日期")
    for profile in cfg["profiles"].values():
        for key in ("sources", "timelines", "index"):
            inside(cfg["vault"], profile[key])
        if not inside(cfg["vault"], profile["sources"]).is_relative_to(cfg["vault"] / "sources"):
            raise ValueError("原文归档目录必须位于 sources")
        if not inside(cfg["vault"], profile["index"]).is_file():
            raise ValueError("知识库索引不存在")
    return cfg


def route(cfg: dict, account: str, title: str, selected: str | None) -> str | None:
    if selected:
        if selected not in cfg["profiles"]:
            raise ValueError(f"未知知识库: {selected}")
        return selected
    matches = {
        rule["profile"] for rule in cfg["routes"]
        if account.rstrip("/") in rule["accounts"]
        and (not rule.get("title_contains") or rule["title_contains"] in title)
    }
    return next(iter(matches)) if len(matches) == 1 else None


def metadata(path: Path, item: dict) -> dict:
    text = path.read_text(encoding="utf-8-sig")
    def field(label):
        found = re.search(rf"^(?:-\s*)?{label}[:：]\s*(.+)$", text, re.M)
        return found[1] if found else ""
    return {
        "title": item.get("title") or field("标题") or path.stem,
        "published_at": item.get("published_at") or field("发布时间"),
        "url": item.get("url") or field("原始链接"),
        "publisher": field("作者名称") or item.get("author_name", ""),
        "platform": item.get("platform") or field("平台"),
    }


def workdir(result_dir: Path) -> Path:
    return result_dir.resolve() / "processing" / "timeline"


def prepare(
    result_dir: Path, extend_file: Path = DEFAULT_EXTEND_FILE, *,
    profile: str | None = None, sources: list[Path] | None = None,
    capture_only: bool = False,
) -> dict:
    result_dir = result_dir.resolve()
    work = workdir(result_dir)
    if capture_only:
        return {"status": "skipped", "reason": "用户要求只抓取"}
    cfg = config(extend_file)
    if not cfg["enabled"]:
        return {"status": "skipped", "reason": "后处理已关闭"}
    state = read_json(result_dir / "state.json", {})
    account = state.get("account_url") or state.get("account", "")
    items = list(state.get("processed_items", {}).values())
    if sources:
        if not profile:
            raise ValueError("补充本地历史资料须明确 --profile")
        items.extend({"file_path": str(p.resolve())} for p in sources)
    old = read_json(work / "manifest.json", {"sources": {}})
    manifest = {
        "version": VERSION, "result_dir": str(result_dir),
        "extend_file": str(Path(extend_file).resolve()), "sources": {
            key: source for key, source in old["sources"].items()
            if source["profile"] in cfg["profiles"]
            and route(cfg, account, source["title"], profile) == source["profile"]
        },
        "profiles": {}, "blocked": [], "history_states": [],
    }
    for item in items:
        path = Path(item["file_path"]).resolve()
        if not path.is_file():
            manifest["blocked"].append({"path": str(path), "reason": "原文文件缺失"})
            continue
        info = metadata(path, item)
        chosen = route(cfg, account, info["title"], profile)
        if not chosen:
            manifest["blocked"].append({"path": str(path), "reason": "知识库归属未知"})
            continue
        source_root = inside(cfg["vault"], cfg["profiles"][chosen]["sources"])
        raw = path.read_bytes()
        if path.is_relative_to(source_root):
            archived = path
        else:
            # Immutable version paths: neither a rerun nor a revision overwrites raw text.
            name = re.sub(r'[<>:"/\\|?*\[\]#\n\r]+', "_", path.stem)[:90]
            archived = source_root / "captures" / f"{name}-{digest(raw)[:12]}{path.suffix}"
            if not archived.exists():
                archived.parent.mkdir(parents=True, exist_ok=True)
                with archived.open("xb") as f:
                    f.write(raw)
            elif archived.read_bytes() != raw:
                raise ValueError("来源版本文件冲突")
        relative = archived.relative_to(cfg["vault"]).as_posix()
        source_id = digest(chosen + "\n" + relative + "\n" + digest(raw))[:24]
        manifest["sources"][source_id] = {
            **info, "profile": chosen, "path": relative, "sha256": digest(raw),
            "origin": str(path), "completeness": "unreviewed",
        }
    # Cross-date candidates and per-target receipts survive same-day and historical reruns.
    roots = {cfg["capture_root"], Path(state.get("output_root", result_dir)).resolve()}
    for root in roots:
        if root.exists():
            for previous in root.rglob("timeline-state.json"):
                if previous.parent.name == "timeline" and previous.parent.parent.name == "processing":
                    manifest["history_states"].append(str(previous.resolve()))
    manifest["history_states"] = sorted(set(manifest["history_states"] + [str(work / "timeline-state.json")]))
    chosen_profiles = {s["profile"] for s in manifest["sources"].values()}
    for key in chosen_profiles:
        p = cfg["profiles"][key]
        pages = {}
        for page in inside(cfg["vault"], p["timelines"]).glob("*.md"):
            content = page.read_text(encoding="utf-8-sig")
            pages[page.relative_to(cfg["vault"]).as_posix()] = {
                "sha256": digest(page.read_bytes()), "headings": re.findall(r"^## (.+)$", content, re.M),
            }
        manifest["profiles"][key] = {
            "pages": pages,
            "history_sources": [
                f.relative_to(cfg["vault"]).as_posix()
                for f in inside(cfg["vault"], p["sources"]).rglob("*")
                if f.is_file() and f.suffix in (".md", ".txt")
                and "processing" not in f.parts and f.name not in ("summary.md", "daily_brief.md")
            ],
        }
    save_json(work / "manifest.json", manifest)
    return {
        "status": "pending" if manifest["sources"] else "blocked",
        "manifest": str(work / "manifest.json"), "sources": len(manifest["sources"]),
        "blocked": manifest["blocked"],
        "next": "Agent 阅读原文与历史状态，按 references/timeline-processing.md 生成 plan.json，再运行 apply；不得止于准备。",
    }


def capture_hook(result_dir: Path, *, extend_file=DEFAULT_EXTEND_FILE, profile=None, capture_only=False) -> dict:
    """Saving raw text succeeds independently of postprocessing preparation."""
    try:
        result = prepare(result_dir, Path(extend_file), profile=profile, capture_only=capture_only)
    except (OSError, ValueError, KeyError, TypeError) as error:
        result = {"status": "failed", "reason": str(error)}
    save_json(workdir(result_dir) / "capture-hook.json", result)
    return result


def check_tables(vault: Path, text: str) -> None:
    path = vault / "rules/check_markdown_tables.py"
    spec = importlib.util.spec_from_file_location("wiki_table_check", path)
    if spec is None or spec.loader is None:
        raise ValueError("表格检查器不可用")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    errors = module.check(text)
    if errors:
        raise ValueError(f"表格检查失败: {errors}")


def frontmatter(text: str) -> tuple[dict, str]:
    import yaml
    match = re.match(r"\A---\n(.*?)\n---\n(.*)\Z", text, re.S)
    if not match:
        raise ValueError("缺少 frontmatter")
    try:
        data = yaml.safe_load(match[1])
    except yaml.YAMLError as error:
        raise ValueError(f"frontmatter 无效: {error}") from error
    if not isinstance(data, dict):
        raise ValueError("frontmatter 必须是对象")
    return data, match[2]


def links(vault: Path, page: Path, text: str, candidate: str) -> None:
    for raw in re.findall(r"!?\[\[([^\]\n]+)\]\]", text):
        target = raw.replace(r"\|", "|").split("|", 1)[0]
        file, _, anchor = target.partition("#")
        if file:
            target_path = inside(vault, file)
            if not target_path.suffix:
                target_path = target_path.with_suffix(".md")
            if not target_path.exists() and target_path != page:
                library = page.relative_to(vault).parts[0]
                relative_target = inside(vault, f"{library}/{file}")
                if not relative_target.suffix:
                    relative_target = relative_target.with_suffix(".md")
                if relative_target.is_file():
                    found = [relative_target]
                else:
                    found = list(vault.glob(f"wiki*/**/{target_path.name}")) if "/" not in file else []
                if len(found) != 1:
                    raise ValueError(f"双链目标不存在或不唯一: {target}")
                target_path = found[0]
        else:
            target_path = page
        if anchor:
            content = candidate if target_path == page else target_path.read_text(encoding="utf-8-sig")
            headings = re.findall(r"^#{1,6}\s+(.+?)\s*$", content, re.M)
            if anchor not in headings:
                raise ValueError(f"章节不存在: {target}")


def validate_page(cfg: dict, profile: dict, page: Path, text: str, old: str | None) -> None:
    data, body = frontmatter(text)
    if data.get("type") != "timeline" or not data.get("title") or not data.get("summary"):
        raise ValueError("必须是有 title 和 summary 的 timeline")
    if "\ufffd" in text or any(0xE000 <= ord(c) <= 0xF8FF for c in text):
        raise ValueError("页面含乱码替换符或私用区字符")
    actual = re.findall(r"^## (.+)$", body, re.M)
    if old is None:
        if any(k in data for k in ("source", "sources")):
            raise ValueError("新建页禁止 source/sources 属性")
        if str(data.get("created")) != today() or str(data.get("updated")) != today():
            raise ValueError("新页 created/updated 必须为本次创建日期")
        if not str(data["title"]).startswith(profile.get("title_prefix", "")):
            raise ValueError("标题不符合本库命名要求")
        if page.stem != data["title"]:
            raise ValueError("文件名与 title 不一致")
        expected = LOCAL_HEADINGS if profile["structure"] == "laomujiang" else re.findall(
            r"^## (.+)$", inside(cfg["vault"], profile["template"]).read_text(encoding="utf-8"), re.M)
        if actual != expected:
            raise ValueError("新页章节不符合所属知识库结构")
    else:
        before, old_body = frontmatter(old)
        if actual != re.findall(r"^## (.+)$", old_body, re.M):
            raise ValueError("不得改变已有页面章节")
        for key, value in before.items():
            if key not in ("updated", "period_end") and data.get(key) != value:
                raise ValueError(f"不允许自动改写已有属性: {key}")
        # Existing prose is conservatively protected, including manual notes.
        remaining = iter(body.splitlines())
        for line in old_body.splitlines():
            if line.strip() and not any(candidate == line for candidate in remaining):
                raise ValueError("已有正文被删除或改写；请改为增量插入并保留人工内容")
    check_tables(cfg["vault"], text)
    links(cfg["vault"], page, body, text)


@contextmanager
def write_lock(vault: Path):
    lock = vault / ".timeline-postprocess.lock"
    try:
        fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError as exc:
        raise ValueError("另一个整理任务持有写锁；稍后重试，不覆盖锁文件") from exc
    try:
        os.write(fd, str(os.getpid()).encode())
        os.close(fd)
        yield
    finally:
        lock.unlink(missing_ok=True)


def update_navigation(cfg: dict, profile: dict, target: str, title: str, operation: str) -> None:
    index = inside(cfg["vault"], profile["index"])
    old = index.read_text(encoding="utf-8")
    text = old
    if f"[[{target.removesuffix('.md')}|" not in text and f"[[{target.removesuffix('.md')}]]" not in text:
        heading = profile["index_heading"]
        line = f"- [[{target.removesuffix('.md')}|{title}]]：自动整理的判断演化与原文阅读入口。\n"
        text = text.replace(heading + "\n", heading + "\n\n" + line, 1) if heading in text.splitlines() else text + "\n" + heading + "\n\n" + line
    count = len(list(inside(cfg["vault"], profile["timelines"]).glob("*.md")))
    if profile["index"] == "index.md":
        total = len(list((cfg["vault"] / "wiki").rglob("*.md")))
        text = re.sub(r"页面总数：\d+", f"页面总数：{total}", text)
    else:
        text = re.sub(r"\d+( 条(?:判断演化时间线|时间线页))", lambda m: str(count) + m[1], text)
    text = re.sub(r"(?m)^updated: \d{4}-\d{2}-\d{2}$", f"updated: {today()}", text)
    check_tables(cfg["vault"], text)
    if index.read_text(encoding="utf-8") != old:
        raise ValueError("索引已被其他任务修改，待重试")
    atomic(index, text)
    log = cfg["vault"] / "log.md"
    log_text = log.read_text(encoding="utf-8") if log.exists() else ""
    marker = f"<!-- timeline-operation:{operation} -->"
    if marker not in log_text:
        atomic(log, log_text + f"\n## {today()} · 抓取后 Timeline 整理\n\n{marker}\n"
               f"- 页面：[[{target.removesuffix('.md')}|{title}]]。\n"
               "- 已核对原文定位、页面结构和表格；作者观点不等于已独立核验事实。\n")


def verify_nodes(cfg: dict, manifest: dict, theme: dict) -> list[dict]:
    result = []
    for node in theme.get("nodes", []):
        source = manifest["sources"][node["source"]]
        if source["profile"] != theme["profile"]:
            raise ValueError("证据跨知识库")
        path = inside(cfg["vault"], source["path"])
        raw = path.read_bytes()
        if digest(raw) != source["sha256"]:
            raise ValueError("来源已变化，重新 prepare")
        text = raw.decode("utf-8-sig")
        if not node.get("quote") or node["quote"] not in text:
            raise ValueError("证据摘录不在原文中")
        for key in ("judgment", "subject", "author", "source_role", "kind", "coverage"):
            if not node.get(key):
                raise ValueError(f"判断缺少 {key}")
        if node.get("completeness") not in ("complete", "partial"):
            raise ValueError("未核对正文完整性")
        if node["completeness"] == "partial" and not node.get("limitations"):
            raise ValueError("部分覆盖必须记录局限")
        date = node["date"]
        datetime.strptime(date, "%Y-%m-%d")
        if node.get("date_basis") == "published":
            if not source["published_at"].startswith(date):
                raise ValueError("发布时间与节点日期不符")
        elif node.get("date_basis") == "retrospective":
            if not node.get("date_quote") or node["date_quote"] not in text or date not in node["date_quote"]:
                raise ValueError("回溯节点须提供含 ISO 日期的原文日期摘录")
        else:
            raise ValueError("必须区分发表日期和回溯日期")
        result.append({**node, "source_info": source})
    return result


def apply_plan(manifest_path: Path, plan_path: Path) -> dict:
    manifest_path = manifest_path.resolve()
    work = manifest_path.parent
    manifest = read_json(manifest_path)
    cfg = config(Path(manifest["extend_file"]))
    if not cfg["enabled"]:
        raise ValueError("后处理已关闭")
    plan = read_json(plan_path)
    local_path = work / "timeline-state.json"
    local = read_json(local_path, {"version": VERSION, "themes": {}, "receipts": {}})
    report = []
    with write_lock(cfg["vault"]):
        histories = [read_json(Path(p), {}) for p in manifest["history_states"]]
        for theme in plan["themes"]:
            key = theme.get("key", "")
            identity = theme["profile"] + ":" + key
            receipt = None
            operation = None
            try:
                if not re.fullmatch(r"[\w\u4e00-\u9fff-]{1,100}", key):
                    raise ValueError("主题 key 不合法")
                profile = cfg["profiles"][theme["profile"]]
                nodes = verify_nodes(cfg, manifest, theme)
                prior_nodes = []
                prior_targets = set()
                for state in histories + [local]:
                    previous = state.get("themes", {}).get(identity, {})
                    prior_nodes.extend(previous.get("nodes", []))
                    if previous.get("target"):
                        prior_targets.add(previous["target"])
                # Evidence versions are immutable; retain prior nodes for audit.
                merged = {digest(json.dumps(n, sort_keys=True, ensure_ascii=False)): n for n in prior_nodes + nodes}
                all_nodes = list(merged.values())
                local["themes"][identity] = {"nodes": all_nodes, "status": "candidate"}
                if len(prior_targets) == 1:
                    local["themes"][identity]["target"] = next(iter(prior_targets))
                action = theme["action"]
                if action in ("candidate", "incomplete", "no_change"):
                    if not theme.get("reason"):
                        raise ValueError("暂存或无需变更须说明原因")
                    local["themes"][identity].update(status=action, reason=theme["reason"])
                    if len(prior_targets) == 1:
                        local["themes"][identity]["target"] = next(iter(prior_targets))
                    report.append({"theme": identity, "status": action})
                    continue
                if action not in ("create", "update"):
                    raise ValueError("未知处理动作")
                if not nodes or not theme.get("comparison") or not theme.get("reason"):
                    raise ValueError("写入前必须提供原文节点、历史比较和理由")
                target = theme["target"]
                page = inside(cfg["vault"], target)
                if page.parent != inside(cfg["vault"], profile["timelines"]) or page.suffix != ".md":
                    raise ValueError("目标不在本库 timelines 目录")
                if re.search(r"[\[\]|#\r\n]", page.name):
                    raise ValueError("目标文件名含双链控制字符")
                if prior_targets and target not in prior_targets:
                    raise ValueError("该主题已有目标页，应更新而非重复建页")
                # Validate all carried-forward evidence as well as new evidence.
                for node in all_nodes:
                    info = node["source_info"]
                    if digest(inside(cfg["vault"], info["path"]).read_bytes()) != info["sha256"]:
                        raise ValueError("历史候选证据已变化")
                if action == "create":
                    dates = {n["date"] for n in all_nodes if n["completeness"] == "complete"}
                    if len(dates) < cfg["min_dates"]:
                        raise ValueError("不足三个完整、可追溯时间点；请保留候选")
                    if not cfg["auto_create"]:
                        raise ValueError("自动建页关闭")
                    if not theme.get("reading_questions") or not theme.get("knowledge_outline"):
                        raise ValueError("新主题缺少阅读问题和知识脉络")
                    expected_pages = manifest["profiles"][theme["profile"]]["pages"]
                    if set(theme.get("reviewed_pages", [])) != set(expected_pages):
                        raise ValueError("尚未完成已有主题查重")
                elif not cfg["update_existing"]:
                    raise ValueError("更新已有页关闭")
                draft_path = inside(work, theme["draft"])
                draft = draft_path.read_text(encoding="utf-8")
                operation = digest(json.dumps([VERSION, identity, target, draft], ensure_ascii=False))
                for state in histories + [local]:
                    receipt = state.get("receipts", {}).get(operation) or receipt
                if receipt and receipt["status"] == "prepared" and page.exists() and digest(page.read_bytes()) == receipt["page_hash"]:
                    receipt["status"] = "written"
                if receipt and receipt["status"] in ("written", "complete"):
                    if not page.exists() or digest(page.read_bytes()) != receipt["page_hash"]:
                        raise ValueError("已写入页面被修改，重新 prepare 并生成增量方案")
                    update_navigation(cfg, profile, target, receipt["title"], operation)
                    receipt["status"] = "complete"
                else:
                    current = page.read_bytes() if page.exists() else None
                    expected = theme.get("base_hash")
                    if (digest(current) if current is not None else None) != expected:
                        raise ValueError("页面版本冲突，重新 prepare")
                    if (action == "create") != (current is None):
                        raise ValueError("创建／更新动作与页面是否存在不符")
                    if action == "update":
                        snapshot = manifest["profiles"][theme["profile"]]["pages"].get(target)
                        if not snapshot or snapshot["sha256"] != expected:
                            raise ValueError("未读取目标页面快照")
                    validate_page(cfg, profile, page, draft, current.decode("utf-8-sig") if current else None)
                    references = {
                        raw.replace(r"\|", "|").split("|", 1)[0].split("#", 1)[0].removesuffix(".md")
                        for raw in re.findall(r"\[\[([^\]\n]+)\]\]", frontmatter(draft)[1])
                    }
                    for node in all_nodes:
                        source_path = node["source_info"]["path"]
                        reference = source_path.removesuffix(".md") if source_path.endswith(".md") else source_path
                        if reference not in references:
                            raise ValueError("页面没有保留某条证据的原文链接")
                    if action == "create":
                        title, _ = frontmatter(draft)
                        for other in page.parent.glob("*.md"):
                            other_data, _ = frontmatter(other.read_text(encoding="utf-8-sig"))
                            if other_data.get("title") == title["title"]:
                                raise ValueError("存在同名页面")
                    if current:
                        atomic(work / "snapshots" / f"{operation}.md", current.decode("utf-8-sig"))
                    receipt = {"status": "prepared", "page_hash": digest(draft), "title": frontmatter(draft)[0]["title"], "target": target}
                    local["receipts"][operation] = receipt
                    local["themes"][identity]["target"] = target
                    save_json(local_path, local)
                    if (digest(page.read_bytes()) if page.exists() else None) != expected:
                        raise ValueError("写入前页面发生变化")
                    atomic(page, draft)
                    check_tables(cfg["vault"], page.read_text(encoding="utf-8"))
                    receipt["status"] = "written"
                    save_json(local_path, local)
                    update_navigation(cfg, profile, target, receipt["title"], operation)
                    receipt["status"] = "complete"
                local["receipts"][operation] = receipt
                local["themes"][identity].update(status="complete", target=target)
                report.append({"theme": identity, "status": "complete", "target": target})
            except (OSError, ValueError, KeyError, TypeError) as error:
                status = "finalize_pending" if receipt and receipt.get("status") == "written" else "failed"
                if operation and receipt:
                    local["receipts"][operation] = receipt
                local.setdefault("themes", {}).setdefault(identity, {}).update(status=status, error=str(error))
                report.append({"theme": identity, "status": status, "error": str(error)})
            finally:
                save_json(local_path, local)
    handled = {n["source"] for t in plan["themes"] for n in t.get("nodes", [])}
    dispositions = {}
    for item in plan.get("dispositions", []):
        if item["source"] not in manifest["sources"] or not item.get("reason") or item["status"] not in ("incomplete", "no_change", "out_of_scope"):
            raise ValueError("原文跳过记录必须有有效来源、状态与原因")
        dispositions[item["source"]] = item
    handled.update(dispositions)
    local.setdefault("dispositions", {}).update(dispositions)
    save_json(local_path, local)
    result = {"results": report, "state": str(local_path), "unprocessed": sorted(set(manifest["sources"]) - handled), "blocked": manifest["blocked"]}
    save_json(work / "report.json", result)
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("prepare")
    p.add_argument("--result-dir", required=True, type=Path)
    p.add_argument("--extend-file", type=Path, default=DEFAULT_EXTEND_FILE)
    p.add_argument("--profile")
    p.add_argument("--source", type=Path, action="append")
    p.add_argument("--capture-only", action="store_true")
    p = sub.add_parser("apply")
    p.add_argument("--manifest", type=Path, required=True)
    p.add_argument("--plan", type=Path, required=True)
    args = parser.parse_args()
    try:
        if args.command == "prepare":
            result = prepare(args.result_dir, args.extend_file, profile=args.profile, sources=args.source, capture_only=args.capture_only)
        else:
            result = apply_plan(args.manifest, args.plan)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return int(any(x["status"] in ("failed", "finalize_pending") for x in result.get("results", []))
                   or bool(result.get("unprocessed")) or bool(result.get("blocked")) or result.get("status") == "blocked")
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(json.dumps({"status": "failed", "error": str(error)}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
