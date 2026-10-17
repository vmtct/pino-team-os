# TOS Home V2 — local prototype

Status: PROTOTYPE ONLY — FOUNDER REVIEW PENDING

Jira: PAP-686

## Team Surface Decision

- surface: TOS
- primary_device: MOBILE (responsive preview also supports desktop)
- tos.app_family: NONE (global launcher)
- tos.entry_context: prototype mock shift; roles FRONT_DESK + SHIFT_LEAD
- tos.footer_items: []
- tos.theme: Home / warm neutral PINO
- tos.primary_action: open one of the app tiles
- tos.capture_requirements: no protected reads or mutations; mock shift data only
- bo.sidebar_group: NONE
- bo.subnavigation: NONE
- bo.primary_layout: NONE
- shared.permission_context: client-only prototype gating; not an authorization boundary
- founder_layout_review: PENDING

## Prototype boundaries

- This route is isolated at /prototype/tos-home-v2; it does not replace /.
- Home has no bottom navigation and uses a stable three-column grid with no empty placeholders.
- App list is client-owned; role and device checks are deliberately thin and mock-only.
- Five app icons and Background.jpg are referenced from the pino-tos R2 managed domain. That domain is currently disabled, so browser requests receive 401 until the asset-delivery path is explicitly enabled or replaced with a private/local preview copy.
- No production deployment, production data mutation, or canonical app-family contract change.
- This prototype explores an app-family arrangement that extends the current approved TOS presentation doctrine; do not promote it to canonical runtime without Founder layout review and Core reconciliation.
