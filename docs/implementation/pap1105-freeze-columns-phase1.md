# PAP-1105 — BO Shared Views freeze roundtrip

PAP-1105 / Epic PAP-1067. STOP_BEFORE_MERGE; preserve Draft PR #957.

## Reconciliation update — 2026-11-01

This is implementation evidence, not a SOP or merge/deployment authorization. Draft #957 is being deliberately reconciled with Team main 5ab59543ebbec69bf0ff33b444e09f5f5cc385fe in a separate allocator worktree. The historical receipt below is retained for context; its old staging/acceptance status is superseded by this update. Core source was re-read at2338f83cb0dd48d3554d9bdeeab0470fa68d19f8: PLT-BO / bo-operational-read-plane, approved Freeze supplement and handoff v8. No Core/API/ACL change is made. Live persisted Freeze acceptance remains pending.

Current metadata absent/null/string and CAS behavior from PR #1081 is retained. Record ID is not a valid freeze boundary, consistent with Core. Shared renderer adoption replaces its prior unsupported-renderer quarantine only for valid authorized boundaries; hidden/unknown/Identity/record-ID targets remain rejected. Reconciliation preserves newer Action Host and Founder-exception gates. Browser regression first reproduced Escape losing focus, then adds menu focus restoration, keyboard navigation/trap and measured geometry. Screenshots are candidates, not approved goldens. Existing G3 baselines and thresholds remain unchanged; any intended pixel change requires its own visual decision. No merge or Founder visual acceptance is claimed.

## Historical reconciliation and contract

Normal merge of `origin/main` at `5789815e11d1400db83f708a1da654a0797bd5c5` into the isolated PR-derived branch; no conflicts. PAP-1070 adapters and PAP-1071 G0/G1 ownership are now merged dependencies. No module adoption, inventory, migrations, navigation, shell or CSS source changes.

Core Shared Views contract PR #1875 merged at `2e4a9a16586f4f3880ae52d74dbc6327d9f0cf97`. Its staging deployment is unverified: Team merge/CD and live staging tests remain blocked on that external dependency. Core feature ownership remains PAP-886/887 Shared Views; this slice only translates the supplied approved `columns.frozenThrough` contract. No new domain semantics or permission strings.

## Implemented

- Optional `BoViewConfig.columns.frozenThrough?: string | null`: validation rejects unknown, hidden, unordered and malformed targets. Absent stays absent; explicit null clears; string freezes through a visible field.
- BO authorized shared adapter translates `TableQuery.frozenThrough` in both directions. Typed validation also rejects Identity, unsupported schema fields and unauthorized context on application/write. Incompatible saved views remain unavailable.
- State snapshots, create/update, rename/reorder, queue copies, HTTP validation/serialization and legacy UI bridge preserve all three states.
- Only the BO organization-shared adapter advertises freeze persistence. HO/personal endpoints remain unavailable and arbitrary transports retain the persistence guard. Local UI views remain session-only.
- Selecting a Saved View replaces its snapshot, preventing an absent legacy boundary from inheriting another view's freeze. All/reset explicitly clear; built-in defaults remain independent.
- Existing Quick View/Identity sticky behavior, measured width fallback and accessibility controls remain in place. Both BO/HO authority generators use the existing shared freeze CSS.

## Team Surface Decision

```yaml
surface: DUAL
primary_device: DESKTOP
tos:
  app_family: NONE
  entry_context: none
  footer_items: []
  theme: unchanged
  primary_action: none
  capture_requirements: none
bo:
  sidebar_group: existing module placement
  subnavigation: existing Quick Views
  primary_layout: TABLE
shared:
  permission_context: existing canonical BO module read and shared-view manage grants; HO has no persistent Views endpoint
  cross_domain_links: unchanged
founder_layout_review: APPROVED
```

DUAL here retains the existing BO/HO desktop Table placement; no TOS composition changes or new layout decision.

## Verification boundary

Focused unit cases cover absent/null/string across state, queue, client, adapter and UI bridge; fake Core/BFF tests cover persisted create/list/update/reload, legacy PATCH omission retention, explicit-null clearing, CAS 409 without retry and ACL rejection. These are deterministic tests, not live Staging evidence.

G3 browser measurement at 1440/1024/768/390/320 and authenticated G4 staging ACL/isolation/roundtrip remain external acceptance work. No browser/integrated E2E, Team merge/CD or Production action in this execution. Story remains open. No legacy Indie review gate is required.
