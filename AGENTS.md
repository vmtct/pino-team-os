# PINO Team OS — AI Working Contract

`pino-team-os` is the current repository for the PINO Team staff platform. It may render both TOS and BO application surfaces, but it does not become the canonical owner of shared PINO business rules merely because it renders or operates them.

## Read order for material behavior

Before changing material business behavior, protected data flow, or a Core-owned capability:

1. read this repository's `docs/architecture.md`, `PROJECT.md`, and relevant local data/source/tests;
2. resolve the canonical Core `featureCode` + `featureId` in `pino-core/docs/features/feature-registry.json`;
3. read `pino-core/docs/feature-governance.md` and `pino-core/docs/platform-foundations.md`;
4. read the registered feature spec and relevant accepted ADRs;
5. if the Core registry says `READY_FOR_IMPLEMENTATION`, read and obey the registered handoff before runtime integration;
6. when protected staff behavior is involved, read the approved Access Control spec/greenfield bootstrap/handoff in Core;
7. for any staff UI work, read `docs/tos-adaptive-workspace-doctrine-v1.md` before choosing TOS/BO placement, navigation, mobile/desktop composition, or shell usage.

If the required Core governance/spec material is unavailable, stop before inventing material business behavior and report the missing dependency.
## Mandatory continuation entry gate

Conversation history is non-authoritative delivery memory. For terse continuation instructions such as `continue`, `tiếp tục`, `triển`, `ok triển`, `finish`, or equivalent, do not resume from remembered chat state.

Run `npm run pino:resume -- --core <current-pino-core-worktree>` (or set `PINO_CORE_PATH`) before material edits; `delivery:enter` remains a compatibility alias. The Core gate must resolve `featureCode` + `featureId`, inspect this Team worktree against current `main`, and classify Drift Protocol state before resuming the first unproven gate.

Obey the result: `NONE` continues; `SAFE` continues without a forced sync; `CONTRACT` is reconciled by the coding agent in the same work session and the gate is rerun; `DESTRUCTIVE` or genuinely ambiguous state requires human review. Do not ask the Founder to reconcile merely because `main` advanced. If Core governance is unavailable or feature resolution is ambiguous, fail closed.

For implementation/builder work, the terminal state is `DEV_HANDOFF_READY`: implementation complete, local verification complete, immutable candidate pushed, and exact-head CI requested/proven. Stop there. Authoritative PRE-MAIN audit, final current-main reconcile, `MERGE_READY`, and merge execution are owned downstream by Core `PLT-MERGE`.

### Cross-Project slice care

Material Team work must identify the coordinating ChatGPT Project with one canonical Project Code: `PRJ-TPP`, `PRJ-PSP`, `PRJ-PNR`, `PRJ-WFM`, or `PRJ-PLT`. Pass it through `--project` or `PINO_PROJECT_CODE`.

Before material edits, Core PLT-CARE must report the current owner transparently. Unclaimed work requires a claim. Fresh foreign care blocks duplicate material edits and must surface owner, branch, PR, and freshness. Stale care requires explicit reclaim. Fresh foreign transfer requires explicit Founder approval plus a reason.

Care ownership is coordination metadata only; it never authorizes staging or production.

## Feature readiness is implementation authority

- `READY_FOR_IMPLEMENTATION` — implementation may proceed against the registered approved spec/handoff.
- `READY_WITH_PREREQUISITES` — prototype/review may continue, but blocked runtime integration waits for named prerequisites.
- `PROPOSAL_ONLY` — prototype/product exploration only; do not turn mock logic into canonical backend behavior.
- `RECONSTRUCTED_ONLY` — current-state evidence only; not future implementation authority.

A local prototype, merged UI branch, or working mock is not an approval source.

Product decisions discovered while prototyping must be reconciled into the canonical Core feature spec before canonical runtime implementation.

## Core ownership boundary

- For Core-owned domains, use explicit private Core contracts; do not query Core D1 directly.
- Do not duplicate Core-owned identity, membership, access, booking, attendance, capacity, catalog, delivery, policy, or other shared invariants inside this repository for convenience.
- Notion may remain authority only for explicitly unmigrated domains; never assume Notion or D1 is globally authoritative.
- Do not import another module/repository's persistence adapter as an application API.
- When a domain migrates to Core, update app architecture/data docs in the same delivery window.

## Access-control discipline

Any TOS or BO feature that reads non-public data or performs a privileged action requires the canonical Access Control contract.

- Deny by default.
- Authorize server-side by stable permission + canonical scope + contextual policy; never by job title, route, client state, hard-coded role, email allowlist, Cloudflare Access group, or surface switcher state.
- UI visibility is not authorization.
- Authentication resolves an external identity to canonical User; Core remains authorization authority.
- User and StaffMember are distinct even when linked.
- Do not invent ad-hoc permission strings or surface applicability in components/routes.
- Canonical permissions declare `TOS | BO | BOTH` applicability in Core.
- TOS surface entry is derived from ACTIVE StaffMember-linked operational authority; do not invent `team.tos.access`.
- BO surface entry requires effective explicit `team.bo.access`; this permission grants surface entry only and never implies feature permissions.
- Privileged mutations emit the audit events required by the Core spec.
- Never expose Founder/private Core control-plane operations through a public application contract.

