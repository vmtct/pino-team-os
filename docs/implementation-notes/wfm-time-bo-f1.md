# WFM-TIME-BO/F1 BO Read

Team Surface Decision

```yaml
surface: BO
primary_device: DESKTOP
tos:
  app_family: NONE
  entry_context:
  footer_items: []
  theme:
  primary_action:
  capture_requirements:
bo:
  sidebar_group: Workforce
  subnavigation: Timekeeping
  primary_layout: SPLIT_VIEW
shared:
  permission_context: Core `staff.timekeeping.view` with GLOBAL/CENTER scope
  cross_domain_links: StaffShiftAssignment read summary only
founder_layout_review: APPROVED
```

F1 is read-only. Team renders Core-projected status, duration, assignment linkage and anomaly flags; it does not recalculate attendance or mutate TimekeepingSession.
