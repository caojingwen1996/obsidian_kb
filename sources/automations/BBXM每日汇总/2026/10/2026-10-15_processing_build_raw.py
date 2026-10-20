#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""2026-10-15 冰冰小美每日汇总：由 processing/extract.json 生成原帖 Markdown 与 state.json"""
import json, re, os, sys
from datetime import datetime

BASE = "/Users/cjw/dev/Obsidian/wiki/sources/automations/BBXM每日汇总/2026/10"
EXTRACT = os.path.join(BASE, "processing", "2026-10-15_processing_extract.json")
NOW = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

posts = json.load(open(EXTRACT, encoding="utf-8"))

# 目标日期过滤：只保存 2026-10-15 帖子；旧帖混入仅记录
target = [p for p in posts if (p.get("published_at") or "").startswith("2026-10-15")]
offdate = [p for p in posts if not (p.get("published_at") or "").startswith("2026-10-15")]

# 逐帖标签（宏观/市场/行业/交易）
TAGS = {
    "412345157": "宏观，市场",      # 08:48 CPI加息升温 存储集中抛售
    "412385351": "宏观，行业",      # 10:46 美债长端利率波动 AI融资传导链
    "412388469": "行业，市场",      # 10:56 美股能源第一 国内炼化不同步
    "412390305": "宏观，市场",      # 11:02 利率下行 见底与金融救市
    "412395417": "宏观，市场",      # 11:20 美债利率估值锚点 AI融资过热
    "412398226": "宏观，市场",      # 11:30 多杀多 扭转颓势困难 中期选举
    "412405703": "交易",            # 12:04 价值投机与情绪投机
    "412419618": "市场",            # 13:29 堪比互联网泡沫破灭走势
    "412423419": "交易",            # 13:42 开始建仓 总得有多头
    "412426133": "市场，交易",      # 13:53 创业板年线没理由跌超10%
    "412429463": "市场，交易",      # 14:06 提前规避风险 仓位配置主动性
    "412433612": "市场，行业",      # 14:21 长鑫破3万亿 融资市
    "412438009": "交易",            # 14:37 马后炮调查贴
    "412443356": "交易",            # 14:57 收盘总结 正义与价值
    "412446135": "宏观，交易",      # 15:10 9月月报说明 买入创业板原因
    "412457060": "交易",            # 15:58 兼听则明 不建议抄作业
    "412458118": "交易，市场",      # 16:03 交流贴 已经买了
    "412504304": "交易",            # 21:42 做多费城半导体
}

CORE = {
    "412345157": "CPI引发加息升温，全球科技普跌，存储集中抛售，宏观流动性风险",
    "412385351": "美债长端利率剧烈波动，AI融资为核心传导变量，存储遭全球集中做空",
    "412388469": "美股能源板块涨幅第一，国内炼化因出口管制与宏观不同步",
    "412390305": "利率下行已反应不利，需思考见底条件与金融救市力量",
    "412395417": "美债利率改变估值锚点，AI融资过热与债市股市跷跷板",
    "412398226": "利率加息影响已反应指数，多杀多扭转颓势困难，中期选举存变数",
    "412405703": "价值投机与情绪投机拉长时间看始终是投机，认清楚亏钱认知",
    "412419618": "罕见走势堪比互联网泡沫破灭，谨慎但确实没见过",
    "412423419": "能接受亏损即开始建仓，中期持有，市场总得有多头",
    "412426133": "创业板年线没理由跌超10%，按指数点位指引选择企业买入",
    "412429463": "提前规避风险后现在有足够主动性去仓位配置",
    "412433612": "长鑫科技跌破3万亿，融资市之问",
    "412438009": "马后炮调查贴：此前风险提示的回顾确认",
    "412443356": "收盘总结：交易心中的正义与价值，而非市场营造的欲望与假象",
    "412446135": "9月月报说明：通胀顽固、加息周期，据此在创业板点位买入",
    "412457060": "兼听则明，不建议抄作业，观察、印证、再交易",
    "412458118": "交流贴：已经买了，听听空头劝不要买的理由",
    "412504304": "晒图展示做多费城半导体仓位（作者评论确认方向）",
}

