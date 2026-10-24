# PAP-785 — Staff credential, support and security controls

Epic PAP-779, source stacked on PAP-783 (#673) and PAP-784 (#674). FC1 remains sole merger under PAP-512; do not merge out of dependency order. No staging/Production/D1 live writes.

Implementation: credential reset and audited TOS support are grouped under a collapsed Access security section rather than constantly visible in the role assignment workspace. Support action now enforces permission `access.support.impersonate`, active Staff/Access, bounded reason, and target-safe async continuation before submitting the support token to TOS. Temporary password remains one-time response, is cleared when leaving Access tab/target and stale reset completion on other tab is ignored; no secret telemetry or stored token. Original separate Access-only suspend/reactivation and suspend-Access-first offboarding remain as implemented; Core remains security authority.

Tests: `bo-staff-support-guard.test.ts` 2/2; combined PAP-783/784/785 local 8/8 targeted Node/TSX PASS. TypeScript and GitHub CI receipts to follow. Founder premerge browser E2E optional; no authenticated runtime/Production manual proof claimed.

KNOWN LIMIT: This slice preserves pre-existing Support VIEW/ACT Core contract, credential reset API and offboarding helper; it does not independently prove physical session expiry, real auth, remote permissions or offboarding partial-failure integration. Continue exact-head security review for FC1 admission.

Source-owner fence: this DEV worktree is unique; PR stacked above unmerged predecessor #674 and #673; FC1 should read back current main, avoid mutating these branches concurrently, verify exact-head required CI, PAP-507 waiver, staging-CD disabled and actual merge order.