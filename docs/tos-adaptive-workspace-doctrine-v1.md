# TOS Adaptive Workspace Doctrine v1

Status: **FOUNDER APPROVED — PRESENTATION FOUNDATION**

This doctrine governs how Team OS features are composed. It is an app-local presentation contract. It does not define business authority, permissions, domain lifecycle, or Core readiness.

## One product, two workspaces

PINO Team OS has two presentation workspaces:

- **OPS** — mobile-first, for staff executing work in the house.
- **BO (Back Office)** — desktop-first, for management, configuration, review, planning, and control-plane work.

`OPS` and `BO` are presentation modes, not authorization roles. Permission, scope, actor, and contextual authorization remain canonical backend concerns.

## OPS mental model

OPS is organized around work context rather than raw entities:

```text
Tôi hôm nay
→ Ca của tôi
→ Lớp tôi đang làm
→ Học viên tôi đang phụ trách
→ Việc tôi cần xử lý
```

Do not shrink a desktop admin page into mobile and call it OPS.

### OPS Home

Home is a neutral launcher + today-awareness surface.

Approved app families:

1. **Ca làm** — shift check-in/out, own schedule, shift registration, timesheet/history/correction.
2. **Lớp học** — today's assigned classes, learners-in-class, lesson execution, journal, evidence, achievement.
3. **Việc** — attention inbox aggregating deep links to owning domains.
4. **Pinoria** — separate operational context for Reception / center-wide staff where authorized.

Global Home navigation may contain at most five items. Home footer remains visually neutral.

### OPS feature shell

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

Pinoria remains a separate app family / operational context.

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

## DUAL features

A feature touching both physical staff execution and management/configuration is `DUAL`.

DUAL features MUST provide separate OPS and BO compositions. They must not reuse the same desktop composition unchanged on mobile.

Examples of current placement direction:

- Workforce → OPS `Ca làm` + BO `Workforce`.
- Journal / Evidence / Achievement → OPS `Lớp học` + BO `Learning` where management/review is needed.
- Pinoria → OPS `Pinoria` + BO `Pinoria`.
- Booking / Registration management → primarily BO `Operations`; never inject commercial queues into mentor pedagogy.
- Policy Center / Access Control → BO `System`.

## Mandatory TOS Layout Decision

Before implementing a TOS UI feature, the implementation notes/spec/handoff must resolve:

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

## Founder review gate

A feature may inherit an already-approved shell slot without a new Founder UI decision when it preserves this doctrine.

Return to Founder before final navigation architecture when a proposal would:

- add or remove a global Ops app family;
- change global Ops footer architecture;
- exceed five contextual footer items;
- create a new theme family;
- move a feature between OPS and BO in a materially different way;
- put learner Check-in/out inside mentor pedagogy;
- mix Pinoria into pedagogy views;
- replace the BO grouped-sidebar model;
- otherwise contradict an approved layout decision.

When `founder_layout_review: PENDING`, prototype work may continue, but final navigation architecture is not implementation authority.

## Prototype → implementation rule

Prototype code is evidence, not foundation authority by itself.

The approved reusable shell primitives live under:

```text
app/components/tos-shell/
```

Feature implementation branches should start from current TOS main and compose these primitives. Do not merge/cherry-pick an old prototype wholesale simply to obtain its navigation shell.

## PR review questions

Every material TOS UI PR should answer:

1. Is the feature in the correct `OPS | BO | DUAL` workspace?
2. Does it use the approved app family or BO sidebar group?
3. Does it preserve the max-five Ops footer rule and app theme orientation?
4. Does it preserve domain/pedagogy boundaries?
5. Did it invent a new shell/navigation contract without Founder approval?

A green build does not override a layout-contract violation.
