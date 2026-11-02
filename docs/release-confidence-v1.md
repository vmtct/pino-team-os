# PAP-867 — Release Confidence V1

TR-39 shipped green CI with BO navigation / protected-host / API facade 404 regressions. TR-40 repaired these routes but an earlier recovery guard scanned unbounded GitHub workflow history, exhausting upstream API capacity. PAP-867 provides **CI contract coverage**, **independent post-deploy read-only perimeter smoke**, and **fail-closed bounded recovery inventory**.

## DEV / MERGE
- `bun run test` automatically tests BO navigation (including children) against real Next app pages, exact BO/TOS host boundary and local BO authentication coverage, and critical BO API facade and handler registration. Test fixtures intentionally include missing pages/handlers.
- `node --test scripts/release-confidence-smoke.test.mjs scripts/release-confidence-guard.test.mjs` is required in PR CI. The guard's mock-gh tests run on Linux in GitHub Actions, checking no unbounded pagination, provider 502, live Core overlap, >100 post-checkpoint runs and unresolved recovery.
- No browser/CDP/Production authentication, visual E2E, staging or real Production credentials are needed for merge. Existing PAP-512 exact-head CI, Founder authority, owner/single-writer, PAP-507 truthful waiver apply.

## SHIP (separate authorization)
- The Team release workflow retains its existing immutable SHA/version/deployment/Core-binding and rollback/security/Founder permit gates. **No Production release is initiated by PAP-867.**
- A **separate** workflow named `Release Confidence Post-Deploy Read-Only Smoke` listens to successful completion of `Team Runtime Production Release` and uses an issues:read token to recover a github-actions[bot] PASS receipt matching **exact Team SHA + run ID + Worker version + deployment ID + 100% traffic**.
- Fixed GET-only checks: BO staff login, anonymous BO menu redirect to Staff login, anonymous private BO API 401/403, and BO UI/API isolation on TOS hostname 404. No secrets are forwarded to BO/TOS, no authenticated product data is fetched, and no business/financial/TV data is mutated.
- Stores JSON result `PASS / FAIL / NOT_RUN` as an artifact named for the release run. Failure is signalled in its own job, but **never gates promotion** or changes Release Verified. An inaccessible/missing exact receipt emits `NOT_RUN`, never PASS.
- Authenticated Manager page/UI functionality, visual parity, payload semantics, financial operations, and Founder Product Acceptance remain `NOT_RUN` until specifically performed and recorded separately (PAP-855/Notion).

## Core recovery guard
- Retains immutable historical all-scan baseline Team evaluator #694 (run 39549944942) with github-actions[bot] attested PASS.
- Core active `queued/in_progress` workflows are checked every time and block with `CORE_OVERLAP`.
- Completed-risk inventories are server-filtered by conclusion and checkpoint, fetched with **one page maximum** per query; if total_count exceeds 100, **fail closed** with `CORE_RECOVERY_LEDGER_CAPACITY_EXCEEDED` and require a new independently verified checkpoint before further release.
- Failed run comment inventories are capped by authoritative issue comment count; unresolved `RECOVERY_ARMED` requires a recognized bot resolution marker, otherwise block `UNRESOLVED_RECOVERY`.
- GitHub API failures have bounded retries (max 3) and specific `CORE_RECOVERY_GITHUB_RATE_LIMIT_OR_FORBIDDEN`, `CORE_RECOVERY_GITHUB_PROVIDER_UNAVAILABLE`, or `CORE_RECOVERY_GITHUB_READ_FAILURE` messages. No error is treated as a clean recovery.
- The bounded checkpoint cap is a **fail-safe capacity limit, not an automated checkpoint advancement service**. Upgrade checkpoint only through a separately verified full-history/carry-forward audit. Never widen the query or silently truncate due to capacity.

## Authority and evidence
`Release Verified` != `Product Smoke PASS` != `Product Accepted`. The read-only observer does not confer release/staging/D1/Access mutation authority and cannot create/finalize production business transactions. Security perimeter failures remain release safety evidence under PAP-185; this observer is supplemental, not a replacement for the release's existing security gates.
