# PAP-991 ADR: greenfield HO / BO canonical ownership (M01)

Status: **static design inventory for ChatGPT domain audit/acceptance**, under PAP-990; no runtime admission or release. Project `PRJ-PLT`; feature context `PLT-BO / bo-operational-read-plane`. Founder assignment and trusted live entry evidence authorize this isolated M01 source slice. Base: `a10107f4f75dd1719fb5723a73318f2ddadc30c2`, branch `feat/pap-991-ho-bo-registry`. One writer owns only this slice; FC1/PAP-879 and PAP-986 sources and downstream ownership stay unchanged. `INDIE_WAIVED_BY_FOUNDER` under PAP-507; these checks are implementation validation, not independent review.

Authority: [PAP-991](https://vmtct97.atlassian.net/browse/PAP-991), [PAP-990](https://vmtct97.atlassian.net/browse/PAP-990), [PAP-878](https://vmtct97.atlassian.net/browse/PAP-878) active scope override, and [PAP-512](https://vmtct97.atlassian.net/browse/PAP-512) comment 16269. M01 may inventory every module; it grants none of the 29 gated adapters. Core's existing PLT-BO registration is context, **not** approval of future HO routes or center-scoped runtime contracts.

## Decision and topology

- **HO** manages the whole PINO network: global identities, masters, definitions, policies and cross-center read projections.
- **BO** operates exactly one authorized House/Station context at a time. A House/Station must resolve to canonical Center context through the future M02 contract; a UI label or host is not that contract.
- **TOS** executes shifts and physical work. Its current app families and pedagogy/Pinoria separation remain intact.
- Keep one canonical Core/D1 and one PAP-879 BO V2.5 Design System. HO and BO reuse that renderer and its tokens, Table → Quick View → Full Detail, settings, typed editor and domain-neutral slots. Preserve PAP-986 FULL A–F. Do not create a second database, renderer, shell copy or master-author implementation.

Global Program/Syllabus/Mission/Practice, World/Region/Season, Ward Catalog/Sets/Effects, pet species, economy rules, TV policy, CMS and system configuration are authored in HO. BO uses published canonical IDs/versions. Local Classes/Sessions/Visits/Registration/Activation/Leads/Open Studio/TV controls, shifts/timekeeping/duty, payroll exceptions and learner loadout operations retain center-owned operational commands. The loadout is a center-authorized operation on a learner's canonical inventory, not a new inventory per center.

Students and Staff keep global identities with explicit many-center membership/assignment edges. User and StaffMember remain distinct. Subscription products/versions are global; sales, consumption and local relations reference them. Training Library and versions are global; Register assignments/progress link Staff and Center. Payroll policy/defaults are global; period execution and exceptions reference a policy version. Access has global Users/roles/policies and bounded delegated center assignments; delegation must never grant GLOBAL authority. Audit is one immutable canonical stream with separate global and center-redacted read projections. Calendar combines global holiday policy and local closures without copying calendars as competing truth.

Use Core opaque canonical IDs (UUIDv7 per platform foundations), not email, URLs, slugs, vendor IDs or per-center cloned identity. A learner/staff member can have multiple authorized center edges; choosing one BO context never changes their ID. Cross-center links resolve through Core authorization and explicit contracts, never cross-D1 joins in Team. Version/lifecycle, time, idempotency/concurrency, audit, policy and error semantics remain with the owning domain (F1–F7); M01 adds none.

## Inventory and evidence

The [typed registry](../../lib/ho-bo/ownership-registry.ts) contains **45 module ownership rows**. [Source inventory](../../lib/ho-bo/source-inventory.json) exhaustively records **47 navigation occurrences / 41 unique hrefs / 47 page files**, including group/parent/child labels, exact page paths, module owner, immediate implementation imports, lexical API hints and imported clients. All 41 nav hrefs have a corresponding page file at this base: **zero nav-only stubs**. This says nothing about host allowlists, feature flags, authentication, deployment, actual serving or functional acceptance.

The six pages outside sidebar navigation are:

| File route | Registry owner | Disposition |
| --- | --- | --- |
| `/bo/staff/[staffId]` | `staff` | Global Staff ID with center relation; specialized Staff detail |
| `/bo/training/builder` | `training` | Move library authoring to planned HO library; preserve Register split |
| `/bo/profile` | `profile` | Own-profile read utility, not an extra PAP-878 adapter |
| `/bo/pinoria-companions/prototype` | `companion-prototype` | Prototype evidence only; retire after owner-reviewed cutover |
| `/bo/pinoria-tv-mesh` | `tv-mesh` | Proposed center House topology editor; owner field review pending |
| `/bo/pinoria-tv-dialogue` | `tv-dialogue` | Proposed global template editor; local override boundary pending |

PAP-878 has **31 adoption stories = 2 pilot stories (PAP-891 Students, PAP-893 Classes) + 29 Founder-gated stories**. Its original 35-row table includes four explicit exclusions, all still inventoried here: PAP-890 Home, PAP-894 School Schedule, PAP-896 Open Studio, PAP-898 Programs/Syllabus. Workforce Schedule & Time PAP-901 remains included. Training Library PAP-920 and Register PAP-921 are separate stories despite the combined current sidebar entry. Nested routes inherit **related story traceability**, not a new executor grant or a claim that the story explicitly admits that nested editor. Source parity and story completion are unassessed.

Specialized detail/editor slots are explicit per registry row: curriculum and content editors, World/Region 16:9 builder, policy/config editors, role matrix, weekly planning matrix, calendar/timeline, immutable audit/history, and domain-specific Student/Class/Staff detail. These are bodies inside the shared DS, not forced tables or alternative renderers. Staff waits for PAP-779; Training waits for PAP-847/851/852; financial commands retain their independent owner gates.

## Scope, APIs and known gaps

All target routes/actions in the registry have `PLANNED_CONTRACT_REQUIRED`. `dataOwner` names the **target canonical Core domain**, not a verified current table or a claim that legacy Notion-backed code has migrated. Resource names are design vocabulary, not permissions, table names or new IDs. Action lists describe ownership ceilings; each command still needs its own approved domain contract. Read-only projections have only `read`.

Current API evidence is intentionally bounded: the inventory reads each page and its immediate implementation imports, records literal `/api/...` strings and Core/client imports, and leaves **effective permission and Core table mapping UNVERIFIED**. Empty hints mean unresolved, not no API. Dynamic `/api/founder/${path}` and imported client methods are visible legacy dependencies; they are not permission to expose Founder/private control-plane operations through HO/BO. Before runtime, the domain owner must resolve each registry resource to registered Core feature/spec, API, permission + scope, canonical table/projection and F1–F7 handoff. Do not invent missing APIs or schema from these proposed routes.

The existing `lib/bo-shell-gate.ts` `BoShellContext` and `app/bo/BoContextCard.tsx` have no frontend `centerId`. Some feature views already select a center, but that is not an authenticated single-center shell context. Existing PLT-BO global read authority cannot silently become center-safe by adding a query parameter. M02/M03 must establish a server-validated context and explicit switch/revalidation behavior before local BO integration. HO surface/entry applicability, exact feature permissions, TV dialogue override semantics, mesh field ownership and economy correction boundaries remain owner-review dependencies.

Core must enforce surface entry, stable permission, canonical scope, center membership and contextual policy on **every** read and command. Resolve resource Center from canonical records; reject cross-center IDs, foreign relations and stale context. Enforce query scoping and field redaction server-side. Never rely on UI filtering, surface switchers, route knowledge, titles or a supplied `centerId`. BO writes cannot author global masters; HO commands require their own explicit global grants. No bypass is allowed while a prerequisite is absent.

## Route cutover and sequencing

The old BO href/page mapping remains source evidence. Planned `/ho/**` paths do not exist here; retained `/bo/**` paths do not prove their future scoped API exists. `legacyDisposition` distinguishes global-author moves, center retention, split-before-cutover, read projections and prototype retirement. New standalone Program, Region, subscription catalog and library paths are planned targets rather than invented current pages.

For each later slice: confirm Core readiness and current source owner; admit the contract and shared DS slot; add authorized target routing; deny legacy global author writes in BO; then add owner-approved redirects/links or retire the prototype. Redirects and old-route access must preserve server authorization and safe deep links. Do not dual-write, copy records, add a second schema or expose both global author paths. Retire legacy factory/baseline entries only through their existing ledger process after actual migration evidence. This static registry does not replace or wire `app/bo/architecture/registry.ts`, navigation or middleware.

| Milestone | Jira | Scope; later execution requires separate admission |
| --- | --- | --- |
| M01 | PAP-991 | Ownership inventory, typed registry, ADR and static guard only |
| M02 | PAP-992 | Canonical Center directory, membership and GLOBAL/CENTER auth model |
| M03 | PAP-993 | HO shell and BO Center context on the shared DS |
| M04 | PAP-994 | Rehome global Learning, Pinoria, Content and product definitions |
| M05 | PAP-995 | Split Student, Staff, Subscription and Training views |
| M06 | PAP-996 | Payroll/Workforce/finance policy vs center execution |
| M07 | PAP-997 | Global Access/Roles/Policies/Audit and integrations |
| M08 | PAP-998 | HO network dashboard and center reporting projections |
| M09 | PAP-999 | Separately authorized isolated fixtures, cutover and Founder acceptance |

PAP-512 serial staging remains **Current BO → Pinoria TV → TOS → Staff**; the milestone table does not reprioritize it. FC1 owns downstream admission/merge/serial staging. M01 authorizes no runtime route/API/schema changes, 29 adapter implementations, Worker/D1/R2/secret/migration-ledger writes, staging/Production operations or customer outbound. Founder's greenfield business-data statement never authorizes deleting auth, infrastructure, secrets or migration history. No browser/integrated E2E before Production ship.

## Validation and handoff

Run `npm.cmd run test:ho-bo`. The same root-level test is discovered by the existing `npm test`/CI suite. It compares live source navigation/pages/import hints with the static inventory, and rejects duplicate keys/global authors, orphan stories, missing routes, malformed owner/scope/action/routes, BO global author writes, incomplete splits and writable read projections. It is a source-integrity guard, not proof of Core ACL enforcement. Run scoped TypeScript/ESLint checks; no build or browser is needed for these static files.

Local verification on 2026-10-25: **7/7 targeted tests PASS**, strict scoped TypeScript PASS (`ownership-registry.ts`, `validate-ownership.ts`), scoped ESLint PASS (both modules and the test), `git diff --check` PASS. The Windows sandbox blocked `tsx`'s user-info lookup on the first attempt; the successful test run used authorized local execution outside that restriction. No browser, build, runtime API, staging or serving validation was performed. The slice changes only this ADR, `package.json`'s targeted test command and the four `lib/ho-bo*` files; any separately supplied root-level design document is outside this writer's changes.

No new staff UI is implemented, so no shell/layout decision is enacted. Future composition decision: HO global management / BO single-center desktop grouped sidebar, shared DS and canonical Core permission context; TOS unchanged. Detailed HO layout remains pending M03 review. M01 does not amend the existing surface doctrine by executable behavior.

Handoff requires the immutable candidate, local checks and exact-head CI evidence. `DEV_HANDOFF_READY` must not be claimed before push/CI requirements are met. No self-review PASS, merge or deploy is implied. Source, runtime, serving and acceptance evidence stay separate.
