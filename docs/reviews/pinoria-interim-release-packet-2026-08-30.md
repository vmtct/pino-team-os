# Pinoria interim staging release packet — 2026-08-30

Status: staging artifact ready for governed Team integration. Production rollout is BLOCKED until pino-core production reaches the current governed main SHA.

## Scope

This packet contains only work that can progress independently of a new Core production release:

1. Pinoria TOS UI for canonical Companion and Wish progress.
2. Guarded staging synthetic E2E runner.
3. BO seasonal Wish release preflight/presets.
4. Evidence and exact post-Core-ready release sequence.

No new pino-core schema, canonical rule, migration, or production data mutation is introduced here.

## Team artifact

Branch: `feat/pinoria-interim-ui-e2e`
Base staging integration branch: `feat/pinoria-staging-tv-wish-v1`

Primary commits:
- `6feab32` — `feat(pinoria): surface companion and wish progress`
- `a630223` — `test(pinoria): add guarded staging synthetic runner`
- `9578a08` — `feat(pinoria): add seasonal Wish release preflight`

Release-policy documentation included:
- `8094b0b` — Wish banner release policy
- `6d98a1f` — Companion banner authority
- `b78a0aa` — dual banners use one economy
- `b1f5471` — release-phase authority boundary
## Validation

Latest local validation after BO preflight changes:
- `npm run typecheck` — PASS.
- `npm test` — PASS, 141/141 tests.
- `npm run build` — PASS.
- Build warnings are existing autoprefixer and `<img>` optimization warnings; no build error.

The interim runner lives at `scripts/pinoria-staging-synthetic-e2e.mjs`.
Default read-only verification:

```bash
node scripts/pinoria-staging-synthetic-e2e.mjs companion-verify
```

Mutating modes fail closed unless an explicit staging confirmation environment variable is present:
- Companion: `PINORIA_MUTATION_CONFIRM=STAGING_COMPANION_ADVANCE`
- Wish: `PINORIA_MUTATION_CONFIRM=STAGING_WISH_DRAW_ONE`

## Companion live staging evidence

Synthetic learner: `019d1000-0002-7000-8000-000000000002`
Mori: `01a04ff6-f715-7d4c-8710-2403b60f8a51`

Closed proof:
- Fruit ×2 granted from two canonical Classroom Diaries; both grants replay-safe.
- Feed ×2; each feed replay-safe.
- Feed #2 reached `READY_FOR_RITUAL / FEED_2`.
- Ritual materialization event: `01a0522b-e0ef-76d3-87fe-2cd8153f07b2`.
- Ritual presentation: `01a0522b-e0ef-7986-b8f2-3060d5eff088`.
- Ritual execute replay returned the same materialization event and presentation.
- Authoritative final Mori state: Lv2 / `GROWING` / feed 0 / Fruit 0 / no Water Sigil.
- TV claimed the exact `COMPANION_RITUAL` presentation twice with the same claimed presentation.
- TV complete replay returned the same completion timestamp.
- Final unified TV presentation claim returned `null`.
- Read-only synthetic verification re-confirmed Mori Lv2 and an empty TV queue.

## Wish live staging evidence

Active banner: `01a050fb-0dab-7dfd-9491-e5723aaffff3`
Rules Version: `pinoria-wish-economy-e2e-20260830-1121`
Definition hash: `214b58254ef5f6b026c9812120df70ced12de64548734e49d9b84d8072ad47f8`

Guarded `wish-one` synthetic PASS:
- Draw: `01a05251-df57-7725-bfd9-777dd1d7fa0a`.
- Energy Seed: 1 → 0 exactly once; replay did not double-spend.
- Pre-draw Rare pity: P5/5.
- Result: `RARE`, source `RARE_POOL`; hard Rare pity therefore satisfied.
- Post-draw Rare pity reset to P1/5; Mythic advanced to P6/16.
- Canonical history contains the exact draw and one pull.
- TV presentation: `01a05251-df57-7571-b7f4-737eb5320951`.
- TV re-claim returned the same presentation; complete replay was stable; final queue returned `null`.

The current synthetic learner now has zero Energy Seeds. A future mutating Wish smoke must first receive a fresh governed staging Seed fixture; do not silently mint or bypass the economy.

## Seasonal BO readiness

The BO release planner is preflight only, not a replacement for future canonical `WishReleasePhase` enforcement.
Current BO preflight encodes:
- Phase A: Mid-Autumn Female + Mid-Autumn Male, maximum two concurrent `LIMITED_WARDROBE` featured slots.
- Overlapping featured banners must select the same published Economy Rule Version.
- Companion remains a separate Egg/Hatch/Ritual acquisition lane and does not consume Wearable pity.
- Autumn is a Phase B preset and should rotate in after Mid-Autumn spotlight.
- Banner eligibility is sex-neutral; no learner-sex filter is added.

Current staging catalog does **not** yet contain real Mid-Autumn Bearer/Set/Wearable catalog objects. Therefore the planner is CONFIG READY, while Mid-Autumn content/asset materialization remains PENDING. No fake production-like banner was published.

## Production Core gate

Re-checked from GitHub on 2026-08-30:
- Current governed `pino-core/main`: `b056c09c4882d08b3710f6e024ddd444f63bc140`.
- Latest proven successful Core production release source: `e896d8f5bc159091dd41120610a9f48097734330`.
- Production Worker version: `011ad79c-3fee-48eb-84cc-50f8052a013b`, 100% traffic.

Conclusion: **PRODUCTION BLOCKED** because production Core is behind governed main.
This packet does not authorize Core production release, Team production deploy, migration, or production application-data mutation.

## When Core becomes ready

1. Verify the successful Core production release source equals the then-current governed `main` SHA.
2. Verify Core runtime ingress/bindings and the relevant Pinoria private contracts without mutating learner state.
3. Promote the exact reviewed Team artifact through the governed Team release path.
4. Run `companion-verify` against staging/target environment and require Mori state + TV queue assertions to pass.
5. For a mutating Wish smoke, first materialize a governed Energy Seed fixture; bind expected Rule Version/hash before drawing.
6. Re-run TV claim/reconnect/complete checks and require final unified presentation queue to be empty.
7. Only then mark the Pinoria slice production-ready.

Production remains untouched by all evidence in this packet.
