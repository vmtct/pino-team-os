# Pinoria prototype scene authority audit — 2026-08-30

## Audit baseline

Prototype source of record reviewed here:

- repo: `vmtct/pino-team-os`
- branch: `feat/pinoria-piano-teacher-review`
- commit: `b80d44cf9047f8634602c6c2a771bdc6f5e8a9e5`

Canonical Core baseline:

- repo: `vmtct/pino-core`
- `main`: `d252e575d3e45d82286d6e1c22c4b3073fb5e398`
- generic Pinoria Activity runtime: merged
- Egg Hatch runtime + unified TV FIFO: merged
- Egg Hatch staging E2E: PASS; see `docs/staging-evidence/pinoria-egg-hatch-2026-08-30.md`
- Companion materialization/ritual: draft PR #304, not canonical yet

## Classification

- `READY_AUTHORITY`: canonical Core mutation/read model exists; prototype UI can be wired to it without inventing business truth.
- `BRIDGE_MISSING`: canonical source truth exists, but there is no production Pinoria presentation bridge/event yet.
- `PRESENTATION_ONLY`: scene should never own business truth; it only renders an approved projection/event.
- `PARTIAL_AUTHORITY`: part of the scene can use Core now, but another visible state still depends on prototype-only truth.
- `IN_PROGRESS_CORE`: bounded Core authority is being implemented but is not merged/staged yet.
- `BLOCKED_AUTHORITY`: scene visibly implies durable state or mutation for which no canonical authority exists yet.
- `PROTOTYPE_FAKE_AUTHORITY`: prototype code currently mutates in-memory/session state; this is review harness behavior only and must not graduate to staging/prod authority.

## Scene coverage matrix

| Prototype scene / review | Visible intent | Canonical authority | Status | Required staging treatment |
|---|---|---|---|---|
| `arrival-scene` | Learner arrives; character enters House | Core `PinoriaHouseService` + canonical Student Visit/check-in | `READY_AUTHORITY` | Trigger from TOS/Core check-in outcome. TV only renders arrival event/projection. |
| `choice-scene` / `choice-to-ambient-scene` | Short post-arrival choice/transition | No durable truth required in current implementation | `PRESENTATION_ONLY` | Keep as choreography. If a future choice executes a business action, resolve it through TOS generic Available Activities rather than TV. |
| `ambient-house-scene` / ambient social simulation | Show learners currently in House, character, Companion, world atmosphere | Visit/presence + base Pinoria character are canonical; Companion ownership/hatch is canonical. Equipment and World State are not yet canonical | `PARTIAL_AUTHORITY` | Basic presence/character/owned Companion can stage. Do not surface durable equipment/world-state claims until those authorities exist. |
| `departure-scene` / departure transition | Learner leaves House | Core canonical Visit/check-out | `READY_AUTHORITY` | Trigger from committed check-out; TV is presentation only. |
| `energy-seed-scene` | Show Hạt Năng Lượng earned | Core has `pinoria_resource_wallets`, immutable resource ledger, and `EnergySeedLedgerService.grant()` with source-reference idempotency | `BRIDGE_MISSING` | Replace prototype activation store with Core grant result/outbox/presentation event. Do not add an Energy-Seed-specific TV mutation path. |
| `learning-spotlight-scene` | Celebrate an already-earned learning milestone/evidence | Learning/session/evidence truth belongs to canonical learning domains | `BRIDGE_MISSING` | Add a projection/event bridge from canonical learning milestone/evidence to Pinoria TV queue. No new Activity handler is needed merely to render the spotlight. |
| `world-broadcast-scene` | Subjectless House/Pinoria announcement | Broadcast content can be approved/configured, but TV itself owns no domain mutation | `PRESENTATION_ONLY` | Generalize unified TV presentation queue to approved subjectless broadcast events when a canonical producer/config source exists. |
| `lost-artifact-scene` as broadcast | Reveal a Lost Artifact story/world event | None required if it is purely a broadcast | `PRESENTATION_ONLY` | Safe only as narrative broadcast content. |
| Lost Artifact as learner-owned discovery/achievement | Artifact becomes durable learner collection/inventory | No canonical learner Artifact/Discovery ownership authority found | `BLOCKED_AUTHORITY` | Build discovery/collection authority before showing artifact as owned, earned, equipped, or progressed. Do not reuse prototype achievement arrays as truth. |
| `world-state-transition-scene` | Persistently change current region/chapter/season/ambient theme | No canonical Pinoria World State authority found | `BLOCKED_AUTHORITY` | Create canonical World State aggregate + governed mutation/event. Commit Core first, then enqueue transition. |
| `inventory-scene` wearable ownership | Show wearables learner owns | Wish Core already persists `pinoria_student_wearables` / variants | `READY_AUTHORITY` for Wish-owned wearables | Read canonical wardrobe ownership. Prototype `ownedAssetIds` must not remain source of truth. |
| `inventory-scene` equipment | Show which assets are actively equipped | No canonical equipped-slot state found | `BLOCKED_AUTHORITY` | Add canonical equipment loadout mutation/read model before staging equip actions or implying durable equipped state. |
| `inventory-scene` achievement/artifact slots | Show earned artifacts/badges and equipped achievements | No generic canonical Pinoria achievement/credential inventory authority found | `BLOCKED_AUTHORITY` | Define credential/achievement ownership separately from wearables. |
| `shop-scene` / `shop-relay` | Spend PLS, grant asset, equip purchased item | No canonical Pinoria Shop purchase/PLS/equipment transaction authority found | `PROTOTYPE_FAKE_AUTHORITY` + `BLOCKED_AUTHORITY` | Do not promote relay. Build atomic Core commerce transaction (balance check/debit, entitlement grant, optional equip) and TOS/learner-facing authorization as appropriate. |
| `ritual` in `tv-prototype` | Show current Companion form / ritual presentation | Ownership/hatch canonical; materialization progression/advance is draft PR #304 | `IN_PROGRESS_CORE` | Keep one generic `COMPANION_RITUAL` Activity handler in Core and reuse unified TV FIFO. TV never advances level. |
| `review/egg-water` | Egg Hatch visual | Egg/species/Activity/Hatch + unified TV FIFO are canonical and staging E2E proven | `READY_AUTHORITY` | Use as visual reference for canonical `EGG_HATCH` presentation profile. |
| `review/companion` | Companion visual/projection review | Companion ownership from hatch is canonical; progression beyond hatch is not yet canonical main | `PARTIAL_AUTHORITY` | Render owned Companion now; materialization level only after ritual authority merges. |
| `review/mori-sleep` | Mori sleep visual variant | No durable sleep-state domain is implied/required by current review | `PRESENTATION_ONLY` | Treat as asset/presentation variant unless product later defines Sleep as a real state machine. |
| `review/sigil` | Water Sigil visual | No canonical Water Sigil competency credential authority found | `BLOCKED_AUTHORITY` | Build non-consumable credential authority. It must be earned from canonical learning evidence/assessment, not granted by TV. |
| `review/secret-butterfly` | Inventory/secret visual asset review | No canonical acquisition source established for this reviewed asset | `PRESENTATION_ONLY` asset; ownership `BLOCKED_AUTHORITY` | Asset may remain UI reference. If it is a wearable, register it in canonical wearable catalog and grant only through an authoritative acquisition source. |
| `review/piano-teacher` / `piano-teacher2` | Inventory visual review for teacher-themed asset/character | No canonical acquisition source established | `PRESENTATION_ONLY` asset; ownership `BLOCKED_AUTHORITY` | Keep visual-only until product decides whether this is wearable, credential, lore collectible, etc.; then attach to the correct canonical domain instead of adding a TV handler. |

