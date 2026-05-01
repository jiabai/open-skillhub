# Encrypted Skill Package Decryptor - Execution Plan

## Goal
Implement a fail-closed `decryptArtifact` dependency in the Electron main process so the desktop client can distribute encrypted skill packages when an operator explicitly provides the backend download decryption secret.

## Discovery Date
2026-05-01

## Problem Summary
Desktop client fails when attempting to distribute skills because backend returns encrypted packages, but desktop client has no `decryptArtifact` dependency implemented.

## Error Details
```
Encrypted skill packages require a decryptArtifact dependency before distribution
```
- Occurs in `src/core/distribution/package-service.ts:186-191`
- Triggered when `downloadSkillArtifact()` returns `encrypted: true`
- The `decryptArtifact` optional dependency is not provided in `electron/main.ts:542-546`

## Root Cause
1. **Backend has encryption enabled by default**: `settings.ENABLE_SKILL_DOWNLOAD_ENCRYPTION` controls this
2. **Desktop client has no decryptor implemented**: As documented in `docs/design-docs/package-artifact-cleanup.md:54`
3. **Desktop client does not automatically know the backend encryption secret**: the backend derives the download key from `settings.SECRET_KEY`, which must not be copied into renderer state or plaintext desktop config

## Design Note
This is a **fail-closed security design**, not a bug:
- System does not silently proceed without proper decryption
- Missing decryptor throws clear error instead of attempting unsafe operations
- Missing decryption secret must also fail closed; the desktop client may only decrypt when the operator provides `OPEN_SKILLHUB_DOWNLOAD_DECRYPTION_SECRET` in the Electron runtime environment

## Progress

- [x] Design checked against current package/distribution code and backend encryption implementation; no blocking logic issue found.
- [x] Active plan and task tracker updated.
- [x] Secret-source gap identified and plan corrected to require an explicit runtime environment secret.
- [x] Add encryption utility module in Electron main process.
- [x] Implement `decryptArtifact` function.
- [x] Add dependency injection in `electron/main.ts`.
- [x] Add unit tests for decryption logic.
- [x] Durable docs updated.
- [x] Validation gates passed.

## Encryption Implementation Details

### Backend Encryption Flow (for Reference)
From `backend/services/skill.py`:

1. **Key Derivation**: Use HKDF + SHA256 to derive 32-byte AES-256 key
   - Secret: `settings.SECRET_KEY`
   - Purpose: `"skill-download-encryption"`
   - Salt: Fixed salt `b"open-skillhub:key-derivation:v1"`

2. **Encryption**: Use AES-GCM
   - Nonce: 12 random bytes
   - Tag: AEAD authentication tag
   - Format: `nonce + ciphertext + tag`
   - Encoding: Base64 encode the encrypted bytes

3. **Checksum**: SHA256 of entire encrypted payload (nonce + ciphertext + tag)

### Client Decryption Requirements
Implement identical logic in Node.js:

1. Read `OPEN_SKILLHUB_DOWNLOAD_DECRYPTION_SECRET` from the Electron main process environment; it must match the backend `SECRET_KEY` used for download encryption
2. Derive key using same HKDF/SHA256 parameters
3. Decode base64 encrypted payload
4. Extract nonce (first 12 bytes) and ciphertext+tag
5. Decrypt using AES-GCM
6. Return a plaintext ZIP artifact inside the existing package staging directory

`downloadSkillArtifact()` already base64-decodes and verifies the encrypted-payload checksum before writing the encrypted artifact, so the decryptor does not need a second checksum input unless the API contract later adds one for plaintext payloads.

## Scope

### Implement Decryption Logic
- New file: `desktop-client/electron/encryption.ts`
  - Implements `deriveAes256Key()` - HKDF key derivation
  - Implements `decryptPayload()` - AES-GCM decryption
  - Implements `createDecryptArtifactFromEnv()` - package-service decryptor factory using `OPEN_SKILLHUB_DOWNLOAD_DECRYPTION_SECRET`

### Update Package Service Integration
- Keep the existing `package-service.ts` decryptor dependency contract unchanged
- Wire up the real decryptor in `electron/main.ts`
- Add focused tests in `src/__tests__/encryption.test.ts`

## Non-Goals
- Implement encryption of locally stored packages
- Add key management UI
- Change backend encryption logic
- Persist the backend download decryption secret in desktop JSON config or renderer state

## Implementation Steps

1. Add encryption utility module in Electron main process
2. Implement `decryptArtifact` function
3. Add dependency injection in `electron/main.ts`
4. Add unit tests for decryption logic
5. Update documentation and run validation gates

## Decisions
- Keep decryption logic in Electron main process (not renderer) for security
- Use Node.js built-in `crypto` module instead of external libraries
- Follow same error patterns as existing package service code
- Use `OPEN_SKILLHUB_DOWNLOAD_DECRYPTION_SECRET` for the current Electron process only; operators can set it to the backend `SECRET_KEY` in deployments that keep encrypted downloads enabled
- If the env var is missing or decryption authentication fails, stop before extraction and rely on existing cleanup ownership paths

## Validation Plan
```bash
cd desktop-client && npm test
cd desktop-client && npm run build
python scripts/validate_agents_docs.py --level ERROR
```

## Validation Results

- `npm test` passed: 15 test files, 79 tests.
- `npm run build` passed, including Electron typecheck, Vite renderer build, Electron main bundle, and preload bundle.
- `python scripts\validate_agents_docs.py --level ERROR` passed with 0 errors and 0 warnings.

## Immediate Solution (Recommended for Development)
If you don't need encryption yet, you can temporarily disable it in backend config:
- Set `ENABLE_SKILL_DOWNLOAD_ENCRYPTION = False` in `backend/config/settings.py`

If encrypted downloads stay enabled, launch the desktop runtime with:

```bash
OPEN_SKILLHUB_DOWNLOAD_DECRYPTION_SECRET=<backend SECRET_KEY> npm run start:electron
```

On Windows PowerShell:

```powershell
$env:OPEN_SKILLHUB_DOWNLOAD_DECRYPTION_SECRET="<backend SECRET_KEY>"
npm run start:electron
```

## Affected Files
- `backend/services/skill.py`: Encryption reference
- `desktop-client/src/core/distribution/package-service.ts`: Validation check
- `desktop-client/electron/main.ts`: Missing dependency injection
- `desktop-client/electron/encryption.ts`: New Electron main-process decryptor
