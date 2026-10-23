from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
PROMPT = REPO_ROOT / ".agents" / "automations" / "bbxm_daliy_brief.md"


def test_daily_prompt_is_capture_only():
    text = PROMPT.read_text(encoding="utf-8")
    assert "必须传入 `--capture-only`" in text
    assert "不调用风险识别、信息分析或估值技能" in text
    assert "不生成或更新观点汇总" in text
    assert "不整理或创建 Wiki 页面、Timeline、主题候选" in text
    for obsolete_step in (
        "## 四、风险分析与工具写入",
        "upsert_automated_risk.py",
        "bbxm-risk-identification",
        '"qualified":',
        "## 风险提示判定",
    ):
        assert obsolete_step not in text


def test_daily_prompt_preserves_failure_and_full_text_boundaries():
    text = PROMPT.read_text(encoding="utf-8")
    assert "不得把抓取不完整写成“无新帖”" in text
    assert "必须获取详情全文" in text
    assert "不得以截断内容冒充成功保存" in text
    assert "不覆盖、不重命名已有原帖" in text
    assert "不清理旧风险行" in text


def test_daily_prompt_requires_capture_closeout():
    text = PROMPT.read_text(encoding="utf-8")
    for field in ("候选数", "符合条件数", "新增数", "已有数", "修订数", "失败数"):
        assert field in text
    assert "_task/task.log" in text
    assert "人工跟进项" in text
    assert "保留原失败痕迹" in text


def test_daily_prompt_keeps_both_accounts_and_separate_storage():
    text = PROMPT.read_text(encoding="utf-8")
    assert "https://xueqiu.com/u/7143769715" in text
    assert "https://xueqiu.com/u/2573414707" in text
    assert "标题包含“老木匠”" in text
    assert "sources/automations/BBXM每日汇总/{YEAR}/{MONTH}" in text
    assert "/Users/cjw/dev/Obsidian/wiki/sources/automations/老木匠每日汇总/`" in text
    assert "sources/automations/老木匠每日汇总/{YEAR}/{MONTH}" not in text
    assert "不创建年、月或日期子目录" in text
    assert "sources/automations/老木匠每日汇总/_task/task.log" in text
    assert "不复用冰冰小美的记录" in text
    assert "一路失败仍继续另一路" in text


def test_daily_prompt_keeps_schedule_and_isolated_browser():
    text = PROMPT.read_text(encoding="utf-8")
    assert "22:00" in text and "Asia/Shanghai" in text
    assert "Chrome for Testing / Chromium" in text
    assert "不得新启动日常 Google Chrome" in text
    assert "不追加微博、公众号或其他默认账号" in text
    assert "不创建、修改或暂停调度定义" in text


def test_daily_prompt_uses_one_append_only_log_with_recoverable_dedup():
    text = PROMPT.read_text(encoding="utf-8")
    assert "sources/automations/BBXM每日汇总/_task/task.log" in text
    assert "不再生成每日状态 JSON、日期前缀日志或独立运行状态表" in text
    assert "{DATE}_state.json" not in text
    assert "{DATE}_task.log" not in text
    assert "每行一条 JSON 事件，持续追加、不覆盖" in text
    assert "原文文件是保存事实的依据" in text
    assert "post_saved" in text and "run_started" in text and "run_finished" in text
    assert "不把临时状态、按日日志或中间文件复制进文章目录" in text
    assert "_task/history/" in text


def test_daily_prompt_uses_live_date_and_topic_for_laomujiang_files():
    text = PROMPT.read_text(encoding="utf-8")
    assert "冰冰小美原帖文件名为 `{DATE}_HHMMSS_原帖标题.md`" in text
    assert "老木匠直播整理稿统一使用 `{直播日期} 老木匠直播：{原标题主题}.md`" in text
    assert "2026-10-20 老木匠直播：含科量转向、卖出心理与新手牛市.md" in text
    assert "不用发布或抓取日期替代，不另加时分秒" in text
    assert "当日抓取筛选仍按发布时间" in text
    assert "不编造日期或直播性质" in text
    assert "不同帖子同名或修订版本冲突时" in text
    assert "post_renamed" in text and "改名不计为新增抓取" in text
