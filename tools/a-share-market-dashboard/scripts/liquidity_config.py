"""资金面日报的公开口径；这里不保存任何凭证。"""

DATA_PROVIDER = "tushare"  # Tushare与Yahoo已核验项；其余沿用非Wind来源
WIND_ENABLED = False  # 用户停用Wind；传输层也阻止调用，不读取凭证
WIND_ETF_ENABLED = False
ETF_ESTIMATE_ENABLED = True  # 份额变动×净值估算；不使用Wind
CACHE_TTL_SECONDS = 3600
REQUEST_TIMEOUT_SECONDS = 8
MAX_DAILY_AGE_DAYS = 7
MAX_WEEKLY_AGE_DAYS = 14
RRP_DECLINE_PERCENT = None  # 用户要求先留空；只展示余额，不参与评分
USD_TREND_OBSERVATIONS = 20
CN_ANNUAL_MA = 250

