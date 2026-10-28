# PAP-1073 — G3 measured geometry / screenshot evidence (first source slice)

Jira: https://vmtct97.atlassian.net/browse/PAP-1073. Parent: PAP-1067. Status: In Progress; this PR is **NOT** G3 final visual acceptance.

## What is actually tested

- A Node/tsx fixture generator (`scripts/render-tdd-g3-fixtures.tsx`) invokes the **real shared TddTable, TddDrawer and TddDetail** React renderer to produce six static fixture documents for BO and HO. It reads checked-in BO `public/bo-authority-source/styles.css` and HO `public/ho-authority-source/ho-scoped.css`. No fake shell markup, no new app route, API, worker, ACL or persisted fixture data.
- Playwright Chromium (`e2e/tdd-g3-geometry.spec.ts`) measures computed DOM at **1440, 1024, 768, 390, 320px**, across BO/HO and all three TDD shells. It asserts containment, no horizontal body overflow, Table controls and bounded row height, Drawer usable property value width, Detail hero, tab visibility/tabpanel attachment. Each test attaches a screenshot for Table, Drawer and Detail plus JSON metrics to the test report (30 stage measurements, 30 PNG, 10 JSON).
- Negative controls deliberately set Drawer property-control width to **92px** with correct outer Drawer width (PAP-1029) and detach a Full Detail tabpanel/overflow tablist. The shared metric policy rejects both.
- New dedicated **path-scoped** `.github/workflows/tdd-g3-geometry.yml` runs the generator then Chromium and uploads screenshots/metrics as artifacts. It triggers only for shared renderer/schema/authority styles, this test or its workflow, not grandfathered unchanged legacy routes. It has read-only GitHub permissions, no Staging/Production credentials.
- **2026-10-28 evidence retention repair:** The first green CI #40676624525 incorrectly had **zero downloadable artifacts**: Playwright cleaned successful test attachments from `test-results/`, and the upload step allowed missing files. The follow-up writes PNG/JSON to a durable `artifacts/pap1073-g3/<surface>/<viewport>/` folder, separately attaches the saved path to the test report, runs `scripts/verify-tdd-g3-artifacts.mjs` to require **30 valid PNGs + 10 complete geometry JSONs**, and fails CI if upload inputs are absent. Only the new exact-head CI receipt can prove this fix. These screenshots remain **unapproved review evidence**, not visual goldens.

## Runbook

```shell
npm ci
npm run typecheck
npm run tdd:g3:fixtures
npm run tdd:g3:test
```

Windows i3 browser cache may point to stale `D:\PINO\cache\playwright`. For local tests only, set `PLAYWRIGHT_BROWSERS_PATH` to the installed `%LOCALAPPDATA%\ms-playwright` cache; CI installs Chromium explicitly. Do not commit machine-specific paths.

## Remaining for full G3 acceptance

1. Review versioned screenshots and decide baseline ownership/golden promotion with Founder; currently captures are **review artifacts**, not approved screenshot-golden diffs. Numeric DOM assertions do gate failures.
2. Migrate tests from in-memory SSR fixture documents to authenticated BO/HO Staging pages once S0 PAP-1068 confirms deployed route inventory and module eligibility. Maintain distinct contracts for exact Founder-special screens and grandfathered legacy; do not require TDD shell on approved special routes.
3. Extend geometry tests to actual sticky/pinned Quick View + identity widths and PAP-1105 Freeze (when UI merged), cell-editor placement, toolbar settings, scroll restoration, real DOM font loading, and full native mobile interactions. The 5-viewport scaffold does **not** claim these pass.
4. G4 PAP-1074 must establish actual authenticated BO/HO serving-SHA/role/Center truth, 401/403/404, and end-to-end navigation; no G4 claim from SSR fixture tests.

## Team Surface Decision

```yaml
surface: DUAL
primary_device: DESKTOP
tos:
  app_family: NONE
  entry_context: Test only; no TOS navigation
  footer_items: []
  theme: Existing
  primary_action: NONE
  capture_requirements: NONE
bo:
  sidebar_group: Existing
  subnavigation: Existing
  primary_layout: TABLE
shared:
  permission_context: BO authorized center / HO authorized global in deterministic in-memory schema (not real ACL)
  cross_domain_links: NONE
founder_layout_review: APPROVED
```
