# PAP-979: Full Detail V2.5 handoff to FC1

Parent PAP-879; pilot adoptions PAP-891 / PAP-893. PAP-512 order unchanged.
Feature-Code: PLT-BO; Feature-Id: bo-operational-read-plane; Project-Code: PRJ-PLT.
Session Founder Codex exception applies; INDIE_WAIVED_BY_FOUNDER (PAP-507), never INDIE_PASS.

## Source and ownership

Developed on Windows i5 DESKTOP-ISRDREN in C:/Users/ADMIN/pino-work/pino-team-pap979, branch feat/pap979-full-detail-v25.
Base is PR #845 exact 347483651a162b26b892d3ed2b73648910250132. This is a separate additive PR against that branch so the review contains only PAP-979 changes. No FC1 worktree/branch was changed or force-pushed. Do not merge #845 unchanged as the final V2.5 delivery; reconcile the dependent commits downstream.
Core reference at 2c782c20. Core dependency proposal PR https://github.com/vmtct/pino-core/pull/1836 (d08058f5f5d474524e58f82db04e32115d65b994) exposes no endpoint and does not resolve runtime audit.

## Implementation

bo-full-detail.js is the one shared three-tab renderer; playground.js delegates to it for both pilots and registration. Exact approved styles copied without modification from immutable OneDrive authority. No right summary panel; full width. Header/tokens/typography remain canonical.
Detail renders every declared module property including immutable identity. Typed formatter/editor are reused. Real Core capability allowlist stays Student name and Class name/capacity, conditional on existing context manage permission hints; immutable/computed/unknown capabilities are read-only. Canonical server ACL is authoritative and remains unchanged.
Existing adapter uses lifecycle/configuration version guards and post-command server readback, no blind retry/optimistic success; this PR additionally preserves Student directory projection fields on lifecycle-name readback.
Chuyên Sâu injects independently registered Student and Class read-only domain slots. These are real supplied projection fields; there is no generic fake editor or unsupported workflow.
History has the exact compact V2.5 row template. The read controller enforces response subject type+ID, ordering, bounded pagination, search reset and race invalidation as defense in depth. Runtime deliberately has no reader: Core has no admitted exact-subject domain audit endpoint. It renders unavailable, makes no audit request, and never fetches/filter-replaces a global audit table. No mock audit data appears in Core mode.
Registration/UI-only fixtures remain explicitly mock. Prototype demo mutable fields and events do not grant Core capability or persist anything.

## Contract mapping

| Surface | Read | Allowed mutation | Guard/readback |
| --- | --- | --- | --- |
| Students | learners bounded directory | PATCH students/:id displayName only in this adapter | GET students/:id/lifecycle version+status before, lifecycle readback after |
| Classes Manager | delivery/bootstrap-state | PATCH delivery/running-classes/:id operationalName / optimalConcurrentCapacity | preserve complete configuration + expectedVersion + hard-cap, bootstrap readback |
| Classes Staff | running-classes | none | existing server scope/read ACL |
| Shared Views | existing views/:module client/runtime/queue | existing Manager CRUD/autosave; Staff local only | unchanged canonical ACL/version/readback |
| History | missing subject-scoped owner read | none | Core #1836 dependency; fail closed |

No domain API, BFF auth path, permission, business rule, D1 schema or deployment configuration is changed. Existing /bo/learners and /bo/running-classes routes remain intact; the reconciled #845 workspace is explicit bo-ui-replica/playground.html?module=students|classes&data=core.

## Team Surface Decision

surface: BO
primary_device: DESKTOP
bo.sidebar_group: SCHOOL (inherited)
bo.subnavigation: inherited
bo.primary_layout: TABLE -> Drawer -> Full Detail
shared.permission_context: canonical BO entitlement plus existing Student/Delivery/Shared View server authorization
shared.cross_domain_links: existing navigation only
founder_layout_review: APPROVED (Full Detail V2.5 only; V2.3 other components)

## Evidence and verification

docs/evidence/PAP-979/authority.json records the approved playground.js hash (35605c4f7fafbdcddf3d3ef82e48f12f0d2b74ef096eb544c65717340e024e65).
receipt.json and 36 screenshots: 9 registration runtime + 9 immutable-authority comparisons + 18 Students/Classes screenshots.
VISUAL PARITY PASS: registration #detail-screen PNG byte equality 9/9, all three tabs at 390/768/1440 in same browser. Domain-specific pilot text is not claimed identical to registration; same shared shell/no-sidebar/no-overflow/all-properties assertions pass.
MOCK / CONTRACT TEST PASS: six UI-only pilot cases and twelve Core-contract Manager/Staff browser cases at all three widths. Success requires readback; 403/409/network preserve old values; read-only has no write controls; History makes zero global audit requests and fails closed. Entity switch resets tab/query and URL context survives back navigation.
Existing six Table/Drawer/typed edit/cancel/filter/settings/local Shared Views regressions pass. Canonical existing Shared View client/queue/BFF unit tests remain included in full unit suite. Focused history tests cover search/pagination and stale responses through an injected reader; this is not a real API claim.
Reproduce on i5: set PAP979_AUTHORITY to the canonical source directory and run node scripts/verify-bo-full-detail-v25.mjs. Without authority, CI runs fixture/structure checks and retains screenshots; it reports visual parity PENDING instead of inventing authority.
Final exact SHA and CI run receipts are in the PR/Jira handoff. Local lint/typecheck/unit/build and exact-head CI must be read with their actual results.

## FC1 downstream acceptance

No merge, deploy, D1 migration, Production action or sender test has been performed by this task.
1. Review this dependent PR together with #845 and current main; own final restack/merge admission. CI branch filter merely admits validation against #845, not deployment.
2. Complete independently reviewed Core subject-audit implementation and Team endpoint binding before claiming functional History acceptance. Core #1836 is a dependency specification only.
3. Under a separate staging release Job, prove exact Core/Team worker SHA/version, rollback and zero unsafe outbound; do not infer serving readiness from PAP-976 migration completion.
4. Authenticate real Manager and Staff; verify existing domain reads, unsupported read-only fields, command/readback, direct denied mutations and 403/409, Shared Views and entity-scoped audit including cross-scope/type/ID negatives, pagination/search and navigation.
5. Record STAGING REAL API TEST PASS only from those actual requests. Current state is LIVE_VERIFICATION_PENDING / CORE_AUDIT_READ_DEPENDENCY. Do not mark PAP-979 functional DONE or advance PAP-512.
