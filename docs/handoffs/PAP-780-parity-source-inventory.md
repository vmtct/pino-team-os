# PAP-780 — Staff V2 prototype-to-main and authenticated BO runtime audit

Date 2026-10-21 ICT, i5 Windows Chrome + Playwright. **Read-only**; no BO command writes, deploy or Production changes.

## Approved prototype vs source truth
- Canonical PAP-778: i5 OneDrive/PINO/GPT Technical/Prototype/PAP-778-staff-detail-ux-v1. Prototype `README.md` explicitly describes fictional, client-only in-memory data. Its screenshots 01–07 show mock interaction/parity, not live staff or production UI.
- Source baseline Team OS `origin/main e4f7bf3`: `app/bo/staff/page.tsx` has Staff Registration Intake, Review Queue, Staff Management, Roster Access Activation and Onboarding. `lib/bo-staff-detail-tabs.ts` specifies overview, profile, assignments, training, income, access, pinoria, audit and URL selection; PAP-781/782 merged to main. PAP-783–791 source remains on open PRs; integration candidate PR #684 builds it all together.
- Canonical owners: Workforce Shift Role/shift assignment, Training assignment/qualification, Compensation private salary, Pinoria Self/House Presence from timekeeping, Access credentials and revocation. Prototype shift counts, PIN flows, salary KPIs and event timelines are NOT canonical data.
- True/optional read-plane gaps: Staff across all centers/weeks lacks a confirmed safe aggregate (PAP-787 approved Staff-filtered Workforce source fallback). Server-side Staff-scoped cross-domain paginated audit timeline lacks confirmed API (PAP-791 approved source-link fallback, NOT full timeline).

## Authenticated browser read-only verification
- Initial listener scan only found FC1-owned Chrome CDP 9331; **9331 was never used**. Dedicated persisted Manager Chrome profile `D:\pino-ai-ops\chrome-manager-9343` was available and not running. Started isolated Chrome debugging on **127.0.0.1:9343**, attached via Windows Playwright `chromium.connectOverCDP`, using a separate read-only tab; no WSL CDP.
- Browser opened `https://bo.pinohouse.art/bo/staff`, HTTP **200**, no Staff-login redirect and no password input. This confirms BO browser authorization in that profile; the *server-side actor role* was not independently asserted. Environment is the Production **domain**; this is *not* evidence that pending PR code has shipped.
- Viewport readback from current deployed directory:

| Width | Document scroll width | Outer horizontal overflow | Table | Staff V2 tabs | Redacted screenshot |
|---:|---:|---|---|---:|---|
| 390 | 375 | No | present | 0 | local `bo-staff-390-redacted.png` |
| 768 | 753 | No | present | 0 | local `bo-staff-768-redacted.png` |
| 1440 | 1425 | No | present | 0 | local `bo-staff-1440-redacted.png` |

- All screenshots are in private i5 `D:\PINO\audits\pap780-staff-20261021`, **not committed or uploaded** because live Staff data may remain visible outside screenshot masks. Table/input/peek content is masked. They are diagnostic layout evidence only.
- Current deployed BO Staff had **17 table rows** at the tested viewport; clicking the first row produced neither the new Staff V2 Quick Peek test ID nor Full Detail CTA; tab nav on directory was absent. This is an observed **deployment parity gap** from the PAP-778 approved prototype/new PR, not evidence of a broken feature on the not-yet-deployed integration branch.
- Thus actual authenticated Staff *full-detail* UI at 390/768/1440 remains unavailable on deployed site. No attempt to run mutation E2E, reveal employee salary, support impersonation, password reset, offboard or change any live record. No live Full Detail pass claim.

## Remediation / honest acceptance boundary
- Staff V2 implementation in PR #684 integrates the approved tab navigation and existing domain read-planes; local typecheck/lint/46 targeted tests and production build PASS. It must pass its **own exact-head CI** and FC1 review/merge before any post-ship visual claim.
- PAP-780 read-only authenticated Directory audit is verified; **Full Detail production parity cannot be signed off until the feature is shipped**, which is explicitly outside PAP-512 current authorization. Founder PAP-512 allows premerge E2E/visual proof to be skipped as a *gate*; it never allows pretending unobserved runtime was tested.
- FC1 can evaluate this honest partial audit as Review evidence. Preserve outstanding Production full-detail visual comparison as a nonblocking post-ship validation request if separately authorized. No staging, Production or D1 actions by this audit.
