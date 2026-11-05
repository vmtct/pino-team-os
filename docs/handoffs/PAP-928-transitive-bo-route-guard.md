# PAP-928 — BO Architecture V2 / Transitive Render Guard (FC1 source handoff)

**Scope:** narrow independent DEV source slice of PAP-927 and Epic PAP-879, stacked after Team #716 (PAP-926 source), no migration of existing BO pages, no merge or production release.

## Dependency and ownership
- Based on exact Team #716 head `f26038340bf1c2389a858b122d4ff9af969409ad`, itself still OPEN/DRAFT pending FC1.
- Isolated i5 worktree `D:\PINO\worktrees\pap928-arch-gate-hardening-20261022`.
- No changes to the real BO DataGrid, shell, shared old modules, live navigation, public view API or original PAP-926 worktree. Full PAP-927 remains In Progress.

## Implementation
- New `scripts/bo-route-import-guard.mjs` invoked by PAP-926 `scripts/verify-bo-module-contract.mjs` for **only NEW registered BO entry routes**.
- Entry must import only the canonical BoModuleFactory and local moduleAdapter; a single default-exported component must directly return the one `<BoModuleFactory moduleKey="<registered-key>" adapter={moduleAdapter} />` element. A decoy reference, extra JSX, wrapper, dynamic import, or an alternative default render fails.
- Walk adapter's relative and `@/` local static import graph (bounded, cycle-safe). Reject custom JSX elements/Fragments, dynamic `import()` / `require()`, `createElement`/JSX runtime helper use, unresolved local imports, and cross-repository imports. Ordinary pure `.ts` domain helpers still pass. The canonical shared factory import is excluded from this traversal (it legitimately renders one shared grid). Imported npm/data APIs are not statically inspected; normal dependency security remains a separate safeguard.
- Existing CI workflow already calls `node scripts/verify-bo-module-contract.mjs` and `node --test scripts/verify-bo-module-contract.test.mjs`; this slice adds 8 regression tests in the existing suite, so *every PR validation now checks these bypass cases once #716 and this PR merge*.

## Verified
- `BO_CONTRACT_PASS` frozen 47 legacy routes / 41 legacy navigation hrefs, no NEW production modules yet.
- AST verifier suite **16/16 PASS** including added malicious route/adapters and positive pure helper import.
- PAP-926 TypeScript runtime registry suite **4/4 PASS**.
- Exact-head CI and final SHA recorded in PAP-928 Jira receipt and GitHub PR. No local production data or token used.

## Residual risks and acceptance left on PAP-927
1. This is **source-embedded CI enforcement**, not non-bypassable policy. GitHub `main` branch protection endpoint returned 404, rulesets list empty at last checked. A repository admin must configure required `PR Validation / validate` and authorized approvals/CODEOWNERS for the verifier/workflow/architecture definitions. No invented reviewer/owner accounts; branch settings and their readback are a separate, explicitly approved step.
2. The 47 grandfathered old BO pages, 41 nav hrefs and PAP-878 35 canonical surfaces still need migration. The frozen baseline permits their current architecture until retired.
3. The PAP-926 Factory remains an **interim read-only** reuse of BoDataGrid/SidePeek. PAP-874/882/888/924 must integrate the authoritative V2.3 editable drawer, Settings and shared Public Views. This PR does not do that.
4. Static import graph can still be circumvented by changes to its own code or injection through third-party libraries; protecting the checker/workflow/review process is mandatory for a strong claim.
5. A legit specialist module needs a separately approved, typed Full Detail exception contract. V2 admission deliberately rejects arbitrary new Level-1 wrapper/specialist UI.
6. Strict source check may reject legitimate adapter dependencies that import presentation JSX indirectly; the correct remedy is separate a clean data-only domain adapter, not loosen the guard unilaterally.

## FC1 merge handoff
- Verify current PAP-512/184/507 governance, relevant in-flight source ownership, exact PR head/CI/conflict state.
- **Strict source merge order Team #716 → PAP-928 stacked Draft PR**. PR targets main temporarily for CI and contains predecessor code until #716 merges. Recheck actual delta and CI after predecessor.
- Retain `INDIE_WAIVED_BY_FOUNDER` on exact source candidate where applicable; independent reviewer PASS is never claimed.
- No staging, production, D1, branch protection, or shipping authority conferred by this source handoff.
