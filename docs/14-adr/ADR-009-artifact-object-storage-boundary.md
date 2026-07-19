---
id: EF-ADR-009
title: ADR-009：Artifact 与对象存储边界
version: '1.1'
status: accepted
classification: normative
owners:
- architecture
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: []
source_of_truth_for:
- artifact object storage boundary
---

# ADR-009：Artifact 与对象存储边界

## 状态

Accepted — 2026-07-19

## 背景

Dump、Manifest、日志和 Archive 不适合 PostgreSQL 大 JSON/Blob；本地文件无法支持副本和长期恢复。

## 决策

PostgreSQL 保存 Artifact 元数据和 Hash；对象存储保存内容。Archive 使用独立 Manifest、加密、Replica、Scrub 生命周期。

## 决策驱动因素

- 数据完整性和可恢复性优先于短期实现便利；
- 设计必须能被数据库约束、API、测试和运行证据验证；
- 首期控制复杂度，同时保留明确演进路径；
- 不允许 UI 或临时兼容层绕过核心不变量。

## 被否决/暂缓方案

所有内容数据库 BLOB；路径即对象键；上传成功即可用。

## 后果

支持大对象和修复，但需要对象完整性、加密、retention 和 repository 运维。

## 实施与迁移

- 在对应 Phase 通过 Feature Flag/兼容适配渐进引入；
- 新模型成为唯一写入事实源，旧路径只读或转译命令；
- 数据和 API 变化需 migration、backfill、OpenAPI 与 Acceptance 同步。

## 可逆性与退出条件

本决策可通过新的 ADR supersede，但已创建的不可变 Revision、Run、Commit、Audit 和 Archive 不被原地改写。替代方案必须给出历史数据读取、活动任务接管和安全回退路径。

## 风险

主要风险是实现复杂度、迁移期间双模型漂移和团队误用。通过事实源映射、CI 设计校验、Feature Flag、纵向验收和故障注入控制。

## 验证与复审

对应规范、测试和 Phase Acceptance 必须证明此决策。若规模、安全或兼容性前提变化，通过新 ADR supersede，不原地删除历史。
