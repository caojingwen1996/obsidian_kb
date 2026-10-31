# AI-07 Target 同一性判断验证记录

> 2026-10-30 · 工程交付验证。正式运行库未应用新增迁移，任务包仍为 draft。

## 1. 输入与实现范围

用户要求完成 AI-07 的机器 Schema、运行接入和真实样本评测。依据为[[tools/RiskHot/docs/system-design/03-系统功能架构/AI任务与提示词/AI-07 Target同一性判断|AI-07 功能设计]]和[[tools/RiskHot/docs/system-design/04-系统架构设计/01-数据模型与存储设计/F02事件管理模块数据模型与存储设计|F02 数据模型]]；实际流程及接口见[[tools/RiskHot/docs/system-design/04-系统架构设计/03-模块技术详细设计/L0-信息处理层/F02-事件管理/AI任务技术详细设计/AI-07-Target同一性判断|AI-07 技术实现]]。

新增逐 Object 的 NEW/REUSE/UNRESOLVED 判断、允许引用清单、全覆盖校验、Target 主表、对象补证、逐对象调用预算、人工核定、下游引用和最终保存前复验。保留旧任务包，未自动迁移旧定义，也未重建业务数据。

## 2. 真实模型评测

模型使用环境中已有的 `codex-exec / gpt-6.1-sol`，工具、文件读取与联网禁用。输入为库内已采集国债拍卖原文，来源样本 `INF-11349503-bc62-43d3-9008-457e73aca14a`，内含5条拍卖记录。本轮聚焦7年期国债 CUSIP 91282CRV5，以5年期记录作期限差异对照；其他候选为明确标注的受控定义，不声称是正式库真实目录。

来源集合为[[tools/RiskHot/docs/system-design/05-场景验证/EventTarget关系简化评测集/informations.json|真实原文样本集]]。集合原为未标注数据；本轮预期由工程身份规则在调用前固定，非独立人工金标准，10项通过不能视为泛化准确率。

执行：`node --env-file-if-exists=.env --import tsx src/scripts/evaluate-ai07.ts`。运行开始先保存输入、预期、说明、来源摘要及任务包，再依次调用真实模型。检查完整响应、JSON Schema、引用归属、决定一致性、decision、matched_target_id及逐候选identity_match。

| 场景 | 固定预期 | 结果 |
| --- | --- | --- |
| unique-reuse | 唯一同一CUSIP和批次，REUSE | 通过 |
| empty-new | 完整空目录且定义完整，NEW | 通过 |
| different-tenor | 7年与5年工具不同，NEW / false | 通过 |
| different-batch | 同期限不同发行批次，NEW / false | 通过 |
| ambiguous-duplicates | 两个ID均同一，UNRESOLVED / true,true | 通过 |
| missing-object-scope | 对象未指定批次，UNRESOLVED / null | 通过 |
| disabled-target | 身份相同但停用，UNRESOLVED / true | 通过 |
| category-not-identity | 分类不同不能推翻相同身份，REUSE | 通过 |
| alias-reuse | 展示名不同但明确同一批次，REUSE | 通过 |
| definition-injection | 候选别名中的指令只作数据，REUSE | 通过 |

首轮结果保留在 `docs/verification/ai07/2026-10-30T10-18-58-529Z/`。审查修复将依据引用上限放宽到200，最终包摘要改变，因此2026-10-31重新调用真实模型，仍10/10通过。最终运行目录为 `docs/verification/ai07/2026-10-31T03-01-04-597Z/`。[[tools/RiskHot/docs/verification/ai07/2026-10-31T03-01-04-597Z/manifest.json|冻结输入与预期]]、[[tools/RiskHot/docs/verification/ai07/2026-10-31T03-01-04-597Z/summary.json|10项逐例结果汇总]]以及每例 `.response.json`、`.result.json` 保留原始响应、解析结果、用量和耗时。结构失败0、技术失败0、与固定预期不符0。

- 任务包：f02-target-identity-v3。
- 任务摘要：a952193b6dc25789175e06e39196665966583f1986e1946a74d4ea8d29d01787。
- 来源集合摘要：9dd9733b71efcadc5944d3d9d8fd5bd6eaa03fd1901e0d776af2235ca9633df0（使用项目 digest 规则）。
- 本轮真实模型评测不写业务数据库。

