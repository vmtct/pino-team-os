# PAP-929 — BO Legacy Migration Ledger (FC1 safe-source handoff)

**Dependency and authority:** child slice of PAP-927 / Epic PAP-879, stacked after Team OS #716 (PAP-926) → #717 (PAP-928) → this PR. Worktree `D:\PINO\worktrees\pap929-bo-legacy-ledger-20261022`, branch `dev/pap929-bo-legacy-retirement-ledger-20261022`, based on exact #717 HEAD `6dab2cc5b9b4d4f8621879549b57465914236538`. FC1 is sole merger under PAP-512/184/507. No existing BO production route, Live Core data, navigation or other worktree is modified.

## Why

PAP-926 froze 47 historical BO route pages and 41 navigation hrefs. Earlier CI would forever grandfather any file at these paths, even if developers retired or replaced the module. This slice adds migration lifecycle receipts to ensure old UI exemptions can be removed *monotonically via reviewed PRs*, and an old path cannot silently return with bespoke UI.

## Architecture and contract

- `app/bo/architecture/legacy-baseline.json` (PAP-926) stays **unchanged** and hash-pinned.
- NEW `app/bo/architecture/legacy-migration-ledger.json` starts with schema version `1`, `strictLegacy:false`, `adoptedRoutes:[]`, `retiredRoutes:[]`, `adoptedNavigation:[]`, `retiredNavigation:[]`. **Zero real routes have been marked adopted or retired.**
- A receipt is `{"path":"app/bo/.../page.tsx","issue":"PAP-878"}` or `{"path":"/bo/...","issue":"PAP-878"}`, where path must already exist in frozen baseline, issue matches `PAP-NNN`, with no duplicates/conflicts.
- **adopted route** = existing frozen page is deliberately migrated. It MUST have a registered BO module, canonical `BoModuleFactory` entry, real domain adapter, and PAP-928 transitive renderer safety checks. Registering a legacy module without an adoption receipt FAILS.
- **retired route** = frozen page absent. Deleting frozen page without retirement receipt FAILS. Reintroducing retired page at same path FAILS, even when the original baseline lists it as grandfathered.
- **adopted navigation** = existing frozen href now registered; dropping without receipt FAILS. **retired navigation** = href absent; returning after retirement FAILS.
- **strictLegacy:true** cannot be enabled while any of 47 historical route and 41 historic nav records remain neither adopted nor retired. It does not silently imply 35 production screens migrated.
- Only NEW routes were previously checked by PAP-926/928; adopted old routes join that static gate via `verifyBoLegacyLedger`. The verifier prints exact remaining coverage in PR CI.

## Repro / tests
```powershell
node scripts/verify-bo-module-contract.mjs
node --test scripts/verify-bo-module-contract.test.mjs
node --import tsx --test lib/bo-module-contract.test.ts
```
Local outcome in Jira/PR receipt, with exact HEAD CI evidence after push. Tests cover untouched baseline, premature strict mode, missing/malformed ledger, intentional adoption/retirement, unauthorized resurrection, invalid/duplicate entry, nav lifecycle, and an adopted route's factory rejection. Parent 16 AST positive/negative tests retained, adding 12+ new regression tests.

## Workflow for PAP-878 migrators
1. Identify one route and navigation entry in **PAP-878** with actual domain owner and Core field/permission contract.
2. Convert legacy page to canonical Factory and typed domain adapter; register it in BO registry. Keep all real UI/Domain rules and PAP-874/882/924 owned source gates intact.
3. Add `adoptedRoutes` (and `adoptedNavigation` if applicable) with actual PAP issue key in this ledger **in the SAME PR as migration**.
4. If intentionally removing a route/href, delete its source/navigation entry and add `retiredRoutes`/`retiredNavigation` receipt **in the SAME PR**. Do not mix adoption and retirement.
5. Run verifier + negative tests + required GitHub PR validation. FC1 reviews exact HEAD and owns merge.
6. Turn on strictLegacy only when all frozen entries are accounted for, the factory is fully V2.3 authoritative, and secure repo policy/ownership is enabled. Then phase out the frozen baseline under PAP-927.

## Unresolved / do not overclaim
- This ledger can be edited by any code writer **until protected branch rules + approved CODEOWNERS prevent bypass**. The last GitHub API readback for Team main was 404/branch not protected. It is not a tamper-proof policy by itself.
- It does NOT migrate any real module, enable authorization, replace interim read-only Factory, or turn on production strict mode. PAP-927 remains In Progress, and PAP-874/882/923/924/878 remain prerequisites.
- Receipts reference Jira issue keys syntactically; the static verifier cannot prove a Jira issue genuinely authorized the migration. FC1 must check evidence and code review. An imported third-party module is outside the static local adapter graph.
- No Core D1 mutation, staging, production deployment, merge, protected GitHub settings or FC1 queue reprioritization is authorized by this source handoff.
