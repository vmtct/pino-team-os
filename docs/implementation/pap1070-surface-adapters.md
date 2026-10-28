# PAP-1070 — authenticated BO/HO surface adapters

Authority: PAP-1070 S2, Epic PAP-1067, architecture PAP-1078 and special-screen
policy PAP-1085. PAP-1069 PR1 #949 and PR2 #954 are the shared engine baseline.
PAP-1079/1080 remain the specification/implementation for the future HO Reference.

## Verified preflight

- Fresh origin/main/base: `024dcbc5d5452332cdb0108052e03fd7917edda2`, PR954 merged.
- Main CI40616548705 SUCCESS; guarded staging CD40616872270 SUCCESS at that SHA.
- Direct Cloudflare deployment readback: `pino-team-os-staging`, deployment
  `42bd8c66-2736-4714-9891-f4c07b07a7d5`, version
  `e8faeb4a-5838-4852-ac1e-0579efc861ea`, 100% traffic; deployment annotation
  identifies the exact baseline SHA and guarded CD run. No deployment was made.
- Canonical allocator created `D:\pino-worktrees\pap1070-codex-surface-adapters-20261028`
  on `codex/pap-1070-surface-adapters`. PR1/PR2 worktrees were not reused.
- Overlapping dirty-path scan found only the known prototype
  `ho-authority-snapshot-20261027/registration/BoFullDetail.tsx`, left untouched.
  One source writer owns this branch. Historical PLT-CARE leases are retired by
  current AGENTS; real writer, Git, security and release boundaries remain.
- Read live PAP-1067/1069/1070/1078/1079/1085 and their relevant comments,
  PAP-512, S0, repository doctrine and existing Core Access/read-plane handoffs.
  Existing endpoint authority is Core `PLT-BO` / `bo-operational-read-plane`
  and `tos-access-control`; this slice adds no Core feature or permission.

## Surface authentication and scope

`createBoTddAdapter` and `createHoTddAdapter` are separate entrypoints. Both use
`bindSurface`, a typed coordinator, and the same canonical renderer. No new
renderer, shell, stylesheet, route, Core API, permission or login rule is added.

The browser transport calls existing same-origin `/api/bo/context` with the
HttpOnly staff cookie. It accepts no bearer, cookie, user ID, permission list or
client authorize callback. HO's existing context facade invokes `authorizeHoShell`
at the staging HO host and applies the existing Founder cohort gate before
returning the Core BO principal. Only that host/gate path creates an HO context;
a BO context cannot be recast into HO or impersonate a BO Center. The serialized
Core permission list is a UI projection, never server authorization or scope proof.
Admission uses a fresh registry for the authenticated adapter lifetime, with the
existing approval/legacy verifiers when needed. Do not cache its context-bound
data closures in a process-global registry or reuse another principal's adapter.

BO requires an explicit selected Center, verified before and after operations
against an existing authorized source: Centers, Workforce planning bootstrap or
Delivery calendar scope. There is no active Center switcher today, no fabricated
default and no URL/field-label scope inference. Callers with Center-only Workforce
rights choose the planning bootstrap instead of requiring global Centers access.
Every BO provider also returns a Center receipt from its authoritative domain
projection; wrong/missing receipts reject the entire result. No cross-Center rows
are silently filtered into an apparently successful response.

Every list/detail/write/history operation revalidates the current principal and
grants before and after loading. Context identity is bound to its adapter object;
passing a structurally copied or opposite-surface AuthorizationContext fails.
Concurrent older context responses cannot restore newer revoked grants. A changed
principal, expired session, disposal or cancellation cannot commit a result.
Record/action failures retain 401/403/404/409 status through typed errors. A Views
or individual record 403 does not revoke unrelated Table rights; session/Center
denials do invalidate the whole corresponding context.

The actual BFF/Core remains authoritative for every entity, operation and scope.
No client check substitutes for it. Existing host middleware, HO read allowlist,
Founder restrictions, masking and Core service bindings remain unmodified.

## Typed providers and capabilities

`SurfaceProvider<F>` owns explicit domain field mapping and query translation;
it receives the unchanged validated `TableQuery<F>`, bound surface scope and an
authenticated, cancelable transport. Unknown payload fields never become columns.
The coordinator validates IDs, counts, duplicate rows, field values, scope and
optional version metadata, then projects only registered authorized fields.

Pagination mode must match the schema. A server provider supplies a real total
and bounded page. A local provider supplies the complete authorized dataset and
its total; canonical TddTable owns local search/filter/sort/group/pagination.
Providers must reject unsupported backend query semantics rather than ignore
filters or invent server pagination. No universal query API is created.

Two concrete, unregistered read-provider bridges are supplied:

- `hoCentersProvider(map)` reuses the existing Centers facade and validated HO
  directory mapper. Full HO Centers adoption remains PAP-1076.
- `boPlanningProvider(termWeekId, map)` reads the existing authorized Center/week
  snapshot and checks its Center/week before the explicit domain mapper runs.
  This does not register or migrate a Workforce screen.

Read/history transports allow GET only. A read-only provider cannot dispatch a
write through the supplied transport. Writable BO bindings require a genuine
existing MutationAdapter, edit grant, allowed registered editable fields, an
authoritative detail version and a saved-response Center extractor. Wrong IDs,
wrong Center, absent/obsolete versions, protected fields and late revocation
fail closed. Conflict/denial/transport failures are not retried or reported as
success. A late denial does not pretend to roll back an already committed server
operation: the user must reload authoritative state.

