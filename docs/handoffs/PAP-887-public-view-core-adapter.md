# PAP-887 Team OS — Public Shared View Core HTTP adapter (DEV handoff)

Date: 2026-10-22. Parent epic PAP-879; Founder-authoritative prototype PAP-885 (i3 offline at this handoff).

## Isolated ownership
- New i5 worktree: `D:\PINO\worktrees\pap887-core-api-adapter-20261022`.
- Branch: `dev/pap887-public-view-api-adapter-20261022`.
- Stacked base: Team Draft PR #713 at `7cfdcd29c1e5668f0c732fea82106df9c6c2bf0f` (which itself depends on #712 state model at `763e84b1`).
- Only NEW files: `lib/bo-public-view-core-client.ts`, `lib/bo-public-view-core-client.test.ts`, this handoff doc.
- Core dependency: Draft PR https://github.com/vmtct/pino-core/pull/1801, PAP-886 (still under CI/acceptance). Do not merge/ship or connect production before Core acceptance and authorization checks.

## Transport contract
- Inject explicit Core BO-surface API origin, bearer supplier, role, moduleKey, allowedFields, and optional `fetch`; no tokens/env discovered or persisted in this module. HTTP must be HTTPS except loopback-only development.
- `list`: reads public module views and validates output UUID/version/module/schema, sorted by order.
- `create`: sends name and config, ignoring client temporary ID. Caller must replace temp ID with Core-generated durable UUID in state after response.
- `update`: versioned PATCH, returns validated authoritative row to the existing serialized update queue (PR #713), surfaces 409 in `BoPublicViewHttpError.status`. Never auto-retries.
- `rename`, `remove`, `reorder`: narrow versioned commands with strict reply checks and no silent retry.
- Staff role: local edit only, **all writes are rejected before token lookup/network**. This does not replace Core server ACL: Core must verify session, module read entitlement and separate GLOBAL `bo.shared_view.manage`.
- Response body is parsed only on success and never echoed in thrown errors; no private owner model or direct domain data transport.

## Proof
`node node_modules/tsx/dist/cli.mjs --test lib/bo-public-view-state.test.ts lib/bo-public-view-update-queue.test.ts lib/bo-public-view-core-client.test.ts` => **32/32 PASS** (11 state, 11 queue, 10 transport).
Targeted strict TypeScript check => PASS. Exact-head CI proof and PR link recorded in Jira final receipt.
No UI/browser or live Core tests claimed.

## FC1 next mandatory steps before merge / live rollout
1. Complete PAP-886 Core PR #1801 exact-head CI; test authenticated Manager/Staff reads/writes against actual deployed Core in isolated staging, including reject 403, stale 409, cross-module 404/400 and no role escalation.
2. Align Core allowed field contracts and permissions with Team OS module schema. Core MVP initially maps seven module keys; do NOT assume the other BO modules are authorized or deployed.
3. Wire this client to existing BO authentication/BFF or authenticated Core transport. **Core host must resolve to approved BO surface in production**; no synthetic `x-pino-team-surface` header on production.
4. Connect state, queue and client into canonical BoDataGrid (PAP-874) and common shell (PAP-882), with optimistic pending/error/conflict UI and local Staff draft behavior. Remap temporary IDs upon Core-created views.
5. Add serialized command paths for create/rename/delete/reorder and reconciliation of old order/version to avoid concurrent local writes. Do not emit mutations for Staff even if UI is tampered with; Core is authoritative.
6. Cross-device public persistence + role checks + business acceptance; keep PRs Draft until that proof. FC1 sole merger under PAP-512, with #712 before #713 before this stacked Team adapter PR.
7. Schema migration 0138 is only on test D1 at handoff, NEVER production by this conversation.

This is DEV source handoff, not full BO module rollout or approval to stage/ship.
