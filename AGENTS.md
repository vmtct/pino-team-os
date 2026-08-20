# PINO Team OS — AI Working Contract

`pino-team-os` is an internal application surface. It does not become the canonical owner of shared PINO business rules merely because it renders or operates them.

## Read order for material behavior

Before changing material business behavior, protected data flow, or a Core-owned capability:

1. read this repository's `docs/architecture.md`, `PROJECT.md`, and relevant local data/source/tests;
2. resolve the canonical Core `featureId` in `pino-core/docs/features/feature-registry.json`;
3. read `pino-core/docs/feature-governance.md` and `pino-core/docs/platform-foundations.md`;
4. read the registered feature spec and relevant accepted ADRs;
5. if the Core registry says `READY_FOR_CODEX`, read and obey the registered handoff before runtime integration;
6. when protected TOS behavior is involved, read the approved Access Control spec/greenfield bootstrap/handoff in Core;
7. for any TOS UI work, read `docs/tos-adaptive-workspace-doctrine-v1.md` before choosing navigation, mobile/desktop composition, or shell placement.

If the required Core governance/spec material is unavailable, stop before inventing material business behavior and report the missing dependency.

## Feature readiness is implementation authority

- `READY_FOR_CODEX` — implementation may proceed against the registered approved spec/handoff.
- `READY_WITH_PREREQUISITES` — prototype/review may continue, but blocked runtime integration waits for named prerequisites.
- `PROPOSAL_ONLY` — prototype/product exploration only; do not turn mock logic into canonical backend behavior.
- `RECONSTRUCTED_ONLY` — current-state evidence only; not future implementation authority.

A local prototype, merged UI branch, or working mock is not an approval source.

Product decisions discovered while prototyping must be reconciled into the canonical Core feature spec before canonical runtime implementation.

## Core ownership boundary

- For Core-owned domains, use explicit private Core contracts; do not query Core D1 directly.
- Do not duplicate Core-owned identity, membership, access, booking, attendance, capacity, catalog, delivery, policy, or other shared invariants inside TOS for convenience.
- Notion may remain authority only for explicitly unmigrated domains; never assume Notion or D1 is globally authoritative.
- Do not import another module/repository's persistence adapter as an application API.
- When a domain migrates to Core, update app architecture/data docs in the same delivery window.

## Access-control discipline

Any TOS feature that reads non-public data or performs a privileged action requires the canonical Access Control contract.

- Deny by default.
- Authorize server-side by stable permission + canonical scope + contextual policy; never by job title, route, client state, hard-coded role, email allowlist, or Cloudflare Access group.
- UI visibility is not authorization.
- Authentication resolves an external identity to canonical User; Core remains authorization authority.
- User and StaffMember are distinct even when linked.
- Do not invent ad-hoc permission strings in components/routes.
- Privileged mutations emit the audit events required by the Core spec.
- Never expose Founder/private Core control-plane operations through a public application contract.

When the Core feature registry or Access handoff says a prerequisite is not ready, do not add a temporary privileged bypass.

## TOS Adaptive Workspace presentation contract

TOS has one product with two presentation workspaces:

- `OPS` — mobile-first physical-work execution.
- `BO` — desktop-first management/configuration/control-plane work.

`OPS` / `BO` are presentation choices, not authorization roles.

Reusable shell primitives live in `app/components/tos-shell/`. New implementation branches should compose them from current `main`; do not copy an old prototype shell wholesale.

Before implementing any TOS UI feature, explicitly record this decision in implementation notes, PR body, feature handoff, or equivalent review evidence:

```yaml
TOS Layout Decision

workspace: OPS | BO | DUAL
primary_device: MOBILE | DESKTOP

ops:
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

- OPS Home is the neutral launcher/today-awareness surface.
- Approved Ops app families are `Ca làm`, `Lớp học`, `Việc`, and `Pinoria` unless Founder approves another.
- Entering an Ops app replaces Home navigation with contextual footer navigation of at most five items.
- Feature-level Ops footer is filled with the app theme color; Home footer remains neutral.
- App header carries title on the left and Home on the right; Back is for deeper detail only.
- `Lớp học` mentor/student views are pedagogy-only: attendance may appear as read-only fact, but learner Check-in/out actions and Pinoria actions must not be embedded there.
- BO uses grouped desktop sidebar IA and may use dense table/queue/split-view/form patterns.
- DUAL features require distinct mobile Ops and desktop BO compositions rather than a shrunken desktop page.

A feature may inherit an already-approved slot without a new Founder decision. Stop for Founder layout review if changing global Ops app families, global footer architecture, theme families, the max-five rule, the pedagogy/Pinoria boundary, or the BO grouped-sidebar model.

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

1. identify the Core `featureId` in the PR/implementation notes;
2. verify registry readiness before runtime work;
3. preserve F1–F7 decisions from the canonical spec;
4. keep UI adaptation separate from canonical business semantics;
5. include the `TOS Layout Decision` when the feature touches TOS UI;
6. compose the approved TOS shell instead of inventing parallel navigation;
7. add/update TOS tests for the app boundary;
8. surface any spec/code/layout mismatch instead of silently choosing one side;
9. require independent spec ↔ Core/app code ↔ tests review before staging/production readiness.

Before approving a material TOS UI PR, independently verify:

- correct `OPS | BO | DUAL` placement;
- correct app family/sidebar group;
- no unauthorized shell/navigation invention;
- Ops footer maximum five items;
- app theme/orientation preserved;
- pedagogy/domain boundaries preserved.

Production deployment remains an explicit release action. A green build or merged PR does not itself authorize production.
