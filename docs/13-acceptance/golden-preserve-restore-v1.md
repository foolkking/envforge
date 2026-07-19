---
id: EF-ACC-GOLD-003
title: Golden Preserve & Restore v1
version: '1.1'
status: accepted
classification: normative
owners:
- qa
- product
- archive
last_reviewed: '2026-07-19'
supersedes: []
related_adrs:
- ADR-003
- ADR-005
- ADR-008
- ADR-009
- ADR-010
- ADR-011
source_of_truth_for:
- Golden Preserve Restore acceptance
---

# Golden Preserve & Restore v1

## 1. 目的

证明 EnvForge 能在源服务器可能长期不存在的情况下，创建自描述、加密、签名、具备多副本和 Scrub 证据的 `ArchiveVersion`，通过隔离 Restore Drill 后安全释放 Source，并在控制面目录丢失和源 VM 被销毁后恢复到新 Target。

## 2. 固定 Fixture

| 项目 | 固定值 |
|---|---|
| Source | Golden Build/Migration Workload 的完整 Source VM |
| Dataset | PostgreSQL 16 + uploads 文件目录 |
| Deployment | 固定 Git/Artifact、lock file、systemd/Nginx template |
| Secret | 外部 Provider reference、Regenerate secret、必须保持的数据解密测试密钥 |
| Repository A | S3-compatible 或 MinIO，failure-domain A |
| Repository B | 独立 Local/SSH/S3-compatible，failure-domain B |
| Key Provider | Vault Transit/KMS 或受控 User Recovery Key |
| Drill Target | 隔离网络、SMTP sink、外部 API mock、scheduler disabled |
| Restore Target | 新建干净 Ubuntu 24.04 VM |

Fixture 必须保存初始化数据、Artifact、Secret canary、Repository 配置和 Key challenge 的版本及 Hash。

## 3. Capture 流程

1. 确认 Blueprint、Dataset ownership 和 Secret Recovery Requirement；
2. 编译并审批 Capture Plan；
3. initial capture deployment/config/files；
4. quiesce writer，创建数据库和文件一致性 Checkpoint；
5. final capture required Dataset；
6. 分块、压缩、加密对象；
7. 生成加密 Private Manifest、最小 Header、Manifest Root 和 Signature；
8. 上传并验证 Repository A；
9. 复制并验证 Repository B；
10. 完成 key availability challenge；
11. 完成 Full Scrub；
12. ArchiveVersion 状态达到 `available`。

上传成功响应本身不能满足 available。

## 4. Restore Drill

执行 `business-verification` 等级的隔离 Drill：

- 导入并验证 Header、Signature 和 Manifest；
- 下载、解密并重建 Deployment/Config/Dataset；
- 恢复 PostgreSQL roles、grants、extensions、schema、data 和 sequences；
- 恢复 uploads 和权限；
- 使用测试 Secret 启动 Workload；
- 执行 HTTP、数据库和文件合成交易；
- 验证没有生产 DNS、邮件、支付、Webhook 或 Queue 副作用；
- 清理 Drill Target，并验证 cleanup。

Drill 结果必须绑定 ArchiveVersion ID、Manifest Root Hash、Blueprint Hash、Restore Plan Hash、Target Profile 和 Verification Contract Hash。

## 5. Source Release Gate

`SourceReleaseReadinessResult=SAFE` 至少要求：

- 所有 required Workload/Dataset/Artifact 已覆盖；
- Critical Unassigned Evidence 为零；
- Secret Recovery 可验证，数据解密类密钥非 unknown；
- Manifest、Signature、required object 和 key availability 通过；
- Replica Policy 满足两个 failure domains；
- Full Scrub 通过；
- business-level Restore Drill 在有效期内通过；
- Retention/Object Lock 不会在 Source 释放后过早删除；
- 已知限制和风险已审批。

只有这些 Gate 通过才允许创建 `SourceReleaseCommitRecord`。

## 6. 灾难恢复验证

Source Release Commit 后：

1. 销毁 Source 测试 VM；
2. 删除或隔离 EnvForge 控制面数据库和 Archive Catalog；
3. 仅使用 Repository、Archive Header、Key Provider 和 Archive Reader 导入 Archive；
4. 重建 EnvironmentArchive/ArchiveVersion 索引；
5. 对新 Target 采集 Snapshot；
6. 重新计算 Compatibility，绑定 Secret；
7. 编译并审批新的 Restore Plan；
8. 执行 Restore Run；
9. 完成 required Dataset、Runtime 和 Business Verification；
10. 创建 `ExecutionCommitRecord` 和不可变 Report。

不得复用 Capture Actions 作为 Restore Plan。

## 7. 故障与损坏演练

至少覆盖：

- 上传中断和 multipart 残留；
- Repository A 缺失对象，由 B 自动修复；
- required object 两副本损坏，Archive 进入 `corrupt`；
- Key Provider 临时不可用，Archive 进入 degraded；
- 恢复密钥永久不可用，Archive 进入 unrecoverable；
- Manifest/Signature 篡改；
- Drill 中外部副作用被隔离策略拦截；
- Restore 下载和数据库恢复中 Worker 崩溃；
- 控制面目录完全丢失后的 import。

## 8. Required Verification

- ciphertext 和 plaintext Hash；
- Manifest Root 与 Signature；
- required object count 和 bytes；
- Replica failure-domain；
- Key unwrap challenge；
- PostgreSQL schema/data/sequence；
- 文件 Manifest 和应用读写；
- Secret Provider 和恢复策略；
- Restore business transaction；
- Drill/Restore cleanup；
- Source Release Gate 和 Commit once-only。

`sampled`、`metadata-only`、`partial` 或 `manual` 结果不得显示为 `full-content` 或 `business-verified`。

## 9. Evidence Bundle

包括 Capture Plan/Run、Consistency Checkpoint、Archive Header、加密 Manifest Ref、Root Hash、Signature、Object Index、Replica Records、Scrub/Repair Runs、Key Availability Check、Restore Drill、Source Release Readiness/Commit、Archive Import、Restore Plan/Run、Verification 和最终 Commit/Report。

## 10. 判定

### PASS

源 VM 和控制面目录被移除后，仍可从 Archive 在新 Target 重建并通过业务验证；所有 required Gate、Hash、Replica、Key、Scrub、Drill 和 Commit 证据完整。

### PARTIAL

Archive 可读取但只完成 sampled scrub、低等级 Drill、单副本或手工恢复。不得创建 Safe Source Release 结论或声明 Preserve & Restore Certified。

### FAIL

Source 被允许释放但 required data/secret/key/replica/drill 不满足，Archive 无法独立导入，完整性结果被夸大，或恢复后业务验证失败。
