# Toppi BO Enrollment Prototype v1

Status: Founder-approved prototype exploration
Branch: `prototype/toppi-bo-enrollment-v1`
Data: mock only; no Core writes; no production learner data

## Team Surface Decision

```yaml
surface: BO
primary_device: DESKTOP

tos:
  app_family: NONE

bo:
  sidebar_group: Toppi workspace / Learners + Operations + Learning + Content
  subnavigation: Students / Enrollments / Renewals / Schedule / Sessions / Registrations / Weekly Units / Programs
  primary_layout: TABLE + SPLIT_VIEW + FORM

shared:
  permission_context: future canonical BO entry + Toppi feature permissions
  cross_domain_links: shared StudentProfile / Guardian / Pinoria / PINO House context

founder_layout_review: APPROVED
```

## Prototype intent

This slice validates the BO workspace switcher and the first Toppi operational workflow:

`Shared Student → Program → Placement Level → Delivery Slot → 12-unit Package → Enrollment detail → Renewal queue`.

The prototype intentionally does not define or implement a canonical Toppi API, schema, permission string, settlement rule, or migration. Interactive enrollment creation exists only in browser component state.

The production BO host allowlist is intentionally unchanged. `/bo/toppi/*` is therefore a staging/prototype route until a later approved runtime handoff explicitly adds production host exposure.

## Canonical assumptions represented visually

- `StudentProfile` is treated as the shared child learner identity direction approved in product discussion.
- CC and LF remain separate Programs with Levels 1–10.
- One Level is visualized as 12 Service Units.
- Delivery Slot owns physical schedule/capacity; Program/Level may mix inside one slot.
- Renewal targets the deterministic successor Level and preserves the mandatory qualifying operating-week break.
- WeeklyUnit is whole-Toppi operating-week scope with CC and LF branches.

Any runtime implementation must reconcile these findings back into the accepted pino-core authority before code integration.
