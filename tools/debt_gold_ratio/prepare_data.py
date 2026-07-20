from __future__ import annotations

import json
import urllib.request
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = ROOT / "sources" / "data" / "debt-gold-ratio"
OUTPUT_DIR = ROOT / "outputs" / "debt-gold-ratio"

FRED_DEBT_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=GFDEBTN"
WB_MONTHLY_URL = (
    "https://thedocs.worldbank.org/en/doc/"
    "74e8be41ceb20fa0da750cda2f6b9e4e-0050012026/related/"
    "CMO-Historical-Data-Monthly.xlsx"
)
OWID_MINE_URL = (
    "https://ourworldindata.org/grapher/global-mine-production-minerals.csv"
    "?v=1&csvType=full&useColumnShortNames=false"
)


def download_sources() -> dict[str, Path]:
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    paths = {
        "fred_debt": SOURCE_DIR / "GFDEBTN.csv",
        "world_bank_monthly": SOURCE_DIR / "CMO-Historical-Data-Monthly.xlsx",
        "owid_mine_production": SOURCE_DIR / "global-mine-production-minerals.csv",
    }
    pd.read_csv(FRED_DEBT_URL).to_csv(paths["fred_debt"], index=False)
    request = urllib.request.Request(
        WB_MONTHLY_URL, headers={"User-Agent": "Mozilla/5.0 Codex data fetch/1.0"}
    )
    with urllib.request.urlopen(request) as response:
        paths["world_bank_monthly"].write_bytes(response.read())
    pd.read_csv(OWID_MINE_URL, storage_options={"User-Agent": "Codex data fetch/1.0"}).to_csv(
        paths["owid_mine_production"], index=False
    )
    return paths


def parse_gold_price(path: Path) -> pd.Series:
    raw = pd.read_excel(path, sheet_name="Monthly Prices", header=None)
    header_row = None
    gold_col = None
    for idx in range(min(12, len(raw))):
        values = raw.iloc[idx].tolist()
        for candidate in ("GOLD", "Gold"):
            if candidate in values:
                header_row = idx
                gold_col = values.index(candidate)
                break
        if header_row is not None:
            break
    if header_row is None or gold_col is None:
        raise ValueError("Could not locate Gold column in World Bank monthly file")
    date_col = 0
    data = raw.iloc[header_row + 1 :, [date_col, gold_col]].copy()
    data.columns = ["month", "gold_price_usd_per_oz"]
    data["month"] = data["month"].astype(str)
    data = data[data["month"].str.match(r"^\d{4}M\d{2}$", na=False)]
    data["year"] = data["month"].str.slice(0, 4).astype(int)
    data["gold_price_usd_per_oz"] = pd.to_numeric(
        data["gold_price_usd_per_oz"], errors="coerce"
    )
    return data.groupby("year")["gold_price_usd_per_oz"].mean()


def parse_debt(path: Path) -> pd.Series:
    debt = pd.read_csv(path, parse_dates=["observation_date"])
    debt["year"] = debt["observation_date"].dt.year
    debt["quarter"] = debt["observation_date"].dt.quarter
    q4 = debt[debt["quarter"] == 4].copy()
    # FRED GFDEBTN is in millions of dollars. Convert to trillions.
    q4["us_total_public_debt_usd_tn"] = q4["GFDEBTN"] / 1_000_000
    return q4.set_index("year")["us_total_public_debt_usd_tn"]


def parse_mine_production(path: Path) -> pd.Series:
    mine = pd.read_csv(path)
    gold = mine[mine["Entity"] == "Gold"].copy()
    gold["mine_production_tonnes"] = pd.to_numeric(
        gold["Global mine production of different minerals"], errors="coerce"
    )
    return gold.set_index("Year")["mine_production_tonnes"]


def estimate_above_ground_stock(mine: pd.Series) -> pd.Series:
    # WGC page states total above-ground stock was 219,891 tonnes at end-2025.
    # Its page also describes the dataset as annual stock from 2010 to 2025.
    # Because command-line download of the full WGC workbook requires a terms
    # flow, this workbook uses 2025 WGC as the anchor and rolls backward using
    # annual global mine production. This is an approximation of above-ground
    # stock, not a restatement of the inaccessible WGC workbook.
    stock: dict[int, float] = {2025: 219_891.0}
    implied_2025_production = 3_626.0
    production = mine.to_dict()
    production[2025] = implied_2025_production
    for year in range(2024, 1975, -1):
        stock[year] = stock[year + 1] - float(production.get(year + 1, 0.0))
    return pd.Series(stock).sort_index()


def main() -> None:
    paths = download_sources()
    debt = parse_debt(paths["fred_debt"])
    gold_price = parse_gold_price(paths["world_bank_monthly"])
    mine = parse_mine_production(paths["owid_mine_production"])
    stock = estimate_above_ground_stock(mine)

    years = list(range(1976, 2026))
    df = pd.DataFrame({"year": years})
    df["us_total_public_debt_usd_tn"] = df["year"].map(debt)
    df["gold_price_usd_per_oz"] = df["year"].map(gold_price)
    df["mine_production_tonnes"] = df["year"].map(mine)
    df.loc[df["year"] == 2025, "mine_production_tonnes"] = 3_626.0
    df["above_ground_gold_stock_tonnes_est"] = df["year"].map(stock)
    df["gold_market_cap_usd_tn"] = (
        df["above_ground_gold_stock_tonnes_est"]
        * 32150.746568627
        * df["gold_price_usd_per_oz"]
        / 1_000_000_000_000
    )
    df["debt_to_gold_market_cap_ratio"] = (
        df["us_total_public_debt_usd_tn"] / df["gold_market_cap_usd_tn"]
    )
    df["stock_method"] = df["year"].apply(
        lambda y: "WGC 2025 anchor rolled backward with OWID mine production"
        if y < 2025
        else "WGC stated end-2025 above-ground stock"
    )

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUTPUT_DIR / "debt_gold_ratio_data.json"
    clean_df = df.round(6).where(pd.notna(df), None)
    out.write_text(
        json.dumps(
            {
                "metadata": {
                    "period": "1976-2025",
                    "generated_on": "2026-07-19",
                    "ratio": "US total public debt / estimated global above-ground gold market cap",
                    "debt_source": FRED_DEBT_URL,
                    "gold_price_source": WB_MONTHLY_URL,
                    "mine_production_source": OWID_MINE_URL,
                    "gold_stock_anchor_source": "https://www.gold.org/goldhub/data/how-much-gold",
                    "notes": [
                        "Debt uses FRED GFDEBTN Q4 total public debt, converted from millions to trillions of USD.",
                        "Gold price uses World Bank Pink Sheet annual average from monthly GOLD series, USD per troy ounce.",
                        "Gold stock uses WGC end-2025 stock of 219,891 tonnes as anchor; earlier years are estimated by subtracting global mine production.",
                    ],
                },
                "rows": clean_df.to_dict(orient="records"),
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(out)
    print(df.head(3).to_string(index=False))
    print(df.tail(3).to_string(index=False))


if __name__ == "__main__":
    main()
