import argparse
import os
import subprocess
from pathlib import Path
from typing import MutableMapping


PLACEHOLDER = "PASTE_YOUR_API_KEY_HERE"
ALIASES = (
    "MX_APIKEY",
    "EASTMONEY_MIAOXIANG_API_KEY",
    "MIAOXIANG_API_KEY",
)
DEFAULT_ENV_FILE = Path(__file__).resolve().parents[1] / "local.env"


def load_local_env(
    path: Path = DEFAULT_ENV_FILE,
    environment: MutableMapping[str, str] = os.environ,
) -> MutableMapping[str, str]:
    values = {}
    for raw_line in Path(path).read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        name = name.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        values[name] = value

    api_key = values.get("MX_APIKEY", "")
    if not api_key or api_key == PLACEHOLDER:
        raise ValueError(f"Set a real MX_APIKEY in {path}")

    for name in ALIASES:
        environment[name] = api_key
    return environment


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Load Miaoxiang local.env and optionally run a child command."
    )
    parser.add_argument("--env-file", type=Path, default=DEFAULT_ENV_FILE)
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args()

    environment = os.environ.copy()
    load_local_env(args.env_file, environment)

    command = args.command
    if command and command[0] == "--":
        command = command[1:]
    if not command:
        print("Miaoxiang local.env is valid.")
        return 0

    return subprocess.run(command, env=environment, check=False).returncode


if __name__ == "__main__":
    raise SystemExit(main())
