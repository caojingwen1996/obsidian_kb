#!/usr/bin/env python3
"""Check Markdown table widths and escaped Obsidian link aliases (read-only)."""

import argparse
import re
from pathlib import Path


def pipe_positions(line):
    """A pipe is escaped only when preceded by an odd number of backslashes."""
    positions = []
    backslashes = 0
    for index, char in enumerate(line):
        if char == "|" and backslashes % 2 == 0:
            positions.append(index)
        backslashes = backslashes + 1 if char == "\\" else 0
    return positions


def cells(line):
    positions = pipe_positions(line)
    result = []
    start = 0
    for position in positions:
        result.append(line[start:position].strip())
        start = position + 1
    result.append(line[start:].strip())
    if positions and positions[0] == 0:
        result.pop(0)
    if positions and positions[-1] == len(line) - 1:
        result.pop()
    return result


def check(text):
    lines = []
    fence = None
    frontmatter = False
    for number, raw in enumerate(text.splitlines(), 1):
        if number == 1 and raw.strip() == "---":
            frontmatter = True
            lines.append("")
            continue
        if frontmatter:
            if raw.strip() in ("---", "..."):
                frontmatter = False
            lines.append("")
            continue
        line = re.sub(r"^(?:\s*>\s?)+", "", raw).strip()
        marker = re.match(r"^(`{3,}|~{3,})(.*)$", line)
        if fence:
            if marker and marker[1][0] == fence[0] and len(marker[1]) >= len(fence) and not marker[2].strip():
                fence = None
            lines.append("")
            continue
        if marker:
            fence = marker[1]
            lines.append("")
            continue
        lines.append(line)

    errors = []
    checked = set()
    for index, line in enumerate(lines):
        separator = cells(line)
        if index == 0 or not pipe_positions(line) or not separator:
            continue
        if not all(re.fullmatch(r":?-{3,}:?", cell) for cell in separator):
            continue
        if not lines[index - 1] or not pipe_positions(lines[index - 1]):
            continue
        expected = len(separator)
        row = index - 1
        while row < len(lines) and lines[row] and pipe_positions(lines[row]):
            if row not in checked:
                checked.add(row)
                actual = len(cells(lines[row]))
                if actual != expected:
                    errors.append((row + 1, f"表格应为 {expected} 列，实际 {actual} 列"))
                for link in re.finditer(r"!?\[\[[^\]\n]+\]\]", lines[row]):
                    if pipe_positions(link[0]):
                        errors.append((row + 1, r"表格双链的显示名分隔符必须写成 \|"))
            row += 1
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("files", nargs="+", type=Path, help="本次新增或修改的 Markdown 文件")
    args = parser.parse_args()
    failed = False
    for path in args.files:
        try:
            errors = check(path.read_text(encoding="utf-8-sig"))
        except (OSError, UnicodeError) as error:
            print(f"{path}: 无法读取：{error}")
            failed = True
            continue
        for line, message in errors:
            print(f"{path}:{line}: {message}")
        failed |= bool(errors)
    if not failed:
        print(f"表格检查通过（{len(args.files)} 个文件）。")
    return int(failed)


if __name__ == "__main__":
    raise SystemExit(main())
