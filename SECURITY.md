# Security policy

## Reporting a vulnerability

Please do not open a public issue for security problems.

Report them privately through
[GitHub's private vulnerability reporting](https://github.com/saeedallam/agentquake/security/advisories/new).
Include what you found, how to reproduce it, and which version you used.

You will get an answer within a week. Once a fix is released, the
advisory is published with credit to you, unless you prefer otherwise.

## Supported versions

agentQuake is in early development (0.x). Only the latest published
version receives security fixes.

## Things worth reporting

- Secrets (API keys, `Authorization` headers, cookies) that end up in
  traces or reports. agentQuake is meant to redact them.
- The proxy or the stdio wrapper sending data anywhere other than the
  configured tool.
- A published package that does not match this repository. Every release
  is built by GitHub Actions and carries npm provenance, which you can
  check with `npm audit signatures`.
