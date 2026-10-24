# PAP-784 — Staff Access role/scope workspace

Epic PAP-779. Depends on PAP-783 source and PAP-782 merged tab shell. FC1 is sole merger under live PAP-512; no staging or Production.

Implementation: Staff status and Access login status are visibly separate on Access tab; assignment list has truthful empty state. Role composer accepts only active non-Founder role IDs and scope IDs present in canonical loaded catalog. GLOBAL requires empty scope ID; CENTER, PATH and RUNNING_CLASS require valid IDs. Existing Core role grant/revoke API and ACL remain authoritative. Founder role revoke prevented at both UI button and action handler; other revokes require explicit confirmation. Role grant/revoke success requires canonical refresh; stale target completion is suppressed if user switches Staff. Role/scope selection and reason reset on Staff change.

Tests: bo-staff-access-scope.test.ts, Node TSX 2/2 PASS; combined PAP-783+784 6/6 PASS, TypeScript PASS, git diff --check PASS. GitHub exact-head CI to follow.

Source branch is STACKED on PAP-783 PR #673 (commit 2048ef7); do not merge this PR before PAP-783. If opened with base main to invoke PR Validation, its diff contains PAP-783 changes until #673 merges; FC1 must rebase/recheck base and exact-head CI after parent merges. Premerge UI/browser E2E optional under Founder PAP-512 decree; no authenticated integration claim. Dangerous credential/offboarding UI is separately scoped PAP-785.

FC1 checks: single source owner, exact head/base, required CI, current PAP-507 waiver, Core Access permission/security, staging CD disabled and true merged readback.