Capability diagnostics report current read/edit/audit and explicit false for
generic create/delete/reveal. Those normalized engine operations have no admitted
backend binding in this slice; no fake affordance/API is added. Existing domain
create/delete/reveal flows remain grandfathered. Definitions declaring generic
create or edit without a real mutation provider are rejected. HO's current host
supports GET only, so writable HO providers are rejected until separately approved
backend/host contracts exist. This is backend truth, not a new auth restriction.

## Shared Views and history

Saved Views use the actual PAP-886/887 Core client, service ACL and numeric
versions. Current service is organization/module-shared only; personal ownership
is unsupported and rejected, never synthesized. HO has no Views endpoint in its
current host allowlist and reports unavailable. No host bypass is introduced.

Conversion between typed queries and Shared View config is lossless for supported
semantics and fails closed otherwise. Compatible Views retain real IDs/versions;
incompatible configs are reported separately and remain untouched during unrelated
writes. Typed views that do not fit legacy CSV controls remain isolated by PR2's
per-view unavailable state. No silent CSV split, partial filter apply or deletion.
Each UI change maps to one existing create/update/rename/delete/reorder command.
Multi-operation pseudo-transactions and blind conflict retries are rejected.
Pagination resets when applying a persistent view because the existing service
persists configuration, not a page cursor. Unsupported grouping details reject.

`boSubjectHistory` binds only actual Student/Running Class subject audit sources,
retains their redaction validator and verifies the selected record is in scope
before loading events. History's subject type is explicit, not guessed from a
module label/key. The canonical history contract distinguishes authorized events,
authorized empty, unavailable, denied, loading and error/retry. Raw/unredacted
events or unauthorized diffs fail; no global HO Access Audit substitution. Parent
audit mapping remains its pilot's domain work. Missing providers are unavailable.

## Runtime compatibility and navigation

`SurfaceWorkspace` is a shared controller, not a renderer. It invokes the existing
TddRenderer for Table, Drawer and Detail. Table stays mounted while hidden behind
Detail, preserving active/saved local Views, UI undo and query state. It owns no
Table/Drawer/Detail layout classes or CSS. Async states are tagged by request and
selection so previous detail data cannot flash while another record loads.

BO registration, BO Factory and HO workspace accept an optional `tddAdapter`
prop. No module opts in automatically. Existing `tdd`/content/legacy routes,
navigation, Students/Parents, HoCenters and lazy detail journeys remain unchanged.
Only one controller may be selected; surface/module mismatches and read-only
workspace mutation admission reject. One focused shared-engine compatibility
correction adds the existing host menu slot to TddRenderer's Table heading (Detail
already had this slot). The opt-in content seam otherwise skipped the legacy
mobile menu trigger. Host context now supplies the original sidebar toggle for
Table and Detail, with their existing distinct IDs, classes and behavior. No
menu/layout implementation, CSS or navigation authority is copied or replaced.

`browserTddNavigation` operates on the current existing route and record query
contract. Owned browser history state preserves query, selected record, stage and
active tab without overwriting other owners' state. Popstate and Back restore
Table/window scroll and the actual row focus target. No new public route, tab URL
format or host admission is introduced. The caller owns adapter lifetime and
disposes it on replacing the authenticated session; no token is serialized.

TDD_DEFAULT registration keeps reserved Overview/History and typed business tabs.
FOUNDER_APPROVED_SPECIAL continues through its exact-route approval verifier;
GRANDFATHERED is PR1's spelling of EXISTING_GRANDFATHERED and requires verified
deployment evidence. Neither compatibility classification is forced into TDD or
globally blocked. No real exception or wildcard waiver is added in this slice.

## Validation and delivery boundary

Positive/negative unit and SSR fixtures exercise actual existing BFF functions
with a deterministic test-only Core binding, plus the real Shared Views client.
They prove session/Founder/Center separation, backend denials despite client
capabilities, field projection, query forwarding, totals, versions/conflicts,
readonly write prevention, history redaction, navigation/focus and stale requests.
Fixtures are not runtime data and no fallback is installed in application code.

Run full unit, TypeScript, lint, build, architecture, host/route, Parent, BO and HO
CSS authority suites and actual exact-head GitHub CI. No generated scoped CSS is
edited. No browser/visual/runtime E2E acceptance is claimed; screenshot enforcement
is PAP-1073 and real post-CD authenticated E2E is PAP-1074. Full BO/HO pilot adoption
is PAP-1075/1076; HO Reference is PAP-1080; later scoped gates remain PAP-1071–1074.

Team Surface Decision: BO + HO, desktop-first shared TDD, separate authenticated
scope/navigation/CSS authorities; TOS out of scope. No global IA/layout changes.
GPT architecture/security audit remains pending.

Stop at `DEV_HANDOFF_READY_FOR_GPT_ARCHITECTURE_SECURITY_AUDIT`, with exact-head
CI and Jira evidence. `INDIE_WAIVED_BY_FOUNDER` under PAP-507; no Indie review,
merge, staging deployment or Production action. PAP-1067 remains incomplete.
