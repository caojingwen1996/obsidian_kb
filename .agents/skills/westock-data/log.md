# westock-data 变更日志

## 2026-09-10 — 项目接入（工具版本 1.0.4，版本号不变）

- 原因：用户要求将 westock-data 接入当前项目。
- 来源：strategy-backtest-expert 插件 1.0.0+codex.20260605023011 内的 westock-data。
- 涉及文件：SKILL.md、package.json、scripts/index.js、references/、log.md。
- 变更：复制完整技能和运行程序；在 SKILL.md 增加项目调用命令、来源版本、数据边界与日志维护要求；运行程序和参考文档保持上游原样。
- 验证：Node.js v20.19.2；程序语法检查通过；--help 正常；quote sh600000 返回浦发银行行情表，数据日期 2026-09-10，退出码 0。仅验证行情接口，不代表全部接口均已验证。