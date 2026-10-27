# Monotonic staging CD — October 27, 2026

## Why
Frequent, CI-protected merges caused a newer `main` HEAD between successful candidate CI and staging release. The former exact-HEAD equality check rejected all otherwise valid descendants and left staging behind.

## Admission and safety
The candidate is still an exact checked-out SHA with a successful PR Validation **push or workflow_dispatch** run from `main`. GitHub Compare must report `ahead` or `identical` for `candidate...current-main`. Diverged branches are rejected.

At the exclusive staging CAS lease, GitHub Compare must report `ahead` or `identical` for `currently-serving-staging-SHA...candidate`, where currently-serving SHA is extracted from the authoritative Cloudflare deployment annotation. Missing or unrecognized annotation fails closed. Checks are repeated before deploy; deployment must retain all Core staging-only service bindings, no outbound, 100% serving readback and rollback fencing.

This allows staging to advance through a sequence of tested ancestors while main is busy. It does not allow regression to a previous staging commit, deployment of unrelated branches, production promotion, or bypassing PR validation.

## Verification
Run `node --test scripts/staging-cd-monotonic.test.mjs`, then PR Validation and staging CD. The final serving SHA/version must be independently read back from Cloudflare. Authenticated visual parity remains a separately documented acceptance step.
