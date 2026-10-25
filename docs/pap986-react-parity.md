# PAP-986 — shared React BO parity

The previous `/bo` staging page executed a vendored prototype closure plus monkey patches. Its legacy React components used a different style pipeline. Updating the source snapshot alone would therefore leave two different runtime presentations. PAP-986 replaces the staging rewrite with one React workspace for the fifteen already admitted tables, using the current Hồ sơ đăng ký authority and existing authenticated read adapters.

The eight authority assets are copied byte for byte from the canonical i5 OneDrive source. `public/bo-authority-source/manifest.json` records the exact hashes: HTML `5da8f56e…`, JS `7a2d1d3d…`. The six CSS files are the only design source. The original HTML/JS are references; they are never executed by `/bo` and cannot be fetched through the authenticated stylesheet controller. The old monkey-patch bridge is removed. No module adds a stylesheet or design class.

## A–F disposition

| Item | Previous runtime gap | Shared React implementation / proof |
| --- | --- | --- |
| A | Global topbar and duplicated breadcrumb | `BoRegistrationWorkspace`: heading begins at workspace top, existing grouped sidebar/search/collapse, mobile opener/scrim/keyboard |
| B | Separate Full Detail navigation strip | `BoFullDetail`: compact Back/mobile menu inside hero; filter/page/table horizontal scroll and triggering focus restored |
| C | Demo/capability panels and unavailable subject history | Authentic name/UUID, grouped domain fields, authorized row projections in pilot advanced cards; `BoRegistrationHistory` uses existing exact-subject BFF for Students/Classes only |
| D | Table formatter truncated notes/selected values everywhere | `BoValue` keeps compact Table/Drawer rendering and complete multiline notes/all chips in Full Detail |
| E | Duplicated Drawer hero/footer and weak keyboard handling | `BoQuickView` has one module eyebrow/title/X, properties including ID, only Full Detail footer; shared dialog focus trap/restoration; unsaved local-name preview and required-name validation |
| F | Old detached editor and immediate Boolean mutation | `BoTypedEditor`: fourteen types, control + Cancel/Save, accessible field label/validation, anchored top-left/clamped and repositioned on scroll/resize; exact authority padding 14.25/13.3px; Boolean explicitly saved/cancelled |

Live record fields remain read-only. Create never issues a command, allocates an ID, adds a row or claims a server save. Only its unsaved name draft can be edited locally. The local type-coverage harness is under `scripts/fixtures`, has no application route and is not shipped as staging data.

History is a new UI binding to the already admitted read API, not a new Core contract. Each request pins canonical `subject_type` and `subject_id`; the existing BFF/Core own actor tenant/center ACL. Whole-page validation rejects cross-subject/type, unredacted, duplicate, non-monotonic and repeated-cursor responses. Bounded exact-subject pages are collected in stable order before localized action/actor search, with visible list pagination. Sensitive field/before/after values remain protected. No global Audit directory is used as a subject-history source. Other thirteen modules show a truthful unavailable state. Unknown action codes receive a neutral Vietnamese label.

Settings preserve property visibility/order/drag, typed filters, grouping/hide/collapse, search/sort, session-local saved views (rename/delete/reorder) and undo/redo. Pending/approved prototype view affordances remain disabled where no admitted domain mapping exists. Public/shared persistence is still deferred; no existing backend implementation is removed. Legacy React pages/components remain for their other deployments; on this staging flag they redirect to the single `/bo` workspace.

## Style pipeline and environment fence

The root layout selects the six protected authority stylesheets only on the exact staging hostname, trusted middleware route marker, `APP_ENV=staging` and `BO_UI_ONLY=enabled`. Caller route markers are discarded. BO entry still calls `authorizeBoShell` before rendering; CSS requests independently authorize. Other routes load unchanged legacy global/foundation bytes copied during the normal build. The legacy Foundation Lock now checks that exact packaging mapping and still rejects token, density, scope and fallback drift. No production hostname enters the new runtime.

Team Surface Decision: **BO / DESKTOP**, responsive review at 390/768/1440. Existing SCHOOL/WORKFORCE/PINORIA/SYSTEM groups; TABLE → Quick View → Full Detail. Feature `PLT-BO / bo-operational-read-plane`, coordinating Project `PRJ-PLT`. Canonical domain permission/identity/schema semantics unchanged. Founder layout acceptance remains pending.

## Verification and release

`node --import tsx scripts/verify-bo-react.mjs` bundles the actual shared React components, supplies synthetic GET transport and captures the actual current authority separately. It checks 45 module/viewport combinations, all three detail tabs, focus/context/overflow, 126 typed editor surface/type/viewport cases, settings/views/undo/create validation and unauthorized/stale/cross-subject/redaction denials. Set `PAP986_AUTHORITY` to the OneDrive source for independent byte admission. Screenshots and machine receipts are local/CI evidence, never staging proof.

Focused adapter/BFF/history/state tests and the full Next build are required. The Windows full suite reports eight unchanged platform-dependent CLI/Bash failures (871/879 pass); exact-head Linux CI must pass all tests before merge. No independent PASS is claimed: `INDIE_WAIVED_BY_FOUNDER` under PAP-507.

Founder explicitly transferred PAP-986 merge/staging ownership to Codex in the active chat; recorded PAP-512#16237/PAP-175#16238 supersede only the FC1 downstream-owner wording. `pap986-react-parity-staging.yml` admits the scoped branch's merged current-main SHA and exact successful push CI, checks Team/Core versions, retains a guarded rollback, validates the eight unchanged staging-only bindings and serving provenance. Source, merge and serving SHAs/versions and final actual browser acceptance are recorded separately in PAP-986. No new fixture/data/policy/credential mutations, Core deployment, D1/R2/secrets/migrations, Production or outbound actions.
