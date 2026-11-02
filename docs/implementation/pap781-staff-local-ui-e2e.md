# PAP-781 — Local UI E2E (pre-merge) runbook

Authority: PAP-184 / PAP-512; prototype PAP-778; implementation PAP-781 (PR #660). Evidence class: **LOCAL UI E2E / fixture-backed**, never true BO/Cloudflare/Core authorization or mutation integration.

## Why a sandbox?

The real `app/bo/layout.tsx` enforces Staff authentication via Cloudflare/Core before the browser can mock `/api/bo/*`. Do not bypass that authorization in production code or on the user's authenticated FC1 browser. The dedicated UI suite tests the real `StaffManagementView`, real shared `BoDataGrid`, Next navigation and the real `/bo/staff/[staffId]` route **only in a disposable detached worktree**. Two layout/page files are temporarily replaced in that sandbox; all BO API requests are intercepted by Playwright with deterministic fake identities.

## Setup on Windows i5

From the existing PAP-781 DEV worktree (not an FC worktree), prepare a distinct detached worktree at the candidate exact SHA:

```powershell
$repo = 'D:\PINO\worktrees\pap781-staff-detail-navigation'
$sandbox = 'D:\PINO\worktrees\pap781-ui-e2e-sandbox'
git -C $repo worktree add --detach $sandbox HEAD
cmd /c mklink /J "$sandbox\node_modules" "$repo\node_modules"
Set-Location $sandbox
node scripts/premerge-local-staff-sandbox.mjs prepare
npx playwright test --config playwright.premerge.config.ts e2e/premerge-local-staff.spec.ts --reporter=list
node scripts/premerge-local-staff-sandbox.mjs restore
```

**Never run `prepare` from production, the candidate branch or FC1's worktree.** The helper fails unless the folder is named exactly `pap781-ui-e2e-sandbox` and HEAD is detached. It never edits the authenticated source worktree. The Playwright server starts on **127.0.0.1:3109**, no remote backend; the test registers a mock `pino_staff_password_session` cookie that is **NOT** a real auth credential. `restore` returns only the three temporarily overlaid files to their exact HEAD bytes. Do not leave the sandbox layout fixture checked into any source branch.

If the sandbox already exists, first inspect its status and SHA. Do not blindly reset or remove other people's worktrees. Recreate only on an explicitly disposable fixture worktree after moving test artifacts to a receipts folder.

## Test coverage and evidence

- Responsive Staff Directory/Quick Peek → Full Detail → Directory query round-trip: **390/768/1440px**.
- Unknown deep-linked Staff ID renders bounded not-found/error; no unrelated profile.
- No private/compensation document fetch in directory/peek/default detail. No sensitive fake values in Quick Peek.
- Screenshots: `test-results/pap781-local-staff-{390,768,1440}.png` (return Directory), `pap781-local-quick-{390,768,1440}.png` (Quick Peek), and `pap781-local-full-{390,768,1440}.png` (Full Detail); traces on failure.

Previous PAP-388 fixture screenshot mismatch on Windows due to missing golden reference is **separate** from this real React component suite. Keep unapproved baselines unapproved.

Only claim **LOCAL UI E2E PASS** on success. Role permissions, real BO auth and Staff mutation require separately isolated Core/auth/data integration tests or truthful explicit waiver, not mocked UI assertions. Screenshots must be inspected against approved PAP-778 visuals and differences recorded; successful navigation does not automatically mean full visual parity.

## Handoff

Record exact candidate SHA, sandbox fixture overlay, command/results, 390/768/1440 artifacts, CI run, unverified integration gates and visual gaps on PAP-781. FC1 remains sole merger; this runbook grants no merge/staging/Production authority.

## Visual scope note (2026-10-19)

Local screenshot inspection confirmed PAP-781 Quick Peek and route function at 390/768/1440. Full Detail still contains the legacy long-running operational forms: tabbed Information Architecture / Overview visual parity is owned by PAP-782, not this navigation slice. Sandbox does not render the real BO shell; shell/auth parity remains separate evidence. No final PAP-778 full-workspace visual approval is implied.
