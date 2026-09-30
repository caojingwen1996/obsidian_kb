"""Synthetic theme-mode cases; no real financial observations."""

import copy
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "scripts/validate_result.py"
spec = importlib.util.spec_from_file_location("validator", SCRIPT)
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)


def empty_result():
    return {
        "result_id": "SYNTHETIC", "mode": "theme",
        "generated_at": "2026-09-28T12:00:00+08:00",
        "observation_window": {"start": "2026-09-01", "end": "2026-09-28"},
        "theme_context": {"theme_name": "测试主题", "core_question": "支出是否上升？",
                          "core_variables": ["spending"]},
        "search_log": [{"query": "fictional spending", "source": "fixture:source",
                        "accessed_at": "2026-09-28T12:00:00+08:00",
                        "status": "failed", "detail": "Synthetic access failure"}],
        "events": [], "signals": [], "evidence": [], "findings": [],
        "gaps": [{"variable": "spending", "reason": "无法获取数据", "next_step": "查原始公告"}],
        "summary": {"event_count": 0, "signal_count": 0, "cluster_count": 0,
                    "evidence_count": 0, "finding_count": 0, "gap_count": 1},
    }


def populated_result():
    result = empty_result()
    result["search_log"][0].update(status="success", detail="Synthetic source retrieved")
    result["events"] = [{
        "event_id": "E1", "event_time": {"value": None, "precision": "unknown"},
        "subject": "Fictional company", "action": "announced",
        "key_fact": "Raised planned spending from 10 to 12 test units.",
        "source_refs": [{"source_id": "fixture:source"}], "confidence": "medium",
    }]
    result["signals"] = [{
        "signal_id": "S1", "signal_type": "fact", "event_refs": ["E1"],
        "variable": "spending", "direction": "up", "magnitude": "unknown",
        "scope": "company", "confidence": "medium",
        "time": {"value": None, "precision": "unknown"},
    }]
    result["evidence"] = [{
        "evidence_id": "EV1", "variable": "spending", "relationship": "support",
        "signal_refs": ["S1"], "rationale": "The announced spending plan increased.",
    }]
    result["findings"] = [{"finding_id": "F1", "conclusion": "计划支出增加。",
                           "evidence_refs": ["EV1"], "confidence": "medium"}]
    result["gaps"] = []
    result["summary"].update(event_count=1, signal_count=1, evidence_count=1,
                             finding_count=1, gap_count=0)
    return result


class ThemeTests(unittest.TestCase):
    def test_failure_empty_and_success(self):
        for result in (empty_result(), populated_result()):
            self.assertEqual(validator.validate_result(result), [])

    def test_event_only_and_counter_evidence(self):
        result = populated_result()
        result["signals"] = []
        result["summary"]["signal_count"] = 0
        evidence = result["evidence"][0]
        evidence.pop("signal_refs")
        evidence.update(event_refs=["E1"])
        self.assertEqual(validator.validate_result(result), [])
        evidence.update(relationship="counter_evidence")
        self.assertEqual(validator.validate_result(result), [])

    def test_optional_cluster(self):
        result = populated_result()
        second = copy.deepcopy(result["signals"][0])
        second.update(signal_id="S2")
        result["signals"].append(second)
        result["evidence"][0]["signal_refs"].append("S2")
        result["clusters"] = [{
            "cluster_id": "C1", "cluster_name": "Synthetic grouping", "summary": "Fixture",
            "member_signals": ["S1", "S2"], "relationships": ["same_variable"],
            "structure_view": [{"statement": "Fixture relation", "link_type": "inferred",
                                "supporting_refs": ["S1", "S2"]}],
            "explanatory_compression": "Fixture only", "strength": "weak", "confidence": "low",
        }]
        result["summary"].update(signal_count=2, cluster_count=1)
        self.assertEqual(validator.validate_result(result), [])
        result["clusters"][0]["structure_view"][0]["supporting_refs"] = ["missing"]
        self.assertIn("unresolved", "\n".join(validator.validate_result(result)))

    def test_invalid_evidence_chains(self):
        cases = [
            ("missing source", lambda r: r["events"][0].update(source_refs=[])),
            ("duplicate ID", lambda r: r["events"].append(copy.deepcopy(r["events"][0]))),
            ("event ref", lambda r: r["signals"][0].update(event_refs=["missing"])),
            ("signal ref", lambda r: r["evidence"][0].update(signal_refs=["missing"])),
            ("finding ref", lambda r: r["findings"][0].update(evidence_refs=["missing"])),
            ("unbacked finding", lambda r: r["findings"][0].update(evidence_refs=[])),
            ("unbacked evidence", lambda r: r["evidence"][0].update(signal_refs=[])),
            ("bad variable", lambda r: r["evidence"][0].update(variable="missing")),
            ("unsupported relation", lambda r: r["evidence"][0].update(relationship="unrelated")),
            ("false count", lambda r: r["summary"].update(evidence_count=2)),
            ("unbacked repricing", lambda r: r["signals"][0].update(signal_type="repricing")),
            ("uncovered variable", lambda r: r["theme_context"]["core_variables"].append("cost")),
            ("window", lambda r: r["observation_window"].update(start="2026-10-01")),
            ("failure with events", lambda r: r["search_log"][0].update(status="failed")),
            ("feed structure", lambda r: r.update(mode="feed")),
            ("legacy mode", lambda r: r.update(mode="target")),
        ]
        for name, mutate in cases:
            with self.subTest(name=name):
                result = populated_result()
                mutate(result)
                self.assertTrue(validator.validate_result(result))

    def test_empty_requires_gaps(self):
        result = empty_result()
        result["gaps"] = []
        result["summary"]["gap_count"] = 0
        self.assertIn("uncovered", "\n".join(validator.validate_result(result)))

    def test_cli(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "主题结果.json"
            for content, expected in ((json.dumps(populated_result(), ensure_ascii=False), 0),
                                      ("{broken", 1), ("[]", 1)):
                path.write_text(content, encoding="utf-8-sig")
                run = subprocess.run([sys.executable, "-X", "utf8", str(SCRIPT), str(path)],
                                     capture_output=True, text=True, encoding="utf-8")
                self.assertEqual(run.returncode, expected, run.stdout + run.stderr)
                self.assertNotIn("Traceback", run.stderr)


if __name__ == "__main__":
    unittest.main()
