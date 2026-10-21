import importlib.util
import json
from pathlib import Path
import re
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
ARCHIVED_SPECS = ROOT / "_archives/2026-10-21-indicator-rollback/indicators"
SPEC = importlib.util.spec_from_file_location("indicator_check", ROOT / "rules/check_indicator_pages.py")
check = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(check)


class IndicatorContractTests(unittest.TestCase):
    def setUp(self):
        self.page = ARCHIVED_SPECS / "微观-资金面-公募行业配置.md"
        self.metadata, body = check.read_page(self.page)
        self.result = json.loads(re.findall(r"```json\s*\n(.*?)\n```", body, re.S)[0])

    def test_archived_examples_and_active_specs_are_well_formed(self):
        pages = sorted(ARCHIVED_SPECS.glob("*.md"))
        self.assertTrue(pages)
        for vault in ("wiki", "wiki_laomujiang"):
            pages.extend((ROOT / vault / "indicators").glob("*.md"))
        for page in pages:
            with self.subTest(page=page.name):
                self.assertEqual([], check.validate_page(page))

    def test_missing_data_cannot_become_directional_signal(self):
        self.result["assessment"] = "crowding_watch"
        self.result["evidence"] = ["某条证据"]
        self.assertTrue(any("非complete" in x for x in check.validate_result(self.result, self.metadata)))

    def test_complete_data_may_remain_undetermined(self):
        self.result.update(data_status="complete", missing_inputs=[], observed_at="2026-06-30",
                           available_at="2026-08-31", evaluated_at="2026-09-01")
        self.result["metrics"]["industry_weight"] = 0.2
        self.assertEqual([], check.validate_result(self.result, self.metadata))

    def test_all_null_readings_cannot_be_complete(self):
        self.result.update(data_status="complete", missing_inputs=[], observed_at="2026-06-30",
                           available_at="2026-08-31", evaluated_at="2026-09-01")
        self.assertTrue(any("有效读数" in x for x in check.validate_result(self.result, self.metadata)))

    def test_front_running_disclosure_is_rejected(self):
        self.result.update(data_status="complete", missing_inputs=[], observed_at="2026-06-30",
                           available_at="2026-08-31", evaluated_at="2026-07-01")
        self.assertTrue(any("时点顺序" in x for x in check.validate_result(self.result, self.metadata)))

    def test_version_mismatch_and_unknown_state_are_rejected(self):
        self.result.update(spec_version="2.0.0", assessment="safe")
        errors = check.validate_result(self.result, self.metadata)
        self.assertTrue(any("spec_version" in x for x in errors))
        self.assertTrue(any("允许列表" in x for x in errors))

    def test_metric_name_drift_is_rejected(self):
        self.result["metrics"]["made_up_score"] = 0
        self.assertTrue(any("metrics字段" in x for x in check.validate_result(self.result, self.metadata)))

    def test_draft_always_requires_review(self):
        self.result["requires_human_review"] = False
        self.assertTrue(any("draft规范" in x for x in check.validate_result(self.result, self.metadata)))

    def test_missing_inputs_and_unknown_time_prevent_complete(self):
        self.result["data_status"] = "complete"
        errors = check.validate_result(self.result, self.metadata)
        self.assertTrue(any("缺少observed_at" in x for x in errors))
        self.assertTrue(any("缺失输入" in x for x in errors))

    def test_duplicate_stable_id_is_rejected(self):
        self.assertTrue(check.duplicate_ids([self.page, self.page]))

    def test_template_and_required_fields_stay_aligned(self):
        metadata, _ = check.read_page(ROOT / "templates/indicator-page-template.md")
        for field in check.REQUIRED_STRINGS + check.LIST_FIELDS:
            self.assertIn(field, metadata)

    def test_source_property_and_missing_section_are_rejected(self):
        text = self.page.read_text(encoding="utf-8")
        text = text.replace("type: indicator", "sources: []\ntype: indicator", 1)
        text = text.replace("## 缺失与异常处理", "### 缺失与异常处理", 1)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "invalid.md"
            path.write_text(text, encoding="utf-8")
            errors = check.validate_page(path)
        self.assertTrue(any("sources属性" in x for x in errors))
        self.assertTrue(any("章节" in x for x in errors))

    def test_no_fabricated_readings_in_examples(self):
        text = self.page.read_text(encoding="utf-8").replace('"industry_weight": null', '"industry_weight": 0.25', 1)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "invalid.md"
            path.write_text(text, encoding="utf-8")
            self.assertTrue(any("不得伪造" in x for x in check.validate_page(path)))


if __name__ == "__main__":
    unittest.main()
