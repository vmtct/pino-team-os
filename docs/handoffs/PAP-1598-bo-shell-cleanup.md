# PAP-879 → PAP-1598 — BO application shell convergence

Implementation evidence, 2026-11-07. This receipt is not a release authorization.

## Result

`app/bo/layout.tsx` authenticates through the existing `authorizeBoShell` and
always composes `BoRuntimeBoundary` → `BoApplicationShell`. The legacy `<BoShell>`
render branch is removed from BO. The existing canonical registration workspace
renders the outer chrome; nested BO workspaces render their content and overlays
without another sidebar, workspace root, account footer or mobile trigger.

Staging data dispatch remains gated by `boSkeletonEnabled`; Production never
receives that Staging user or content-Center context. Its existing module loaders,
fallbacks, aliases and route fences remain. The shell Center control is shared,
and its existing Core-authorized discovery and selection code is retained.
Navigation preserves authorized Center URLs only through `boScopedModuleHref`.
Production retains My Profile and Logout. HO keeps its separate shell.

Production authority CSS has an explicit exact-host/environment presentation
path. The controller still authenticates each stylesheet request, retains
401/403, private/no-store and the CSS-only allowlist. No prototype HTML or JS is
admitted. The Staging-only data flag is not enabled on Production.

## Consumer audit / deletion disposition

50 physical BO pages were inventoried before implementation; physical source is
not proof of runtime admission. Detailed local evidence is in
`artifacts/PAP-1598/READ-ONLY-AUDIT.md` and `route-inventory.json`.

- Physical source files deleted: **0**. No candidate was proven wholly unconsumed.
- `BoShell.tsx`, `bo-shell.module.css`, its menu and exported navigation types
  remain referenced by `/founder` or other retained consumers. Their BO layout
  mount is retired; deleting or relocating the remaining Founder implementation
  requires its own scope. No Founder/TOS code is modified by this PR.
- `foundation.css` and its packaged stylesheet remain live in retained V2.3
  data-grid interiors. The content-only V2.3 token scope is preserved without
  restoring old outer chrome. Build packaging and protected CI are unchanged. The admission ledger adds five
  exact PAP-1598 owner references for existing shared dependencies; no wildcard
  admission or verifier relaxation is used.
- No Core, API contract, D1, ACL grant, business writer, Mission source/CSS,
  shared DS source or authoritative i5 prototype changes.

## Validation

- Official capsule validation: CONTEXT_VALID / V2_COMPLETE; independent SHA256
  `0d50a6808f609add21b3e5b7ccc2ec8c5757a1696a17e9ce6f2ea4d6fe981067`.
- Allocation/current-main baseline: `7f16bef358ede495576ada9d4bbc2bdb4caf1564`.
- `npm test`: **PASS**, 2079 TypeScript tests + 6 script tests, no failures, including the
  three real React composition regressions.
- `npm run typecheck`: **PASS**, including those three composition tests.
- `npm run build`: **PASS**. Build-manifest digests are retained in task-local build logs;
  they identify build bytes, not a Git or serving SHA.
- ESLint changed code: **PASS**, 0 errors, 4 warnings on existing effect/CSS-tag code.
- BO contract, runtime ownership, single Center owner, Staging route policy and
  Foundation verifiers: **PASS**; protected CI/build scripts are unchanged.
- Local browser fixture: Production and Staging compositions at
  **320/390/768/1440**, one app/sidebar/account footer, one mobile trigger when displayed,
  no page overflow in the controlled fixture. The existing Table heading owns
  its mobile menu; a shell-scoped display rule suppresses only the redundant
  outer fallback. Content-only/pending pages retain that fallback. Mobile menu, authorized Center
  switch, scoped deep link, Back and invalid Center handling verified.
- Nested Production detail selects the correct sidebar item and retains My
  Profile. Production content probes receive neither Staging user nor
  Staging content-Center context; Staging probes retain both.
- Outer sidebar at 1280: 246 px, rgb(25,26,39), Inter 13 px, matching the current
  canonical i5 prototype's observed outer-shell computed styles. The pinned repo
  CSS and i5 source still have distinct hashes; no wholesale prototype sync was made.
- These are controlled local UI tests, **not authenticated Staging G4** or proof
  of every business route/role journey. The script
  `node scripts/serve-bo-application-shell-fixture.mjs` reproduces the local host.

Windows test prerequisite: the initial Bash resolver selected the retired WSL
launcher. Tests passed using installed Git Bash plus official `jqlang/jq` in
task-local test tooling, verified against the release checksum. No OS, WSL,
global PATH or repository test-policy changes were made. Local logs remain under
`artifacts/PAP-1598/`; temporary tools are not committed.

## Delivery boundary

PR/CI evidence is attached to PAP-1598's delivery response. Merge is manual under
PAP-1051. Guarded current-main Staging CD and actual Worker serving SHA must then
be verified. The available IAB Staging visit redirects to `/staff-login`, so an
authorized authenticated session is also needed for real G4. No credentials were
requested/extracted, no grants/fixtures were changed, and no Production deployment
or promotion was performed. All browser tabs created by this session were closed.

Team Surface Decision: BO / DESKTOP, existing grouped sidebar and PINO DS chrome;
TOS unchanged; existing Core session/Center permissions remain authoritative.
