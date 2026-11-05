# BO V2.3 UI Parity — PAP-889 / PAP-927

## Immutable authority and scope
Founder-approved **2026-10-21**: PAP-885 and PAP-879. Source snapshot **PAP-879-BO-V2.3-20261022** in canonical OneDrive `APPROVED_UI_AUTHORITY`. See `docs/bo-v23-ui-authority.json` for 13 SHA-256 fingerprints. The prototype is mock-only and is **not** a source of business data or authorization. Do not modify the snapshot in place.

The static verifier `scripts/verify-bo-v23-parity.mjs` checks detectable source structure and negative regressions. It cannot prove CSS pixel parity, domain persistence, ACL, or end-to-end interaction by itself. A static PASS is **never** Founder Production acceptance.

## Phase-safe enforcement (PAP-512)
- `node scripts/verify-bo-v23-parity.mjs --mode=report`: show all missing source evidence on **both pilot routes**; nonblocking and truthful even when none are adopted.
- `node scripts/verify-bo-v23-parity.mjs --mode=adopted`: required CI source check **only for pilot routes whose exact page path is in the PAP-929 adoptedRoutes ledger**; legacy-but-not-adopted does not fail all unrelated PRs. Existing PAP-926/927 registry/legacy gates independently prevent false adoption and bypass. If no pilot is adopted, output PENDING, **not parity PASS**.
- `node scripts/verify-bo-v23-parity.mjs --mode=pilot`: strict pilot readiness check on **Students & Classes** independent of ledger state; required to claim CP3 source parity ready, alongside domain unit/security/permission tests. It is NOT a new Playwright or premerge visual E2E condition and is not a standalone approval to ship.
- `node scripts/verify-bo-v23-parity.mjs --authority-root="<approved source directory>" --mode=report`: optional local 13-file hash check against approved snapshot. Not required on cloud CI; i5 previously proved 13/13.
- `node --test scripts/verify-bo-v23-parity.test.mjs`: all positive/negative contract fixtures.

## Acceptance scenarios by contract
| ID | Requirement | Expected evidence |
| --- | --- | --- |
| T01 | Single Level-1 Table | no competing table/metric rail/avatar/demo chrome; canonical ID as own readonly copy column; small first-cell opener |
| T02 | Typed Inline Edit | text, number, money, date/time, relation/person/multi, tags, bool, email, URL, ID/formula denied; Enter/blur/Escape and domain validation |
| T03 | Editable Quick View | opens row via first cell, field-level edit without global View/Edit toggle; Create explicit confirm; permissions/dirty/focus/mobile |
| T04 | Typed Settings | only Search visible outside Settings; visibility/reorder, filter AND/OR contains, group/hide empty/collapse, no technical controls |
| T05 | Shared Views | + snapshots current state, auto-save active view, rename/delete/reorder; Staff draft local-only; Manager 403/409/version/ACL |
| T06 | Full Detail | shared header/tab shell, domain slots, active tab URL, safe back-to-table; no separate per-module chrome |
| T07 | Real domain | Students PAP-891 and Classes PAP-893 authorized Core reads/writes, no mock rows, duplicate or unsafe writes denied |
| T08 | Responsive & a11y | 390/768/1440, contained scroll, keyboard, focus restore, labels and empty/error/permission states |
| T09 | Safety / release | exact-head required CI, Core ACL, rollback, PAP-185 and TR-41 scoped source/serving diff |

Use a **stable representative fixture** for optional before/after component screenshots at 390/768/1440. Compare UI semantics/interactions, not full-page pixels containing changing domain data. Store explicit evidence (fixture, build SHA, screenshots/diffs and PASS/FAIL) in PAP-889. The premerge browser E2E waiver remains as written in PAP-512; manual Founder Production validation is PAP-932.

## State semantics
**PENDING:** no pilot routes have been formally adopted, even when static CI passes.
**FAIL:** an adopted route violates a static source invariant or strict pilot readiness is attempted too early.
**STATIC PASS:** source checks on applicable routes passed; component/unit/domain and visual checks still required for actual full parity.
**FOUNDER APPROVED:** only explicit result recorded in PAP-932 after TR-41 technical verification.
