# F02 AI-08、A4 与八步任务界面验证

日期：2026-11-01。

## 输入依据与范围

依据 `2026-11-01-F02分批实施.md` 的 A4/A5/A8 与 AI-08 技术契约，实现并核对完整语境识别、当前资料多来源引用和事件任务入口。界面继承现有事件管理的字体、绿色状态体系、导航与表单样式，使用 Impeccable 的 Operate 规范完成检查。

## 已执行验证

- `node --env-file-if-exists=.env --import tsx --test src/tests/ai08-contract.test.ts src/tests/ai08-runtime.test.ts src/tests/f02-fact-mapping.test.ts`：11 项通过。
- `node --import tsx --test src/tests/eight-step-api.test.ts src/tests/eight-step-ui.test.js`：3 项通过。
- `node --env-file-if-exists=.env --import tsx --test src/tests/eight-step-service.test.ts`：实际随机临时数据库与 pg-boss 队列通过。通过真实 API 启动、读取、两阶段复核与保存；错提案摘要拒绝；同键启动和提交重投无重复副作用。
- `node --env-file-if-exists=.env --import tsx --test src/tests/event-contracts.test.ts src/tests/ai07-contract.test.ts src/tests/current-entrypoints.test.ts`：既有 14 项回归通过。
- `npm run typecheck`：通过。
- 独立 Chrome for Testing、专用临时数据目录运行 `src/tests/eight-step-browser.e2e.ts`：桌面 1440×1050、手机 390×844 共 7 项检查通过，结果见 `results.json`，截图见 `desktop.png`、`mobile.png`。浏览器及目录在 finally 清理。
- Impeccable 静态检查无发现；工具对 `/m1/` 绝对资源地址产生静态路径解析提示，实际浏览器资源加载通过。人工检查桌面与手机截图后补齐桌面面板留白，并再次验证无横向溢出。

## 结果与边界

AI-08 契约拒绝漏线索、伪造引用、跨来源伪造、非法分类、没有配套记录的事实纠正与模型失败伪装空结果。空 Object 仍保留全文语境。全段证据按 Unicode 码点构造，超预算拒绝而不裁切。一个线索可产生多个候选，对象引用重投稳定，身份缺口完整保留。

AI-08 接纳在事务中重核全部来源的当前版本和权限。尚未关联本 Fact 的语境证据默认转语义复核，经明确核定后才追加；重复接纳不重复追加。多来源模型引用工件不保存全文，调用时通过受限函数重建；calling 等未知结果占用预算，同一次调用键不重复登记。

八步任务由 `/events/tasks/:id` 展示，来源资料页提供独立启动入口。任务读取不产生批准；复核仅使用 POST 并绑定当前提案摘要。未知提交结果以原操作编号、原内容重试。保存事件与关联补充失败分别显示；未发布分类用途规则保留等待说明。撤权响应会移除任务正文和操作。

本报告中的服务流程使用固定模型输出，浏览器使用受控接口夹具；没有调用真实模型，不代表模型泛化准确率或正式业务验收。`src/scripts/evaluate-ai08.ts` 已准备真实原文、受控 Fact 的独立模型评测入口，尚未执行模型评测。没有迁移或修改正式数据库。
