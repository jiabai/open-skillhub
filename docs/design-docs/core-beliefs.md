# Core Beliefs

## What We Optimize For

- Make the backend the source of truth for capability, permission, and auth-sensitive decisions.
- Keep agent-readable knowledge in the repository so work can restart from files instead of memory.
- Prefer explicit boundaries over convenience shortcuts that blur architecture.
- Favor boring, testable technology choices over opaque or novelty-heavy dependencies.
- Use documentation to reduce human attention cost, not to create more reading.

## What This Means In Practice

- If a frontend page needs to know whether a feature is available, it should read the backend contract.
- If a recurring code or process question appears in reviews, encode the answer into `docs/`.
- If a file grows into a multi-topic control center, split it at the next sensible milestone.
- If a plan is active, keep it in `docs/exec-plans/active/`; when done, move it to `completed/`.
