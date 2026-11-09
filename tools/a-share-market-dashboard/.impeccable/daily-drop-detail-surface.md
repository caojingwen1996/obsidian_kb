# 单日回撤事件详情

模式：Operate。既有看板局部扩展，用户提供明细图固定内容结构与分组方向。

## Direction contract

THESIS：“回撤统计”与“年度收益与历史统计”并列，独立折叠；从频次数字进入对应事件，明细与累计采用同一筛选，返回原入口。

OWN-WORLD：沿用蓝灰看板；参考图深色表头、浅色周期分隔、红涨绿跌、估值分位色标及事件标签。字体和按钮保持既有系统。

STORY：累计看全部、年度看当年，详情内切换阈值和年份；估值／成因为参考图估算与事后归纳，价格与收益来自已有日线。

FIRST VIEWPORT：顶部返回和筛选，动态标题、标的范围、来源口径，再进入十一列分组表。桌面横向排列，手机横向滚动且冻结日期列；表头随表内纵向滚动固定。

FORM：用户指定的事件明细表，局部继承现有界面；seed: none (user-pinned)。不创建新视觉体系、不增加网络请求。

FINISH：unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
