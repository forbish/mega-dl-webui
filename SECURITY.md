# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly via
[GitHub Security Advisories](https://github.com/forbish/mega-dl-webui/security/advisories/new).

Do **not** open a public issue for security vulnerabilities.

## Scope

This project downloads files from MEGA's servers. It does not handle user
authentication, store credentials, or process payments. Security concerns
relevant to this project include:

- Path traversal in download destinations
- Server-side request forgery via URL handling
- Denial of service through resource exhaustion
- Container escape or privilege escalation
