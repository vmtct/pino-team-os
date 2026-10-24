# PAP-891 / PAP-893 — bounded Core adapter packet

Founder approved both pilot UIs at source `087c7799bea39de44aa910a47645c400aef51fac`. `docs/bo-ds-v1-freeze.json` records that immutable BO DS V1 baseline and its visual-source hashes. Approval does not imply functional acceptance, approval of other modules or Production.

## Implemented scope

An explicit `playground.html?module=students&data=core` or `module=classes&data=core` entry loads current same-origin `/api/bo/context` and existing canonical reads before mounting the approved workspace. The default entry stays the approved synthetic review baseline. A Core/auth/read failure renders an error with zero fixture rows and no fallback. Pilot navigation retains Core mode after navigation search/collapse rebuilds; unsupported prototype destinations are inert in Core mode.

- Students: bounded descending keyset reads from `learners`; only display name is writable through existing PATCH `students/:id`. Read current lifecycle and compare displayed name/status before submitting `expectedVersion`; verify post-command lifecycle readback before changing the displayed record.
- Classes: canonical Running Class projection, or existing delivery bootstrap for manage-authorized configuration/version. Only operational name and optimal concurrent capacity are writable through existing PATCH `delivery/running-classes/:id`. Preserve the complete original class configuration, expected version and hard-capacity constraint. Re-read bootstrap and verify canonical field result before updating the screen.
- Other fields are read-only. Unknown age, remaining service-unit balance and teacher data are null, never derived/fabricated from unrelated records. Parent contacts, salary/private data and raw lifecycle payloads are not copied into display rows.
- Context permissions drive UI hints only. Existing BFF `teamCredential` plus Core surface/action/scope/context checks remain mandatory server authority. No new permission, auth mode, API, schema or backend business rule is introduced.
- Per-record in-flight lock; 401/403/409 and ambiguous post-write readback are visible failures, no automatic retry or optimistic success. Reload re-reads Core; mock undo/redo and mock creation are disabled in Core mode.

## Deliberately incomplete pilot scope

Core public Views accepts canonical fields `students:[id,name,birth,paths,learning,member,attention]` and `classes:[id,class,program,pattern,capacity,status]`. The Founder-approved synthetic adapters use a different field vocabulary and some values have no current canonical projection. Do not silently persist incompatible field names or equate Student lifecycle status with subscription-derived `learning`. Core-mode view creation/persistence is inert in this packet; search/filter/group/column exploration stays local. Existing functional BO routes/shared-view integration are unchanged.

The next public-view adapter packet must reconcile field mapping/available read truth against PAP-886/888/924 and current Core policy, then prove Manager persistence/Staff drafts/403/409. No full functional pilot PASS or Epic completion is claimed here. Student Intake/Create, other class configuration edits, guardian/Pinoria workflows and specialist detail interiors remain on existing governed routes; this packet does not replace those routes.

## Surface / authority

BO / DESKTOP / SCHOOL / TABLE; approved shared frame and tokens. Entry remains the existing protected preview; no ingress, authentication or Core permission changes. Uses approved PLT-BO presentation and Identity Student-profile contract plus PLT-DELIVERY class-update contract already consumed by Team. Spec, handoff, frontend `bo-api` / `f3-delivery-api`, BFF and canonical Core handlers were inspected before integration. Protected data stays in memory; no browser storage.

## Verification / terminal constraints

- `node --test public/bo-ui-replica/*.test.cjs`: adapter denies missing/failed auth, repeated cursor, direct unauthorized writes; preserves lifecycle/version/class config; rejects capacity overflow; verifies readback; 409/readback failure never changes displayed row or retries.
- Existing BO context/read/write handler tests retain server-side credential forwarding and denial checks.
- Optional local Chromium fixtures exercised Manager/Staff/403 at 390/1440, same renderer/no mock fallback, read-only fields and core-mode navigation, confirmed write/readback and disabled fake creation/views. These are fixture tests, not live role evidence.
- Existing UI-only six-case viewport regression remains PASS. No CSS change.

PAP-971 is Merged but PAP-512 still requires discharged HOLD_OUTBOUND / actual isolation proof before shared staging writes. This packet does not execute any live Core/D1 mutation, grant, credential action or outbound sender. Authenticated staging reads/writes/readback, Manager/Staff roles and shared-view persistence remain unproven. Required exact-head CI, ownership, merge and stage gates remain; Production HOLD. UI approval and DS freeze are complete, full pilot functional acceptance is not.
