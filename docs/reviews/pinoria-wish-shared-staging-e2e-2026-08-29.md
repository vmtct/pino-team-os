# Pinoria Wish shared staging E2E — 2026-08-29

## Scope

This evidence closes the staging-only vertical slice:

BO content/config → Core publish snapshot → TOS real learner/OPEN Visit → authoritative Wish draw → Pinoria TV immutable reveal → reconnect → complete.

Production was not migrated, deployed, or written during this exercise.

## Runtime provenance

- Core source: `e7e62ae7e9baf7b54676a7c376fa88c457b51d64`
- Core staging version: `94fbdc04-59f0-47bc-9d28-389e058b2a8f` at 100%
- Core staging D1: `pino-core-staging` / `a1eb92f1-66b8-4f03-a01b-73dfec1480f4`
- Core schema head: `0050_pinoria_wish_content_configuration.sql`
- Team source: `3ac5e76458392b89a176b38d1731afcbaf5781a6`
- Team staging version: `1bff0097-c102-41e6-937e-9f2c197dfee1` at 100%
- Team staging worker: `pino-team-os-staging`
- All six Team private Core bindings resolve to `pino-core-staging`.

## Canonical staging data

- Center: `019d1000-0001-7000-8000-000000000001` — PINO House · Pinoria Staging
- Learner: `019d1000-0002-7000-8000-000000000002` — Mori Staging
- OPEN Visit: `01a04d46-ce21-7bac-8eb4-13bbb452aeb2`
- Staff identity is CENTER-scoped through role `pinoria-staging-operator`.

## Zero-seed BO content

Wish content was created through Founder/BO commands, not manual SQL:

- Bearer: `01a04dc5-c149-708d-bea9-8326fd06fb3f`
- Set: `01a04dc5-c906-78ed-8ce6-c830252d9dbf`
- Three signature Mythic wearables created and activated through BO.
- Off-banner Mythic, Rare, Common, and Variant created and activated through BO.
- Banner: `01a04dc5-d7ad-7127-96e0-16244c653c35`
- Banner lifecycle: DRAFT → validation PASS → SCHEDULED → ACTIVE.
- Published definition hash: `58510b7cd95202e38f47f90e54959a389a6540a8d4c4bd258437e573cd0cbb53`
- Frozen TV experience: `profileKey=wish-reveal-v1`, `themeKey=aerin-sky`, `vfxProfileKey=sky-memory-v1`.

## Draw and TV evidence

### Gieo ×1

- Draw: `01a04dc7-e9de-77da-a957-ed33f4b6a022`
- Reveal: `01a04dc7-e9de-7cd1-b9d4-ce8c908ff811`
- Energy Seed: `14 → 13`
- TV reconnect returned the same reveal ID before completion.
- TV projection matched the persisted draw/banner and frozen BO experience.

### Gieo ×5

- Draw: `01a04dc8-5b29-767a-ba3d-a33d07477c74`
- Reveal: `01a04dc8-5b29-77b6-a1bc-086ae4a6c3f9`
- Energy Seed: `13 → 8`
- History persisted exactly 5 pulls; pull 4 satisfied the Rare guarantee.
- TV reconnect returned the same reveal ID before completion.
- Final TV claim returned `null` after completion.

## Final checks

- `/bo/pinoria-wish` → HTTP 200.
- `/pinoria-tv` → HTTP 200.
- TOS history shows the ×1 and ×5 draws against the zero-seed banner.
- The active staging banner is the BO-created zero-seed banner.
- No manual SQL was used to create Wish Bearer/Set/Wearable/Variant/Banner content or to create draw/reveal outcomes.
