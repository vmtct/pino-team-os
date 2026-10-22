# PAP-938 — TOS VNext Runtime Foundation / First Wiring Boundary

**Status: WIP, isolated worktree; NOT deployed, NOT feature-complete.**

Parent Jira: https://vmtct97.atlassian.net/browse/PAP-938
Foundation: https://vmtct97.atlassian.net/browse/PAP-939
Sources: PAP-934 Master V8 (6 apps) / TOS Design System V1.

## Files

- `identity.ts` — immutable six-app product registry, no standalone `Nhiệm Vụ`; `station` desktop.
- `tos-vnext.module.css` — scoped semantic tokens (body 15px, labels/buttons 14px, headings 16/18/20/24px, 4px spacing, 44px tap, 48px CTA).
- `TosVNextUI.tsx` — typed components for mobile/desktop frames, app header, bottom nav, card, button, sheet, field, toast and status.
- `core-adapters.ts` — delegates to EXISTING APIs; no shadow Core truth or demo writes. Explicit status matrix `WIRED_READ | LEGACY_ONLY | SECURITY_DEPENDENCY | MISSING_CONTRACT`.
- `app/prototype/tos-vnext-integration/page.tsx` — **worktree-only** read-only integration surface, intentionally NOT the approved visual baseline and NOT production-ready. It consumes actual authenticated Core API URLs at runtime; no built-in fake data.
- `lib/pap938-tos-vnext-bridge.test.ts` — mock-network contract tests verifying calls & fail-closed auth scope. Mock tests are NOT proof of successful authenticated live/staging integration.

## Precisely what is wired now

| App/flow | Existing client used | Readiness |
|---|---|---|
| Ca Làm schedule & open timekeeping | `workforceApi.context/schedule/currentTimekeeping` | Real API read wired, stage auth/browser readback pending |
| Ca Làm staff income by pay period | `ownIncome(centerId)` (never accepts staffId) | Real API read wired, stage auth/browser readback pending |
| Reception student open visit | `tosDayOfLearningApi.openVisit` | Real API read wired, pickup/write policy pending |
| Contextual Duty (Trưởng Ca) | `workforceApi.dutyBoard` | Real API read wired, leader-management writes unapproved |
| Classroom available sessions | `tosLearningApi.sessionsDay` | LEGACY session-only; not approved V18b session-free Diary |
| Thăng Tiến own assignments | `workforceTraining.self` | LEGACY Training F0 only; V5 register/cert missing |
| Station desktop | Workforce center context only | Device/TV/Pinoria operator contract missing |
| Photo check-in | **No direct legacy checkIn write call** | Blocked on PAP-869 private R2/atomic proof |
| Classroom Path Diary / media | **No mock write** | Blocked on PAP-724/945 contract |
| Training V5 register/certificate | **No mock write** | Blocked on PAP-848/849/850 |
| Front Desk arrival/pickup | Visit GET only | Real Core read available; write requires PAP-942 auth/policy |

**Important:** The Core API methods used by adapters themselves enforce authorization. UI role gating cannot substitute server authorization. Unverified/missing contracts are explicitly blocked rather than simulated.

## Tests

Run inside the worktree with installed dependencies:

```powershell
node --import tsx --test lib/pap938-tos-vnext-bridge.test.ts
npm run typecheck
```

These tests verify DTO wiring and fail-closed center scope, and are not authenticated production data tests. Not yet a complete V8 visual parity test, build, staging or functional E2E.

## Git/release safety

This branch is based on upstream `origin/main` snapshot and lives at `D:\pino-worktrees\pap938-tos-vnext-foundation-20261023`. It must not be merged to currently serving public routes until proper feature isolation, full dependency readiness, PAP-185 CI release verification and Founder one-shot TOS VNext authorization. PAP-512 FC1 queue and BO TR-41 train unchanged.
