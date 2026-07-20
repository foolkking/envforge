# Artifact Provider Evidence

The Local provider test proves restrictive temporary writes, fsync, atomic
rename, opaque workspace-derived keys, traversal rejection, hash-verified read,
corruption detection and cleanup. `ArtifactService` binds that provider to
`artifact.artifacts`: `pending` is inserted before upload; `available` requires
provider head/length/SHA-256 reconciliation; corruption marks the record
`corrupt`; deletion uses `deletion-pending` then `deleted`.

The injected S3-compatible contract test proves staging, head verification,
copy/publish, read hash verification and staging cleanup using an in-memory
client. Docker and live MinIO are unavailable in this environment, so no live
MinIO certification is claimed.
