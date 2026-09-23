"""按 bbxm-risk-identification 五步路径对 2026-09-18 的 7 篇原帖逐帖识别，生成 risk-analysis.json。

方法来源：.agents/skills/bbxm-risk-identification/{SKILL.md, workflow.md, template.md, references/handoff-contract.md}
五步：识别风险表现 → 确定风险类型 → 识别风险来源 → 确定风险关键变量 → 建立风险传导关系
等级规则（主提示词 §4.2）：只有 identification_status=已支持 才可写 R/W；候选/证据不足 → 待验证。
"""
from __future__ import annotations

import json
from datetime import datetime, timezone, timedelta
from pathlib import Path

RESULT_DIR = Path(r"E:\caojingwen\obsidian\llmwiki\sources\automations\BBXM每日汇总\2026\09\2026-09-18")
OUT = RESULT_DIR / "processing" / "risk-analysis.json"
TARGET_DATE = "2026-09-18"

CST = timezone(timedelta(hours=8))
NOW = datetime.now(CST).isoformat(timespec="seconds")


def item(post_key: str, source_file: str, url: str, title: str, published_at: str,
         level: str, risk_object: str, trigger: str, transmission: str,
         evidence: str, reason: str) -> dict:
    return {
        "post_key": post_key,
        "source_file": source_file,
        "url": url,
        "title": title,
        "published_at": published_at,
        "level": level,
        "risk_object": risk_object,
        "trigger": trigger,
        "transmission": transmission,
        "evidence": evidence,
        "reason": reason,
    }


# ---------------------------------------------------------------- 逐帖五步识别
# 说明：当日 7 篇原帖中，6 条为作者原文观点（4 条中文、3 条英文），1 条为重复载体。
# 作者当天没有描述"已经发生的不利结果"，其表述集中在风险源头（政策收紧定义）与
# 交易结构（投机极致）的定性判断，缺少可比窗口与可观察负反馈，
# 按 workflow Step 1「只记录表现，不先认定来源」与方向判断纪律，
# 多数条目只能到"候选"，故全部归入 not_written/待验证。

QUALIFIED: list[dict] = []

