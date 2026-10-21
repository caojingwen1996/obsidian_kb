"""Versioned daily settings shared by the local dashboard and signal task."""
from __future__ import annotations

import json
import os
from contextlib import contextmanager
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from pathlib import Path
from threading import Lock
from uuid import uuid4

try:
    from .scoring import load_default_strategy, validate_strategy, normalize_strategy
except ImportError:
    from scoring import load_default_strategy, validate_strategy, normalize_strategy

SETTINGS_RELATIVE_PATH = Path("sources/automations/中证红利信号/策略参数.json")
LEGACY_SETTINGS_RELATIVE_PATH = Path("tools/a-share-market-dashboard/data/红利信号/strategy-settings.json")
DEFAULT_SETTINGS_PATH = Path(__file__).resolve().parents[4] / SETTINGS_RELATIVE_PATH
_LOCK = Lock()


class StrategyConflict(ValueError):
    pass


def _read_settings(path):
    try:
        settings = json.loads(path.read_text(encoding="utf-8-sig"))
    except FileNotFoundError:
        strategy = load_default_strategy()
        return {"schemaVersion": 1, "revision": 0, "strategy": strategy, "updatedAt": None,
                "history": [{"revision": 0, "strategy": deepcopy(strategy), "appliedAt": None}]}
    if not isinstance(settings, dict) or settings.get("schemaVersion") != 1:
        raise ValueError("每日策略配置格式无效")
    revision = settings.get("revision")
    if isinstance(revision, bool) or not isinstance(revision, int) or revision < 1:
        raise ValueError("每日策略版本无效")
    strategy, history = settings.get("strategy"), settings.get("history")
    if not isinstance(strategy, dict) or validate_strategy(strategy) or not isinstance(history, list) or not history:
        raise ValueError("每日策略参数或历史无效")
    if not isinstance(history[-1], dict) or history[-1].get("revision") != revision or history[-1].get("strategy") != strategy:
        raise ValueError("每日策略历史与当前版本不一致")
    return settings


def migrate_legacy_settings(path=None):
    path = Path(path or DEFAULT_SETTINGS_PATH).resolve()
    if path.exists() or not path.as_posix().endswith("/" + SETTINGS_RELATIVE_PATH.as_posix()):
        return path
    legacy = path.parents[3] / LEGACY_SETTINGS_RELATIVE_PATH
    if not legacy.exists():
        return path
    path.parent.mkdir(parents=True, exist_ok=True)
    with settings_lock(path):
        if path.exists() or not legacy.exists():
            return path
        _read_settings(legacy)  # Reject damaged configuration instead of resetting parameters.
        raw = legacy.read_bytes()
        backup = path.parent / "备份/策略参数迁移" / uuid4().hex / "strategy-settings.json"
        backup.parent.mkdir(parents=True, exist_ok=True)
        with backup.open("xb") as output:
            output.write(raw)
        temporary = path.with_suffix(".json.tmp")
        temporary.write_bytes(raw)
        temporary.replace(path)
        legacy.unlink()
    return path


def read_settings(path=None):
    return _read_settings(migrate_legacy_settings(path))


@contextmanager
def settings_lock(path):
    # Separate launcher processes may share this file; the OS lock protects the revision check.
    with _LOCK, path.with_suffix(".lock").open("a+b") as lock_file:
        if os.name == "nt":
            import msvcrt
            lock_file.seek(0)
            if not lock_file.read(1):
                lock_file.write(b"0")
                lock_file.flush()
            lock_file.seek(0)
            msvcrt.locking(lock_file.fileno(), msvcrt.LK_LOCK, 1)
            try:
                yield
            finally:
                lock_file.seek(0)
                msvcrt.locking(lock_file.fileno(), msvcrt.LK_UNLCK, 1)
        else:
            import fcntl
            fcntl.flock(lock_file, fcntl.LOCK_EX)
            try:
                yield
            finally:
                fcntl.flock(lock_file, fcntl.LOCK_UN)


def save_settings(strategy, expected_revision, path=None):
    if not isinstance(strategy, dict):
        raise ValueError("策略参数格式无效")
    if isinstance(expected_revision, bool) or not isinstance(expected_revision, int) or expected_revision < 0:
        raise ValueError("每日策略版本无效")
    strategy = normalize_strategy(strategy)
    defaults = load_default_strategy()
    clean = {"version": defaults["version"], **{k: deepcopy(strategy.get(k)) for k in ("weights", "anchors", "thresholds", "confirmationDays")}}
    if any(not isinstance(clean.get(k), dict) for k in ("weights", "anchors", "thresholds")):
        raise ValueError("策略参数格式无效")
    errors = validate_strategy(clean)
    if errors:
        raise ValueError("；".join(dict.fromkeys(e["message"] for e in errors)))
    clean["weights"] = {k: clean["weights"][k] for k in defaults["weights"]}
    clean["anchors"] = {k: clean["anchors"][k] for k in defaults["anchors"]}
    clean["thresholds"] = {k: clean["thresholds"][k] for k in defaults["thresholds"]}
    path = migrate_legacy_settings(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with settings_lock(path):
        current = _read_settings(path)
        if expected_revision != current["revision"]:
            raise StrategyConflict("每日策略已被其他页面更新，请刷新配置后重试；当前试算参数保留。")
        if all(current["strategy"][k] == clean[k] for k in ("weights", "anchors", "thresholds", "confirmationDays")):
            return dict(current, changed=False)
        revision = current["revision"] + 1
        clean["version"] = f"{defaults['version']}-r{revision}"
        applied_at = datetime.now(timezone(timedelta(hours=8))).isoformat(timespec="seconds")
        history = current["history"] + [{"revision": revision, "strategy": deepcopy(clean), "appliedAt": applied_at}]
        saved = {"schemaVersion": 1, "revision": revision, "strategy": clean, "updatedAt": applied_at, "history": history}
        temporary = path.with_suffix(".json.tmp")
        temporary.write_text(json.dumps(saved, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
        temporary.replace(path)
        return dict(saved, changed=True)
