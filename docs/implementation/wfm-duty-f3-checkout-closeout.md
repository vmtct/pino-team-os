# WFM-DUTY F3 — Checkout Closeout

Status: IMPLEMENTING
Base: WFM-DUTY F2 exact candidate `7c92c0b0ced37e13c35d55f7203554032c4ce4c6`

## Team Surface Decision

```yaml
surface: TOS
primary_device: MOBILE
tos:
  app_family: CA_LAM
  entry_context: Check-in/out with open TimekeepingSession
  footer_items: [today, schedule, register, check, history]
  theme: shift
  primary_action: Resolve closeout duties, then Checkout
  capture_requirements: source-owned only
bo:
  primary_layout: NONE
shared:
  permission_context: canonical Workforce self permissions
  cross_domain_links: [Việc, Lớp học]
founder_layout_review: APPROVED
```
