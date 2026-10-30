# PAP-1077 — Shared TDD BO/HO module admission (S9 slice 1)

Jira: https://vmtct97.atlassian.net/browse/PAP-1077. Canon: PAP-1067; governance: PAP-184. This document covers the generator and fail-closed gate, not S9 terminal.

## Canonical entry

All NEW BO/HO entity-management routes default to TDD_DEFAULT: shared Table → Drawer → Full Detail, typed TddRegistry, SurfaceWorkspace with real BO or HO authorized adapter, approved pinned @pino/design-system, system Overview/History and domain-owned business-tab content. BO must independently verify Center authorization; HO must use authorized global scope. UI visibility is not an ACL grant.

CLI examples:

    npm run tdd:new-module -- --surface=bo --key=my-module --label=MyModule --permission=existing.read.permission
    npm run tdd:new-module -- --surface=ho --key=my-module --label=MyModule --permission=existing.read.permission

Permission MUST already be registered and reviewed in Core; the CLI only validates syntax. It does not grant ACL, invent Core APIs or create users.

Generated files: app/bo|ho/<key>/{page.tsx,PascalTdd.tsx,schema.ts,module.test.ts}, config/tdd-admission.json entry, and BO navigation or HO route allowlist. The BO scaffold deliberately has NO authorized-Center binding; both surfaces fail closed in Core providers, and the generated acceptance test intentionally fails. A new route cannot be merged until TODO_TDD blockers are replaced by genuinely working, authorized adapters and tests. PR CI rejects their markers.

## Gates and ownership

- G0: Exact route, file fence, profile, approved pinned DS version and Center/HO ownership (PAP-1068).
- G1: TddRegistry schema, shared SurfaceWorkspace renderer, no duplicated shell/CSS, secure route registration (PAP-1071).
- G2: Real keyboard/focus/back/ARIA, select integration, denied/stale/partial readbacks under domain authorization (PAP-1072).
- G3: Live module screens at 1440,1024,768,390,320; no document overflow; approved visual parity and accountable geometry (PAP-1073).
- G4: Authenticated Staging, real role/Center scope, 401/403/404 negative cases, CI/CD + Worker 100% exact serving SHA (PAP-1074).

Generic fixture G2/G3 suites are shared regression, NOT a substitute for named module integration tests. G4 remains opt-in in current CI; module acceptance requires its own receipt. Production remains manual.

## Exceptions

A truly special full-screen route needs an exact Founder-approved Jira exception per PAP-1085 and alternative security/a11y/responsive tests; no skip-tdd option. Ordinary business-tab custom layouts remain inside the outer TDD shell and require no exception. Existing deployed BO/HO modules are grandfathered until PAP-1086/1087 scoped migration; unrelated hotfixes are not forced into TDD.

PAP-1114 owns DS component source; PAP-1067 owns typed orchestration and assembled module gates. No module-specific DS shell forks. LuuDo importing DS does not inherit TDD.

## S9 outstanding before terminal

- Prove two fully authorized sample BO+HO modules with negative Core/Center/global ACL and custom business-tab variant.
- Automate per-module G2/G3/G4 binding on admitted module changes, including exact-head and post-CD receipts.
- Detect new modules registered inside existing routes, not only new page files.
- Publish complete live coverage/exception matrix with module owners, gate receipts and authoritative prototype visual parity.
