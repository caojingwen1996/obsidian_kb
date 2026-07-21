from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path


TARGET_DATE = "2026-07-21"
AUTHOR = "冰冰小美"
ACCOUNT_URL = "https://xueqiu.com/u/7143769715"
PLATFORM = "xueqiu"
BEIJING_TZ = timezone(timedelta(hours=8))

BASE = Path("sources/automations/BBXM每日汇总")
OFFICIAL_DIR = BASE / TARGET_DATE / AUTHOR
PROCESSING_DIR = OFFICIAL_DIR / "processing"
INPUT_JSON = PROCESSING_DIR / "extracted-posts-after-manual.json"
TEMP_DIR = BASE / "20260721"
RISK_XLSX = Path("tools/bbxm-risk-dashboard/data/冰冰小美风险提示.xlsx")
RISK_UPSERTER = Path("tools/bbxm-risk-dashboard/scripts/upsert_automated_risk.py")


POST_META = {
    "401305543": {
        "core_view": "医药科技跷跷板仍在",
        "interp": "这条是在用“医药跌、科技涨”确认存量流动性仍有跷跷板效应。冰冰小美体系里，这不是买点本身，而是情绪和资金仍未彻底从极端状态恢复的证据：科技反弹如果主要靠吸走医药等老方向资金，市场修正质量就不够高。\n\n行为上应偏观察，不能因为科技上涨就追认市场已经全面转强。更好的确认信号是老登、新登能同时承接，医药不再被明显挤压。",
        "risk": {
            "grade": "R1",
            "object": "医药与科技之间的存量流动性挤压",
            "trigger": "医药跌、科技涨，作者判断跷跷板仍在",
            "transmission": "存量资金在科技与医药间迁移，非主线方向承接仍受挤压，市场修正质量尚未被确认",
            "evidence": "“医药跌，科技涨。跷跷板还是存在的。”",
            "reason": "早盘挤压没有完全解除，属于弱风险观察。",
        },
    },
    "401308248": {
        "core_view": "数字货币外部锚定意义不大",
        "interp": "这条把数字货币概念的上涨归因于海外比特币回暖，而不是国内产业主线自身逻辑增强。按冰冰小美体系，这类“锚定外部上涨”的题材更像情绪借口，缺少竞争格局、产业趋势和可持续资金承接的共同验证。\n\n行为上不应把它当作主线买点。更合适的是忽略或等待，因为作者明确说“没啥意思”，意味着金融意义不足。",
    },
    "401351183": {
        "core_view": "全A加速点触发修正行情",
        "interp": "这条是全天判断的核心：全A跌到作者预设的加速点后，出现神秘力量承接、创业板放量、指数回到下跌趋势线附近，市场从非理性恐慌进入“修正行情”。这里的修正不是直接牛市确认，而是风险释放后先修复极端定价。\n\n行为翻译为：已提前有仓位的人可以避免低点恐慌割肉；没有仓位的人也不适合在日内极端波动里追涨。关键继续观察指数能否站稳修正边界，以及科技反弹是否挤压其他方向。",
        "risk": {
            "grade": "W1",
            "object": "全A和创业板短线流动性恐慌",
            "trigger": "全A回到加速点后出现承接，创业板放量并重回下跌趋势线",
            "transmission": "极端下跌触发承接力量，短线流动性从踩踏转向修正，但尚未完成趋势反转确认",
            "evidence": "“全A回到我的加速点，然后转势”“创业板放量明显”“指数重回下跌趋势线”",
            "reason": "风险从扩散开始边际缓和，但作者仍定位为修正行情。",
        },
    },
    "401353656": {
        "core_view": "极端反弹一次到位",
        "interp": "“ICU到KTV”说明日内风险释放和风险修复都被压缩到很短时间里。冰冰小美体系里，这种走势意味着量化、ETF承接和情绪踩踏共同放大波动，既容易给出低位修正，也容易让追涨买点迅速失去性价比。\n\n行为上不能把快速反弹等同于低风险。若已经有低位仓位，可以观察承接质量；若没有仓位，日内追高的容错率反而下降。",
        "risk": {
            "grade": "R2",
            "object": "短线极端波动与反弹空间快速消耗",
            "trigger": "市场从ICU到KTV，作者判断一次性反弹到位",
            "transmission": "急跌急涨压缩交易窗口，追涨与割肉都更容易被日内波动惩罚",
            "evidence": "“这行情坏的很，ICU到KTV，一次性反弹到位。”",
            "reason": "反弹太快会降低短线后续买入的风险收益比。",
        },
    },
    "401359951": {
        "core_view": "老登同涨确认修正质量",
        "interp": "作者给出修正点位后，重点不是只看科技涨，而是看“老登也涨”。这体现三要素里的流动性验证：如果修正只靠科技吸血，就仍是跷跷板；如果老方向也能涨，说明市场承接从单点题材扩散为更健康的风险缓和。\n\n行为上，老登同涨是观察修正行情质量的确认信号。它支持继续持有均衡配置，但还不足以支持无差别加仓。",
        "risk": {
            "grade": "W1",
            "object": "科技修复对非科技方向的挤压",
            "trigger": "作者提出若老登也上涨，则不是跷跷板而是好迹象",
            "transmission": "非科技方向同步承接，说明市场修正不只依赖科技吸血，流动性挤压边际缓和",
            "evidence": "“如果老登也涨，那可不是跷跷板，这就是很好的迹象。”",
            "reason": "这是跷跷板风险减弱的早期确认条件。",
        },
    },
    "401363192": {
        "core_view": "七月暴露贪婪恐惧黑暗面",
        "interp": "这条不是具体买卖点，而是对七月行情的情绪定位：市场同时展示了贪婪、恐惧和极端波动。按冰冰小美体系，情绪位置不是背景噪音，而是决定风险是否可承受的核心变量。\n\n行为上，这提示不要在极端情绪里用单日涨跌替代系统判断。需要把七月作为风险教育样本：恐慌底部不能无规则割肉，极端反弹也不能无验证追涨。",
        "risk": {
            "grade": "R1",
            "object": "七月市场贪婪恐惧循环",
            "trigger": "作者将七月描述为股市黑暗面与贪婪恐惧历史",
            "transmission": "极端情绪让投资者在恐慌割肉和反弹追涨之间失去纪律，放大非理性交易",
            "evidence": "“既见证了股票市场最黑暗的一面，也描绘出贪婪与恐惧的人类历史。”",
            "reason": "情绪风险仍在，但这条更多是风险教育而非新增交易信号。",
        },
    },
    "401364828": {
        "core_view": "修正行情确认牛熊边界",
        "interp": "这条解释“修正行情”的体系含义：它要验证牛市是否还在，指数不能走熊；修正高点是牛熊之间的边界，类似技术性熊市的关键卡点。作者把短期下跌视为非理性到理性的修正，而不是基本面一周内突然变差。\n\n行为翻译为：不要把超跌当作基本面证伪，也不要把反弹当成无条件反转。真正需要等的是指数修正后能否守住牛熊边界，并让市场从非理性价格回到可解释结构。",
        "risk": {
            "grade": "W2",
            "object": "指数技术性熊市与超跌恐慌",
            "trigger": "指数接近牛熊边界，作者强调修正行情用于确认牛市是否仍在",
            "transmission": "超跌后的理性修正若能守住关键边界，市场承接和持仓容错会明显改善",
            "evidence": "“确认牛市到底还在不在”“指数不能走熊”“由非理性的价格变化，向理性的价格变化修正。”",
            "reason": "风险释放进入关键确认阶段，较早盘恐慌已有实质缓和。",
        },
    },
    "401373870": {
        "core_view": "科技仓位均衡优先于做T",
        "interp": "这条用东材科技解释仓位纪律。作者不因为浮亏就卖，也不因为低位就继续买，核心理由是科技总仓已经不低，且做T可能破坏个股趋势。冰冰小美体系里，买卖不是机械摊薄成本，而是要服务于总仓、方向纯度和趋势承载能力。\n\n行为上，这条更接近“等”和“分仓”规则：已有科技仓时，不为了降低单票成本盲目加仓；真科技可以承接修正行情，但也要避免单一方向仓位失衡。",
        "risk": {
            "grade": "W1",
            "object": "真科技承接与仓位失衡风险",
            "trigger": "作者不加不减东材科技，理由是科技总仓不低且做T可能砸坏趋势",
            "transmission": "用仓位均衡约束低位补仓冲动，避免在修正行情中把个股亏损扩大为组合风险",
            "evidence": "“科技的仓位总比例不低”“核心就是仓位均衡。”",
            "reason": "风险处理从恐慌割肉转为组合纪律，属于弱化但仍需约束。",
        },
    },
    "401382109": {
        "core_view": "医药回升是好现象",
        "interp": "医药回升的意义不在医药本身一条线，而在于它验证早盘的跷跷板是否减弱。按作者当天框架，科技涨同时医药也能回升，说明非科技方向开始有韧性，市场不再完全靠单一方向吸血。\n\n行为上，这是风险缓和信号，可以提高对修正行情的观察权重，但仍需和后续老登、指数、科技情绪标是否稳定一起验证。",
        "risk": {
            "grade": "W1",
            "object": "医药被科技挤压的风险",
            "trigger": "作者观察到医药有回升并认为是好现象",
            "transmission": "医药回升说明非科技方向开始承接，早盘跷跷板压力边际减轻",
            "evidence": "“药有回升，好现象。”",
            "reason": "单条证据较短，但与全天跷跷板框架一致。",
        },
    },
    "401382526": {
        "core_view": "非科技韧性决定挤压减弱",
        "interp": "作者明确降低日内涨跌幅的参考权重，把核心观察放在非科技方向韧性上。这里的体系含义是：科技大波动本身不能证明市场健康，只有科技上涨不再持续挤压其他方向，修正行情才更可能成立。\n\n行为上，科技方向可观察但不能孤立追；仓位要看组合层面的流动性扩散。如果医药、有色等老方向能在科技修复中保持前进，风险才是真的减弱。",
        "risk": {
            "grade": "W2",
            "object": "科技挤压效应",
            "trigger": "作者把核心观察设为非科技方向是否有韧性",
            "transmission": "科技波动下非科技仍能前进，说明单一方向吸血和存量流动性挤压正在减弱",
            "evidence": "“核心观察，还是非科技方向的韧性，也就是所谓的科技挤压效应减弱。”",
            "reason": "这是当天确认风险转弱的关键验证项。",
        },
    },
    "401383632": {
        "core_view": "合理分化胜过极端跷跷板",
        "interp": "作者并不要求市场完全没有分化，而是要求从跌停、涨停这种极端跷跷板回到合理涨跌。冰冰小美体系里，风险转弱不是所有方向齐涨，而是波动从非理性状态回到可承受范围。\n\n行为上，看到局部分化不应立刻否定修正行情；要否定的是极端吸血和极端踩踏。合理分化允许继续观察和持有均衡配置。",
        "risk": {
            "grade": "W1",
            "object": "极端跷跷板与市场分化",
            "trigger": "作者认为正常有涨有跌，只要不是跌停和涨停的极端分化即可",
            "transmission": "波动回到合理分化，说明恐慌与挤压边际缓和，市场从非理性向可承受结构修正",
            "evidence": "“正常有涨有跌，只要不是跌停和涨停，合理范围就行。”",
            "reason": "风险转弱的条件从完全同涨修正为合理分化。",
        },
    },
    "401390361": {
        "core_view": "有色趋势未被风险打断",
        "interp": "这条把有色放回更长周期看：前期1-2月波动的核心干扰是热钱和杠杆，而不是有色原本趋势被证伪；紫金矿业重回30、核心股走稳，说明市场恐慌没有改变有色的反弹结构。\n\n行为上，有色属于均衡配置里可继续观察和持有的老登方向。只要核心股趋势不坏，就不应因科技日内波动或市场恐慌简单卖出。",
        "risk": {
            "grade": "W2",
            "object": "有色趋势被热钱杠杆打断后的修复",
            "trigger": "作者观察有色完全不受影响，紫金矿业重回30，核心股走稳",
            "transmission": "前期热钱与杠杆冲击没有破坏有色原趋势，核心股稳定带动其他有色修复反弹",
            "evidence": "“有色完全不受影响”“紫金矿业又重回30”“随着核心股走稳，其他有色也跟着修复反弹。”",
            "reason": "有色方向从被风险扰动转向趋势修复确认。",
        },
    },
    "401391938": {
        "core_view": "均衡配置更舒服",
        "interp": "这条是全天仓位体验的简短结论：均衡配置能降低单一方向跷跷板带来的心理和净值压力。它和当天科技、医药、有色同时观察的框架一致。\n\n行为上，结论不是平均买所有方向，而是让组合在新登和老登之间保留承接能力，避免因为押注单一主线而被挤压效应牵着走。",
    },
    "401395186": {
        "core_view": "均衡配置推动账户修复",
        "interp": "作者不买东材科技，是因为资金有更重要的配置位置，同时市场正在走均衡配置路线。这里的体系含义是：当天不是单票补仓逻辑，而是组合结构逻辑，均衡配置比抓一个科技弹性更重要。\n\n行为上，账户7月扭亏为盈来自仓位结构，而不是单日追涨。对持仓者的启示是先检查组合是否均衡，再决定是否对某一只科技股补仓。",
    },
    "401398466": {
        "core_view": "科技接力决定修复延续",
        "interp": "这条提出了次日验证问题：科技地天板后能否继续接力，如果科技分化，市场靠单一方向还是多个方向继续修复。冰冰小美体系里，这是等待信号，不是结论信号。\n\n行为上，不能把当天反弹直接外推到明天。次日重点看科技情绪标是否稳定、非科技是否继续有韧性、指数恐慌修复是否从单点变成多点。",
    },
    "401401234": {
        "core_view": "科技地板买入仍属极端行情",
        "interp": "作者把当天科技买入称为“捡尸体”，强调短线暴利与暴跌同时出现，市场不正常。按体系，这说明买点来自风险释放后的极端价格，而不是常态趋势追涨。\n\n行为上，短线交易者面对的是高波动高惩罚环境；长期投资者应跨过7月看8月、9月的结构，而不是被当天大幅反弹改写仓位纪律。",
        "risk": {
            "grade": "R2",
            "object": "科技短线极端化行情",
            "trigger": "作者称今天买科技像捡尸体，暴利与暴跌同步，市场不正常",
            "transmission": "日内极端波动放大短线收益与踩踏风险，低位买入也不代表低风险环境已经结束",
            "evidence": "“今天买入科技，就像是捡尸体一样”“对短线投资者来说，暴利与暴跌同步。”“市场真的不正常。”",
            "reason": "风险修复伴随极端波动，短线风险仍高。",
        },
    },
    "401405319": {
        "core_view": "国产算力交换机承载修正情绪标",
        "interp": "这是当天最完整的体系推导。作者认为修正行情需要一个勇敢创新高的情绪标，目前最好代表是国产算力交换机，因为业绩可兑现、估值不高、Kimi K3海外爆火带来算力不足叙事，且国外链企稳。ETF救市平铺、紫光回封、老登医药有色不被挤压，共同构成风险转弱证据。\n\n行为翻译为：国产算力交换机可以作为修正行情的情绪观察标，而不是无脑扩散到所有小盘概念股。允许观察强标、持有真科技和均衡配置；禁止在成交量限制下追逐没有业绩承载的小盘概念。",
        "risk": {
            "grade": "W3",
            "object": "修正行情与国产算力交换机情绪标",
            "trigger": "国产算力交换机作为情绪标回封，ETF承接平铺，老登医药有色受挤压较小",
            "transmission": "ETF承接、情绪标不被砸、非科技方向保持韧性，使风险从恐慌释放转向结构性修复窗口",
            "evidence": "“修正行情需要一个敢于勇敢突破新高的个股做情绪标”“国产算力交换机合理”“ETF救市”“新登老登一起涨。”",
            "reason": "多项风险转弱条件同日共振，是当天最高等级的修复信号，但仍需次日接力验证。",
        },
    },
    "401408319": {
        "core_view": "股神太多引发停更",
        "interp": "这条更多是作者对盘中噪音和舆论情绪的态度，不构成新增交易结论。冰冰小美体系里，“股神太多”通常提示短线情绪开始嘈杂，容易诱发追涨和事后归因。\n\n行为上，保持停更和降噪本身就是纪律：当天核心判断已经完成，剩下要等次日接力和多方向修复质量验证。",
    },
}


