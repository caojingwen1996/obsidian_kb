"""Shared index helpers; explicit exchange suffixes prevent stock/index confusion."""

from tushare_client import TushareClient
from tushare_market_data import MarketData


def client():
    return TushareClient()


def index_daily(ts_code, start_date, end_date, client=None, **options):
    return MarketData(client).query("get_index_daily", ts_code=ts_code, start_date=start_date,
                                  end_date=end_date, **options)
