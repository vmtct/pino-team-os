# PAP-1912 — Global TDD Detail Parity P0 (BO / HO / TOS)

**Keeper:** PAP-1491 — SPEC-UNLOCK. **Jira:** PAP-1912 — Global TDD Detail Parity P0: tabs/CSS and deep-link reload gate BO/HO/TOS. Derived from PAP-1907 — BO Subscription Detail CSS + business tabs regression. See PAP-184 (SOP), PAP-1088 (BO technical), PAP-1055 (E2E), PAP-1867 (independent Table Toolbar P0).

## Why this is a hard gate

PAP-1907 shipped with DetailFrame `legacyContent` bypassing its native tablist, role=tabpanel and CSS shell, even though earlier CI passed. A subsequent fix restored the tabs but real Manager Staging G4 showed `?record=…&tab=specialty` reload went to Quick View instead of Full Detail. Both regressions must be caught before Founder acceptance for **any module**, not only Subscription.

## Lane 1 — Mandatory CI source/architecture P0

Every Team PR and Main commit runs `node --test scripts/pap1912-detail-parity.test.mjs && node scripts/pap1912-detail-parity.mjs` from `PR Validation`, without credentials.

- Source scan covers actual `app/bo/**`, `app/ho/**`, `app/tos/**` and shared `app/components/workspace-renderer/**` TSX consumers, **not** stale prototypes.
- Every `DetailFrame` callsite must be in `config/pap1912-detail-parity.json` with exact source path, usage count, Jira, contract mode. New or increased callsite count without registration is **FAIL**; new consumers additionally require executable live G4 contract metadata.
- Native Detail must preserve shared hero/cover, tablist, selected/ARIA, roving keyboard, tabpanel and body/panel. `legacyContent` cannot silently replace the native shell. Only the two pre-existing Parent `BoParentReadTabs` adapters are explicitly grandfathered under PAP-1384; no new exception without a named Jira and separate Founder gate.
- Registered business tab IDs/labels must match their canonical manifest. Subscription immutable record URL contract requires selected-Center attestation and a branch that routes **URL reload to Full Detail** while **Table click opens Quick View**. A `?record` URL cannot render a Drawer as a substitute for a Detail.
- Mutation tests actively delete the tablist, panel, labels and route/Center barriers and **require** failure. CI must fail closed on any error or unregistered Detail. A static pass proves only the source contract; it is **not** live UI acceptance.

## Lane 2 — Real served Detail G4 (before Founder G3/FSG)

The module's epic must record `TDD_DETAIL_PARITY_P0_LIVE_PASS` for the exact **independently verified** Cloudflare Staging SHA and actual i5 authoritative prototype (for BO Subscription: `http://192.168.1.6:8800/bo/#subscriptions`). Proof is on the **real** authorized BO/HO/TOS app and selected Center, not an isolated mocked browser fixture, unauthenticated Chrome port or screenshot alone.

Check the same source identity and rendered shared shell on widths **320, 390, 768, 1024, 1440, 1920**: visible hero, tablist/tabpanel (ARIA selected/controls/labelledby), the declared complete business tab set, property layout, no page horizontal overflow, native keyboard navigation, click each tab, refresh/direct `?record&tab`, browser Back/Forward, Back to Table, selected Center positive plus foreign/missing/unauthenticated fail-closed responses. Collect bounding boxes and safe screenshots; no business writes; clean up temporary E2E Chrome tabs. Founder effective role/Center G4 and PAP-1867 Toolbar P0 are **independent** and must also pass where applicable.

Supported i5 read-only runner for registered **BO Subscription**:
```powershell
$env:PAP1912_DETAIL_G4='1'
$env:PAP1912_MODULE='subscriptions'
$env:PAP1912_SERVED_SHA='<40-digit SHA obtained from independent Cloudflare deployment GET>'
$env:PAP1912_DEPLOYMENT_ID='<Cloudflare deployment id for same SHA at 100%>'
node scripts/pap1912-detail-live-cdp.mjs
```
The runner refuses CI/unapproved use, unregistered modules and absent deployment evidence; it opens a **new temporary page on i5 Chrome Manager port 9335**, makes only read requests, checks the complete tab/geometry/reload/ACL flow and closes the page even on failure. A new module must add its own typed G4 metadata and safe runner support (or report `NOT_RUN`); copying Subscription assumptions to another role/Center is forbidden. The runner records supplied Cloudflare deployment evidence but **does not independently call Cloudflare**: the Epic keeper must attach verified API readback and exact GitHub Staging CD run.

## Gate statuses

- `TDD_DETAIL_PARITY_P0_STATIC_PASS`: CI/source checks green **only**.
- `TDD_DETAIL_PARITY_P0_LIVE_PASS`: authentic i5 served-G4 proof + independent served SHA and required negative checks, no writes/errors.
- `FAIL / NOT_RUN / UNKNOWN`: **BLOCK_FOUNDER_PRESENTATION**, no waiver inferred from Table Toolbar approval or other module's G4.
- Read-only panel on an incomplete backend must disclose its pending state. Never restore an unscoped legacy writer merely to satisfy tab visibility.

No Production. Reviewer: `N/A_BY_SOLO_FOUNDER`. QA synthetic fixtures do not require Founder approval; code mutation always needs its Jira and standard protected PR, Main CI and guarded Staging CD.