## Prototype routes that must never become staging authority

The following are useful UI/review harnesses, but their mutation semantics are explicitly non-canonical:

1. `app/api/pinoria-prototype/controller-command/route.ts`
   - currently commits prototype Energy Seed activation before relay;
   - currently commits prototype World State before relay;
   - forwards other review commands to prototype relays.
2. `app/api/pinoria-prototype/shop-relay/route.ts`
   - maintains PLS balance/session state;
   - grants owned assets;
   - mutates wearable/achievement equipment;
   - all through process-global prototype projection.
3. `lib/pinoria-prototype/energy-seed.ts`
   - process-global one-time reward activation store.
4. `lib/pinoria-prototype/character-projection.ts`
   - seeded/process-global `ownedAssetIds`, `earnedAchievementIds`, and equipment state.
5. `lib/pinoria-prototype/surface-session.ts`
   - prototype World State/session authority.
6. `app/api/pinoria-prototype/tv-relay/route.ts`
   - valid as a review playback harness only; production/staging presentation must converge on the Core unified presentation FIFO.

## Architecture conclusion

The prototype does **not** require one handler per scene. The correct split is:

### Generic Activity handlers — staff-triggered domain actions

- `WISH_DRAW` — canonical/merged.
- `EGG_HATCH` — canonical/merged + staging E2E PASS.
- `COMPANION_RITUAL` — correct next handler; draft PR #304.

Only add another Activity handler when there is a real, staff-triggered domain command with its own eligibility/commit semantics. Do not create handlers for Arrival animation, Learning Spotlight, Energy Seed animation, Broadcast, or World Transition simply because they are TV scenes.

### Canonical domain event -> unified TV presentation

Use this pattern for events that are consequences of canonical truth rather than staff-selected activities:

- check-in -> Arrival;
- check-out -> Departure;
- Energy Seed grant -> Energy Seed celebration;
- learning/evidence milestone -> Learning Spotlight;
- approved world/community content -> World Broadcast;
- canonical world-state mutation -> World State Transition.

### Read models only

- Ambient presence;
- Inventory ownership;
- current Companion state;
- current world state;
- current equipment loadout once canonical.

## Blocker priority after Egg Hatch

### P0 — Companion evolution/ritual foundation

Proceed with generic Activity architecture, not a TV-specific path. Existing draft PR #304 is directionally correct: Core commits progression before enqueueing `COMPANION_RITUAL` into the unified TV FIFO; TV replay/completion cannot mutate progression.

### P0.5 — readiness inputs required for real learner E2E

Do **not** fake readiness in TOS/TV. Before Companion ritual can be considered staging-complete for real operations, Core still needs authoritative inputs that can make a Companion `READY_FOR_RITUAL`:

- learner-owned Fruit stock + explicit Fruit grant/feed event targeted to a Companion instance;
- stage-scoped feed progress with no carry-over;
- Water Sigil as a non-consumable competency credential earned from canonical learning evidence/assessment;
- rule boundary remains hard: Lv1->Lv2 = 2 qualifying feeds; Lv2->Lv3 = 5 new qualifying feeds + Water Sigil; Lv3->Lv4 remains undefined and must stay blocked.

### P1 — presentation bridges

- Core Energy Seed grant -> unified TV presentation;
- Learning milestone/evidence -> unified TV presentation;
- Arrival/Departure -> unified TV presentation instead of prototype relay.

### P2 — larger missing domains

- canonical equipment/loadout;
- Pinoria Shop transaction + PLS authority;
- discovery/artifact ownership;
- canonical World State + governed transition producer.

## Gate

**Do not stage or promote any prototype route that mutates `lib/pinoria-prototype/*` state.** The prototype remains the visual/interaction reference. Core owns business truth; TOS executes authorized staff actions; BO configures published activities/content; Pinoria TV only reads projections and consumes/replays presentations.
