# WFM-DUTY F2 — Check-in Briefing

Status: IMPLEMENTING
Base: WFM-DUTY F1 exact candidate `064f9364f9e4be625ad879a90d4da7e3abfb42a9`

## Team Surface Decision

```yaml
surface: TOS
primary_device: MOBILE
tos:
  app_family: CA_LAM
  entry_context: Check-in/out
  footer_items: [today, schedule, register, check, history]
  theme: shift
  primary_action: Acknowledge current briefing, then Check-in
  capture_requirements: none
bo:
  primary_layout: NONE
shared:
  permission_context: canonical Workforce self permissions
  cross_domain_links: [Việc]
founder_layout_review: APPROVED
```
