# WFM-DUTY F4 — Checkout Exception

Status: IMPLEMENTING
Base: WFM-DUTY F3 exact candidate `b48776ebd1abf3d609812ffe0dcdac544b451f21`
Core dependency: `vmtct/pino-core#551` / `f9f3c198491401d1aae7224069f383427dafd770`

## Team Surface Decision

```yaml
surface: TOS + BO
primary_device:
  TOS: MOBILE
  BO: DESKTOP
tos:
  app_family: CA_LAM
  entry_context: /check-in with exact open TimekeepingSession and unresolved CHECK_OUT duties
  primary_action: Xin ngoại lệ checkout
  capture_requirements: reason only; session/staff/center/unresolved set resolved by Core
bo:
  entry_context: /bo/workforce/duty-exceptions
  primary_layout: full-page list + right detail panel
  primary_action: Approve with fresh current-password verification
  display: [staff, center, shift/session, reason, unresolved duties, requested time, status]
shared:
  permission_context: Core workforce.duty_exception.view / workforce.duty_exception.approve
  authority: Core exception record only; no Team approval persistence
  reject_action: NONE until canonical Core transition exists
founder_layout_review: APPROVED
```

## Boundaries

- WFM-TIME remains the sole checkout mutation authority; F4 does not enable production enforcement.
- TOS posts only `reason`; exact open session and unresolved set/hash remain Core-derived.
- BO forwards Center as `request.resource.centerId`; it never invents Manager scope from request body.
- Fresh password is used only for the approval request and is never persisted by Team.
- APPROVED exception does not mark source-owned duties SATISFIED or WAIVED.
