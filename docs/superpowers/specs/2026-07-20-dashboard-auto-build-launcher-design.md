# 大盘面板启动器自动构建设计

## 目标

双击 `tools/a-share-market-dashboard/启动大盘面板.cmd` 时，先重新扫描 `sources/automations/` 并生成最新的 `a-share-market-dashboard.html`，构建成功后才启动本地服务，避免新增研报后仍打开旧看板。

## 当前问题

启动器目前只调用 `scripts/local_proxy.py`。产业研报目录扫描仅发生在 `scripts/build.mjs` 运行时，因此重新启动服务或刷新浏览器都不会更新研报列表。

## 方案

仅修改启动器及其自动化测试：

1. 启动器切换到自身所在目录。
2. 优先从系统 `PATH` 查找 `node`。
3. 系统未提供 Node 时，尝试 Codex 工作区运行时的用户目录固定相对位置：`%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`。
4. 找不到 Node 时输出中文错误、暂停并退出，不启动旧看板。
5. 使用找到的 Node 执行 `scripts\build.mjs`。
6. 构建返回非零状态时输出中文错误、暂停并退出，不启动本地服务。
7. 构建成功后沿用现有 Python / `py -3` 探测和服务启动流程。

## 错误边界

- Node 缺失：不允许以旧产物继续启动。
- 构建失败：保留原有 HTML 文件，但不启动服务，终端显示构建失败。
- Python 缺失：保持现有提示和退出行为。
- 构建成功、服务失败：由现有本地代理流程负责报告。

## 测试

在 `tests/build.test.mjs` 增加启动器契约测试，验证：

- 启动器包含系统 Node 与 Codex Node 两级查找；
- `scripts\build.mjs` 的执行出现在本地代理启动之前；
- Node 缺失或构建失败时不会继续启动代理；
- 现有看板构建测试继续通过。

## 验收标准

- 双击启动器会先构建后启动。
- 新增到产业目录的 HTML 在一次启动后出现在看板中。
- 构建失败不会静默打开旧看板。
- 不修改看板业务逻辑、目录扫描规则或本地代理实现。