def clean_name(s):
    s = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", s)
    s = s.strip().rstrip(". ")
    return s

def extract_body(content):
    """取作者正文：页头之后、风险提示之前的作者文本段。"""
    if not content:
        return ""
    m = re.search(r"(关注|修改于|发布于)\s*\n", content)
    text = content
    if m:
        text = content[m.end():]
    idx = text.find("风险提示：用户发表的所有文章仅代表个人观点")
    if idx != -1:
        text = text[:idx]
    # 去掉行间单字符换行碎片（雪球抓取把每字断行），仅保留段落
    lines = [l.rstrip() for l in text.splitlines()]
    out, buf = [], ""
    for l in lines:
        ls = l.strip()
        if not ls:
            if buf:
                out.append(buf); buf = ""
            continue
        buf += ls
    if buf:
        out.append(buf)
    return "\n\n".join(out)

state = {
    "account": "冰冰小美",
    "account_url": "https://xueqiu.com/u/7143769715",
    "task_date": "2026-10-15",
    "start_time": "2026-10-15 22:01:08",
    "end_time": NOW,
    "scan_round": 1,
    "success_count": len(target),
    "failure_count": 0,
    "result_dir": BASE,
    "state_file": os.path.join(BASE, "2026-10-15_state.json"),
    "processed_items": {},
    "offdate_feed_items": [],
}

for p in target:
    pid = p["url"].rstrip("/").split("/")[-1]
    pub = p.get("published_at", "")
    hhmm = pub.split(" ")[1].replace(":", "")
    fname = f"{hhmm}00_{clean_name(CORE[pid])}.md"
    body = extract_body(p.get("content") or "")
    is_image_post = len(body.strip()) < 5
    body_block = body if body.strip() else "（本帖为图片帖，正文文字未能提取；核心观点依作者本人评论确认，见下节。）"
    lines = [
        f"标题：{CORE[pid]}",
        f"内容ID：{pid}",
        f"发布时间：{pub}:00",
        f"发布日期：2026-10-15",
        f"原始链接：{p['url']}",
        f"作者名称：冰冰小美",
        f"平台：xueqiu",
        f"抓取时间：{NOW}",
        f"标签：{TAGS[pid]}",
        "",
        "正文：",
        body_block,
    ]
    cms = p.get("author_comments") or []
    if cms:
        seen, uniq = set(), []
        for c in cms:
            t = (c.get("content") or c.get("text") or "").strip()
            if t and t not in seen:
                seen.add(t); uniq.append(t)
        if uniq:
            lines.append("")
            lines.append("作者补充评论：")
            for t in uniq:
                lines.append(f"- {t}")
    if is_image_post:
        lines.append("")
        lines.append("备注：原帖正文为图片内容，抓取未获得作者正文文字；作者本人评论确认为做多费城半导体。")
    fpath = os.path.join(BASE, fname)
    with open(fpath, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    state["processed_items"][pid] = {
        "source_id": pid,
        "title": CORE[pid],
        "published_at": pub + ":00",
        "url": p["url"],
        "platform": "xueqiu",
        "file_path": fpath,
        "saved_at": NOW,
        "tags": TAGS[pid].replace("，", "，"),
        "image_post": is_image_post,
    }

for p in offdate:
    state["offdate_feed_items"].append({
        "url": p.get("url"),
        "published_at": p.get("published_at"),
        "note": "feed 中混入的非目标日期旧帖，按规则不保存原帖",
    })

with open(os.path.join(BASE, "2026-10-15_state.json"), "w", encoding="utf-8") as f:
    json.dump(state, f, ensure_ascii=False, indent=2)

print(f"saved={len(target)} offdate={len(offdate)}")
print("image_posts=", [k for k, v in state["processed_items"].items() if v["image_post"]])
