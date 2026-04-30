# Skill Name Directory Consistency Exec Plan

## Goal

Fix the mismatch where desktop-client installs and pre-checks skills by
`remoteSkillId` even though the pre-distribution check design requires conflict
detection for skills with the same skill name.

## Scope

- Use the skill name as the filesystem skill directory key for adapter install
  and metadata reads.
- Keep existing path-safety validation before joining any skill directory name.
- Update pre-distribution checks to ask adapters for the pending update `name`,
  not `remoteSkillId`.
- Add tests for same-name/different-ID conflict detection and name-based install
  directories.
- Update the pre-distribution design and durable docs to describe the real
  name-based directory contract.

## Non-Goals

- No State DB migration.
- No renderer or IPC contract change.
- No legacy UUID-directory compatibility path; the client has not launched, so
  there is no historical install base to support.
- No change to remote API identifiers; `remoteSkillId` remains the server-facing
  identity and sync-state key.

## Progress

- [x] Root cause identified: adapter install and metadata lookup use
  `skillId`/`remoteSkillId` as the directory name.
- [x] Active plan and task tracker updated.
- [x] Failing tests added and confirmed red against the old UUID-directory behavior.
- [x] Adapter and pre-check implementation fixed.
- [x] Documentation updated.
- [x] Validation gates passed:
  - `cd desktop-client && npm test`
  - `cd desktop-client && npm run build`
  - `python scripts/validate_agents_docs.py --level ERROR`
  - `git diff --check`

## Decisions

- The directory key is the remote skill `name`, validated with the existing safe
  directory-name rules. The server UUID remains the remote record identity only.
- Legacy UUID-named directories are not supported in this fix because the
  desktop client has not formally launched.
- Existing unrelated worktree changes outside this desktop-client path are left
  untouched.

## Validation Plan

- `cd desktop-client && npm test`
- `cd desktop-client && npm run build`
- `python scripts/validate_agents_docs.py --level ERROR`
- `git diff --check`
