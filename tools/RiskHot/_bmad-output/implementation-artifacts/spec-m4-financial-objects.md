---
title: M4金融对象配置与共享观察
type: feature
created: 2026-11-05
status: done
route: dispatch
baseline_commit: 58df074c8fdc30699b293220a95aceda05d1bc58
review_loop_iteration: 0
context:
  - AGENTS.md
  - docs/superpowers/plans/2026-11-05-M4金融对象配置与共享观察实施.md
  - docs/system-design/03-系统功能架构/M4 金融对象配置中心与观察管理功能设计.md
  - docs/system-design/04-系统架构设计/01-数据模型与存储设计/全局配置表数据模型与存储设计.md
  - docs/system-design/06产品UI原型设计/06-6-M4金融对象配置中心UI设计/页面方向与实现边界.md
  - docs/system-design/06产品UI原型设计/06-6-M4金融对象配置中心UI设计/DESIGN.md
  - docs/system-design/06产品UI原型设计/06-6-M4金融对象配置中心UI设计/PRODUCT.md
---

<frozen-after-approval reason="用户已授权按已确认功能、原型和模型先计划再完成开发">

## Intent

将已设计的M4原型接入真实存储，实现手工金融对象配置与系统共享观察闭环。配置、事件Target、观察三者独立，人工核定映射后才显示有权限的动态。

## Boundaries & Constraints

遵守功能设计全部31项验收、数据模型19字段及历史/权限约束。继承已确认树＋列表/详情布局和现有RiskHot视觉。实际代码在src，保留工作区其他改动；不自动导入Target或演示数据、不改F01/F02队列、不推送、不部署到实际库。计划已由用户授权执行，不再次请求计划批准。

## I/O & Edge-Case Matrix

| 条件/输入 | 预期行为 | 错误处理 |
| --- | --- | --- |
| 无事件，配置启用后添加观察 | 产生唯一共享观察，不产生Target/Event | 目录/无效祖先/不完整定义拒绝 |
| 并发添加或原请求重试 | 全系统同一记录；暂停/结束走恢复 | 过期版本拒绝，批量逐项反馈 |
| 停用/移动/口径修改 | 确认最新影响后原子暂停活跃观察 | 过期确认拒绝；原手工暂停/结束保留 |
| 核定同一性及版本有效 | 仅直接事件、全来源可读且去重 | 歧义/冲突/失效不展示关联动态 |
| 重新启用/恢复 | 不自动恢复；显式采用新快照并留历史 | 无权/不可选/旧版本拒绝 |
| 旧Target手工入口/直接DML | 切换后拒绝旧写入口和非受控写入 | 事件核定内部路径保持可用 |

</frozen-after-approval>

## Code Map

- src/information-ingestion/processing/repository.ts：复用action、authorize、幂等、审计事务。
- src/platform/ingestion-grants.ts：末尾接入M4收窄授权，防重复setup扩大权限。
- src/platform/f02-migration.ts、src/tests/f02-fixture.ts：增量迁移/隔离测试参照；下一编号010。
- src/event-management/target-identity-contracts.ts：分类唯一来源，提取共享契约并保持旧导出兼容。
- src/event-management/target-queries.ts、storage-layout.ts：直接事件及全来源授权复用。
- src/event-management/eight-step-commit.ts、target-identity.ts：Target快照必须复用已有kind=target同版本快照；缺失时使用approvedDefinitions相同扩展形状，避免后续F02保存摘要冲突。采用的Target快照也需不可变保护。
- src/runtime/server.ts、web.ts、targets.ts：认证/接口/静态资源/旧入口门禁。
- src/web/targets.*、product-navigation.css、events.html、index.html、pipeline.html：现有产品页与导航。
- docs/system-design/06产品UI原型设计/06-6-M4金融对象配置中心UI设计/原型资源/：布局与交互参考，不导入model的种子与内存权限。

## Tasks & Acceptance

- [x] docs/system-design/04-系统架构设计/下补齐观察/映射模型和M4技术接口设计，落实计划。
- [x] src/db/010-m4.sql、src/platform/m4-migration.ts、src/scripts/migrate-m4.ts：增量、快照、历史、树、受控写权限与可重试部署命令。
- [x] src/financial-objects/、src/runtime/m4.ts：配置CRUD（不物理删除）、影响预览、共享观察、核定映射、查询和独立权限。
- [x] src/web/与运行路由：真实配置中心、共享观察页、选择器、编辑/移动/排序、历史、备注、映射核定、分页筛选和错误恢复；同步导航。
- [x] src/tests/m4*.test.ts、m4-browser.e2e.ts：覆盖矩阵、AC-01～31和角色隔离；更新受影响旧测试。
- [x] README、docs/verification/m4.md、index.md、log.md：运行命令、检查证据和准确边界。

验收：Given已启用目录对象，When另一账号添加/读取，Then共享唯一记录且不自动写Target；Given定义变化，When确认影响，Then历史依据保留且显式恢复；Given含受限来源事件，When查询任何数量/详情，Then不泄露事件；Given迁移前数据，When迁移/重复迁移，Then事实与历史保留。

## Implementation Notes

采用计划中的首版技术决策；必要细节由工程实现决定并回写文档。父代理负责最终独立代码/视觉审查；实现代理读取Impeccable craft-floor后再编辑页面，完成浏览器截图和一次机械detect，提供桌面/390/320及选择器/编辑截图，由父代理安排fresh finish reviewer/documenter。不要隐式调用Superpowers。不在实际库运行迁移或初始化。先最小相关检查，再完整回归。进度及时汇报父代理，遇到工具上下文上限继续完成，不以部分完成交付。

