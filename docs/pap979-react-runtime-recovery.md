# PAP-979 React runtime parity recovery

Scope: Students and Running Classes in the real React `/bo` surface, under
PAP-879/PAP-512 and the Founder's 2026-10-25 fullstack recovery assignment.
Production and PAP-971 outbound remain on hold.

## Root cause

`BoFullDetail` rendered `.bo-full-detail` without importing any corresponding
stylesheet. The BO layout imported scoped foundation tokens, but tokens do not
style markup. The approved cover, tab strip and property grid existed only in
the separate static replica's `styles.css` and `full-detail-v24/v25.css`.
The earlier static-replica pixel comparisons did not exercise React `/bo`.

## Changes

- Import a CSS module directly from the existing shared `BoFullDetail` renderer.
  Port approved cover, header, tabs, full-width panel and responsive spacing.
- Share `BoProperties` between both domain property adapters. Use the same
  adapters in the pilot drawers and Full Detail; preserve richer Student
  lifecycle, guardian, learning and Pinoria content.
- Present supported name/status/capacity edits from property values. Read
  authenticated Core permission keys before exposing Full Detail controls;
  retain server ACL, expected versions, denied/conflict errors and readback.
- Keep a selected-entity key on detail adapters so changing entities remounts
  pending forms and requests.
- Give redacted History its approved five-column compact presentation, retaining
  all exact-subject validation, pagination and failure handling.
- Scope sidebar/table typography and mobile/tablet corrections to the two pilot
  routes. Other module adoption remains outside this grant.
- Run actual React component screenshots in CI, independently of replica tests.

No Core change, migration, staging fixture, secret, sender or production change.

## Verification and limitations

`scripts/verify-bo-react-runtime-parity.mjs` bundles the real client components,
CSS modules and BO shell. Only Next navigation is replaced by a local browser
history adapter. All API traffic is intercepted with isolated fixtures; external
requests are blocked. This exercises presentation and client contracts without
bypassing the deployed server authentication boundary.

Thirty screenshots cover both pilots at 390/768/1440: Table, Quick View,
Detail, Chuyên Sâu and Lịch Sử. Eight additional error screenshots cover History
and mutation 403/409. Manager edit/readback, Staff read-only controls and History
pagination are fixture checks, not live Core acceptance.

Initial local validation: Next optimized build and typecheck PASS; full ESLint
has zero errors (existing warnings remain); 33 focused navigation/audit/views
tests PASS; architecture 28/28, foundation 12/12 and Quick View 4/4 PASS.
Full Windows suite: 847/855; eight unchanged release-tool tests fail due to bash
availability and POSIX-only CLI entry URL comparisons. The Linux exact-head
PR validation must independently pass before integration.

CI uploads `.next/pap979-react-evidence` alongside the older replica evidence.
The screenshots show domain-specific data differences; no pixel-equality claim
is made between unrelated business records.

## Acceptance classification

| Gate | Evidence |
| --- | --- |
| LOCAL VISUAL | React screenshots at all three widths; source styles compared with approved V2.5 |
| CONTRACT | Local API fixtures and focused tests pass; exact-head CI required |
| STAGING VISUAL | Pending authorized release and deployed screenshots |
| STAGING REAL API | Pending authorized release and real read/edit/readback, Shared Views, History and legitimate Staff session |

Manager context, student directory and delivery bootstrap were independently
read as HTTP 200 from the legitimate staging browser before this recovery.
The existing acceptance class is ARCHIVED. No new fixture was created.

Direct Playwright CDP initialization was traced to unresponsive unrelated
Production BO/TOS renderers. Restricting the diagnostic client's target
discovery to staging lets it connect without closing/reloading those tabs or
reading cookies. Live `Page.captureScreenshot` still stalled separately; this
does not invalidate local screenshots or establish deployed visual acceptance.

## Release boundary

PAP-512 still names FC1 as shared merge/staging owner. The Founder authorizes
Codex downstream execution after required ownership transfer and writer leases;
no lease is inferred from PLT-CARE, a green PR or the implementation role.
The existing PAP-719 one-shot Team workflow is pinned to its old approved SHA
and run; it must not be blindly dispatched for this candidate.

Record exact candidate/PR/merge/CI and eventual serving SHA/version/rollback on
PAP-979. Founder review URL after release is
https://pino-team-os-staging.minhtri-van42.workers.dev/bo/learners and
https://pino-team-os-staging.minhtri-van42.workers.dev/bo/running-classes.

Team Surface Decision: BO; desktop primary; School sidebar; Table → Quick View
→ Full Detail. Existing `student.profile.*`, `delivery.schedule.*`, audit and
Shared Views permissions remain Core-owned. Design authority is Founder-approved
V2.5; runtime Founder acceptance remains pending.
