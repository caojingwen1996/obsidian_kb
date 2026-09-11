"""Nasdaq-100 data from the project's supported WeStock CLI."""
import math
import subprocess
from datetime import datetime, timezone
from pathlib import Path


def parse_table(text):
    lines = [line.strip() for line in text.splitlines() if line.strip().startswith("|")]
    if len(lines) < 3:
        raise ValueError("WeStock returned no table")
    headers = [cell.strip() for cell in lines[0].strip("|").split("|")]
    rows = []
    for line in lines[2:]:
        cells = [cell.strip() for cell in line.strip("|").split("|")]
        if len(cells) != len(headers):
            raise ValueError("WeStock table shape changed")
        rows.append(dict(zip(headers, cells)))
    return rows


def fetch_chart(node, runner=subprocess.run):
    script = Path(__file__).resolve().parents[3] / ".agents/skills/westock-data/scripts/index.js"

    def query(*args):
        result = runner([node, str(script), *args], capture_output=True, text=True,
                        encoding="utf-8", timeout=20, check=True)
        return parse_table(result.stdout)

    quote = query("quote", "us.NDX")[0]
    if quote.get("symbol") not in ("usNDX", "us.NDX"):
        raise ValueError("Unexpected index identity")
    current = float(quote["price"])
    if not math.isfinite(current) or current <= 0:
        raise ValueError("Invalid Nasdaq price")
    as_of = datetime.strptime(quote["time"][:10], "%Y-%m-%d").replace(hour=16, tzinfo=timezone.utc)
    rows = query("kline", "us.NDX", "--period", "day", "--limit", "2000", "--fq", "bfq")
    dates = {}
    for row in rows:
        day = datetime.strptime(row["date"], "%Y-%m-%d").replace(hour=16, tzinfo=timezone.utc)
        value = float(row["last"])
        if day <= as_of and math.isfinite(value) and value > 0:
            dates[day] = value
    if not dates or max(dates) != as_of:
        raise ValueError("Quote and daily history dates do not match")
    history = sorted(dates.items())
    return {"chart": {"result": [{
        "meta": {"regularMarketPrice": current, "regularMarketTime": as_of.timestamp(),
                 "gmtoffset": 0, "dataGranularity": "1d"},
        "timestamp": [day.timestamp() for day, _ in history],
        "indicators": {"quote": [{"close": [value for _, value in history]}]},
    }]}}
