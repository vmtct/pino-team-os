# PAP-650 / PNR-TV — PAP-1646 view-only FE frame groundwork

Date: 2026-11-08. Owner: PAP-1646. Branch: feat/pap1646-pnr-tv-viewer-layout-20261108.
Source authority: i5 DESKTOP-ISRDREN, approved full HO Policy-first prototype in PAP-1628 #23747, S0 Founder staging plan PAP-1651 #23772.
Canonical HO preview: http://192.168.1.6:8800/ho?module=tvPolicy&viewer=demo-policy-default .
This prototype is only UI evidence, NOT a Core-backed viewer.

## Team Surface Decision
- surface: DUAL *entry context* (TOS Staff or HO Founder); view-only frame itself is a domain-neutral fullscreen primitive.
- primary_device: DESKTOP / TV browser, responsive to MOBILE.
- tos.app_family: PINORIA; tos.entry_context: authorized Staff session within assigned Center.
- tos.footer_items: []; tos.theme: existing PINORIA; tos.primary_action: NONE on the viewer frame.
- bo.sidebar_group: NONE; bo.subnavigation: NONE; bo.primary_layout: NONE (no BO admin or BO TV route).
- shared.permission_context: server-side Policy+Center+role validation is owned by Core PAP-1650; NO client-side grants.
- shared.cross_domain_links: future HO/TOS Open TV and Copy URL only after accepted stable Policy transport.
- founder_layout_review: APPROVED for full local i5 prototype only; staging Viewer V1 gate PAP-1647 PENDING.

## Bounded deliverables
- Pure deterministic contain geometry for 16:9 Ambient and *optional* 9:16, at 390/768/1440/1920 without crop.
- Domain-neutral responsive CSS frame and explicit unavailable UI; no new URL route.
- No Policy ID formatter, new service, Core GET, data fetch, session, cookie, Device lifecycle, heartbeat/ACK, command, presentation claim or data mock.
- Existing `app/tv/[displayId]` physical Kiosk remains unchanged. Its TV-only session must **not** be reused for view-only links.
- Do not ship a working Viewer route or bind user content before Core PAP-1658 registry/identity and PAP-1650 authorized published-config contract are reconciled; PAP-1647 Founder acceptance remains separate.

## Validation
- `node <existing scoped tsx runner> --test lib/pinoria-tv-viewer-layout.test.ts`: 10/10 PASS local i5.
- Frame DOM/CSS/Playwright proof and exact-head PR CI to be appended after independent checks.
- Production/Staging/Cloudflare/D1: NOT_RUN. No access-control or source-authority change.
- External: Core Architect stable Policy type/ref contract (PAP-1658), Core published read/auth resolver (PAP-1650), Team integration and actual authenticated stage E2E (PAP-1646), Founder PAP-1647.

## Independent i5 evidence (2026-11-08)
- Actual i5 approved HO viewer prototype reachable at `http://192.168.1.6:8800/ho?module=tvPolicy&viewer=demo-policy-default`: HTTP200 and iframe contains labelled Global Projection / preview-only. Source parity and full visual diff NOT asserted.
- `node --import tsx --test lib/pinoria-tv-viewer-layout.test.ts`: 10/10 PASS.
- Targeted ESLint of 3 changed TS/TSX files: exit 0 PASS.
- i5 CDP Playwright independent CSS/DOM geometry at 390x844, 768x1024, 1440x900, 1920x1080 (16:9 and 9:16): 8/8 PASS, no document overflow/crop. Temporary test tabs closed.
- Not authenticated Staging G3/G4. No live Policy data, API or route. No Core/Repo merge/Cloudflare/Production change.

## PAP-1646 fail-closed policy admission UI contract (ChatGPT + RDC)
The UI display-only component has no Core client, session exchange, physical Device lifecycle or viewer URL route. It cannot be used as proof of authorized rendering.
- HTTP 401 -> `login_required`; 403 -> `access_denied`; 404 -> `not_found`; 503/5xx/unknown -> `unavailable`.
- HTTP 200 and 204 are **also `unavailable`** in this pure helper until the future server-side authenticated Core Policy projection independently proves the actor, Center, published Policy and safe content. No browser-only status ever authorizes display.
- No raw ID, principal, token or private data appears in copy. `PolicyViewerUnavailable` shows accessible status with predictable reason.
- Local i5 Node tests 22/22 PASS; scoped ESLint PASS. Full exact-head PR CI and Staging G3/G4 require separate checks.
