# PAP-789 — Staff private compensation tab

Source: Epic PAP-779, canonical PAP-729/731 compensation read model. Independent isolated Team OS DEV branch (main base), FC1 sole merger under PAP-512; no Production/staging/D1 authority.

Delivered: selected Staff's Thu nhập tab has a truly private read-only Compensation surface. No salary API is called on Directory, Quick Peek, Overview or initial tab mount; user must explicitly click Hiện. Core `boApi.staffCompensation(staffId, centerId)` enforces permissions/scope and determines current/historical/scheduled intervals. Rows are additionally filtered by selected Staff ID. No salary values, even counts, are shown before authorized reveal. Generic denial avoids leaking details. Hide, center-scope change, tab unmount, pagehide, background/visibility change and target switch invalidate stale asynchronous results. Existing `createStaffPrivateRevealFence` reused, no browser storage or telemetry. Edit/correct flows remain at existing `/bo/workforce/compensation` UI with Core authorization.

Local evidence: TypeScript PASS; targeted ESLint 0 errors (one existing refresh-hook warning); scoped-fence unit tests 2/2 PASS; diff check PASS. GitHub exact-head CI after push. Authenticated private/salary integration E2E and Founder Production manual proof not claimed (optional premerge diagnostics per PAP-512).

Risk note: link into canonical module is not automatically Staff-prefiltered; user must select Staff there. No uncontrolled inline edit. FC1 must validate ACL/privacy, correct staff scope and actual current main, PAP-507 waiver, exact-head CI, staging CD off and verified merge SHA before marking Jira Merged. Other PAP-779 PRs change StaffManagementView and may need single-writer rebase.
