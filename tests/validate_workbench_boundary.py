from pathlib import Path
import json
import re
import sys


ROOT = Path(__file__).resolve().parents[1]

REPORTS = {
    "2026-07-15-1514-华明装备机构级决策研报.md",
    "2026-07-15-1921-云铝股份机构级决策研报.md",
    "2026-07-16-1021-神马电力-机构级决策研报.md",
    "2026-07-16-1117-紫光股份-机构级决策研报.md",
    "2026-07-16-1136-浪潮信息-机构级决策研报.md",
    "2026-07-16-1138-东阳光-机构级决策研报.md",
    "2026-07-16-1334-中国中车机构级决策研报.md",
    "2026-07-16-1336-中材科技-机构级决策研报.md",
    "2026-07-17-1133-中国船舶机构级决策研报.md",
    "2026-07-17-1134-三花智控-机构级决策研报.md",
    "2026-07-17-1450-东材科技-机构级决策研报.md",
    "2026-07-17-1521-电科蓝天-机构级决策研报.md",
    "2026-07-17-1539-上海瀚讯-机构级决策研报.md",
    "2026-07-17-1616-中国卫星-机构级决策研报.md",
    "2026-07-17-1728-中国卫通-机构级决策研报.md",
    "2026-07-17-1744-华测导航-机构级决策研报.md",
    "2026-07-17-1813-国博电子-机构级决策研报.md",
    "2026-07-17-1825-北方导航-机构级决策研报.md",
    "2026-07-17-1830-铂力特-机构级决策研报.md",
    "2026-07-17-1833-航天电器-机构级决策研报.md",
    "2026-07-17-1855-国科微-机构级决策研报.md",
    "2026-07-17-北斗星通-机构级决策研报.md",
    "2026-07-17-四维图新-机构级决策研报.md",
    "2026-07-17-新雷能-机构级决策研报.md",
    "2026-07-17-信维通信-机构级决策研报.md",
    "2026-07-17-航天环宇-机构级决策研报.md",
    "2026-07-17-芯原股份-机构级决策研报.md",
    "2026-07-17-中科星图-机构级决策研报.md",
    "2026-07-20-1005-三安光电-机构级决策研报.md",
}

ACTIVE_PATHS = (
    "AGENTS.md",
    "schema.md",
    "page-types.md",
    "index.md",
    "hot.md",
    "wiki",
    "workbench",
    ".agents",
    "tests",
)

OLD_PATH_PATTERN = re.compile(
    r"workbench/targets/[^\]\n]+/(?:reports|index|outputs)/"
    r"|targets/<证券代码>-<公司简称>/reports"
)


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> None:
    workbench = ROOT / "workbench"
    for relative in (
        "AGENTS.md",
        "index.md",
        "templates/equity-report-template.md",
        "templates/tracking-node-template.md",
    ):
        require((workbench / relative).is_file(), f"missing Workbench contract: {relative}")

    query_dir = ROOT / "wiki" / "queries"
    remaining = sorted(path.name for path in query_dir.glob("*机构级决策研报.md"))
    require(not remaining, f"equity reports remain in wiki/queries: {remaining}")

    targets = workbench / "targets"
    target_dirs = sorted(path.name for path in targets.iterdir() if path.is_dir())
    require(not target_dirs, f"targets must be flat: {target_dirs}")

    actual_reports = sorted(path.name for path in targets.glob("*.md"))
    require(actual_reports == sorted(REPORTS), "flat report inventory mismatch")
    require(not list(workbench.rglob("*.html")), "HTML leaked into Workbench")

    for filename in REPORTS:
        report = targets / filename
        require(report.is_file(), f"migrated report missing: {report.relative_to(ROOT)}")
        content = report.read_text(encoding="utf-8-sig")
        require("artifact_type: equity_research" in content, f"missing artifact_type: {filename}")
        require(
            not re.search(r"^type:\s*(query|event|timeline)\s*$", content, re.M),
            f"wiki type leaked into Workbench: {filename}",
        )

    root_index = (ROOT / "index.md").read_text(encoding="utf-8-sig")
    require("机构级决策研报" not in root_index, "root index still lists equity reports")

    require(
        (ROOT / "sources/automations/temp/README.md").is_file(),
        "missing unclassified automation README",
    )
    require(
        (ROOT / "sources/automations/支柱产业/README.md").is_file(),
        "missing pillar-industry automation README",
    )

    equity_skill = (ROOT / ".agents/skills/bbxm-equity-research/SKILL.md").read_text(
        encoding="utf-8-sig"
    )
    require(
        "workbench/targets/YYYY-MM-DD-HHmm-<标的>-机构级决策研报.md" in equity_skill,
        "equity skill lacks Workbench output contract",
    )
    require(
        "<证券代码>-<公司简称>/reports/" not in equity_skill,
        "equity skill keeps nested Workbench output contract",
    )
    require(
        "正式研报放入合适的 `wiki/` 页面类型" not in equity_skill,
        "equity skill keeps stale Wiki output contract",
    )

    workbench_index = (workbench / "index.md").read_text(encoding="utf-8-sig")
    require(
        not any(marker in workbench_index for marker in ("/index", "/reports/", "/outputs/")),
        "Workbench index keeps nested links",
    )

    stale_paths = []
    for relative in ACTIVE_PATHS:
        path = ROOT / relative
        candidates = [path] if path.is_file() else path.rglob("*")
        for candidate in candidates:
            if candidate.resolve() == Path(__file__).resolve():
                continue
            if not candidate.is_file() or candidate.suffix not in {".md", ".py", ".yaml"}:
                continue
            content = candidate.read_text(encoding="utf-8-sig")
            if OLD_PATH_PATTERN.search(content):
                stale_paths.append(str(candidate.relative_to(ROOT)))
    require(not stale_paths, f"active files keep nested Workbench paths: {stale_paths}")

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
