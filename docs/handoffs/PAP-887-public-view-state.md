# PAP-887 DEV handoff: BO Public Saved Views

**Founder UI Authority:** PAP-879, i3 V2.3 http://192.168.1.22:8791/playground.html
**Ownership:** this conversation DEV only, FC1 sole merger; no stage/ship/Core or live D1.
**Branch:** `dev/pap887-public-views-v23-20261021`
**Worktree:** `D:\PINO\worktrees\pap887-public-views-20261021`
**Base SHA:** `73b6116271d7d7651c06ee39777f670ed9913c2d`

## This DEV slice
New files only: `lib/bo-public-view-state.ts` + `.test.ts` + this handoff. Pure typed immutable state transitions; **no UI/render/network** changes, no existing DataGrid/Drawer edits or PR #708 owner collision.

Exports: `defaultBoViewConfig`, `validateBoViewConfig`, `loadBoPublicViews`, `selectBoPublicView`, `editBoViewConfig`, `createBoPublicView`, `renameBoPublicView`, `deleteBoPublicView`, `reorderBoPublicViews`, `acknowledgeBoPublicView`, `conflictBoPublicView`, `discardBoViewConflict`.

Contract: one **public organization/module view list** (no private owner/user model), explicit selected tab, Manager versioned persistence **intents**, Staff transient local drafts with **no** writes, + snapshot, tab management, safe 409 conflict and stale-ack reconciliation. Configs are validated to a module's allowed field IDs. No Core domain data or ACL bypass.

## Mandatory FC1 continuation
1. Resolve dependency **PAP-886 Core persistence API**, wire server-generated IDs/version/role authorization and audit.
2. Integrate one **debounced serialized transport per view** with PAP-887 React hooks; versioned writes for rapid successive edits must not race or blindly retry a 409.
3. Add PAP-885 V2.3 Tab + / context menu rename/delete / drag reorder UI, Settings and typed filters through PAP-874 shared BoDataGrid and PAP-882 shell; do not create a second table family.
4. Staff can filter temporarily but never save/rename/delete/reorder shared views. Manager only persistence; server enforces ACL.
5. Keep undo local to uncommitted actions. Domain Core owns compensating commands after persistence.
6. Current PAP-874 Draft PR #708 is **outdated** (view/create/edit drawer UX conflicts with approved inline editable Drawer) and CI validate FAIL; reconcile separately before merge. Unrelated Team Drafts #706/#682/#674/#675 belong to active Staff/Camera owners.

## Proof / boundaries
Focused node/tsx test: **11/11 PASS**; targeted strict TypeScript **PASS**. Run via existing i5 dependency checkout `D:\pino-work\pino-team-os\node_modules` (isolated worktree junction to that dependency folder only). No authenticated browser E2E is required as a pre-merge admission gate under current PAP-512. All Core/server/API and React integration tests remain **not run because not implemented**.

Handoff requires clean pushed branch/PR SHA + Jira receipt. No merge/staging/deploy permission follows from this artifact.
