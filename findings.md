# Findings

## Context

- `desktop-client` currently renders almost all UI strings inline in English.
- The renderer currently formats timestamps with hardcoded `en-US` locale settings.
- Local runtime config persistence only stores `apiBaseUrl`; locale is not yet persisted.
- The existing frontend already uses a lightweight custom i18n stack with `en-US` and `zh-CN`, which is a good behavioral model for desktop-client.

## Notes

- Desktop-client should match the frontend locale codes and dictionary behavior, but use local config persistence instead of cookies.
- The likely smallest safe change is to add a local i18n context/provider in `desktop-client/src/i18n/` and feed it from runtime config state.

