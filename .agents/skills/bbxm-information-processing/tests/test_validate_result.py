"""Synthetic contract cases; all observations below are fictional."""

import copy
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "scripts/validate_result.py"
spec = importlib.util.spec_from_file_location("validate_result", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def empty_result():
    return {
        "result_id": "TEST-ONLY", "mode": "feed",
        "generated_at": "2026-09-23T12:00:00+08:00",
        "summary": {
            "new_event_count": 0, "new_signal_count": 0,
            "forming_theme_count": 0, "updated_existing_theme_count": 0,
            "isolated_signal_count": 0, "insufficient_for_theme_count": 0,
            "risk_identification_handoff_count": 0,
            "forming_theme_refs": [], "updated_existing_theme_refs": [],
            "isolated_signal_refs": [], "insufficient_for_theme_refs": [],
        },
        "core_findings": [], "risk_identification_handoff": [],
        "events": [], "signals": [], "clusters": [], "themes": [],
        "notes": "Synthetic test only; no real-world financial observations.",
    }


def full_result():
    result = empty_result()
    result["events"] = [{
        "event_id": "E1", "event_time": {"value": None, "precision": "unknown"},
        "subject": "Fictional company", "action": "announced",
        "key_fact": "Raised planned expenditure from 10 to 12 test units.",
        "source_refs": [{"source_id": "user-input:synthetic:1"}],
        "confidence": "medium",
    }]
    result["signals"] = [{
        "signal_id": "S1", "signal_type": "fact", "event_refs": ["E1"],
        "variable": "planned_expenditure", "direction": "up", "magnitude": "unknown",
        "novelty": "unknown", "persistence": "unknown", "scope": "company",
        "confidence": "medium", "time": {"value": None, "precision": "unknown"},
    }]
    result["clusters"] = [{
        "cluster_id": "C1", "cluster_name": "Expenditure announcement",
        "member_events": ["E1"], "member_signals": ["S1"],
        "relationships": ["same_subject"], "time_range": {"start": None, "end": None},
        "timeline": [{"time": None, "type": "event", "ref_id": "E1", "summary": "Announcement"},
                     {"time": None, "type": "signal", "ref_id": "S1", "summary": "Plan raised"}],
        "strength": "weak", "confidence": "medium", "status": "emerging",
    }]
    result["themes"] = [{
        "theme_id": "T1", "theme_name": "Expansion persistence",
        "core_question": "Will the expenditure expansion persist?",
        "summary": "Only a candidate question; no persistence evidence.",
        "cluster_refs": ["C1"], "core_variables": ["planned_expenditure"],
        "current_direction": "uncertain", "status": "emerging", "confidence": "low",
        "evidence_state": {"supporting_cluster_count": 1},
    }]
    result["core_findings"] = [{
        "finding_id": "F1", "conclusion": "The plan rose; realization remains unverified.",
        "supporting_event_refs": ["E1"], "supporting_signal_refs": ["S1"],
        "supporting_cluster_refs": ["C1"], "theme_ref": "T1",
        "theme_status": "emerging", "current_direction": "uncertain", "confidence": "medium",
    }]
    result["risk_identification_handoff"] = [{
        "handoff_id": "H1", "finding_ref": "F1", "theme_ref": "T1",
        "eligible": False, "reason": "No persistence or observed downside transmission.",
        "supporting_cluster_refs": ["C1"],
    }]
    result["summary"].update(new_event_count=1, new_signal_count=1,
                             forming_theme_count=1, forming_theme_refs=["T1"],
                             isolated_signal_count=1, isolated_signal_refs=["S1"])
    return result


class ContractTests(unittest.TestCase):
    def test_empty_and_full_results(self):
        for result in (empty_result(), full_result()):
            with self.subTest(result=result["events"]):
                self.assertEqual(module.validate_result(result), [])

    def test_event_only_and_weak_single_member_cluster(self):
        result = empty_result()
        result["events"] = full_result()["events"]
        result["summary"]["new_event_count"] = 1
        self.assertEqual(module.validate_result(result), [])
        cluster = full_result()["clusters"][0]
        cluster["member_signals"] = []
        cluster["timeline"] = cluster["timeline"][:1]
        result["clusters"] = [cluster]
        self.assertEqual(module.validate_result(result), [])

    def test_historical_context_not_counted_as_new(self):
        result = full_result()
        result["summary"]["new_event_count"] = 0
        result["notes"] += " E1 is historical context; S1 is newly derived."
        self.assertEqual(module.validate_result(result), [])

    def test_valid_repricing(self):
        result = full_result()
        result["signals"][0]["signal_type"] = "repricing"
        result["events"][0]["event_analysis"] = {"repricing": "Synthetic observed repricing."}
        self.assertEqual(module.validate_result(result), [])

    def test_invalid_contracts_and_references(self):
        cases = []

        def case(label, mutate, expected):
            result = full_result()
            mutate(result)
            cases.append((label, result, expected))

        case("monitor", lambda r: r.update(mode="monitor"), "mode")
        case("target", lambda r: r.update(mode="target"), "mode")
        case("legacy", lambda r: r.update(induction={}), "Additional properties")
        case("missing source", lambda r: r["events"][0].update(source_refs=[]), "source_refs")
        case("enum", lambda r: r["signals"][0].update(persistence="short-lived"), "persistence")
        case("duplicate ID", lambda r: r["events"].append(copy.deepcopy(r["events"][0])), "duplicate event_id")
        case("signal event", lambda r: r["signals"][0].update(event_refs=["missing"]), "unresolved")
        case("duplicate ref", lambda r: r["signals"][0].update(event_refs=["E1", "E1"]), "duplicate references")
        case("cluster member", lambda r: r["clusters"][0].update(member_signals=["missing"]), "unresolved")
        case("timeline membership", lambda r: r["clusters"][0].update(member_signals=[]), "out-of-cluster")
        case("theme cluster", lambda r: r["themes"][0].update(cluster_refs=["missing"]), "unresolved")
        case("single cluster established", lambda r: r["themes"][0].update(status="established"), "must be emerging")
        case("cluster count", lambda r: r["themes"][0].update(evidence_state={"supporting_cluster_count": 2}), "supporting_cluster_count")
        case("finding cluster", lambda r: r["core_findings"][0].update(supporting_cluster_refs=["missing"]), "unresolved")
        case("finding theme", lambda r: r["core_findings"][0].update(theme_ref="missing"), "unresolved")
        case("finding state", lambda r: r["core_findings"][0].update(theme_status="established"), "disagrees")
        case("handoff finding", lambda r: r["risk_identification_handoff"][0].update(finding_ref="missing"), "unresolved")
        case("handoff count", lambda r: r["summary"].update(risk_identification_handoff_count=1), "eligible handoffs")
        case("forming count", lambda r: r["summary"].update(forming_theme_count=2), "disagrees")
        case("summary signal", lambda r: r["summary"].update(isolated_signal_refs=["missing"]), "unresolved")
        case("summary typed ref", lambda r: r["summary"].update(insufficient_for_theme_refs=[{"ref_type": "cluster", "ref_id": "missing"}]), "unresolved")
        case("new count", lambda r: r["summary"].update(new_event_count=2), "exceeds")
        case("unbacked repricing", lambda r: r["signals"][0].update(signal_type="repricing"), "requires Event Analysis")
        for label, result, expected in cases:
            with self.subTest(case=label):
                self.assertIn(expected, "\n".join(module.validate_result(result)))

    def test_cli_utf8_bom_and_invalid_json(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "result.json"
            for content, expected_code in ((json.dumps(full_result()), 0),
                                           (json.dumps({"mode": "target"}), 1),
                                           ("{broken", 1)):
                path.write_text(content, encoding="utf-8-sig")
                run = subprocess.run([sys.executable, str(SCRIPT), str(path)],
                                     capture_output=True, text=True)
                self.assertEqual(run.returncode, expected_code, run.stdout + run.stderr)
                self.assertNotIn("Traceback", run.stderr)


if __name__ == "__main__":
    unittest.main()
