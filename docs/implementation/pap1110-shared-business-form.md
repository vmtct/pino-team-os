# PAP-1110 shared TDD business form

Jira: https://vmtct97.atlassian.net/browse/PAP-1110

This delivery adds a generic, renderer-owned business form seam only. It does not add a Salary route, API, permission, role grant, Core/D1 integration, or live write. PAP-1108 remains responsible for the Salary BFF/Core transport and server-side authorization.

```yaml
Team Surface Decision

surface: DUAL
primary_device: DESKTOP

tos:
  app_family: NONE
  entry_context: Not used; PAP-1110 does not add TOS navigation or a route.
  footer_items: []
  theme: Existing system-owned workspace theme.
  primary_action: NONE
  capture_requirements: NONE

bo:
  sidebar_group: Existing host-owned group; PAP-1110 adds no navigation.
  subnavigation: Existing system-owned Detail business tab.
  primary_layout: FORM

shared:
  permission_context: Module read and slot source permission gate GET/display; the distinct slot submitPermission gates POST. The server remains authoritative.
  cross_domain_links: NONE

founder_layout_review: APPROVED
```

## Salary handoff contract

Register a `kind: "form"` business slot with a nonempty `submitPermission` distinct from `slot.source.permission`. Pass exactly one `BusinessFormProvider` through `SurfaceWorkspace.businessForms`. The provider registration must exactly match `surface`, `moduleKey`, `slotId`, and `sourceAdapter`; missing, duplicate, or mismatched providers fail closed.

The authenticated workspace supplies `principalId`, canonical record subject, record ID, and authorization context to every load/submit call. A provider returns only typed field definitions, typed values, optional typed record rows, and truthful `saved | denied | invalid` submit outcomes. It cannot return JSX. The shared renderer owns the form controls and history grid.

```ts
const rateForm: BusinessFormProvider = {
  surface: "HO",
  moduleKey: "staff",
  slotId: "staff-rate",
  sourceAdapter: "salary.staff-rate",
  load: (request, signal) => salaryBff.loadRate(request.recordId, signal),
  submit: (request, values, signal) => salaryBff.saveRate(request.recordId, values, signal),
};

<SurfaceWorkspace {...workspaceProps} businessForms={[rateForm]} />
```

The business form keys are scoped to the typed provider and MUST NOT be registered as ordinary Staff directory fields or inserted into the generic Staff row/list/drawer. An accepted POST triggers a fresh private GET before history readback; the server remains the only rate truth.

The intended Salary load projection uses three controls (`amount: number`, `effectiveDate: date`, `reason: textarea`) and may include four read-only history columns. History rows require stable IDs. The existing `BoDataGrid` has no `showToolbar`/`showToolbar=false` contract; PAP-1110 does not change that BO-owned component. If Salary requires removal of the empty toolbar container, that is an explicit BO DataGrid follow-up rather than a domain-specific CSS override.

## Privacy and cancellation

Business values live only in component state. Record switches and tab unmounts cancel GET and POST independently and destroy state through the existing keyed Detail record boundary. Hiding the document cancels requests and clears loaded values; returning to the foreground reloads. Latest-generation commits suppress stale providers even when a transport ignores cancellation.
