# Open Studio Pass Control Desk V1

```yaml
Team Surface Decision
surface: BO
primary_device: DESKTOP
tos:
  app_family: NONE
  entry_context: existing Open Studio Desk unchanged
  footer_items: []
  theme: existing classroom theme unchanged
  primary_action: NONE
  capture_requirements: NONE
bo:
  sidebar_group: Operations
  subnavigation: Open Studio
  primary_layout: SPLIT_VIEW
shared:
  permission_context: canonical Core open_studio.manage
  cross_domain_links: learner lifecycle, House Membership, Center authority
founder_layout_review: APPROVED
```

## Runtime boundary

- Team OS only forwards approved BO facade commands to `BoAccessControlPlane`.
- Monthly Path issuance remains Path-scoped and derives Center/policy/quota in Core.
- Bring-a-Friend issuance remains Household-scoped and derives Center/policy/quota in Core.
- Pass revoke requires canonical `{ revokedAt, reason }`; actor identity is injected by Core.
- BO does not materialize Guest/Sibling admission until Core exposes a bounded participant command.
- TOS remains the owner-facing day-of outcome surface and is unchanged by this slice.
