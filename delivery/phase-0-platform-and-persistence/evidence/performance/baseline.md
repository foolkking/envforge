# Phase 0 Performance Baseline

Environment: Windows x64, Node 20.13.1, PostgreSQL 17.10, isolated local
cluster, one test process. These are repeatable baselines, not GA SLOs.

| Measurement | Result |
|---|---:|
| 50 concurrent identical idempotency requests | 159 ms (latest run; prior run 164 ms) |
| Project create + read p50, 20 samples | 3 ms (latest run; prior run 4 ms) |
| Project create + read p95, 20 samples | 12 ms |
| Local Artifact 1 MiB put + read | 24 ms |
| Full API suite | 1014 tests, 68.3 s latest run |

100 MiB Artifact, live MinIO, production capacity, RPO/RTO and SLO claims are
deferred until a production-like environment is available.