When the Core feature registry or Access handoff says a prerequisite is not ready, do not add a temporary privileged bypass.

## PINO Team presentation contract

PINO Team is one platform with two distinct application surfaces:

- `TOS` — Team Ops, target host `tos.pinohouse.art`, mobile-first physical-work execution.
- `BO` — Back Office, target host `bo.pinohouse.art`, desktop-first management/configuration/control-plane work.

These hostnames are target architecture, not permission authority or production-DNS authorization. TOS and BO may initially share this repository/deployment, but they must keep separate navigation/composition boundaries.

Reusable shell primitives live in `app/components/tos-shell/`. New implementation branches should compose `TosShell` or `BoShell` from current `main`; do not copy an old prototype shell wholesale.

Before implementing any staff UI feature, explicitly record this decision in implementation notes, PR body, feature handoff, or equivalent review evidence:

```yaml
Team Surface Decision

surface: TOS | BO | DUAL
primary_device: MOBILE | DESKTOP

tos:
  app_family: CA_LAM | LOP_HOC | VIEC | PINORIA | NONE
  entry_context:
  footer_items: []   # maximum 5
  theme:
  primary_action:
  capture_requirements:

bo:
  sidebar_group:
  subnavigation:
  primary_layout: QUEUE | TABLE | SPLIT_VIEW | FORM | TIMELINE | CANVAS | NONE

shared:
  permission_context:
  cross_domain_links:

founder_layout_review: APPROVED | PENDING
```

Hard presentation rules:

- TOS Home is the neutral launcher/today-awareness surface.
- Approved TOS app families are `Ca làm`, `Lớp học`, `Việc`, and `Pinoria` unless Founder approves another.
- Entering a TOS app replaces Home navigation with contextual footer navigation of at most five items.
- Feature-level TOS footer is filled with the app theme color; Home footer remains neutral.
- App header carries title on the left and Home on the right; Back is for deeper detail only.
- `Lớp học` mentor/student views are pedagogy-only: attendance may appear as read-only fact, but learner Check-in/out actions and Pinoria actions must not be embedded there.
- BO uses grouped desktop sidebar IA and may use dense table/queue/split-view/form patterns.
- DUAL features require distinct mobile TOS and desktop BO compositions rather than a shrunken desktop page.
- TOS must not import BO page-level navigation/compositions, and BO must not import TOS page-level navigation/compositions. Shared code should stay domain-neutral.

A feature may inherit an already-approved slot without a new Founder decision. Stop for Founder layout review if changing global TOS app families, TOS footer architecture, theme families, the max-five rule, the pedagogy/Pinoria boundary, the BO grouped-sidebar model, or the logical split between TOS and BO.

`founder_layout_review: PENDING` permits prototype exploration only; it does not authorize a new final navigation architecture.

## Prototype discipline

A Founder prototype may contain mock data and interaction-only state when clearly labeled.

Prototype code must not become architecture by accident:

```text
prototype finding
  -> canonical Core spec update
  -> Founder approval when behavior changed
  -> technical readiness/handoff
  -> runtime implementation
```

Do not make backend/schema/API design decisions solely because they are convenient for the prototype component tree.

## Change discipline

For a material cross-repository feature:

1. identify the Core `featureCode` + `featureId` in the PR/implementation notes;
2. verify registry readiness before runtime work;
3. preserve F1–F7 decisions from the canonical spec;
4. keep UI adaptation separate from canonical business semantics;
5. include the `Team Surface Decision` when the feature touches TOS or BO UI;
6. compose the approved surface shell instead of inventing parallel navigation;
7. add/update app-boundary tests;
8. surface any spec/code/layout mismatch instead of silently choosing one side;
9. hand off at `DEV_HANDOFF_READY`; Core `PLT-MERGE` owns current-main reconcile, exact candidate CI, authoritative independent PRE-MAIN review, freshness, and `MERGE_READY`.

Before approving a material staff UI PR, independently verify:

- correct `TOS | BO | DUAL` placement;
- correct TOS app family / BO sidebar group;
- no unauthorized shell/navigation invention;
- TOS footer maximum five items;
- app theme/orientation preserved;
- pedagogy/domain boundaries preserved;
- surface entry and feature visibility derive from canonical Access Control, not UI-local assumptions.

## Codex hard limit

Codex is permitted only as the fresh independent PRE-MAIN reviewer launched by the canonical Core audit runner. GPT owns implementation, bug/audit-finding fixes, reconcile/restack/rebase, conflict resolution, evidence repair, merge orchestration, and release preparation. Do not invoke Codex for any of those non-audit activities.

Production deployment remains an explicit release action. A green build or merged PR does not itself authorize production.
