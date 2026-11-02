# PAP-1134 — strict adapter-backed G0 admission

Owner: Shared TDD (PAP-1067), consumer/blocked route: HO Runtime PAP-1130 (PAP-990), ultimate Salary consumer PAP-1108.

The original changed-route G0/G1 admission verifier only recognized a direct JSX TddRenderer binding to an imported schema. The legitimate route in Salary Draft Team #959 uses createHoTddAdapter → SurfaceWorkspace → shared TddRenderer for the actual three levels. An unused direct TddRenderer in the route to pass G0 is explicitly forbidden. The original transitive dependency graph also incorrectly required 113 noncanonical BO/HO/shared host files inside the module-owned admission fence.

This change preserves the existing direct TddRenderer route contract, and adds an **explicit HO-only** `binding.kind = "SURFACE_WORKSPACE_ADAPTER"` with:
- real imported `SurfaceWorkspace` from `app/components/workspace-adapters/SurfaceWorkspace.tsx` with an adapter prop;
- real imported `createHoTddAdapter` from `lib/workspace-adapters/index.ts`, with a local schema module's `staffDefinition` and `staffProvider` and a real `TddRegistry`;
- schema export connected to `registry.register({...staffDefinition})` and the existing full schema validator;
- module-local imports remain in the explicit `files` fence; JSX shell bypasses, module CSS, fake renderer/stub imports, missing schema definition and unadmitted routes still fail;
- changed noncanonical external infrastructure dependencies require exact `externalReferences` with a Jira owner reference and remain AST-inspected for forbidden shell syntax; wildcard or self-owned module refs fail. This does not let a module claim legacy BO DOM as TDD.

Real Salary PR #959 rehearsal, with platform verifier swapped **temporarily and restored** in isolated worktree and only its module `config/tdd-admission.json` set: G0 `errors=[]`, 12/12 selected Salary security/provider tests PASS. The three explicit HO infrastructure external reference paths are `lib/ho-routes.ts`, `lib/ho-system.ts`, and `lib/host-boundary.ts` (PAP-990). This is not a real authenticated Founder permission receipt, not a merged Salary PR, and not a Production authorization.

Run: `node --import tsx --test scripts/verify-tdd-authority.test.mjs` (66 regression/negative cases) and `node --import tsx scripts/verify-tdd-authority.mjs` (existing clean main inventory). This G0 fix must merge through normal exact-head CI and guarded staging before HO PAP-1130 can be admitted in its own owner slice. Do not migrate all 57 grandfathered routes or grant `staff.compensation.manage` client-side.
