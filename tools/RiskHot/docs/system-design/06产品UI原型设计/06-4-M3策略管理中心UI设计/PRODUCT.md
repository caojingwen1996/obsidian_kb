---
title: RiskHot M3 产品上下文
date: 2026-10-15
---

# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

系统管理员设计、修订、审核和维护策略；授权阅读者查看定义及结果。角色来源于现有M3功能设计，不增加角色。

## Product Purpose

在三个工作区完成策略设计与管理、AI智能分析管理、策略评估。策略表达程序、AI、人工和条件之间的业务协作关系。

## Operating Context

静态HTML、CSS与JavaScript本地交互原型；入口为同目录M3策略管理中心交互原型.html。页面数据保留在当前会话，刷新重置。

## Capabilities and Constraints

本次只重构UI。业务节点、规则引用、连线、校验、版本治理、在途版本锁定、权限、评测集和案例数据均沿用现有实现。2026-10-16的C01布局调整可修改app.js展示函数；业务处理、状态流转、权限与校验函数记录重构前后SHA-256并核对，flow-data.js仍逐字节一致。此前全文件不变的结论属于上一轮视觉重构记录。用户已确认三中心全部UI纳入统一规范；本文件仅描述M3，跨中心约束见上级PRODUCT.md和DESIGN.md。

## Brand Commitments

用户先前指定保持原配色体系、流水线左右6:4；AI分析须明显区别系统绿色主色，已确认独立紫色。中文业务界面，领域分层L0～L3及M1/M2/M3横向支撑。

## Evidence on Hand

[[tools/RiskHot/docs/system-design/03-系统功能架构/M3策略管理中心功能设计|M3功能设计]]和[[tools/RiskHot/docs/system-design/06产品UI原型设计/06-4-M3策略管理中心UI设计/03. 流水线文档依据与节点对照|总览与领域文档节点对照]]。现有原型含6条策略、16项AI任务、7套蓝图122节点及明确标注的评审示例。

## Product Principles

- 领域规则和正式事实由对应业务模块拥有，M3引用这些规则。
- 新版本与评估不改写历史事实，不自动改变生效版本。
- 功能、入口、可见状态与原有业务行为保留。
- 业务主线、并行依赖、条件出口与横向支撑必须区别呈现。
