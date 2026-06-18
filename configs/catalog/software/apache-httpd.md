# Apache HTTP Server

Apache HTTP Server is a mature web server for static sites, reverse proxies, and applications that use modules such as `mod_ssl`, `mod_proxy`, or `mod_php`.

EnvForge supports Debian-family systems through the `apache2` package and RHEL-family systems through the `httpd` package. The package adapter translates the package name automatically.

## What this catalog item manages

- Installs the Apache package when it is absent.
- Creates a reviewed document root.
- Writes an EnvForge-owned virtual host without deleting distribution defaults.
- Validates the complete configuration before restarting the service.
- Enables the correct `apache2` or `httpd` systemd service.

## Important migration boundaries

Existing virtual hosts may reference TLS private keys, application directories, upstream services, `.htaccess` rules, and PHP handlers. EnvForge inventories those references, but operators must confirm that referenced files and services exist on the target host.

Do not copy private keys or credential files without explicit approval. Review whether the source uses `mod_php` or PHP-FPM before enabling a migrated site.

## Verification

Run `apachectl configtest`, then check `systemctl status apache2` or `systemctl status httpd`. Confirm that the selected listen port is reachable and not already owned by Nginx, Caddy, or a container.
