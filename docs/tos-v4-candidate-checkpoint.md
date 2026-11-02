# PAP-938 DS V4 — CP2 source candidate, not staging acceptance

This candidate continues `d6087ec6c7c671ac0b3fed7779e3df3244c795e3` on `codex/pap938-dsv4-20261026`, draft Team OS PR #878. Current main advanced to `6484fe27cbc256d29747f9acdc12411e634a43ec` (#880/#881) during final freshness checking on 2026-10-27 +07. The candidate locally reconciles that main; incoming BO source and added staging-route CI gates are preserved. This is reconciliation within the candidate branch, not a PR merge into main. Existing main CI/build/BO controls and the previous selective reconciliation of #810/#871 remain intact. Their branches/worktrees are untouched. No merge or deployment is authorized or performed.

## Authority and scope

PAP-938 Jira comments 16426/16429 still assign Codex sole implementation executor. PAP-512 retains BO → Pinoria TV → TOS → Staff and independent HO-0 lane. Current-main AGENTS.md retires the old PLT-CARE gate; no historical lease was claimed. No actual conflicting writer was observed in this isolated candidate. PAP-980 permits full-stack development, subject to scoped Core and release authority.

Pinned ZIP SHA256 `74C95D3B1261C5B843DB1D92640C4581D03CE9354A9308DDC15C1415D9403B36` reverified. Frozen source file hashes, lock, asset inventory and historical screenshots remain in the CP0 manifests. The candidate renderer hashes are recorded separately in `tos-v4-cp2-port-manifest.json`; authoritative source hashes are not overwritten with implementation hashes.

## Checkpoints

CP0 PARTIAL: clean authority extraction/install/export was completed previously; fresh screenshots/diffs, remote asset byte freeze and physical Safari proof remain missing.

CP1 SOURCE_CANDIDATE: one shared AppPhoneFrame, scoped V4 tokens/layers and shared primitives. Mobile app content now uses the actual frame directly. Classroom keeps its V4 viewport body and compact detail header; Reception uses content-only Ops body under the same frame/header. Shared modal root includes background isolation, Escape, focus trap/restore and forwarded semantic attributes. Node-only checks cannot prove browser focus or computed layout.

CP2 SOURCE_CANDIDATE, VISUAL_NOT_PROVEN:

- Home/Ca Làm retain the previous V4 source implementation. Six identities remain; Trưởng Ca stays disabled.
- Classroom now renders the source V4 launcher/setup, class header, student/history, Mission selection/guide, Diary list/detail/form, evidence preview and dirty-discard UI. Original classroom CSS and icons are retained, including nonshrinking long cards and 2×2 interest controls. In-memory inputs are UI previews; all business submitters remain disabled. No demo datastore or fixture import is present in runtime. Missing age/domain/room/co-teachers/Diary/catalog/opening facts remain unknown.
- Training now renders V4 library/chips/rows/detail, minimum-hours label with 4px token gap, prerequisite navigation and two bottom tabs. Existing typed V5 reads and separate F0 qualification reads are retained. Registration/cancel remain disabled; completed records do not offer cancellation. No certificates are issued locally.
- Station now renders the source desktop shell/five workspaces, overview, inventory, student table, device and TV panels. Unknown metrics show dashes; no seeded node, health, Region, items or TV state is shown. All command controls are disabled. Desktop threshold remains 1024px.
- Reception now renders the source setup/photo preview/checklist, overview, arrival filters/list, shared detail sheet and Pinoria panels. Setup can enter a read-only view but never creates an opening/bypass record or timestamp. Existing scoped Student Visit lookup is retained as an explicit integration addition. All opening, arrival, checkout and Wish submitters remain disabled. Collection counts are unknown until source-owned list reads are available.

Node SSR tests use synthetic records only in test modules. They exercise markup, read-state distinctions, long content, disabled commands, unique tab/dialog semantics and immutable view models. CSS modules are stubbed in Node: this is **not** a browser/computed-CSS/screenshot parity test. Every affected parity ledger row stays DIFF, never PARITY_PASS. Physical camera, touch/swipe, focus/scroll and Safari remain unverified. Founder policy prohibits browser/integrated E2E before production ship; no such run was performed.

CP3 READ_CANDIDATE: existing context, schedule, current/history, own income, open Student Visit, V18b day and Training clients retained. Classroom now rejects a mismatched response center/date before rendering, resets by scope and suppresses stale late responses. Local 401/403/404/503 tests prove failure handling against mocked contracts only. No authenticated staging actor/readback or real center-boundary test is claimed.

CP4 BLOCKED_CORE: rechecked 2026-10-27 +07, Core #1770 head `463b38e50578a164a3f23ac9dca9863a38a69490` is OPEN/green; #1793 `50ba27602024ce318ba1c8b34d56f21ff44be723` OPEN draft/green; #1794 `961d0599e49a8efb1b33f86f58a74b99293e2360` OPEN draft/red; #1810 `470e5dc53ec7ae41044fa0a87efca7af2545ea7f` OPEN draft/green stacked. These states do not prove deployment. #1770 transport exposes GET by Diary UUID, not GET list at `/learning/path-diaries`; the Classroom day DTO does not supply Diary IDs. The Team facade also needs query forwarding reconciled before adopting this unmerged GET contract. No guessed list endpoint, legacy Session fallback, D1 query, fabricated Diary or Core writer was added. Mission DTO/list, Reception opening/pickup/list, photo check-in and Station commands remain unverified. PAP-724 consumption remains WAIT_FOUNDER_DECISION.

CP5 CI_CANDIDATE: pre-reconciliation local Next build/provenance PASS; DS source guard PASS (one frame, 122 tokens); TypeScript PASS; full unit/contract suite 991/991 PASS, including the new V4 renderer tests; BO/release/provenance scripts 79/79 PASS; lint 0 errors/198 warnings. A forbidden `module` variable name in a test fixture was corrected and full lint rerun passed. Exact candidate SHA is supplied by the PR/Jira receipt. User requests stopping once the next exact-head CI begins, not waiting for a PASS or merging/deploying. Previous candidate CI was green; that result does not certify this new head. OpenNext packaging is part of remote CI, not a local claim.

## Staging admission

NOT_ADMITTED. Missing fresh exact-head CI result, approved staging queue/action, protected authenticated actor/readback, serving SHA/version, isolated bindings/outbound fence evidence and rollback receipt. Diagnostic integration remains hard-off in production builds. No staging exposure flag, Production/D1/R2/schema/secret/domain/outbound mutation was added.

INDIE_WAIVED_BY_FOUNDER under PAP-507; this is owner self-check, not independent-review PASS. Exact-head waiver receipt accompanies the candidate.

## Next safe step

After the requested CI stop, inspect that exact-head run when resumed and fix failures. Resolve source-owned list/DTO/deployment dependencies and establish approved non-production actor/admission before live readback. Fresh visual evidence requires reconciliation of the Founder browser-testing restriction; do not relabel Node SSR as visual acceptance.

## Team Surface Decision

surface: TOS; primary_device: MOBILE, Station DESKTOP ≥1024; six Home identities per PAP-934; max five footer items; neutral Home and app semantic themes. Core owns permissions, scope and business truth. BO layout unchanged. Founder visual acceptance: PENDING.

Post-reconciliation local validation is reported against the exact final candidate in the PR/Jira receipt. The new BO staging-route gate must pass before pushing.
