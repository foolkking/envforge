# Local Reproduction

| Command | Environment | Exit | Reproduced |
|---|---|---:|---|
| `npm run validate:design` | Windows 11, Node 20.13.1 | 0 | no |
| `npm run validate:docs:mermaid` | Windows 11, local Chromium | 0 | no |
| GitHub run `29727165796` | Ubuntu latest, GitHub Actions | 1 | yes |

Windows cannot reproduce the Linux AppArmor/user-namespace failure. Docker is
not installed on this workstation, so the GitHub runner topology cannot be
recreated locally. The remote log identifies the failure before Mermaid parsing
and includes Chromium's explicit `No usable sandbox` fatal message. The
correction is validated locally for normal rendering and remotely for the Linux
CI branch.
