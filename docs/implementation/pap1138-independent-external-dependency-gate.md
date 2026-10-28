# PAP-1138 — Prevent transitive BO legacy false positives in TDD G0

Owner: Shared TDD PAP-1067. Regression witness: Subscription PAP-1102 Team PR #984. Original exact-head CI #40694466038 FAILED at G0 only: independently changed grandfathered `BoFullDetail.tsx` and new `bo-subscription-detail-url.ts` were incorrectly treated as owned by the admitted HO Staff module. No change to Salary or Subscription business behavior is needed to address this false positive.

## Bounded rule

An admitted BO/HO TDD module owns its exact `files[]` and immediate noncanonical external local-import contract, not every descendant of arbitrary pre-existing shared hosts. G0/G1 now restricts changed noncanonical **external** import/owner-attestation and full-source shell inspection to:

- **Direct local imports from the module's owned files** (including changed newly introduced helpers), requiring an exact `externalReferences[]` file and PAP owner, plus AST shell checks.
- **Sensitive HO/BO authorization/host files** even when reached transitively (e.g. ho-auth, team-auth, founder-core, host-boundary, ho-routes, staff-rate facade), requiring explicit ownership + inspection.
- **Module-owned files** retain complete AST, file fence, schema binding and CSS checks; all canonical renderer/adapter/schema files, scope-specific CSS, new/unregistered routes, special-screen approvals and shared source reconciliation retain their existing gates.

Changed *indirect* grandfathered BO files under a pre-existing shared host may remain on their owning BO CI checks without being reclassified as HO Staff-authored shell, even when dynamic className/legacy V25 shell already exists. No wildcard exception or newly authored HO clone allowed. This is scoped graph ownership, not a waiver of CSS/ACL/security checks.

## Evidence / exit

- Test fixture recreates HO Staff adapter → pre-existing host → grandfathered BO Full Detail → BO URL helper. BO changes PASS even with pre-existing dynamic legacy CSS class.
- Negative tests preserve direct unowned helper FAIL, changed transitive sensitive HO auth FAIL unless exact owner referenced, ownership-referenced new shell FAIL, fake/wildcard owner FAIL, unrelated module-local shell and special approvals existing negatives FAIL.
- Tests: `node --import tsx --test scripts/verify-tdd-authority.test.mjs` 70/70 PASS; current main G0 `errors=[]`, inventory 57 still pending authentic Staging reconciliation.
- Acceptance requires PR #984 exact unchanged candidate source to run G0 against this platform correction, complete protected CI, and reach guarded Staging CD under the owning feature. Do not merge Subscription #984 from this platform scope or claim existing BO modules TDD migrated.

Production unaffected. No real data, Core or ACL mutation.