迁移检查：现有setup只自动走schema5/6/7，M4显式要求8前置；不借setup自动切换F02。本机账号首次初始化可含新职责，已有账号的显式授权入口应可重复执行；OIDC初始化固定权限数组同步。前端路由根据M4迁移状态切换，保留schema8旧测试兼容。快照用event-management/contracts.ts的canonical/digest（能处理Date），不是repository.ts同名工具。schema5缺少快照不可变保护；公共角色授予会放大IO写权限，必须最后撤回M4表直接DML并授权受控写路径。

## Spec Change Log

## Review Triage Log

2026-11-05：三层独立审查全部返回后逐项核查。下表均为现有行为的具体修正或回归补齐，不增加公开功能范围；统一按patch交回原实现代理，保留现有工作区及已通过能力。未发现需要改变用户意图的事项。

| 编号 | 判定 | 问题 | 核查证据 | 处理路线 |
| --- | --- | --- | --- | --- |
| B1 | medium | 选择器空目录参数 | queryString原样序列化空字符串，query.parent_id只允许UUID/root；搜索与全部配置按钮均可触发400。 | 修复空筛选序列化并补浏览器路径 |
| B2 | high | 主页面异步状态覆盖 | render把await结果先赋全局data/detail再检查serial；旧请求仍能替换新页面按钮使用的对象。 | 局部接收且校验代次后才采用 |
| B3 | medium | 跨模块首份Target快照竞争 | M4与F02都先FOR SHARE，同版本唯一约束存在但M4裸INSERT无复用；兼容锁允许F02先插入。 | 串行快照创建并保留内容校验及并发回归 |
| B4 | medium | 批次请求内容未绑定 | batch仅按key与config_id派生子键，新增B不触碰A已有receipt；相同批次键改变items会被接受。 | 登记整批摘要，保留逐项事务 |
| B5 | medium | 撤销映射输入两端未匹配 | map按config OR target读取后只按mapping_id找记录，未核对两端同时匹配。 | 核对完整映射身份与版本 |
| B6 | medium | 失败选择保留旧版本 | selected保存原Config，selector重新读取未更新该集合；直接重试仍提交旧expected_config_version。 | 撤回失效选择并要求重新核对 |
| B7 | medium | 跨页添加结果丢失名称 | 成功项先从selected删除，当前页之外成功项无法再查name。 | 用本次提交选择快照呈现结果 |
| B8 | medium | 选择器超过批次上限 | 前端跨页集合无数量上限；API maxItems=100使第101项整批失败。 | 前端执行100项上限并提示 |
| B9 | medium | 映射历史缺少目标身份 | configDetail只返回mapping引用，UI只有状态/原因/版本；撤销弹窗无Target摘要。 | 返回采用快照并展示目标身份与范围 |
| B10 | medium | 配置历史展示不完整 | definition不展示name/parent_id/sort_order/status；这些变更虽有快照却不能从历史核对。 | 补足历史字段显示 |
| B11 | medium | 弹窗迟到响应复开或覆盖 | selector/mapping无请求代次，closeDialog未使读取失效；晚到结果可重新showModal。 | 独立弹窗代次与关闭失效 |
| G1 | medium | 真实页面首次新建缺口 | 验证层已核查：浏览器对象均由服务预置，实际新建表单的POST分支没有执行断言。 | 经空目录真实表单创建目录及对象 |
| G2 | medium | 已映射口径修订组合缺口 | 验证层已核查：范围修订测试没有批准映射；映射测试只改Target版本；二者未组合。 | 补修订后原子暂停/待核定/旧快照断言 |
| E1 | medium | 选择器空目录参数 | 与B1相同可达路径；已分别核验并保留本行，不省略重复发现。 | 与B1合并修复 |
| E2 | medium | 说明首尾空白导致SQL拒绝 | SQL把reason btrim后与mapping.reason及snapshot.change.reason比较；服务部分路径未采用reason()返回值，隔离库已复现。 | 统一规范化并覆盖空格/换行 |
| E3 | high | 成功响应不可解析丢弃幂等请求 | api.js对JSON解析失败给OUTCOME_UNKNOWN及200/201；sendPending只识别无status/5xx而清除pending。旧兼容页同样可达。 | 显式保留OUTCOME_UNKNOWN原请求并回归 |
| P1 | medium | 非法分类命中对象原型 | 父流程用primary_category=constructor调用normalize，得到TypeError且没有DomainError代码；字符串API校验允许其到达。 | 增加自有键校验并断言拒绝非法分类 |

## 审查修复结果

2026-11-05：B1～B11、G1～G2、E1～E3及P1均已落实修复或回归补齐；B1/E1共享同一修复，其他逐项保留证据。实现代理定向24/24、M4浏览器16组、旧Target浏览器8组及类型检查通过，父流程已核对改后代码与结果文件。父流程完整回归394/394通过；Impeccable文档交接已完成，既有规范文件保留。结果统一登记到工程验证报告。未将任何确认问题留作后续，不因审查回滚或覆盖原工作区。

## Verification

- npm run typecheck
- node --env-file-if-exists=.env --import tsx --test --test-concurrency=1 src/tests/m4*.test.ts
- EXECUTION_ENGINE=temporal npm test（默认环境失败的旧夹具结果另行保留）
- node --env-file-if-exists=.env --import tsx src/tests/m4-browser.e2e.ts
- python3 ../../rules/check_markdown_tables.py 本次全部Markdown

交付状态：开发与隔离验证完成，实际运行库未迁移。当前main工作区含前序未提交依赖及其他改动，本轮保留原状态，未自动提交、推送或部署。
