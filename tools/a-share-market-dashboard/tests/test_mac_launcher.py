import os
from pathlib import Path
import select
import shutil
import subprocess
from tempfile import TemporaryDirectory
import time
import unittest


@unittest.skipUnless(os.name == "posix", "requires a POSIX terminal")
class MacLauncherTokenTests(unittest.TestCase):
    def test_prompt_hides_input_and_exports_it_to_service(self):
        import pty

        with TemporaryDirectory() as directory:
            root = Path(directory)
            launcher = root / "启动面板.command"
            shutil.copyfile(Path(__file__).resolve().parents[1] / "启动面板.command", launcher)
            bin_dir = root / "bin"
            bin_dir.mkdir()
            (bin_dir / "node").write_text("#!/bin/bash\nexit 0\n", encoding="utf-8")
            (bin_dir / "python3").write_text('''#!/bin/bash
if [ "$1" = "-c" ]; then
  case "$2" in *resolve_token*) exit 1 ;; *) exit 0 ;; esac
fi
if [ -n "$TUSHARE_TOKEN" ]; then
  printf '%s\\n' 'credential inherited'
  exit 0
fi
exit 9
''', encoding="utf-8")
            for file in bin_dir.iterdir():
                file.chmod(0o755)
            env = {key: value for key, value in os.environ.items()
                   if key not in {"TUSHARE_TOKEN", "TUSHARE_PRO_TOKEN"}}
            env["PATH"] = f"{bin_dir}:/usr/bin:/bin"
            master, slave = pty.openpty()
            process = subprocess.Popen(["/bin/bash", str(launcher)], env=env,
                                       stdin=slave, stdout=slave, stderr=slave)
            os.close(slave)
            output = b""
            submitted = False
            test_input = b"test-only-credential"
            try:
                deadline = time.monotonic() + 8
                while time.monotonic() < deadline:
                    ready, _, _ = select.select([master], [], [], 0.1)
                    if ready:
                        try:
                            chunk = os.read(master, 4096)
                        except OSError:
                            break
                        if not chunk:
                            break
                        output += chunk
                        if not submitted and '请输入 Token'.encode("utf-8") in output:
                            os.write(master, test_input + b"\n")
                            submitted = True
                    elif process.poll() is not None:
                        break
                self.assertEqual(process.wait(timeout=1), 0, output.decode("utf-8"))
                self.assertTrue(submitted)
                self.assertIn(b"credential inherited", output)
                self.assertNotIn(test_input, output)
            finally:
                if process.poll() is None:
                    process.kill()
                    process.wait(timeout=3)
                os.close(master)


if __name__ == "__main__":
    unittest.main()
