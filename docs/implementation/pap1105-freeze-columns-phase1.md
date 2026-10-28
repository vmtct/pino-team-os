# PAP-1105 — TDD Table Freeze Columns | Phase 1 Implementation

## Authority and baseline
- Epic PAP-1067 / Story PAP-1105 (Founder-approved 2026-10-28).
- Team OS main base `dcc8029f3101b2dbd6b52d51845fffb5c03c6880` (CI SUCCESS).
- PR #955 / PAP-1070 remains separate and unchanged; this worktree does not depend on unmerged adapters.
- Shared TDD Table only; BO and HO, not TOS. This is **Phase 1 WIP, NOT FULL FEATURE ACCEPTANCE**.

## What this phase implements
- Optional typed `TableQuery.frozenThrough`; validated registered/visible/authorized non-Identity column.
- Backwards-compatible legacy state converter (missing freeze stays missing) and protected pinned Quick View/Identity.
- Context menu on TDD Table header (right-click and accessible button / Shift+F10), Freeze through column / Unfreeze from column.
- Measured contiguous sticky prefix with real DOM widths via ResizeObserver; narrower viewports suppress optional frozen columns to retain scrollable area with a visible notice.
- TDD-only shared CSS source `app/components/workspace-renderer/tdd-freeze.css` is compiled via the two authorized BO/HO scope pipelines into `bo-scoped.css` and `ho-scoped.css`. Frozen historical asset hashes and `app/globals.css` remain unchanged. Grandfathered legacy Tables do not gain new controls.
- Local session Custom View state carries Freeze in the view snapshot; switching All or built-in view uses its own state; Undo/reset propagate query normally.
- Server-backed Custom View writes containing Freeze are explicitly rejected in the TDD Table UI rather than pretending durable persistence; no silent filter/column rewrite.

## Confirmed external dependency
Current Core/Team shared-view config uses:
`search, sort, filters, logic, groupBy, hideEmptyGroups, columns:{order,visible}`.
There is **no persisted frozenThrough field** and current generic service may silently omit unknown state. The Core Shared Views canonical spec, validation, write CAS/versioning, and BO/HO adapter translation must be extended and independently staged before enabling durable custom view Freeze.
- Core feature owner: PAP-886/887 Shared Views.
- Current PAP-1070 PR #955 `lib/workspace-adapters/views.ts` is not in this main-based branch; reconcile its `toSharedConfig/fromSharedConfig` only after PR #955 merges. Add explicit fail-closed persistence guard there, with positive Core-backed read/write tests once supported.
- HO currently has no authorized persistent Shared Views endpoint; do not synthesize one.

## Acceptance still required
- Exact-head CI, full tests/TS/lint/build.
- Browser measured G3: 1440, 1024, 768, 390, 320; scroll, width/resize/hover, menu focus, keyboard/touch, no overlaps.
- Core + Team Saved View round-trip with authorized CAS and permission/scope checks; real BO/HO staging G4.
- Review by GPT for geometry, a11y and security, then controlled merge/CD. No Indie review.
- **STOP BEFORE MERGE; DRAFT PR**. Production not touched.

## Test receipts
- Initial three-file TDD suite: 114/114 PASS. Expanded 7-file Freeze/BO style/HO style/embedded Subscription/TDD suite: 129/129 PASS after fixing first CI run 40628438055 (2 DOM/style contract failures).
- `node scripts/build-bo-authority.mjs --check`: PASS.
- `node scripts/build-ho-authority.mjs --check`: PASS.
