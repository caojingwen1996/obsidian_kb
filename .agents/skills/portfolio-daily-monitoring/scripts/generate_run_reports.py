#!/usr/bin/env python3
"""Generate one Markdown report per target plus a daily summary from run JSON."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def money(value: float) -> str:
    return f"{value:.2f}亿元"


def pct(value: float) -> str:
    return f"{value:+.2f}%"


def valuation_position(item: dict) -> tuple[str, str]:
    low, high, close = item["value_low"], item["value_high"], item["close"]
    pos = (close - low) / (high - low)
    if pos < 0:
        state = "低于区间下沿"
    elif pos <= 0.25:
        state = "区间偏低"
    elif pos <= 0.75:
        state = "区间中部"
    elif pos <= 1:
        state = "区间偏高"
    else:
        state = "高于区间上沿"
    return f"{pos * 100:.1f}%（下沿=0%，上沿=100%）", state


def abnormal_text(item: dict) -> str:
    return "；".join(item["triggers"]) if item["triggers"] else "未触发价格和成交量异常规则"


def source_link(item: dict) -> str:
    return f"[{item['report_file']}](../../../workbench/targets/{item['report_file']})"


def target_report(run: dict, item: dict) -> str:
    position, vstate = valuation_position(item)
    abnormal = bool(item["triggers"])
    announcements = item.get("announcements", [])
    announce_table = (
        "\n".join(
            f"| {a['date']} | {a['title']} | {a['fact']} | {a['impact']} | {a['hypothesis']} | {a['source']} |"
            for a in announcements
        )
        if announcements
        else "> 本次监控已检索交易所、巨潮及库内最新基线，未发现新增重大公告。"
    )
    review_priority = item.get("review_priority", "—")
    review_row = (
        f"| {review_priority} | {item['name']} | {item['reason']} | {item['hypothesis']} | {item['review_task']} |"
        if item["needs_review"]
        else "本标的本次不进入待人工复盘清单。"
    )
    queue_row = (
        f"| {review_priority} | {item['name']} | {item['revalue']} | {item['reason']} | {item['method']} | {item['report_date']} | {item['missing']} | {item['next_step']} |"
        if item["revalue"] != "NO_REVALUE"
        else "> 本次监控没有使本标的进入估值重算队列；股价变化只更新安全边际，不自动改变原价值区间。"
    )
    update = "是" if item["update_report"] else "否"
    normal_count = 0 if abnormal else 1
    lines = f"""# {item['code']}-{item['name']}-每日监控-{run['date']}

## 一、监控概览

- 监控日期：{run['date']}
- 数据截止时间：行情与量价截至 {run['trade_date']} 收盘；公告、公司新闻与产业新闻检索截至 {run['run_time']}（中国标准时间）
- 监控状态：{run['monitor_state']}
- 监控标的数量：1
- 正常标的数量：{normal_count}
- 出现异常标的数量：{1 if abnormal else 0}
- 待人工复盘数量：{1 if item['needs_review'] else 0}
- 逻辑强化数量：{1 if item['judgment'] == '强化' else 0}
- 逻辑削弱数量：{1 if '削弱' in item['judgment'] else 0}
- 逻辑失效数量：{1 if item['judgment'] == '逻辑失效' else 0}
- 数据缺失数量：1（成本、仓位与行业指数映射未提供 / 未获取到）
- 阈值说明：采用默认规则
- 估值触发规则：采用默认估值触发规则
- NO_REVALUE数量：{1 if item['revalue'] == 'NO_REVALUE' else 0}
- LIGHT_REVALUE数量：{1 if item['revalue'] == 'LIGHT_REVALUE' else 0}
- FULL_REVALUE数量：{1 if item['revalue'] == 'FULL_REVALUE' else 0}
- MANUAL_REVIEW数量：{1 if item['revalue'] == 'MANUAL_REVIEW' else 0}

## 二、重点变化摘要

| 标的 | 变化类型 | 核心变化 | 投资逻辑判断 | 估值处置状态 | 关联假设 | 是否待复盘 | 是否需继续阅读 |
|---|---|---|---|---|---|---|---|
| {item['name']} | {'异常波动/事件' if abnormal or announcements else '常规监控'} | {item['reason']} | {item['judgment']} | {item['revalue']} | {item['hypothesis']} | {'是' if item['needs_review'] else '否'} | {'是' if item['needs_review'] or item['revalue'] != 'NO_REVALUE' else '否'} |

