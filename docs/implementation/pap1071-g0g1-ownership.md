# PAP-1071 — Scoped TDD G0/G1 ownership

Jira: PAP-1071 under PAP-1067; GPT contract PAP-1078 #17022 and handoff #17024.
Base: `9b23fd417f0251bce0245882b5152b2cf2ca0920` (fresh origin/main).
Source writer: `codex/pap1071-g0g1`; PRJ-PLT / PLT-BO / bo-operational-read-plane.
Entry: Drift NONE, clean base, source-care reclaimed from stale PAP-1022; no Core source edits.
Terminal: STOP_BEFORE_MERGE, GPT architecture audit pending; no Indie dispatch or deployment.

## Commands and scope

```
npm run tdd:authority:test
npm run tdd:authority:check -- --base origin/main
node scripts/build-bo-authority.mjs --check
node scripts/build-ho-authority.mjs --check
```

PR Validation checks out the exact candidate head with history, passes the trusted PR base through TDD_BASE, runs the gate and its negative controls, then retains existing auth/ACL/authority tests, lint, unit tests, build, and adds explicit typecheck. The CLI executes impacted profile tests, failing if any fail. This is G0/G1 static and schema evidence; G2/G3/G4 remain separate work.

`config/tdd-admission.json` contains explicit migration/new-route admissions. No current live module is silently admitted by this slice. New source routes without registration fail. The immutable preexisting source-route list is verified against Git at the base SHA, so editing inventory cannot self-grandfather new pages. Removing an admitted profile on subsequent PRs fails. Existing source routes remain nonblocking until explicit admission; this preserves unrelated legacy hotfixes and existing baseline security checks. Source preexistence is a CI compatibility fence, **not evidence of deployment**.

Changes to a module's owned files or reachable imports/re-exports/literal dynamic imports trigger its profile. Changes in shared renderer, adapter/schema, BO/HO authority and builders, global CSS or HO theme trigger dependent profiles. Opaque dynamic imports fail in admitted modules. Existing shared authority files cannot be claimed by a module; new shared authority files require separate source-owner reconciliation. Existing DS builders and authority hash/isolation tests remain authoritative. Newly introduced or changed shell selectors outside authority fail, while unchanged legacy selectors remain nonblocking.

## Three profiles

- `TDD_DEFAULT`: declare surface, key, exact route, page file, exact `files[]`, `schema: {file, export}`, `binding: {file}`, and `tests[]`. The schema must be exported from a file that instantiates the canonical imported TddRegistry and calls register. The binding imports that schema and the canonical TddRenderer directly from Renderer.tsx, passing the schema in `view`. Local dependencies outside shared authority must be inside the explicit file fence. The runtime validator enforces known fields/slots, reserved tabs and one-column Drawer; AST checks reject module shell tags, reserved classes/roles, inline CSS, HTML injection, opaque class/spread construction, and module-owned CSS. Unsupported indirect composition must be reconciled explicitly, not ignored. Use shared components for nested typed grids and dialogs.
- `FOUNDER_APPROVED_SPECIAL`: exact route/key/surface, explicit file fence and approval ID. `config/tdd-approved-special.json` is read from **trusted base**, never candidate self-approval. First record the actual Founder Jira decision in a separately reviewed authority update; only then admit its implementation. Required record: status approved, approvedBy Founder, exact Jira focused-comment URL, approvedAt/expiresAt timestamps, owner, justification, designAuthority, permissions, fallback, exact files and tests grouped by security/authorization/accessibility/responsive. Alternative tests actually run. No shell or system-tab requirement. Wildcard, traversal, expired, revoked, future, mismatched or unrecorded approvals fail. Current registry is empty; synthetic approvals exist only in tests. Permanent exceptions require deliberate contract extension/reconciliation; no accidental indefinite waiver.
- `EXISTING_GRANDFATHERED`: source inventory/report only; it cannot authorize a new route. Live eligibility/admission remains PAP-1086/1087. Explicitly migrating a page requires a hard profile; unrelated hotfixes retain baseline CI.

The engine owns All/Tất cả; `table.views.builtIn[]` may be empty or contain valid typed default queries. Custom/Saved Views remain independent. No prototype column count/order check is introduced. No runtime UI, data, auth, permission, Core schema or view-persistence behavior changes.

## Source reconciliation against PAP-1068

`config/tdd-inventory.json` records all 46 BO and 11 HO source page files with imports, composition, static host evidence, owner, risk, migration and proof gaps. These are **57 source paths, not 57 deployed or eligible modules**. Query-module aliases under /bo are another inventory axis and must not be added to this denominator as unique deployments. BO URL target descriptors are intent; no absent /bo/students or dynamic detail route is invented.

Source evidence: BO layout authenticates with authorizeBoShell, and UI-only mode admits only /bo plus four explicit Workforce/payroll paths; other source pages cannot be counted as reachable in that mode. HO's ten module paths and root are statically manifest-listed behind authorizeHoShell. /ho root is a redirect, not an eleventh module. HoCenters still calls HoWorkspace without tdd/tddAdapter. BoRuntimeEntry still selects compatibility workspace without those props. The merged shared engine and adapters provide opt-in seams; their existence does not prove every legacy page uses the typed TDD registry. Source-only baseline classifications are provisional GRANDFATHERED or OUT_OF_SCOPE (redirect); no live TDD_COMPLIANT/FOUNDER_EXEMPT claim.

Per-route authenticated reachability, actual serving SHA, eligible journey, DOM geometry, actor/tenant access and migration wave remain PENDING. PAP-1068 and PAP-1086/1087 own live reconciliation. Browser/integrated E2E NOT_RUN_FOUNDER_POLICY. No new Staging proof or deployment claim.

## Ownership fence and remaining work

Changed files are limited to the three config JSON files, this note, verifier and negative tests, package scripts, PR Validation. Zero overlap with PR #957's 18-file manifest. No edits to Core, renderer, schema, producer CSS, generated CSS, BO/HO routing or runtime adapters.

G2 PAP-1072: keyboard/focus/ARIA/loading/denied/business-slot and history interaction tests on the existing shared renderer. G3 PAP-1073: actual measured DOM geometry. G4 PAP-1074: authorized post-CD role/serving-SHA acceptance. None is claimed complete here.

Static limitations: this is a conservative supported admission seam, not a general JavaScript equivalence proof. Complex indirect renderers, opaque loaders/classes and JSX spreads require explicit owner reconciliation. Tests prove known bypass controls; visual equivalence and live authorization require their respective later evidence.
