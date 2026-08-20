# PINO Team Surface Doctrine v1

Status: **FOUNDER APPROVED — PRESENTATION FOUNDATION**

This doctrine governs how staff-facing PINO Team features are composed. It is an app-local presentation contract. It does not define business authority, permission truth, domain lifecycle, or Core readiness.

## One platform, two application surfaces

PINO Team Platform has two distinct application surfaces:

- **TOS — Team Ops** at target host `tos.pinohouse.art`: mobile-first, for staff executing work in the house.
- **BO — Back Office** at target host `bo.pinohouse.art`: desktop-first, for management, configuration, review, planning, and control-plane work.

TOS and BO are not responsive modes of one page. Each owns its own navigation and visual grammar. They may initially live in one repository/deployment, but code and UX should remain logically separable so physical extraction remains possible later.

Surface placement is not authorization. Core Access Control remains the authority for whether a User may enter a surface and what they may do inside it.

Target hostnames are architecture intent only until an explicit release/configuration change creates production DNS/routing.

## Surface boundaries

- TOS does not use the BO persistent sidebar.
- BO does not use the TOS app-family/contextual-footer navigation.
- A User who may enter both surfaces switches through an account/app switcher, not through global feature navigation.
- Switcher visibility is UX only and must never substitute for the server-side surface gate.
- Shared code should be limited to domain-neutral primitives, authentication/session integration, Core clients, permission helpers, and common design tokens. TOS and BO feature compositions should not import each other's page-level UI.

## TOS mental model

TOS is organized around work context rather than raw entities:

```text
Tôi hôm nay
→ Ca của tôi
→ Lớp tôi đang làm
→ Học viên tôi đang phụ trách
→ Việc tôi cần xử lý
```

Do not shrink a desktop admin page into mobile and call it TOS.

### TOS Home

Home is a neutral launcher + today-awareness surface.

Approved app families:

1. **Ca làm** — shift check-in/out, own schedule, shift registration, timesheet/history/correction.
2. **Lớp học** — today's assigned classes, learners-in-class, lesson execution, journal, evidence, achievement.
3. **Việc** — attention inbox aggregating deep links to owning domains.
4. **Pinoria** — separate operational context for Reception / center-wide staff where authorized.

Global Home navigation may contain at most five items. Home footer remains visually neutral.

### TOS feature shell

Entering an app family changes the shell context:

- header shows feature/app title on the left;
- Home action is always available on the right;
- Back appears only for deeper detail;
- contextual footer replaces the Home footer;
- contextual footer contains **maximum five items**;
- the whole contextual footer is filled with the current app theme color so staff can immediately tell they are no longer on Home.

Approved presentation themes:

- Home — neutral PINO violet.
- Ca làm — blue.
- Lớp học — green.
- Việc — amber/orange.
- Pinoria — violet/fantasy.

Themes are orientation cues, not semantic status colors.

## Pedagogy boundary inside Lớp học

Mentor-facing `Lớp học` / learner views are pedagogy-only.

- Student attendance is displayed as **read-only fact** from the Reception/attendance-owning context.
- Mentor pedagogy views MUST NOT expose learner Check-in/Check-out actions.
- Mentor pedagogy views MUST NOT embed Pinoria actions or Pinoria operational attention.
- Primary work is lesson execution, classroom journal, evidence, assessment/achievement, and learning context.

Pinoria remains a separate TOS app family / operational context.

## BO mental model

BO is desktop-first and may use higher information density.

Preferred shell:

- persistent sidebar;
- grouped information architecture;
- wide content area;
- tables, queues, filters, split views, timelines, and multi-column forms are allowed where useful;
- no five-item navigation constraint.

Current grouping direction:

- Overview
- Operations
- Learning
- People
- Workforce
- Pinoria
- Content
- System

Only expose groups/routes that actually exist on the current implementation branch. Do not surface prototype routes merely because they appear in this doctrine.

Access Control, Policy Center, configuration, and Founder/system administration belong to BO rather than TOS unless a later Founder-approved contract says otherwise.

## DUAL features

A feature touching both physical staff execution and management/configuration is `DUAL`.

DUAL features MUST provide separate TOS and BO compositions. They must not reuse the same desktop composition unchanged on mobile.

Examples of current placement direction:

- Workforce → TOS `Ca làm` + BO `Workforce`.
- Journal / Evidence / Achievement → TOS `Lớp học` + BO `Learning` where management/review is needed.
- Pinoria → TOS `Pinoria` + BO `Pinoria`.
- Booking / Registration management → primarily BO `Operations`; never inject commercial queues into mentor pedagogy.
- Policy Center / Access Control → BO `System`.

## Access Control relationship

Presentation and authorization remain separate contracts.

- TOS entry is derived by Core from an ACTIVE User linked to an ACTIVE StaffMember plus at least one effective permission whose canonical surface applicability includes `TOS`, with usable scope/context. TOS does not require a manually granted `team.tos.access` permission.
- BO entry requires an effective explicit `team.bo.access` grant. That grant opens the BO surface only; it does not grant any BO feature action.
- Canonical permissions declare surface applicability as `TOS | BO | BOTH`. This metadata is owned by the permission registry, not by TOS/BO UI.
- Feature actions still require their own permission + scope + contextual authorization after the surface gate passes.
- BO may provide administration UI for roles/grants, but the existence of a checkbox, menu, or route in BO never defines permission truth.

## Mandatory Team Surface Decision

Before implementing a staff-facing UI feature, the implementation notes/spec/handoff must resolve:

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

## Founder review gate

A feature may inherit an already-approved shell slot without a new Founder UI decision when it preserves this doctrine.

Return to Founder before final navigation architecture when a proposal would:

- add or remove a global TOS app family;
- change global TOS footer architecture;
- exceed five contextual footer items;
- create a new theme family;
- move a feature between TOS and BO in a materially different way;
- put learner Check-in/out inside mentor pedagogy;
- mix Pinoria into pedagogy views;
- replace the BO grouped-sidebar model;
- collapse TOS and BO back into one workspace/navigation system;
- otherwise contradict an approved Team Surface Decision.

When `founder_layout_review: PENDING`, prototype work may continue, but final navigation architecture is not implementation authority.

## Prototype → implementation rule

Prototype code is evidence, not foundation authority by itself.

The approved reusable shell primitives live under:

```text
app/components/tos-shell/
```

Feature implementation branches should start from current Team OS main and compose the appropriate `TosShell` or `BoShell`. Do not merge/cherry-pick an old prototype wholesale simply to obtain its navigation shell.

## PR review questions

Every material staff-facing UI PR should answer:

1. Is the feature on the correct `TOS | BO | DUAL` surface?
2. Does it use the approved TOS app family or BO sidebar group?
3. Does it preserve the max-five TOS footer rule and app theme orientation?
4. Does it preserve domain/pedagogy boundaries?
5. Does its permission/surface metadata match the canonical Core handoff rather than local UI assumptions?
6. Did it invent a new shell/navigation contract without Founder approval?

A green build does not override a layout-contract or authorization-boundary violation.