### 快速阅读结论

- 是否需要继续阅读后续章节：{'是' if item['needs_review'] or item['revalue'] != 'NO_REVALUE' else '否'}
- 快速结论：{item['quick_conclusion']}
- 如需继续阅读：重点查看第 2、6、7 节，核对异常、估值输入与核心假设变化。

## 三、八类监控项结果

### {item['name']}（{item['code']}）

#### 1. 收盘表现

- 最新收盘价：{item['close']:.2f} 元
- 当日涨跌幅：{pct(item['daily_pct'])}
- 本周涨跌幅：{pct(item['week_pct'])}（{run['week_note']}）
- 近5日涨跌幅：{pct(item['five_pct'])}
- 行业指数涨跌幅：未获取到可审计的一致映射
- 相对行业表现：未获取到
- 成交额：{money(item['amount'])}
- 成交额较20日均值：{item['amount_ratio']:.2f} 倍
- 换手率：{item['turnover']:.2f}%
- 动态估值区间：{item['value_low']:g}—{item['value_high']:g} 元
- 估值日期 / 模型版本：{item['report_date']} / 库内最新相关研报
- 当前估值位置：{position}
- 估值状态：{vstate}
- 相对原区间的安全边际变化：按 {run['trade_date']} 收盘价更新；未自动覆盖原研报结论

#### 2. 异常波动

- 是否触发异常：{'是' if abnormal else '否'}
- 触发规则：{abnormal_text(item)}
- 异常程度：{'高' if len(item['triggers']) >= 2 else ('中' if abnormal else '无')}
- 已确认原因：{item['confirmed_reason']}
- 未确认事项：{item['unconfirmed']}
- 是否需要人工核实：{'是' if item['needs_review'] else '否'}

#### 3. 公司公告

| 时间 | 公告 | 核心事实 | 影响范围 | 关联假设 | 来源 |
|---|---|---|---|---|---|
{announce_table}

#### 4. 产业新闻

> 本次监控未发现足以单独改变核心判断的新增产业变化。行业指数与产业新闻的可审计映射未完整取得，不据此强行解释股价。

#### 5. 关键指标变化

| 指标 | 最新值 | 上期值 | 变化方向 | 是否异常 | 数据日期 | 关联假设 | 来源 |
|---|---:|---:|---|---|---|---|---|
| 收盘价 | {item['close']:.2f}元 | 未单列 | {pct(item['daily_pct'])} | {'是' if abs(item['daily_pct']) >= 5 else '否'} | {run['trade_date']} | H3 | Tushare daily |
| 近5日涨跌幅 | {pct(item['five_pct'])} | 未单列 | — | {'是' if abs(item['five_pct']) >= 10 else '否'} | {run['trade_date']} | H3 | Tushare daily |
| 成交额/20日均值 | {item['amount_ratio']:.2f}倍 | 1.00倍 | {'放大' if item['amount_ratio'] > 1 else '缩小'} | {'是' if item['amount_ratio'] >= 2 else '否'} | {run['trade_date']} | H3 | Tushare daily |
| 换手率 | {item['turnover']:.2f}% | 近20日均值 | {item.get('turnover_ratio', 0):.2f}倍 | {'是' if item.get('turnover_ratio', 0) >= 2 else '否'} | {run['trade_date']} | H3 | Tushare daily_basic |
| PE(TTM) | {item['pe']:.2f}倍 | 未获取到 | — | 否 | {run['trade_date']} | H3 | Tushare daily_basic |
| PB | {item['pb']:.2f}倍 | 未获取到 | — | 否 | {run['trade_date']} | H3 | Tushare daily_basic |

#### 6. 估值输入变化与重算判断

