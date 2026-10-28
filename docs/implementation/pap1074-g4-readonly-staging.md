# PAP-1074 — G4 Staging read-only acceptance runner (phase 1)

Shared TDD owner: [PAP-1067](https://vmtct97.atlassian.net/browse/PAP-1067). This opt-in harness is **not** a claim of completed G4; actual authenticated staging tests and approved baseline are mandatory.

## Coverage and non-goals

- Real Staging only, immutable origins `https://bo.staging.pinohouse.art` and `https://ho.staging.pinohouse.art`. Production is not a valid target.
- `/ho/staff` is the **only** admitted `TDD_DEFAULT` module as of the initial source SHA. `/bo?module=subscriptions` is **grandfathered**; its G4 here is a regression of PR #984, not BO TDD pilot compliance.
- No fixture creation, mutation, POST/DELETE, auth spoofing, direct cookie extraction, screenshot containing PII or local CDP session scraping.
- Positive Founder and negative Manager must come from **separate authentic, authorized Staging Playwright storageState files** prepared out of band. Never commit, upload, paste or print their contents.
- Coverage: anonymous BO+HO login guard, Founder HO Staff route, Founder Subscription URL + reload + 5 widths, Manager 403 from live BO API and invalid-record negative. Subscription Enrollment tab and Back/Forward URL history are included as read-only regression assertions. Student→Subscription navigation, deeper ARIA, full canonical TDD Table→Drawer→Detail, and Founder visual approval remain separate acceptance cases; this harness alone cannot close PAP-1074.

## Explicit execution

Before execution, the operator independently checks GitHub **current main** SHA, successful **main PR Validation** run, guarded **Staging CD** run, and current Cloudflare Worker serving 100% of the same SHA. A hand-entered matching env SHA **is not itself sufficient provenance**; record trusted run URLs and live deployment evidence in Jira.

Set environment on an authorized runner, never in repository or output:

- `TDD_G4_RUN=1`
- `TDD_G4_EXPECTED_MAIN_SHA`, `TDD_G4_SERVING_SHA` (both full current 40-char SHA, verified against real API)
- `TDD_G4_MAIN_CI_RUN`, `TDD_G4_STAGING_CD_RUN` (actual successful runs)
- `TDD_G4_FOUNDER_STATE`, `TDD_G4_MANAGER_STATE` (two distinct, private existing Playwright storageState JSON paths)
- `TDD_G4_SUBSCRIPTION_ID` (existing verified authorized Staging Subscription UUID)

Execute `node --import tsx scripts/run-tdd-g4-readonly.mjs`. Missing inputs, stale SHA or missing role fixture cause **nonzero exit**, never an implicit PASS. The broader E2E test runner skips this *opt-in* suite unless `TDD_G4_RUN=1`; skip is NEVER G4 acceptance. Secret-safe G4 CI workflow / authenticated browser provisioning is still outstanding.

## Completed implementation evidence / next wait

- Config unit suite includes valid input and negative controls for missing auth, absent receipts, stale deployment, invented UUID and URL credential injection.
- CI and local typecheck/lint evidence must be added to PAP-1074 after exact-head PR verification.
- Live Stage Worker receipt already independently seen: Team main SHA `7f618690d4fd91611ad0dea0ee0167da25874709`, CI #40710206523 success, guarded CD #40710652581 success, Cloudflare serving that SHA 100%. This is **deployment evidence only**, not authenticated G4 proof.
- **Real external wait:** approved Founder + Manager authenticated browser storageState/secret-safe CI context; do not reproduce accounts or obtain Chrome session tokens through CDP. After authorization, run the suite, fix actual runtime failures, and expand to full PAP-1074 Table→Drawer→Detail, Back/Forward, Student link, 401/403/404, 5 widths and approved G3 goldens.

No Production, D1, Core salary/Subscription monetary write, nor automated monitoring.
