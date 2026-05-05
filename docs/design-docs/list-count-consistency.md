# List Count Consistency Design

## Status

Proposed for implementation.

## Problem

List endpoints that return `items` and `total` often run two queries. Concurrent
writes can make those values describe different snapshots.

## Decision

Inventory each endpoint and choose one strategy:

- consistent snapshot/transaction for high-value lists
- single-query window function when it is simple and supported
- documented eventual consistency for low-risk lists

## Candidate Surfaces

- skill lists
- public skill lists
- user admin lists
- token lists

## Validation

- Repository tests for selected count/list behavior.
- API tests that confirm response shape remains stable.
- Documentation updates for surfaces where eventual consistency is accepted.
