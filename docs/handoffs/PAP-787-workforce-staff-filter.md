# PAP-787 — Shift Role / Staff Workforce deep-link fallback

Source: PAP-779/PAP-787. Staff Detail Phân công shows immutable Staff ID and links to `/bo/workforce?staff=<encoded canonical Staff ID>`. Existing Workforce planner now honors that URL filter on **already Core-authorized Center/TermWeek weekly planning data**; it shows only the selected Staff matrix row, no fabricated shifts or global worker search. Operator can switch Center and TermWeek under existing permissions, or clear filter; absent Staff is an explicit scoped empty state. No new backend API/DB or duplicate duty/shift ledger.

Canonical truth: `boApi.workforcePlanning(centerId, termWeekId)` existing read projection of shifts, templates, role assignments and class responsibilities; Shift Role is per shift assignment, not permanent Staff role. Staff-specific full cross-center history aggregation does not exist; deep-link fallback is explicitly permitted by PAP-787 acceptance. No claim of global upcoming/recent search or joined multi-center roster.

Evidence: target test `lib/bo-workforce-staff-filter.test.ts` 1/1 PASS. TypeScript/ESLint/diff and exact-head CI must be rechecked after new commit. Browser/Production manual visual proof not claimed; optional premerge under PAP-512.

FC1 sole MERGER: PR #677 head after next push, current main/base, PAP-507 waiver, security/scope protection, disabled staging CD, actual merged SHA. WorkforcePlanningView must be reconciled against any other live Workforce in-flight owner; no force push on unrelated branches. No staging/Production/D1.
