# BO Runtime Ownership / Route Parity (PAP-1050)

## Mandatory rule

A green build/deploy is NOT evidence that a BO module is reachable. Before development, each module must have exactly one owner in `app/bo/architecture/bo-runtime-surface-ownership.json`:

- `generic`: **grandfathered historical school modules only**. The verifier has a frozen whitelist. No new module may select generic fallback.
- `factory`: a real registered canonical BO module with a `BoModuleFactory` / `BoWorkforceRoute` entrypoint, correct PAP-926 route decision and authorized read adapter.
- `specialized`: existing BO /bo React workspace with explicit JSX binding and `data-bo-runtime-surface` marker, a manifest contract and a browser E2E scenario. Merely adding files or a standalone Next route does not count.

Production does not inherit staging-only URLs or test session state. Never bypass PAP-926 by adding fake Factory marker JSX, a permissive allowlist entry, or a redirect to an unadmitted standalone page.

## Required checks for any new/changed module

1. Declare module's UI owner in the manifest, then wire sidebar/navigation and deep links to the same canonical runtime. If specialized, add a fail-closed static ownership test and a distinct DOM marker.
2. PR CI runs `scripts/verify-bo-runtime-surface-ownership.mjs` and its mutation tests. New modules missing ownership, new generic fallback, orphaned JSX, incorrect alias, missing required controls, and route divergence fail.
3. Staging CD independently runs the same gate via `npm run bo:contract:check`. The guarded deployment adds a live HTTP deep-link assertion for Subscriptions (legacy alias → canonical /bo?module=subscriptions) and checks the canonical route is still unauthenticated-closed. Failure triggers existing CD rollback.
4. After CD serving SHA verification, run authenticated read-only browser E2E using an **exclusive tab** in an already authorized FC/RC CDP profile. Example PowerShell on i5:
   `$env:BO_E2E_CDP_PORT='9335'; node scripts/e2e-bo-runtime-owner.mjs`
   Test three widths (1440/768/390), marker, real shared Table, approved Create drawer and Student search. The script forbids mutation API methods and writes screenshots + JSON receipts to `evidence/bo-runtime-owner-e2e`.
5. Do not mark Founder acceptance or promote Production until authenticated E2E and any controlled business fixture tests have explicit PASS receipts. A missing session or a visual mismatch means HOLD, even if CI/CD are green.

**PAP-1034 incident:** S1/S2 were merged and served but `/bo?module=subscriptions` still loaded the generic drawer while the approved `/bo/subscriptions` standalone page was denied by staging layout. PAP-1050 fixes ownership via the existing `/bo` React shell instead of adding an unadmitted Next route.
