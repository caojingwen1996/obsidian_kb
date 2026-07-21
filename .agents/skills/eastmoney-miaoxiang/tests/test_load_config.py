import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SKILL_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = SKILL_DIR / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))

from load_config import load_local_env


class LoadLocalEnvTests(unittest.TestCase):
    def write_env(self, content):
        temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(temp_dir.cleanup)
        path = Path(temp_dir.name) / "local.env"
        path.write_text(content, encoding="utf-8")
        return path

    def test_loads_key_and_compatibility_aliases(self):
        path = self.write_env("MX_APIKEY=test-key\n")
        environment = {}

        load_local_env(path, environment)

        self.assertEqual(environment["MX_APIKEY"], "test-key")
        self.assertEqual(environment["EASTMONEY_MIAOXIANG_API_KEY"], "test-key")
        self.assertEqual(environment["MIAOXIANG_API_KEY"], "test-key")

    def test_rejects_placeholder_key(self):
        path = self.write_env("MX_APIKEY=PASTE_YOUR_API_KEY_HERE\n")

        with self.assertRaisesRegex(ValueError, "real MX_APIKEY"):
            load_local_env(path, {})

    def test_cli_passes_key_to_child_process(self):
        path = self.write_env("MX_APIKEY=test-key\n")
        loader = SCRIPTS_DIR / "load_config.py"
        child = "import os; print(os.environ['MX_APIKEY'])"

        result = subprocess.run(
            [sys.executable, str(loader), "--env-file", str(path), "--", sys.executable, "-c", child],
            capture_output=True,
            text=True,
            check=False,
            env=os.environ.copy(),
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), "test-key")


if __name__ == "__main__":
    unittest.main()
