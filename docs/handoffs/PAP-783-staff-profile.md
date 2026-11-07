# PAP-783 Staff Profile — DEV handoff

Authority: PAP-779/PAP-783, PAP-778 approved UI, PAP-512 sole FC1 merger. No staging/production/D1 release.

Implemented: read-first Profile tab, explicit Edit/Save/Cancel, dirty comparison and field validation, cancel restoring loaded canonical Staff, confirmed navigation on dirty edits, unload warning, stale save response fenced by selected Staff and edit generation. Preserve legacy Staff/Access separation, authorized private reveal and offboarding. No new persistence or sensitive data prefetch.

Verification: targeted Node/TSX tests 4/4 PASS; TypeScript typecheck PASS; targeted ESLint 0 errors (one previously present refresh-hook warning). Browser E2E optional per current Founder PAP-512 directive and not claimed. Recheck latest exact-head CI after push.

Known gaps: browser SPA history back may bypass route-click dirty guard; manual production UX/a11y proof outstanding. PAP-784 Access tab and PAP-785 destructive actions separate. Never claim terminal until actual merge SHA and Jira Merged receipt.

FC1: inspect PR against current main, check current owner/branch, CI/security/privacy gates, PAP-507 waiver and disabled staging CD; merge only under live Epic-first ROI and readback.