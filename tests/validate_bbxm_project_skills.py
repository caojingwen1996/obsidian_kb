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
    "bbxm-equity-research": (
        "SKILL.md",
        "template.md",
        "agents/openai.yaml",
    ),
    "bbxm-information-filter-flow": (
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
    "bbxm-risk-identification": ("SKILL.md",),
    "bbxm-trade-ticket-review": (
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
        "bbxm-equity-research",
        "bbxm-information-filter-flow",
        "bbxm-industry-analysis",
        "bbxm-risk-identification",
        "bbxm-trade-ticket-review",
    ):
        require(child_skill in router, f"bbxm-expert router is missing {child_skill}")

    industry_skill = (
        SKILLS_ROOT / "bbxm-industry-analysis" / "SKILL.md"
    ).read_text(encoding="utf-8-sig")
    industry_ui = (
        SKILLS_ROOT / "bbxm-industry-analysis" / "agents" / "openai.yaml"
    ).read_text(encoding="utf-8-sig")
    for marker in (
        "wiki/concepts/冰冰小美-framework-产业思维.md",
        "完整读取当前版本",
        "唯一知识源",
        "当前定义的模块、顺序、术语、判断标准和行动分类",
        "不得在本技能中缓存、复制或补充",
        "证据不足",
        "明确要求保存",
    ):
        require(
            marker in industry_skill,
            f"bbxm-industry-analysis is missing contract marker: {marker}",
        )
    for duplicated_heading in (
        "## 分析流程",
        "## 霍华德·马克斯完整周期矩阵",
        "## 多周期传导",
        "## 输出结构",
    ):
        require(
            duplicated_heading not in industry_skill,
            f"bbxm-industry-analysis duplicates its canonical framework: {duplicated_heading}",
        )
    for duplicated_framework in (
        "霍华德·马克斯",
        "经济周期",
        "成功周期",
    ):
        require(
            duplicated_framework not in industry_skill + industry_ui,
            f"bbxm-industry-analysis runtime files duplicate framework content: {duplicated_framework}",
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
                "bbxm-risk-identification",
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
        "bbxm-information-filter-flow",
        "bbxm-trade-ticket-review",
        "bbxm-equity-research",
        "bbxm-three-factor-analysis",
        "bbxm-risk-identification",
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

    for legacy_skill in (
        "equity-research",
        "information-filter-flow",
        "risk-identification",
        "trade-ticket-review",
    ):
        require(
            not (SKILLS_ROOT / legacy_skill).exists(),
            f"legacy unprefixed BBXM skill directory must be removed: {legacy_skill}",
        )

    equity_skill = (SKILLS_ROOT / "bbxm-equity-research" / "SKILL.md").read_text(
        encoding="utf-8-sig"
    )
    equity_template = (SKILLS_ROOT / "bbxm-equity-research" / "template.md").read_text(
        encoding="utf-8-sig"
    )
    for marker in (
        "bbxm-three-factor-analysis",
        "bbxm-risk-identification",
        "两个技能互不调用",
        "不得在本技能中复制其检查清单",
    ):
        require(marker in equity_skill, f"bbxm-equity-research integration is missing: {marker}")

    for marker in (
        "三要素结论来源",
        "风险方向结论",
        "风险增强 / 风险持平 / 风险减弱 / 风险重新增强 / 证据不足",
        "主动作",
        "承接条件",
        "退出条件",
    ):
        require(marker in equity_template, f"bbxm-equity-research template is missing: {marker}")

    retired_risk_contract = (
        "风险累积 / 风险暴露 / 风险释放 / 风险转弱 / 风险重新转强",
        "风险尚未转弱时",
        "买入窗口",
    )
    for marker in retired_risk_contract:
        require(marker not in equity_skill, f"bbxm-equity-research still uses retired risk contract: {marker}")
        require(marker not in equity_template, f"equity template still uses retired risk contract: {marker}")

    require(
        "章节存在" in equity_skill and "不能证明" in equity_skill,
        "bbxm-equity-research must reject heading-only Step 7 validation",
    )

    print("PASS: bbxm-expert project-only skill contract validated")


if __name__ == "__main__":
    try:
        main()
    except AssertionError as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        raise SystemExit(1)
