# Pinoria Egg Hatch staging E2E evidence — 2026-08-30

## Scope

Authoritative end-to-end staging proof for the generic Pinoria Activity path:

`Founder/BO config -> TOS available activity -> TOS execute HATCH -> Core commit -> unified TV presentation FIFO -> reconnect replay -> completion`

This evidence was captured against the deployed staging Team artifact at commit `ff4b6c8b8bd4b05a27ccbeffac8a0028e30a286c` using `https://pino-team-os-staging.minhtri-van42.workers.dev` and the staging Core binding. No production environment was used.

## Fixture

- Center: `019d1000-0001-7000-8000-000000000001`
- Learner: `019d1000-0002-7000-8000-000000000002`
- Companion species key: `mori-water-staging-v1`
- Activity key: `egg-hatch-mori-staging-v1`
- Presentation profile: `egg-water-v1`

## Authoritative objects created / used

- Species: `01a04ff6-ecc1-7200-8d5a-a9171f727df8`
- Activity: `01a04ff6-f0ce-75c7-9d15-92e6f42b89be`
- Ready Egg: `01a04ff6-f4c8-71a4-8344-aeade573c1e2`
- Companion committed by hatch: `01a04ff6-f715-7d4c-8710-2403b60f8a51`
- TV presentation: `01a04ff6-f715-71d3-a2cf-af80b743d35c`
- Activity snapshot hash prefix observed after activation: `63f23eca12f3`

## Assertions observed live

1. Companion species was created and activated through Founder control plane.
2. `EGG_HATCH` Activity was created, validated, scheduled, and activated through the generic Activity registry.
3. A ready Egg was granted in staging.
4. TOS `pinoria/activities/available` projected the Activity as eligible with enabled `HATCH` action, Mori species context, and `pinoria/Companion/Egg-water.png`.
5. TOS generic `pinoria/activities/execute` committed the hatch.
6. Repeating the exact command with the same idempotency key returned the same result (`IDEMPOTENCY_REPLAY_SAME true`).
7. The committed projection carried presentation profile `egg-water-v1` and the expected Mori/Egg assets.
8. TV claimed presentation `01a04ff6-f715-71d3-a2cf-af80b743d35c` with kind `EGG_HATCH`.
9. A reconnect claim returned the same active presentation (`TV_RECONNECT_SAME`).
10. Completing the same presentation twice was idempotent: the second completion preserved the original completion timestamp.
11. After completion, the Center TV FIFO returned no pending presentation (`TV_QUEUE_EMPTY true`).
12. The Activity became ineligible with `COMPANION_ALREADY_OWNED`, proving the domain commit—not TV playback—became authoritative.

## Captured terminal result

```text
SPECIES_CREATED 01a04ff6-ecc1-7200-8d5a-a9171f727df8
SPECIES_ACTIVE 01a04ff6-ecc1-7200-8d5a-a9171f727df8 2
ACTIVITY_CREATED 01a04ff6-f0ce-75c7-9d15-92e6f42b89be
ACTIVITY_ACTIVE 01a04ff6-f0ce-75c7-9d15-92e6f42b89be 63f23eca12f3
EGG_READY 01a04ff6-f4c8-71a4-8344-aeade573c1e2 READY
TOS_HATCH_ELIGIBLE 01a04ff6-f4c8-71a4-8344-aeade573c1e2
HATCH_COMMITTED 01a04ff6-f715-7d4c-8710-2403b60f8a51 01a04ff6-f715-71d3-a2cf-af80b743d35c
IDEMPOTENCY_REPLAY_SAME true
TV_RECONNECT_SAME 01a04ff6-f715-71d3-a2cf-af80b743d35c
TV_QUEUE_EMPTY true
FINAL_ACTIVITY_REASON COMPANION_ALREADY_OWNED
E2E_PASS {"speciesId":"01a04ff6-ecc1-7200-8d5a-a9171f727df8","activityId":"01a04ff6-f0ce-75c7-9d15-92e6f42b89be","eggId":"01a04ff6-f4c8-71a4-8344-aeade573c1e2","companionId":"01a04ff6-f715-7d4c-8710-2403b60f8a51","presentationId":"01a04ff6-f715-71d3-a2cf-af80b743d35c","profileKey":"egg-water-v1"}
```

## Gate conclusion

**PASS.** Egg Hatch staging authority is proven across BO/Founder configuration, TOS execution, Core domain commit, idempotency, unified TV FIFO replay, and completion. The TV remains a presentation consumer and is not the authority that creates the Companion.
