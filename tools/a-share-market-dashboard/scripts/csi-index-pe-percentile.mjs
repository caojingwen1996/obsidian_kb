#!/usr/bin/env node
/**
 * 中证指数官方 PE 历史序列 + 估值分位计算器
 * ------------------------------------------------------------
 * 数据源：中证指数官网（csindex.com.cn）公开 JSON 接口
 *   https://www.csindex.com.cn/csindex-home/perf/indexCsiDsPe?indexCode=000922
 * 覆盖：2011-06-28 起至最新交易日，约 3800 个交易日（每交易日一条）
 * 注意：中证返回的字段名叫 `peg`，其数值实为指数加权滚动市盈率 PE(TTM)，
 *       与财联社/choice 口径的中证红利 PE 一致，可直接用于分位计算。
 *       中证该接口 **不提供** PB / 股息率的历史序列，PB 需另取源。
 *
 * 用法：
 *   node scripts/csi-index-pe-percentile.mjs                 # 默认 000922 中证红利
 *   node scripts/csi-index-pe-percentile.mjs 000905 H00905   # 支持多个指数
 *   node scripts/csi-index-pe-percentile.mjs --csv 000922    # 额外导出 CSV
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://www.csindex.com.cn/csindex-home/perf/indexCsiDsPe';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const DEFAULT_CODES = ['000922'];

function parseArgs(argv) {
  const out = { codes: [], csv: false };
  for (const a of argv) {
    if (a === '--csv') out.csv = true;
    else if (/^\d{6}$|^H\d{5}$/.test(a)) out.codes.push(a);
  }
  if (!out.codes.length) out.codes = DEFAULT_CODES;
  return out;
}

async function fetchPeSeries(indexCode) {
  const url = `${API}?indexCode=${encodeURIComponent(indexCode)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`${indexCode} HTTP ${res.status}`);
  const json = await res.json();
  if (!json?.data?.length) throw new Error(`${indexCode} 返回空数据：${json?.msg ?? ''}`);

  return json.data
    .map((d) => ({
      date: `${d.tradeDate.slice(0, 4)}-${d.tradeDate.slice(4, 6)}-${d.tradeDate.slice(6, 8)}`,
      pe: Number(d.peg),
    }))
    .filter((x) => Number.isFinite(x.pe) && x.pe > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** 当前值在过去 N 年样本中的历史分位（0~100，越大越贵） */
function percentile(series, years) {
  const cutoff = years
    ? series[series.length - 1].date.slice(0, 4) - years
    : -Infinity;
  const window = series.filter((x) => Number(x.date.slice(0, 4)) > cutoff);
  const current = series[series.length - 1].pe;
  const below = window.filter((x) => x.pe < current).length;
  const equal = window.filter((x) => x.pe === current).length;
  const pct = ((below + equal / 2) / window.length) * 100;

  const sorted = [...window].sort((a, b) => a.pe - b.pe);
  const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))].pe;
  return {
    years: years ?? '全部',
    current,
    pct: +pct.toFixed(2),
    p20: +q(0.2).toFixed(2),
    p50: +q(0.5).toFixed(2),
    p80: +q(0.8).toFixed(2),
    min: +sorted[0].pe.toFixed(2),
    max: +sorted[sorted.length - 1].pe.toFixed(2),
    n: window.length,
  };
}

function bucket(pct) {
  if (pct < 20) return '低估区';
  if (pct < 50) return '偏低/合理';
  if (pct < 80) return '偏高';
  return '高估区';
}

async function main() {
  const { codes, csv } = parseArgs(process.argv.slice(2));

  for (const code of codes) {
    const series = await fetchPeSeries(code);
    const stats = [null, 10, 5, 3].map((y) => percentile(series, y));
    const head = stats[0];

    console.log(`\n═══ ${code} ${series[0].date} → ${series[series.length - 1].date} （${series.length} 个交易日）`);
    console.log('区间      当前PE   分位     20%   50%   80%   区间最低  区间最高   判断');
    for (const s of stats) {
      const label = s.years === '全部' ? '全历史' : `近${s.years}年`;
      console.log(
        `${label.padEnd(8)} ${String(s.current).padStart(6)}  ${String(s.pct).padStart(5)}%  ` +
          `${String(s.p20).padStart(5)} ${String(s.p50).padStart(5)} ${String(s.p80).padStart(5)}   ` +
          `${String(s.min).padStart(6)}   ${String(s.max).padStart(7)}   ${bucket(s.pct)}`
      );
    }

    if (csv) {
      mkdirSync(resolve(ROOT, 'data'), { recursive: true });
      const csvPath = resolve(ROOT, `data/${code}-pe-history.csv`);
      writeFileSync(
        csvPath,
        ['date,pe', ...series.map((x) => `${x.date},${x.pe}`)].join('\n')
      );
      const jsonPath = resolve(ROOT, `data/${code}-pe-percentile.json`);
      writeFileSync(
        jsonPath,
        JSON.stringify({ indexCode: code, updated: series[series.length - 1].date, stats }, null, 2)
      );
      console.log(`已导出：${csvPath}\n         ${jsonPath}`);
    }

    console.log(`一句话：全历史分位 ${head.pct}%（${bucket(head.pct)}），近10年 ${stats[1].pct}%，近5年 ${stats[2].pct}%。`);
  }
}

main().catch((e) => {
  console.error('失败：', e.message);
  process.exit(1);
});
