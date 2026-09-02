# TOS Surface Reconcile v1

Status: IMPLEMENTATION — bounded `PLT-TOS/F0-TEAM` presentation reconcile

This change materializes the canonical Core `PLT-TOS` handoff on current Team OS main, preserving the Founder-approved `PINO Team Surface Doctrine v1` and the reviewed TOS prototype evidence at commit `3cbd361` (`prototype(tos): group OPS navigation into app families`).

It does not define new Core business authority, persistence, permissions, or lifecycle semantics.

## Team Surface Decision

```yaml
surface: TOS
primary_device: MOBILE

tos:
  app_family: inherited approved families
  entry_context: neutral TOS Home plus existing app-family roots
  footer_items:
    home: [Home, Ca làm, Lớp học, Việc, Pinoria]
    ca_lam: [Hôm nay, Lịch, Đăng ký, Check, Chấm công]
    lop_hoc: [Lớp hôm nay]
    pinoria: [Hiện diện, Điểm danh]
    open_studio: [Open Studio]
  theme: approved doctrine themes
  primary_action: route into owning app context
  capture_requirements: none

shared:
  permission_context: unchanged; Core Access remains authority
  cross_domain_links: Home launcher and header Home escape hatch only

founder_layout_review: APPROVED
```

`Ca làm` footer items are route-backed: `/dashboard`, `/schedule`, `/availability`, `/check-in`, `/timesheet`. `Việc` is an approved app-family shell with an explicit empty state; no task truth is invented. Open Studio remains `app_family: NONE` and its desk stays bounded to its own contextual footer.

## Reconcile outcomes

- `/` becomes neutral TOS Home instead of redirecting into Workforce and is request-dynamic so its `Asia/Ho_Chi_Minh` day label cannot freeze at build time.
- Home bottom navigation is the app-family launcher.
- Entering an app replaces Home navigation with that app's contextual footer; Home remains available from the header.
- `/tasks` and `/availability` are inside the existing TOS staff-session perimeter; UI placement still grants no authorization.
- Footer definitions are centralized so later F phases append within a domain instead of creating global feature navigation.
- Existing API and Core authorization behavior is unchanged.

## Explicit follow-up

Current `Lớp học` implementation still contains Attendance/House operational actions that conflict with the approved pedagogy-only boundary. That is not silently redefined here. A separate bounded reconcile must decouple mentor evidence from Reception-owned Attendance before claiming full doctrine conformance.