| 估值输入 | 原模型值 | 最新值 | 变化幅度 | 触发阈值 | 数据日期 | 来源 | 受影响方法 | 是否触发 |
|---|---:|---:|---:|---:|---|---|---|---|
| 价格 / 安全边际 | {item['value_low']:g}—{item['value_high']:g}元 | {item['close']:.2f}元 | 位置 {position.split('（')[0]} | 越过区间边界 | {run['trade_date']} | Tushare + 最新研报 | 安全边际 | {'是' if item['close'] < item['value_low'] or item['close'] > item['value_high'] else '否'} |
| 盈利与现金流假设 | {item['old_input']} | {item['new_input']} | {item['input_change']} | 技能默认阈值 | {item['input_date']} | {item['input_source']} | {item['method']} | {'是' if item['revalue'] in ('LIGHT_REVALUE','FULL_REVALUE') else '待人工' if item['revalue'] == 'MANUAL_REVIEW' else '否'} |

- 价格变化是否仅改变安全边际：{'否' if item['revalue'] in ('LIGHT_REVALUE','FULL_REVALUE') else '信息不足' if item['revalue'] == 'MANUAL_REVIEW' else '是'}
- 估值处置状态：{item['revalue']}
- 触发理由：{item['reason']}
- 仍然有效的旧估值区间及日期：{item['value_low']:g}—{item['value_high']:g} 元，{item['report_date']}；仅作旧基线，未自动覆盖
- 需要局部重算的方法：{item['method']}
- 是否需要更新综合估值区间：{'重算后判断' if item['revalue'] == 'FULL_REVALUE' else '人工复核' if item['revalue'] == 'MANUAL_REVIEW' else '否'}
- 完成重算所缺数据：{item['missing']}

#### 7. 系统初步影响判断

- 当前判断：{item['judgment']}
- 受影响假设：{item['hypothesis']}
- 支持证据：{item['support']}
- 反向证据：{item['counter']}
- 影响路径：{item['impact_path']}
- 影响持续性：{item['duration']}
- 判断置信度：{item['confidence']}
- 是否需要人工复盘：{'是' if item['needs_review'] else '否'}
- 是否建议更新研报：{update}

#### 8. 待办事项

- 待核实事项：{item['unconfirmed']}
- 建议补充数据：成本、仓位、行业指数映射；{item['missing']}
- 下一次复盘时间：下一交易日盘前；重大公告出现时即时复核
- 建议复盘重点：{item['review_task']}

## 四、待人工复盘清单

| 优先级 | 标的 | 触发原因 | 关联假设 | 需要完成的复盘 |
|---|---|---|---|---|
{review_row}

## 五、估值重算队列

| 优先级 | 标的 | 估值处置状态 | 触发输入或事件 | 受影响方法 | 原估值日期 | 所需数据 | 下一步 |
|---|---|---|---|---|---|---|---|
{queue_row}

## 六、研报更新建议

| 标的 | 是否建议更新 | 估值处置状态 | 建议修改章节 | 修改原因 | 所需数据 |
|---|---|---|---|---|---|
| {item['name']} | {update} | {item['revalue']} | {item['update_section']} | {item['reason']} | {item['missing']} |

## 七、来源与数据缺口

| 标的 | 数据项 | 状态 | 已检查来源 | 缺口影响 |
|---|---|---|---|---|
| {item['name']} | 行情、估值指标 | 已获取 | 本地 Tushare daily / daily_basic，数据日 {run['trade_date']} | 可完成价格与量价判断 |
| {item['name']} | 研报与估值基线 | 已获取 | {source_link(item)} | 可计算区间位置，不自动覆盖原结论 |
| {item['name']} | 公告与新闻 | 部分获取 | 交易所、巨潮、公司官网、公开公告索引与库内最新资料；截至 {run['run_time']} | {run.get('news_source_note') or '检索存在索引延迟可能'} |
| {item['name']} | 成本、仓位、行业指数 | 未提供 / 未获取到 | portfolio.json 与本地资料 | 无法计算持仓盈亏及相对行业表现 |

