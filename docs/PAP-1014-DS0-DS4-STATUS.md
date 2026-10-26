# PAP-1014 — TOS Design System runtime implementation
**Date:** 2026-10-26 · **Branch:** `feat/pap1014-tos-ds-v2`, based on PAP-938 HEAD `20afab64`.
**Visual/interaction authority:** https://tos.proto.pinohouse.art/ (PAP-934 Founder Master V8; no seventh Duty app).
**Protected source:** OneDrive `PAP-934-tos-master-v3/TOS_STAGING_UI_ANCHOR_V1_20261026.md`.

## Work performed
- DS0: new `app/components/tos-ds/` with scoped tokens, one shared component CSS module, typed API aliases (`AppFrame`, `AppHeader`, `AppContent`, `AppBottomNav`, `AppCard`, `AppSectionHeading`, `AppSheet`, `AppToast`, `AppButton`, `AppField`, `AppStatusBadge`, `AppIconButton`). Single implementation for each.
- DS1: Reception, Shift Lead, Classroom, Training, Station, and six-app integration client migrated to the canonical DS exports. Legacy `TosVNextUI.tsx` is now a compatibility *re-export only*. App-specific CSS remains separately scoped; no active staff route replacement.
- DS2 (PARTIAL): generic frame/header/nav/button/sheet/card CSS extracted from mixed VNext CSS; no `!important` or class-substring CSS Module selectors in new DS. Classroom V18b *business flow and global old prototype CSS* are NOT rewritten; screenshot parity for the real Classroom UI remains outstanding.
- DS3 (PARTIAL): desktop Station DS frame remains full width at >=1024; no 430px clamp. Actual five-section Station runtime screenshots versus V8 not fully accepted.
- DS4 (PARTIAL): `npm run tos:ds:check` architecture gate added to PR Validation; local dev-only parity fixture `/prototype/tos-ds-parity`, which hard-404s in all deployed environments.

## Verified evidence
- TypeScript standalone: PASS.
- Full Next.js 16 production build with webpack: **PASS** (warns about Next Edge dependency and legacy middleware deprecation; no build failure).
- Source DS architecture gate: PASS, 11 canonical exported primitives, 6 consumer imports, no duplicated component implementations.
- Targeted PAP-938/PAP-941/942/943/944/945/946 Core security contract tests: **40/40 PASS**.
- ESLint targeted run: zero errors; inherited React consumer warnings remain (fix separately, do not misrepresent).
- Playwright using local dev-only DS fixture, 320/390/430/768/1024/1440/1920: HTTP 200, mobile max-width 430px, header 60px, nav 76px, Station full viewport, no horizontal overflow, Escape closes modal and restores focus, page JS errors 0. Local-only receipt/screenshots at `D:\pino-work\pap1014-visual-qa-20261026\`.
- User-approved static prototype remains untouched at https://tos.proto.pinohouse.art/.

## Blocking work before staging acceptance
1. Visual parity of full six-app *authenticated runtime* at 320, 390, 430, 768, 1024, 1440, 1920 with screenshot/per-app behavior comparison to PAP-934 Master V8, not just DS fixture geometry.
2. Classroom V18b adapter needs stable public slots, Path Diary/Setup evidence Core contracts, no fake data, real roster/mission/diary round trip.
3. Shift Lead role/view parity and authenticated Center/Shift scopes; Reception pickup evidence & camera/TV devices/Training V5 write stay disabled until verified Core.
4. Strict app-content CSS lint for all consumers (not merely common primitives), screenshot reference regression in CI, touch hit/a11y, keyboard and independent Core auth/403/401 testing.
5. Founder visual acceptance and FC1 controlled merge/staging admission according to PAP-512. Do **not** merge directly to main or ship Production from PAP-1014.

**Delivery:** Draft PR into PAP-938 working branch; FC2 worktree untouched, no D1/R2/outbound/Production mutation.
