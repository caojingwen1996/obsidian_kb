from pathlib import Path
import sys


PLUGIN_ROOT = Path(__file__).resolve().parents[1]
ROUTER_PATH = PLUGIN_ROOT / "skills" / "bbxm-expert" / "SKILL.md"
SKILL_PATH = PLUGIN_ROOT / "skills" / "equity-research" / "SKILL.md"
TEMPLATE_PATH = PLUGIN_ROOT / "skills" / "equity-research" / "template.md"
OPENAI_PATH = PLUGIN_ROOT / "skills" / "equity-research" / "agents" / "openai.yaml"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def require_contains(text: str, expected: str, context: str) -> None:
    require(expected in text, f"{context} is missing: {expected}")


def main() -> None:
    require(SKILL_PATH.is_file(), "equity-research SKILL.md is missing")
    require(TEMPLATE_PATH.is_file(), "equity-research template.md is missing")
    require(OPENAI_PATH.is_file(), "equity-research agents/openai.yaml is missing")

    router = ROUTER_PATH.read_text(encoding="utf-8-sig")
    skill = SKILL_PATH.read_text(encoding="utf-8-sig")
    template = TEMPLATE_PATH.read_text(encoding="utf-8-sig")
    openai = OPENAI_PATH.read_text(encoding="utf-8-sig")

    for route in (
        "`equity-research`",
        "`information-filter-flow`",
        "`risk-identification`",
        "`trade-ticket-review`",
    ):
        require_contains(router, route, "router")

    for expected in (
        "name: equity-research",
        "我的判断",
        "未获取到",
        "DCF",
        "敏感性分析",
        "行业特定估值",
        "buy / sell / reduce / wait / observe / review",
        "YYYY-MM-DD-HHmm-<标的>-机构级决策研报.md",
    ):
        require_contains(skill, expected, "SKILL.md")

    for expected in (
        "事实",
        "我的判断",
        "来源冲突",
        "未获取到",
        "相对估值",
        "DCF",
        "敏感性分析",
        "行业特定估值",
        "如果今天这是一笔现金，我会买它吗",
        "后续监控指标",
    ):
        require_contains(template, expected, "template.md")

    require_contains(openai, 'display_name: "机构级个股研究"', "agents/openai.yaml")
    require_contains(openai, "Use $equity-research", "agents/openai.yaml")

    all_text = router + skill + template + openai
    require(not any(marker in all_text for marker in ("�", "鍐", "鐭", "鎯", "灏")),
            "encoding scan found mojibake markers")

    print("PASS: equity-research skill contract validated")


if __name__ == "__main__":
    try:
        main()
    except AssertionError as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        raise SystemExit(1)
