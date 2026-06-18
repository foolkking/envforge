# PHP-FPM

PHP-FPM is the FastCGI process manager commonly used behind Nginx or Apache. It manages pools, worker limits, Unix sockets or TCP listeners, per-application users, and optional environment variables.

## What this catalog item manages

- Installs the distribution PHP-FPM package.
- Detects versioned Debian services such as `php8.2-fpm` and the RHEL `php-fpm` service.
- Runs the available PHP-FPM syntax checker before service activation.
- Enables and starts the detected systemd unit.

## Migration review

Pool files under `/etc/php/*/fpm/pool.d/` or `/etc/php-fpm.d/` are application-specific. Review `user`, `group`, `listen`, `pm.*`, `env[]`, and `php_admin_value[]` settings before migration. Environment entries may contain secrets and must remain redacted.

The web server upstream must match the selected socket or TCP listener. A valid PHP-FPM pool can still produce HTTP 502 errors when Nginx or Apache points at a different socket path.

## Verification

Use `php-fpm -t`, `php-fpm8.2 -t`, or the installed versioned binary. Check the active service with `systemctl`, then verify the configured socket exists and is readable by the web-server user.
