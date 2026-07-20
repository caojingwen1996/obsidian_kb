from pathlib import Path
import json
import re
import sys


ROOT = Path(__file__).resolve().parents[1]

REPORTS = {
    "2026-07-15-1514-华明装备机构级决策研报.md": "002270-华明装备",
    "2026-07-15-1921-云铝股份机构级决策研报.md": "000807-云铝股份",
    "2026-07-16-1021-神马电力-机构级决策研报.md": "603530-神马电力",
    "2026-07-16-1117-紫光股份-机构级决策研报.md": "000938-紫光股份",
    "2026-07-16-1136-浪潮信息-机构级决策研报.md": "000977-浪潮信息",
    "2026-07-16-1138-东阳光-机构级决策研报.md": "600673-东阳光",
    "2026-07-16-1334-中国中车机构级决策研报.md": "601766-中国中车",
    "2026-07-16-1336-中材科技-机构级决策研报.md": "002080-中材科技",
    "2026-07-17-1133-中国船舶机构级决策研报.md": "600150-中国船舶",
    "2026-07-17-1134-三花智控-机构级决策研报.md": "002050-三花智控",
    "2026-07-17-1450-东材科技-机构级决策研报.md": "601208-东材科技",
    "2026-07-17-1521-电科蓝天-机构级决策研报.md": "688818-电科蓝天",
    "2026-07-17-1539-上海瀚讯-机构级决策研报.md": "300762-上海瀚讯",
    "2026-07-20-1005-三安光电-机构级决策研报.md": "600703-三安光电",
}


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> None:
    workbench = ROOT / "workbench"
    for relative in (
        "AGENTS.md",
        "index.md",
        "templates/target-index-template.md",
        "templates/equity-report-template.md",
        "templates/tracking-node-template.md",
    ):
        require((workbench / relative).is_file(), f"missing Workbench contract: {relative}")

    query_dir = ROOT / "wiki" / "queries"
    remaining = sorted(path.name for path in query_dir.glob("*机构级决策研报.md"))
    require(not remaining, f"equity reports remain in wiki/queries: {remaining}")

    for filename, target in REPORTS.items():
        report = workbench / "targets" / target / "reports" / filename
        require(report.is_file(), f"migrated report missing: {report.relative_to(ROOT)}")
        content = report.read_text(encoding="utf-8-sig")
        require("artifact_type: equity_research" in content, f"missing artifact_type: {filename}")
        require(
            not re.search(r"^type:\s*(query|event|timeline)\s*$", content, re.M),
            f"wiki type leaked into Workbench: {filename}",
        )

    root_index = (ROOT / "index.md").read_text(encoding="utf-8-sig")
    require("机构级决策研报" not in root_index, "root index still lists equity reports")

    equity_skill = (ROOT / ".agents/skills/bbxm-equity-research/SKILL.md").read_text(
        encoding="utf-8-sig"
    )
    require(
        "workbench/targets/<证券代码>-<公司简称>/reports/" in equity_skill,
        "equity skill lacks Workbench output contract",
    )
    require(
        "正式研报放入合适的 `wiki/` 页面类型" not in equity_skill,
        "equity skill keeps stale Wiki output contract",
    )

    graph = json.loads((ROOT / ".obsidian/graph.json").read_text(encoding="utf-8-sig"))
    require(graph.get("search") == '-path:"workbench"', "graph does not exclude Workbench")

    runtime = "".join(
        path.read_text(encoding="utf-8-sig") for path in (workbench / "templates").glob("*.md")
    )
    require(
        not any(marker in runtime for marker in ("�", "鍐", "鐽", "鎯", "灏")),
        "Workbench templates contain mojibake",
    )

    print("PASS: Workbench and Wiki boundary validated")


if __name__ == "__main__":
    try:
        main()
    except AssertionError as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        raise SystemExit(1)
