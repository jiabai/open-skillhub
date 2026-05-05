# Auth Provider Consistency Design

## Status

Proposed for implementation.

## Problem

Two auth-adjacent debts remain:

- SSO nonce/timestamp validation exists in more than one place
- email sender provider selection is tied to `DEBUG`

Both are configuration and security-adjacent consistency issues.

## Decision

Make provider and validation ownership explicit:

- nonce, `iat`, and `exp` validation should have one shared implementation used
  by direct SSO JWT login and OIDC callback login
- email sender selection should use a dedicated provider setting such as
  `EMAIL_PROVIDER`, not `DEBUG`

## Validation

- SSO tests for nonce mismatch, missing nonce, future `iat`, and expired token.
- Settings tests for email provider values.
- Email sender tests for SMTP, Aliyun, and development/console behavior.
- Backend hard gates.
