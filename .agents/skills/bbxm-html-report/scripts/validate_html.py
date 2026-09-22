"""Check report structure and inline syntax, not content accuracy or rendering."""
import argparse
import json
from html.parser import HTMLParser
from pathlib import Path
import shutil
import subprocess
import tempfile


class Report(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags = []
        self.ids = []
        self.anchors = []
        self.scripts = []
        self.active = None
        self.title = ""
        self.in_title = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        self.tags.append((tag, attrs))
        if "id" in attrs:
            self.ids.append(attrs["id"])
        if tag == "a" and attrs.get("href", "").startswith("#"):
            self.anchors.append(attrs["href"][1:])
        if tag == "title":
            self.in_title = True
        if tag == "script":
            self.active = [attrs, ""]

    def handle_data(self, data):
        if self.in_title:
            self.title += data
        if self.active is not None:
            self.active[1] += data

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
        if tag == "script" and self.active is not None:
            self.scripts.append(self.active)
            self.active = None


def validate(path, node):
    text = path.read_text(encoding="utf-8-sig")
    report = Report()
    report.feed(text)
    errors = []
    if "<!doctype html>" not in text.lower():
        errors.append("Missing HTML doctype")
    if not report.title.strip() or sum(t == "h1" for t, _ in report.tags) != 1:
        errors.append("Need a nonempty title and exactly one h1")
    if not any(t == "html" and a.get("lang") for t, a in report.tags):
        errors.append("Missing document language")
    for key, value in [("charset", "utf-8"), ("name", "viewport")]:
        if not any(t == "meta" and a.get(key, "").lower() == value for t, a in report.tags):
            errors.append("Missing meta " + value)
    if len(report.ids) != len(set(report.ids)):
        errors.append("Duplicate element id")
    if any(anchor and anchor not in report.ids for anchor in report.anchors):
        errors.append("Unresolved local anchor")
    if report.active is not None:
        errors.append("Unclosed script element")
    if "\ufffd" in text or any(0xE000 <= ord(c) <= 0xF8FF for c in text):
        errors.append("Replacement or private-use character found")
    checked = 0
    with tempfile.TemporaryDirectory(prefix="bbxm-html-check-") as temp:
        for i, (attrs, body) in enumerate(report.scripts):
            kind = attrs.get("type", "").lower().strip()
            if kind in {"application/json", "application/ld+json", "importmap"}:
                try:
                    json.loads(body)
                except ValueError as exc:
                    errors.append(f"Data script {i}: {exc}")
            elif not attrs.get("src") and kind in {"", "module", "text/javascript", "application/javascript"}:
                if not node:
                    errors.append("Node unavailable: inline JS NOT checked")
                    continue
                script = Path(temp) / (f"inline-{i}" + (".mjs" if kind == "module" else ".js"))
                script.write_text(body, encoding="utf-8")
                result = subprocess.run([node, "--check", str(script)], capture_output=True, text=True, encoding="utf-8", errors="replace")
                if result.returncode:
                    errors.append(f"Script {i}: {result.stderr.strip()}")
                checked += 1
    return errors, checked


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("html", type=Path)
    parser.add_argument("--node", default=shutil.which("node"))
    args = parser.parse_args()
    errors, checked = validate(args.html, args.node)
    print(json.dumps({"passed": not errors, "inline_js_checked": checked, "errors": errors,
                      "scope": "structure and inline syntax only; content, external assets and browser rendering require separate checks"}, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
