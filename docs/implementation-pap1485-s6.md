# PAP-1485 partial implementation

Epic PAP-1097 / PNR-WARD / pinoria-wardrobe-loadout / Story PAP-1123 S6.

Team Surface Decision:
```yaml
surface: BO
primary_device: DESKTOP
tos:
  app_family: NONE
  entry_context: none
  footer_items: []
  theme: none
  primary_action: none
  capture_requirements: none
bo:
  sidebar_group: Pinoria
  subnavigation: existing Self Full Detail Loadout tab
  primary_layout: FORM
shared:
  permission_context: Core BO entry plus pinoria.self.loadout.view/manage and explicit Center
  cross_domain_links: existing Self navigation
founder_layout_review: APPROVED
```

Visual approval inherited from PAP-1312 comment 19992 as explicitly supplied in the assignment. No new shell, CSS, Quick View stage or canonical prototype changes. Live i5 source freshness and two-axis G3 parity NOT_VERIFIED in this session.

Gateway extends the existing BO credential handler and router predicate, with a BO Staging host fence. Core owns authorization, eligibility, ownership, audit and CAS. Exact Set write bodies require Set version >=0, Self version >=1, reason and idempotency key. GET never dispatches a command.

UI reads persisted Set state and Core-owned fully eligible published Set options directly from the same authorized GET. The Set-first selector offers only exact Core-projected owned choices, not fabricated catalog options; ApplySet and ClearSet use both Set/Self CAS, command idempotency and GET readback. Conflicts retain snapshot, selection and reason until explicit discard/reload. Active Set suppresses base preview; no Set media request is fabricated. Eight-slot SaveSlots body is unchanged.

## Missing Core contracts

Existing implemented paths are GET pinoria/selfs/:id/set and POST pinoria/selfs/:id/set/apply and /clear. Next BE work must publish exact registered route names and typed contracts for:

- optional missing-owned-member explanation for Sets not eligible; Core GET now exposes only currently fully owned published `eligibleSets` choices, so no unowned Set can be selected;
- authorized per-member media for the frozen active Set revision, with entitlement and Center checks, plus composition metadata sufficient for the approved opaque full-frame highest layer;
- atomic first-Starter grant-and-activate command with permissions, CAS, idempotency and audit. Current starterAvailable is false.

These three endpoint names are NOT yet defined by Core; assigning guessed URLs would violate the assignment. No placeholder endpoints were added.

## Validation and delivery limits

Node v24: `node --test scripts/pap1485-self-set.test.mjs` passed 7/7 (gateway execution with credential/Core IO doubles and static UI assertions). Covers exact read/write forwarding, Center/body/method/content-type/key rejection, 400/403/404/409 passthrough and credential/PII exclusion from forwarded payloads. This is not authenticated E2E or an ACL proof. `git diff --check` passed at that checkpoint.

Final small readiness-label correction followed that checkpoint. Final rerun/extra host and UI interaction tests could not start: command runner failed with disk-full os error 112. No commit was made because final verification is incomplete.

NOT_RUN: existing tsx tests, lint, typecheck, build, authenticated FE/Core E2E, five-width visual parity. node_modules/tsx is absent; no npm ci was attempted. No browser/E2E tabs were opened. Initial branch was clean at 4790b4ae, matching local origin/main; remote current-main verification failed because GitHub was unreachable. No push, merge, deploy, Core source, prototype, D1/R2 or Production mutation.
