# PAP-887 — Public Saved Views transport queue (stacked DEV slice, 22 Oct 2026)

Parent: PAP-879, UI Authority i3 V2.3 (prototype source backed by PAP-885, i3 currently offline).
This is a **standalone Team OS queue**, not a Core API, React integration, or production release.

## Stacked source / ownership
- Base Draft PR: https://github.com/vmtct/pino-team-os/pull/712, branch `dev/pap887-public-views-v23-recovery-20261021`, base exact SHA `763e84b1f2cbf63e53c240ceb21d511b4557a234`.
- This slice branch: `dev/pap887-public-view-sync-20261022`; isolated local i5 worktree `D:\PINO\worktrees\pap887-view-sync-20261022`.
- Source changes: **new files only**: `lib/bo-public-view-update-queue.ts`, `lib/bo-public-view-update-queue.test.ts`, this doc. Existing BoDataGrid/SidePeek and state model from #712 untouched.
- Do not merge stacked child before parent or delete dependency branch prematurely. FC1 remains sole merger under PAP-512.

## Intent / safety
- Input is only `BoViewUpdateIntent` emitted by the PAP-887 **Manager-authorized state model**; Staff local drafts produce no intents. Server-side Core still MUST verify permission/module/field/version/auth and audit.
- Globally single-flight requests for this queue instance; newer changes for same view coalesce before send, and while in flight the next request adopts **Core's acknowledged version**.
- Explicit `409` leaves affected view in `conflict` state; caller surfaces server config and user chooses `resolveConflict(discard|reapply)`. No silent optimistic overwrite, no auto-retries. For network/rejection `retryRejected` is an explicit action only; Core idempotency/versioning is required because an unknown response may represent a committed write.
- Callback exception after an acknowledged Core write is **observer fault**, never categorized as failed persistence or replayed.
- Missing features by design: Core fetch/save URL, authentication, React hook/controller, multi-tab polling/subscription, scope-granted API, actual browser UI, durable ID creation/rename/delete/reorder transport; those remain in PAP-886/887 integration.

## Exact reproduction
`node node_modules/tsx/dist/cli.mjs --test lib/bo-public-view-state.test.ts lib/bo-public-view-update-queue.test.ts` => 22/22 PASS.
`node_modules/.bin/tsc.cmd --noEmit --strict --target ES2017 --module esnext --moduleResolution bundler --skipLibCheck --types node --lib es2022,dom lib/bo-public-view-state.ts lib/bo-public-view-update-queue.ts lib/bo-public-view-update-queue.test.ts` => PASS.
Shared dependency junction on i5: D:\pino-work\pino-team-os\node_modules (not tracked).
Full PR CI is authoritative for lint/build/repo tests.

## FC1 continuation
1. Rebase/synchronize after #712 is admitted and merged (or merge as stacked PR in correct order). Read exact GitHub head and CI.
2. Implement the actual Team OS transport adapter that calls PAP-886 Core routes with Manager auth and version, and view-state reconciliation `acknowledgeBoPublicView/conflictBoPublicView`.
3. Add serialized command paths for create, rename, delete and reorder (queue here intentionally handles *only update intents*); ensure server-generated durable IDs and true transaction semantics.
4. Add Manager/Staff role and two-device Core integration tests; preserve user-private absence, optimistic conflict UX, permission-filtered entity data.
5. Wire Settings/public tabs to PAP-874/882 canonical components. Do not auto retry Core errors or use generic entity update APIs.
6. No pre-merge browser E2E admission requirement under PAP-512 (optional debug only); exact-head required CI + security remains mandatory.

Boundary: committed/pushed new branch and Draft PR with CI readback; **not merge-ready** until PAP-886 Core, client integration and needed tests.