> 事实、推断与缺口说明：行情和公告数字为事实；系统初判、影响路径与估值处置为基于现有证据的推断；未确认事项不作为股价原因。本报告不构成买卖指令。
"""
    return lines


def summary_report(run: dict, items: list[dict]) -> str:
    abnormal = [i for i in items if i["triggers"]]
    review = [i for i in items if i["needs_review"]]
    counts = {s: sum(i["revalue"] == s for i in items) for s in ("NO_REVALUE", "LIGHT_REVALUE", "FULL_REVALUE", "MANUAL_REVIEW")}
    focus = [i for i in items if i["triggers"] or i["needs_review"] or i["revalue"] != "NO_REVALUE"]
    focus_rows = "\n".join(
        f"| {i['name']} | {i['reason']} | {i['judgment']} | {i['revalue']} | {'是' if i['needs_review'] else '否'} | 是 |" for i in focus
    )
    index_rows = "\n".join(
        f"| {i['name']} | {i['code']} | {i['status']} | {i['revalue']} | {i['reason']} | {i['judgment']} | [打开报告]({i['code']}-{i['name']}-每日监控-{run['date']}.html) |" for i in items
    )
    review_rows = "\n".join(
        f"| {i.get('review_priority','—')} | {i['name']} | {i['reason']} | {i['hypothesis']} | {i['review_task']} | [打开报告]({i['code']}-{i['name']}-每日监控-{run['date']}.html) |" for i in review
    ) or "本次无待人工复盘标的。"
    queue = [i for i in items if i["revalue"] != "NO_REVALUE"]
    queue_rows = "\n".join(
        f"| {i.get('review_priority','—')} | {i['name']} | {i['revalue']} | {i['reason']} | {i['method']} | {i['report_date']} | {i['missing']} | {i['next_step']} |" for i in queue
    )
    report_updates = [i for i in items if i["update_report"]]
    update_rows = "\n".join(
        f"| {i.get('review_priority','—')} | {i['name']} | {i['update_section']} | {i['reason']} | {i['missing']} | {i['next_step']} |" for i in report_updates
    ) or "> 本次监控没有需要更新研报的标的；全部变化继续保留在逐标的监控记录中。"
    gap_rows = "\n".join(
        f"| {i['name']} | 成本、仓位、行业指数映射 | 未提供 / 未获取到 | portfolio.json、库内资料、Tushare | 不影响价格异常判断；影响持仓盈亏与行业相对表现 |" for i in items
    )
    if run.get("news_source_note"):
        gap_rows += f"\n| 全组合 | 公告与新闻索引 | 部分获取 | 交易所、巨潮、公司官网与公开公告索引 | {run['news_source_note']} |"
    priority_names = "、".join(i["name"] for i in focus) or "无"
    quick_parts = [f"{len(abnormal)} 个标的触发默认异常规则"]
    if counts["FULL_REVALUE"]:
        quick_parts.append(f"{counts['FULL_REVALUE']} 个进入完整重估")
    if counts["LIGHT_REVALUE"]:
        quick_parts.append(f"{counts['LIGHT_REVALUE']} 个进入局部重算")
    if counts["MANUAL_REVIEW"]:
        quick_parts.append(f"{counts['MANUAL_REVIEW']} 个进入人工判断")
    quick_parts.append(f"其余 {counts['NO_REVALUE']} 个维持原估值区间并仅更新价格和安全边际")
    quick_conclusion = "；".join(quick_parts) + "。"
    continue_reading = bool(focus)
    return f"""# 持仓今日监控汇总

## 一、监控概览

- 监控日期：{run['date']}
- 数据截止时间：行情与量价截至 {run['trade_date']} 收盘；公告、新闻检索截至 {run['run_time']}（中国标准时间）
- 监控状态：{run['monitor_state']}
- 监控标的数量：{len(items)}
- 正常标的数量：{len(items) - len(abnormal)}
- 出现异常标的数量：{len(abnormal)}
- 待人工复盘数量：{len(review)}
- 数据缺失数量：{len(items)}（均缺成本、仓位或行业指数映射中的至少一项）
- 阈值说明：采用默认规则
- 估值触发规则：采用默认估值触发规则
- NO_REVALUE数量：{counts['NO_REVALUE']}
- LIGHT_REVALUE数量：{counts['LIGHT_REVALUE']}
- FULL_REVALUE数量：{counts['FULL_REVALUE']}
- MANUAL_REVIEW数量：{counts['MANUAL_REVIEW']}

## 二、重点变化摘要

