# EnvForge Original Requirement Traceability Matrix

本矩阵来自最初痛点分析和覆盖审计。Phase 10 必须填充最终实现路径、Evidence Hash、支持等级和 disposition。

| Requirement ID | 原始需求摘要 | 主要 Phase | Required Acceptance | Final Evidence | Support Level | Final Disposition |
|---|---|---|---|---|---|---|
| REQ-PROD-001 | Project 是用户生命周期根对象 | Phase 1 | PH1-GAP-001, PH1-GAP-005 | TBD | TBD | TBD |
| REQ-PROD-002 | 四种用户模式与五种不可变 Project Type | Phase 0/1/9 | PH0-GAP-002, PH1-GAP-002, PH9-GAP-011 | TBD | TBD | TBD |
| REQ-PROD-003 | Assessment 派生 Migration/Capture；Archive 派生多个 Restore | Phase 1 | PH1-GAP-003, PH1-GAP-013 | TBD | TBD | TBD |
| REQ-DISC-001 | 迁移早期绑定源与目标 | Phase 4 | PH4-GAP-001, PH4-GAP-002 | TBD | TBD | TBD |
| REQ-DISC-002 | 无 Target Snapshot 不得最终迁移就绪 | Phase 1/4 | PH1-GAP-011, PH4-GAP-003 | TBD | TBD | TBD |
| REQ-DISC-003 | 以 Workload 而不是软件包审批 | Phase 4/9 | PH4-GAP-008, PH9-GAP-011 | TBD | TBD | TBD |
| REQ-DISC-004 | 强弱关系、证据和置信度可解释 | Phase 4 | PH4-GAP-004, PH4-GAP-005 | TBD | TBD | TBD |
| REQ-DISC-005 | Collector 失败为 unknown | Phase 4 | PH4-GAP-006 | TBD | TBD | TBD |
| REQ-DISC-006 | 共享 Nginx/DB/Volume 等显式建模 | Phase 4 | PH4-GAP-007 | TBD | TBD | TBD |
| REQ-DISC-007 | 自定义 systemd 网站完整识别 | Phase 4 | PH4-GAP-008, PH4-GAP-010 | TBD | TBD | TBD |
| REQ-DISC-008 | 部署来源分类 Git/Package/Image/Compose/Binary/Directory | Phase 1/4 | PH1-GAP-008, PH4-GAP-009 | TBD | TBD | TBD |
| REQ-RUN-001 | 完整 systemd Desired State | Phase 1/3/4 | PH1-GAP-007, PH3-GAP-004, PH4-GAP-010 | TBD | TBD | TBD |
| REQ-RUN-002 | Docker Compose runtime/volume/network/health | Phase 4/6/9 | PH4-GAP-011, PH6-GAP-003, PH9-GAP-006 | TBD | TBD | TBD |
| REQ-RUN-003 | 临时状态 drain/quiesce/checkpoint/restart 策略 | Phase 1/6 | PH1-GAP-010, PH6-GAP-002 | TBD | TBD | TBD |
| REQ-DATA-001 | Dataset 真实执行而非策略字段 | Phase 5 | PH5 original + PH5-GAP-002 | TBD | TBD | TBD |
| REQ-DATA-002 | 数据量、速度、初始同步和停机估算 | Phase 1/5 | PH1-GAP-012, PH5-GAP-001 | TBD | TBD | TBD |
| REQ-DATA-003 | PostgreSQL logical dump/restore 深度迁移 | Phase 5 | PH5 original, PH5-GAP-004 | TBD | TBD | TBD |
| REQ-DATA-004 | 文件 initial/final sync、manifest、checksum、resume | Phase 5 | PH5 original, PH5-GAP-006 | TBD | TBD | TBD |
| REQ-DATA-005 | Docker local volume 迁移和限制 | Phase 5/6 | PH5-GAP-007, PH6-GAP-003 | TBD | TBD | TBD |
| REQ-DATA-006 | 共享/未知 writer 阻断 final sync | Phase 5 | PH5-GAP-003 | TBD | TBD | TBD |
| REQ-SECRET-001 | Secret Requirement 完整交付链 | Phase 3/9 | PH3 original, PH9-GAP-007..009 | TBD | TBD | TBD |
| REQ-SECRET-002 | SOPS 与 Vault-compatible Provider | Phase 9 | PH9-GAP-007, PH9-GAP-008 | TBD | TBD | TBD |
| REQ-EXEC-001 | Durable Queue/Lease/Fencing/Checkpoint | Phase 2 | Phase 2 original | TBD | TBD | TBD |
| REQ-EXEC-002 | 一个活动 live Run 与安全 Retry | Phase 2 | PH2-GAP-001, PH2-GAP-002 | TBD | TBD | TBD |
| REQ-EXEC-003 | T+1h/T+24h 持久调度 | Phase 0/2/6 | PH0-GAP-005, PH2-GAP-003, PH6-GAP-005 | TBD | TBD | TBD |
| REQ-EXEC-004 | 结构化人工步骤与机器验证 | Phase 2/6 | PH2-GAP-005, PH6-GAP-008 | TBD | TBD | TBD |
| REQ-CUT-001 | Cutover 一等状态机 | Phase 6 | Phase 6 original | TBD | TBD | TBD |
| REQ-CUT-002 | Authority、Traffic、Observation、Commit 分离 | Phase 6 | Phase 6 original | TBD | TBD | TBD |
| REQ-CUT-003 | Docker Compose Cutover | Phase 6 | PH6-GAP-003, PH6-GAP-004 | TBD | TBD | TBD |
| REQ-CUT-004 | 长期复验失败阻止 Source Release | Phase 2/6/8 | PH2-GAP-007, PH6-GAP-006, PH8-GAP-006 | TBD | TBD | TBD |
| REQ-VERIFY-001 | 业务 write/read/delete 合成验证 | Phase 3/6 | Phase 3/6 original | TBD | TBD | TBD |
| REQ-VERIFY-002 | 验证决定 Commit/Attention/Release Gate | Phase 6/8 | PH6-GAP-006, PH8-GAP-006 | TBD | TBD | TBD |
| REQ-ROLL-001 | 回滚基于 before-state 和目标新写入 | Phase 2/6 | Phase 2/6 original | TBD | TBD | TBD |
| REQ-ARCH-001 | 无 Target 的 Source-only Preserve | Phase 7 | PH7-GAP-001 | TBD | TBD | TBD |
| REQ-ARCH-002 | Archive 保存部署材料、数据、Secret Requirements 和验证合同 | Phase 7 | PH7-GAP-003 | TBD | TBD | TBD |
| REQ-ARCH-003 | 自描述 Portable Archive Header | Phase 7 | PH7-GAP-004 | TBD | TBD | TBD |
| REQ-ARCH-004 | 空控制面导入 Archive 并重建索引 | Phase 7/8 | PH7-GAP-005..008, PH8-GAP-003 | TBD | TBD | TBD |
| REQ-ARCH-005 | BYOS/Hosted/Export/Key-loss 边界 | Phase 7 | PH7-GAP-009 | TBD | TBD | TBD |
| REQ-REST-001 | 每次 Restore 对具体 Target 重新编译 | Phase 1/8 | PH1-GAP-013, PH8-GAP-005 | TBD | TBD | TBD |
| REQ-REST-002 | 一个 Archive 多次 Restore | Phase 8 | PH8-GAP-004 | TBD | TBD | TBD |
| REQ-REL-001 | Source Release 独立高风险 Gate | Phase 8/9 | PH8-GAP-001, PH9-GAP-002 | TBD | TBD | TBD |
| REQ-REL-002 | 生产 Source Release 等待 Phase 9 Adoption | Phase 8/9 | PH8-GAP-002, PH9-GAP-003 | TBD | TBD | TBD |
| REQ-BUILD-001 | Build 首个 Golden Slice 深度认证 | Phase 3 | PH3-GAP-001..005 | TBD | TBD | TBD |
| REQ-BUILD-002 | Build Breadth Wave 覆盖常见软件/服务 | Phase 9 | PH9-GAP-005 | TBD | TBD | TBD |
| REQ-CAP-001 | Capability 按认证维度展示 | Phase 3/9/10 | PH3-GAP-006, PH9-GAP-010, PH10-GAP-008 | TBD | TBD | TBD |
| REQ-UX-001 | Project 中完成完整任务，不跨页面拼接 | Phase 6/9 | PH6-GAP-007, PH9-GAP-011 | TBD | TBD | TBD |
| REQ-UX-002 | Golden 场景 required decisions <=5 | Phase 4/9/10 | PH4-GAP-012, PH9-GAP-012, PH10-GAP-007 | TBD | TBD | TBD |
| REQ-UX-003 | Evidence/Graph/Action 默认折叠 | Phase 4/9 | PH4-GAP-012, PH9-GAP-013 | TBD | TBD | TBD |
| REQ-UX-004 | Dashboard 优先任务、失败和窗口 | Phase 9 | PH9-GAP-014 | TBD | TBD | TBD |
| REQ-GA-001 | 原始需求逐项最终 disposition | Phase 10 | PH10-GAP-001, PH10-GAP-002 | TBD | TBD | TBD |
| REQ-GA-002 | 最终 systemd/Compose/Preserve/Import E2E | Phase 10 | PH10-GAP-003..006 | TBD | TBD | TBD |
| REQ-GA-003 | Support Matrix 明确限制和非目标 | Phase 10 | PH10-GAP-008..011 | TBD | TBD | TBD |

Final Disposition 只允许：

```text
GA-SUPPORTED
GA-SUPPORTED-WITH-LIMITATIONS
EXPERIMENTAL
DEFERRED
REJECTED-AS-NON-GOAL
```

不得使用 `covered`、`mostly done`、`future` 等模糊状态。
