# Pre-Merge Local E2E — FC mechanic contract

**Purpose:** validate the exact candidate branch/commit *before* Git merge, with no Staging/Production release. This is a reusable technical primitive, not merge authority. PAP-512 and PAP-507 remain admission authority.

## Environment matrix

| Evidence class | Runtime | Data | Allowed verdict |
|---|---|---|---|
| UI E2E LOCAL | isolated i5 worktree, Next.js at 127.0.0.1:3109, Playwright Chromium | route-scoped deterministic fixtures; explicit mock labels | UI PASS / FAIL only |
| Integration E2E LOCAL | candidate TOS + test Core endpoint/test database in isolated environment | genuine test auth, isolated records, no live writes | Integration PASS / FAIL |
| Staging E2E | staging release candidate | staging backend | forbidden while PAP-512 merge-only |
| Production E2E | deployed production code | live data | never proves an unshipped candidate |

**Important:** Mocked route data proves component/rendering/navigation, NOT server auth or real check-in/out semantics. Never label fixture-based UI E2E as authenticated/integration E2E. Maintain separate receipts per evidence class.

## Standard local sequence (Team OS)

1. Protect existing FC worktrees. Checkout exact PR SHA into isolated i5 worktree on D:. No shared-main mutation.
2. Run `npm ci --cache D:\pino-cache\npm --no-audit --no-fund`, `npm run typecheck`, targeted unit tests.
3. Run `npx playwright test --config playwright.premerge.config.ts`. The config starts local Next.js bound to loopback port 3109, captures screenshots under `test-results`, and tears down its web server. Use Windows Node Playwright on i5, not WSL CDP.
4. Assert 390/768/1440 behavior and compare screenshots against Git-backed approved prototype, with explicit visual differences and P0/P1 disposition. Test keyboard and 403/409/empty when relevant.
5. For integration E2E, use **separately provisioned test backend + auth + database**. No reuse of production cookies, live D1 writes, or inferred Core authorization from UI fixtures.
6. Keep `playwright-report/`, `test-results/`, auth storage-state and traces OUT of source commits; retain bounded local/CI artifacts referenced by exact commit SHA.
7. Gate merge by PAP-512/PAP-507: exact-head CI, tests, security, conflict-free, reviewer or explicit Founder waiver; recheck head immediately before merging. A skipped test is SKIPPED, not PASS. Any waiver must record issue, precise scope, omitted evidence, and Founder authorization.

## Reusable Tool

Config: `playwright.premerge.config.ts`; smoke: `e2e/premerge-local-home.spec.ts`. Fixtures in this smoke cover TOS Home UI only. Additional suites can reuse the config but must not silently inherit dummy data for real-business integration testing.

## Constraints / caveats

- `localhost` uses a different middleware host boundary from `tos.pinohouse.art`; add separate host-boundary tests for target domain and a test domain when necessary.
- Local Next.js compilation may require a valid env build configuration. If local server fails, report concrete logs; never point Playwright at Production as a fallback.
- The `PAP-709` historical E2E waiver remains truthful. This new harness does not retroactively change 9 SKIPPED into PASS.
- Do not enable staging workflows, deploy, or mutate Production to run this flow.
