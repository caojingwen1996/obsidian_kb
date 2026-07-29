"""Financial-statement Tushare helpers reserved for shared future use."""

from tushare_client import TushareClient


def client():
    return TushareClient()
