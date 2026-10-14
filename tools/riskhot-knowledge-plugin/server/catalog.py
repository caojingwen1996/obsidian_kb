"""Safely browse a bounded project tree. This module has no MCP dependency."""

from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
import os

TEXT_EXTS = {
    ".md", ".markdown", ".txt", ".json", ".jsonl", ".yaml", ".yml", ".toml",
    ".csv", ".mmd", ".mermaid", ".puml", ".plantuml", ".drawio",
    ".xml", ".svg", ".html", ".css", ".js", ".jsx", ".ts", ".tsx",
    ".py", ".sh", ".sql", ".go", ".rs", ".c", ".h", ".cpp", ".hpp",
    ".java", ".proto", ".graphql", ".conf", ".ini",
}
# Default-deny hidden paths to prevent accidental exposure of secrets, Git, and
# editor configuration. Restrict the MCP server to a dedicated RiskHot root.
SKIP_DIRS = {"node_modules", "__pycache__", "dist", "build", ".git", ".obsidian", ".venv", "venv", "target"}
MAX_TEXT_BYTES = 1024 * 1024
MAX_SCAN_FILES = 10000


class Catalog:
    def __init__(self, root: str | Path):
        self.root = Path(root).expanduser().resolve(strict=True)
        if not self.root.is_dir():
            raise ValueError("RISK_HOT_ROOT must be a directory")

    @staticmethod
    def _allowed_name(name: str, is_dir: bool = False) -> bool:
        if name.startswith(".") or name in SKIP_DIRS:
            return False
        if name in {".env", ".DS_Store"}:
            return False
        return True

    def _resolve(self, relative: str) -> Path:
        candidate = Path(relative)
        if candidate.is_absolute() or ".." in candidate.parts:
            raise ValueError("Only relative paths inside RiskHot are allowed")
        if any(not self._allowed_name(part) for part in candidate.parts):
            raise ValueError("Hidden paths and ignored paths are unavailable")
        resolved = (self.root / candidate).resolve(strict=True)
        if not resolved.is_relative_to(self.root):
            raise ValueError("Path must remain inside the RiskHot project")
        if resolved.is_symlink():
            raise ValueError("Symlinks are unavailable")
        return resolved

    def _rel(self, path: Path) -> str:
        return path.relative_to(self.root).as_posix()

    def _walk(self, prefix: str = ""):
        base = self._resolve(prefix) if prefix else self.root
        if base.is_file():
            if self._allowed_name(base.name):
                yield base
            return
        scanned = 0
        for dirpath, dirs, files in os.walk(base, followlinks=False):
            dirs[:] = sorted(
                d for d in dirs if self._allowed_name(d, True)
                and not (Path(dirpath) / d).is_symlink()
            )
            for filename in sorted(files):
                if not self._allowed_name(filename):
                    continue
                file = Path(dirpath) / filename
                if file.is_symlink() or not file.is_file():
                    continue
                scanned += 1
                if scanned > MAX_SCAN_FILES:
                    return
                yield file

    @staticmethod
    def _stamp(path: Path) -> str:
        return datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat()

    def _info(self, path: Path) -> dict[str, Any]:
        return {
            "path": self._rel(path),
            "type": "searchable-text" if path.suffix.lower() in TEXT_EXTS else "asset-metadata-only",
            "size_bytes": path.stat().st_size,
            "modified_utc": self._stamp(path),
        }

    def manifest(self) -> dict[str, Any]:
        files = list(self._walk())
        types = Counter((p.suffix.lower() or "<no extension>") for p in files)
        roots = Counter(p.relative_to(self.root).parts[0] for p in files)
        searchable = sum(p.suffix.lower() in TEXT_EXTS and p.stat().st_size <= MAX_TEXT_BYTES for p in files)
        return {
            "project": self.root.name,
            "root": str(self.root),
            "total_visible_files": len(files),
            "searchable_text_files": searchable,
            "extension_counts": dict(types.most_common()),
            "top_level_counts": dict(roots.most_common()),
            "notes": [
                "The root is bounded to the selected project directory.",
                "Hidden files, secrets/config directories, and symlinks are excluded.",
                "PDF, DOCX, images, and other binary content are listed by metadata but not parsed in v1.",
                "Files over 1 MiB are listed but not read/searchable in v1.",
                "This is on-demand access, not an upload of all files into the model context.",
            ],
        }

    def list_files(self, prefix: str = "", limit: int = 100) -> dict[str, Any]:
        limit = max(1, min(int(limit), 300))
        files = []
        for p in self._walk(prefix):
            files.append(self._info(p))
            if len(files) >= limit:
                break
        return {"prefix": prefix, "files": files, "limit": limit}

    def _read_text(self, path: Path) -> list[str]:
        if path.suffix.lower() not in TEXT_EXTS:
            raise ValueError("Binary/unsupported file: metadata only in v1")
        if path.stat().st_size > MAX_TEXT_BYTES:
            raise ValueError("File exceeds the 1 MiB text limit")
        return path.read_text(encoding="utf-8", errors="replace").splitlines()

    def read_file(self, path: str, start_line: int = 1, max_lines: int = 120) -> dict[str, Any]:
        file = self._resolve(path)
        if not file.is_file():
            raise ValueError("Requested path must be a file")
        start_line = max(1, int(start_line))
        max_lines = max(1, min(250, int(max_lines)))
        lines = self._read_text(file)
        selection = lines[start_line - 1: start_line - 1 + max_lines]
        data = "\n".join(f"L{start_line+i}: {line}" for i, line in enumerate(selection))
        if len(data) > 25000:
            data = data[:25000] + "\n[TRUNCATED; request a smaller line range]"
        return {
            "path": self._rel(file),
            "total_lines": len(lines),
            "start_line": start_line,
            "returned_lines": len(selection),
            "modified_utc": self._stamp(file),
            "text": data,
        }

    def search(self, query: str, limit: int = 20) -> dict[str, Any]:
        query = query.strip()
        if not query or len(query) > 180:
            raise ValueError("Query must have 1–180 characters")
        q = query.casefold()
        limit = max(1, min(50, int(limit)))
        results = []
        for p in self._walk():
            if p.suffix.lower() not in TEXT_EXTS or p.stat().st_size > MAX_TEXT_BYTES:
                continue
            try:
                for n, line in enumerate(self._read_text(p), start=1):
                    if q in line.casefold():
                        results.append({
                            "path": self._rel(p), "line": n,
                            "snippet": line.strip()[:360], "modified_utc": self._stamp(p),
                        })
                        if len(results) >= limit:
                            return {"query": query, "hits": results, "limit": limit, "truncated": True}
            except (OSError, UnicodeError):
                continue
        return {"query": query, "hits": results, "limit": limit, "truncated": False}

    def outline(self, path: str) -> dict[str, Any]:
        p = self._resolve(path)
        if not p.is_file() or p.suffix.lower() not in {".md", ".markdown"}:
            raise ValueError("Outline requires a Markdown file")
        headings = []
        for i, line in enumerate(self._read_text(p), start=1):
            level = len(line) - len(line.lstrip("#"))
            if 1 <= level <= 6 and line[level:level+1] == " ":
                headings.append({"line": i, "level": level, "title": line[level:].strip()})
                if len(headings) >= 250:
                    break
        return {"path": self._rel(p), "headings": headings}

    def changes_since(self, since_iso: str, limit: int = 100) -> dict[str, Any]:
        date = datetime.fromisoformat(since_iso.replace("Z", "+00:00"))
        if date.tzinfo is None:
            raise ValueError("Timestamp must include a timezone offset")
        limit = max(1, min(300, int(limit)))
        changed = []
        for p in self._walk():
            if datetime.fromtimestamp(p.stat().st_mtime, tz=timezone.utc) > date:
                changed.append(self._info(p))
        changed.sort(key=lambda f: f["modified_utc"], reverse=True)
        return {"since": since_iso, "files": changed[:limit], "total_found": len(changed)}
