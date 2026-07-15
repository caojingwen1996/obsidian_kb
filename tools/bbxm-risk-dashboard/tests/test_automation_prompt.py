from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
PROMPT = REPO_ROOT / ".agents" / "automations" / "bbxm_daliy_brief.md"


def test_daily_prompt_contains_risk_writeback_contract():
    text = PROMPT.read_text(encoding="utf-8")
    required = [
        "risk-analysis.json",
        "risk-write-status.json",
        "R1 / R2 / R3",
        "W1 / W2 / W3",
        "风险减弱或转向机会节点，写入风险工具",
        "当天全部已保存帖子",
        "analysis_complete",
        "upsert_automated_risk.py",
        "pending",
        "## 风险提示判定",
        "[自动分析｜冰冰小美每日任务]",
    ]

    assert not [item for item in required if item not in text]


def test_daily_prompt_preserves_failure_and_source_boundaries():
    text = PROMPT.read_text(encoding="utf-8")
    required = [
        "不得额外联网",
        "不得把抓取不完整写成零风险",
        "不得结束 Excel 进程",
        "不得删除锁文件",
        "同日重跑",
        "人工行",
        "不作为 Excel 更新器的输入",
    ]

    assert not [item for item in required if item not in text]


def test_daily_prompt_requires_closeout_risk_status():
    text = PROMPT.read_text(encoding="utf-8")
    required = [
        "风险分析覆盖",
        "Excel 写入状态",
        "人工跟进项",
        "原始帖保存状态",
        "summary.md 路径",
    ]

    assert not [item for item in required if item not in text]