NOT_WRITTEN: list[dict] = [
    {
        "post_key": "https://www.xueqiu.com/7143769715/409823838",
        "level": "待验证",
        "reason": (
            "五步识别：①表现——未描述已发生的异常或不利结果，仅为前瞻推演；"
            "②类型——候选为流动性风险（货币政策收紧通道）+ 情绪风险（投机极致）；"
            "③来源——触发因素为米联储加息落地、央行收紧宽松定义变化，属作者观点而非可核验事件；"
            "④关键变量——流动性收紧通道是否实质落地、央行政策定义，均无当日可观察值；"
            "⑤传导——来源→变量→主体行为一段仅有推理、无可观察行为验证。"
            "identification_status=候选，按 §4.2 只能归入待验证，不写成 R/W。"
            "来源：165900_…_40982383.md"
        ),
    },
    {
        "post_key": "https://www.xueqiu.com/7143769715/409823541",
        "level": "待验证",
        "reason": (
            "五步识别：①表现——无已发生的负面结果，为利率结构解读；"
            "②类型——候选为流动性风险（短端利率上升的实质影响）与估值风险（折现率重定价）；"
            "③来源——加息起点为压制通胀决心，长端/短端利差变化仅为利率现象；"
            "④关键变量——期限溢价、短端利率传导至流动性价格，当日无该变量的可观察基准值；"
            "⑤传导——作者本人补充'风险并不是线性的，而是分时段的'，明确指向阶段性与非线性，"
            "无法在当日完成传导链验证。identification_status=候选，归入待验证。"
            "来源：165600_…_40982354.md（含作者评论）"
        ),
    },
    {
        "post_key": "https://www.xueqiu.com/7143769715/409810755",
        "level": "待验证",
        "reason": (
            "五步识别：①表现——无不利结果，仅'历史/重演/轮回'的表述；"
            "②类型——候选为情绪风险（历史类比下的群体行为）；"
            "③来源——来源未指明，属于概括性历史观；"
            "④关键变量——未给出可观察变量；"
            "⑤传导——来源与表现之间无可验证环节，作者评论仅补充'期限溢价'一词。"
            "identification_status=证据不足，归入待验证。来源：152900_…_40981075.md"
        ),
    },
    {
        "post_key": "https://www.xueqiu.com/7143769715/409713683",
        "level": "待验证",
        "reason": (
            "五步识别：①表现——记录美债与企业债发行量创纪录的既成数据，属事实描述而非不利结果；"
            "②类型——候选为流动性风险（资本竞争推高长端收益率）；"
            "③来源——财政部发债与 AI 相关企业发债同时放量，是可核验的结构事实；"
            "④关键变量——长端收益率、发债规模，作者未给出数值门槛；"
            "⑤传导——作者写到'资本竞争加剧其他推高长端收益率的因素'，但与当日市场表现的"
            "对应环节缺失（无当日收益率数据，也不得联网补足）。"
            "identification_status=候选，归入待验证。来源：060500_…_40971368.md"
        ),
    },
    {
        "post_key": "https://www.xueqiu.com/7143769715/409713707",
        "level": "待验证",
        "reason": (
            "五步识别：①表现——家庭收入中位数创纪录，同时最低 10% 分位同比下降，"
            "结构分化属事实记录，未描述市场层面的不利结果；"
            "②类型——候选为基本面风险（收入结构分化）；"
            "③来源——通胀与薪资增长对冲，来源明确但影响对象（二级市场）未建立；"
            "④关键变量——分位数收入、通胀，均为宏观统计，与本市场风险对象无直接关系；"
            "⑤传导——未建立向市场/行业/交易的传导。identification_status=证据不足，归入待验证。"
            "来源：060600_…_40971370.md"
        ),
    },
    {
        "post_key": "https://www.xueqiu.com/7143769715/409713758",
        "level": "待验证",
        "reason": (
            "五步识别：①表现——中期选举民主党横扫概率升至 60% 的既成数据；"
            "②类型——候选为宏观事件风险（地缘政治与政策事件）；"
            "③来源——选举概率变化，属外生政治事件；"
            "④关键变量——选举结果与政策路径，均未发生；"
            "⑤传导——未建立向市场/行业/交易的传导机制。"
            "identification_status=证据不足，归入待验证。来源：061100_…_40971375.md"
        ),
    },
    {
        "post_key": "https://www.xueqiu.com/7143769715/409824691",
        "level": "待验证",
        "reason": (
            "本条与 https://www.xueqiu.com/7143769715/409823838 为同一篇专栏文章的社区转发入口，"
            "正文位置显示的是他人评论，非作者原文。按去重规则不重复纳入风险识别，"
            "仅保留来源索引，不计入风险提示次数。来源：170500_预演_40982469.md"
        ),
    },
]

doc = {
    "schema_version": 1,
    "target_date": TARGET_DATE,
    "author": "冰冰小美",
    "generated_at": NOW,
    "analysis_complete": True,
    "skill_call": {
        "skill": "bbxm-risk-identification",
        "skill_path": ".agents/skills/bbxm-risk-identification/SKILL.md",
        "invoked": True,
        "method": "five-step-identification",
        "upstream": "当日已保存原帖集合（未另跑 information-processing）",
        "risk_dir_write": False,
        "html_report": False,
    },
    "coverage": {
        "saved_post_count": 7,
        "analyzed_post_count": 7,
        "unresolved_post_count": 0,
        "unresolved_reasons": [],
    },
    "qualified": QUALIFIED,
    "not_written": NOT_WRITTEN,
}

# ---- 写入前自检 ----
keys = [i["post_key"] for i in QUALIFIED] + [i["post_key"] for i in NOT_WRITTEN]
assert len(keys) == len(set(keys)), "post_key 不唯一"
cov = doc["coverage"]
assert cov["saved_post_count"] == cov["analyzed_post_count"] + cov["unresolved_post_count"], "覆盖数不平"
assert doc["analysis_complete"] and cov["unresolved_post_count"] == 0, "analysis_complete 与未解决数矛盾"
for i in QUALIFIED:
    assert i["level"] in {"R1", "R2", "R3", "W1", "W2", "W3"}, i["level"]
for i in NOT_WRITTEN:
    assert i["level"] in {"N", "待验证"}, i["level"]
assert doc["skill_call"]["invoked"] is True, "有帖子时 skill_call 必须为已调用"

OUT.write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"written {OUT}")
print(f"qualified={len(QUALIFIED)} not_written={len(NOT_WRITTEN)}")
