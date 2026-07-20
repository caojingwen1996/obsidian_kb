# Investment Workbench 工作说明

## 定位

`workbench/` 与 `wiki/` 同级，承载具体标的研究、估值、跟踪和操作记录。这里的内容具有时效性，不属于冰冰小美正式知识页。

## 路由

- 具体公司研报、DCF、公告跟踪、价格变化、持仓动作进入 `workbench/`。
- 冰冰小美概念、观点、推导和框架演化进入 `wiki/`。
- Workbench 工件不得使用 `type: query`、`type: event` 或 `type: timeline`。

## 标的文件

`targets/` 采用扁平结构，不创建标的子目录。权威研报保存为 `targets/YYYY-MM-DD-HHmm-<标的>-机构级决策研报.md`，后续节点保存为 `targets/YYYY-MM-DD-<标的>-<事件>-跟踪.md`，通过 frontmatter `artifact_type` 区分。

HTML、资金面分析和其他自动化展示产物不进入 Workbench，应返回对应的 `sources/automations/<分类>/`；尚未分类的标的产物进入 `sources/automations/temp/`。

## 知识回流

只有直接解释冰冰小美原文、在多个标的重复验证、能说明既有框架变量，或经用户明确批准的规律，才能回流 `wiki/`。回流只提炼规律和必要案例，不复制整份研报。

## 更新规则

同一标的的当前权威研报原地更新；影响操作逻辑的增量在 `targets/` 根层新增跟踪文件。所有关键断言必须链接来源并保留抓取时间、口径和不确定性。
