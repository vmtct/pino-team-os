# PAP-1069 PR2 — canonical shared renderer ownership

Authority: PAP-1067, S0/PAP-1068, PAP-1069 handoff 16888, PAP-1078 and
PAP-1079. This slice follows merged PR949; it does not complete the Epic.

## Verified preflight and writer fence

- PR949 merged at `5f24cc668cd9c34387a35aa48154c4320dba6ecc`.
- Main CI 40604119136 and guarded staging CD 40604488205 succeeded on that SHA.
- Direct read-only Cloudflare deployment readback verified staging Worker
  `pino-team-os-staging`, deployment `814a25ea-0be1-4d1d-8e32-6215026a0184`,
  version `644a9458-6046-408a-8997-603b8f2073be`, 100% traffic, annotation
  `team-cd-guarded staging sha=5f24cc668cd9c34387a35aa48154c4320dba6ecc run=40604488205`.
  Public health/provenance paths returned 404; those were not used as serving proof.
- Canonical allocator `D:\pino-tools\new-worktree.ps1` fetched origin/main and
  created new worktree `D:\pino-worktrees\pap1069-codex-renderer-pr2-20261028`,
  branch `codex/pap-1069-shared-renderer-pr2`, at the same fresh main SHA.
  PR1's worktree was not reused. The allocator's actual path remains under
  `D:\pino-worktrees` despite the host document preferring `D:\PINO\worktrees\active`.
- Worktree overlap inventory found only a modified registration Full Detail
  in the separate local HO prototype snapshot. It was not edited or incorporated.
  Codex is the single writer for this branch's shared-renderer fence. Main's
  current AGENTS instructions retire the historical PLT-CARE continuation gate.
  PAP-980 supersedes old reviewer-only language; no Core business authority is inferred.

Source fence: `app/components/workspace-renderer/*`; the two Full Detail
compatibility wrappers; registration Table/Drawer/editor/settings/dialog and
workspace seams; optional HO/Factory adapters; focused tests and this note.
No current module is newly registered or automatically classified as TDD.

## One renderer, incremental compatibility

`TddRenderer` is the controlled Table/Drawer/Detail stage seam. It requires the
exact immutable module returned by `TddRegistry.register`, its authenticated
authorization context, and controlled record/query/navigation state.

`DetailFrame` is the sole cover/hero/tablist/body owner for:

1. Registration `BoFullDetail`, retaining existing business branches and lazy imports.
2. Alternative/Factory-facing `components/BoFullDetail`, retaining its existing
   link/return-URL semantics and frozen CSS-module profile.
3. Typed `TddDetail`, using canonical reserved system tabs and approved slots.

The compatibility CSS profile is internal to the legacy wrapper; typed modules
cannot select it or provide shell JSX/classes. The old wrappers no longer
implement their own covers or heroes. Parent's old tab/content subtree remains
an explicit legacy compatibility body until PAP-1075; it is not claimed as a
TDD migration. Subscription recursion still reuses the same wrapper/frame.

`DrawerFrame` owns overlay/header/content/footer and uses the existing dialog
hook for focus trap, Escape, backdrop, scroll locking and invoker restoration.
`PropertySections` uses existing approved property rows for Drawer and existing
Full Detail grid classes for Detail. Parent's narrow Drawer overview now uses
the one-column primitive; Parent tabs, masked endpoints and audit logic remain
unchanged. No new CSS rule or viewport heuristic was added.

`TddTable` reuses registration `BoDataTable`, `BoTableSettings`, `BoViewTabs`,
typed values and editors. Optional policy props preserve every legacy default.
Table and Drawer mount the same engine-owned async property editor; hosting
adapters supply mutation/version transports rather than replacement edit UI.
The Drawer stage can retain a same-schema/same-auth-context Table background;
selection and URL/scroll restoration remain controlled by the hosting adapter.
Registered mode restricts search/filter/sort/group/edit choices, protects the
configured identity field, and provides nulls-last/record-ID tie breaks. It
does not add a second table implementation. Server mode uses the supplied
authoritative total and already-paged rows without client re-pagination.
Invalid filter drafts remain local until valid; they never reach the typed
query callback. Local UI undo/redo cannot undo server mutations.

Both `BoRegistrationWorkspace` and `BoModuleFactory` expose optional typed stage
bindings. Registration uses its existing content seam, which skips unused
legacy data loading while preserving host navigation. HO forwards the same
optional binding; its default Centers source and lazy detail remain unchanged.
The adapters reject surface/module mismatches, and read-only workspace sources
cannot admit write capabilities. Factory's default DataGrid/SidePeek path is
grandfathered and unchanged; opt-in delegates directly to `TddRenderer`.
No route, sidebar registration, URL protocol or live module migration changed.

## State, permissions and content boundaries

BO Center context and HO context remain distinct. Schema capabilities and UI
visibility never grant access. Projection reads registered, authorized fields
only; unrelated API keys are discarded. Hosting adapters must supply genuine
server-authorized rows for the selected scope, authenticated decisions, query
results and navigation callbacks. The renderer does not invent Core permissions
or infer scope from business field names.

