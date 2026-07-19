---
id: EF-ACC-008
title: Phase 7：Capture 与 Archive 验收
version: '1.1'
status: accepted
classification: normative
owners:
- qa
- architecture
- engineering
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: []
source_of_truth_for:
- Phase 7 acceptance
---

# Phase 7：Capture 与 Archive 验收

## 目标

证明 Source 可以生成自描述、加密、签名、多副本、可 Scrub/Repair/Import 的 ArchiveVersion。

## 固定环境

- Golden Source；
- S3-compatible + second failure-domain repository；
- Key Provider/recovery key；
- corruption and control-plane loss fixtures。

## 执行步骤

1. 记录仓库 HEAD、设计版本、migration version、Capability manifest 和 Feature Flags。
2. 从干净环境部署/升级本 Phase 产物。
3. 执行基线和成功路径。
4. 执行并发、重放、权限和故障注入。
5. 收集 Evidence Bundle，执行清理并确认无敏感材料残留。

## 必须通过

- Header/Private Manifest 自描述；
- plaintext/ciphertext integrity、signature、key availability；
- Replica policy；
- Metadata/Sampled/Full Scrub；
- object corruption 自动 repair；
- required object all replicas lost→corrupt；key lost→unrecoverable；
- Catalog DB 清空后 import；
- retention/deletion/reference rules。

## 故障注入

- multipart interruption、replica unavailable、object bit flip、manifest/signature tamper、temporary/permanent key outage、delete under legal hold。

## Evidence Bundle

- Archive Header/Manifest root/signature、replica inventory、scrub/repair reports、import result、health calculation。

## 非目标

Source Release 建议和真实 Restore 成功；属于 Phase 8。

## 判定

- **PASS**：全部 required 检查和故障断言通过，无 P0/P1 安全或数据风险。
- **PARTIAL**：仅非关键 optional 项失败；不能解锁依赖此能力的生产声明。
- **FAIL**：任何 required、数据完整性、Secret、状态机或恢复断言失败。
