# TOS Adaptive Workspace Doctrine v1

Status: **FOUNDER APPROVED — product/UI doctrine**

This document is presentation/product doctrine for PINO Team OS. It does not grant business authority, permissions, or production-release authority. Canonical domain behavior remains governed by `pino-core` feature specs and handoffs.

## One product, two workspaces

PINO Team OS is one product with two primary workspaces:

- **OPS** — mobile-first, physical-work execution inside the House.
- **BO (Back Office)** — desktop-first, management/configuration/control-plane work.

OPS/BO classification is presentation doctrine, not authorization. A staff member may have access to one or both workspaces according to canonical Permission + Scope + Context.

## OPS doctrine

OPS is designed for phone use while staff are physically working.

### Home = app launcher, not action dump

The OPS Home has three responsibilities:

1. show today's immediate facts: current shift, next class, attention;
2. provide stable entry into a small set of **app families**;
3. remain visually neutral so entering an app feels like a clear context change.

Home must not expose a flat grid of every low-level action.

Founder-approved app families for v1:

- **Ca làm** — Check-in/out, personal schedule, shift registration, timesheet/history/correction;
- **Lớp học** — today's classes, learners in pedagogy context, lesson execution, Classroom Journal, Achievement/Evidence;
- **Việc** — universal attention inbox and deep-links into owning apps;
- **Pinoria** — separate Reception / center-wide operational context when authorized.

Global OPS footer on Home:

`Home | Ca làm | Lớp học | Việc | Pinoria`

`Học viên` is not a global app in v1; it belongs to the `Lớp học` family.

### App-family navigation

When the user enters an app family:

- the global footer is replaced by the app-local footer;
- app-local footer remains capped at five items;
- header shows app-family title on the left and Home on the right;
- Back appears only for deeper detail navigation;
- routine mobile work should avoid hamburger-first navigation.

Home cards such as current shift, next class, or attention should deep-link into the correct app/context rather than duplicate action logic.

### App themes and orientation

Each OPS app family must have a distinct but restrained visual theme so staff can recognize context without rereading navigation.

Theme differentiation may use:

- accent color;
- light surface tint;
- active footer color;
- app icon tile tint;
- header accent/eyebrow.

The theme must remain calm and operational; color is orientation, not decoration.

Current v1 direction:

- Home — neutral PINO violet;
- Ca làm — blue/slate operational;
- Lớp học — green/warm pedagogy;
- Việc — amber/orange attention;
- Pinoria — violet/fantasy operational.

Do not use color as authorization or business-state truth.

## Ca làm app

Founder-approved contextual footer:

`Hôm nay | Lịch | Đăng ký | Check-in/out | Chấm công`

The app may show:

- personal current-shift status;
- personal schedule;
- shift registration input;
- own Check-in/out;
- own timesheet/history;
- correction/justify request on a timesheet record.

Timesheet correction is an action on a record, not a separate global app.

## Lớp học app

Founder-approved contextual footer:

`Lớp hôm nay | Học viên | Giáo án | Journal | Thành tựu`

### Mentor pedagogy boundary

The Mentor Class/Learner experience is **pedagogy-only**.

Rules:

- Mentor views learner attendance facts but does not Check-in/Check-out learners from this app;
- learner presence is handled by Reception/authorized presence operations;
- Mentor Class/Learner surfaces contain **no Pinoria action or Pinoria state**;
- Mentor work centers on Lesson execution, Classroom Journal, Evidence, Assessment/Achievement, and pedagogical notes;
- global learner search within this app remains pedagogy-contextual and must not become a generic CRM surface.

Attendance facts may include Check-in time, Check-out time, and source/provenance appropriate for presentation, but the surface is read-only for presence.

### Classroom Journal

Journal is capture-first rather than form-first.

Preferred composition:

- photo capture;
- audio/recording capture;
- video capture where relevant;
- general class observation;
- per-student note;
- save draft / complete actions.

Captured media or notes may become Evidence candidates according to canonical learning contracts. Journal UI must not automatically award progress/Achievement.

### Universal Achievement shell

TOS should provide a reusable Achievement action grammar rather than separate hard-coded UI for each program.

The same shell should represent examples such as:

- Piano: hoàn thành chạy gam C;
- Art: hoàn thành đồ án màu nước.

The shell may render definition/presentation, criteria, Evidence references, Assessment state, and review/confirm action. Program-specific criteria come from governed definitions/contracts; frontend state is not canonical Achievement truth.

## Việc app

Founder-approved contextual footer:

`Tất cả | Ca | Học vụ | Pinoria | Yêu cầu`

The app aggregates projections/deep-links from owning domains. It does not own the underlying business state.

## Pinoria app boundary

Pinoria is a separate operational context from Mentor pedagogy.

Recommended v1 contextual footer direction:

`Live | Cần xử lý | Học viên | Fulfillment | TV`

Rules:

- Reception or center-wide Ops may receive Pinoria operational surfaces when authorized;
- Mentor `Lớp học` surfaces remain Pinoria-free;
- Pinoria-specific workflows deep-link to the owning Pinoria operational surface rather than being duplicated in pedagogy UI;
- TV presentation state never becomes Attendance authority.

## BO doctrine

BO is desktop-first.

Preferred shell:

- persistent sidebar;
- dense page header/content area;
- tables, split panes, master/detail, filters, timelines and multi-column forms are allowed;
- no five-item navigation constraint.

Recommended top-level information architecture direction:

- Overview
- Operations
- Learning
- People
- Workforce
- Pinoria
- Content
- System

Exact module exposure remains permission and feature-readiness dependent.

## Dual-surface feature rule

A feature serving both physical Ops and management/Founder control should provide separate compositions for the two workspaces.

Do **not** simply shrink a desktop BO screen to mobile and call it OPS.

Product-specific configuration generally belongs to BO; physical execution generally enters through an Ops app/work context such as current shift, current class, current learner, or current attention item.

## Mandatory layout decision gate for future TOS features

Before finalizing a new TOS feature UI, the proposal must include:

```yaml
TOS Layout Decision

workspace:
  OPS | BO | DUAL

primary_device:
  MOBILE | DESKTOP

ops:
  app_family:
  home_launcher: true | false
  footer_items: []       # maximum 5
  app_theme:
  entry_context:
  primary_action:
  capture_requirements:

bo:
  sidebar_group:
  subnavigation:
  primary_layout:
    QUEUE | TABLE | SPLIT_VIEW | FORM | TIMELINE | CANVAS

shared:
  detail_pattern:
  attention_badge:
  permission_context:
  cross_domain_links:

founder_layout_review:
  PENDING | APPROVED
```

If `founder_layout_review = PENDING`, implementation may prototype options but must not silently establish final TOS navigation architecture.

## Prototype discipline

Prototype code is UI/product evidence only.

`prototype finding -> canonical Core spec update when behavior is material -> Founder approval where required -> technical readiness/handoff -> runtime implementation`

This doctrine does not authorize deployment or merge of prototype code.