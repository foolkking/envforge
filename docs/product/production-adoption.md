# Production Adoption

Question:

~~~text
团队能不能把它纳入生产流程？
~~~

Teams need:

- 权限
- 审批
- 审计
- 策略
- 可追踪
- 可回滚
- 可集成
- 可部署
- 可备份
- 可升级

## Team workflow example

~~~text
Operator scans source server
→ EnvForge creates assessment
→ SRE reviews service stacks
→ Security reviews secrets and exposure
→ DBA reviews data strategy
→ Platform lead approves Plan
→ Apply window is scheduled
→ Controlled Apply runs
→ Verification Report generated
→ Report attached to ticket/change record
~~~

## Production capabilities

- RBAC
- Team approval
- Audit log
- Signed reports
- Policy-as-code
- Change window
- Environment labels
- Ticket system integration
- Support bundle
- External secret manager
- SSO/OIDC
- Backup and restore of EnvForge itself
- Upgrade and rollback docs
- Database-backed atomic claim for multi-replica deployments

## Production object model

- Source Server
- Snapshot
- Service Stack
- Decision
- Review Inbox Item
- Environment Plan
- Approval
- Apply Run
- Action Run
- Verification Report
- Support Bundle
- Capability Version
- Policy
