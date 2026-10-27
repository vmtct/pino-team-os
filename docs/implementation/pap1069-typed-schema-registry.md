# PAP-1069 PR1 — typed TDD schema and registry

Authority: PAP-1067 (including Table audit comment 16847), PAP-1078 (16827,
16840, 16848), PAP-1069 (16850), PAP-1079 (16849), and PAP-1068/S0 report.
PR1 is the contract/compatibility slice. It does not complete PAP-1067 or build
the shared renderer. The existing runtime does not import this library.

The source writer is Codex on `codex/pap-1069-typed-schema-registry`, isolated
worktree `D:\pino-worktrees\pap1069-codex-schema-20261027`, allocated by the
canonical `D:\pino-tools\new-worktree.ps1` from freshly fetched `origin/main`
`fe422a53d6b50e09e801366b24d44e4b01490eff`. The allocator currently chooses
`D:\pino-worktrees`, despite the host document preferring `D:\PINO\worktrees\active`.
No other worktree was edited. Writer fence: new `lib/workspace-schema/*`, its
top-level contract test, and this implementation note only.

The Core entry gate returned `Unknown feature 'PAP-1069'`. Founder explicitly
replied **Waive** to the request for a canonical feature mapping or exemption
from the Core PLT-CARE gate for this schema-only slice. That exemption applies
to this PR1 gate only. It grants no Core feature ownership, auth changes, runtime
integration, merge, staging or Production authority. PAP-980 supersedes the old
Codex reviewer-only paragraph. No Indie review is requested or claimed;
delivery records `INDIE_WAIVED_BY_FOUNDER` under PAP-507 with the final head.

## Contract and admission

`defineTddModule()` validates and freezes a snapshot. `TddRegistry.register()`
admits it under version 1 and a surface-qualified module key. Registration is
explicit: no API payload introspection, route discovery or automatic adoption.
Keep fields declared `as const satisfies readonly FieldSchema[]` and use
`ModuleSchema<typeof fields>` to retain field-key/operator/value inference.
The typed return from `register()` retains the specific data adapter type;
heterogeneous registry lookup intentionally exposes adapter data as `unknown`.

All TDD modules declare Table, Drawer and Full Detail. `composeTabs()` produces
system `overview` / **Tổng quan**, declared business slots in order, then system
`history` / **Lịch sử**. Business tabs cannot supply shell JSX/CSS, reserved IDs,
tab navigation or hero/body replacements. Slot families are field-group,
relation-grid, data-grid, form, timeline, media, metric-cards, audit-events and
reviewed extension. Domain concepts such as subscriptions, enrollment and
payroll use these approved content descriptors rather than separate shells.
An audit-events business slot needs a distinct domain dataset/label/permission;
it must not duplicate canonical subject history.

The 16 supported primitives are `text`, `id`, `select`, `number`, `currency`,
`date`, `relation`, `boolean`, `textarea`, `datetime`, `multirelation`, `person`,
`multiselect`, `email`, `url`, `formula`. Typed values, control-family metadata,
readonly/edit flags, options, permission reference, sensitive marker, required
flag and bounded validation metadata accompany each field. ID and formula are
immutable. Currency is VND; datetime controls use Asia/Ho_Chi_Minh semantics.
The PAP-1079 33-family inventory is a scenario wishlist, not 33 implemented
primitives. Unknown kinds fail admission. Adding a new primitive requires
approved DS implementation, metadata, adapters and positive/negative tests;
`approved-extension` is a reviewed business slot, not a field-type bypass.

Table config preserves pinned, first, unhideable identity, registered visible
columns/order/search fields, flat AND/OR typed rules, one sort, one group,
nulls-last/stable record-ID tie break, built-in views, saved-view modes, paging
8/15/30, inline edit flags, four Settings pages and keyboard/local UI undo
contracts. Search normalization follows current BO diacritic behavior. No
multi-sort, nested rules, arbitrary API columns or backend transaction undo.
Local UI view state is ephemeral. Durable personal/shared views require the
existing authorized service, version conflicts and its server ACL/ownership;
the schema does not implement persistence. Sticky geometry remains DS-owned:
Quick View 37px, identity 225/187/158px at the approved breakpoints, implemented
and verified in the later renderer/CSS slices, not invented here.

