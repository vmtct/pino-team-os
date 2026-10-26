# PAP-938 DS V4 — candidate checkpoint, not staging acceptance

Scope: first CI candidate prioritizes shared V4 DS, Home and Ca Làm, as permitted by the handoff's first-slice sequence. It does NOT complete the entire CP0–CP5 plan. No all-app parity, functional staging PASS, staging admission or Founder acceptance is claimed.

## Reconciliation

New isolated branch codex/pap938-dsv4-20261026 starts at main 99e67ffbd2321b283eb2fde6a9917c730b8262e8. #810 remains OPEN DRAFT at 20afab64537f4734bb4c21c6deb3aef4dab882e3 (base main); #871 remains OPEN DRAFT at d4b4746d07d5ba74c371db971b6baf2a9a62e891 (base #810 branch). Their worktrees were clean and remain untouched. Only their 49 new TOS implementation/test files plus the isolated own-income change were brought to current main after checking for path collisions. Old CI/package files were not copied. Existing main CI/build/BO controls retained; DS V4 source guard added. No rebase/force-push/close/retarget of either old PR. No unrelated BO implementation ported.

The older worktree's compatibility inspector reported DESTRUCTIVE due to workflow/package drift. Current main AGENTS.md retires PLT-CARE and legacy allowedMode as authority; live Jira PAP-938 comments 16426/16429 assign Codex sole executor. Founder additionally approved the concrete isolated reconciliation in this chat. No historical care claim was created. Real single-writer isolation is the newly allocated worktree/branch, not an invented lease.

## Checkpoints

CP0 PARTIAL: ZIP pinned, fresh lock/install/static build, source+asset hashes and historical screenshot inventory recorded. New visual golden/diffs, independent remote asset byte pin and Safari remain missing.

CP1 PARTIAL: V4 semantic tokens/cascade, real AppPhoneFrame, V4 Header/Nav/Card/Sheet/Button/Field/Toast/Badge ported to single runtime package. Existing aliases delegate to those implementations. Tokens scoped to data-tos-system to avoid BO leakage. Runtime has 95 canonical tokens plus 27 compatibility aliases. Strict source gate covers active DS/app CSS and TSX; no important/hash selectors/literal colors outside tokens/unapproved fixed inline styles. App-specific legacy typography/layout debt and whole-app runtime adoption still need reconciliation.

CP2 PARTIAL: Home authoritative CSS, 6 identities/order, native disabled Trưởng Ca, settings Escape/outside/focus restoration; Ca Làm authoritative CSS, 3/5-day carousel with seven-day scroll/arrows/keyboard, real schedule/current/history/income presentation, camera sheet and blocked writes. Station no longer inherits mobile content insets; Training old hero removed and exact minimum-hours label uses 4px token gap. Reception/Classroom/Station full V4 screen trees remain NOT_IMPLEMENTED; existing fail-closed UI is NOT accepted parity. See tos-v4-parity-ledger.csv. No pixel PASS for any app.

CP3 READ_CANDIDATE only: preserved typed context/schedule/current/history/own-income/visit/V18b-day/Training adapters, 401 invalidation and optional scoped 403/outage handling, mandatory schedule before auxiliary private reads, no arbitrary staff ID. Local unit tests mock contracts; no authorized staging actor, no live GET/readback, no live negative center/role tests. Do not label mocks as real authenticated readiness. Runtime does not call check-in/out, register, Diary close or device commands.

CP4 AUDITED_BLOCKED: exact Core heads/results in tos-v4-core-dependency-audit.json. #1770 is now green (old stale failure wording removed), but still OPEN/unmerged. #1794 remains red; #1810 is a separate green stacked fix, not evidence of deployed V5. No Core source/schema/migration/R2 mutations. Diary consumption policy PAP-724 remains WAIT_FOUNDER_DECISION; photo check-in PAP-868/869, opening/pickup, station node/TV/device contracts remain BLOCKED_CORE.

CP5 CI_CANDIDATE only: local DS/TypeScript/build/lint/unit/contract evidence retained; remote exact-head CI requested with final candidate. User-directed stop is when CI starts; do not wait for PASS, merge or deploy. Remote CI status belongs to PR/run readback, not this pre-commit report.

## Staging admission

NOT_ADMITTED. No exact-head green CI for the new candidate yet, no authenticated staging actor/readback, no new serving SHA/version/rollback proof, no current TOS queue/deploy slot established. PAP-512 retains BO → Pinoria TV → TOS → Staff order and independent HO-0 lane. Protected diagnostic integration route remains off in all production builds; no staging exposure flag was added. A future staging-specific authenticated ingress needs separate scoped admission. No shared staging/Production/D1/R2/secrets/domain/outbound changes.

## Self-check and limits

INDIE_WAIVED_BY_FOUNDER under PAP-507; exact-head receipt is supplied with the final PR candidate. This is owner self-audit, not independent-review PASS.

The full unit suite initially found five Windows CLI entrypoint failures in existing auth redirect/rollback tests: file:// string concatenation did not match Windows import.meta.url, so CLI stdout was empty. Replaced only the two entry guards with node:url pathToFileURL; the auth and rollback decision functions are unchanged. Their 19 protective tests pass after the portability fix. No production operation executed.

## Next safe step

After the requested CI stop, inspect the same exact-head run once authorized to resume; fix any CI failures, then continue full V4 Reception/Classroom/Station/Training presentation from the pinned source before any staging-admission claim. Establish authorized non-production actor/readback and current queue/lease separately. Do not promote this partial source candidate as a complete TOS staging release.

## Team Surface Decision

surface: TOS; primary_device: MOBILE (Station DESKTOP >=1024); app_family: CA_LAM / LOP_HOC / NONE according to the PAP-934 six-tile Founder supersession; footer max five; neutral Home, per-app semantic themes; primary action: authorized operational reads; capture: camera presentation only, confirmation blocked. BO sidebar/layout unchanged. Core remains permission/scope/domain authority. Founder staging visual review: PENDING.

Local final validation: DS V4 source guard PASS; TypeScript PASS; Next build PASS; full unit/contract suite 991/991 PASS (0 failures); BO/release script suite 77/77 PASS; lint 0 errors/190 warnings. git diff --check PASS. Browser/integrated E2E NOT_RUN_FOUNDER_POLICY; physical Safari NOT_RUN. OpenNext asset packaging remains a remote CI job, not a local PASS claim.
