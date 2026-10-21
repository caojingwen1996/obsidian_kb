from __future__ import annotations

from argparse import Namespace
import contextlib
import io
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from unittest.mock import patch

SKILL = Path(__file__).resolve().parents[2]
if str(SKILL) not in sys.path:
    sys.path.insert(0, str(SKILL))
from scripts import timeline_postprocess as tp
from scripts.content_task import process_extracted_posts


class TimelineTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / "rules").mkdir()
        shutil.copy(SKILL.parents[2] / "rules/check_markdown_tables.py", self.root / "rules")
        self.output = self.root / "capture"
        self.extend = self.root / "EXTEND.md"
        self.cfg = {
            "enabled": True, "auto_create": True, "update_existing": True,
            "min_dates": 3, "vault_root": ".",
            "profiles": {
                key: {"sources": f"sources/{key}", "timelines": f"wiki_{key}/timelines",
                      "index": f"wiki_{key}/index.md", "index_heading": "## 时间线",
                      "structure": "laomujiang", "title_prefix": "作者-"}
                for key in ("a", "b")
            },
            "routes": [{"accounts": ["https://example.test/a", "测试作者"], "profile": "a"}],
        }
        for key in ("a", "b"):
            (self.root / f"wiki_{key}/timelines").mkdir(parents=True)
            (self.root / f"wiki_{key}/index.md").write_text("# 索引\n\n## 时间线\n", encoding="utf-8")
        self.write_config()
        self.result = self.output / "20261020" / "author"
        self.result.mkdir(parents=True)
        self.state = {
            "account_url": "https://example.test/a", "account": "测试作者",
            "output_root": str(self.output), "processed_items": {},
        }

    def write_config(self):
        self.extend.write_text(
            f"- preferred output root: `{self.output}`\n\n```json timeline-postprocess\n"
            + json.dumps(self.cfg) + "\n```\n", encoding="utf-8")

    def capture(self, count=3, start=1):
        for i in range(start, start + count):
            path = self.result / f"raw-{i}.md"
            path.write_text(f"标题：文章{i}\n发布时间：2026-10-{i:02d} 12:00:00\n正文：\n判断依据{i}，有条件成立。\n", encoding="utf-8")
            self.state["processed_items"][str(i)] = {
                "file_path": str(path), "title": f"文章{i}", "published_at": f"2026-10-{i:02d} 12:00:00",
                "url": f"https://example.test/a/{i}",
            }
        tp.save_json(self.result / "state.json", self.state)
        self.prepared = tp.prepare(self.result, self.extend)
        self.manifest_path = Path(self.prepared["manifest"])
        self.manifest = tp.read_json(self.manifest_path)
        self.work = self.manifest_path.parent
        return self.manifest

    def nodes(self, profile="a"):
        nodes = []
        for sid, source in self.manifest["sources"].items():
            i = int(source["published_at"][8:10])
            nodes.append({
                "source": sid, "date": f"2026-10-{i:02d}", "date_basis": "published",
                "quote": f"判断依据{i}，有条件成立。", "subject": "资金供需",
                "judgment": f"判断{i}", "conditions": "条件尚需核对", "author": "作者",
                "source_role": "本人原帖", "kind": "作者观点", "coverage": "正文",
                "completeness": "complete", "limitations": "未独立核验",
            })
        return nodes

    def draft(self, extra=""):
        front = (
            "---\ntitle: 作者-资金判断演化\ncreated: " + tp.today()
            + "\nupdated: " + tp.today()
            + "\ntype: timeline\nstatus: active\nsummary: 条件和判断的演化\nrelated: []\n---\n"
            "\n# 作者-资金判断演化\n"
        )
        body = ""
        for heading in tp.LOCAL_HEADINGS:
            body += "\n## " + heading + "\n\n"
            if heading == "3. 判断演化表":
                body += "| 日期 | 判断对象 | 当期判断 | 相比前期变化 | 证据状态 |\n|---|---|---|---|---|\n"
                for sid, source in self.manifest["sources"].items():
                    body += f"| [[{source['path'].removesuffix('.md')}\\|{source['published_at'][:10]}]] | 资金供需 | 条件判断 | 补充依据 | 作者观点 |\n"
            else:
                body += "此处保留已核对的阅读说明。\n"
        return front + body + extra

    def plan(self, action="create", nodes=None, draft=None):
        target = "wiki_a/timelines/作者-资金判断演化.md"
        path = self.root / target
        tp.atomic(self.work / "draft.md", draft or self.draft())
        theme = {
            "key": "资金供需", "profile": "a", "action": action, "reason": "出现新的可比判断",
            "nodes": nodes if nodes is not None else self.nodes(),
            "comparison": "对比相同条件下三个时间点的依据",
            "target": target, "base_hash": tp.digest(path.read_bytes()) if path.exists() else None,
            "draft": "draft.md", "reading_questions": ["条件是否改变？"],
            "knowledge_outline": ["条件", "依据", "变化"],
            "reviewed_pages": list(self.manifest["profiles"]["a"]["pages"]),
        }
        plan = {"themes": [theme]}
        tp.save_json(self.work / "plan.json", plan)
        return plan

    def apply(self, plan=None):
        if plan is not None:
            tp.save_json(self.work / "plan.json", plan)
        return tp.apply_plan(self.manifest_path, self.work / "plan.json")

    def status(self, result):
        return result["results"][0]["status"]

    def test_prepares_immutable_sources_and_unknown_account_blocks(self):
        self.capture()
        self.assertEqual(self.prepared["status"], "pending")
        original = (self.result / "raw-1.md").read_bytes()
        first = self.manifest["sources"].copy()
        self.capture()
        self.assertEqual(first, self.manifest["sources"])
        self.assertEqual((self.result / "raw-1.md").read_bytes(), original)
        other = self.output / "unknown"
        other.mkdir()
        tp.save_json(other / "state.json", {**self.state, "account_url": "https://unknown.test"})
        result = tp.prepare(other, self.extend)
        self.assertEqual(result["status"], "blocked")
        self.assertEqual(len(result["blocked"]), 3)

    def test_create_and_rerun_do_not_duplicate_page_index_or_log(self):
        self.capture()
        self.plan()
        self.assertEqual(self.status(self.apply()), "complete")
        files = [self.root / "wiki_a/index.md", self.root / "log.md", self.root / "wiki_a/timelines/作者-资金判断演化.md"]
        before = [p.read_bytes() for p in files]
        self.assertEqual(self.status(self.apply()), "complete")
        self.assertEqual(before, [p.read_bytes() for p in files])

    def test_library_relative_links_are_resolved(self):
        self.capture()
        concept = self.root / "wiki_a/concepts/资金.md"
        tp.atomic(concept, "# 资金\n\n## 条件\n")
        self.plan(draft=self.draft(extra="\n[[concepts/资金#条件|资金条件]]\n"))
        self.assertEqual(self.status(self.apply()), "complete")

    def test_plain_source_paths_do_not_replace_wikilinks(self):
        self.capture()
        draft = self.draft()
        for source in self.manifest["sources"].values():
            linked = f"[[{source['path'].removesuffix('.md')}\\|{source['published_at'][:10]}]]"
            draft = draft.replace(linked, source["path"].removesuffix(".md"))
        self.plan(draft=draft)
        self.assertEqual(self.status(self.apply()), "failed")
        self.assertFalse((self.root / "wiki_a/timelines/作者-资金判断演化.md").exists())

    def test_below_threshold_remains_candidate_across_dates_then_creates(self):
        self.capture(count=1)
        first_plan = self.plan(action="candidate")
        self.assertEqual(self.status(self.apply()), "candidate")
        old_state = self.work / "timeline-state.json"
        self.result = self.output / "20261021" / "author"
        self.result.mkdir(parents=True)
        self.state["processed_items"] = {}
        self.capture(count=2, start=2)
        self.assertIn(str(old_state), self.manifest["history_states"])
        self.plan()
        # A new page must link all prior candidate evidence as well.
        source_id = first_plan["themes"][0]["nodes"][0]["source"]
        prior = tp.read_json(old_state)["themes"]["a:资金供需"]["nodes"][0]["source_info"]
        self.manifest["sources"][source_id] = prior
        tp.save_json(self.manifest_path, self.manifest)
        self.plan()
        self.assertEqual(self.status(self.apply()), "complete")
        self.assertEqual(len(list((self.root / "wiki_a/timelines").glob("*.md"))), 1)

    def test_three_headings_on_same_date_do_not_pass_gate(self):
        self.capture(count=1)
        nodes = self.nodes() * 3
        self.plan(nodes=nodes)
        result = self.apply()
        self.assertEqual(self.status(result), "failed")
        self.assertIn("三个", result["results"][0]["error"])
        self.assertFalse(list((self.root / "wiki_a/timelines").glob("*.md")))

    def test_incomplete_sources_do_not_count_for_creation(self):
        self.capture()
        nodes = self.nodes()
        nodes[0]["completeness"] = "partial"
        self.plan(nodes=nodes)
        self.assertEqual(self.status(self.apply()), "failed")

    def test_cross_library_and_path_escape_are_rejected(self):
        self.capture()
        plan = self.plan()
        plan["themes"][0]["profile"] = "b"
        self.assertEqual(self.status(self.apply(plan)), "failed")
        plan["themes"][0]["profile"] = "a"
        plan["themes"][0]["target"] = "../escape.md"
        self.assertEqual(self.status(self.apply(plan)), "failed")
        self.assertFalse((self.root.parent / "escape.md").exists())

    def test_false_quote_and_wrong_date_are_rejected(self):
        self.capture()
        plan = self.plan()
        plan["themes"][0]["nodes"][0]["quote"] = "原文没有这句话"
        self.assertEqual(self.status(self.apply(plan)), "failed")
        plan = self.plan()
        plan["themes"][0]["nodes"][0]["date"] = "2025-01-01"
        self.assertEqual(self.status(self.apply(plan)), "failed")

    def test_broken_links_and_unescaped_table_alias_block_write(self):
        self.capture()
        self.plan(draft=self.draft().replace(r"\|", "|"))
        self.assertEqual(self.status(self.apply()), "failed")
        self.plan(draft=self.draft(extra="\n[[sources/不存在|链接]]\n"))
        self.assertEqual(self.status(self.apply()), "failed")

    def test_new_source_property_is_rejected(self):
        self.capture()
        self.plan(draft=self.draft().replace("type: timeline", "type: timeline\nsources: []"))
        self.assertEqual(self.status(self.apply()), "failed")

    def test_edit_conflict_preserves_user_content(self):
        self.capture()
        self.plan()
        self.apply()
        self.capture()
        path = self.root / "wiki_a/timelines/作者-资金判断演化.md"
        current = path.read_text(encoding="utf-8")
        self.plan(action="update", draft=current + "\n新增说明。\n")
        path.write_text(current + "\n用户刚刚编辑。\n", encoding="utf-8")
        self.assertEqual(self.status(self.apply()), "failed")
        self.assertTrue(path.read_text(encoding="utf-8").endswith("用户刚刚编辑。\n"))

    def test_update_can_insert_but_cannot_delete_existing_prose(self):
        self.capture()
        self.plan()
        self.apply()
        self.capture()
        path = self.root / "wiki_a/timelines/作者-资金判断演化.md"
        current = path.read_text(encoding="utf-8")
        self.plan(action="update", draft=current.replace("此处保留已核对的阅读说明。", "替换全部内容"))
        self.assertEqual(self.status(self.apply()), "failed")
        self.plan(action="update", draft=current + "\n新增条件说明。\n")
        self.assertEqual(self.status(self.apply()), "complete")

    def test_navigation_failure_resumes_without_rewriting_page(self):
        self.capture()
        self.plan()
        with patch.object(tp, "update_navigation", side_effect=OSError("index locked")):
            result = self.apply()
        self.assertEqual(self.status(result), "finalize_pending")
        path = self.root / "wiki_a/timelines/作者-资金判断演化.md"
        modified = path.stat().st_mtime_ns
        self.assertEqual(self.status(self.apply()), "complete")
        self.assertEqual(path.stat().st_mtime_ns, modified)

    def test_unknown_disposition_and_uncovered_inputs_are_visible(self):
        self.capture()
        tp.save_json(self.work / "plan.json", {"themes": []})
        result = self.apply()
        self.assertEqual(len(result["unprocessed"]), 3)
        plan = {"themes": [], "dispositions": [
            {"source": sid, "status": "out_of_scope", "reason": "生活记录"}
            for sid in self.manifest["sources"]
        ]}
        self.assertFalse(self.apply(plan)["unprocessed"])

    def test_content_save_hook_and_revision_handling(self):
        input_file = self.root / "posts.json"
        args = Namespace(
            input_file=str(input_file), author_name="测试作者",
            account_url="https://example.test/a", date="2026-10-20",
            output_dir=str(self.output), extend_file=str(self.extend),
            capture_only=False, timeline_profile=None,
        )
        payload = [{"title": "测试", "content_id": "12345678", "url": "https://example.test/a/12345678",
                    "published_at": "2026-10-20 12:00:00", "content": "原始判断", "author_name": "测试作者"}]
        input_file.write_text(json.dumps(payload), encoding="utf-8")
        with contextlib.redirect_stdout(io.StringIO()):
            first = process_extracted_posts(args)
            again = process_extracted_posts(args)
            payload[0]["content"] = "修订判断"
            input_file.write_text(json.dumps(payload), encoding="utf-8")
            revised = process_extracted_posts(args)
        self.assertEqual(first.postprocessing[0]["status"], "pending")
        self.assertEqual(again.success_count, 0)
        self.assertEqual(revised.success_count, 1)
        raw_files = list(Path(first.result_dir).glob("*.md"))
        self.assertEqual(len(raw_files), 2)
        self.assertTrue(any("原始判断" in p.read_text(encoding="utf-8") for p in raw_files))
        self.assertTrue(any("修订判断" in p.read_text(encoding="utf-8") for p in raw_files))
        args.capture_only = True
        with contextlib.redirect_stdout(io.StringIO()):
            skipped = process_extracted_posts(args)
        self.assertEqual(skipped.postprocessing[0]["status"], "skipped")

    def test_lock_blocks_concurrent_writer(self):
        self.capture()
        self.plan()
        with tp.write_lock(self.root):
            with self.assertRaisesRegex(ValueError, "写锁"):
                self.apply()

    def test_changed_source_is_not_used(self):
        self.capture()
        self.plan()
        source = next(iter(self.manifest["sources"].values()))
        (self.root / source["path"]).write_text("source edited", encoding="utf-8")
        self.assertEqual(self.status(self.apply()), "failed")

    def test_legacy_store_finish_prepares_and_revision_keeps_original(self):
        from scripts import task_store
        args = Namespace(output_root=str(self.output), start_time="2026-10-20 09:00:00",
                         account="测试作者", chrome_profile="unused", resume_existing=False)
        with contextlib.redirect_stdout(io.StringIO()):
            task_store.init_command(args)
        result_dir = self.output / "20261020" / "测试作者"
        state_file = result_dir / "state.json"
        save = Namespace(state_file=str(state_file), published_at="2026-10-20 10:00:00",
                         source_id="legacy", title="原始", url="https://example.test/a/legacy",
                         content="第一版正文", content_file=None)
        with contextlib.redirect_stdout(io.StringIO()):
            task_store.save_item_command(save)
            task_store.save_item_command(save)
            save.content = "第二版正文"
            task_store.save_item_command(save)
            code = task_store.finish_command(Namespace(
                state_file=str(state_file), end_time=None, extend_file=str(self.extend),
                timeline_profile=None, capture_only=False,
            ))
        self.assertEqual(code, 0)
        self.assertEqual(len(list(result_dir.glob("*.txt"))), 2)
        self.assertEqual(tp.read_json(tp.workdir(result_dir) / "capture-hook.json")["status"], "pending")

    def test_changed_library_mapping_is_not_inherited_from_old_manifest(self):
        self.capture()
        self.cfg["routes"] = []
        self.write_config()
        result = tp.prepare(self.result, self.extend)
        self.assertEqual(result["status"], "blocked")

    def test_failure_in_one_theme_does_not_rollback_another(self):
        self.capture()
        plan = self.plan()
        invalid = {**plan["themes"][0], "key": "另一个主题", "target": "../invalid.md"}
        plan["themes"].append(invalid)
        result = self.apply(plan)
        self.assertEqual([r["status"] for r in result["results"]], ["complete", "failed"])
        self.assertTrue((self.root / "wiki_a/timelines/作者-资金判断演化.md").exists())

    def test_disabled_config_and_capture_only_do_not_archive(self):
        self.capture(count=1)
        self.cfg["enabled"] = False
        self.write_config()
        result = tp.prepare(self.result, self.extend)
        self.assertEqual(result["status"], "skipped")
        result = tp.prepare(self.result, self.root / "does-not-exist.md", capture_only=True)
        self.assertEqual(result["status"], "skipped")


if __name__ == "__main__":
    unittest.main()
