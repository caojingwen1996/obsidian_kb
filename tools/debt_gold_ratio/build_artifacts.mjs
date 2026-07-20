import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const outputDir = path.join(root, "outputs", "debt-gold-ratio");
const dataPath = path.join(outputDir, "debt_gold_ratio_data.json");
const payload = JSON.parse(await fs.readFile(dataPath, "utf8"));
const rows = payload.rows;

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

const workbook = Workbook.create();
const dataSheet = workbook.worksheets.add("Data");
const sourceSheet = workbook.worksheets.add("Sources");
dataSheet.showGridLines = false;
sourceSheet.showGridLines = false;

const headers = [
  "Year",
  "US Total Public Debt (USD tn)",
  "Gold Price Annual Avg (USD/oz)",
  "Mine Production (tonnes)",
  "Estimated Above-ground Gold Stock (tonnes)",
  "Gold Market Cap (USD tn)",
  "Debt / Gold Market Cap",
  "Stock Method",
];
const matrix = [
  headers,
  ...rows.map((r) => [
    r.year,
    r.us_total_public_debt_usd_tn,
    r.gold_price_usd_per_oz,
    r.mine_production_tonnes,
    r.above_ground_gold_stock_tonnes_est,
    r.gold_market_cap_usd_tn,
    r.debt_to_gold_market_cap_ratio,
    r.stock_method,
  ]),
];
dataSheet.getRangeByIndexes(0, 0, matrix.length, headers.length).values = matrix;

dataSheet.getRange("A1:H1").format.fill.color = "#203864";
dataSheet.getRange("A1:H1").format.font.color = "#FFFFFF";
dataSheet.getRange("A1:H1").format.font.bold = true;
dataSheet.getRange("A1:H1").format.wrapText = true;
dataSheet.freezePanes.freezeRows(1);
dataSheet.getRange("A:A").format.columnWidth = 10;
dataSheet.getRange("B:B").format.columnWidth = 18;
dataSheet.getRange("C:C").format.columnWidth = 20;
dataSheet.getRange("D:E").format.columnWidth = 20;
dataSheet.getRange("F:G").format.columnWidth = 18;
dataSheet.getRange("H:H").format.columnWidth = 54;
dataSheet.getRange(`A1:H${matrix.length}`).format.borders = {
  preset: "inside",
  style: "thin",
  color: "#D9E2F3",
};
dataSheet.getRange(`B2:B${matrix.length}`).setNumberFormat("0.00");
dataSheet.getRange(`C2:C${matrix.length}`).setNumberFormat("$#,##0.00");
dataSheet.getRange(`D2:E${matrix.length}`).setNumberFormat("#,##0");
dataSheet.getRange(`F2:F${matrix.length}`).setNumberFormat("0.00");
dataSheet.getRange(`G2:G${matrix.length}`).setNumberFormat("0.00");

const sourceRows = [
  ["Field", "Definition / Source"],
  ["Ratio", payload.metadata.ratio],
  ["Period", payload.metadata.period],
  ["Generated on", payload.metadata.generated_on],
  ["Debt source", payload.metadata.debt_source],
  ["Gold price source", payload.metadata.gold_price_source],
  ["Mine production source", payload.metadata.mine_production_source],
  ["Gold stock anchor source", payload.metadata.gold_stock_anchor_source],
  ["Note 1", payload.metadata.notes[0]],
  ["Note 2", payload.metadata.notes[1]],
  ["Note 3", payload.metadata.notes[2]],
];
sourceSheet.getRangeByIndexes(0, 0, sourceRows.length, 2).values = sourceRows;
sourceSheet.getRange("A1:B1").format.fill.color = "#203864";
sourceSheet.getRange("A1:B1").format.font.color = "#FFFFFF";
sourceSheet.getRange("A1:B1").format.font.bold = true;
sourceSheet.getRange("A:A").format.columnWidth = 28;
sourceSheet.getRange("B:B").format.columnWidth = 110;
sourceSheet.getRange("B:B").format.wrapText = true;
sourceSheet.getRange(`A1:B${sourceRows.length}`).format.borders = {
  preset: "inside",
  style: "thin",
  color: "#D9E2F3",
};

await fs.mkdir(outputDir, { recursive: true });
const xlsx = await SpreadsheetFile.exportXlsx(workbook);
const xlsxPath = path.join(outputDir, "us-debt-to-gold-market-cap-1976-2025.xlsx");
await xlsx.save(xlsxPath);

