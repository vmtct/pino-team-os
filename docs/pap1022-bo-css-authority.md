# PAP-1022 BO CSS authority sync

Canonical authority: BO-V2.5-UI-20261026-PAP-1022. CSS SHA-256: f09418c17d502e3f4c9b18fcc2e51031805ab647cdf58c0e905adb16a9f69fda.

The source manifest and raw canonical files are vendored unchanged. The build verifies their SHA-256 values and generates bo-scoped.css using only zero-specificity root restrictions. Declaration values, order, media queries and tokens remain canonical. A single authenticated BO stylesheet is enabled only on the existing staging BO route. HO receives the six previous stylesheets frozen from main 93fde019; TOS keeps its existing pipeline. No API, auth, permission, persistence, adapter or domain behavior changes.

The prototype responsive property-row declaration was corrected canonically under an exclusive source-writer lease with verified backup. Tracks are 102px through 450px, 108px through 760px, then 130px. The 18px property-label icon gutter is retained.

BO uses the canonical remote PINO logo and an accessible disclosure. Center switching remains disabled until a real scoped backend flow exists. HO keeps its legacy header. Table width variables now allow the canonical responsive rules to apply without !important. HO retains its original inline width behavior.

Founder policy forbids browser/integrated E2E before production ship. PR Validation therefore runs deterministic source, declaration, responsive, scope, authentication and compatibility contracts instead of launching Playwright. Existing architecture, lint, unit, release-confidence, build and packaging checks remain. Browser visual parity is an explicit remaining gap; static contracts do not establish rendered pixel parity.

INDIE_WAIVED_BY_FOUNDER (PAP-507). This implementation is not an independent review. No merge or deployment is authorized by this PR. PAP-986 requires actual staging evidence and must remain open after CSS CI passes.
