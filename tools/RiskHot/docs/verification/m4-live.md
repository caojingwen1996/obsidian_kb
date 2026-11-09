# M4 本机部署与实际功能验收

2026-11-05：用户明确要求“提交到运行环境，并运行测试功能”。已部署到当前本机常驻服务，实际配置与共享观察闭环通过。此前[[tools/RiskHot/docs/verification/m4|开发验证报告]]中的“实际库未迁移”是开发交付阶段的历史状态，本记录为后续部署结果。

## 输入与部署结果

依据[[tools/RiskHot/docs/superpowers/plans/2026-11-05-M4金融对象配置与共享观察实施|实施计划]]、[[tools/RiskHot/docs/system-design/04-系统架构设计/03-模块技术详细设计/M4-金融对象配置与共享观察技术设计|M4技术设计]]和[[tools/RiskHot/docs/system-design/04-系统架构设计/01-数据模型与存储设计/全局配置表数据模型与存储设计|全局配置数据模型]]执行。

- 服务使用当前main工作区 `/Users/cjw/dev/Obsidian/wiki/tools/RiskHot`，未覆盖原有未提交修改，未推送远程仓库。
- 实际库schema版本由5、8增加为5、8、10。已有pg-boss业务队列继续使用；009原本不写schema_versions，未为本轮重跑队列切换。
- 已执行 `npm run migrate:m4 -- --apply`，为当前本机操作员 `riskhot-local-operator` 显式增加配置维护、观察管理、映射核定三项职责。
- 已执行 `npm run service -- restart`。LaunchAgent运行中，主进程PID 88940，API与业务Worker均使用现有进程组织；18081仅一个监听，`/health/ready`、`/m4`、`/targets`及两类M4列表接口均返回200。
- API只能通过受控命令写M4，API/IO/Relay/Model均无配置表INSERT及观察表UPDATE直接权限。私有.env与部署前副本逐字节一致。
- 证据：[[tools/RiskHot/docs/verification/m4-live/deployment-results.json|部署与授权检查]]、[[tools/RiskHot/docs/verification/m4-live/final-state.json|运行与最终状态]]。

## 备份与数据保全

私有备份：`.riskhot/backups/m4-deploy-2026-11-05T10-25-41.331Z/before-m4.dump`，大小905848字节，SHA256 `36c810f4ef8f53e02478fe3204f2854fa8d9b295fc9bbba2dae76eb8b3f74d4d`。同目录保留私有配置副本，未写入报告或提交。

备份经PostgreSQL18容器的pg_dump生成，在本次随机新建的临时库pg_restore恢复。恢复后、首次M4迁移后及重复迁移后，八类原表的行数和完整行摘要均一致；校验结束只删除本次明确创建的临时库，备份继续保留。

运行库迁移阶段的Target、Event、Fact、EventTarget、FactEvidence、事件采用定义、既有定义快照及信源八类数据摘要保持一致。随后功能测试新增M4定义快照、观察历史、审计和回执；原有事件相关数据与信源仍与测试前逐行摘要一致。

| 原有数据 | 部署和实际验收后 |
| --- | --- |
| 事件Target | 0 |
| Event | 1 |
| Fact | 4 |
| EventTarget | 0 |
| FactEvidence | 8 |

备份及恢复证据见[[tools/RiskHot/docs/verification/m4-live/backup-results.json|备份与迁移演练记录]]。已有任务状态保持1条recoverable、4条waiting、1条superseded、4条succeeded；本轮未重试或审批其他F02任务。历史AI-04限制仍见[[tools/RiskHot/docs/verification/f02-live-cutover|F02实际验收记录]]，不能以M4部署声称已解决。

## 实际功能验证

新增[[tools/RiskHot/src/tests/m4-live.e2e.ts|实际环境验收脚本]]，必须显式传入`--run-live`。脚本使用实际常驻HTTP服务与本机操作员，所有业务写入经页面或产品API完成；数据库只读核对，未启动替代API、未拦截伪造接口结果。浏览器为独立Chrome for Testing，使用专属临时目录，在finally关闭并清理。

11组检查通过，页面脚本错误0：

1. 实际会话、M4读取接口和三项职责可用。
2. 信源、事件、流水线页面及新导航正常。
3. 真实页面新建目录及启用对象，不自动产生观察、Target或事件。
4. 真实页面编辑别名，配置版本推进，身份版本保持，旧版本可查。
5. 从配置选择建立共享观察，刷新后仍是同一记录；未核定映射有明确提示。
6. 重复添加和原键重试复用记录；同一键改变输入返回冲突。
7. 备注、暂停、恢复成功，保留共享观察身份。
8. 停用上级目录原子暂停观察；重新启用不自动恢复；显式恢复成功。
9. 范围澄清暂停待确认；旧采用快照保留；恢复后采用新身份版本。
10. 旧Target手工写入口返回M4_MANUAL_TARGET_RETIRED，未产生Target。
11. 真实观察页1440、390、320宽度无横向溢出，截图有效。

证据：[[tools/RiskHot/docs/verification/m4-live/live-results.json|逐项结果]]、[[tools/RiskHot/docs/verification/m4-live/live-run.txt|执行输出]]、[[tools/RiskHot/docs/verification/m4-live/config-desktop.png|实际配置页面]]、[[tools/RiskHot/docs/verification/m4-live/observation-1440.png|实际观察桌面]]、[[tools/RiskHot/docs/verification/m4-live/observation-390.png|手机观察]]、[[tools/RiskHot/docs/verification/m4-live/observation-320.png|窄屏观察]]。截图捕获于测试操作阶段；后续已按下面规则结束测试状态。

## 验收数据与边界

仅创建带`[验收]`前缀的1个目录、1个对象及1条共享观察：

| 记录 | 身份 | 最终状态 |
| --- | --- | --- |
| 验收目录 | 62d1eab5-0be5-4451-a250-1db0ed18d083 | disabled，配置版本4 |
| 验收对象 | 5a358e6d-e89d-4355-a414-d0f877db74b8 | disabled，配置版本4，身份版本2 |
| 验收观察 | 94326f1b-0527-4651-8d22-66696184709a | ended，版本9，采用身份版本2 |

测试记录通过产品接口停用/结束；不可变历史保留，不物理删除，也不占用“观察中”列表。配置中心选择“全部”或“已停用”仍可追溯这些记录。

实际Target目录为空，因此未在运行库验收非空Target映射及关联动态，也未为验收直接插入Target或Event。非空映射、全部来源授权、口径变化后映射失效、F02保存与pg-boss交接由本轮再次执行的隔离专项覆盖，不混称为实际环境非空映射验收。

## 复验命令与结果

```sh
npm run typecheck
node --env-file-if-exists=.env --import tsx src/tests/m4-live.e2e.ts --run-live
node --env-file-if-exists=.env --import tsx --test --test-concurrency=1 src/tests/m4*.test.ts src/tests/f02-eight-step-commit.test.ts
```

类型检查通过；实际验收11组通过；部署后隔离专项24/24通过，0失败、0跳过，见[[tools/RiskHot/docs/verification/m4-live/regression-results.txt|专项回归日志]]。没有产品源码修订，未重复执行上轮394项完整回归；其范围及默认环境旧夹具限制继续按开发验证报告记录。

再次运行live命令会新建另一组明确标注的验收记录，完成后同样停用/结束并保留历史。实际入口：[金融对象配置中心](http://localhost:18081/m4)、[共享观察](http://localhost:18081/targets)。
