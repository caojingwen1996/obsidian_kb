# 冰冰小美风险提示工具

本工具固定读取项目内 Excel，自动联网获取上证指数日线收盘点位，并在黑色时间序列图上标记风险提示日期。

网页工具本身只用于回看风险提示与指数位置，不生成风险判断，也不构成投资建议。冰冰小美每日抓取任务可在完成结构化风险分析后，调用独立更新器写入自动分析记录。

自动分析记录会写入已确认的风险增强节点（R1/R2/R3）和风险减弱或转向机会节点（W1/W2/W3）；方向不明确（N）或证据不足（待验证）不写入。

## 启动

Windows 用户直接双击工具目录中的 `启动工具.bat`。首次运行会自动创建运行环境并安装依赖，稍后浏览器会自动打开；以后双击会直接复用现有环境。

需要手动排错时，可在 PowerShell 中运行：

```powershell
cd E:\caojingwen\obsidian\llmwiki\tools\bbxm-risk-dashboard
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python run.py
```

浏览器打开：<http://127.0.0.1:5179>

服务只监听本机地址 `127.0.0.1`，不会主动开放到局域网。

## 更新风险记录

固定文件：

```text
data/冰冰小美风险提示.xlsx
```

工作表第一行必须包含以下三列，列名不能修改：

| 列名 | 填写规则 |
|---|---|
| 日期 | Excel 日期，或 `YYYY-MM-DD` 文本 |
| 当日累计风险提示次数 | 大于或等于 0 的整数 |
| 风险原因 | 普通文本，可以换行 |

模板中的第一条记录标有“示例数据”，请替换成真实风险记录。同一天出现多行时，工具会把次数相加，并按 Excel 原顺序合并风险原因。

## 每日任务自动写入

每日任务的结构化输入和写入状态保存在对应作者日期目录的 `processing/` 中：

- 输入：`risk-analysis.json`
- 状态：`risk-write-status.json`
- 自动行标记：`[自动分析｜冰冰小美每日任务]`

更新器命令：

```powershell
python scripts/upsert_automated_risk.py `
  --analysis-file "<作者日期目录>/processing/risk-analysis.json" `
  --workbook "data/冰冰小美风险提示.xlsx" `
  --status-file "<作者日期目录>/processing/risk-write-status.json"
```

同日重跑会按当天全部已保存帖子重新计算，只替换目标日期带固定标记的自动行；同日人工行和其他日期记录保持不变。完整分析后没有可写入节点时删除旧自动行，不写入零次数记录。

Excel 被占用或暂时无法替换时，状态为 `pending`，原工作簿保持不变。关闭占用后再次运行同日任务即可重试；不要删除锁文件或强制结束 Excel 进程。

## 日期定位

- 交易日提示：红点落在当日上证指数收盘点位。
- 周末或节假日提示：红点落在此前最近一个交易日的收盘点位。
- 悬浮详情会同时显示原始风险日期和用于定位的行情日期，不会把非交易日改写成交易日。

## 行情与缓存

启动后，工具依次尝试 AKShare 的新浪和腾讯上证指数历史接口。联网成功时，最新完整数据写入：

```text
data/shanghai-index-cache.json
```

该文件是自动生成的运行缓存，不要手工编辑。联网失败但缓存存在时，页面会明确显示“缓存数据”、行情截至日和缓存更新时间；联网失败且没有缓存时，页面停止绘图并显示错误，不会把旧值伪装成最新数据。

## 常见错误

- “未找到风险记录文件”：确认 Excel 文件名和固定路径没有改变。
- “Excel 缺少必需列”：恢复三列原始列名。
- “Excel 中存在无效数据”：按页面给出的行号和列名修改单元格。
- “Excel 文件正被占用”：关闭正在独占该文件的软件后重试。
- “上证指数获取失败且没有本地缓存”：检查网络后点击“重新加载”。

## 测试

```powershell
cd E:\caojingwen\obsidian\llmwiki\tools\bbxm-risk-dashboard
python -m pytest tests -v
python -m compileall bbxm_dashboard run.py
```
