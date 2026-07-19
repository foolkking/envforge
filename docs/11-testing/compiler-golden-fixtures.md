---
id: EF-TEST-003
title: Compiler Golden Fixtures
version: '1.1'
status: accepted
classification: normative
owners: [qa, planning, capability]
last_reviewed: '2026-07-19'
supersedes: []
related_adrs: [ADR-005, ADR-008]
source_of_truth_for: [compiler deterministic tests]
---

# Compiler Golden Fixtures

每个 fixture 固定：Blueprint Revision JSON、DecisionSet、Source/Target Snapshot、Archive Manifest（如有）、Compatibility Result、Capability catalog/implementation hash、Policy 和 compiler version。

输出断言包括：Plan status/hash、input bindings、stages、Action keys/inputs/dependencies、Dataset/Secret/Cutover/Verification/Rollback contracts、gates、risks、manual steps 和 trace links。

## 变更规则

Golden 输出变化必须由有意设计变更和 review 更新，不能为“让测试通过”批量重录。PR 展示 semantic diff：Action 增删、依赖变化、风险/回滚变化和 Hash 变化。

## 必测 Fixture

- Build 黄金 Web App；
- target package/config conflict；
- PostgreSQL unsupported physical copy；
- required Secret missing；
- shared directory unresolved；
- Migration with initial/final filesystem sync；
- Capture with unrecoverable encryption key blocker；
- Restore with target compatibility conversion；
- deterministic repeat 100 次得到相同 canonical Plan hash。