## Authorization and history

BO context requires an explicit Center; HO context is distinct and carries no
inferred Center authority. Both receive authorization decisions from existing
authenticated adapters. Permission strings in tests are synthetic fixture keys,
not new canonical grants. A schema permission binding or field capability never
grants server access. `allows`, `allowsField`, `authorizedTabs` and
`validateQuery` check module/surface/field rights. Unauthorized queries fail
closed, including unauthorized hidden columns in the supplied order. Adapters
must pass an authorized projection/query; do not silently search private fields.

History is an explicit provider or an explicit unavailable reason. Missing
providers fail registration. Authorized empty events, unavailable and denied
are distinct results. History stays a system tab even if its data is denied.
The loader checks subject identity, event shape, redaction, duplicate IDs and
field diff type/permission; sensitive values cannot appear in diffs. Denied and
unavailable results cannot carry events. Errors propagate for the future shared
renderer error/retry state; AbortSignal cancellation is preserved. Adapters
remain responsible for canonical server authorization and redacted projections.
No synthetic events, global Access Audit substitution, raw audit payload, or
fake save is provided for a real module.

## Compatibility and phased ownership

`toLegacyModule` projects explicitly registered metadata to the unchanged
`BoModule` contract shared by BO/HO. Table state converters validate typed
queries before bridging legacy string rules; ambiguous or unregistered input
is rejected. `LegacyBoundary` records the existing registration or Factory
renderer without claiming TDD compliance. No current module is auto-converted.
Nonempty searches require at least one configured searchable field. The legacy
multi-value parser has no quoting/escaping syntax: `any`/`all` operands with
commas, leading/trailing whitespace, empty elements or no elements are rejected
on export rather than silently changed. Import keeps the legacy parser's token
trimming but rejects empty tokens rather than dropping them. Representable
values round-trip unchanged; `not_contains` retains its literal text operand.

`GRANDFATHERED` registration requires explicit deployed evidence, owner, route
and migration task (BO PAP-1086 / HO PAP-1087), checked by an externally supplied
legacy-inventory verifier which defaults to deny. A developer-authored evidence
string alone cannot exempt a new module. It imposes no TDD tab renderer.
`FOUNDER_APPROVED_SPECIAL` requires bounded Jira/owner/design/files/tests/review
metadata and an external approval verifier for the exact surface/key/route.
The verifier defaults to deny. Extensions require the same externally verified
approval for their exact module/extension ID. This PR registers no exceptions
and creates no routes. The PAP-1085 authority must verify actual Founder
approval; developer-authored descriptors alone are insufficient.

## Verification and downstream handoff

The top-level `lib/workspace-schema.test.ts` is picked up by existing CI's
`lib/*.test.ts` command. It includes runtime positive/negative cases and
compile-time `@ts-expect-error` controls checked by TypeScript/Next build.
Targeted BO/HO history, metadata, CSS isolation and existing architecture checks
remain required, followed by lint/typecheck/unit/build and actual exact-head
GitHub Actions validation. No browser or integrated E2E is run before ship.
Exact candidate, command receipts and CI URLs belong in the PR/handoff, not a
self-referential commit hash in this file.

Team Surface Decision: BO and HO, desktop-first Table/Drawer/Detail contract;
TOS is out of scope. Existing sidebar, navigation, host/auth boundaries and
per-surface CSS authority remain in place. This PR changes no UI placement,
layout, runtime routes, configuration or database schema. Founder/GPT design
and architecture review remains pending on the immutable candidate.

Recommended PR2: implement one shared renderer ownership boundary plus opt-in
compatibility adapters, bridging both registration Full Detail and the older
Factory Full Detail. Preserve controller URL/back/scroll/focus/abort behavior,
BO Center versus HO auth, lazy detail and server pagination. Consume BO and HO
approved CSS authority independently. Keep DS/CSS repairs, module/history
adoption waves and PAP-1080 HO Reference in separately admitted follow-ups.
Stop PR1 at `DEV_HANDOFF_READY` after exact-head green CI; no merge or staging.
