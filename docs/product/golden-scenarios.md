# Golden Scenarios

EnvForge should not initially chase support for 100 software packages. It should
go deep on a small number of high-value scenarios.

Each golden scenario needs:

- demo lab
- fixture
- scan
- plan
- dry-run/apply
- verify
- report
- failure example

## 1. 旧 VPS 迁移到新 VPS / Legacy VPS to new VPS

Covers:

- Nginx / Caddy
- Certbot
- Docker Compose
- PostgreSQL / MySQL
- Redis
- UFW
- SSH
- systemd services

## 2. Docker Compose 应用重建 / Docker Compose application rebuild

Covers:

- compose files
- env files
- volumes
- networks
- image digests
- reverse proxy labels
- healthchecks
- depends_on
- restart policies

## 3. 数据库安全迁移 / Safe database migration

Covers:

- PostgreSQL
- MySQL/MariaDB
- Redis
- backup
- transfer
- restore
- verify
- rollback boundary

## 4. 服务器环境盘点报告 / Server environment assessment report

Covers:

- 服务栈识别
- 端口
- 配置
- 数据目录
- secret 风险
- 安全基线
- 迁移建议

## 5. 迁移后持续验证 / Post-migration continuous verification

Covers:

- 服务健康
- 端口状态
- 证书有效期
- 配置 drift
- Docker container health
- 数据库可访问性
- backup freshness
