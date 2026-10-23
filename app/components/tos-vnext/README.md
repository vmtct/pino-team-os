# PAP-938 — TOS VNext six-app integration

**Status: FC2 DEV / Draft PR #810. NOT merged, NOT staff-facing, NOT Production-ready.**

Authoritative sources: [PAP-938](https://vmtct97.atlassian.net/browse/PAP-938), PAP-934 Master V8 + Design System V1, and PAP-512 ownership (FC2 DEV, FC1 merge-only).

## Scope implemented in this isolated branch

- Exactly **six** Home apps: Ca Làm, Tiếp Tân, Trạm TOS (desktop), Trưởng Ca, Lớp Học, Thăng Tiến. No separate Nhiệm Vụ.
- Shared semantic tokens and accessible UI primitives: frame, header, bottom app nav, card, button, form field, toast, status and focus-trapped bottom sheet.
- Actual Core reads from the authenticated staff session, never demo business records or user-supplied staff identities.
- Ca Làm: own assignment, current/historical Timekeeping, self pay-period snapshots. Camera-only check-in still blocked on atomic PAP-869 evidence.
- Tiếp Tân: Hôm Nay/Đón–Trả/Pinoria; own FRONT_DESK shift facts and Core Student Visit read. Check-in/checkout, pickup and Wish write policies still unverified and disabled.
- Trạm TOS: full-width desktop shell with Tổng quan/Pinoria/Học viên/Thiết bị/TV. No mocked metrics or device controls.
- Trưởng Ca: own Core Duty board, obligation/blocker and closeout-gate readback. Station-wide management and closeout writes not enabled.
- Lớp Học: session-free Classroom Day projection with top-down list, roster and single detail header. V18b Path Diary DTO/read contract is typed; all Diary mutations disabled until PAP-724 source and private R2 verified.
- Thăng Tiến: exactly 2 tabs (Thăng Tiến/Chứng Nhận); V5 typed Catalog/Registration/Eligibility reads and actual F0 qualifications with provenance. All V5 writes disabled until PAP-848/849 Core verified.

## Source directory

- `identity.ts` defines immutable app identities; `TosVNextUI.tsx` and `tos-vnext.module.css` supply reusable design-system primitives.
- `TosVNextHome.tsx`, `TosVNextReception.tsx`, `TosVNextStation.tsx`, `TosVNextShiftLead.tsx`, `TosVNextClassroom.tsx`, `TosVNextTraining.tsx` own presentation.
- `core-adapters.ts` delegates to existing authenticated Core clients, with readiness statuses `WIRED_READ`, `LEGACY_ONLY`, `CORE_PR_PENDING`, `SECURITY_DEPENDENCY` and `MISSING_CONTRACT`.
- `lib/tos-classroom-v18b-api.ts` and `lib/tos-training-v5-api.ts` implement typed Core contracts with **write-before-network fail-closed** guards.

## Production and data-safety fence

`/prototype/tos-vnext-integration` is a developer-only diagnostic route. The server component returns 404 unless **both** `NODE_ENV=development` and server-only `PAP938_VNEXT_LOCAL_PREVIEW=true`. It is hard-off on Production builds. No existing `app/TosHome.tsx` or active staff navigation is replaced by this branch.

**A client-side role gate never grants Core authority.** Every read/write must be reauthorized in Core. Never display mock check-in success, paid minutes, Classroom Diary closure, Qualification, Pinoria Wish balance or TV/device state. Never infer V18b readiness from legacy Session Diaries or Training V5 readiness from F0 qualifications.

## Source-owned blockers

- pino-core **PR #1770** (PAP-724 V18b Path Diary/private R2) open with conflict; not verified in deployed Core.
- pino-core **PR #1793** (PAP-848 metadata catalog) and **#1794** (PAP-849 register & eligibility, stacked on #1793) draft/unmerged.
- PAP-868/869 camera-only check-in, PAP-759 opening/pickup, authenticated Station/TV/Wish write commands and Shift Leader station-wide policy.
- Founder-approved screenshot parity at 320/390/430/768/1024/1440/1920, server-authenticated E2E, required exact-head CI and final single-release acceptance remain outstanding.

## Tests and CI

```powershell
node --import tsx --test lib/pap938-preview-gate.test.ts lib/pap938-tos-vnext-bridge.test.ts lib/tos-classroom-v18b-api.test.ts lib/tos-training-v5-api.test.ts lib/tos-vnext-reception.test.ts lib/tos-vnext-station.test.ts lib/tos-vnext-shift-lead.test.ts
npm run typecheck
git diff --check origin/main...HEAD
```

As of FC2 commit `67fc70b1`, **46/46 targeted Node contract tests PASS** and Git whitespace check PASS. Previous exact-head `87205d7d` passed GitHub validate and Workers Build; CI for new commits must be checked independently. Local lint/build remain **unverified**: this worktree's `node_modules` Junction may not match the pinned package.json version. Do not claim local lint/build PASS; use exact-head CI evidence.

PR metadata on [#810](https://github.com/vmtct/pino-team-os/pull/810): `Project-Code: PRJ-WFM`, `Entry-Class: EXISTING_GOVERNED_FEATURE`. These are required by current repository validation; do not bypass CI.

FC2 may prepare, push, test and repair this Draft PR. **FC2 must not merge into main, deploy, stage, migrate data or flip live flags**. FC1 accepts a non-Draft GREEN PR only after concrete Founder-authorized handoff and PAP-184/PAP-507/PAP-185 safety gates. TOS VNext will only release as one coordinated train after all six apps and APIs are verified.
