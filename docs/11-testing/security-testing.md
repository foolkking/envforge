---
id: EF-TEST-007
title: 安全测试
version: '1.1'
status: accepted
classification: normative
owners: [qa, security]
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: [ADR-006, ADR-009, ADR-010]
source_of_truth_for: [security test gates]
---

# 安全测试

## 测试矩阵

- Authentication：session fixation、token expiry、MFA/step-up、CSRF。
- Authorization：每个 OpenAPI operation RBAC/ABAC allow-deny、跨 Workspace IDOR。
- Secret：输入 body/log/error tracker/cache/heap dump 泄漏扫描；Vault lease/revoke；SOPS tmpfs cleanup。
- Command：shell injection、path traversal、symlink race、unsafe sudo、argument logging。
- Artifact/Archive：object key enumeration、hash/signature tamper、KMS unavailable、cross-tenant dedup leakage。
- Worker：forged claim token、stale fencing token、lease hijack、malicious receipt。
- API：idempotency poisoning、mass assignment、problem detail leakage、SSE authorization。
- Supply chain：unsigned Capability、tampered image/digest、dependency/CVE gate。

## 自动门禁

SAST、dependency/secret/container scan、OpenAPI fuzz、SQL migration permissions、redaction corpus、artifact tamper tests 和 threat-model control mapping。Critical finding 阻断发布；例外需 Security Risk Acceptance 和期限。

## Evidence

保存 test run ID、tool/version、target commit、finding、severity、owner、fix/acceptance、retest。扫描报告本身可能敏感，存受限 Artifact。