NOT_WRITTEN = {
    "401308248": {
        "grade": "N",
        "reason": "数字货币概念被作者判断为外部锚定、金融意义不足，未形成明确风险对象与传导链。",
    },
    "401391938": {
        "grade": "N",
        "reason": "均衡配置体验总结，属于仓位纪律提示，不是新增风险节点。",
    },
    "401395186": {
        "grade": "N",
        "reason": "账户修复与配置选择说明，未形成独立风险触发。",
    },
    "401398466": {
        "grade": "待验证",
        "reason": "作者提出科技次日能否接力的问题，证据链指向后续观察而非当日可落地风险结论。",
    },
    "401408319": {
        "grade": "N",
        "reason": "停更与情绪噪音提示，不构成独立风险提示。",
    },
}


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def clean_filename(value: str) -> str:
    value = re.sub(r'[<>:"/\\|?*]', "_", value)
    value = re.sub(r"\s+", "", value)
    return value[:80]


def parse_published(value: str) -> datetime:
    value = value.strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            pass
    raise ValueError(f"cannot parse published_at: {value!r}")


def clean_body(text: str) -> str:
    lines = [line.strip() for line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n")]
    start = 0
    for index, line in enumerate(lines):
        if line.startswith("发布于") or line.startswith("修改于"):
            start = index + 1
            break
    for index in range(start, min(start + 8, len(lines))):
        if lines[index] in {"广东", "北京", "上海", "浙江", "江苏", "四川", "湖北", "湖南", "福建"}:
            start = index + 1
            break

    body_lines = []
    skip = {"来自Android", "来自iPhone", "来自雪球", "·", ""}
    for line in lines[start:]:
        if line.startswith("风险提示："):
            break
        if line in skip:
            continue
        if line.startswith("修改于") or line.startswith("发布于"):
            continue
        body_lines.append(line)

    joined = "".join(body_lines)
    joined = re.sub(r"\s+", " ", joined).strip()
    return joined


def post_id(item: dict) -> str:
    if item.get("id"):
        return str(item["id"])
    url = item.get("url", "")
    match = re.search(r"/(\d+)$", url)
    if match:
        return match.group(1)
    raise ValueError(f"missing id for item: {item!r}")


def make_items() -> list[dict]:
    raw_items = read_json(INPUT_JSON)
    items = []
    for item in raw_items:
        sid = post_id(item)
        if sid not in POST_META:
            raise KeyError(f"missing post metadata: {sid}")
        published = parse_published(item["published_at"])
        meta = POST_META[sid]
        core_view = meta["core_view"]
        time_prefix = published.strftime("%H%M%S")
        filename = f"{time_prefix}_{clean_filename(core_view)}.md"
        interp_name = f"{time_prefix}_{clean_filename(core_view)}_解读.md"
        original_title = item.get("title") or core_view
        body = clean_body(item.get("content") or item.get("text") or item.get("body") or "")
        if not body:
            body = original_title
        items.append(
            {
                "source_id": sid,
                "published_dt": published,
                "published_at": published.strftime("%Y-%m-%d %H:%M:%S"),
                "published_date": published.strftime("%Y-%m-%d"),
                "time_prefix": time_prefix,
                "core_view": core_view,
                "original_title": original_title,
                "body": body,
                "url": item.get("url") or f"https://xueqiu.com/{sid}",
                "raw_file": OFFICIAL_DIR / filename,
                "interpretation_file": OFFICIAL_DIR / interp_name,
                "interp": meta["interp"],
                "risk": meta.get("risk"),
            }
        )
    items.sort(key=lambda row: row["published_dt"])
    if len(items) != 18:
        raise RuntimeError(f"expected 18 items, got {len(items)}")
    return items


def write_raw_and_interpretations(items: list[dict], run_time: str) -> None:
    OFFICIAL_DIR.mkdir(parents=True, exist_ok=True)
    for item in items:
        raw = f"""# {item['core_view']}

## 来源信息

- 来源：雪球
- 作者：{AUTHOR}
- 发布时间：{item['published_at']}
- 原始链接：{item['url']}
- 内容ID：{item['source_id']}
- 抓取时间：{run_time}
- 资料类型：雪球帖子
- 核心观点：{item['core_view']}
- 原始标题：{item['original_title']}

## 原文内容

{item['body']}
"""
        item["raw_file"].write_text(raw, encoding="utf-8")

        interp = f"""# {item['time_prefix']} {item['core_view']} 解读

## 冰冰小美体系解读

{item['interp']}
"""
        item["interpretation_file"].write_text(interp, encoding="utf-8")


def write_processing_files(items: list[dict], run_time: str) -> None:
    posts_payload = []
    for item in items:
        posts_payload.append(
            {
                "source_id": item["source_id"],
                "title": item["original_title"],
                "core_view": item["core_view"],
                "published_at": item["published_at"],
                "published_date": item["published_date"],
                "url": item["url"],
                "author_name": AUTHOR,
                "platform": PLATFORM,
                "body": item["body"],
                "raw_file": str(item["raw_file"]),
                "raw_file_relative": str(item["raw_file"]).replace("\\", "/"),
                "interpretation_file": str(item["interpretation_file"]),
                "interpretation_file_relative": str(item["interpretation_file"]).replace("\\", "/"),
                "raw_status": "written",
                "saved_at": run_time,
            }
        )
    write_json(PROCESSING_DIR / "column-posts.json", posts_payload)

    qualified = []
    for item in items:
        if not item["risk"]:
            continue
        risk = item["risk"]
        published_at_iso = item["published_dt"].replace(tzinfo=BEIJING_TZ).isoformat(timespec="seconds")
        qualified.append(
            {
                "post_key": item["source_id"],
                "source_id": item["source_id"],
                "title": item["core_view"],
                "published_at": published_at_iso,
                "published_at_text": item["published_at"],
                "url": item["url"],
                "level": risk["grade"],
                "risk_grade": risk["grade"],
                "risk_object": risk["object"],
                "trigger": risk["trigger"],
                "transmission": risk["transmission"],
                "evidence": [risk["evidence"]],
                "reason": risk["reason"],
                "source_file": str(item["raw_file"]).replace("\\", "/"),
                "interpretation_file": str(item["interpretation_file"]).replace("\\", "/"),
            }
        )
    not_written = []
    for sid, info in NOT_WRITTEN.items():
        item = next(row for row in items if row["source_id"] == sid)
        not_written.append(
            {
                "post_key": sid,
                "source_id": sid,
                "title": item["core_view"],
                "published_at": item["published_at"],
                "url": item["url"],
                "level": info["grade"],
                "risk_grade": info["grade"],
                "reason": info["reason"],
            }
        )
    distribution = {}
    for row in qualified:
        distribution[row["risk_grade"]] = distribution.get(row["risk_grade"], 0) + 1
    for grade in ["R1", "R2", "R3", "W1", "W2", "W3"]:
        distribution.setdefault(grade, 0)

    risk_payload = {
        "schema_version": 1,
        "automation": "BBXM每日汇总",
        "author": AUTHOR,
        "author_name": AUTHOR,
        "target_date": TARGET_DATE,
        "run_time": run_time,
        "generated_at": datetime.now(BEIJING_TZ).isoformat(timespec="seconds"),
        "analysis_complete": True,
        "coverage": {
            "saved_post_count": len(items),
            "analyzed_post_count": len(items),
            "unresolved_post_count": 0,
            "unresolved_reasons": [],
            "qualified_risk_count": len(qualified),
            "not_written_count": len(not_written),
        },
        "summary": {
            "daily_risk_count": len(qualified),
            "risk_grade_distribution": dict(sorted(distribution.items())),
            "strongest_signal": "W3 国产算力交换机承载修正情绪标",
            "daily_verdict": "风险从早盘恐慌和跷跷板转向修正行情，但极端波动和次日科技接力仍需验证。",
        },
        "qualified": qualified,
        "qualified_risks": qualified,
        "not_written": not_written,
        "boundary": [
            "本轮基于用户完成雪球滑块人工验证后的可见详情页抽取，保存目标日期18条帖子。",
            "不声称覆盖2026-07-21 14:49之后可能新增或删除的帖子。",
            "wiki/people/冰冰小美.md存在历史乱码；本轮未修复，只用于确认作者页存在。",
            "部分提示词列出的体系页缺失，已用同主题现有概念页和推导页替代。",
        ],
    }
    write_json(PROCESSING_DIR / "risk-analysis.json", risk_payload)

    state = {
        "account": AUTHOR,
        "account_url": ACCOUNT_URL,
        "platform": PLATFORM,
        "task_date": TARGET_DATE,
        "date_source": "target",
        "layout": "date-author",
        "capture_scope": "daily",
        "verification_mode": "auto-then-manual",
        "start_time": "2026-07-21 15:35:26",
        "end_time": run_time,
        "success_count": len(items),
        "failure_count": 0,
        "result_dir": str(OFFICIAL_DIR),
        "state_file": str(OFFICIAL_DIR / "state.json"),
        "log_file": str(OFFICIAL_DIR / "task.log"),
        "capture_boundary": "用户完成雪球滑块人工验证后，重跑详情抽取并保存18条目标日期可见帖子；覆盖到14:49，不声称覆盖之后新增内容。",
        "processed_items": [
            {
                "source_id": item["source_id"],
                "title": item["original_title"],
                "core_view": item["core_view"],
                "published_at": item["published_at"],
                "url": item["url"],
                "raw_file": str(item["raw_file"]),
                "interpretation_file": str(item["interpretation_file"]),
                "status": "saved",
            }
            for item in items
        ],
        "failures": [],
    }
    write_json(OFFICIAL_DIR / "state.json", state)

    task_log = f"""[{run_time}] BBXM每日汇总 {TARGET_DATE}
- 提示词：.agents/automations/bbxm_daliy_brief.md
- 作者：{AUTHOR}
- 抽取：用户完成雪球滑块人工验证后重跑，extracted-posts-after-manual.json 包含18条目标日期详情。
- 原始帖子：按 HHMMSS_核心观点.md 保存18条。
- 单帖解读：按 HHMMSS_核心观点_解读.md 保存18条，正文限定为“冰冰小美体系解读”。
- 风险分析：qualified={len(qualified)}，not_written={len(not_written)}，unresolved=0。
- 边界：不声称覆盖14:49之后可能新增内容；作者页存在历史乱码；部分提示词列出的体系页缺失，使用现有同主题页替代。
"""
    (OFFICIAL_DIR / "task.log").write_text(task_log, encoding="utf-8")


def run_risk_upserter() -> dict:
    status_path = PROCESSING_DIR / "risk-write-status.json"
    log_path = PROCESSING_DIR / "risk-upsert.log"
    cmd = [
        sys.executable,
        str(RISK_UPSERTER),
        "--analysis-file",
        str(PROCESSING_DIR / "risk-analysis.json"),
        "--workbook",
        str(RISK_XLSX),
        "--status-file",
        str(status_path),
    ]
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=env,
    )
    log_path.write_text(
        "COMMAND:\n" + " ".join(cmd) + "\n\nSTDOUT:\n" + result.stdout + "\n\nSTDERR:\n" + result.stderr + "\n",
        encoding="utf-8",
    )
    if status_path.exists():
        status = read_json(status_path)
    else:
        status = {"status": "blocked", "reason": "risk upserter did not create status file"}
        write_json(status_path, status)
    status["returncode"] = result.returncode
    write_json(status_path, status)
    return status


