# systemd-resolved

This detect-only catalog item describes the host DNS stub resolver managed by systemd. EnvForge uses it to identify ownership of UDP/TCP port 53 and to prevent unsafe combinations with Pi-hole or AdGuard Home.

It does not disable the resolver or rewrite `/etc/resolv.conf`.

## Detection scope

- Whether `systemd-resolved.service` exists and is active.
- Whether `DNSStubListener` is enabled in `resolved.conf`.
- Whether `127.0.0.53:53` or another resolver endpoint owns port 53.
- The current `/etc/resolv.conf` target and resolver state.

## Safety boundary

Disabling the stub listener can break all host name resolution. Before changing it, confirm the replacement resolver is installed, reachable, and configured to start on boot. Also verify whether `/etc/resolv.conf` is a symlink managed by systemd.

Pi-hole and AdGuard Home plans must resolve the DNS ownership conflict before apply. This card remains detect-only so a catalog selection cannot silently change host-wide DNS.

## Verification

Use `resolvectl status`, `systemctl status systemd-resolved`, and `ss -lntup` to inspect resolver ownership. Any change to DNS service state requires an explicit, separately reviewed plan.
