from pathlib import Path
from tempfile import TemporaryDirectory
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "server"))
from catalog import Catalog


class CatalogTest(unittest.TestCase):
    def setUp(self):
        self.d = TemporaryDirectory()
        self.root = Path(self.d.name) / "RiskHot"
        (self.root / "02-业务架构与领域设计").mkdir(parents=True)
        (self.root / "02-业务架构与领域设计" / "L1.md").write_text(
            "# 风险识别\n## 全局风险变量\n风险变量用于表达风险演化的核心因素。\n", encoding="utf-8"
        )
        (self.root / "notes.json").write_text('{"name": "RiskHot"}', encoding="utf-8")
        (self.root / ".env").write_text("PASSWORD=secret", encoding="utf-8")
        self.cat = Catalog(self.root)

    def tearDown(self):
        self.d.cleanup()

    def test_search_and_read(self):
        hits = self.cat.search("风险变量")["hits"]
        self.assertEqual(len(hits), 2)
        self.assertEqual(hits[0]["line"], 2)
        result = self.cat.read_file("02-业务架构与领域设计/L1.md", 2, 1)
        self.assertIn("L2: ## 全局风险变量", result["text"])

    def test_outline(self):
        o = self.cat.outline("02-业务架构与领域设计/L1.md")
        self.assertEqual([h["level"] for h in o["headings"]], [1, 2])

    def test_path_traversal_denied(self):
        for path in ("../etc/passwd", "/etc/passwd", ".env"):
            with self.assertRaises(ValueError):
                self.cat.read_file(path)

    def test_hidden_not_listed(self):
        paths = [v["path"] for v in self.cat.list_files()["files"]]
        self.assertNotIn(".env", paths)
        self.assertIn("notes.json", paths)

    def test_symlink_denied(self):
        outside = Path(self.d.name) / "private.txt"
        outside.write_text("secret")
        (self.root / "outside.txt").symlink_to(outside)
        with self.assertRaises(ValueError):
            self.cat.read_file("outside.txt")
        self.assertNotIn("outside.txt", [f["path"] for f in self.cat.list_files()["files"]])


if __name__ == "__main__":
    unittest.main()
