# Certbot Let's Encrypt Client

This catalog item is the detect-only compatibility alias for the canonical `certbot-ssl` capability. It identifies an existing Certbot installation, renewal timers, and certificate inventory without contacting the ACME service or issuing a certificate.

Use the `certbot-ssl` catalog item when you intentionally want to install Certbot or request a new certificate.

## Detection scope

- `certbot` binary and version.
- `/etc/letsencrypt` certificate and renewal configuration.
- `certbot.timer`, `certbot-renew.timer`, or Snap renewal timers.
- Existing certificates reported by `certbot certificates`.

## Security boundary

`/etc/letsencrypt/live` contains links to certificate private keys. EnvForge must not copy, print, or export those keys without explicit operator approval. Dry-run and catalog review must never contact Let's Encrypt.

## Verification

Run `certbot --version` and inspect renewal timers. Use `certbot renew --dry-run` only during an explicitly approved operational test because it contacts the ACME staging service.
