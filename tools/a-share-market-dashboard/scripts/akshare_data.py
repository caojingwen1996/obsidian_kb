"""Bounded AKShare market-flow reader, shared by all three flow observations."""

from concurrent.futures import Future
import json
import os
from pathlib import Path
import subprocess
import sys
from threading import Lock

ROOT = Path(__file__).resolve().parents[1]
TIMEOUT_SECONDS = 25


class AKShareUnavailable(RuntimeError):
    pass


def market_fund_flow():
    """Return AKShare's named columns; amounts are yuan, ratios are percent.

    Run separately because stock_market_fund_flow has no timeout argument.
    Never include upstream exception text in the dashboard or service logs.
    """
    executable = ROOT / '.venv-akshare' / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
    python = os.environ.get('AKSHARE_PYTHON') or (str(executable) if executable.exists() else sys.executable)
    try:
        result = subprocess.run([python, str(Path(__file__).resolve()), '--worker'],
                                capture_output=True, text=True, encoding='utf-8',
                                timeout=TIMEOUT_SECONDS, check=True)
        rows = json.loads(result.stdout)
        if not isinstance(rows, list) or not rows:
            raise ValueError('empty_market_flow')
        return rows
    except (OSError, subprocess.SubprocessError, ValueError) as error:
        raise AKShareUnavailable('akshare_market_flow_unavailable') from error


def shared_market_fund_flow(loader=None):
    """Deduplicate calls and failures within one report refresh, across threads."""
    loader = loader or market_fund_flow
    future, lock = Future(), Lock()
    def get():
        with lock:
            owner = not future.running() and not future.done()
            if owner:
                future.set_running_or_notify_cancel()
        if owner:
            try:
                future.set_result(loader())
            except Exception as error:
                future.set_exception(error)
        return future.result()
    return get


if __name__ == '__main__':
    if sys.argv[1:] != ['--worker']:
        raise SystemExit(2)
    try:
        import akshare as ak
        frame = ak.stock_market_fund_flow()
        frame['日期'] = frame['日期'].astype(str)
        print(frame.to_json(orient='records', force_ascii=False))
    except Exception:
        raise SystemExit(1)
