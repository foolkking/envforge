# Failure and Property Summary

The disposable PostgreSQL suite verifies concurrent revision allocation,
confirmed-content mutation rejection, blocked compilation without Plan rows,
duplicate Outbox delivery, deterministic compilation across 100 repeats, DAG
cycle rejection, material drift, self-approval rejection, cross-workspace denial,
secret canary rejection, and the absence of any ExecutionRun table/path.