Authenticated context objects are stable within a session. Replacing the context
object ends local view/edit/tab request scope, even when the Center string is
unchanged. Record changes also remount the record scope. Latest-only requests
abort older work and reject late results even if providers ignore AbortSignal.
Permission, identity and version checks run before/after mutation adapter calls.
Editors require explicit adapters, versions and real grants; read-only defaults
have no mutation path. Existing draft editors retain their old close-on-save
default; typed async edits keep the editor transaction alive until a real result.

Typed Detail always creates Overview first and History last, with authorized
business descriptors in declaration order. Active tab can be controlled by a
host URL adapter. Arrow/Home/End navigation uses roving tabindex; Back delegates
to the existing host controller, with optional post-render invoker restoration.
Existing URL/scroll/focus controllers remain authoritative and unchanged.

Business bindings are keyed by declared source adapter. They receive an
authorized record projection and AbortSignal. Missing providers are explicitly
unavailable. Field-group content uses the standard properties primitive.
Content may use intrinsic elements and the explicit shared primitive allowlist;
opaque components, shell classes/roles/IDs, raw HTML, scripts and style overrides
fail closed. New reviewed content primitives must extend that binding/coverage
deliberately; a domain component cannot smuggle a second shell through a slot.
Approved extensions still require the PR1 registry's exact verified approval.

History uses PR1 `loadHistory`: authorized events/empty, unavailable and denied
remain distinct. Loading/error/retry and cursor pagination are shared UI states.
Events and field diffs pass existing subject/redaction/permission validation.
There is no fabricated audit, raw payload display or HO Access Audit substitution.

Local saved views are ephemeral component state. Authorized-service mode requires
an explicit existing transport, source permission, shared-view management rights
where applicable, and versions. Writes return authoritative snapshots; stale
responses are suppressed. No localStorage persistence or fake server success
was introduced. The actual service remains responsible for owner/scope/CAS ACL.

## Verification and remaining acceptance

The GPT repair review of head `3311b228` identified two render-time failures.
Saved Views now convert independently: a typed view that the legacy filter UI
cannot express is listed as unavailable, while compatible views and rows remain
usable. The original typed query/version is retained through unrelated view
edits; no CSV splitting, operand rewriting or implicit deletion occurs.
Unavailable views offer removal only with the configured delete action and the
existing service/shared-view grants. Users can also ask the source's view manager
to repair the original configuration. Service responses validate the typed query
contract rather than requiring every query to fit legacy controls.

Nullable registered names project to the legacy empty string (empty cells), while
null/undefined identity headings use the neutral `—`. The adapter's row is never
mutated. Other registered field values remain typed; identity/title data still
requires its existing display authorization. BO/HO SSR regressions cover mixed
remote views, preserved operands/versions, deletion grants, null/undefined names
and all 16 typed identities, including absent values.

Focused DOM/SSR and event-policy tests cover both surfaces, both Detail bridges,
typed stage admission, business order/negative slots, Table behavior, readonly
mutation denial, identity/version guards, dialog/tab keys, stale async results,
Parent rows and existing live module variants. A scoped AST ownership gate
rejects reintroduced shell markup in the compatibility bridges without freezing
unrelated grandfathered screens. The PR1 renderer-free contract test now checks
the authorized opt-in seam and rejects automatic legacy registration.

The responsive regression derives the approved BO CSS row tracks at
320/390/768/1024/1440: usable value tracks 170/240/300/300/300px, versus the old
approximately 92px two-column Parent track. This is CSS/DOM contract evidence,
not a measured browser screenshot or visual acceptance. PAP-1073 must enforce
computed browser geometry, screenshots, tab overflow and overlay positioning
against both independent CSS authorities. No browser/integrated E2E is run here.

BO authority and HO pinned source/theme pipelines are unmodified; generated CSS
is not edited. Host/auth, 401/403/404/masking regressions remain in the full CI
suite. No database, Core API, permission, deployment or authoritative prototype
change is included.

Team Surface Decision: BO + HO desktop-first TDD; TOS out of scope. Shared
component ownership does not merge authorization, navigation or CSS authorities.
Screenshots and Founder/GPT Design System acceptance remain pending.

Follow-ups: PAP-1070 adapters, PAP-1071 broader scoped enforcement, PAP-1073
visual gates, PAP-1075 Students/Parents adoption/history mapping, PAP-1076 HO
Centers adoption and PAP-1080 HO Reference after admitted dependencies. Do not
claim any of these or PAP-1067 complete.

Stop at `DEV_HANDOFF_READY_FOR_GPT_ARCHITECTURE_DS_AUDIT` with the pushed exact
candidate, green CI and receipts. No Indie review; record
`INDIE_WAIVED_BY_FOUNDER` against the final head under PAP-507. No merge or
staging deployment is authorized by this handoff.
