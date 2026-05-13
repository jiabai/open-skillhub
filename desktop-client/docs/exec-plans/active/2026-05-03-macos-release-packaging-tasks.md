# macOS Release Packaging Task Checklist

Status: active

## Documentation Gate

- [x] Review root `WORKFLOW.md` and `docs/EXECUTION_GATES.md`.
- [x] Review desktop `AGENTS.md`, architecture, security, task tracker, and
  product/design/reference/ExecPlan indexes.
- [x] Inspect current `package.json`, Electron main package extraction, and
  existing packaging docs.
- [x] Check current Apple Developer ID and notarization guidance from official
  Apple docs.
- [x] Check installed electron-builder macOS signing/notarization schema.
- [x] Add English macOS release product spec.
- [x] Add Chinese macOS release product spec.
- [x] Add macOS release technical design.
- [x] Add macOS release runbook.
- [x] Add active ExecPlan.
- [x] Add this task checklist.
- [x] Update indexes, architecture, security, README, runtime reference, and
  task tracker.
- [x] Run documentation validation.
- [x] Run whitespace diff validation.

## Future Implementation Gate

- [x] Write failing extraction tests for safe ZIP extraction on Windows and
  macOS-compatible path semantics.
- [x] Implement safe cross-platform extraction without shelling out to
  PowerShell.
- [x] Preserve checksum, expiration, and cleanup ownership behavior.
- [x] Add future macOS entitlements files without release secrets.
- [x] Keep initial macOS `package.json` config explicit about deferred signing
  and notarization (`identity: null`, `forceCodeSigning: false`,
  `notarize: false`).
- [x] Update package-script tests to guard the owner-approved initial unsigned
  macOS packaging posture.
- [x] Run `npm test`.
- [x] Run `npm run build`.

## Future Initial macOS Validation Gate

- [ ] Run `npm install` on macOS.
- [ ] Run `npm test` on macOS.
- [ ] Run `npm run build` on macOS.
- [ ] Run `npm run dist:mac` on macOS with the current unsigned config.
- [ ] Execute the manual smoke test in `docs/references/macos-release-runbook.md`.
- [ ] Record exploratory macOS validation evidence in the active ExecPlan.

## Future Public macOS Release Gate

- [ ] Approve the paid Developer ID signing and notarization path.
- [ ] Update `package.json` to require signing, notarization, and explicit
  entitlements.
- [ ] Prepare macOS machine with Xcode, Developer ID Application certificate,
  and notarization credentials outside the repo.
- [ ] Run `npm install`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `npm run dist:mac`.
- [ ] Verify signed `.app` with `codesign`.
- [ ] Submit DMG for notarization.
- [ ] Staple and validate the notarization ticket.
- [ ] Run Gatekeeper assessment on the DMG and installed app.
- [ ] Execute the manual smoke test in `docs/references/macos-release-runbook.md`.
- [ ] Record the release evidence template in the active ExecPlan.

## Archive Gate

- [ ] Move this checklist and the plan to `docs/exec-plans/completed/` after
  macOS release validation is complete or document why the plan was superseded.
