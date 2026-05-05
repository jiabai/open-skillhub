# Backend Service Boundary Refactor Design

## Status

Proposed for implementation.

## Problem

Two high-priority backend debts are coupled:

- repository methods commit inconsistently, making transaction boundaries hard to
  compose
- `SkillService` is a large facade over narrower coordinators and crypto helpers

Both issues blur the route -> service -> repository boundary.

## Decision

Refactor in small slices:

1. Introduce an explicit Unit of Work or transaction boundary pattern.
2. Standardize repositories so writes flush or return pending objects while the
   outer boundary commits.
3. Split `SkillService` consumers toward narrower provider functions or service
   bundles.
4. Move download crypto helpers out of the broad facade.

## Constraints

- Preserve API response shapes.
- Keep route code thin.
- Avoid rewriting all skill routes in one large step.
- Keep compatibility wrappers until route consumers have moved.

## Validation

- Multi-step rollback tests for skill clone/upload flows.
- Existing skill API tests.
- Backend hard gates.