def write_summary(items: list[dict], risk_status: dict, run_time: str) -> None:
    status = risk_status.get("status", "unknown")
    if status == "written":
        write_label = "是"
        status_line = f"已写入 `{str(RISK_XLSX).replace(chr(92), '/')}`；状态文件为 `processing/risk-write-status.json`。"
    elif status == "no_risk":
        write_label = "否"
        status_line = "本轮无符合标准的风险提示，未写入风险工具。"
    elif status == "pending":
        write_label = "待补写"
        status_line = "风险工具写入进入 pending 状态，需关闭占用工作簿后补写。"
    else:
        write_label = "失败"
        status_line = f"风险工具写入未完成，状态：{status}。"

    points = [
        "早盘医药跌、科技涨，说明跷跷板仍在；不能仅凭科技反弹确认市场全面转强。",
        "全A跌到加速点后出现承接，创业板放量并重回下跌趋势线，行情从恐慌踩踏转入修正阶段。",
        "修正行情的核心不是追涨，而是确认指数能否守住牛熊边界、市场是否从非理性回到理性。",
        "科技反弹的质量要看非科技方向是否有韧性；老登、医药、有色同步回升，是挤压效应减弱的更好证据。",
        "有色核心股走稳，紫金矿业重回30，作者认为热钱和杠杆没有打断原趋势。",
        "国产算力交换机被作者视为修正行情的情绪标，但次日科技能否接力仍是待验证项。",
        "均衡配置比单票做T更重要；东材科技不加不减，是总仓和趋势纪律的体现。",
        "短线环境仍极端，ICU到KTV和科技地板买入都说明波动被压缩，不适合事后追涨。",
    ]
    post_lines = []
    for index, item in enumerate(items, 1):
        risk = item["risk"]["grade"] if item["risk"] else NOT_WRITTEN[item["source_id"]]["grade"]
        post_lines.append(
            f"{index}. {item['published_at'][11:16]} `{item['core_view']}`：{item['interp'].splitlines()[0]}（风险标记：{risk}）"
        )

    summary = f"""# 冰冰小美 - {TARGET_DATE} 观点整理

## 总观点

{TARGET_DATE} 的核心线索是：早盘仍有医药与科技之间的跷跷板和全A恐慌，但全A跌到加速点后出现修正行情。作者并未把这理解成无条件反转，而是把它定义为确认牛市是否仍在、指数是否守住牛熊边界、市场是否从非理性恐慌回到理性定价的过程。

更有价值的观察不是“科技涨了”，而是科技上涨是否继续挤压医药、有色等老方向。午后医药回升、有色核心股走稳、国产算力交换机作为情绪标回封，使风险从早盘扩散转为结构性缓和；但日内 ICU 到 KTV 的极端波动说明追涨容错仍低，次日科技接力和多方向修复质量需要继续验证。

## 分观点

{chr(10).join(f"- {point}" for point in points)}

## 逐条帖子

{chr(10).join(post_lines)}

## 行为翻译

### 动作判断

- 主动作：`观察 / 持有 / 等待验证`。
- 可以做：继续持有已有均衡配置，观察国产算力交换机等真科技情绪标，观察医药、有色等老登方向是否继续有韧性。
- 谨慎做：科技低位修复后追涨，尤其是没有业绩承载的小盘概念股。
- 不建议做：因为早盘恐慌割肉，或因为午后反弹把修正行情直接当成全面反转。

### 体系翻译

- 帖子结论：市场从恐慌踩踏进入修正行情，但不是风险完全解除。
- 市场状态：指数在牛熊边界附近修正，日内波动仍极端。
- 三要素状态：产业上真科技与有色仍有承载；流动性上 ETF 承接和多方向韧性改善；情绪上国产算力交换机成为修正情绪标，但短线噪音明显。
- 允许动作：已有仓位按均衡配置继续观察，真科技与老登方向分开验证。
- 禁止动作：把单日地天板当作确定趋势、追逐劣币概念或无业绩承载的小盘股。
- 等待信号：次日科技是否接力、情绪标是否不被砸、医药有色是否继续不被挤压、指数是否守住修正边界。
- 我的持仓影响：若组合已有科技、有色、医药等多方向配置，本轮更偏向检验仓位结构；若科技仓已高，不宜为了单票亏损继续加仓摊薄。

### 风险与失效条件

- 跷跷板没有完全消失，只是午后出现边际减弱证据。
- 修正行情若不能守住指数边界，仍可能重新回到系统性恐慌。
- 国产算力交换机若次日无法接力或被砸，修正情绪标会失效。
- 如果科技上涨重新挤压医药、有色，市场修复质量需要下调。
- 日内极端波动说明短线追涨和恐慌割肉都仍有高惩罚。

## 风险提示判定

- 分析覆盖：已分析 18 / 已保存 18，未解决 0。
- 是否写入风险工具：{write_label}。
- 写入状态：{status_line}
- 当日累计风险提示次数：13。
- 风险等级分布：R1 × 2，R2 × 2，R3 × 0，W1 × 5，W2 × 3，W3 × 1。
- 最强信号：W3 `国产算力交换机承载修正情绪标`。
- 未写入风险工具的帖子：5 条，原因分别为金融意义不足、仓位体验总结、账户配置说明、次日接力待验证、停更降噪。
- 待验证边界：本轮人工验证后完整保存 18 条可见目标日期详情；不声称覆盖 14:49 之后可能新增内容；`wiki/people/冰冰小美.md` 存在历史乱码，本轮未修复；提示词列出的部分体系页缺失，已用现有同主题页替代。

## 文件与来源

- 原始帖子目录：`sources/automations/BBXM每日汇总/{TARGET_DATE}/{AUTHOR}/`
- 抽取文件：`sources/automations/BBXM每日汇总/{TARGET_DATE}/{AUTHOR}/processing/extracted-posts-after-manual.json`
- 风险分析：`sources/automations/BBXM每日汇总/{TARGET_DATE}/{AUTHOR}/processing/risk-analysis.json`
- 风险写入状态：`sources/automations/BBXM每日汇总/{TARGET_DATE}/{AUTHOR}/processing/risk-write-status.json`
- 生成时间：{run_time}
"""
    (OFFICIAL_DIR / "summary.md").write_text(summary, encoding="utf-8")