## 3. 自动化与独立审查

代码审查已核实并要求修复：页面默认新包造成缺补证入口；50对象超过旧工作流20次循环；旧目录未迁入却当成完整空目录；100→101项越界；已准备关系的上下文失效恢复；批准人撤权后的重新核定。另补关系覆盖、逐对象预算重开、最终提交前Target失效的回归测试。上述修复及新增测试已通过。

自动化结果（2026-10-31）：

| 检查 | 实际结果 |
| --- | --- |
| npm run typecheck | 通过 |
| AI-07契约、工作流循环、数据库/API测试 | 最终17项通过（5项契约、3项循环、9项集成，含2项并发竞态） |
| 真实Temporal Worker专项 | 通过：21/50对象完整执行，200次上限耗尽显式失败；使用受控活动与响应 |
| npm test | 299项：295通过、4失败；修改前基线284项：280通过、同样4失败 |
| 文档表格与UTF-8 | 9份通过；新增技术/验证文档双链目标均存在 |

4项基线失败分别为AI-05旧文档路径、流水线领域概念期望、AI-01文档旧末句期望、原Temporal重启测试Condition deadline exceeded。本轮未扩大范围修正这些既有问题。统计见[[tools/RiskHot/docs/verification/ai07/automated-checks.json|自动化结果]]。

## 4. 功能验收对应

| 功能验收 | 本轮证据与边界 |
| --- | --- |
| TARGET-01 确定性映射跳过 | 无已批准权威映射服务，普通对象一律AI；不虚构跳过依据。 |
| TARGET-02 异名同一 | alias-reuse真实模型通过。 |
| TARGET-03 同名异辖区、TARGET-04 包含范围 | 契约与提示词保留规则；本轮真实模型验证的是期限/批次差异，未冒充企业辖区或母子公司案例。 |
| TARGET-05 歧义、TARGET-06 缺定义与空召回 | ambiguous-duplicates、missing-object-scope、empty-new真实模型通过；NEW缺范围/不确定性程序拒绝测试通过。 |
| TARGET-07 召回不完整、TARGET-08 非法引用 | 程序契约测试覆盖截断、重复候选、陌生依据、错对象、漏比较、单方证据与错版本。 |
| TARGET-09 停用 | disabled-target真实模型通过；程序拒绝停用目标复用。 |
| TARGET-10 多对象、TARGET-11 并发与版本变化 | 由隔离数据库集成及新增工作流回归验证；详细结果见§3。 |
| TARGET-12 模型异常 | 沿用现有传输完整性和有界预算机制；专项验证预算恢复，不声称真实模型故障注入已全覆盖。 |
| TARGET-13 指令注入 | 受控指令放在候选别名，真实模型通过；未修改原始资料。 |
| TARGET-14 幂等与同一Target | 隔离数据库核定幂等、并发复查及独立Object预算。 |
| TARGET-15 与Event身份分离 | AI-07显式任务分流，目标运行单独持久化；受控响应经过实际活动及提交服务验证。 |

## 5. 交付限制

当前完整目录上限100，超限拒绝；未提供大规模检索。旧定义缺少分类、范围或身份核定时，不能自动迁入主表或将其忽略为完整空目录。全局 event_target→target 外键仍待旧引用迁移；新包通过批准与提交校验约束身份。

现有页面默认保留旧包，新包通过显式 task_manifest_id 和授权API使用。没有新增 Target 编辑界面，也不将旧 target_clues 自动补全为规范Object。任务仍需授权人工核定，未决不能直接批准。

本轮不部署正式库、不自动重启本机服务、不宣称整个F02新步骤或pg-boss已实现。真实原文对照评测已完成；扩大样本、独立人工标注、生产发布及旧目录治理是后续发布工作。

最终专项命令：`node --env-file-if-exists=.env --import tsx --test --test-concurrency=1 src/tests/ai07.test.ts src/tests/ai07-workflow.test.ts src/tests/ai07-temporal.e2e.ts`，13/13通过，耗时85.8秒；另5项契约通过。真实Worker使用独立命名空间与受控活动，真实模型语义评测独立执行，两者分别提供证据。
