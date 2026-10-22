# BO Design System V2.3 — Foundation Lock

**Accountable existing Jira:** PAP-874 shared UI, PAP-889 parity/contract tests, PAP-927 architecture enforcement, under PAP-879. No new Epic. **Authority:** Founder-approved PAP-885 prototype 2026-10-21, pinned by `docs/bo-v23-ui-authority.json` (13 SHA files). Pilot: PAP-891 Students and PAP-893 Classes.

## Safe rollout
`app/bo/design-system/foundation.css` is imported by `app/bo/layout.tsx` and applied **only** inside `[data-bo-design-system="v23"]` on `BoShell`. No `:root`, html or body changes, so other apps (TOS, Founder) remain untouched. The shared BO Shell and BO DataGrid bridge to the new semantic vars with **original production values as fallback**. This patch does not force a mass change to all legacy screens.

## Token contract

| Layer | Variables | Founder prototype target |
| --- | --- | --- |
| Colors | `--bo-v23-color-*` | Semantic canvas/surface/text/accent/status/focus; V2.3 lavender and neutrals |
| Typography | `--bo-v23-font-*`, `--bo-v23-line-body` | Heading 30px; table body 12px, captions 11px |
| Spacing | `--bo-v23-space-{1,2,3,4,5,6,8}` | 4/8/12/16/20/24/32 px |
| Radius | `--bo-v23-radius-{xs,control,surface,popover}` | Dense input/table/sidebar grammar |
| Control density | `--bo-v23-{control-min-height,toolbar-min-height,table-heading-height,table-row-height,opener-column-width,view-tab-height,settings-panel-width,quick-view-width}` | 40/49/35/42/37/43/405/520 px |

**Declaration is not adoption.** The existing DataGrid row is 44px, whereas Founder V2.3 reference is approximately 42px. This patch *does not silently change density*. Existing `BoModuleFactory` still has a V1 read-only drawer; `BoGridFilterSettings` is not yet the full AND/OR/group/columns builder; `BoInlineDraftCell` stages local edits rather than writing Core business truth. FC1 must finish these in shared CP2 then pilot CP3.

## Acceptance checklist

- [x] Scoped and immutable source-level BO foundation tokens, BO-only layout import and Shell marker.
- [x] Existing BO Shell / DataGrid use semantic token aliases with old-value fallbacks, so visual change is opt-in.
- [x] Source verifier + positive/negative fixture tests wired to existing PR Validation job.
- [ ] Consume typography, spacing, buttons, forms, badges, row density, focus, drawer width in *final* shared components; prove representative 390/768/1440 behavior with stable fixtures.
- [ ] PAP-874 fully editable Quick View property sheet (no global View/Edit toggle), first-cell opener, separately copyable ID, typing and ACL.
- [ ] PAP-888 typed multi-rule Settings/group/sort/column visibility + PAP-923/924 Shared Views ACL and PAP-882 tabbed Full Detail.
- [ ] Both actual Students PAP-891 and Classes PAP-893 pass `node scripts/verify-bo-v23-parity.mjs --mode=pilot` **and** real Core ACL/business/unit interaction tests. An AST PASS is not visual/functional parity.
- [ ] PAP-185/TR-41 exact-head release admission and Founder PAP-932 production verdict.
- [ ] Only after explicit PAP-932 APPROVED + independent DEV ownership: PAP-878 full 35-module/nested route adoption, PAP-927 strict factory/legacy enforcement.

## Shared UX grammar

Level-1 entity module lands on one Table grammar. Search stays outside Settings; Settings by **Tạo mới** holds typed filters/group/sort/columns. Tiny first-cell Quick View opener, own readonly/copyable ID column; editable compact Drawer without global View/Edit switch, but Create requires explicit confirmation. Views are **shared per module** (Manager may persist via Core, Staff has local-only transient changes). Shared Full Detail shell handles title, tabs and table-return URL; specialist calendar, CMS editor, Pinoria studio and workforce planner can remain bespoke **inside** detail slots.

Do **not** invent mock business data, Core ACL, persistence, or a second Table family. No new premerge Playwright E2E gate contrary to PAP-512 waiver. Keep current FC1 source ownership; this is a source-only PR handoff.

## Tests

```sh
node scripts/verify-bo-v23-foundation.mjs
node --test scripts/verify-bo-v23-foundation.test.mjs
node scripts/verify-bo-v23-parity.mjs --mode=report
```

First two certify **source foundations** only; last shows pilot gaps without blocking incremental FC1 work. Full pilot source parity is `--mode=pilot`; visual/interaction proof and Founder acceptance are separate.
