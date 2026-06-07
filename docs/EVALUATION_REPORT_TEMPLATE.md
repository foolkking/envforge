# EnvForge Evaluation Report — `<scenario id>` on `<target id>`

> Copy this file under `docs/harness-reports/<release>/` (or attach it
> to the change-management ticket) and fill in every field. The harness
> auto-generates the JSON sibling next to it; this Markdown template is
> for the human story around a single live run.

## Run metadata

| Field               | Value                                                    |
| ------------------- | -------------------------------------------------------- |
| Scenario id         |                                                          |
| Target id           |                                                          |
| Target type         | docker / vagrant / multipass / cloud-vm                  |
| Target OS           |                                                          |
| Kernel              |                                                          |
| Package manager     | apt / dnf / pacman / apk / zypper                        |
| Init system         | systemd / openrc / sysvinit                              |
| EnvForge commit     | `<sha>`                                                  |
| Harness run id      | `<docs/harness-reports/<runId>/>`                        |
| Operator            |                                                          |
| Run started         | ISO8601                                                  |
| Run ended           | ISO8601                                                  |

## Plan

| Field                       | Value                                                  |
| --------------------------- | ------------------------------------------------------ |
| Plan id                     |                                                        |
| Plan type                   | rebuild / change / remove / repair                     |
| Capabilities                | comma-separated capabilityKey list                     |
| supportLevels               | per-item                                               |
| effectiveSupportLevel       |                                                        |
| Conflicts (block / warn)    |                                                        |
| Approvals required          | comma-separated kinds                                  |
| Remaining risks (count)     | total / acked                                          |

## Apply gate

| Field          | Value                                                       |
| -------------- | ----------------------------------------------------------- |
| ok             | true / false                                                |
| Block reasons  |                                                             |
| Invalid resolutionIds |                                                      |
| Inconsistent resolutions |                                                   |
| Missing risk acks |                                                          |
| Missing approval gates |                                                     |
| detect-only violations |                                                     |

## Action runs

Fill one row per action that ran. The harness auto-generates this list
in `<runId>/<scenario>.actions.json`; transcribe the table here for
human review.

| ItemId / ActionId | Status (terminal) | applyOk | verifyOk | rollbackOk | redacted | Notes |
| ----------------- | ----------------- | ------- | -------- | ---------- | -------- | ----- |
|                   |                   |         |          |            |          |       |

## Validate / Verify result

- `nginx -t` (or relevant validator) exit code:
- `systemctl is-active <service>` output:
- `docker version` / `docker info` output (when applicable):
- Custom verify checks (per scenario):

## Rollback result (only if `Verify` failed)

- backupPath actually restored:
- post-rollback verify exit code:
- service state after rollback:

## ManagedCapabilityRecord (install / remove scenarios)

```json
{
  "id": "",
  "capabilityKey": "",
  "catalogId": "",
  "installedByPlanId": "",
  "installedAt": "",
  "targetHostId": "",
  "packagesInstalled": [
    { "name": "", "manager": "", "existedBefore": false, "removableByEnvForge": true }
  ],
  "configsTouched": [],
  "servicesTouched": [],
  "dataPathsKnown": []
}
```

## Plan Report path

- JSON: `docs/harness-reports/<runId>/<scenario>.report.json`
- Markdown: `docs/harness-reports/<runId>/<scenario>.report.md`

## Redaction status

- Were any redaction rules triggered? (yes / no)
- Which rules? (list)
- Manual spot-check: confirm no plaintext credential present in JSON or
  Markdown. Run:

  ```sh
  grep -E '(BEGIN [A-Z ]*PRIVATE KEY|ghp_|glpat-|sk-[a-z]{0,5}[A-Za-z0-9]{30,}|AKIA[A-Z0-9]{12,}|Bearer )' docs/harness-reports/<runId>/* || echo "ok: no plaintext secrets"
  ```

## Real-system differences observed

Fill in deltas the harness's `targetDifferences` block highlighted.

| Field               | Observed value     | Action taken (link to commit / issue) |
| ------------------- | ------------------ | ------------------------------------- |
| sshServiceName      |                    |                                       |
| nginxServiceName    |                    |                                       |
| dockerServiceName   |                    |                                       |
| packageManager      |                    |                                       |
| systemdAvailable    |                    |                                       |
| sudoNoPassword      |                    |                                       |
| firewallStack       |                    |                                       |
| tmpAtomicInstall    |                    |                                       |
| aptDpkgLocked       |                    |                                       |

## Final verdict

- [ ] **PASS** — plan generated, gate behaved as expected, action runs
  reached the documented terminal status, verify exit codes 0 (or
  rollback succeeded for rollback-required scenarios), no plaintext
  secrets in any report.
- [ ] **FAIL** — at least one of the above did not hold.

## Known issues / follow-ups

> File one issue per real-system delta or unexpected execution
> behaviour. Link the issue id below.
