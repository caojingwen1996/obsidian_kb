from pathlib import Path
import json
import re
import sys


REPO_ROOT = Path(__file__).resolve().parents[1]
SKILL_ROOT = REPO_ROOT / ".agents" / "skills" / "bbxm-three-factor-analysis"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def read(relative_path: str) -> str:
    return (SKILL_ROOT / relative_path).read_text(encoding="utf-8-sig")


def main() -> None:
    required_files = (
        "SKILL.md",
        "template.md",
        "agents/openai.yaml",
        "evals/evals.json",
    )
    for relative_path in required_files:
        require(
            (SKILL_ROOT / relative_path).is_file(),
            f"missing standalone three-factor skill file: {relative_path}",
        )

    skill = read("SKILL.md")
    template = read("template.md")
    interface = read("agents/openai.yaml")
    evals = json.loads(read("evals/evals.json"))

    risk_skill = (
        REPO_ROOT / ".agents" / "skills" / "risk-identification" / "SKILL.md"
    ).read_text(encoding="utf-8-sig")

    for forbidden in ("检查体系三要素", "买入窗口", "交易动作", "buy / sell / reduce"):
        require(forbidden not in risk_skill, f"risk skill still owns forbidden responsibility: {forbidden}")

    require(
        "bbxm-three-factor-analysis" not in risk_skill,
        "risk skill must not invoke the three-factor skill",
    )

    unauthorized_risk_markers = (
        "不确定",
        "增强 / 持平 / 减弱 / 重新增强",
        "仓位建议",
        "买入建议",
        "卖出建议",
        "加仓建议",
        "减仓建议",
        "完整研报",
        "## 交易",
        "## 行动",
        "建仓",
        "止损",
        "持仓处置",
        "仓位处置",
        "交易执行",
        "进场时机",
        "入场时机",
        "目标价分析",
        "DCF",
        "公允价值",
        "信息处理结论",
        "该不该交易",
        "行动建议",
        "交易结论",
        "仓位结论",
        "买卖结论",
    )
    for marker in unauthorized_risk_markers:
        require(marker not in risk_skill, f"risk skill contains unauthorized marker: {marker}")

    for marker in ("风险增强", "风险持平", "风险减弱", "风险重新增强", "证据不足"):
        require(marker in risk_skill, f"risk skill is missing direction marker: {marker}")

    required_risk_scope_markers = (
        "只判断风险方向",
        "仅输出风险方向与证据",
    )
    for marker in required_risk_scope_markers:
        require(marker in risk_skill, f"risk skill is missing explicit scope marker: {marker}")

    require(
        "最终状态只能从：风险增强 / 风险持平 / 风险减弱 / 风险重新增强 / 证据不足"
        in risk_skill,
        "risk skill must declare the exact final-state vocabulary",
    )

    required_risk_structure_markers = (
        "识别对象",
        "观察窗口",
        "比较窗口",
        "截止时间",
        "来源分类",
        "功能分类",
        "基本面风险",
        "情绪风险",
        "流动性风险",
        "估值风险",
        "前一窗口",
        "当前窗口",
    )
    for marker in required_risk_structure_markers:
        require(marker in risk_skill, f"risk skill is missing structural marker: {marker}")

    required_risk_output_markers = (
        "风险方向结论",
        "证据",
        "反证",
        "风险传导链",
        "验证指标",
        "失效条件",
        "未获取到",
        "置信度",
        "一句话结论",
    )
    for marker in required_risk_output_markers:
        require(marker in risk_skill, f"risk skill output is missing: {marker}")

    require(
        risk_skill.count("- 风险方向结论：") == 1,
        "risk skill output must contain exactly one final direction field",
    )

    mermaid_terminal = "N[风险方向结论]"
    require(mermaid_terminal in risk_skill, "risk skill Mermaid is missing its terminal node")
    require(
        re.search(r"(?m)^\s*N\s*--.*>", risk_skill) is None,
        "risk skill Mermaid terminal node must not have an outgoing arrow",
    )

    equity_skill = (
        REPO_ROOT / ".agents" / "skills" / "equity-research" / "SKILL.md"
    ).read_text(encoding="utf-8-sig")
    equity_template = (
        REPO_ROOT / ".agents" / "skills" / "equity-research" / "template.md"
    ).read_text(encoding="utf-8-sig")
    trade_skill = (
        REPO_ROOT / ".agents" / "skills" / "trade-ticket-review" / "SKILL.md"
    ).read_text(encoding="utf-8-sig")

    require(
        "bbxm-three-factor-analysis" in equity_skill,
        "equity research must use the standalone three-factor skill",
    )
    require(
        "三要素结论来源" in equity_template,
        "equity template must identify the three-factor result source",
    )
    require(
        "风险方向结论" in equity_template,
        "equity template must separate the risk-direction result",
    )
    require(
        "风险累积 / 风险暴露 / 风险释放 / 风险转弱 / 风险重新转强"
        not in equity_template,
        "equity template must not use the retired risk-stage vocabulary",
    )
    require(
        "风险尚未转弱时" not in equity_skill and "买入窗口" not in equity_skill,
        "equity research must not turn risk direction into a three-factor gate",
    )
    require(
        "bbxm-three-factor-analysis" in trade_skill,
        "trade review must reference the standalone three-factor skill",
    )
    require(
        "不复制其检查清单" in trade_skill,
        "trade review must consume rather than duplicate the three-factor model",
    )

    require(
        "### 11.1 三要素结果引用" in equity_template,
        "equity template must expose one imported three-factor result interface",
    )
    for marker in (
        "核心反证",
        "失效条件",
        "数据缺口",
        "新增现金",
        "已有持仓",
        "下一验证节点",
    ):
        require(
            marker in equity_template,
            f"equity template imported result is missing: {marker}",
        )

    for duplicated_heading in (
        "### 11.2 产业方向与竞争格局",
        "### 11.3 流动性来源与退出路径",
        "### 11.4 情绪阶段与证据",
    ):
        require(
            duplicated_heading not in equity_template,
            f"equity template duplicates the standalone checklist: {duplicated_heading}",
        )

    for phase in ("冰点", "试错", "扩散", "拥挤", "退潮", "修复"):
        require(
            phase in skill,
            f"standalone skill is missing canonical sentiment phase: {phase}",
        )
    require(
        "扩散 / 拥挤 / 释放 / 转弱 / 无法确认" not in equity_template,
        "equity template must not redefine the sentiment vocabulary",
    )

    unavailable_eval = next(
        item for item in evals["evals"] if item["id"] == "current-data-unavailable"
    )
    require(
        "新资金行动映射为 observe" in unavailable_eval["expected_output"]
        and "observe 或 review" not in unavailable_eval["expected_output"],
        "missing-data eval must keep new cash on observe rather than review",
    )

    required_skill_markers = (
        "name: bbxm-three-factor-analysis",
        "竞争格局",
        "流动性辩证分析",
        "情绪位置变化",
        "有利 / 中性 / 不利 / 证据不足",
        "buy / sell / reduce / wait / observe / review",
        "不负责风险增强或减弱判断",
    )
    for marker in required_skill_markers:
        require(marker in skill, f"SKILL.md is missing contract marker: {marker}")

    required_template_markers = (
        "三要素状态总表",
        "证据",
        "反证",
        "失效条件",
        "新增现金",
        "已有持仓",
        "数据缺口",
        "置信度",
    )
    for marker in required_template_markers:
        require(marker in template, f"template.md is missing: {marker}")

    require("allow_implicit_invocation: true" in interface, "implicit invocation must be enabled")
    require(evals.get("skill_name") == "bbxm-three-factor-analysis", "wrong eval skill name")
    require(len(evals.get("evals", [])) >= 5, "at least five routing scenarios are required")

    runtime_text = skill + template + interface
    require(
        not any(marker in runtime_text for marker in ("�", "鍐", "鐭", "鎯", "灏")),
        "encoding scan found mojibake markers",
    )

    print("PASS: standalone BBXM three-factor skill contract validated")


if __name__ == "__main__":
    try:
        main()
    except (AssertionError, FileNotFoundError, json.JSONDecodeError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        raise SystemExit(1)