const chartData = rows.map((r) => ({
  year: r.year,
  ratio: r.debt_to_gold_market_cap_ratio,
  debt: r.us_total_public_debt_usd_tn,
  goldMarketCap: r.gold_market_cap_usd_tn,
  goldPrice: r.gold_price_usd_per_oz,
  goldStock: r.above_ground_gold_stock_tonnes_est,
}));

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>美债 / 黄金市值比 1976-2025</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #172033;
      --muted: #5b667a;
      --line: #d8dee9;
      --debt: #2f6fed;
      --gold: #b8871f;
      --ratio: #1e8a5a;
      --bg: #f7f9fc;
      --panel: #ffffff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--ink);
      background: var(--bg);
    }
    main {
      width: min(1180px, calc(100vw - 32px));
      margin: 28px auto;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 28px;
      font-weight: 750;
      letter-spacing: 0;
    }
    .sub {
      margin: 0 0 20px;
      color: var(--muted);
      line-height: 1.5;
      max-width: 980px;
    }
    .toolbar {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      align-items: center;
      margin: 0 0 14px;
    }
    button {
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #fff;
      color: var(--ink);
      padding: 8px 12px;
      font-size: 14px;
      cursor: pointer;
    }
    button.active {
      border-color: var(--ratio);
      color: #fff;
      background: var(--ratio);
    }
    .chart-wrap {
      position: relative;
      width: 100%;
      min-height: 520px;
      padding: 18px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
    }
    svg {
      display: block;
      width: 100%;
      height: 520px;
      overflow: visible;
    }
    .axis text { fill: var(--muted); font-size: 12px; }
    .axis line, .axis path { stroke: #ccd5e3; }
    .grid line { stroke: #edf1f7; }
    .tooltip {
      position: absolute;
      min-width: 230px;
      pointer-events: none;
      opacity: 0;
      transform: translate(-50%, -105%);
      padding: 10px 12px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(255,255,255,.97);
      box-shadow: 0 10px 28px rgba(23,32,51,.14);
      font-size: 13px;
      line-height: 1.45;
    }
    .tooltip strong { display: block; margin-bottom: 4px; }
    .legend {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      margin-top: 12px;
      color: var(--muted);
      font-size: 13px;
    }
    .key {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .swatch {
      width: 18px;
      height: 3px;
      border-radius: 2px;
      background: var(--ratio);
    }
    .notes {
      margin-top: 16px;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.55;
    }
    @media (max-width: 760px) {
      main { width: min(100vw - 20px, 1180px); margin-top: 18px; }
      h1 { font-size: 22px; }
      .chart-wrap { min-height: 420px; padding: 10px; }
      svg { height: 420px; }
    }
  </style>
</head>
<body>
<main>
  <h1>美债 / 黄金市值比</h1>
  <p class="sub">1976-2025 年年度序列。美债使用 FRED GFDEBTN 年末 Q4 美国联邦总债务；黄金市值 = 估算全球地上黄金存量 × 年均金价。鼠标悬停折线可看当年明细。</p>
  <div class="toolbar">
    <button class="active" data-mode="ratio">比值</button>
    <button data-mode="levels">美债与黄金市值</button>
  </div>
  <section class="chart-wrap">
    <svg id="chart" role="img" aria-label="美债与黄金市值比折线图"></svg>
    <div class="tooltip" id="tooltip"></div>
    <div class="legend" id="legend"></div>
  </section>
  <div class="notes">
    数据源：FRED GFDEBTN、World Bank Pink Sheet GOLD、Our World in Data 全球矿产金、World Gold Council 地上黄金存量锚点。2010 年以前及大部分历史存量为按矿产金回推估算，适合观察长周期趋势，不适合当作精确清算口径。
  </div>
</main>
<script>
const data = ${JSON.stringify(chartData)};
const svg = document.getElementById("chart");
const tooltip = document.getElementById("tooltip");
const legend = document.getElementById("legend");
let mode = "ratio";

const colors = { ratio: "#1e8a5a", debt: "#2f6fed", gold: "#b8871f" };
function fmt(v, d = 2) { return Number(v).toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d }); }
function escText(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
function clear() { while (svg.firstChild) svg.removeChild(svg.firstChild); }
function el(name, attrs = {}) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  return node;
}
function draw() {
  clear();
  const width = svg.clientWidth || 1000;
  const height = svg.clientHeight || 520;
  const margin = { top: 18, right: mode === "levels" ? 54 : 26, bottom: 48, left: 58 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const years = data.map(d => d.year);
  const x = y => margin.left + (y - Math.min(...years)) / (Math.max(...years) - Math.min(...years)) * innerW;
  const series = mode === "ratio"
    ? [{ key: "ratio", label: "美债 / 黄金市值", values: data.map(d => d.ratio), color: colors.ratio }]
    : [
        { key: "debt", label: "美债，万亿美元", values: data.map(d => d.debt), color: colors.debt },
        { key: "goldMarketCap", label: "黄金市值，万亿美元", values: data.map(d => d.goldMarketCap), color: colors.gold },
      ];
  const maxY = Math.max(...series.flatMap(s => s.values)) * 1.08;
  const minY = 0;
  const y = v => margin.top + innerH - (v - minY) / (maxY - minY) * innerH;

  for (let i = 0; i <= 5; i++) {
    const value = minY + (maxY - minY) * i / 5;
    const yy = y(value);
    svg.appendChild(el("line", { x1: margin.left, y1: yy, x2: width - margin.right, y2: yy, stroke: "#edf1f7" }));
    const label = el("text", { x: margin.left - 10, y: yy + 4, "text-anchor": "end", fill: "#5b667a", "font-size": 12 });
    label.textContent = fmt(value, mode === "ratio" ? 1 : 0);
    svg.appendChild(label);
  }

  for (let year = 1980; year <= 2025; year += 5) {
    const xx = x(year);
    svg.appendChild(el("line", { x1: xx, y1: margin.top, x2: xx, y2: margin.top + innerH, stroke: "#f4f6fa" }));
    const label = el("text", { x: xx, y: height - 14, "text-anchor": "middle", fill: "#5b667a", "font-size": 12 });
    label.textContent = year;
    svg.appendChild(label);
  }

  series.forEach(s => {
    const points = data.map((d, i) => x(d.year) + "," + y(s.values[i])).join(" ");
    svg.appendChild(el("polyline", { points, fill: "none", stroke: s.color, "stroke-width": 3, "stroke-linejoin": "round", "stroke-linecap": "round" }));
  });

  data.forEach((d, i) => {
    const cx = x(d.year);
    const cy = y(mode === "ratio" ? d.ratio : d.debt);
    const hit = el("circle", { cx, cy, r: 8, fill: "transparent" });
    hit.addEventListener("mousemove", (event) => {
      tooltip.style.opacity = "1";
      tooltip.style.left = event.offsetX + "px";
      tooltip.style.top = event.offsetY + "px";
      tooltip.innerHTML = "<strong>" + d.year + "</strong>" +
        "比值：" + fmt(d.ratio, 2) + "<br>" +
        "美债：" + fmt(d.debt, 2) + " 万亿美元<br>" +
        "黄金市值：" + fmt(d.goldMarketCap, 2) + " 万亿美元<br>" +
        "年均金价：$" + fmt(d.goldPrice, 2) + "/oz<br>" +
        "黄金存量：" + Math.round(d.goldStock).toLocaleString("en-US") + " 吨";
    });
    hit.addEventListener("mouseleave", () => { tooltip.style.opacity = "0"; });
    svg.appendChild(hit);
    if (mode === "ratio") svg.appendChild(el("circle", { cx, cy, r: 3.2, fill: colors.ratio }));
  });

  legend.innerHTML = series.map(s => '<span class="key"><span class="swatch" style="background:' + s.color + '"></span>' + escText(s.label) + '</span>').join("");
}
document.querySelectorAll("button[data-mode]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("button[data-mode]").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    mode = btn.dataset.mode;
    draw();
  });
});
window.addEventListener("resize", draw);
draw();
</script>
</body>
</html>`;

const htmlPath = path.join(outputDir, "us-debt-to-gold-market-cap-1976-2025.html");
await fs.writeFile(htmlPath, html, "utf8");

const inspect = await workbook.inspect({
  kind: "table",
  range: "Data!A1:H8",
  include: "values",
  tableMaxRows: 8,
  tableMaxCols: 8,
});
console.log(inspect.ndjson);
console.log(xlsxPath);
console.log(htmlPath);
