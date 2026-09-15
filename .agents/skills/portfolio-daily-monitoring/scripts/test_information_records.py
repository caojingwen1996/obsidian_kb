"""Offline regressions for event history, evidence gaps and report compatibility."""

import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from information_records import (
    LAYERS, REVIEW_FIELDS, carry_information_history, information_gaps,
    information_sections, information_summary, validate_information,
)
from render_report_html import build_html


def event_record(path_id="P1"):
    record = {
        "event_id": "E-20260914-001", "path_id": path_id,
        "title": "示例政策进展", "update": "持续跟踪", "reviewed_at": "2026-09-15",
    }
    for key, (_, fields) in LAYERS.items():
        record[key] = {field: "待验证" for field in fields}
    record["event"]["fact"] = "事实：示例公告发布，影响未确认"
    record["reaction"].update(direction="证据不足", level="待验证")
    record["tracking"].update(status="待验证", previous="2026-09-14 首次记录", closure_reason="不适用：继续跟踪")
    return record


def target(name="示例甲", code="000001"):
    return {
        "name": name, "code": code,
        "information_review": {key: "示例检查说明" for key in REVIEW_FIELDS},
        "information_events": [event_record()],
    }


class InformationRecordsTests(unittest.TestCase):
    def test_missing_input_is_not_no_risk_or_stable(self):
        details, followup = information_sections({})
        self.assertIn("归纳未完成", details)
        self.assertIn("不代表没有风险", followup)
        self.assertNotIn("风险方向：持平", details)
        reviewed_empty = target()
        reviewed_empty["information_events"] = []
        self.assertFalse(information_gaps(reviewed_empty))
        self.assertIn("无重要事件路径", information_sections(reviewed_empty)[0])

    def test_history_preserves_latest_record_without_promoting_to_today(self):
        prior = target()
        older = event_record()
        older["reviewed_at"] = "2026-09-13"
        prior["prior_information_events"] = [older]
        history = carry_information_history(prior)
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0]["reviewed_at"], "2026-09-15")
        next_run = {"prior_information_events": history}
        self.assertNotIn("information_events", next_run)
        details, _ = information_sections(next_run)
        self.assertIn("历史待复核", details)
        self.assertIn("旧判断不作为本次结论", details)
        reviewed = target()
        reviewed["prior_information_events"] = history
        self.assertFalse(information_gaps(reviewed))

    def test_shared_event_has_one_summary_row_and_distinct_paths(self):
        a, b = target(), target("示例乙", "000002")
        b["information_events"][0]["path_id"] = "P2"
        summary = information_summary([a, b], "2026-09-15")
        self.assertEqual(summary.count("| E-20260914-001："), 1)
        self.assertIn("示例甲 / P1", summary)
        self.assertIn("示例乙 / P2", summary)
        self.assertIn("000002-示例乙-每日监控-2026-09-15.html", summary)

    def test_incomplete_or_duplicate_records_fail_before_publication(self):
        item = target()
        item["information_events"].append(copy.deepcopy(item["information_events"][0]))
        with self.assertRaisesRegex(ValueError, "duplicate"):
            validate_information(item)
        item = target()
        del item["information_events"][0]["behavior"]["observed"]
        with self.assertRaisesRegex(ValueError, "observed"):
            validate_information(item)
        item = target()
        item["information_events"][0]["tracking"]["status"] = "关闭"
        with self.assertRaisesRegex(ValueError, "tracking status"):
            validate_information(item)

    def test_markdown_and_html_keep_five_layers_and_escape_cells(self):
        item = target()
        item["information_events"][0]["behavior"]["observed"] = "待验证 | 无身份依据\n<script>alert(1)</script>"
        details, followup = information_sections(item)
        rendered = build_html("# 测试\n\n" + details + "\n\n" + followup)
        for label, _ in LAYERS.values():
            self.assertIn(label, rendered)
        self.assertIn("&#124;", details)
        self.assertNotIn("<script>alert", rendered)
        self.assertIn("&lt;script&gt;", rendered)

    def test_cli_preserves_valuation_contract_and_surfaces_history_gaps(self):
        item = target()
        item.update(status="观察", report_file="示例研报.md", report_date="2026-09-01",
                    value_low=10, value_high=20, close=15, daily_pct=1, week_pct=1,
                    five_pct=1, amount=2, amount_ratio=1, turnover=1, pe=10, pb=1)
        item["prior_information_events"] = [event_record("P-old")]
        run = dict(date="2026-09-15", trade_date="2026-09-14", run_time="2026-09-15 08:30",
                   monitor_state="测试", week_note="测试", items=[item])
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "run.json"
            source.write_text(json.dumps(run, ensure_ascii=False), encoding="utf-8")
            before = source.read_bytes()
            subprocess.run([sys.executable, str(Path(__file__).with_name("generate_run_reports.py")),
                            "--input", str(source), "--output-dir", str(root / "out")], check=True, capture_output=True)
            reports = list((root / "out").glob("*.md"))
            self.assertEqual(len(reports), 2)
            report = next(p for p in reports if p.name.startswith("000001")).read_text(encoding="utf-8")
            self.assertIn("#### 6. 估值输入变化与重算判断", report)
            self.assertIn("- 估值处置状态：NO_REVALUE", report)
            self.assertIn("- 触发理由：", report)
            self.assertIn("是否需要继续阅读后续章节：是", report)
            self.assertIn("历史待复核", report)
            self.assertIn("风险方向：证据不足", report)
            self.assertEqual(before, source.read_bytes())
            self.assertIn("长期跟踪", build_html(report))


if __name__ == "__main__":
    unittest.main()
