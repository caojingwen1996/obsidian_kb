"""Shared fund helpers; use MarketData for full result metadata."""

from tushare_client import TushareClient
from tushare_market_data import MarketData


def client():
    return TushareClient()


def fund_daily(ts_code, start_date, end_date, adjustment="none", client=None, **options):
    return MarketData(client).query("get_fund_daily", ts_code=ts_code, start_date=start_date,
                                  end_date=end_date, adjustment=adjustment, **options)
