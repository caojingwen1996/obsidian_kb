from pathlib import Path
import sys


REPO_ROOT = Path(__file__).resolve().parents[1]
SKILLS_ROOT = REPO_ROOT / ".agents" / "skills"

EXPECTED_FILES = {
    "bbxm-expert": (
        "SKILL.md",
        "bbxm-expert-SKILL-strong-trigger.md",
    ),
    "bbxm-three-factor-analysis": (
        "SKILL.md",
        "template.md",
        "agents/openai.yaml",
        "evals/evals.json",
    ),
    "equity-research": (
        "SKILL.md",
        "template.md",
        "agents/openai.yaml",
    ),
    "information-filter-flow": (
        "SKILL.md",
        "template.md",
        "financial-information-types.md",
        "non-financial-information-types.md",
        "agents/openai.yaml",
    ),
    "bbxm-industry-analysis": (
        "SKILL.md",
        "agents/openai.yaml",
    ),
    "risk-identification": ("SKILL.md",),
    "trade-ticket-review": (
        "SKILL.md",
        "agents/openai.yaml",
    ),
}


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> None:
    for skill_name, relative_files in EXPECTED_FILES.items():
        skill_root = SKILLS_ROOT / skill_name
        for relative_file in relative_files:
            require(
                (skill_root / relative_file).is_file(),
                f"project skill file is missing: {skill_name}/{relative_file}",
            )

    router = (SKILLS_ROOT / "bbxm-expert" / "SKILL.md").read_text(encoding="utf-8-sig")
    require("项目级" in router, "bbxm-expert must identify itself as project-local")
    for child_skill in (
        "bbxm-three-factor-analysis",
        "equity-research",
        "information-filter-flow",
        "bbxm-industry-analysis",
        "risk-identification",
        "trade-ticket-review",
    ):
        require(child_skill in router, f"bbxm-expert router is missing {child_skill}")

    industry_skill = (
        SKILLS_ROOT / "bbxm-industry-analysis" / "SKILL.md"
    ).read_text(encoding="utf-8-sig")
    for marker in (
        "wiki/concepts/冰冰小美-framework-产业思维.md",
        "经济周期",
        "政府干预经济周期",
        "企业盈利周期",
        "投资人心理与情绪钟摆",
        "风险态度周期",
        "信贷周期",
        "不良债权周期",
        "房地产周期",
        "市场周期",
        "成功周期",
        "当前阶段",
        "产业证据",
        "传导关系",
        "验证信号",
        "证据不足",
        "配置 / 跟踪 / 等待 / 回避",
        "明确要求保存",
    ):
        require(
            marker in industry_skill,
            f"bbxm-industry-analysis is missing contract marker: {marker}",
        )
    require(
        not (SKILLS_ROOT / "industry-thinking-analysis").exists(),
        "legacy industry-thinking-analysis skill directory must be removed",
    )
    require("直接分析体系三要素" in router, "router must recognize direct three-factor analysis")
    require("两个技能平行、互不调用" in router, "router must keep risk and three-factor skills independent")
    direct_route = (
        "| 直接分析体系三要素，判断市场、指数、板块或个股的竞争格局、流动性、情绪位置及共振状态 "
        "| `bbxm-three-factor-analysis` |"
    )
    require(direct_route in router, "router must map direct three-factor analysis exactly")
    require(
        any(
            all(marker in line for marker in (
                "bbxm-three-factor-analysis",
                "risk-identification",
                "分别调用",
            ))
            for line in router.splitlines()
        ),
        "router must orchestrate combined requests through both child skills",
    )

    companion = (
        SKILLS_ROOT / "bbxm-expert" / "bbxm-expert-SKILL-strong-trigger.md"
    ).read_text(encoding="utf-8-sig")
    require("唯一权威路由" in companion, "companion must defer to the canonical router")
    require(
        "同目录" in companion and "SKILL.md" in companion,
        "companion must point readers to same-directory SKILL.md",
    )
    for child_skill in (
        "information-filter-flow",
        "trade-ticket-review",
        "equity-research",
        "bbxm-three-factor-analysis",
        "risk-identification",
    ):
        require(child_skill in companion, f"companion is missing child route {child_skill}")
    require(
        "name: bbxm-expert" not in companion,
        "companion must not present itself as a second bbxm-expert skill contract",
    )

    plugin_manifests = (
        REPO_ROOT / "myplugins" / "bbxm-expert" / ".codex-plugin" / "plugin.json",
        REPO_ROOT / "myplugins" / "bbxm-expert" / "plugin.json",
        REPO_ROOT / ".agents" / "plugins" / "bbxm-expert" / ".codex-plugin" / "plugin.json",
        REPO_ROOT / ".agents" / "plugins" / "bbxm-expert" / "plugin.json",
    )
    require(
        not any(path.is_file() for path in plugin_manifests),
        "bbxm-expert must not remain packaged as an installable plugin",
    )
    require(
        not (REPO_ROOT / "myplugins" / "bbxm-expert").exists(),
        "legacy myplugins/bbxm-expert package must be removed",
    )
    require(
        not (REPO_ROOT / ".agents" / "plugins" / "bbxm-expert").exists(),
        "legacy .agents/plugins/bbxm-expert package must be removed",
    )

    marketplace = REPO_ROOT / ".agents" / "plugins" / "marketplace.json"
    if marketplace.is_file():
        require(
            "bbxm-expert" not in marketplace.read_text(encoding="utf-8-sig"),
            "project marketplace must not register bbxm-expert",
        )

    runtime_text = "".join(
        path.read_text(encoding="utf-8-sig")
        for skill_name, relative_files in EXPECTED_FILES.items()
        for relative_file in relative_files
        for path in (SKILLS_ROOT / skill_name / relative_file,)
        if path.suffix.lower() in {".md", ".yaml", ".txt"}
    )
    require(
        not any(marker in runtime_text for marker in ("�", "鍐", "鐭", "鎯", "灏")),
        "encoding scan found mojibake markers",
    )

    equity_skill = (SKILLS_ROOT / "equity-research" / "SKILL.md").read_text(
        encoding="utf-8-sig"
    )
    equity_template = (SKILLS_ROOT / "equity-research" / "template.md").read_text(
        encoding="utf-8-sig"
    )
    for marker in (
        "bbxm-three-factor-analysis",
        "risk-identification",
        "两个技能互不调用",
        "不得在本技能中复制其检查清单",
    ):
        require(marker in equity_skill, f"equity-research integration is missing: {marker}")

    for marker in (
        "三要素结论来源",
        "风险方向结论",
        "风险增强 / 风险持平 / 风险减弱 / 风险重新增强 / 证据不足",
        "主动作",
        "承接条件",
        "退出条件",
    ):
        require(marker in equity_template, f"equity-research template is missing: {marker}")

    retired_risk_contract = (
        "风险累积 / 风险暴露 / 风险释放 / 风险转弱 / 风险重新转强",
        "风险尚未转弱时",
        "买入窗口",
    )
    for marker in retired_risk_contract:
        require(marker not in equity_skill, f"equity-research still uses retired risk contract: {marker}")
        require(marker not in equity_template, f"equity template still uses retired risk contract: {marker}")

    require(
        "章节存在" in equity_skill and "不能证明" in equity_skill,
        "equity-research must reject heading-only Step 7 validation",
    )

    print("PASS: bbxm-expert project-only skill contract validated")


if __name__ == "__main__":
    try:
        main()
    except AssertionError as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        raise SystemExit(1)
