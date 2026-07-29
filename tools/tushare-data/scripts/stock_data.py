"""Stock-level Tushare helpers."""

from tushare_client import TushareClient


def stock_basic_rows(client=None):
    return (client or TushareClient()).stock_basic_rows()


def daily_basic_rows(ts_code, client=None):
    return (client or TushareClient()).daily_basic_rows(ts_code=ts_code)
