# Investment Workbench 工作说明

## 定位

`workbench/` 与 `wiki/` 同级，承载具体标的研究、估值、跟踪和操作记录。这里的内容具有时效性，不属于冰冰小美正式知识页。

## 路由

- 具体公司研报、DCF、公告跟踪、价格变化、持仓动作进入 `workbench/`。
- 冰冰小美概念、观点、推导和框架演化进入 `wiki/`。
- Workbench 工件不得使用 `type: query`、`type: event` 或 `type: timeline`。

## 标的目录

使用 `targets/<证券代码>-<公司简称>/`，其下固定为 `index.md`、`reports/`、`tracking/`、`sources/`、`models/`、`outputs/`。

## 知识回流

只有直接解释冰冰小美原文、在多个标的重复验证、能说明既有框架变量，或经用户明确批准的规律，才能回流 `wiki/`。回流只提炼规律和必要案例，不复制整份研报。

## 更新规则

同一标的的当前权威研报原地更新；影响操作逻辑的增量进入 `tracking/YYYY-MM-DD-事件.md`。所有关键断言必须链接来源并保留抓取时间、口径和不确定性。
