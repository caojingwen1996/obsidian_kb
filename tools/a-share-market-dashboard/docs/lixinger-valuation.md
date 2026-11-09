# 纳斯达克100估值：理杏仁接口

更新：2026-11-09。已完成看板接口接线和离线测试；当前环境未配置 `LIXINGER_TOKEN`，账号权限、`.NDX` 的 PE-TTM 与十年分位实际返回仍待验证。官方接口支持这些字段不等于本账号已取得数据。未填入示例估值。

## 数据与口径

- 来源：[理杏仁美国指数基本面 API](https://www.lixinger.com/api/open-api/html-doc/us/index/fundamental)。POST `https://open.lixinger.com/api/us/index/fundamental`。
- 指数代码 `.NDX`（纳斯达克100）；理杏仁官方[美股指数收益率文档](https://www.lixinger.com/api/open-api/html-doc/us/index/hot/cp)列出该代码。不是纳斯达克综合指数 `.IXIC`，也不是纳斯达克交易所股票。
- PE-TTM 请求字段 `pe_ttm.mcw`，总市值加权；近十年分位请求字段 `pe_ttm.y10.mcw.cvpos`，相同加权口径。采用理杏仁提供的分位，不与 Wind 历史拼接，不在本地用价格或短历史代算。
- 官方返回示例的 `cvpos` 为 0～1，输出到看板乘100，单位为百分比；真实0分位有效，缺失、非有限值、越界值保持缺失。
- 两项取自同一个最新返回日期；若最新行 PE 缺失，则本次更新失败；若仅分位缺失，则显示当日 PE 并说明分位缺失，不拼入旧日期分位。
- 页面单列估值日期，可能晚于行情披露、也可能早于行情日期。十年窗口的样本和算法由理杏仁负责，本轮未独立重建十年历史。

## 配置

在启动看板的进程环境中配置 `LIXINGER_TOKEN`，或者在看板现有 `.env` 文件中增加同名变量。环境变量优先；文件按 UTF-8 读取，每次查询重新读取。不得把密钥写入 HTML、源码、Excel或聊天。账号须具备对应美股指数基本面权限，网站会员与 API 权限是否一致须以账号实际返回为准。

首次部署代码需重启看板服务；之后更新 `.env` 无须重启。使用进程环境变量时，更改变量后需要重启进程。

## Python 调用

从看板项目根目录运行 Python，可调用：

```python
from scripts.lixinger_data import get_nasdaq_valuation

result = get_nasdaq_valuation("2026-11-06")
print(result.get("status"), result.get("valuationDate"))
print(result.get("peTtm"), result.get("pePercentile10y"))
```

`get_nasdaq_valuation(end_date=None, *, token=None, transport=None, cache_path=CACHE, force=False, now=None)`：

- `end_date`：`YYYY-MM-DD` 查询截止日期，默认北京时间当天；看板传入 Yahoo 已收盘日线的末日。
- `token=None`：从环境或 `.env` 读取；显式传入只适用于已有安全凭据管理的 Python 调用方。
- `force=True`：跳过一小时成功缓存。
- `transport`、`cache_path`、`now`：用于测试或受控调用；默认访问固定官方地址、使用独立本地缓存与当前时间。
- 查询截止日向前30天，显式传入 `startDate`、`endDate`；选取最新一日，不依赖接口默认的结束日期。

返回字段：

| 字段 | 含义 |
|---|---|
| `peTtm` | 总市值加权 PE-TTM，倍；失败且无缓存时不存在 |
| `pePercentile10y` | 同口径近十年分位，0～100；未取得则为 null 或不存在 |
| `valuationDate` | 估值数据自身日期，不改写成查询日期 |
| `valuationSource` / `valuationSourceUrl` | 理杏仁及官方文档地址 |
| `valuationBasis` | `pe_ttm.mcw/y10.mcw.cvpos` |
| `status` | ok、partial（缺十年分位）、stale（旧值／更新失败）、missing（无值） |
| `valuationNote` | 页面展示的来源、口径、日期及失败原因 |
| `fetchedAt` | 上次成功返回的抓取时间；失败时不刷新 |
| `queryEnd` / `cacheHit` | 上次成功查询截止日／是否使用成功缓存 |
| `error` | 固定中文错误原因，不暴露服务端响应、密钥或请求体 |

看板继续使用已有 `GET /api/nasdaq100`，其 `data` 中返回估值字段，并以 `valuationStatus` 表示估值状态；Yahoo 点位、均线、回撤和收益历史不变。估值失败不会使正常行情请求失败。

## 缓存与缺失处理

独立缓存位于 `data/市场总览/lixinger-nasdaq-valuation.json`，成功数据缓存一小时。只读取代码、来源、口径匹配的理杏仁缓存；不读旧 Wind 缓存。网络、权限、格式异常时保留上次值及原日期并标旧值；无缓存则保持缺失。最新返回日期距查询截止日超过7天也标旧值。缺 Token 不发送网络请求。

校验覆盖请求代码与日期边界、重复行、最新行缺失、分位范围与换算、缓存隔离、抓取失败降级及敏感信息不泄露。实际账号验收仍需 Token 配置后执行。
