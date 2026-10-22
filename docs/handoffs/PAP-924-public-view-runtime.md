# PAP-924 — BO Public Views Runtime + React Tab Entry (Developer Source Handoff)

## Founder contract and safety
Approved UI: Epic PAP-879 / i3 prototype PAP-885 V2.3. This is a **DEV source slice** only: no existing `BoDataGrid` source was modified, no BO route was converted, no Core API was called with real credentials, and no staging/production changes occurred. FC1 remains sole merger under PAP-512. No automatic queue reprioritization.

## Dependency graph
Team #712 (state manager) → #713 (serialized update queue) → #714 (Core HTTP client) → **this PR** (runtime/React Tabs); Core #1801 must land separately and pass permission/security admission before live integration. Earlier Team PRs are DRAFT and have to merge in strict order; stacked PRs may temporarily target main for exact-head CI but include ancestor commits. Recheck actual changed-file delta and head CI before each merge.

## New files only
- `lib/bo-public-view-runtime.ts`: class `BoPublicViewRuntime` with `load/select/edit/flush/create/rename/remove/reorder/resolveUpdateConflict/dispose` and subscription notifications, composed from PAP-887's pure state, Core-client and queue. Authorized Manager writes are versioned and serialized; Staff editing is local-only. Create uses provisional client ID only for constructing a snapshot, then selects the durable Core UUID from the authoritative response and reload. On 409 the runtime fetches Core view definition, holds and presents a discard/reapply choice; no silent retry.
- `lib/bo-public-view-runtime.test.ts`: 9 integration-style unit tests with in-memory fake Core HTTP: two Managers conflict/reapply, Staff deny, snapshot create ID mapping, CRUD/order/version, local observer safety, dispose and no retry on failed create.
- `app/bo/components/data-grid/useBoPublicViewRuntime.ts`: small React subscription hook with read-load lifecycle.
- `app/bo/components/data-grid/BoSharedViewTabs.tsx`, `bo-shared-view-tabs.module.css`: reusable dense public view tabs component: Tất cả, + snapshot, rename/delete accessible menu and context-click, drag-tab order, keyboard move left/right. No user-private views.

## Verification
- `node node_modules/tsx/dist/cli.mjs --test lib/bo-public-view-state.test.ts lib/bo-public-view-update-queue.test.ts lib/bo-public-view-core-client.test.ts lib/bo-public-view-runtime.test.ts` **41/41 PASS**.
- Targeted strict TypeScript including `next-env.d.ts` and React/CSS module imports: **PASS**.
- Local lint cannot resolve a pre-existing incomplete i5 junction `eslint-config-next/core-web-vitals`. Use PR exact-head required Team CI to establish real lint/build truth. Do not claim local lint PASS.

## Required FC1 next acceptance
1. Revalidate all dependent Draft PR heads (#712/#713/#714) and Core #1801, merge only after normal PAP-512 admission and security/migration safety. No prior PR may be skipped while merging this stacked branch.
2. Integrate the runtime and tab component into the **real shared `BoDataGrid`** only when PAP-874 owner hands over. Preserve V2.3 compact table, first-cell tiny opener, property-level editing, Settings controls, responsive behavior. Do not build a second grid library.
3. Connect BO login/BFF to approved Core origin; secure bearer/permissions; Core `bo.shared_view.manage` Manager grants and module read ACL. Never trust local Manager role alone; Staff 403 must be a Core denial.
4. Add settings drawer for typed filter/group/property visibility/dragged columns, no technical controls outside Settings, URL state and Full Detail skeleton via PAP-882.
5. Ensure pending update queue cannot be bypassed by reload/select during in-flight changes; UI must show unsaved/error state. Implement persisted create/rename/delete/reorder version/ID reconciliation and prevent concurrent structural commands across multiple browser tabs. Current runtime serializes within a single instance only.
6. Validate two-device persistence plus proper read ACL, 409, unauthorized module/salary privacy; remaining Core module allowlist coverage is owned by PAP-923. No authenticated E2E required as a *pre-merge gate* under PAP-512 but genuine security defects remain merge blockers.
7. Prototype i3 offline during this implementation; alignment based on recorded PAP-879/PAP-885 contract. Authoritative visual review on a real BO route has **not** been claimed.

## Terminal boundary
Clean pushed worktree + Draft PR + exact-head CI + Jira receipt = completion of **this new source slice only**. PAP-924 stays **In Progress** until real React Table/Drawer integration and module acceptance. No Stage/Prod/merge authority implied.
