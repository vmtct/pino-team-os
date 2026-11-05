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

## Local authenticated browser smoke without exporting credentials (phase 2)

`npm run tdd:g4:local-cdp` uses two independent **already-authorized** i5 Chrome CDP profiles: Founder `127.0.0.1:9337`, Manager `127.0.0.1:9335`. This is opt-in **local only**, not a CI substitute; sessions never leave their browser profiles. The runner creates and closes only its test tabs, refuses mutating `/api/**` requests in those tabs and never reads/prints cookie, token, localStorage, storageState, student or subscription identity. It also fails closed on missing evidence, stale `origin/main` vs verified Worker serving SHA and missing distinct authenticated accounts. No browser automation against Production.

The operator must **independently verify** actual successful protected main CI + guarded CD and Cloudflare 100% serving exact same main SHA; runner-supplied environment variables are not proof by themselves. Set `TDD_G4_LIVE_CDP=1`, `TDD_G4_LOCAL_APPROVED=1`, `TDD_G4_EXPECTED_MAIN_SHA`, `TDD_G4_SERVING_SHA`, `TDD_G4_MAIN_CI_RUN`, `TDD_G4_STAGING_CD_RUN`; then run `npm run tdd:g4:local-cdp` on i5. The script prints only PASS/FAIL per case and provenance identifiers. Existing live authorized Subscription UUIDv7 is found at runtime; no fixture seeding.

The expanded local-CDP suite now also verifies a real HO Staff Table → Quick View Drawer → Full Detail → three ARIA tabs → back to Table at five viewport widths, plus real BO Student search → Quick View → Full Detail → Subscription tab → Subscription Quick View → Subscription Full Detail with an existing subscribed student and a canonical UUIDv7 record. It never writes fixture data or logs student names/IDs. Every expansion must rerun against a new exact serving-SHA-matched main receipt; an earlier PASS does not validate newly committed assertions.

After local-CDP smoke PASS, outstanding final G4 conditions still include portable secret-safe CI auth (existing `tdd:g4:readonly` runner), route-specific G4 exception acceptance, stronger keyboard/screen-reader accessibility, and Founder-approved G3 goldens. HO native and BO Student→Subscription click routes are now covered in the local runner but **not** yet in the portable CI runner. No false terminal on local-only PASS.

No Production, D1, Core salary/Subscription monetary write, nor automated monitoring.

## Phase 3 — GitHub Actions ephemeral-auth G4 runner (2026-10-29)

- Source: `.github/workflows/pap1074-g4-staging.yml`, `scripts/run-tdd-g4-ci.mjs` and `scripts/pap1074-g4-attestation.mjs`. GitHub environment `g4-staging` is restricted to the `main` branch. Only explicit owner-dispatched jobs on `main` can run; no automatic PR job may use Staging identities.
- Environment secrets to provision from **two independently approved dedicated Staging-only identities**, never copied from Chrome sessions or Production: `TDD_G4_FOUNDER_EMAIL`, `TDD_G4_FOUNDER_PASSWORD`, `TDD_G4_MANAGER_EMAIL`, `TDD_G4_MANAGER_PASSWORD`. All values are managed only by the secure GitHub environment settings; no values appear in tickets, chat, code, artifacts, or CLI output. Required repo secrets `CF_ACCOUNT_ID` and `CF_API_TOKEN` already exist by name; permission for the read-only deployments API must be verified at runtime.
- No browser storageState export/import or account state files. Each CI browser context authenticates with the supported PINO Staff email/password login at the BO and HO Staging hosts. Thereafter all intercepted `/api/**` methods other than GET/HEAD/OPTIONS are blocked. Browser contexts close after checks; no screenshot, trace, or persisted session.
- Fail closed before login unless the checked-out commit equals GitHub's current `main`, both same-SHA workflow runs `PR Validation` and `Team Staging CD (Guarded)` completed successfully, and Cloudflare Workers latest deployment includes the guarded CD run and exposes exactly that SHA at 100% traffic. Externally verified actual user IDs must be distinct.
- Tests include the ten authenticated local-CDP regression journeys as separate independent checks, including actual Student→Subscription and HO Staff Table→Drawer→Detail. Missing fixture data, lost access, or any failing case returns nonzero; the script does not claim PASS from admission alone.
- Local audit 2026-10-29: `node --check` clean, ESLint clean, 8/8 deployment attestation negative-control tests passed. Running the CI script without identity secrets yielded exit 1, `authenticated_ci_admission=FAIL`, which is expected.
- **Remaining gates:** issue two valid Staging-only test users with appropriate Founder-equivalent and Manager ACL; provision four protected environment secrets; merge the test-only PR after passing normal checks; then dispatch G4 on `main` to obtain true CI evidence. No provisioned identities, environment secrets or actual CI G4 PASS were claimed at this writing. Founder-approved G3 visual goldens and broader keyboard/screen-reader acceptance remain separate gates for closure.
