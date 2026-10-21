# PAP-870/871 — Workforce Check-in Photo Evidence V1

Founder-authoritative UX: PAP-846, i5 OneDrive PAP-846-checkin-photo-v1. Epic: PAP-868. Core dependency: PAP-869/PAP-872 PR #1795.

## TOS UX
- The existing Duty-aware Ca Làm check-in is preserved (assignment, briefing, clock-in idempotency).
- Operator opens a `getUserMedia` camera-only capture panel (prefer rear camera), previews or retakes; **no gallery/file chooser** exists in this surface.
- Image is compressed to JPEG up to 350KB in memory. No photo bytes in localStorage or browser persistent storage.
- Team route `/api/workforce/timekeeping/photo/upload` forwards raw ArrayBuffer using existing authenticated Core binding. A one-use Core photoId is passed to canonical `/timekeeping/check-in`.
- All transaction retries preserve same captured Blob and upload/clock idempotency keys until completed; photo capture never mutates payroll directly.
- Camera permission denial/error leaves normal check-in closed. **Audited no-camera manager override still needs explicit product approval/implementation.**

## BO UX
- Existing per-staff manual Pay Period `PayrollPeriodsView` contains a `CheckInPhotoGrid` before the staff FINALIZED action; it uses Core scoped periodId/staffId/centerId, server pagination, and private image GET proxy.
- Days present in daily settlement but missing TimekeepingSession appear as placeholders. Sessions without photos and deleted image tombstones are also visible. Human reviewer explicitly ACKs salary, timekeeping proofs and warnings.
- Images are private, `Cache-Control: private, no-store` and `X-Content-Type-Options: nosniff`; no public R2 or CDN URLs.
- The grid is review-only; `FINALIZED` and `PAID` truth remain owned by existing Payroll service.

## Security/release handoff
- Core must deploy migration 0138 and matching private media contract before this Team version.
- Production Core optional `CHECKIN_PHOTO_MODE=REQUIRED` is **disabled by default** and can only be enabled after Team camera UX and audited exception policy are serving.
- `getUserMedia` requires HTTPS or localhost. The old LAN HTTP prototype has mock capture only.
- Pre-merge tests required by CI; authenticated media binary service-binding, ACL cross-center, upload byte bounds, retry after lost response and retention purge readback still need full integration acceptance. Local shared node_modules on i5 are incomplete; GitHub CI must be source-of-truth.
- This is DEV source, not staging or Production authorization. FC1 is sole merger under PAP-512; project code PRJ-WFM.
