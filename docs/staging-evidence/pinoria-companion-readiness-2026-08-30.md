# Pinoria Companion Readiness 0057 — staging evidence

Date: 2026-08-30  
Environment: staging only  
Production: untouched

## Canonical implementation

- Core feature: `pinoria-companion-materialization-readiness`.
- Core 0057 merge: `a5abc92713e52540ad32dcc0135bf5be277ac1c3`.
- Core post-merge CI `33300148472`: PASS.
- Governed Core staging run `33300409306`: PASS.
- Core staging version after 0057: `d2d21397-e0df-4350-b83e-7135d491cb33` at 100%.
- Team readiness surface merge: `cf2993fa3061624f12d245f07fa9946d67f4fbd5`.
- Team staging deploy `33300738012`: PASS.
- Team staging version at readiness rollout: `c2e9fe81-0a2f-44f6-bdd3-640fa800fd20`.

The authority boundary remains BO/TOS -> Core commit -> TV presentation. Fruit grant, Water Sigil award, and Companion feed never create TV presentation events. Only `COMPANION_RITUAL` may enqueue the evolution presentation.

## Staging access and learning fixture

The synthetic operator uses a dedicated CENTER-scoped readiness role. The pre-existing Ritual-only role was not widened. Access reconcile issue #335 / run `33302037548` passed.

Final governed fixture issue #343 passed with two canonical same-day Sessions:
- `01a05208-2147-703d-860f-693ab2487e9d` — 2026-08-30 14:10–14:40.
- `01a05223-e12f-7f11-ad59-807a66a8e7bd` — 2026-08-30 15:10–15:40.
Both Sessions use synthetic Path `01a05208-1a9c-786b-ae45-e9ed47e455aa`, PUBLISHED Syllabus `01a05208-1cb9-75aa-89f1-af116bd47226`, and a canonical active Learning Owner. They were created/reconciled through Core services, not direct D1 inserts.

## Guarded live advance contract

The staging runner `scripts/pinoria-staging-synthetic-e2e.mjs` protects mutation with `PINORIA_MUTATION_CONFIRM=STAGING_COMPANION_ADVANCE`. Its `companion-advance` mode requires a fresh Lv1/feed0 Companion and two distinct Diary IDs, then proves:

1. Fruit grant for each Diary, including exact idempotent replay.
2. Fruit balance reaches exactly 2.
3. Two explicit feeds target Mori; each command is replay-safe.
4. Feed #2 returns `READY_FOR_RITUAL` with rule `FEED_2`.
5. Core exposes eligible `COMPANION_RITUAL` and enabled `ADVANCE_COMPANION_MATERIALIZATION`.
6. Ritual execution is replay-safe and advances Lv1 -> Lv2.
7. Core state after Ritual is Lv2 / `GROWING` / stageFeedCount 0.
8. TV claims the exact Ritual presentation; reconnect returns the same claim.
9. TV completion is replay-safe; subsequent claim returns an empty queue.

The granular stdout from the historical mutation run, including its exact Diary IDs and presentation ID, was not retained in the current session evidence. This document does not invent those identifiers.

## Current canonical postconditions

Read-only staging verification after the live advance reports Mori `01a04ff6-f715-7d4c-8710-2403b60f8a51` at materialization Lv2, `GROWING`, stageFeedCount 0, readinessRuleKey null, progression version 4. Fruit balance is 0 and Water Sigil is absent.
At this state, `COMPANION_RITUAL` is correctly ineligible with `COMPANION_NOT_READY_FOR_RITUAL`, because Lv2 requires five new stage feeds plus Water Sigil. A read-only TV claim returns `presentation: null`.

Progression version 4 is consistent with the canonical sequence of feed #1, feed #2, and Ritual advancement after the original progression row. No additional mutation was performed during closure verification.

## Automated coverage beyond the live Lv1 -> Lv2 proof

Core tests cover the Lv2 -> Lv3 rule without consuming more staging learner state:
- five new feeds plus Water Sigil are required;
- five feeds without Sigil remain `GROWING`;
- Sigil arriving after feed #5 converges to `READY_FOR_RITUAL`;
- Sigil-before-feed5 converges when feed #5 lands;
- `feed5 || Water Sigil` concurrency converges safely;
- two Companions cannot overspend one Fruit;
- semantic replay and wrong-Center / voided-Diary evidence fail safely.

Lv3 -> Lv4 remains intentionally fail-closed/TBD and is not part of this operational claim.

## Closure

**0057 Lv1 -> Lv2 is operational on staging.** Canonical prerequisites exist, Core/TOS surfaces are deployed, current state proves the materialization advancement committed, and the TV queue is drained with no business mutation owned by TV.

The next Companion progression design gate is Lv3 -> Lv4; it must not be opened until its canonical requirements are explicitly approved.