def update_log(run_time: str) -> None:
    marker = f"按 `.agents/automations/bbxm_daliy_brief.md` 执行 {TARGET_DATE} BBXM 每日汇总。用户完成雪球滑块人工验证后"
    log_path = Path("log.md")
    current = log_path.read_text(encoding="utf-8-sig")
    if marker in current:
        return
    entry = f"""
## {TARGET_DATE}

### 操作类型

automation / bbxm-daily-brief / risk-analysis

### 修改文件

- `sources/automations/BBXM每日汇总/{TARGET_DATE}/冰冰小美/`
- `tools/bbxm-risk-dashboard/data/冰冰小美风险提示.xlsx`
- `log.md`

### 操作说明

按 `.agents/automations/bbxm_daliy_brief.md` 执行 {TARGET_DATE} BBXM 每日汇总。用户完成雪球滑块人工验证后，重跑详情抽取并保存 18 条目标日期帖子，生成 18 个单帖解读、`summary.md`、`risk-analysis.json` 和风险写入状态。

### 后续待办

- 不声称覆盖 14:49 之后可能新增内容，如需盘后完整覆盖需再次抓取。
- `wiki/people/冰冰小美.md` 存在历史乱码，后续可单独修复。
- 提示词列出的部分体系页缺失，后续可补齐或修正提示词引用路径。
"""
    log_path.write_text(current.rstrip() + "\n" + entry, encoding="utf-8")


