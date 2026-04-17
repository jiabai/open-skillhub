# SECURITY

## Scope

This document captures the stable security model for the backend and web console. It is not a full threat model; it is the shared baseline contributors should keep intact.

## Identity and Access

- Web users authenticate through email OTP, SSO, or LDAP.
- Web sessions use JWT access and refresh tokens.
- Programmatic clients use API tokens for skill metadata and download endpoints.
- Per-user skill isolation is enforced through auth context plus filesystem or database ownership checks.

## Secrets and Configuration

- Never commit `.env` files or machine-specific environment overrides.
- Treat `SECRET_KEY`, SMTP credentials, LDAP credentials, and SSO secrets as deployment-only inputs.
- Production safety checks belong in validated backend settings, not ad hoc startup logic.

## Storage and Transport

- Skill files are stored in user-scoped directories.
- Skill archives and cached artifacts must preserve ownership boundaries.
- Public exposure should terminate through the intended frontend or reverse-proxy entry point unless direct backend access is an explicit deployment choice.

## Application Safeguards

- Preserve consistent API error shapes so clients can handle failures predictably.
- Keep audit logging, permission checks, and rate limiting in shared middleware or service layers.
- Treat runtime capability responses as security-relevant because they shape exposed frontend behavior.

## Known Security Follow-Ups

- Refresh token rotation strength remains a tracked improvement item in `docs/exec-plans/tech-debt-tracker.md`.
- Security-sensitive design changes should add or update backend tests before merge.
