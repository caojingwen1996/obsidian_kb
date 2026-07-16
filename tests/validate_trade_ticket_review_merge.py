from pathlib import Path
import sys


REPO_ROOT = Path(__file__).resolve().parents[1]
SKILLS_ROOT = REPO_ROOT / ".agents" / "skills"
CANONICAL = SKILLS_ROOT / "bbxm-trade-ticket-review"
RETIRED = SKILLS_ROOT / "bbxm-trade-review"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> None:
    require(CANONICAL.is_dir(), "canonical bbxm-trade-ticket-review skill is missing")
    require(not RETIRED.exists(), "retired bbxm-trade-review directory still exists")

    skill = (CANONICAL / "SKILL.md").read_text(encoding="utf-8-sig")
    metadata = (CANONICAL / "agents" / "openai.yaml").read_text(
        encoding="utf-8-sig"
    )
    router = (SKILLS_ROOT / "bbxm-expert" / "SKILL.md").read_text(
        encoding="utf-8-sig"
    )

    for marker in (
        "恢复原始交易意图",
        "明日谁来接",
        "仓位与性格匹配",
        "bbxm-three-factor-analysis",
        "bbxm-risk-identification",
        "visible-data only",
    ):
        require(marker in skill, f"canonical skill is missing merged marker: {marker}")

    require("name: bbxm-trade-ticket-review" in skill, "canonical skill name changed")
    require("冰冰小美" in metadata, "agent metadata does not expose BBXM review")
    require("`bbxm-trade-ticket-review`" in router, "router lost canonical trade-review route")

    active_skill_text = "".join(
        path.read_text(encoding="utf-8-sig")
        for path in SKILLS_ROOT.rglob("*")
        if path.is_file()
        and path.suffix.lower() in {".md", ".yaml", ".json", ".txt"}
    )
    retired_name = "bbxm" + "-trade-review"
    require(retired_name not in active_skill_text, "active skills still reference retired name")

    print("PASS: BBXM trade-review skills merged into bbxm-trade-ticket-review")


if __name__ == "__main__":
    try:
        main()
    except AssertionError as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        raise SystemExit(1)