def cleanup_temp_dir() -> None:
    if not TEMP_DIR.exists():
        return
    base_resolved = BASE.resolve()
    temp_resolved = TEMP_DIR.resolve()
    if temp_resolved.parent != base_resolved or temp_resolved.name != "20260721":
        raise RuntimeError(f"refuse to remove unexpected temp path: {temp_resolved}")
    shutil.rmtree(temp_resolved)


def scan_for_mojibake() -> list[str]:
    targets = list(OFFICIAL_DIR.glob("*.md")) + [
        OFFICIAL_DIR / "state.json",
        OFFICIAL_DIR / "task.log",
        PROCESSING_DIR / "column-posts.json",
        PROCESSING_DIR / "risk-analysis.json",
        PROCESSING_DIR / "risk-write-status.json",
    ]
    bad = []
    pattern = re.compile("[鍐鐭鎯灏�]")
    for path in targets:
        if path.exists() and pattern.search(path.read_text(encoding="utf-8", errors="replace")):
            bad.append(str(path))
    return bad


def main() -> None:
    run_time = datetime.now(BEIJING_TZ).strftime("%Y-%m-%d %H:%M:%S")
    items = make_items()
    write_raw_and_interpretations(items, run_time)
    write_processing_files(items, run_time)
    risk_status = run_risk_upserter()
    write_summary(items, risk_status, run_time)
    update_log(run_time)
    cleanup_temp_dir()
    bad = scan_for_mojibake()
    report = {
        "target_date": TARGET_DATE,
        "output_dir": str(OFFICIAL_DIR),
        "post_count": len(items),
        "summary": str(OFFICIAL_DIR / "summary.md"),
        "risk_status": risk_status,
        "mojibake_files": bad,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
