# Core Beliefs

## 1. Review Before Distribution

The desktop client exists to make local delivery safer, not more automatic.
Polling may detect updates and notify the operator, but writes happen only after explicit approval.

## 2. Privilege Stays in the Main Process

Renderer code should never quietly grow hidden filesystem or secret access.
Electron main, preload, and typed IPC are the only acceptable bridge for privileged operations.

## 3. Adapters Own Agent-Specific Behavior

Sync and distribution logic should not know Codex, Claude Code, or Gemini CLI path conventions.
Per-agent install structure, validation, and verification stay in adapter modules.

## 4. Fail Closed On Contract Gaps

If a package is encrypted and the Electron main process does not have valid decryption material, distribution stops.
If a path is ambiguous or an identifier is unsafe, installation stops.
If docs and implementation disagree, update the docs or the code before claiming the workflow works.

## 5. Canonical Docs Must Describe Reality

Historical brainstorming is useful context, but active guidance must reflect the code that actually exists.
When current implementation falls short of a target design, record the gap in the spec, active ExecPlan, or tech-debt tracker instead of hiding it in assumptions.
