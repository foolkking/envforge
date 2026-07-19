---
id: EF-SEC-007
title: 供应链安全
version: '1.1'
status: accepted
classification: normative
owners: [security, capability, platform]
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: [ADR-005, ADR-006, ADR-009]
source_of_truth_for: [software supply chain, capability provenance]
---

# 供应链安全

## 1. 资产

API、Worker、CLI/Archive Reader、数据库 migration、Web UI、Capability package、容器镜像、第三方二进制（rsync/pg_dump 等）、依赖锁文件和构建流水线均属于供应链资产。

## 2. 构建要求

- 锁定依赖和工具链版本；禁止未固定 mutable tag 进入认证 Plan。
- 生成 SBOM、build provenance、source revision、builder identity 和 reproducibility metadata。
- 发布 Artifact/镜像/Capability Manifest 进行签名；部署前和 Worker 加载前验证。
- CI 进行 SAST、dependency/license scan、container scan、secret scan 和 migration lint。
- 生产发布使用受保护分支、review、短期 OIDC credential 和最小 Registry 权限。

## 3. Capability Package

Manifest 绑定 `capabilityId/version/implementationHash/signature/supported ranges/required privileges/resource keys/side-effect class/resumability/certificationEvidence/SBOM`。Plan 固定 implementation hash；活动 Run 不自动升级。

v1 只加载主仓库内置或官方签名 Capability，不允许运行任意第三方动态插件。ReviewedCommandAction 的模板、参数 schema 和签名也属于 Plan hash。

## 4. 外部工具

SSH 目标上的系统工具必须在 preflight 验证版本和来源。下载的二进制使用固定 digest、TLS 和签名；禁止 `curl | sh`。包仓库和 container registry 变化触发 material drift 或重新审批。

## 5. Archive 长期兼容

Archive 保存格式、Schema、Reader version 和转换要求；不保证永久保留可执行旧 Worker。Reader/transformer 必须签名和隔离运行。格式升级创建派生 ArchiveVersion，不原地改写。

## 6. 事件响应

发现 Capability/依赖泄露：撤销签名/版本、阻止新 Plan、识别受影响 Plan/Run/Archive、通知用户、发布替代版本和重验证指南。已完成 Run 的证据不被改写。

## 7. 验收

篡改 Capability package、SBOM 或镜像 digest 均被拒绝；活动 Run 在 registry tag 变化后仍使用批准 digest；CI 阻止含测试 Secret 的 release；撤销版本不能创建新 Run。
