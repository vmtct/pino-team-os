# PAP-788 Staff Training tab — independent DEV handoff

Source: Epic PAP-779 / PAP-788, approved PAP-778 UI, existing Team OS main, no backend/API/schema/ACL changes.

Implemented: Staff Training tab calls canonical `boApi.trainingStaffAssignments(staffId)` only when mounted, uses effect-scoped active guard to suppress responses after Staff change/unmount, and renders actual assignment status, module version, track, assessment, sign-off and qualification. No fake progress, promotion or salary mutation. Loading/error/retry/empty states and link to existing BO Training.

Provenance: TrainingAssignmentDetail from `lib/training-model.ts`; Core remains qualification/sign-off authority. Branch specifics shown only where Core supplies them, not fabricated.

Verified: TypeScript noEmit PASS; targeted ESLint 0 errors (one pre-existing StaffManagementView refresh-hook warning); git diff --check PASS. GitHub exact-head CI to confirm once PR created. Authenticated BO/Core E2E and screenshots not claimed (optional premerge per PAP-512).

FC1 sole MERGER: refresh current base/branch/owner, PR exact-head CI, PAP-507 disposition, security/privacy, staging-CD disabled; merge and read back actual merge SHA/Jira. Other PAP-779 PRs also modify StaffManagementView; coordinate sequencing and rebase without overwriting independent worktrees.
