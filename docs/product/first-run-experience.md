# First-run Experience

Question:

~~~text
用户第一次用它，能不能马上获得价值？
~~~

Conclusion:

~~~text
第一次使用的价值不应该是成功迁移，而应该是让用户终于看清旧服务器。
~~~

The first-run goal is insight, not mutation. A new user should be able to scan a
server read-only, understand what matters, and export a useful assessment even if
they never apply a migration.

## 10-minute path

| Time | Experience |
|---|---|
| 0–1 min | User adds the source server and selects read-only scan. |
| 1–4 min | EnvForge collects OS, services, ports, packages, containers, configs, data hints, and security baseline evidence. |
| 4–6 min | EnvForge generates a service stack summary and risk summary. |
| 6–8 min | EnvForge shows migration readiness and required decisions. |
| 8–10 min | User exports an Assessment Report or generates a Plan-only draft. |

Chinese product path:

- 0–1 分钟：用户添加源服务器，选择 read-only scan。
- 1–4 分钟：EnvForge 采集 OS、services、ports、packages、containers、configs、data hints、security baseline。
- 4–6 分钟：生成服务栈摘要和风险摘要。
- 6–8 分钟：展示 migration readiness 和 required decisions。
- 8–10 分钟：用户导出 Assessment Report 或生成 Plan-only draft。

## First output

The first-run assessment should answer:

- 主要运行什么
- 哪些服务栈最重要
- 哪些可以迁移
- 哪些有风险
- 需要用户处理几个关键决策
- 证据完整度
- 是否可以导出报告

Even without migration execution, the user should think:

~~~text
我终于知道这台旧服务器上到底有什么了。
~~~

## Homepage CTA

- Assess a server
- Generate a migration plan
- Apply an approved plan

The default entry is Read-only Assessment, not Apply.
