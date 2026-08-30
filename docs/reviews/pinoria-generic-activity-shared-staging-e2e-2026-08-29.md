# Pinoria Generic Activity shared staging E2E — 2026-08-29

## Runtime provenance

- Core source: `c41b7419cdef4d4076c04eb0d7f32ab2707300d4`
- Core staging version: `b99de6a7-50d1-4eca-8860-bec27a28e2d1` at 100%
- Core staging schema head: `0051_pinoria_activity_runtime.sql`
- Team source: `e2d355ed00c655420c4545237eab88e70a0f0ce4`
- Team staging version: `39c1eca7-12a2-4af7-a773-d665cd4c5569` at 100%

## Canonical context

- Center: `019d1000-0001-7000-8000-000000000001`
- Learner: `019d1000-0002-7000-8000-000000000002` — Mori Staging
- Existing BO-created Wish banner remained the authoritative Wish configuration.
- Generic Activity definitions were empty before this test.

## Activity lifecycle

- Activity: `01a04e09-2dcc-7df0-ae97-d11bb5f337e0`
- Handler: `WISH_DRAW`
- Lifecycle: DRAFT → validation PASS → SCHEDULED → ACTIVE.
- Definition hash: `646fdabad8b76b8e035e94207df36909b6bd8ead295ff7dfd1a439ca8f2fad1e`.
- Presentation profile: `wish-reveal-v1`.
## Generic execute and TV evidence

- Energy Seed before: `8`.
- Generic `DRAW_ONE` draw: `01a04e09-3361-78cd-a96a-561d84e0f157`.
- Reveal: `01a04e09-3361-7b2d-b159-953221195518`.
- Banner resolved by Core: `01a04dc5-d7ad-7127-96e0-16244c653c35`.
- Energy Seed after: `7`.
- Replaying the exact command with the same idempotency key returned the same draw ID and did not spend another Seed.
- TV claim returned the persisted generic-dispatch draw.
- TV reconnect returned the same reveal ID.
- Complete succeeded; a subsequent claim returned `null`.
- TOS Available Activities refreshed with balance `7` and remained eligible.

## Result

BO Activity Definition → Core Available Activities → generic TOS execute → existing Wish engine → immutable TV reveal is proven end-to-end on shared staging.
No production deployment, migration, or data mutation was performed by this slice.
