# TOS Adaptive Workspace Doctrine v1

Status: **FOUNDER APPROVED — product/UI doctrine**

This document is presentation/product doctrine for PINO Team OS. It does not grant business authority, permissions, or production-release authority. Canonical domain behavior remains governed by `pino-core` feature specs and handoffs.

## One product, two workspaces

PINO Team OS is one product with two primary workspaces:

- **OPS** — mobile-first, physical-work execution inside the House.
- **BO (Back Office)** — desktop-first, management/configuration/control-plane work.

OPS/BO classification is a presentation doctrine, not authorization. A staff member may have access to one or both workspaces according to canonical Permission + Scope + Context.

## OPS doctrine

OPS is designed for phone use while staff are physically working.

### Global navigation

The global OPS footer is fixed to at most five items:

`Home | Ca | Lớp | Học viên | Việc`

Rules:

- Home is a stable shortcut launcher. Shortcut positions should remain stable enough to build muscle memory.
- When the user enters a feature, the footer becomes feature-local contextual navigation, still capped at five items.
- Feature header shows the feature title on the left and Home on the right.
- Back appears only for deeper detail navigation.
- Avoid hamburger-first navigation for routine OPS work.
- Mobile layouts should be thumb-friendly and task/context oriented.

### OPS work contexts

OPS should be organized around staff work context rather than exposing domain entities directly:

- Tôi hôm nay
- Ca của tôi
- Lớp tôi đang làm
- Học viên tôi đang chăm
- Việc tôi cần xử lý

Domain entities and Core contracts remain behind these work contexts.

## Workforce / `Ca`

Recommended feature footer:

`Hôm nay | Lịch | Đăng ký | Check-in/out | Lịch sử`

OPS may show personal shift status, personal schedule, registration input, own Check-in/out, and own timesheet history.

Timesheet correction/justify is an action on a record, not a separate global navigation destination. A correction UI must collect the requested value and an explicit reason; the canonical mutation/approval model remains governed separately.

## Class / learner pedagogy boundary

The Mentor class/learner experience is **pedagogy-only**.

Founder-approved rules:

- Mentor views attendance facts but does not Check-in/Check-out learners from this surface.
- Learner Check-in/Check-out is handled by Reception/authorized presence operations.
- Class/Learner pedagogy surfaces contain **no Pinoria actions or Pinoria state**.
- Mentor work centers on Lesson execution, Classroom Journal, Evidence, Assessment/Achievement, and pedagogical notes.

Recommended class feature footer:

`Tổng quan | Học viên | Giáo án | Journal | Thành tựu`

Attendance facts may include Check-in time, Check-out time, and source/provenance appropriate for the presentation, but the Mentor surface is read-only for presence.

## Classroom Journal

Journal is capture-first rather than form-first.

Preferred composition:

- photo capture;
- audio/recording capture;
- video capture where relevant;
- general class observation;
- per-student note;
- save draft / complete actions.

Captured media or notes may become Evidence candidates according to canonical learning contracts. Journal UI must not automatically award progress/Achievement.

## Universal Achievement shell

TOS should provide a reusable Achievement action grammar rather than separate hard-coded UI for each program.

The same shell should be able to represent examples such as:

- Piano: hoàn thành chạy gam C;
- Art: hoàn thành đồ án màu nước.

The shell may render:

- Achievement definition/presentation;
- criteria;
- Evidence references;
- Assessment state;
- confirm/review action.

Program-specific criteria come from governed definitions/contracts. The frontend must not become the canonical source of Achievement truth.

## `Việc` attention inbox

OPS should provide a universal attention inbox.

Recommended footer:

`Tất cả | Ca | Học vụ | Pinoria | Yêu cầu`

The inbox aggregates projections/deep-links from owning domains. It does not own the underlying business state.

## Pinoria boundary

Pinoria is a separate operational context from Mentor pedagogy.

- Reception or center-wide Ops may receive a Pinoria Live shortcut/workspace when authorized.
- Mentor Class/Learner pedagogy views remain Pinoria-free.
- Pinoria-specific workflows should deep-link to the owning Pinoria operational surface rather than being duplicated inside the learning UI.

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

A feature that serves both physical Ops and management/Founder control should provide separate compositions for the two workspaces.

Do **not** simply shrink a desktop BO screen to mobile and call it OPS.

Product-specific configuration generally belongs to BO; physical execution generally enters through an Ops work context such as current shift, current class, current learner, or current attention item.

## Mandatory layout decision gate for future TOS features

Before finalizing a new TOS feature UI, the proposal must include:

```yaml
TOS Layout Decision

workspace:
  OPS | BO | DUAL

primary_device:
  MOBILE | DESKTOP

ops:
  home_shortcut:
  footer_items: []       # maximum 5
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