| 标的 | 核心变化 | 投资逻辑判断 | 估值处置状态 | 是否待复盘 | 是否需继续阅读 |
|---|---|---|---|---|---|
{focus_rows}

### 快速阅读结论

- 是否需要继续阅读逐标的报告：{'是' if continue_reading else '否'}
- 快速结论：{quick_conclusion}
- 优先阅读标的及原因：{priority_names}；分别涉及区间边界、显著量价波动或待完成估值重算。

## 三、逐标的监控索引

| 标的 | 代码 | 持有 / 观察 | 估值处置状态 | 触发或修改原因 | 投资逻辑判断 | 逐标的报告 |
|---|---|---|---|---|---|---|
{index_rows}

## 四、待人工复盘清单

| 优先级 | 标的 | 触发原因 | 关联假设 | 需要完成的复盘 | 逐标的报告 |
|---|---|---|---|---|---|
{review_rows}

## 五、估值重算队列

| 优先级 | 标的 | 估值处置状态 | 触发输入或事件 | 受影响方法 | 原估值日期 | 所需数据 | 下一步 |
|---|---|---|---|---|---|---|---|
{queue_rows}

## 六、研报更新建议

| 优先级 | 标的 | 建议修改章节 | 修改原因 | 所需数据 | 下一步 |
|---|---|---|---|---|---|
{update_rows}

## 七、来源与数据缺口

| 标的 | 数据项 | 状态 | 已检查来源 | 缺口影响 |
|---|---|---|---|---|
{gap_rows}

> 来源口径：行情与 PE/PB 来自本地 Tushare 数据工具，日期为 {run['trade_date']}；代码通过 Tushare stock_basic 核验；公告优先检查交易所、巨潮与公司正式披露；估值基线来自 workbench/targets 最新相关研报。检索失败或无可审计映射的部分均明确列为数据缺口。本报告不构成买卖指令，也不自动覆盖原研报结论。
"""


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    args = parser.parse_args()
    run = json.loads(args.input.read_text(encoding="utf-8-sig"))
    args.output_dir.mkdir(parents=True, exist_ok=True)
    for item in run["items"]:
        defaults = {
            "triggers": [],
            "announcements": [],
            "revalue": "NO_REVALUE",
            "judgment": "无实质影响",
            "hypothesis": "H1 核心盈利、H2 现金流质量、H3 估值与市场预期",
            "needs_review": False,
            "update_report": False,
            "reason": "未发现达到默认阈值的新增估值输入，维持原估值区间",
            "quick_conclusion": "现有证据未改变核心逻辑，维持旧估值基线，仅更新现价与安全边际。",
            "confirmed_reason": "未发现可将当日价格变化归因于单一新事实的证据",
            "unconfirmed": "当日交易驱动与行业相对表现未确认",
            "old_input": "库内最新研报假设",
            "new_input": "未获取到达到阈值的新增输入",
            "input_change": "未达到触发阈值",
            "input_date": run["date"],
            "input_source": "交易所/巨潮检索与库内最新研报",
            "method": "不适用",
            "missing": "成本、仓位、行业映射及逐项模型输入未提供 / 未获取到",
            "support": "未发现足以推翻原研报核心判断的新增正式证据",
            "counter": "量价变化不等于基本面变化，且部分数据仍缺失",
            "impact_path": "价格变化主要影响安全边际，不直接改写盈利与现金流假设",
            "duration": "待下一交易日与后续公告验证",
            "confidence": "中",
            "review_task": "跟踪下一交易日量价、正式公告与关键经营指标",
            "next_step": "维持监控，等待新输入",
            "update_section": "无需修改；保留监控记录",
        }
        for key, value in defaults.items():
            item.setdefault(key, value)
        name = f"{item['code']}-{item['name']}-每日监控-{run['date']}.md"
        (args.output_dir / name).write_text(target_report(run, item), encoding="utf-8")
    summary_name = f"持仓今日监控汇总-{run['date']}.md"
    (args.output_dir / summary_name).write_text(summary_report(run, run["items"]), encoding="utf-8")
    print(f"Generated {len(run['items'])} target reports and 1 summary")


if __name__ == "__main__":
    main()
