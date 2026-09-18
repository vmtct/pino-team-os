# WFM-DUTY/F1 — TOS Duty Board

Feature: `WFM-DUTY` / `workforce-staff-duty-lifecycle`
Packet: `WFM-DUTY/F1-TOS-DUTY-BOARD`
Core authority: runtime handoff v2 on current Core main

## Team Surface Decision

```yaml
surface: TOS
primary_device: MOBILE

tos:
  app_family: VIEC
  entry_context: /tasks
  footer_items: [all]
  theme: amber/orange
  primary_action: deep-link to owning source surface
  capture_requirements: none

bo:
  sidebar_group: none
  subnavigation: none
  primary_layout: NONE
```

```yaml
shared:
  permission_context: Core staff.timekeeping.view_self / record_self
  cross_domain_links: [Learning Classroom, Workforce]

founder_layout_review: APPROVED
```

The packet inherits the already-approved `Việc` app family and shell. It adds no global navigation contract.

## Authority boundary

- `/tasks` is a projection of canonical `duty/board` only.
- No Team-side task or completion persistence is introduced.
- Attendance and Classroom Diary completion remain Learning-owned.
- Shift assignment remains Workforce/Core-owned.
- Duty source actions deep-link to their owning Team surface and the board refetches Core on return/focus.
- This packet remains ADVISORY and does not change WFM-TIME CHECK_IN/CHECK_OUT mutation behavior.
