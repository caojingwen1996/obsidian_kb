from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
SKILL_ROOT = REPO_ROOT / ".agents" / "skills" / "bbxm-industry-analysis"
REPORT = REPO_ROOT / "wiki" / "queries" / "2026-07-17-商业航天产业完整分析报告.md"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> None:
    skill = (SKILL_ROOT / "SKILL.md").read_text(encoding="utf-8-sig")
    template = (SKILL_ROOT / "template.md").read_text(encoding="utf-8-sig")
    report = REPORT.read_text(encoding="utf-8-sig")

    for marker in (
        "产业链公司映射",
        "业务占比或纯度",
        "证据状态",
        "上游、中游、下游",
        "不得把集团任务直接映射为上市公司收入",
    ):
        require(marker in skill, f"industry skill is missing company-map contract: {marker}")

    for marker in (
        "### 3.1.1 产业链公司映射",
        "上市属性 / 证券代码",
        "业务占比或纯度",
        "证据状态",
        "不得把集团任务直接映射为上市公司收入",
    ):
        require(marker in template, f"industry template is missing company-map field: {marker}")

    for marker in (
        "### 3.1.1 产业链公司映射",
        "业务占比或纯度",
        "上海格思航天",
        "中国卫星",
        "上海瀚讯",
        "电科蓝天",
        "铖昌科技",
        "航天环宇",
    ):
        require(marker in report, f"commercial-space report is missing company mapping: {marker}")

    print("PASS: industry company mapping contract is present")


if __name__ == "__main__":
    main()
