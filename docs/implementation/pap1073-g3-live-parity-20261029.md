# PAP-1073 — Local live BO/HO G3 geometry reconnaissance (2026-10-29)

**Status: provisional technical evidence, not G3 terminal acceptance.** Founder-approved fixture goldens are pinned under docs/visual-goldens/pap1073/run-40811677302 (30 PNG + 10 geometry JSON, Actions run #40811677302).

## What was measured

Local Founder-authorized Chrome profile (i5, port 9337), using a fresh temporary direct CDP page-target. No cookies, tokens, credentials, screenshots, traces or PII were exported. Only Quick View and Full Detail navigation buttons were clicked; no write APIs were invoked. Playwright browser-level connectOverCDP timed out at 15s and 60s even though a direct page CDP WebSocket succeeded. That is an inspection-transport limitation, not a proven UI defect.

| Live route | Provisional S0 classification | Measured stages | Result |
| --- | --- | --- | --- |
| BO /bo Students | TDD_PARTIAL — existing Table plus shared Drawer and Detail | 5 viewports × 3 stages | **15/15 PASS** |
| BO /bo?module=parents | TDD_PARTIAL — existing Table plus shared Drawer and Detail | 5 viewports × 3 stages | **15/15 PASS** |
| HO /ho/staff | TDD_COMPLIANT candidate — shared Table, Drawer and Detail | 5 viewports × 3 stages | **15/15 PASS** |

Viewports: 1440, 1024, 768, 390 and 320px. Checks: document overflow, Table row height/search, bounded Drawer, usable property-value widths, Detail hero, tab/tabpanel ARIA linkage, and actual navigation. BO existing Table is tested as grandfathered and must not automatically fail merely for lacking the data-tdd-shell="table" attribute. The BO Subscriptions module was not covered by these three journeys; do not infer coverage.

Sanitized numeric receipts: docs/implementation/evidence/pap1073-live-20261029/ (three files, 45 results, no PII). Optional local audit scripts: scripts/run-tdd-g3-ho-live-readonly-cdp.mjs and scripts/run-tdd-g3-bo-live-readonly-cdp.mjs. These require G3_LIVE_CDP_APPROVED=1 and explicitly refuse CI execution.

## Provenance and open acceptance gates

The Staging Worker changed between observations (one prior SHA 728cc134676effd94631a5dc259c03f55a452b99; later d2cca9130ae8be0dba1d37abae2c40ad02b624f7). The local CDP sessions did not independently attest serving SHA before **and after** each run. Accordingly **none of the 45 passes is exact-serving-SHA terminal G3/G4 evidence**. Record independent Main CI, guarded CD, Cloudflare traffic and serving SHA after the deployment stabilizes, then rerun.

Still outstanding: pixel-level comparison of real BO/HO Staging to the authoritative prototypes (HO local prototype at http://127.0.0.1:3562/prototype was reachable), full deployed-module classification denominator under PAP-1068, exact SPECIAL_SCREEN register (PAP-1085), grandfathered migration waves (PAP-1086/1087), and live keyboard/screen-reader coverage.

## Automated fixture visual regression

The G3 workflow now compares regenerated screenshot **pixels** with the exact Founder-approved 30-image baseline, after existing DOM and evidence integrity checks. It uses RGBA decoded pixels, 28 channel-value tolerance and **at most 1% visibly changed pixels per image**. Every approved source PNG/JSON must still match its pinned SHA-256 in the manifest; the workflow does not rewrite goldens. CI uploads new screenshots even on failure for explicit human review. A fixture golden match is never a substitute for authenticated G4 or Production release.
