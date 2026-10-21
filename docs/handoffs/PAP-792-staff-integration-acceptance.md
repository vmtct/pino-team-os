# PAP-792 — Staff V2 integrated code and merge-readiness evidence

## Scope and authority
Date: 2026-10-21 ICT. Epic PAP-779, approved UI authority PAP-778. No staging, Production, D1, live payment or payroll mutations. FC1 retains sole GitHub merger under PAP-512; no forced queue pick. This file is evidence of **independent DEV integration**, not a claim that Jira Epic or child stories are Merged.

The clean isolated branch `dev/pap792-staff-integration-20261021` started from Team OS origin/main `e4f7bf3`. It serially cherry-picked and reconciled Staff V2 child PR source:
- PAP-783 profile PR #673, source 7016c3b (profile draft validation, explicit save/cancel, stale-save)
- PAP-784 Access PR #674, source e0b25de (role/scope/Founder revoke gate)
- PAP-785 Security PR #675, source 1f7b0e2 (password/support/offboarding gates)
- PAP-786 entrypoints PR #676, source be46c09 (intake, registration, directory, onboarding and roster preserved)
- PAP-790 Pinoria PR #681, source 5cc22ba (lazy read/stale-session fence)
- PAP-787 Workforce PR #677, source 14b0d5b and 934f8ad (Shift Role boundary and Staff-ID filtered canonical planner)
- PAP-788 Training PR #678, source 8d918e2 (Staff-specific canonical Training/Qualification read)
- PAP-789 Compensation PR #679, source 02acbbe (explicit private reveal, fail-closed Staff-scope fencing)
- PAP-791 Audit PR #680, source 9626a3e (accurate source links; no fabricated timeline)
- PAP-780 source inventory PR #682, source 844beac (prototype and authenticated-browser audit limitations)

All overlapping changes to `app/bo/staff/StaffManagementView.tsx` were reconciled in this isolated branch. This integration is proposed as a **single merge path** replacing the separate overlapping merge candidates. If FC1 chooses the integration PR, DO NOT independently merge PRs #673–682 later or duplicate the same changes. Leave original PRs untouched until verified integrated merge, then explicitly close as superseded with GitHub/Jira receipts.

## Local verification (i5)
- `npx tsc --noEmit --pretty false`: PASS on integrated code.
- Targeted `npx eslint`: PASS, 0 errors and one existing `refresh` useEffect dependency warning in StaffManagementView.
- `node --import tsx --test lib/bo-staff-*.test.ts lib/bo-workforce-staff-filter.test.ts`: **41/41 PASS**, including offboarding, sensitive reveal, Staff route/navigation, Access permissions, support guard, Pinoria, Workforce.
- `node --import tsx --test lib/bo-staff-integration.test.ts`: **5/5 PASS** for integrated tab composition and canonical guarded planes; total **46/46 relevant tests PASS**.
- `npm run build`: **EXIT 0**, Next.js production compilation and page generation successful (runtime 239s); nonblocking repository-wide CSS Autoprefixer/ESLint warnings were emitted.
- `git diff origin/main --check`: PASS.
- **Exact-head GitHub CI**: must be independently confirmed after pushing this final integration branch. Local PASS is not a substitute.

## Domain authority and intentional fallback
- Workforce Shift Role belongs to each shift; Staff Detail links to `/bo/workforce?staff=<id>` and filters each bounded canonical Center/TermWeek projection. No invented all-center aggregate, daily salary, class ledger or permanent Staff role.
- Training reads authorized canonical Staff-specific Training assignments, assessment, signoff and qualifications. No automatic progression/pay increase.
- Compensation is private and masked until explicit click; Core enforces authorization, reveal fence invalidates on target/scope/unmount/background. Canonical Compensation page owns edit/correct.
- Pinoria Self/House presence derives from Core/TimekeepingSession only; no synthetic identity or local presence mutation.
- Audit lacks verified **server-side Staff-scoped, cross-domain paginated timeline**; only clearly labeled audited-source links are shown. No global audit data downloaded/filtered in browser. Record backend aggregate as a separate product dependency, not a false PASS.

## NOT VERIFIED / terminal blockers
1. PAP-780 authenticated BO visual/runtime parity at 390/768/1440 could not run via isolated Manager CDP (9343 unavailable; FC1 owns listener 9331). Prototype screens are fictional/mock; not production evidence. E2E is optional **premerge** per Founder PAP-512 override, but do not relabel nonexistent runtime evidence as PASS. PAP-780 remains In Progress until evidence/disposition is explicitly accepted.
2. Role-specific live Core authorization/mutation E2E was not run. Source and focused tests pass only.
3. Cross-center Workforce aggregate and complete Staff audit timeline do not currently have confirmed safe read models. Implemented safe fallback allowed by respective story acceptance, but not equivalent to full aggregate UX.
4. No actual merge SHA or Jira Merged status has been observed for PAP-783–792 as of this document. Need final exact-head GitHub CI, PAP-507 independent-review disposition/waiver, privacy/security check, mergeability, FC1 authorized merge and Jira readback.
5. PAP-792 and PAP-779 terminal closure depend on those remaining items and accurate status reconciliation; **DO NOT mark terminal from this file**.

## FC1 safe handoff
Read latest PAP-512, PAP-184 and PAP-507. Check current FC1 Epic focus and branch ownership. Refresh origin/main and check integrated PR HEAD vs main. Choose **one**: merge integrated candidate after exact-head CI/security checks, or serially merge individual PRs and resolve conflicts. Do not do both. Apply no unauthorized staging/Production release. Read back GitHub merge SHA and update each truly shipped child Jira issue and PAP-779 only when merged/accepted. Keep remaining PAP-780 visual auth audit explicitly open if no authorized CDP. Record acceptance/fence decisions, do not fabricate PASS.
